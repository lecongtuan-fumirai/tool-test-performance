export type ConnectionType = 'local-kubeconfig' | 'imported-kubeconfig' | 'external-url';

export type EnvironmentType = 'production' | 'staging' | 'development';

export interface ClusterConnectionPublic {
  id: string;
  name: string;
  environment: EnvironmentType;
  connectionType: ConnectionType;
  hasKubeconfig: boolean;
  kubeContext?: string;
  externalBaseUrl: string;
  sshTunnelHint?: string;
  createdAt: string;
  lastCheckedAt?: string;
  status: 'connected' | 'disconnected' | 'unverified';
  k8sVersion?: string;
  apiLatencyMs?: number;
  statusMessage?: string;
}

export interface DiscoveredIngressRoute {
  ingressName: string;
  host: string;
  tlsEnabled: boolean;
  path: string;
  pathType: string;
  protocol: 'HTTPS' | 'HTTP' | 'WSS';
  serviceName: string;
  servicePort: number | string;
  annotations: Record<string, string>;
}

export interface DiscoveredPodMetric {
  podName: string;
  phase: string;
  ready: boolean;
  restartCount: number;
  nodeName: string;
  podIp: string;
  cpuMillicores: number | null;
  memoryMi: number | null;
  ageSeconds: number;
}

export interface DiscoveredWorkload {
  name: string;
  kind: 'Deployment' | 'StatefulSet';
  replicas: number;
  readyReplicas: number;
  image: string;
  memoryRequestMi: number | null;
  memoryLimitMi: number | null;
  cpuRequestMillicores: number | null;
  cpuLimitMillicores: number | null;
  envKeys: string[];
  securityContext: {
    runAsNonRoot: boolean;
    readOnlyRootFilesystem: boolean;
    allowPrivilegeEscalation: boolean;
  };
  pods: DiscoveredPodMetric[];
}

export interface DiscoveredService {
  name: string;
  type: string;
  clusterIp: string;
  ports: Array<{ name?: string; port: number; targetPort: number | string; protocol: string }>;
  selector: Record<string, string>;
}

export interface DiscoveredNetworkPolicy {
  name: string;
  podSelector: Record<string, string>;
  policyTypes: string[];
  ingressRulesCount: number;
  egressRulesCount: number;
}

export interface NamespaceTopologySnapshot {
  clusterId: string;
  namespace: string;
  discoveredAt: string;
  k8sConnected: boolean;
  metricsServerAvailable: boolean;
  errorMessage?: string;
  ingresses: DiscoveredIngressRoute[];
  services: DiscoveredService[];
  workloads: DiscoveredWorkload[];
  networkPolicies: DiscoveredNetworkPolicy[];
}

export type ScenarioProtocol = 'HTTP' | 'WEBSOCKET' | 'SECURITY_AUDIT';

export type PerformanceTestType =
  | 'LOAD_TEST'
  | 'STRESS_TEST'
  | 'SPIKE_TEST'
  | 'SOAK_ENDURANCE_TEST'
  | 'SCALABILITY_TEST'
  | 'VOLUME_TEST'
  | 'SECURITY_DAST'
  | 'SECURITY_API'
  | 'SECURITY_AUTH'
  | 'SECURITY_INFRA'
  | 'SECURITY_PENTEST'
  | 'SECURITY_AUDIT';

export interface TestScenario {
  id: string;
  clusterId: string;
  name: string;
  description: string;
  testType?: PerformanceTestType;
  protocol: ScenarioProtocol;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  targetBaseUrl: string;
  targetPath: string;
  headers: Record<string, string>;
  requestBody?: string;
  virtualUsers: number;
  peakVirtualUsers?: number;
  volumePayloadKb?: number;
  targetPodReplicas?: number;
  durationSeconds: number;
  rampUpSeconds: number;
  targetNamespace: string;
  targetWorkload?: string;
  safetyAbortMemoryPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveRunTick {
  elapsedSeconds: number;
  timestamp: string;
  stageLabel?: string;
  external: {
    activeWorkers: number;
    requestsPerSec: number;
    totalRequests: number;
    throughputKbps?: number;
    latencyAvgMs: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    status2xx: number;
    status401_403: number;
    status429: number;
    status5xx: number;
    networkErrors: number;
  };
  internal: {
    metricsAvailable: boolean;
    podCount: number;
    primaryPodName: string;
    podPhase: string;
    totalCpuMillicores: number | null;
    totalMemoryMi: number | null;
    memoryLimitMi: number | null;
    memoryUsagePercent: number | null;
    restartCount: number;
    recentEvent: string;
    recentLogLine: string;
  };
}

export type SecurityDomainCategory =
  | 'DAST'
  | 'API_SECURITY'
  | 'AUTH_RBAC'
  | 'INFRA_SCAN'
  | 'PENTEST_CHAIN'
  | 'EDGE_TLS_HEADERS'
  | 'AUTH_ACCESS'
  | 'CORS_ORIGIN'
  | 'K8S_NETPOL'
  | 'K8S_POD_SECURITY';

export interface SecurityAuditFinding {
  id: string;
  category: SecurityDomainCategory;
  automationLevel?: 'Có (Tự động 100%)' | 'Một phần (Bán tự động)';
  titleVi: string;
  technicalCheck: string;
  observedResult: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  nonTechExplanationVi: string;
  remediationVi: string;
}

export interface SpecializedTestInsights {
  testType: PerformanceTestType;
  breakingPointVu?: number | null;
  spikeRecoverySeconds?: number | null;
  memoryDriftMi?: number | null;
  rpsPerPod?: number | null;
  minPodsObserved?: number;
  maxPodsObserved?: number;
  totalVolumeMbProcessed?: number | null;
}

export interface TestRunRecord {
  id: string;
  scenarioId: string;
  scenarioName: string;
  testType?: PerformanceTestType;
  clusterId: string;
  clusterName: string;
  namespace: string;
  targetWorkload?: string;
  protocol: ScenarioProtocol;
  targetUrl: string;
  status: 'idle' | 'running' | 'completed' | 'aborted-by-safety' | 'failed';
  startedAt: string;
  finishedAt?: string;
  virtualUsers: number;
  peakVirtualUsers?: number;
  durationSeconds: number;
  safetyBreaker: {
    armed: boolean;
    thresholdPercent: number;
    thresholdMemoryMi: number | null;
    tripped: boolean;
    trippedReasonVi?: string;
    trippedTechnical?: string;
  };
  latestTick: LiveRunTick;
  ticks: LiveRunTick[];
  securityFindings: SecurityAuditFinding[];
  specializedInsights?: SpecializedTestInsights;
  evaluation: {
    grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    headlineVi: string;
    nonTechSummaryVi: string;
    engineerSummary: string;
    recommendationsVi: string[];
  };
}
