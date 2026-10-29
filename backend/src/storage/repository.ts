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
   * Dynamically generates starter scenarios based on REAL discovered Ingresses & Workloads
   * in a namespace (Zero hardcode!).
   */
  public generateScenariosFromTopology(
    cluster: ClusterConnection,
    snapshot: NamespaceTopologySnapshot
  ): TestScenario[] {
    const created: TestScenario[] = [];
    const primaryWorkload = snapshot.workloads[0]?.name || '';
    const firstIngress = snapshot.ingresses[0];
    const baseUrl = firstIngress
      ? `${firstIngress.tlsEnabled ? 'https' : 'http'}://${firstIngress.host}`
      : cluster.externalBaseUrl || 'https://localhost';

    // 1. Create HTTP Load scenario for each discovered HTTP route (up to 2)
    const httpRoutes = snapshot.ingresses.filter((r) => r.protocol !== 'WSS').slice(0, 2);
    if (httpRoutes.length === 0) {
      created.push(
        this.saveScenario({
          clusterId: cluster.id,
          name: `[HTTP Load] Kiểm thử Chịu tải Endpoint (${snapshot.namespace})`,
          description: `Bắn tải HTTP thực tế vào ${baseUrl} và đối chiếu RAM/CPU của Pod ${primaryWorkload || 'trong namespace'}`,
          protocol: 'HTTP',
          method: 'GET',
          targetBaseUrl: baseUrl,
          targetPath: '/healthz',
          headers: {},
          virtualUsers: 20,
          durationSeconds: 15,
          rampUpSeconds: 5,
          targetNamespace: snapshot.namespace,
          targetWorkload: primaryWorkload,
          safetyAbortMemoryPercent: 85,
        })
      );
    } else {
      for (const route of httpRoutes) {
        created.push(
          this.saveScenario({
            clusterId: cluster.id,
            name: `[HTTP Load] Kiểm thử Chịu tải ${route.path} (${route.serviceName})`,
            description: `Bắn tải HTTP GET thực tế vào https://${route.host}${route.path} và giám sát Pod ${primaryWorkload}`,
            protocol: 'HTTP',
            method: 'GET',
            targetBaseUrl: `${route.tlsEnabled ? 'https' : 'http'}://${route.host}`,
            targetPath: route.path,
            headers: {},
            virtualUsers: 25,
            durationSeconds: 15,
            rampUpSeconds: 5,
            targetNamespace: snapshot.namespace,
            targetWorkload: primaryWorkload,
            safetyAbortMemoryPercent: 85,
          })
        );
      }
    }

    // 2. If a WebSocket route exists, create a WebSocket scenario
    const wsRoute = snapshot.ingresses.find(
      (r) => r.protocol === 'WSS' || r.path.includes('ws')
    );
    if (wsRoute) {
      created.push(
        this.saveScenario({
          clusterId: cluster.id,
          name: `[WebSocket] Kiểm thử Kết nối Thời gian thực ${wsRoute.path}`,
          description: `Mở các phiên kết nối WebSocket thực tế tới wss://${wsRoute.host}${wsRoute.path}`,
          protocol: 'WEBSOCKET',
          method: 'GET',
          targetBaseUrl: `${wsRoute.tlsEnabled ? 'wss' : 'ws'}://${wsRoute.host}`,
          targetPath: wsRoute.path,
          headers: {},
          virtualUsers: 15,
          durationSeconds: 15,
          rampUpSeconds: 5,
          targetNamespace: snapshot.namespace,
          targetWorkload: primaryWorkload,
          safetyAbortMemoryPercent: 85,
        })
      );
    }

    // 3. Create a Real Security & K8s Manifest Audit Scenario for this namespace
    created.push(
      this.saveScenario({
        clusterId: cluster.id,
        name: `[Security Audit] Kiểm toán Bảo mật Cửa ngõ & K8s (${snapshot.namespace})`,
        description: `Kiểm tra thực tế Security Headers, CORS, Auth và kiểm toán NetworkPolicy + Pod SecurityContext trên ${snapshot.namespace}`,
        protocol: 'SECURITY_AUDIT',
        method: 'GET',
        targetBaseUrl: baseUrl,
        targetPath: httpRoutes[0]?.path || '/healthz',
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

