import { performance } from 'node:perf_hooks';
import * as crypto from 'node:crypto';
import * as k8s from '@kubernetes/client-node';
import WebSocket from 'ws';
import {
  ClusterConnection,
  LiveRunTick,
  NamespaceTopologySnapshot,
  SecurityAuditFinding,
  TestRunRecord,
  TestScenario,
} from '../types.js';
import { storageRepo } from '../storage/repository.js';
import {
  k8sDiscoveryService,
  parseK8sCpuToMillicores,
  parseK8sMemoryToMi,
} from './k8sDiscoveryService.js';

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

export class RealRunnerEngine {
  private activeRun: TestRunRecord | null = null;
  private abortController: AbortController | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private activeSockets: Set<WebSocket> = new Set();
  private onUpdate: (run: TestRunRecord) => void;

  constructor(onUpdate: (run: TestRunRecord) => void) {
    this.onUpdate = onUpdate;
  }

  public getActiveRun(): TestRunRecord | null {
    return this.activeRun;
  }

  public stopActiveRun(reason = 'Người dùng chủ động dừng bài kiểm thử'): TestRunRecord | null {
    if (!this.activeRun || this.activeRun.status !== 'running') {
      return this.activeRun;
    }
    this.cleanupWorkers();
    this.activeRun.status = 'completed';
    this.activeRun.finishedAt = new Date().toISOString();
    this.activeRun.evaluation = this.evaluateRun(this.activeRun, reason);
    storageRepo.saveTestRun(this.activeRun);
    this.onUpdate(this.activeRun);
    return this.activeRun;
  }

