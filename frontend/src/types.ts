export type ConnectionMode = 'hybrid-simulator' | 'k8s-kubeconfig' | 'k8s-ssh-tunnel' | 'external-url';

export type ProtocolDriverType = 'http-rest' | 'ws-realtime' | 'k8s-manifest-audit';

export type HealthSignal = 'healthy' | 'warning' | 'critical' | 'blocked-safely';

export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  localPort: number;
  remoteK8sPort: number;
  commandPreview: string;
  tunnelConnected?: boolean;
}

export interface TargetProfile {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'custom';
  connectionMode: ConnectionMode;
  namespace: string;
  availableNamespaces: string[];
  clusterEndpoint: string;
  externalUrl: string;
  wsEndpoint?: string;
  sshTunnel?: SshTunnelConfig;
  kubeconfigContext?: string;
  authHeaderHint?: string;
  description: string;
  tags: string[];
  lastDiscoveredAt: string;
}

export interface IngressRouteInfo {
  path: string;
  pathType: 'Prefix' | 'Exact';
  protocol: 'HTTPS' | 'WSS';
  targetService: string;
  targetPort: number;
  middlewares: string[];
  descriptionVi: string;
}

export interface MiddlewareShieldInfo {
  id: string;
  name: string;
  layer: 'cloudflare-edge' | 'traefik-ingress' | 'k8s-network-policy' | 'app-gateway' | 'pod-runtime';
  type: 'rate-limit' | 'security-headers' | 'network-policy' | 'session-quota' | 'pod-security';
  configSummary: string;
  active: boolean;
  nonTechLabelVi: string;
  nonTechDescVi: string;
}

export interface WorkloadInfo {
  name: string;
  kind: 'Deployment' | 'StatefulSet';
  namespace: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  memoryRequestMi: number;
  memoryLimitMi: number;
  v8HeapLimitMb: number;
  cpuRequestMillicores: number;
  cpuLimitMillicores: number;
  configEnv: Record<string, string>;
  securityContext: {
    runAsNonRoot: boolean;
    readOnlyRootFilesystem: boolean;
    allowPrivilegeEscalation: boolean;
  };
}

export interface ResolvedContextVariables {
  'target.ingress.host': string;
  'target.ingress.baseUrl': string;
  'target.ingress.wsUrl': string;
  'target.namespace': string;
  'target.workload.name': string;
  'target.workload.memoryLimitMi': number;
  'target.workload.v8HeapLimitMb': number;
  'target.workload.cpuLimitMillicores': number;
  'target.workload.replicas': number;
  'target.safety.abortMemoryMi': number;
  'target.safety.abortPercent': number;
  'target.config.MAX_SESSIONS': number;
  'target.middleware.rateLimitRps': number;
  [key: string]: string | number;
}

export interface DiscoveredTopology {
  targetId: string;
  namespace: string;
  ingressHost: string;
  tlsEnabled: boolean;
  routes: IngressRouteInfo[];
  shields: MiddlewareShieldInfo[];
  serviceName: string;
  servicePort: number;
  workload: WorkloadInfo;
  resourceQuota: {
    hardMemoryLimitMi: number;
    hardCpuLimitMillicores: number;
    maxPods: number;
  };
  contextVariables: ResolvedContextVariables;
}

export interface ScenarioAssertion {
  id: string;
  layer: 'cloudflare-edge' | 'traefik-ingress' | 'k8s-network-policy' | 'app-gateway' | 'pod-runtime';
  titleVi: string;
  technicalCheck: string;
  expectedOutcome: string;
}

export interface ScenarioPack {
  id: string;
  name: string;
  category: 'load-testing' | 'security-verification' | 'chaos-safety';
  protocolDrivers: ProtocolDriverType[];
  compatibleTargets: string[];
  summaryVi: string;
  technicalDescription: string;
  durationSeconds: number;
  templateConfig: {
    endpointTemplate: string;
    maxVirtualUsers: number;
    rampUpSeconds: number;
    targetRps: number;
    payloadType: 'binary-audio-chunks' | 'json-rest' | 'security-probe-suite';
    safetyAbortAtMemoryPercent: number;
    dynamicVariablesUsed: string[];
  };
  assertions: ScenarioAssertion[];
  yamlManifestPreview: string;
}

export interface ExternalTestMetrics {
  activeVirtualUsers: number;
  activeWsSessions: number;
  currentRps: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  status2xxPerSec: number;
  status429RateLimitedPerSec: number;
  status401or403BlockedPerSec: number;
  status5xxErrorPerSec: number;
}

export interface InternalClusterTelemetry {
  podName: string;
  podStatus: 'Running' | 'Pending' | 'OOMKilled' | 'CrashLoopBackOff' | 'Throttled';
  podMemoryMi: number;
  podMemoryLimitMi: number;
  podMemoryPercent: number;
  v8HeapUsedMb: number;
  v8HeapLimitMb: number;
  podCpuMillicores: number;
  podCpuLimitMillicores: number;
  podCpuPercent: number;
  nodeMemoryPercent: number;
  restartCount: number;
  gcPauseMs: number;
  recentK8sEvent: string;
  recentPodLog: string;
}

export interface SecurityCheckResult {
  id: string;
  layer: 'cloudflare-edge' | 'traefik-ingress' | 'k8s-network-policy' | 'app-gateway' | 'pod-runtime';
  layerNameVi: string;
  attackNameVi: string;
  rawProbe: string;
  httpStatusOrK8sState: string;
  blockedRatePercent: number;
  status: 'passed' | 'warning' | 'failed';
  nonTechExplanationVi: string;
}

export interface ActionableRecommendation {
  id: string;
  severity: 'high' | 'medium' | 'info';
  targetComponent: string;
  titleVi: string;
  nonTechImpactVi: string;
  engineerFixSnippet: string;
}

export interface SafetyCircuitBreakerState {
  armed: boolean;
  tripped: boolean;
  trippedAtSecond?: number;
  reactionTimeMs?: number;
  thresholdPercent: number;
  thresholdMemoryMi: number;
  reasonVi?: string;
  technicalReason?: string;
}

export interface CorrelatedTick {
  timestamp: string;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  external: ExternalTestMetrics;
  internal: InternalClusterTelemetry;
  nodeStates: {
    edgeStatus: HealthSignal;
    ingressStatus: HealthSignal;
    networkPolicyStatus: HealthSignal;
    serviceStatus: HealthSignal;
    podStatus: HealthSignal;
  };
  correlation: {
    bottleneckLayer: 'none' | 'traefik-ingress-shield' | 'app-session-quota' | 'pod-memory-saturation' | 'safety-circuit-breaker';
    headlineVi: string;
    engineerDiagnosis: string;
    nonTechDiagnosisVi: string;
    userExperiencePreview: {
      simulatedSubtitleDelayMs: number;
      sampleSpokenTextVi: string;
      sampleDisplayedTextVi: string;
      experienceLabelVi: string;
      capacityUsersSafe: number;
      capacityUsersCurrent: number;
    };
  };
}

export interface ActiveTestRunState {
  runId: string;
  targetId: string;
  scenarioId: string;
  scenarioName: string;
  category: ScenarioPack['category'];
  executionMode: 'hybrid-physics-correlator' | 'live-http-ws-probe';
  status: 'idle' | 'running' | 'completed' | 'aborted-by-circuit-breaker';
  startedAt?: string;
  completedAt?: string;
  safetyBreaker: SafetyCircuitBreakerState;
  latestTick: CorrelatedTick;
  history: CorrelatedTick[];
  securityResults: SecurityCheckResult[];
  overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  recommendations: ActionableRecommendation[];
}
