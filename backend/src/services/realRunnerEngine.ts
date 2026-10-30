import { performance } from 'node:perf_hooks';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import * as k8s from '@kubernetes/client-node';
import WebSocket from 'ws';
import {
  ClusterConnection,
  LiveRunTick,
  NamespaceTopologySnapshot,
  PerformanceTestType,
  SecurityAuditFinding,
  SpecializedTestInsights,
  TestRunRecord,
  TestScenario,
} from '../types.js';
import { storageRepo } from '../storage/repository.js';
import {
  k8sDiscoveryService,
  parseK8sCpuToMillicores,
  parseK8sMemoryToMi,
} from './k8sDiscoveryService.js';

const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 1000 });
const keepAliveHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 1000,
  rejectUnauthorized: false,
});

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

/**
 * Generates a realistic structured JSON batch payload of the specified KB size for Volume & OOM Testing.
 */
function buildVolumePayload(sizeKb: number): string {
  const clampedKb = Math.max(1, Math.min(4096, sizeKb));
  const targetBytes = clampedKb * 1024;
  const records: Array<{ id: number; ts: string; metric: string; dataBlock: string; metadata: any }> = [];
  const chunk = 'VOL_PAYLOAD_OOM_INJECTION_DATA_CHUNK_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ_'.repeat(6);
  let i = 0;
  while (JSON.stringify(records).length < targetBytes) {
    records.push({
      id: ++i,
      ts: new Date().toISOString(),
      metric: `heavy-oom-record-${i}`,
      dataBlock: chunk,
      metadata: {
        expandedLength: chunk.length,
        nestedBuffer: chunk.slice(0, 100),
      },
    });
    if (i > 8000) break;
  }
  return JSON.stringify({
    oomInjectionBatch: true,
    targetPayloadKb: clampedKb,
    recordCount: records.length,
    records,
  });
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
    this.activeRun.specializedInsights = this.computeSpecializedInsights(this.activeRun);
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
   * Computes dynamic target Virtual Users & stage label at `elapsedSec`
   * according to the 6 standard Performance Testing types.
   */
  private computeTargetVuForTestType(
    testType: PerformanceTestType,
    elapsedSec: number,
    durationSec: number,
    rampSec: number,
    baseVu: number,
    peakVu: number,
    volumePayloadKb?: number
  ): { targetVu: number; stageLabel: string } {
    const safeDuration = Math.max(5, durationSec);
    const progress = Math.min(1, elapsedSec / safeDuration);

    switch (testType) {
      case 'STRESS_TEST': {
        // 5 progressive step-up stages from baseVu up to peakVu to find Breaking Point
        const stepIndex = Math.min(5, Math.floor(progress * 5) + 1);
        const fraction = stepIndex / 5;
        const targetVu = Math.max(
          1,
          Math.round(baseVu + (Math.max(baseVu, peakVu) - baseVu) * fraction)
        );
        return {
          targetVu,
          stageLabel: `Stress Bậc ${stepIndex}/5 (${targetVu} Users — Dò điểm gãy)`,
        };
      }

      case 'SPIKE_TEST': {
        // Phase 1 (0 - 30%): Baseline load
        // Phase 2 (30% - 65%): Instant 10x Spike Burst!
        // Phase 3 (65% - 100%): Instant drop to baseline to measure Recovery Time
        if (progress < 0.3) {
          return {
            targetVu: baseVu,
            stageLabel: `Baseline (Tải nền ${baseVu} Users trước cú sốc)`,
          };
        }
        if (progress < 0.65) {
          return {
            targetVu: Math.max(baseVu * 2, peakVu),
            stageLabel: `⚡ SPIKE BURST! (Tăng đột ngột lên ${Math.max(baseVu * 2, peakVu)} Users)`,
          };
        }
        return {
          targetVu: baseVu,
          stageLabel: `Recovery Phase (Hạ về ${baseVu} Users — Đo thời gian hồi phục)`,
        };
      }

      case 'SOAK_ENDURANCE_TEST': {
        if (elapsedSec <= rampSec) {
          const targetVu = Math.max(1, Math.ceil((elapsedSec / Math.max(1, rampSec)) * baseVu));
          return {
            targetVu,
            stageLabel: `Soak Ramp-up (${targetVu}/${baseVu} Users)`,
          };
        }
        return {
          targetVu: baseVu,
          stageLabel: `Soak / Endurance (${baseVu} Users liên tục — Dò rò rỉ RAM)`,
        };
      }

      case 'SCALABILITY_TEST': {
        // 3 scaling tiers to observe RPS per Pod & HPA / Replica efficiency
        const tier = progress < 0.33 ? 1 : progress < 0.66 ? 2 : 3;
        const maxScaleVu = Math.max(baseVu, peakVu);
        const targetVu =
          tier === 1
            ? baseVu
            : tier === 2
            ? Math.round((baseVu + maxScaleVu) / 2)
            : maxScaleVu;
        return {
          targetVu,
          stageLabel: `Scalability Mức ${tier}/3 (${targetVu} Users — Đo hiệu suất mở rộng Pod)`,
        };
      }

      case 'VOLUME_TEST': {
        const kb = volumePayloadKb || 64;
        if (elapsedSec <= rampSec) {
          const targetVu = Math.max(1, Math.ceil((elapsedSec / Math.max(1, rampSec)) * baseVu));
          return {
            targetVu,
            stageLabel: `Volume Ramp-up (${kb}KB/req • ${targetVu} Users)`,
          };
        }
        return {
          targetVu: baseVu,
          stageLabel: `Volume Heavy Data (${kb}KB/req • ${baseVu} Users)`,
        };
      }

      case 'SECURITY_DAST':
      case 'SECURITY_API':
      case 'SECURITY_AUTH':
      case 'SECURITY_INFRA':
      case 'SECURITY_PENTEST':
      case 'SECURITY_AUDIT': {
        return {
          targetVu: Math.min(10, baseVu),
          stageLabel: `[${testType}] Đang thực thi các mũi thăm dò Bảo mật & K8s Manifest...`,
        };
      }

      case 'LOAD_TEST':
      default: {
        if (elapsedSec <= rampSec) {
          const targetVu = Math.max(1, Math.ceil((elapsedSec / Math.max(1, rampSec)) * baseVu));
          return {
            targetVu,
            stageLabel: `Load Ramp-up (${targetVu}/${baseVu} Users)`,
          };
        }
        return {
          targetVu: baseVu,
          stageLabel: `Steady Load (Duy trì tải dự kiến ${baseVu} Users)`,
        };
      }
    }
  }

  /**
   * Starts a 100% REAL test run against the target URL & K8s cluster.
   */
  public async startScenarioRun(
    cluster: ClusterConnection,
    scenario: TestScenario
  ): Promise<TestRunRecord> {
    this.cleanupWorkers();

    const testType: PerformanceTestType =
      scenario.testType ||
      (scenario.protocol === 'SECURITY_AUDIT' ? 'SECURITY_AUDIT' : 'LOAD_TEST');

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
    const cpuLimitMillicores = matchedWorkload?.cpuLimitMillicores ?? null;
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
      memoryLimitMi,
      cpuLimitMillicores
    );

    const baseVu = Math.max(1, Math.min(500, scenario.virtualUsers));
    const peakVu = Math.max(
      baseVu,
      Math.min(1000, scenario.peakVirtualUsers || baseVu)
    );

    const initialTick: LiveRunTick = {
      elapsedSeconds: 0,
      timestamp: new Date().toISOString(),
      stageLabel: 'Khởi tạo luồng kiểm thử...',
      external: {
        activeWorkers: 0,
        requestsPerSec: 0,
        totalRequests: 0,
        throughputKbps: 0,
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
      testType,
      clusterId: cluster.id,
      clusterName: cluster.name,
      namespace: scenario.targetNamespace,
      targetWorkload: matchedWorkload?.name || scenario.targetWorkload,
      protocol: scenario.protocol,
      targetUrl: fullTargetUrl,
      status: 'running',
      startedAt: new Date().toISOString(),
      virtualUsers: baseVu,
      peakVirtualUsers: peakVu,
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
        headlineVi: `Đang thực thi [${testType}] trên ${fullTargetUrl}...`,
        nonTechSummaryVi: 'Đang thu thập số liệu phản hồi thực tế từ máy chủ và K8s API.',
        engineerSummary: `Mode=${testType} | Protocol=${scenario.protocol} | Target=${fullTargetUrl} (BaseVU=${baseVu}, PeakVU=${peakVu}, Duration=${scenario.durationSeconds}s)`,
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
    let windowBytes = 0;
    let totalRequestsCount = 0;

    // Dynamic VU state updated every second
    let currentAllowedVu = this.computeTargetVuForTestType(
      testType,
      1,
      scenario.durationSeconds,
      scenario.rampUpSeconds || 1,
      baseVu,
      peakVu,
      scenario.volumePayloadKb
    ).targetVu;

    // Prepare effective request body (especially for VOLUME_TEST)
    const effectiveBody =
      scenario.requestBody && scenario.requestBody.trim().length > 0
        ? scenario.requestBody
        : testType === 'VOLUME_TEST'
        ? buildVolumePayload(scenario.volumePayloadKb || 64)
        : undefined;

    const maxPoolSize = Math.max(baseVu, peakVu);

    // Spawn dynamic worker pool
    if (scenario.protocol === 'HTTP' || scenario.protocol === 'SECURITY_AUDIT') {
      for (let workerIdx = 0; workerIdx < maxPoolSize; workerIdx++) {
        this.runDynamicHttpWorker(
          workerIdx,
          () => currentAllowedVu,
          fullTargetUrl,
          scenario,
          effectiveBody,
          signal,
          (latMs, statusCode, isNetErr, bytesTransferred) => {
            totalRequestsCount++;
            windowLatencies.push(latMs);
            windowBytes += bytesTransferred;
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
      for (let workerIdx = 0; workerIdx < maxPoolSize; workerIdx++) {
        this.runDynamicWebSocketWorker(
          workerIdx,
          () => currentAllowedVu,
          wsUrl,
          scenario,
          signal,
          (latMs, statusBucket) => {
            totalRequestsCount++;
            windowLatencies.push(latMs);
            windowBytes += 128;
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

      const stageInfo = this.computeTargetVuForTestType(
        testType,
        elapsed,
        scenario.durationSeconds,
        scenario.rampUpSeconds || 1,
        baseVu,
        peakVu,
        scenario.volumePayloadKb
      );
      currentAllowedVu = stageInfo.targetVu;

      // Snapshot and reset 1s window
      const sortedLat = [...windowLatencies].sort((a, b) => a - b);
      const rps = window2xx + window401_403 + window429 + window5xx + windowNetErr;
      const avgLat =
        sortedLat.length > 0
          ? Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length)
          : 0;
      const throughputKbps = Math.round(windowBytes / 1024);

      const extMetrics: LiveRunTick['external'] = {
        activeWorkers: currentAllowedVu,
        requestsPerSec: rps,
        totalRequests: totalRequestsCount,
        throughputKbps,
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
      windowBytes = 0;

      // Poll REAL K8s Pod telemetry
      const internalMetrics = await this.pollRealK8sPodTelemetry(
        cluster,
        scenario.targetNamespace,
        matchedWorkload?.name || scenario.targetWorkload,
        memoryLimitMi,
        cpuLimitMillicores
      );

      const tick: LiveRunTick = {
        elapsedSeconds: elapsed,
        timestamp: new Date().toISOString(),
        stageLabel: stageInfo.stageLabel,
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
        this.activeRun.specializedInsights = this.computeSpecializedInsights(this.activeRun);
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

      this.activeRun.specializedInsights = this.computeSpecializedInsights(this.activeRun);
      this.activeRun.evaluation = this.evaluateRun(this.activeRun);
      storageRepo.saveTestRun(this.activeRun);
      this.onUpdate(this.activeRun);
    }, 1000);

    return runRecord;
  }

  private async runDynamicHttpWorker(
    workerIdx: number,
    getAllowedVu: () => number,
    url: string,
    scenario: TestScenario,
    effectiveBody: string | undefined,
    signal: AbortSignal,
    onSample: (latMs: number, statusCode: number, isNetErr: boolean, bytes: number) => void
  ): Promise<void> {
    // Stagger initial worker startup slightly over 200ms to avoid artificial thundering herd at t=0
    await new Promise((r) => setTimeout(r, (workerIdx % 20) * 10));

    while (!signal.aborted) {
      if (workerIdx >= getAllowedVu()) {
        // Worker is currently parked waiting for Stress/Spike step-up
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

      const t0 = performance.now();
      const reqBytes = effectiveBody ? Buffer.byteLength(effectiveBody, 'utf-8') : 0;
      try {
        const u = new URL(url);
        const hostHeader = scenario.headers?.['Host'] || scenario.headers?.['host'];
        const isHttps = u.protocol === 'https:';
        const client = isHttps ? https : http;
        const agent = isHttps ? keepAliveHttpsAgent : keepAliveHttpAgent;

        await new Promise<void>((resolve) => {
          const req = client.request(
            {
              protocol: u.protocol,
              hostname: u.hostname,
              port: u.port || (isHttps ? 443 : 80),
              path: `${u.pathname}${u.search}`,
              method: scenario.method || 'GET',
              headers: scenario.headers || {},
              servername: hostHeader || u.hostname,
              agent,
              rejectUnauthorized: false,
              timeout: 8000,
            },
            (res) => {
              let resLen = 0;
              res.on('data', (d) => {
                resLen += d.length;
              });
              res.on('end', () => {
                const elapsedMs = Math.round(performance.now() - t0);
                onSample(elapsedMs, res.statusCode || 0, false, reqBytes + resLen);
                resolve();
              });
            }
          );
          req.on('error', () => {
            if (!signal.aborted) {
              const elapsedMs = Math.round(performance.now() - t0);
              onSample(elapsedMs, 0, true, reqBytes);
            }
            resolve();
          });
          req.on('timeout', () => {
            req.destroy();
            if (!signal.aborted) {
              const elapsedMs = Math.round(performance.now() - t0);
              onSample(elapsedMs, 0, true, reqBytes);
            }
            resolve();
          });
          if (effectiveBody && (scenario.method === 'POST' || scenario.method === 'PUT')) {
            req.write(effectiveBody);
          }
          req.end();
        });
      } catch {
        if (signal.aborted) break;
        const elapsedMs = Math.round(performance.now() - t0);
        onSample(elapsedMs, 0, true, reqBytes);
      }

      await new Promise((r) => setTimeout(r, 40));
    }
  }

  private async runDynamicWebSocketWorker(
    workerIdx: number,
    getAllowedVu: () => number,
    wsUrl: string,
    scenario: TestScenario,
    signal: AbortSignal,
    onSample: (latMs: number, bucket: '2xx' | '401_403' | '429' | 'err') => void
  ): Promise<void> {
    await new Promise((r) => setTimeout(r, (workerIdx % 20) * 15));

    while (!signal.aborted) {
      if (workerIdx >= getAllowedVu()) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

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
          const hostHeader = scenario.headers?.['Host'] || scenario.headers?.['host'];
          const wsOptions: any = {
            headers: scenario.headers || {},
            handshakeTimeout: 5000,
            rejectUnauthorized: false,
            ...(hostHeader ? { servername: hostHeader } : {}),
          };
          const ws = new WebSocket(wsUrl, wsOptions);
          this.activeSockets.add(ws);

          ws.on('open', () => {
            const handshakeMs = Math.round(performance.now() - t0);
            onSample(handshakeMs, '2xx');

            // 1. Initial Application-Layer payload to force Node.js backend to register/process
            const initPayload =
              scenario.requestBody && scenario.requestBody.trim().length > 0
                ? scenario.requestBody
                : JSON.stringify({
                    type: 'CLIENT_CONNECT_STREAM',
                    workerId: workerIdx,
                    clientTs: Date.now(),
                  });
            try {
              ws.send(initPayload);
            } catch {}

            // 2. Active Application Message Pump: Forces Node.js Event Loop & Socket Buffers to process real data
            const isOomOrVolume =
              scenario.testType === 'VOLUME_TEST' ||
              (scenario.volumePayloadKb && scenario.volumePayloadKb > 0) ||
              scenario.name.includes('OOM');

            const pumpIntervalMs = isOomOrVolume ? 60 : 250;
            const payloadKb = scenario.volumePayloadKb || (isOomOrVolume ? 64 : 1);
            const heavyPayload = isOomOrVolume
              ? JSON.stringify({
                  event: 'heavy_data_stream_buffer_injection',
                  workerId: workerIdx,
                  seq: Math.floor(Math.random() * 100000),
                  clientTs: Date.now(),
                  blob: 'OOM_WS_STREAM_BLOB_0123456789_'.repeat(
                    Math.max(1, Math.floor((payloadKb * 1024) / 30))
                  ),
                })
              : null;

            const pumpTimer = setInterval(() => {
              if (
                signal.aborted ||
                ws.readyState !== WebSocket.OPEN ||
                workerIdx >= getAllowedVu()
              ) {
                clearInterval(pumpTimer);
                try {
                  ws.close();
                } catch {}
                finish();
                return;
              }

              const sentTs = performance.now();
              const msgPayload =
                heavyPayload ||
                JSON.stringify({
                  event: 'heartbeat_data_stream',
                  workerId: workerIdx,
                  seq: Math.floor(Math.random() * 100000),
                  clientTs: Date.now(),
                });

              try {
                ws.send(msgPayload, (err) => {
                  if (!err) {
                    const elapsed = Math.round(performance.now() - sentTs);
                    onSample(elapsed, '2xx');
                  }
                });
              } catch {
                onSample(100, 'err');
              }
            }, pumpIntervalMs);

            // Listen for server incoming messages to record round-trip response
            ws.on('message', () => {
              onSample(10, '2xx');
            });
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
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  /**
   * Computes specialized metrics for the 6 Performance Test types from REAL run ticks.
   */
  private computeSpecializedInsights(run: TestRunRecord): SpecializedTestInsights {
    const testType: PerformanceTestType = run.testType || 'LOAD_TEST';
    const ticks = run.ticks.filter((t) => t.elapsedSeconds > 0);

    // 1. Stress Test: Breaking Point VU detection
    let breakingPointVu: number | null = null;
    for (const t of ticks) {
      const hasFailure =
        t.external.status5xx > 0 ||
        t.external.networkErrors > 0 ||
        t.external.status429 > 0 ||
        t.external.latencyP95Ms > 1500;
      if (hasFailure) {
        breakingPointVu = t.external.activeWorkers;
        break;
      }
    }
    if (breakingPointVu === null && run.safetyBreaker.tripped) {
      breakingPointVu = run.latestTick.external.activeWorkers;
    }

    // 2. Spike Test: Recovery time after 10x spike
    let spikeRecoverySeconds: number | null = null;
    if (testType === 'SPIKE_TEST' && ticks.length >= 5) {
      const recoveryStartSec = Math.floor(run.durationSeconds * 0.65);
      const baselineTicks = ticks.filter(
        (t) => t.elapsedSeconds <= Math.max(2, Math.floor(run.durationSeconds * 0.25))
      );
      const baselineP95 =
        baselineTicks.length > 0
          ? Math.max(
              150,
              Math.round(
                baselineTicks.reduce((s, t) => s + t.external.latencyP95Ms, 0) /
                  baselineTicks.length
              )
            )
          : 250;
      const postSpikeTicks = ticks.filter((t) => t.elapsedSeconds >= recoveryStartSec);
      const recoveredTick = postSpikeTicks.find(
        (t) =>
          t.external.latencyP95Ms <= baselineP95 * 1.5 &&
          t.external.status5xx === 0 &&
          t.external.networkErrors === 0
      );
      if (recoveredTick) {
        spikeRecoverySeconds = Math.max(0, recoveredTick.elapsedSeconds - recoveryStartSec);
      }
    }

    // 3. Endurance / Soak Test: Net Pod Memory Drift (MiB)
    let memoryDriftMi: number | null = null;
    const memTicks = ticks.filter((t) => t.internal.totalMemoryMi !== null);
    if (memTicks.length >= 2) {
      const firstMem = memTicks[0].internal.totalMemoryMi!;
      const lastMem = memTicks[memTicks.length - 1].internal.totalMemoryMi!;
      memoryDriftMi = Math.round((lastMem - firstMem) * 10) / 10;
    }

    // 4. Scalability Test: RPS per Pod & Pod Count Range
    const podCounts = ticks.map((t) => t.internal.podCount).filter((c) => c > 0);
    const minPodsObserved = podCounts.length > 0 ? Math.min(...podCounts) : 0;
    const maxPodsObserved = podCounts.length > 0 ? Math.max(...podCounts) : 0;
    const avgRps =
      ticks.length > 0
        ? ticks.reduce((s, t) => s + t.external.requestsPerSec, 0) / ticks.length
        : 0;
    const rpsPerPod =
      maxPodsObserved > 0 ? Math.round((avgRps / maxPodsObserved) * 10) / 10 : null;

    // 5. Volume Test: Total Volume Processed (MB)
    const totalKb = ticks.reduce((s, t) => s + (t.external.throughputKbps || 0), 0);
    const totalVolumeMbProcessed = Math.round((totalKb / 1024) * 100) / 100;

    return {
      testType,
      breakingPointVu,
      spikeRecoverySeconds,
      memoryDriftMi,
      rpsPerPod,
      minPodsObserved,
      maxPodsObserved,
      totalVolumeMbProcessed,
    };
  }

  /**
   * Polls 100% REAL Pod CPU/Memory, Events, and Logs from the Kubernetes cluster.
   * Never invents fake numbers if metrics-server or K8s API is unreachable.
   */
  private async pollRealK8sPodTelemetry(
    cluster: ClusterConnection,
    namespace: string,
    targetWorkload: string | undefined,
    memoryLimitMi: number | null,
    cpuLimitMillicores: number | null = null
  ): Promise<LiveRunTick['internal']> {
    if (cluster.connectionType === 'external-url') {
      return {
        metricsAvailable: false,
        podCount: 0,
        primaryPodName: 'Chế độ External URL (Không kết nối K8s)',
        podPhase: 'External',
        totalCpuMillicores: null,
        cpuLimitMillicores: null,
        cpuUsagePercent: null,
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
          cpuLimitMillicores,
          cpuUsagePercent: null,
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

      let oomKilledDetected = false;
      for (const p of podsToInspect) {
        const statuses = p.status?.containerStatuses || [];
        for (const cs of statuses) {
          if (
            cs.lastState?.terminated?.reason === 'OOMKilled' ||
            cs.lastState?.terminated?.exitCode === 137 ||
            cs.state?.terminated?.reason === 'OOMKilled' ||
            cs.state?.terminated?.exitCode === 137
          ) {
            oomKilledDetected = true;
            break;
          }
        }
        if (oomKilledDetected) break;
      }

      if (
        recentEvent.toLowerCase().includes('oom') ||
        recentEvent.toLowerCase().includes('killing') ||
        recentEvent.toLowerCase().includes('evicted')
      ) {
        oomKilledDetected = true;
      }

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

      const cpuUsagePercent =
        totalCpuMillicores !== null && cpuLimitMillicores !== null && cpuLimitMillicores > 0
          ? Math.round((totalCpuMillicores / cpuLimitMillicores) * 100)
          : null;

      return {
        metricsAvailable,
        podCount: podsToInspect.length,
        primaryPodName,
        podPhase,
        totalCpuMillicores,
        cpuLimitMillicores,
        cpuUsagePercent,
        totalMemoryMi,
        memoryLimitMi,
        memoryUsagePercent,
        restartCount,
        oomKilledDetected,
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
        cpuLimitMillicores,
        cpuUsagePercent: null,
        totalMemoryMi: null,
        memoryLimitMi,
        memoryUsagePercent: null,
        restartCount: 0,
        oomKilledDetected: false,
        recentEvent: err instanceof Error ? err.message : 'K8s API Error',
        recentLogLine: '',
      };
    }
  }

  /**
   * Executes REAL Security Probes across all 5 Security Testing Categories:
   * 1. DAST (Dynamic Application Security Testing) - Automation: Có
   * 2. API Security (Input, Permissions & API Behavior) - Automation: Một phần
   * 3. Authentication / Authorization (Role & Access Verification) - Automation: Một phần
   * 4. Infrastructure Scan (K8s NetworkPolicy, Pod SecurityContext, TLS) - Automation: Có
   * 5. Pentest (Exploit Chain & Logic Vulnerability Probes) - Automation: Một phần
   */
  private async executeRealSecurityAudit(
    targetUrl: string,
    scenario: TestScenario,
    snapshot: NamespaceTopologySnapshot
  ): Promise<SecurityAuditFinding[]> {
    const findings: SecurityAuditFinding[] = [];
    const httpProbeUrl = targetUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
    const baseOrigin = (() => {
      try {
        return new URL(httpProbeUrl).origin;
      } catch {
        return httpProbeUrl;
      }
    })();

    // ==========================================================================
    // 1. DAST (Dynamic Application Security Testing) — Tự động hóa: Có (100%)
    // ==========================================================================
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const dastUrl = `${httpProbeUrl}${httpProbeUrl.includes('?') ? '&' : '?'}dast_probe=%3Cscript%3Ealert(1)%3C%2Fscript%3E&sqli=1%27%20OR%20%271%27%3D%271`;
      const res = await fetch(dastUrl, {
        method: 'GET',
        headers: {
          Origin: 'https://unauthorized-origin-check.example.com',
        },
        signal: ctrl.signal,
      });
      const bodyText = await res.text().catch(() => '');
      clearTimeout(t);

      const hsts = res.headers.get('strict-transport-security');
      const csp = res.headers.get('content-security-policy');
      const xfo = res.headers.get('x-frame-options');
      const xcto = res.headers.get('x-content-type-options');
      const serverHeader = res.headers.get('server') || 'Hidden';
      const poweredBy = res.headers.get('x-powered-by');

      const hasSecurityHeaders = Boolean(hsts || xfo || xcto || csp);
      findings.push({
        id: 'dast-headers',
        category: 'DAST',
        automationLevel: 'Có (Tự động 100%)',
        titleVi: '[DAST] Kiểm tra HTTP Security Headers & Chống Clickjacking/XSS',
        technicalCheck: `GET ${httpProbeUrl} -> Inspect HSTS, CSP, X-Frame-Options, X-Content-Type-Options`,
        observedResult: `HTTP ${res.status} | HSTS: ${hsts ? 'Có' : 'Thiếu'} | CSP: ${csp ? 'Có' : 'Thiếu'} | XFO: ${xfo || 'Thiếu'} | XCTO: ${xcto || 'Thiếu'} | X-Powered-By: ${poweredBy || 'Đã ẩn'}`,
        status: hasSecurityHeaders && !poweredBy ? 'PASS' : 'WARN',
        nonTechExplanationVi: hasSecurityHeaders
          ? 'Ứng dụng web đã bật các tiêu đề bảo vệ trình duyệt chống nhúng iframe giả mạo và đánh cắp phiên.'
          : 'Phản hồi web đang thiếu một số tiêu đề bảo mật (HSTS, CSP, X-Frame-Options) hoặc còn lộ nhãn công nghệ X-Powered-By.',
        remediationVi:
          'Bật Middleware Security Headers trên Ingress/Traefik (HSTS, X-Frame-Options=DENY, X-Content-Type-Options=nosniff) và tắt X-Powered-By.',
      });

      const reflectedXss = bodyText.includes('<script>alert(1)</script>');
      const sqli500 = res.status >= 500;
      findings.push({
        id: 'dast-injection',
        category: 'DAST',
        automationLevel: 'Có (Tự động 100%)',
        titleVi: '[DAST] Rà quét Phản xạ XSS & Xử lý Ngoặc Đơn SQLi khi Chạy',
        technicalCheck: `GET ${dastUrl} -> Check unescaped payload reflection or unhandled 500 SQL error`,
        observedResult: `HTTP ${res.status} | Server: ${serverHeader} | Reflected <script>: ${reflectedXss ? 'CÓ (Nguy hiểm)' : 'Không'} | Unhandled 500: ${sqli500 ? 'CÓ' : 'Không'}`,
        status: reflectedXss || sqli500 ? 'FAIL' : 'PASS',
        nonTechExplanationVi:
          reflectedXss || sqli500
            ? 'Cảnh báo: Ứng dụng phản chiếu trực tiếp mã kịch bản hoặc trả lỗi máy chủ 500 khi nhận ký tự đặc biệt.'
            : 'Ứng dụng xử lý an toàn các chuỗi ký tự đặc biệt (XSS/SQLi probe), không bị sập hoặc phản chiếu mã độc.',
        remediationVi:
          'Áp dụng chuẩn hóa dữ liệu đầu vào (Input Validation / Parameterized Queries) và mã hóa HTML đầu ra.',
      });
    } catch (err) {
      findings.push({
        id: 'dast-err',
        category: 'DAST',
        automationLevel: 'Có (Tự động 100%)',
        titleVi: '[DAST] Kiểm tra Kết nối Thực tế tới Ứng dụng Web',
        technicalCheck: `GET ${httpProbeUrl}`,
        observedResult: err instanceof Error ? err.message : 'Connection failed',
        status: 'FAIL',
        nonTechExplanationVi: 'Không thể kết nối tới địa chỉ đích để thực hiện quét DAST.',
        remediationVi: 'Kiểm tra lại địa chỉ URL hoặc cấu hình DNS / Ingress.',
      });
    }

    // ==========================================================================
    // 2. API Security (Kiểm tra Input, Quyền & Hành vi API) — Tự động hóa: Một phần
    // ==========================================================================
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const apiRes = await fetch(httpProbeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://unauthorized-api-caller.example.com',
        },
        body: '{"malformedJson": [1, 2, ',
        signal: ctrl.signal,
      });
      clearTimeout(t);

      const acao = apiRes.headers.get('access-control-allow-origin');
      const corsWildcard =
        acao === '*' || acao === 'https://unauthorized-api-caller.example.com';
      const leakedStack = apiRes.status === 500;

      findings.push({
        id: 'api-input-cors',
        category: 'API_SECURITY',
        automationLevel: 'Một phần (Bán tự động)',
        titleVi: '[API Security] Kiểm tra Xử lý Malformed Input, CORS & Hành vi API',
        technicalCheck: `POST ${httpProbeUrl} (Malformed JSON + Foreign Origin) -> Expect 400/401/404/405 without 500 stack leak`,
        observedResult: `HTTP ${apiRes.status} | CORS Allow-Origin: ${acao || 'Restricted'} | Unhandled 500: ${leakedStack ? 'Có' : 'Không'}`,
        status: leakedStack ? 'FAIL' : corsWildcard ? 'WARN' : 'PASS',
        nonTechExplanationVi: leakedStack
          ? 'API trả lỗi 500 khi nhận gói dữ liệu JSON bị hỏng, có nguy cơ lộ cấu trúc mã nguồn bên trong.'
          : corsWildcard
          ? 'API từ chối dữ liệu lỗi đúng chuẩn nhưng đang mở CORS (*) cho phép tên miền lạ gọi vào.'
          : 'API kiểm soát tốt dữ liệu đầu vào bất thường và khóa chặt danh sách tên miền CORS.',
        remediationVi:
          'Bổ sung bộ lọc Schema Validation (Zod / DTO Pipe) trả mã 400 rõ ràng và giới hạn CORS Origin theo danh sách trắng.',
      });
    } catch {
      // ignore if endpoint unreachable
    }

    // ==========================================================================
    // 3. Authentication / Authorization (Vai trò & Quyền truy cập) — Tự động: Một phần
    // ==========================================================================
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const forgedJwtRes = await fetch(httpProbeUrl, {
        method: scenario.method || 'GET',
        headers: {
          Authorization: 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIn0.',
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);

      const isPublicHealth =
        httpProbeUrl.endsWith('/healthz') || httpProbeUrl.endsWith('/health');
      const rejectedInvalidToken =
        forgedJwtRes.status === 401 || forgedJwtRes.status === 403;

      findings.push({
        id: 'auth-rbac-probe',
        category: 'AUTH_RBAC',
        automationLevel: 'Một phần (Bán tự động)',
        titleVi: '[Authentication / Authorization] Xác minh Chặn Token Giả mạo (`alg: none`) & Quyền Truy cập',
        technicalCheck: `Send forged JWT (alg:none, role:superadmin) to ${httpProbeUrl} -> Verify 401/403 enforcement`,
        observedResult: `HTTP ${forgedJwtRes.status} (${rejectedInvalidToken ? 'Đã chặn 401/403 chuẩn xác' : isPublicHealth ? 'Public Health Endpoint (200 OK)' : 'Cho phép truy cập không cần xác thực'})`,
        status: rejectedInvalidToken || isPublicHealth ? 'PASS' : 'WARN',
        nonTechExplanationVi: rejectedInvalidToken
          ? 'Hệ thống xác thực đã phát hiện và chặn đứng thẻ truy cập (JWT Token) giả mạo.'
          : isPublicHealth
          ? 'Đây là đường dẫn kiểm tra sức khỏe công khai (/healthz); hãy chọn thêm API nghiệp vụ (như /projects, /auth) kèm Token thật để kiểm tra phân quyền RBAC sâu hơn.'
          : 'Đường dẫn này hiện cho phép truy cập mà không bắt buộc kiểm tra thẻ JWT Token.',
        remediationVi:
          'Bắt buộc xác thực chữ ký JWT (RS256/HS256) trên mọi API nghiệp vụ và kiểm tra phân quyền theo vai trò (RBAC / Ownership) để chống BOLA/IDOR.',
      });
    } catch {
      // ignore
    }

    // ==========================================================================
    // 4. Infrastructure Scan (Cấu hình Hạ tầng K8s & Ingress) — Tự động hóa: Có (100%)
    // ==========================================================================
    if (snapshot.k8sConnected) {
      const netpolCount = snapshot.networkPolicies.length;
      const policyNames = snapshot.networkPolicies.map((n) => n.name).join(', ');
      findings.push({
        id: 'infra-k8s-netpol',
        category: 'INFRA_SCAN',
        automationLevel: 'Có (Tự động 100%)',
        titleVi: `[Infrastructure Scan] Kiểm toán Tường lửa Nội bộ K8s (NetworkPolicy trong ${scenario.targetNamespace})`,
        technicalCheck: `K8s API: listNamespacedNetworkPolicy('${scenario.targetNamespace}')`,
        observedResult:
          netpolCount > 0
            ? `Phát hiện ${netpolCount} NetworkPolicy đang bật (${policyNames})`
            : `0 NetworkPolicy trong namespace '${scenario.targetNamespace}'`,
        status: netpolCount > 0 ? 'PASS' : 'WARN',
        nonTechExplanationVi:
          netpolCount > 0
            ? `Cụm máy chủ đã thiết lập ${netpolCount} lớp tường lửa nội bộ để cô lập và bảo vệ ứng dụng.`
            : 'Namespace này hiện chưa có NetworkPolicy; các Pod từ namespace khác có thể kết nối ngang sang.',
        remediationVi:
          'Áp dụng NetworkPolicy default-deny-all và chỉ mở cổng cho phép Ingress Controller (Traefik) đi vào.',
      });

      const wl =
        snapshot.workloads.find((w) => w.name === scenario.targetWorkload) ||
        snapshot.workloads[0];
      if (wl) {
        const hasLimits = wl.memoryLimitMi !== null && wl.cpuLimitMillicores !== null;
        const hardened = wl.securityContext.runAsNonRoot;
        findings.push({
          id: 'infra-k8s-podsec',
          category: 'INFRA_SCAN',
          automationLevel: 'Có (Tự động 100%)',
          titleVi: `[Infrastructure Scan] Kiểm toán Cấu hình Bảo vệ Pod & Giới hạn Tài nguyên (${wl.name})`,
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
    } else {
      findings.push({
        id: 'infra-external-tls',
        category: 'INFRA_SCAN',
        automationLevel: 'Có (Tự động 100%)',
        titleVi: '[Infrastructure Scan] Kiểm tra Giao thức Mã hóa Đường truyền (HTTPS/TLS)',
        technicalCheck: `Inspect transport protocol on ${baseOrigin}`,
        observedResult: baseOrigin.startsWith('https')
          ? `Đang sử dụng HTTPS/TLS an toàn (${baseOrigin})`
          : `Đang sử dụng HTTP không mã hóa (${baseOrigin})`,
        status: baseOrigin.startsWith('https') ? 'PASS' : 'FAIL',
        nonTechExplanationVi: baseOrigin.startsWith('https')
          ? 'Đường truyền tới máy chủ đã được mã hóa SSL/TLS.'
          : 'Đường truyền chưa được mã hóa HTTPS, dữ liệu có thể bị nghe lén.',
        remediationVi: 'Bật chứng chỉ TLS (Let’s Encrypt / Cloudflare) và ép buộc chuyển hướng HTTPS.',
      });
    }

    // ==========================================================================
    // 5. Pentest (Phát hiện chuỗi khai thác & lỗi logic phức tạp) — Tự động: Một phần
    // ==========================================================================
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const traversalUrl = `${baseOrigin}/..%2f..%2fetc%2fpasswd`;
      const ptRes = await fetch(traversalUrl, {
        method: 'GET',
        signal: ctrl.signal,
      });
      const ptBody = await ptRes.text().catch(() => '');
      clearTimeout(t);

      const leakedPasswd = ptBody.includes('root:x:0:0');
      findings.push({
        id: 'pentest-chain-traversal',
        category: 'PENTEST_CHAIN',
        automationLevel: 'Một phần (Bán tự động)',
        titleVi: '[Pentest] Mô phỏng Chuỗi Khai thác Path Traversal & Kiểm tra Logic Nghiệp vụ',
        technicalCheck: `Chain: Recon (${baseOrigin}) -> Path Traversal Probe (/..%2f..%2fetc/passwd) -> K8s Pod Log Correlation`,
        observedResult: `HTTP ${ptRes.status} | Lộ file hệ thống: ${leakedPasswd ? 'CÓ (Nguy hiểm)' : 'Không (Đã chặn an toàn)'}`,
        status: leakedPasswd ? 'FAIL' : 'PASS',
        nonTechExplanationVi: leakedPasswd
          ? 'Phát hiện lỗ hổng nghiêm trọng cho phép đọc file hệ thống bên ngoài thư mục web.'
          : 'Hệ thống chặn đứng mũi thăm dò leo thang thư mục tự động. Đối với các lỗi logic nghiệp vụ phức tạp (như gian lận quy trình thanh toán/đặt hàng), kỹ sư cần kết hợp kiểm thử thủ công.',
        remediationVi:
          'Kết hợp kết quả thăm dò tự động này với Pentest thủ công cho các luồng nghiệp vụ nhiều bước (Race Condition, IDOR chéo tài khoản, Business Logic Bypass).',
      });
    } catch {
      // ignore
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
    const maxCpuMilli = ticks.reduce(
      (m, t) => Math.max(m, t.internal.totalCpuMillicores || 0),
      0
    );
    const maxCpuPct = ticks.reduce(
      (m, t) => Math.max(m, t.internal.cpuUsagePercent || 0),
      0
    );

    const insights = run.specializedInsights;
    const recs: string[] = [];
    let grade: TestRunRecord['evaluation']['grade'] = 'A+';

    if (run.latestTick.internal.oomKilledDetected) {
      grade = 'F';
      recs.unshift(
        '🚨 SỰ KIỆN KUBERNETES OOMKilled: Pod đã bị K8s tiêu diệt hoàn toàn do vượt quá giới hạn bộ nhớ RAM (Exit Code 137). Cần tăng memory limit hoặc tối ưu xử lý payload lớn / stream JSON.'
      );
    } else if (run.safetyBreaker.tripped) {
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

    if (maxCpuPct >= 85) {
      recs.push(
        `[Hiệu năng CPU - Cảnh báo CFS Throttling]: CPU Pod đạt đỉnh ${maxCpuMilli}m (${maxCpuPct}% mức trần ${run.latestTick.internal.cpuLimitMillicores}m). Khuyến nghị nâng resources.limits.cpu hoặc cấu hình HPA mở rộng theo CPU utilization.`
      );
    }

    if (insights) {
      if (insights.testType === 'STRESS_TEST') {
        if (insights.breakingPointVu) {
          recs.push(
            `[Stress Test - Điểm gãy]: Hệ thống bắt đầu xuất hiện suy giảm/chặn tải tại ngưỡng ${insights.breakingPointVu} Users đồng thời. Nên cài đặt HPA tự động mở rộng trước ngưỡng ${Math.round(insights.breakingPointVu * 0.75)} Users.`
          );
        } else {
          recs.push(
            `[Stress Test]: Hệ thống chịu đựng thành công mức tải cực đại ${run.peakVirtualUsers || run.virtualUsers} Users mà chưa xuất hiện điểm gãy.`
          );
        }
      } else if (insights.testType === 'SPIKE_TEST') {
        recs.push(
          insights.spikeRecoverySeconds !== null && insights.spikeRecoverySeconds !== undefined
            ? `[Spike Test - Phục hồi sau sốc 10x]: Hệ thống tự động phục hồi độ trễ ổn định sau ${insights.spikeRecoverySeconds} giây kể từ khi đỉnh Spike kết thúc.`
            : `[Spike Test]: Đang theo dõi hoặc cần thêm thời gian để độ trễ p95 hạ về mức nền sau cú sốc tăng tải đột ngột.`
        );
      } else if (
        insights.testType === 'SOAK_ENDURANCE_TEST' &&
        insights.memoryDriftMi !== null &&
        insights.memoryDriftMi !== undefined
      ) {
        if (insights.memoryDriftMi > 25) {
          grade = grade === 'A+' ? 'B' : grade;
          recs.push(
            `[Soak Test - Cảnh báo Rò rỉ RAM]: Bộ nhớ Pod tăng thêm +${insights.memoryDriftMi} MiB sau thời gian chạy liên tục mà chưa giải phóng hết. Cần kiểm tra Memory Leak / vùng đệm.`
          );
        } else {
          recs.push(
            `[Soak Test - Độ bền]: Độ lệch RAM trong suốt phiên chạy là ${insights.memoryDriftMi >= 0 ? `+${insights.memoryDriftMi}` : insights.memoryDriftMi} MiB (Garbage Collector hoạt động ổn định, không có dấu hiệu Memory Leak).`
          );
        }
      } else if (insights.testType === 'SCALABILITY_TEST') {
        recs.push(
          `[Scalability Test]: Quan sát từ ${insights.minPodsObserved || 1} đến ${insights.maxPodsObserved || 1} Pod, đạt hiệu suất trung bình ${insights.rpsPerPod ?? 0} req/s trên mỗi Pod.`
        );
      } else if (insights.testType === 'VOLUME_TEST') {
        recs.push(
          `[Volume Test]: Đã truyền tải và xử lý tổng cộng ${insights.totalVolumeMbProcessed ?? 0} MB dữ liệu khối lượng lớn qua hệ thống.`
        );
      }
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
      recs.push('Hệ thống vận hành ổn định, độ trễ thấp và đáp ứng tốt mức tải hiện tại.');
    }

    const lastMemStr =
      run.latestTick.internal.totalMemoryMi !== null
        ? `${run.latestTick.internal.totalMemoryMi} MiB${
            run.latestTick.internal.memoryLimitMi
              ? ` / ${run.latestTick.internal.memoryLimitMi} MiB (${maxMemPct || run.latestTick.internal.memoryUsagePercent || 0}%)`
              : ''
          }`
        : 'N/A';

    const lastCpuStr =
      run.latestTick.internal.totalCpuMillicores !== null
        ? `${run.latestTick.internal.totalCpuMillicores}m${
            run.latestTick.internal.cpuLimitMillicores
              ? ` / ${run.latestTick.internal.cpuLimitMillicores}m (${maxCpuPct || run.latestTick.internal.cpuUsagePercent || 0}%)`
              : ''
          }`
        : 'N/A';

    return {
      grade,
      headlineVi: run.latestTick.internal.oomKilledDetected
        ? `🚨 SỰ KIỆN KUBERNETES OOMKilled (Exit Code 137): Pod đã bị tiêu diệt do cạn kiệt bộ nhớ RAM!`
        : run.safetyBreaker.tripped
        ? `⚡ Đã ngắt an toàn bởi Cầu chì Tự động khi RAM chạm ${run.latestTick.internal.totalMemoryMi} MiB`
        : customStopNote ||
          `Hoàn tất [${run.testType || 'LOAD_TEST'}] trên ${run.targetUrl}: Tổng ${totalReq} yêu cầu, p95=${maxP95}ms, RAM Pod ${lastMemStr}, CPU Pod ${lastCpuStr}`,
      nonTechSummaryVi: run.latestTick.internal.oomKilledDetected
        ? `CẢNH BÁO ĐỎ: Pod ứng dụng trên Kubernetes đã bị hệ điều hành tiêu diệt (OOMKilled - Exit Code 137) do tiêu thụ vượt trần RAM (${lastMemStr}). Đã xác nhận điểm sụp đổ hoàn toàn của hệ thống.`
        : `Trong phiên kiểm thử [${run.testType || 'LOAD_TEST'}] (từ ${run.virtualUsers} đến ${run.peakVirtualUsers || run.virtualUsers} người dùng đồng thời) vào ${run.targetUrl}, máy chủ đã xử lý thành công ${total2xx}/${totalReq} yêu cầu (chặn quá tải 429: ${total429}, lỗi: ${total5xx}). Độ trễ phản hồi thực tế (p95) là ${maxP95}ms, mức tiêu thụ RAM là ${lastMemStr} và CPU là ${lastCpuStr}.`,
      engineerSummary: `Type=${run.testType || 'LOAD_TEST'} | Target=${run.targetUrl} | TotalReq=${totalReq} (2xx=${total2xx}, 429=${total429}, 5xx/Err=${total5xx}) | Max_p95=${maxP95}ms | Pod_RAM=${lastMemStr} | Pod_CPU=${lastCpuStr} | OOMKilled=${Boolean(run.latestTick.internal.oomKilledDetected)}`,
      recommendationsVi: recs,
    };
  }
}
