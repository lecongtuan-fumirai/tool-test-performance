import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as k8s from '@kubernetes/client-node';
import {
  ClusterConnection,
  ClusterConnectionPublic,
  NamespaceTopologySnapshot,
  TestRunRecord,
  TestScenario,
} from '../types.js';
import { cryptoVault } from '../security/cryptoVault.js';

interface DatabaseSchema {
  clusters: ClusterConnection[];
  scenarios: TestScenario[];
  testRuns: TestRunRecord[];
}

export class StorageRepository {
  private dbFilePath: string;
  private data: DatabaseSchema;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbFilePath = path.join(dataDir, 'kubepulse.storage.json');
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        return {
          clusters: parsed.clusters || [],
          scenarios: parsed.scenarios || [],
          testRuns: parsed.testRuns || [],
        };
      } catch {
        // Fallback if corrupted
      }
    }
    return {
      clusters: [],
      scenarios: [],
      testRuns: [],
    };
  }

  private saveToDisk(): void {
    fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  public toPublicCluster(c: ClusterConnection): ClusterConnectionPublic {
    const { encryptedKubeconfig, ...rest } = c;
    return {
      ...rest,
      hasKubeconfig: Boolean(encryptedKubeconfig || c.connectionType === 'local-kubeconfig'),
    };
  }

  public listClustersPublic(): ClusterConnectionPublic[] {
    return this.data.clusters.map((c) => this.toPublicCluster(c));
  }

  public getClusterInternal(id: string): ClusterConnection | undefined {
    return this.data.clusters.find((c) => c.id === id);
  }

  /**
   * Decrypts the KubeConfig for a cluster in memory only (never written to disk).
   */
  public loadKubeConfigInMemory(cluster: ClusterConnection): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();
    if (cluster.encryptedKubeconfig) {
      const yamlPlain = cryptoVault.decrypt(cluster.encryptedKubeconfig);
      kc.loadFromString(yamlPlain);
      if (cluster.kubeContext) {
        kc.setCurrentContext(cluster.kubeContext);
      }
      return kc;
    }

    if (cluster.connectionType === 'local-kubeconfig') {
      const defaultKubePath = path.join(os.homedir(), '.kube', 'config');
      if (!fs.existsSync(defaultKubePath)) {
        throw new Error(`Không tìm thấy file ~/.kube/config tại ${defaultKubePath}`);
      }
      kc.loadFromFile(defaultKubePath);
      if (cluster.kubeContext) {
        kc.setCurrentContext(cluster.kubeContext);
      }
      return kc;
    }

    throw new Error('Kết nối này là External URL (Black-box), không có cấu hình Kubeconfig.');
  }

  /**
   * Scans the host OS ~/.kube/config (if present) and registers its contexts in the database
   * with AES-256-GCM encrypted credentials.
   */
  public importFromLocalKubeconfig(): ClusterConnectionPublic[] {
    const defaultKubePath = path.join(os.homedir(), '.kube', 'config');
    if (!fs.existsSync(defaultKubePath)) {
      throw new Error(`Không tìm thấy file cấu hình K8s tại ${defaultKubePath}`);
    }

    const rawYaml = fs.readFileSync(defaultKubePath, 'utf-8');
    const kc = new k8s.KubeConfig();
    kc.loadFromString(rawYaml);

    const contexts = kc.getContexts();
    if (contexts.length === 0) {
      throw new Error('File ~/.kube/config không chứa context nào hợp lệ.');
    }

    const encrypted = cryptoVault.encrypt(rawYaml);
    const added: ClusterConnectionPublic[] = [];

    for (const ctx of contexts) {
      const clusterObj = kc.getCluster(ctx.cluster);
      const serverUrl = clusterObj?.server || 'https://127.0.0.1:6443';
      const existing = this.data.clusters.find(
        (c) => c.kubeContext === ctx.name && c.connectionType === 'local-kubeconfig'
      );

      if (existing) {
        existing.encryptedKubeconfig = encrypted;
        added.push(this.toPublicCluster(existing));
      } else {
        const newConn: ClusterConnection = {
          id: `cluster-${crypto.randomUUID().slice(0, 8)}`,
          name: `Local K8s (${ctx.name})`,
          environment: 'production',
          connectionType: 'local-kubeconfig',
          encryptedKubeconfig: encrypted,
          kubeContext: ctx.name,
          externalBaseUrl: '',
          sshTunnelHint: serverUrl.includes('127.0.0.1')
            ? `Cluster API qua cổng cục bộ ${serverUrl} (Đảm bảo SSH Tunnel hoặc K3s đang mở)`
            : undefined,
          createdAt: new Date().toISOString(),
          status: 'unverified',
        };
        this.data.clusters.push(newConn);
        added.push(this.toPublicCluster(newConn));
      }
    }

    this.saveToDisk();
    return added;
  }

  public addClusterConnection(input: {
    name: string;
    environment: ClusterConnection['environment'];
    connectionType: ClusterConnection['connectionType'];
    kubeconfigYaml?: string;
    externalBaseUrl: string;
    sshTunnelHint?: string;
  }): ClusterConnection {
    let encryptedKubeconfig: string | undefined;
    let kubeContext: string | undefined;

    if (input.kubeconfigYaml && input.kubeconfigYaml.trim().length > 0) {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(input.kubeconfigYaml);
      kubeContext = kc.getCurrentContext() || kc.getContexts()[0]?.name;
      encryptedKubeconfig = cryptoVault.encrypt(input.kubeconfigYaml);
    }

    const newConn: ClusterConnection = {
      id: `cluster-${crypto.randomUUID().slice(0, 8)}`,
      name: input.name.trim(),
      environment: input.environment,
      connectionType: input.connectionType,
      encryptedKubeconfig,
      kubeContext,
      externalBaseUrl: input.externalBaseUrl.trim().replace(/\/+$/, ''),
      sshTunnelHint: input.sshTunnelHint?.trim(),
      createdAt: new Date().toISOString(),
      status: 'unverified',
    };

    this.data.clusters.push(newConn);
    this.saveToDisk();
    return newConn;
  }

  public updateClusterStatus(
    clusterId: string,
    update: Partial<
      Pick<
        ClusterConnection,
        'status' | 'k8sVersion' | 'apiLatencyMs' | 'statusMessage' | 'lastCheckedAt' | 'externalBaseUrl'
      >
    >
  ): ClusterConnection | undefined {
    const conn = this.data.clusters.find((c) => c.id === clusterId);
    if (!conn) return undefined;
    Object.assign(conn, update);
    this.saveToDisk();
    return conn;
  }

  public deleteClusterConnection(clusterId: string): boolean {
    const before = this.data.clusters.length;
    this.data.clusters = this.data.clusters.filter((c) => c.id !== clusterId);
    this.data.scenarios = this.data.scenarios.filter((s) => s.clusterId !== clusterId);
    this.saveToDisk();
    return this.data.clusters.length < before;
  }

  // ============================================================================
  // DYNAMIC SCENARIOS CRUD
  // ============================================================================
  public listScenarios(clusterId?: string): TestScenario[] {
    if (!clusterId) return this.data.scenarios;
    return this.data.scenarios.filter((s) => s.clusterId === clusterId);
  }

  public getScenario(id: string): TestScenario | undefined {
    return this.data.scenarios.find((s) => s.id === id);
  }

  public saveScenario(
    input: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): TestScenario {
    const now = new Date().toISOString();
    if (input.id) {
      const existing = this.data.scenarios.find((s) => s.id === input.id);
      if (existing) {
        Object.assign(existing, input, { updatedAt: now });
        this.saveToDisk();
        return existing;
      }
    }

    const created: TestScenario = {
      ...input,
      id: `scen-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.data.scenarios.push(created);
    this.saveToDisk();
    return created;
  }

  public deleteScenario(id: string): boolean {
    const before = this.data.scenarios.length;
    this.data.scenarios = this.data.scenarios.filter((s) => s.id !== id);
    this.saveToDisk();
    return this.data.scenarios.length < before;
  }

  /**
   * Dynamically generates the full 6 Performance Test Types + Security Audit suite
   * based on REAL discovered Ingresses & Workloads in a namespace (Zero hardcode!).
   */
  public generateScenariosFromTopology(
    cluster: ClusterConnection,
    snapshot: NamespaceTopologySnapshot
  ): TestScenario[] {
    const created: TestScenario[] = [];
    const primaryWorkload = snapshot.workloads[0]?.name || '';
    const currentReplicas = snapshot.workloads[0]?.replicas || 1;
    const firstIngress = snapshot.ingresses[0];
    const baseUrl = firstIngress
      ? `${firstIngress.tlsEnabled ? 'https' : 'http'}://${firstIngress.host}`
      : cluster.externalBaseUrl || 'https://localhost';

    const httpRoutes = snapshot.ingresses.filter((r) => r.protocol !== 'WSS');
    const primaryPath = httpRoutes[0]?.path || '/healthz';
    const dataPath =
      httpRoutes.find((r) => r.path !== '/healthz' && r.path !== '/')?.path || primaryPath;

    // 1. Load Testing — Kiểm tra hệ thống với tải dự kiến
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[1. Load Testing] Kiểm tra Tải Dự kiến (${primaryPath})`,
        description: `Kiểm tra hệ thống hoạt động ổn định ở mức tải mục tiêu dự kiến và đối chiếu SLA (p95 Latency, RAM/CPU của Pod ${primaryWorkload || snapshot.namespace}).`,
        testType: 'LOAD_TEST',
        protocol: 'HTTP',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: primaryPath,
        headers: {},
        virtualUsers: 50,
        peakVirtualUsers: 50,
        durationSeconds: 20,
        rampUpSeconds: 5,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    // 2. Stress Testing — Tăng tải vượt giới hạn để tìm điểm gãy (Breaking Point)
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[2. Stress Testing] Tìm Điểm Gãy Hạ tầng (${dataPath})`,
        description: `Tăng tải bậc thang liên tục từ 30 lên 300 Users vượt giới hạn chịu đựng để xác định chính xác Điểm gãy (Breaking Point: ngưỡng bắt đầu báo lỗi 5xx/429 hoặc chạm trần RAM).`,
        testType: 'STRESS_TEST',
        protocol: 'HTTP',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: dataPath,
        headers: {},
        virtualUsers: 30,
        peakVirtualUsers: 300,
        durationSeconds: 30,
        rampUpSeconds: 5,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 88,
      })
    );

    // 3. Spike Testing — Kiểm tra khi tải tăng hoặc giảm đột ngột (Traffic tăng 10 lần)
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[3. Spike Testing] Sốc Tải Đột ngột Gấp 10 Lần (${primaryPath})`,
        description: `Đang chạy tải nền 20 Users thì tăng vọt đột ngột gấp 10 lần (200 Users) không báo trước, sau đó hạ đột ngột để đo thời gian hệ thống tự phục hồi (Recovery Time).`,
        testType: 'SPIKE_TEST',
        protocol: 'HTTP',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: primaryPath,
        headers: {},
        virtualUsers: 20,
        peakVirtualUsers: 200,
        durationSeconds: 25,
        rampUpSeconds: 2,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    // 4. Endurance / Soak Testing — Kiểm tra hệ thống khi chịu tải lâu dài (Phát hiện Memory Leak)
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[4. Endurance / Soak Testing] Chịu tải Dài hạn & Dò Rò rỉ RAM`,
        description: `Duy trì tải liên tục trong thời gian dài để kiểm tra độ bền (Soak Test), theo dõi độ lệch bộ nhớ (Memory Drift MiB) nhằm phát hiện rò rỉ RAM (Memory Leak) hoặc nghẽn kết nối.`,
        testType: 'SOAK_ENDURANCE_TEST',
        protocol: 'HTTP',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: primaryPath,
        headers: {},
        virtualUsers: 35,
        peakVirtualUsers: 35,
        durationSeconds: 60,
        rampUpSeconds: 8,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    // 5. Scalability Testing — Kiểm tra khả năng mở rộng khi tăng tài nguyên / số Pod
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[5. Scalability Testing] Đánh giá Khả năng Mở rộng Pod (${currentReplicas} -> ${Math.max(4, currentReplicas * 3)} Pods)`,
        description: `Đo lường hiệu năng mở rộng (RPS trên mỗi Pod, độ trễ và mức chia tải CPU/RAM) khi tăng quy mô Pod từ ${currentReplicas} lên ${Math.max(4, currentReplicas * 3)} Replicas.`,
        testType: 'SCALABILITY_TEST',
        protocol: 'HTTP',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: dataPath,
        headers: {},
        virtualUsers: 60,
        peakVirtualUsers: 120,
        targetPodReplicas: Math.max(4, currentReplicas * 3),
        durationSeconds: 25,
        rampUpSeconds: 6,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    // 6. Volume Testing — Kiểm tra khi dữ liệu có khối lượng lớn (Large Payload / DB Batch)
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[6. Volume Testing] Kiểm thử Khối lượng Dữ liệu Lớn (${dataPath})`,
        description: `Bắn luồng dữ liệu có dung lượng lớn (Heavy Payload 64KB/request & tham số truy vấn tập bản ghi lớn) để kiểm tra băng thông xử lý, bộ nhớ V8 Heap và tốc độ truy vấn Database.`,
        testType: 'VOLUME_TEST',
        protocol: 'HTTP',
        method: 'POST',
        targetBaseUrl: baseUrl,
        targetPath: `${dataPath}${dataPath.includes('?') ? '&' : '?'}limit=5000&volumeTest=true`,
        headers: {
          'Content-Type': 'application/json',
        },
        volumePayloadKb: 64,
        virtualUsers: 25,
        peakVirtualUsers: 25,
        durationSeconds: 20,
        rampUpSeconds: 4,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    // 7. Real Security & K8s Manifest Audit Scenario
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[7. Security Audit] Kiểm toán Bảo mật Cửa ngõ & K8s (${snapshot.namespace})`,
        description: `Kiểm tra thực tế Security Headers, CORS, Auth và kiểm toán NetworkPolicy + Pod SecurityContext trên ${snapshot.namespace}.`,
        testType: 'SECURITY_AUDIT',
        protocol: 'SECURITY_AUDIT',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: primaryPath,
        headers: {},
        virtualUsers: 5,
        durationSeconds: 10,
        rampUpSeconds: 2,
        targetNamespace: snapshot.namespace,
        targetWorkload: primaryWorkload,
        safetyAbortMemoryPercent: 85,
      })
    );

    return created;
  }

  // ============================================================================
  // TEST RUN HISTORY
  // ============================================================================
  public saveTestRun(run: TestRunRecord): void {
    const idx = this.data.testRuns.findIndex((r) => r.id === run.id);
    if (idx >= 0) {
      this.data.testRuns[idx] = run;
    } else {
      this.data.testRuns.unshift(run);
      // Keep latest 50 runs
      if (this.data.testRuns.length > 50) {
        this.data.testRuns = this.data.testRuns.slice(0, 50);
      }
    }
    this.saveToDisk();
  }

  public listTestRuns(clusterId?: string): TestRunRecord[] {
    if (!clusterId) return this.data.testRuns;
    return this.data.testRuns.filter((r) => r.clusterId === clusterId);
  }
}

export const storageRepo = new StorageRepository();