  private cleanupWorkers(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const ws of this.activeSockets) {
      try {
        ws.terminate();
      } catch {}
    }
    this.activeSockets.clear();
  }

  /**
   * Starts a 100% REAL test run against the target URL & K8s cluster.
   */
  public async startScenarioRun(
    cluster: ClusterConnection,
    scenario: TestScenario
  ): Promise<TestRunRecord> {
    this.cleanupWorkers();

    const fullTargetUrl = `${scenario.targetBaseUrl.replace(/\/+$/, '')}/${scenario.targetPath.replace(/^\/+/, '')}`;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Discover initial K8s workload limits & security findings
    const initialSnapshot = await k8sDiscoveryService.discoverNamespaceTopology(
      cluster,
      scenario.targetNamespace
    );
    const matchedWorkload =
      initialSnapshot.workloads.find((w) => w.name === scenario.targetWorkload) ||
      initialSnapshot.workloads[0];

    const memoryLimitMi = matchedWorkload?.memoryLimitMi ?? null;
    const thresholdMemoryMi =
      memoryLimitMi !== null
        ? Math.round((memoryLimitMi * scenario.safetyAbortMemoryPercent) / 100)
        : null;

    // Perform real Security & K8s Manifest Audit findings
    const securityFindings = await this.executeRealSecurityAudit(
      fullTargetUrl,
      scenario,
      initialSnapshot
    );

    const initialInternal = await this.pollRealK8sPodTelemetry(
      cluster,
      scenario.targetNamespace,
      matchedWorkload?.name,
      memoryLimitMi
    );

    const initialTick: LiveRunTick = {
      elapsedSeconds: 0,
      timestamp: new Date().toISOString(),
      external: {
        activeWorkers: 0,
        requestsPerSec: 0,
        totalRequests: 0,
        latencyAvgMs: 0,
        latencyP50Ms: 0,
        latencyP95Ms: 0,
        latencyP99Ms: 0,
        status2xx: 0,
        status401_403: 0,
        status429: 0,
        status5xx: 0,
        networkErrors: 0,
      },
      internal: initialInternal,
    };

    const runRecord: TestRunRecord = {
      id: `run-${crypto.randomUUID().slice(0, 8)}`,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      clusterId: cluster.id,
      clusterName: cluster.name,
      namespace: scenario.targetNamespace,
      targetWorkload: matchedWorkload?.name || scenario.targetWorkload,
      protocol: scenario.protocol,
      targetUrl: fullTargetUrl,
      status: 'running',
      startedAt: new Date().toISOString(),
      virtualUsers: scenario.virtualUsers,
      durationSeconds: scenario.durationSeconds,
      safetyBreaker: {
        armed: true,
        thresholdPercent: scenario.safetyAbortMemoryPercent,
        thresholdMemoryMi,
        tripped: false,
      },
      latestTick: initialTick,
      ticks: [initialTick],
      securityFindings,
      evaluation: {
        grade: 'A',
        headlineVi: `Đang thực thi kịch bản thật trên ${fullTargetUrl}...`,
        nonTechSummaryVi: 'Đang thu thập số liệu phản hồi thực tế từ máy chủ và K8s API.',
        engineerSummary: `Running ${scenario.protocol} workers against ${fullTargetUrl} (VU=${scenario.virtualUsers}, Duration=${scenario.durationSeconds}s)`,
        recommendationsVi: [],
      },
    };

    this.activeRun = runRecord;
    storageRepo.saveTestRun(runRecord);
    this.onUpdate(runRecord);

    // Per-second sliding window accumulators
    let windowLatencies: number[] = [];
    let window2xx = 0;
    let window401_403 = 0;
    let window429 = 0;
    let window5xx = 0;
    let windowNetErr = 0;
    let totalRequestsCount = 0;
    let activeWorkersCount = 0;

    const maxVu = Math.max(1, Math.min(500, scenario.virtualUsers));
    const rampSec = Math.max(1, scenario.rampUpSeconds || 1);

    // Spawn worker loops based on protocol
    if (scenario.protocol === 'HTTP' || scenario.protocol === 'SECURITY_AUDIT') {
      for (let i = 0; i < maxVu; i++) {
        const startDelayMs = Math.round((i / maxVu) * rampSec * 1000);
        this.runHttpWorkerLoop(
          i,
          startDelayMs,
          fullTargetUrl,
          scenario,
          signal,
          () => {
            activeWorkersCount++;
          },
          () => {
            activeWorkersCount = Math.max(0, activeWorkersCount - 1);
          },
          (latMs, statusCode, isNetErr) => {
            totalRequestsCount++;
            windowLatencies.push(latMs);
            if (isNetErr) {
              windowNetErr++;
            } else if (statusCode >= 200 && statusCode < 400) {
              window2xx++;
            } else if (statusCode === 401 || statusCode === 403) {
              window401_403++;
            } else if (statusCode === 429) {
              window429++;
            } else if (statusCode >= 500) {
              window5xx++;
            }
          }
        );
      }
    } else if (scenario.protocol === 'WEBSOCKET') {
      const wsUrl = fullTargetUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      for (let i = 0; i < maxVu; i++) {
        const startDelayMs = Math.round((i / maxVu) * rampSec * 1000);
        this.runWebSocketWorkerLoop(
          startDelayMs,
          wsUrl,
          scenario,
          signal,
          () => {
            activeWorkersCount++;
          },
          () => {
            activeWorkersCount = Math.max(0, activeWorkersCount - 1);
          },
          (latMs, statusBucket) => {
            totalRequestsCount++;
            windowLatencies.push(latMs);
            if (statusBucket === '2xx') window2xx++;
            else if (statusBucket === '401_403') window401_403++;
            else if (statusBucket === '429') window429++;
            else windowNetErr++;
          }
        );
      }
    }

    // 1-second correlation & safety breaker loop
    let elapsed = 0;
    const baselineRestarts = initialInternal.restartCount;

    this.tickInterval = setInterval(async () => {
      if (!this.activeRun || signal.aborted) return;
      elapsed += 1;

      // Snapshot and reset 1s window
      const sortedLat = [...windowLatencies].sort((a, b) => a - b);
      const rps =
        window2xx + window401_403 + window429 + window5xx + windowNetErr;
      const avgLat =
        sortedLat.length > 0
          ? Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length)
          : 0;

      const extMetrics: LiveRunTick['external'] = {
        activeWorkers: activeWorkersCount,
        requestsPerSec: rps,
        totalRequests: totalRequestsCount,
        latencyAvgMs: avgLat,
        latencyP50Ms: computePercentile(sortedLat, 50),
        latencyP95Ms: computePercentile(sortedLat, 95),
        latencyP99Ms: computePercentile(sortedLat, 99),
        status2xx: window2xx,
        status401_403: window401_403,
        status429: window429,
        status5xx: window5xx,
        networkErrors: windowNetErr,
      };

      windowLatencies = [];
      window2xx = 0;
      window401_403 = 0;
      window429 = 0;
      window5xx = 0;
      windowNetErr = 0;

      // Poll REAL K8s Pod telemetry
      const internalMetrics = await this.pollRealK8sPodTelemetry(
        cluster,
        scenario.targetNamespace,
        matchedWorkload?.name || scenario.targetWorkload,
        memoryLimitMi
      );

      const tick: LiveRunTick = {
        elapsedSeconds: elapsed,
        timestamp: new Date().toISOString(),
        external: extMetrics,
        internal: internalMetrics,
      };

      this.activeRun.latestTick = tick;
      this.activeRun.ticks.push(tick);

      // Check Safety Circuit Breaker on REAL K8s Memory or Pod Restart
      const memExceeded =
        thresholdMemoryMi !== null &&
        internalMetrics.totalMemoryMi !== null &&
        internalMetrics.totalMemoryMi >= thresholdMemoryMi;

      const podRestarted = internalMetrics.restartCount > baselineRestarts;

      if (this.activeRun.safetyBreaker.armed && (memExceeded || podRestarted)) {
        this.cleanupWorkers();
        this.activeRun.status = 'aborted-by-safety';
        this.activeRun.finishedAt = new Date().toISOString();
        this.activeRun.safetyBreaker.tripped = true;
        this.activeRun.safetyBreaker.trippedReasonVi = memExceeded
          ? `Cầu chì An toàn đã tự động ngắt bài test khi bộ nhớ thực tế của Pod (${internalMetrics.totalMemoryMi} MiB) chạm ngưỡng bảo vệ ${scenario.safetyAbortMemoryPercent}% (${thresholdMemoryMi} MiB / ${memoryLimitMi} MiB).`
          : `Cầu chì An toàn đã tự động ngắt bài test do phát hiện Pod khởi động lại (RestartCount tăng từ ${baselineRestarts} lên ${internalMetrics.restartCount}).`;
        this.activeRun.safetyBreaker.trippedTechnical = `SAFETY_BREAKER_TRIPPED: mem=${internalMetrics.totalMemoryMi}MiB (threshold=${thresholdMemoryMi}MiB), restarts=${internalMetrics.restartCount}`;
        this.activeRun.evaluation = this.evaluateRun(this.activeRun);
        storageRepo.saveTestRun(this.activeRun);
        this.onUpdate(this.activeRun);
        return;
      }

      if (elapsed >= scenario.durationSeconds) {
        this.cleanupWorkers();
        this.activeRun.status = 'completed';
        this.activeRun.finishedAt = new Date().toISOString();
      }

      this.activeRun.evaluation = this.evaluateRun(this.activeRun);
      storageRepo.saveTestRun(this.activeRun);
      this.onUpdate(this.activeRun);
    }, 1000);

    return runRecord;
  }

  private async runHttpWorkerLoop(
    _workerIdx: number,
    startDelayMs: number,
    url: string,
    scenario: TestScenario,
    signal: AbortSignal,
    onWorkerActive: () => void,
    onWorkerStop: () => void,
    onSample: (latMs: number, statusCode: number, isNetErr: boolean) => void
  ): Promise<void> {
    if (startDelayMs > 0) {
      await new Promise((r) => setTimeout(r, startDelayMs));
    }
    if (signal.aborted) return;

    onWorkerActive();
    try {
      while (!signal.aborted) {
        const t0 = performance.now();
        try {
          const reqInit: RequestInit = {
            method: scenario.method || 'GET',
            headers: scenario.headers || {},
            signal,
          };
          if (
            scenario.requestBody &&
            (scenario.method === 'POST' || scenario.method === 'PUT')
          ) {
            reqInit.body = scenario.requestBody;
          }
          const res = await fetch(url, reqInit);
          // Consume body to free socket
          await res.arrayBuffer().catch(() => {});
          const elapsedMs = Math.round(performance.now() - t0);
          onSample(elapsedMs, res.status, false);
        } catch (err: any) {
          if (signal.aborted) break;
          const elapsedMs = Math.round(performance.now() - t0);
          onSample(elapsedMs, 0, true);
        }
        // Small pacing pause (50ms) so 1 VU ~ up to 20 req/s depending on RTT
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      onWorkerStop();
    }
  }

  private async runWebSocketWorkerLoop(
    startDelayMs: number,
    wsUrl: string,
    scenario: TestScenario,
    signal: AbortSignal,
    onWorkerActive: () => void,
    onWorkerStop: () => void,
    onSample: (latMs: number, bucket: '2xx' | '401_403' | '429' | 'err') => void
  ): Promise<void> {
    if (startDelayMs > 0) {
      await new Promise((r) => setTimeout(r, startDelayMs));
    }
    if (signal.aborted) return;

    onWorkerActive();
    try {
      while (!signal.aborted) {
        const t0 = performance.now();
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };

          try {
            const ws = new WebSocket(wsUrl, {
              headers: scenario.headers || {},
              handshakeTimeout: 4000,
              rejectUnauthorized: false,
            });
            this.activeSockets.add(ws);

            ws.on('open', () => {
              const handshakeMs = Math.round(performance.now() - t0);
              onSample(handshakeMs, '2xx');
              // Send periodic ping frames while open
              const pingTimer = setInterval(() => {
                if (signal.aborted || ws.readyState !== WebSocket.OPEN) {
                  clearInterval(pingTimer);
                  return;
                }
                const p0 = performance.now();
                ws.ping( undefined, undefined, () => {
                  onSample(Math.round(performance.now() - p0), '2xx');
                });
              }, 1000);
            });

            ws.on('unexpected-response', (_req, res) => {
              const ms = Math.round(performance.now() - t0);
              const code = res.statusCode || 0;
              if (code === 401 || code === 403) onSample(ms, '401_403');
              else if (code === 429) onSample(ms, '429');
              else onSample(ms, 'err');
              ws.terminate();
              finish();
            });

            ws.on('close', (code) => {
              this.activeSockets.delete(ws);
              if (code === 1008) {
                onSample(Math.round(performance.now() - t0), '401_403');
              } else if (code === 1013 || code === 1009) {
                onSample(Math.round(performance.now() - t0), '429');
              }
              finish();
            });

            ws.on('error', () => {
              this.activeSockets.delete(ws);
              onSample(Math.round(performance.now() - t0), 'err');
              finish();
            });
          } catch {
            onSample(Math.round(performance.now() - t0), 'err');
            finish();
          }
        });

        if (!signal.aborted) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } finally {
      onWorkerStop();
    }
  }

  /**
   * Polls 100% REAL Pod CPU/Memory, Events, and Logs from the Kubernetes cluster.
   * Never invents fake numbers if metrics-server or K8s API is unreachable.
   */
  private async pollRealK8sPodTelemetry(
    cluster: ClusterConnection,
    namespace: string,
    targetWorkload: string | undefined,
    memoryLimitMi: number | null
  ): Promise<LiveRunTick['internal']> {
    if (cluster.connectionType === 'external-url') {
      return {
        metricsAvailable: false,
        podCount: 0,
        primaryPodName: 'Chế độ External URL (Không kết nối K8s)',
        podPhase: 'External',
        totalCpuMillicores: null,
        totalMemoryMi: null,
        memoryLimitMi: null,
        memoryUsagePercent: null,
        restartCount: 0,
        recentEvent: 'Đang chạy ở chế độ Black-box External URL',
        recentLogLine: 'Không có quyền đọc Pod Log ở chế độ External URL',
      };
    }

    try {
      const kc = storageRepo.loadKubeConfigInMemory(cluster);
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);
      const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

      const podRes = await coreApi.listNamespacedPod(namespace);
      const allPods = podRes.body.items || [];
      const matchedPods = targetWorkload
        ? allPods.filter((p) => p.metadata?.name?.startsWith(targetWorkload))
        : allPods;
      const podsToInspect = matchedPods.length > 0 ? matchedPods : allPods;

      if (podsToInspect.length === 0) {
        return {
          metricsAvailable: false,
          podCount: 0,
          primaryPodName: 'Không tìm thấy Pod trong namespace',
          podPhase: 'None',
          totalCpuMillicores: null,
          totalMemoryMi: null,
          memoryLimitMi,
          memoryUsagePercent: null,
          restartCount: 0,
          recentEvent: `Không có Pod nào trong namespace ${namespace}`,
          recentLogLine: '',
        };
      }

      const primaryPod = podsToInspect[0];
      const primaryPodName = primaryPod.metadata?.name || 'pod';
      const podPhase = primaryPod.status?.phase || 'Running';
      const restartCount = podsToInspect.reduce((acc, p) => {
        const cs = p.status?.containerStatuses || [];
        return acc + cs.reduce((s, c) => s + (c.restartCount || 0), 0);
      }, 0);

      let totalCpuMillicores: number | null = null;
      let totalMemoryMi: number | null = null;
      let metricsAvailable = false;

      try {
        const metricsObj: any = await customApi.listNamespacedCustomObject(
          'metrics.k8s.io',
          'v1beta1',
          namespace,
          'pods'
        );
        const items: any[] = metricsObj?.body?.items || [];
        const targetPodNames = new Set(podsToInspect.map((p) => p.metadata?.name));
        let cpuSum = 0;
        let memSum = 0;
        let matchedCount = 0;

        for (const item of items) {
          if (targetPodNames.has(item.metadata?.name)) {
            matchedCount++;
            for (const c of item.containers || []) {
              cpuSum += parseK8sCpuToMillicores(c.usage?.cpu) || 0;
              memSum += parseK8sMemoryToMi(c.usage?.memory) || 0;
            }
          }
        }

        if (matchedCount > 0) {
          metricsAvailable = true;
          totalCpuMillicores = cpuSum;
          totalMemoryMi = memSum;
        }
      } catch {
        metricsAvailable = false;
      }

      let recentEvent = `Pod ${primaryPodName} (${podPhase})`;
      try {
        const evRes = await coreApi.listNamespacedEvent(namespace);
        const evItems = evRes.body.items || [];
        if (evItems.length > 0) {
          const lastEv = evItems[evItems.length - 1];
          recentEvent = `[${lastEv.type || 'Normal'}] ${lastEv.reason}: ${lastEv.message || ''}`;
        }
      } catch {}

      let recentLogLine = '';
      try {
        const logRes = await coreApi.readNamespacedPodLog(
          primaryPodName,
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          1
        );
        if (logRes.body) {
          recentLogLine = logRes.body.trim();
        }
      } catch {}

      const memoryUsagePercent =
        totalMemoryMi !== null && memoryLimitMi !== null && memoryLimitMi > 0
          ? Math.round((totalMemoryMi / memoryLimitMi) * 100)
          : null;

      return {
        metricsAvailable,
        podCount: podsToInspect.length,
        primaryPodName,
        podPhase,
        totalCpuMillicores,
        totalMemoryMi,
        memoryLimitMi,
        memoryUsagePercent,
        restartCount,
        recentEvent,
        recentLogLine,
      };
    } catch (err) {
      return {
        metricsAvailable: false,
        podCount: 0,
        primaryPodName: 'Lỗi đọc K8s API',
        podPhase: 'Unknown',
        totalCpuMillicores: null,
        totalMemoryMi: null,
        memoryLimitMi,
        memoryUsagePercent: null,
        restartCount: 0,
        recentEvent: err instanceof Error ? err.message : 'K8s API Error',
        recentLogLine: '',
      };
    }
  }

  /**
   * Executes REAL Security Probes against the target URL and audits REAL K8s manifests.
   */
  private async executeRealSecurityAudit(
    targetUrl: string,
    scenario: TestScenario,
    snapshot: NamespaceTopologySnapshot
  ): Promise<SecurityAuditFinding[]> {
    const findings: SecurityAuditFinding[] = [];

    // 1. Real HTTP Security Headers & TLS Probe
    try {
      const httpProbeUrl = targetUrl
        .replace(/^wss:/i, 'https:')
        .replace(/^ws:/i, 'http:');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(httpProbeUrl, {
        method: 'GET',
        headers: {
          Origin: 'https://unauthorized-origin-check.example.com',
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);

      const hsts = res.headers.get('strict-transport-security');
      const xfo = res.headers.get('x-frame-options');
      const xcto = res.headers.get('x-content-type-options');
      const acao = res.headers.get('access-control-allow-origin');
      const serverHeader = res.headers.get('server') || 'Hidden';

      const hasSecurityHeaders = Boolean(hsts || xfo || xcto);
      findings.push({
        id: 'audit-headers',
        category: 'EDGE_TLS_HEADERS',
        titleVi: 'Kiểm tra Security Headers thực tế từ Phản hồi HTTP',
        technicalCheck: `GET ${httpProbeUrl} -> Inspect HSTS, X-Frame-Options, X-Content-Type-Options`,
        observedResult: `HTTP ${res.status} | Server: ${serverHeader} | HSTS: ${hsts ? 'Có' : 'Thiếu'} | XFO: ${xfo || 'Thiếu'} | XCTO: ${xcto || 'Thiếu'}`,
        status: hasSecurityHeaders ? 'PASS' : 'WARN',
        nonTechExplanationVi: hasSecurityHeaders
          ? 'Máy chủ đã bật các nhãn bảo vệ trình duyệt chống nhúng trang giả mạo.'
          : 'Phản hồi HTTP hiện chưa đính kèm đầy đủ các nhãn chống nhúng iframe (X-Frame-Options) hoặc HSTS.',
        remediationVi:
          'Bổ sung Middleware Security Headers trên Traefik/Ingress (customResponseHeaders: X-Frame-Options=DENY, X-Content-Type-Options=nosniff).',
      });

      const corsWildcard = acao === '*' || acao === 'https://unauthorized-origin-check.example.com';
      findings.push({
        id: 'audit-cors',
        category: 'CORS_ORIGIN',
        titleVi: 'Kiểm tra Chính sách Tên miền Chéo (CORS Origin)',
        technicalCheck: `Send Origin: https://unauthorized-origin-check.example.com`,
        observedResult: `Access-Control-Allow-Origin: ${acao || 'Không mở (An toàn)'}`,
        status: corsWildcard ? 'WARN' : 'PASS',
        nonTechExplanationVi: corsWildcard
          ? 'API đang cho phép mọi tên miền bên ngoài gọi vào (CORS *). Cần lưu ý nếu API có chứa dữ liệu nhạy cảm.'
          : 'API kiểm soát chặt tên miền gọi vào, không cho phép trang web lạ mạo danh.',
        remediationVi: 'Giới hạn danh sách Access-Control-Allow-Origin chỉ cho phép đúng domain chính thức.',
      });
    } catch (err) {
      findings.push({
        id: 'audit-headers-err',
        category: 'EDGE_TLS_HEADERS',
        titleVi: 'Kiểm tra Kết nối HTTPS tới Điểm vào (Endpoint)',
        technicalCheck: `GET ${targetUrl}`,
        observedResult: err instanceof Error ? err.message : 'Connection failed',
        status: 'FAIL',
        nonTechExplanationVi: 'Không thể kết nối tới địa chỉ đích để kiểm tra tiêu đề bảo mật.',
        remediationVi: 'Kiểm tra lại địa chỉ URL hoặc cấu hình DNS / Ingress.',
      });
    }

    // 2. Real K8s NetworkPolicy Audit (if K8s is connected)
    if (snapshot.k8sConnected) {
      const netpolCount = snapshot.networkPolicies.length;
      const policyNames = snapshot.networkPolicies.map((n) => n.name).join(', ');
      findings.push({
        id: 'audit-k8s-netpol',
        category: 'K8S_NETPOL',
        titleVi: `Kiểm toán Tường lửa Nội bộ K8s (NetworkPolicy trong ${scenario.targetNamespace})`,
        technicalCheck: `K8s API: listNamespacedNetworkPolicy('${scenario.targetNamespace}')`,
        observedResult:
          netpolCount > 0
            ? `Phát hiện ${netpolCount} NetworkPolicy đang bật (${policyNames})`
            : `0 NetworkPolicy trong namespace '${scenario.targetNamespace}'`,
        status: netpolCount > 0 ? 'PASS' : 'WARN',
        nonTechExplanationVi:
          netpolCount > 0
            ? `Cụm máy chủ đã thiết lập ${netpolCount} lớp tường lửa nội bộ để cô lập và bảo vệ ứng dụng.`
            : 'Namespace này hiện chưa có NetworkPolicy; các Pod từ namespace khác có thể kết nối trực tiếp.',
        remediationVi:
          'Áp dụng NetworkPolicy default-deny-all và chỉ mở cổng cho phép Ingress Controller (Traefik) đi vào.',
      });

      // 3. Real Workload SecurityContext & Resource Limit Audit
      const wl =
        snapshot.workloads.find((w) => w.name === scenario.targetWorkload) ||
        snapshot.workloads[0];
      if (wl) {
        const hasLimits = wl.memoryLimitMi !== null && wl.cpuLimitMillicores !== null;
        const hardened = wl.securityContext.runAsNonRoot;
        findings.push({
          id: 'audit-k8s-podsec',
          category: 'K8S_POD_SECURITY',
          titleVi: `Kiểm toán Cấu hình Bảo vệ Pod (${wl.name})`,
          technicalCheck: `Check resources.limits & securityContext on ${wl.kind}/${wl.name}`,
          observedResult: `Memory Limit: ${wl.memoryLimitMi ? `${wl.memoryLimitMi}Mi` : 'Chưa đặt'} | CPU Limit: ${wl.cpuLimitMillicores ? `${wl.cpuLimitMillicores}m` : 'Chưa đặt'} | runAsNonRoot: ${wl.securityContext.runAsNonRoot} | readOnlyRootFS: ${wl.securityContext.readOnlyRootFilesystem}`,
          status: hasLimits && hardened ? 'PASS' : hasLimits ? 'WARN' : 'FAIL',
          nonTechExplanationVi:
            hasLimits && hardened
              ? `Máy chủ ứng dụng (${wl.name}) đã khóa quyền Root và có giới hạn bộ nhớ rõ ràng (${wl.memoryLimitMi}MB).`
              : `Cấu hình Pod ${wl.name} cần bổ sung thêm giới hạn tài nguyên hoặc bật chế độ chạy quyền tối thiểu (runAsNonRoot).`,
          remediationVi:
            'Thiết lập securityContext.runAsNonRoot: true, readOnlyRootFilesystem: true và resources.limits trong Deployment YAML.',
        });
      }
    }

    return findings;
  }

  private evaluateRun(run: TestRunRecord, customStopNote?: string): TestRunRecord['evaluation'] {
    const ticks = run.ticks.filter((t) => t.elapsedSeconds > 0);
    const totalReq = ticks.reduce((s, t) => s + t.external.requestsPerSec, 0);
    const total2xx = ticks.reduce((s, t) => s + t.external.status2xx, 0);
    const total429 = ticks.reduce((s, t) => s + t.external.status429, 0);
    const total5xx = ticks.reduce((s, t) => s + t.external.status5xx + t.external.networkErrors, 0);
    const maxP95 = ticks.reduce((m, t) => Math.max(m, t.external.latencyP95Ms), 0);
    const maxMemPct = ticks.reduce(
      (m, t) => Math.max(m, t.internal.memoryUsagePercent || 0),
      0
    );

    const recs: string[] = [];
    let grade: TestRunRecord['evaluation']['grade'] = 'A+';

    if (run.safetyBreaker.tripped) {
      grade = 'C';
      recs.push(
        `Bộ nhớ thực tế của Pod đã chạm ngưỡng bảo vệ ${run.safetyBreaker.thresholdPercent}% (${run.safetyBreaker.thresholdMemoryMi} MiB). Khuyến nghị nâng resources.limits.memory hoặc tăng số lượng replicas.`
      );
    } else if (total5xx > totalReq * 0.05 && totalReq > 0) {
      grade = 'D';
      recs.push(
        `Phát hiện ${total5xx} lỗi kết nối / HTTP 5xx trên tổng số ${totalReq} yêu cầu. Kiểm tra lại đường truyền tới ${run.targetUrl} hoặc sức khỏe Pod.`
      );
    } else if (maxP95 > 1000) {
      grade = 'B';
      recs.push(
        `Độ trễ thực tế p95 đạt đỉnh ${maxP95}ms (> 1 giây). Khuyến nghị kiểm tra cấu hình CPU/Memory hoặc tối ưu truy vấn.`
      );
    }

    if (total429 > 0) {
      recs.push(
        `Hệ thống đã chủ động cắt ${total429} yêu cầu vượt ngưỡng bằng mã HTTP 429 (Rate-Limit hoạt động đúng thiết kế).`
      );
    }

    for (const f of run.securityFindings) {
      if (f.status !== 'PASS') {
        recs.push(`[Bảo mật - ${f.titleVi}]: ${f.remediationVi}`);
        if (grade === 'A+') grade = 'A';
      }
    }

    if (recs.length === 0) {
      recs.push(
        'Hệ thống vận hành ổn định, độ trễ thấp và đáp ứng tốt mức tải hiện tại.'
      );
    }

    const lastMemStr =
      run.latestTick.internal.totalMemoryMi !== null
        ? `${run.latestTick.internal.totalMemoryMi} MiB${
            run.latestTick.internal.memoryLimitMi
              ? ` / ${run.latestTick.internal.memoryLimitMi} MiB (${maxMemPct}%)`
              : ''
          }`
        : 'Chưa có số liệu từ K8s Metrics Server';

    return {
      grade,
      headlineVi: run.safetyBreaker.tripped
        ? `⚡ Đã ngắt an toàn bởi Cầu chì Tự động khi RAM chạm ${run.latestTick.internal.totalMemoryMi} MiB`
        : customStopNote ||
          `Hoàn tất kiểm thử thật trên ${run.targetUrl}: Tổng ${totalReq} yêu cầu, Độ trễ p95 cao nhất ${maxP95}ms, RAM Pod ${lastMemStr}`,
      nonTechSummaryVi: `Trong phiên kiểm thử thực tế với ${run.virtualUsers} người dùng đồng thời vào ${run.targetUrl}, máy chủ đã xử lý thành công ${total2xx}/${totalReq} yêu cầu (chặn quá tải 429: ${total429}, lỗi: ${total5xx}). Độ trễ phản hồi thực tế (p95) là ${maxP95}ms và mức tiêu thụ RAM của máy chủ trên K8s là ${lastMemStr}.`,
      engineerSummary: `Target=${run.targetUrl} | TotalReq=${totalReq} (2xx=${total2xx}, 429=${total429}, 5xx/Err=${total5xx}) | Max_p95=${maxP95}ms | Pod_RAM=${lastMemStr}`,
      recommendationsVi: recs,
    };
  }
}
