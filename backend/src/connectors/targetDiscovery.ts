import * as k8s from '@kubernetes/client-node';
import {
  DiscoveredTopology,
  ResolvedContextVariables,
  TargetProfile,
} from '../types.js';

const INITIAL_TARGETS: TargetProfile[] = [
  {
    id: 'fumi-live-prod',
    name: 'fumi-live-prod (WebSocket + REST, K3s)',
    environment: 'production',
    connectionMode: 'hybrid-simulator',
    namespace: 'fumi-live-prod',
    availableNamespaces: ['fumi-live-prod', 'fumi-live-staging', 'kube-system', 'traefik'],
    clusterEndpoint: 'https://127.0.0.1:6443',
    externalUrl: 'https://fumifood.dpdns.org',
    wsEndpoint: 'wss://fumifood.dpdns.org/ws',
    sshTunnel: {
      enabled: true,
      host: '13.140.183.90',
      port: 22,
      user: 'root',
      localPort: 6443,
      remoteK8sPort: 6443,
      commandPreview: 'ssh -L 6443:127.0.0.1:6443 root@13.140.183.90',
      tunnelConnected: true,
    },
    kubeconfigContext: 'k3s-fumi-prod',
    authHeaderHint: 'Authorization: Bearer <JWT_SESSION_TOKEN>',
    description:
      'Hệ thống dịch thuật & phụ đề thời gian thực qua WebSocket Audio Stream + REST Gateway trên K3s.',
    tags: ['K3s', 'WebSocket Audio', 'Traefik Ingress', 'Node.js V8'],
    lastDiscoveredAt: new Date().toISOString(),
  },
  {
    id: 'fumirai-lunch-prod',
    name: 'fumirai-lunch-prod (SPA + NestJS API, K3s)',
    environment: 'production',
    connectionMode: 'hybrid-simulator',
    namespace: 'fumirai-lunch-prod',
    availableNamespaces: ['fumirai-lunch-prod', 'fumirai-lunch-staging', 'postgres-ha'],
    clusterEndpoint: 'https://127.0.0.1:6443',
    externalUrl: 'https://lunch.fumifood.dpdns.org',
    wsEndpoint: 'wss://lunch.fumifood.dpdns.org/ws',
    sshTunnel: {
      enabled: true,
      host: '13.140.183.90',
      port: 22,
      user: 'root',
      localPort: 6443,
      remoteK8sPort: 6443,
      commandPreview: 'ssh -L 6443:127.0.0.1:6443 root@13.140.183.90',
      tunnelConnected: true,
    },
    kubeconfigContext: 'k3s-fumi-prod',
    authHeaderHint: 'Authorization: Bearer <LUNCH_USER_JWT>',
    description:
      'Hệ thống đặt suất ăn nội bộ (SPA + NestJS API + PostgreSQL) với lưu lượng cao vào khung giờ cao điểm 10:30–11:30.',
    tags: ['K3s', 'NestJS REST', 'PostgreSQL', 'High Burst'],
    lastDiscoveredAt: new Date().toISOString(),
  },
  {
    id: 'fumi-live-staging',
    name: 'fumi-live-staging (Chaos & Pre-Release Lab)',
    environment: 'staging',
    connectionMode: 'hybrid-simulator',
    namespace: 'fumi-live-staging',
    availableNamespaces: ['fumi-live-staging', 'fumi-live-prod'],
    clusterEndpoint: 'https://127.0.0.1:6443',
    externalUrl: 'https://staging.fumifood.dpdns.org',
    wsEndpoint: 'wss://staging.fumifood.dpdns.org/ws',
    kubeconfigContext: 'k3s-fumi-staging',
    description:
      'Môi trường Staging phục vụ bắn tải cực hạn và kiểm chứng Cầu chì Tự ngắt (OOM Safety Circuit Breaker).',
    tags: ['Staging', 'Chaos Testing', 'Safety Breaker Verification'],
    lastDiscoveredAt: new Date().toISOString(),
  },
];

function buildContextVariables(
  host: string,
  baseUrl: string,
  wsUrl: string,
  namespace: string,
  workloadName: string,
  memoryLimitMi: number,
  v8HeapLimitMb: number,
  cpuLimitMillicores: number,
  replicas: number,
  maxSessions: number,
  rateLimitRps: number
): ResolvedContextVariables {
  const abortPercent = 85;
  const abortMemoryMi = Math.round((memoryLimitMi * abortPercent) / 100);
  return {
    'target.ingress.host': host,
    'target.ingress.baseUrl': baseUrl,
    'target.ingress.wsUrl': wsUrl,
    'target.namespace': namespace,
    'target.workload.name': workloadName,
    'target.workload.memoryLimitMi': memoryLimitMi,
    'target.workload.v8HeapLimitMb': v8HeapLimitMb,
    'target.workload.cpuLimitMillicores': cpuLimitMillicores,
    'target.workload.replicas': replicas,
    'target.safety.abortMemoryMi': abortMemoryMi,
    'target.safety.abortPercent': abortPercent,
    'target.config.MAX_SESSIONS': maxSessions,
    'target.middleware.rateLimitRps': rateLimitRps,
  };
}

const TOPOLOGY_PRESETS: Record<string, DiscoveredTopology> = {
  'fumi-live-prod': {
    targetId: 'fumi-live-prod',
    namespace: 'fumi-live-prod',
    ingressHost: 'fumifood.dpdns.org',
    tlsEnabled: true,
    routes: [
      {
        path: '/ws',
        pathType: 'Prefix',
        protocol: 'WSS',
        targetService: 'fumi-live-gateway-svc',
        targetPort: 8080,
        middlewares: ['traefik-rate-limit', 'ws-session-guard'],
        descriptionVi: 'Luồng WebSocket truyền âm thanh & nhận phụ đề trực tiếp',
      },
      {
        path: '/healthz',
        pathType: 'Exact',
        protocol: 'HTTPS',
        targetService: 'fumi-live-gateway-svc',
        targetPort: 8080,
        middlewares: ['traefik-security-headers'],
        descriptionVi: 'Điểm kiểm tra sức khỏe hệ thống (Liveness/Readiness Probe)',
      },
      {
        path: '/projects',
        pathType: 'Prefix',
        protocol: 'HTTPS',
        targetService: 'fumi-live-gateway-svc',
        targetPort: 8080,
        middlewares: ['traefik-rate-limit', 'traefik-security-headers', 'jwt-auth-guard'],
        descriptionVi: 'API quản lý dự án & phòng họp trực tuyến',
      },
      {
        path: '/auth',
        pathType: 'Prefix',
        protocol: 'HTTPS',
        targetService: 'fumi-live-gateway-svc',
        targetPort: 8080,
        middlewares: ['traefik-rate-limit', 'traefik-security-headers'],
        descriptionVi: 'API xác thực và cấp phát JWT Session Token',
      },
    ],
    shields: [
      {
        id: 'shield-cloudflare',
        name: 'Cloudflare WAF & DDoS Edge',
        layer: 'cloudflare-edge',
        type: 'security-headers',
        configSummary: 'TLS 1.3 Strict, Bot Fight Mode, Edge DDoS Protection',
        active: true,
        nonTechLabelVi: 'Lớp 1: Cổng An ninh Đám mây (Cloudflare)',
        nonTechDescVi: 'Chặn tấn công DDoS quy mô lớn và lọc bot tự động từ ngoài Internet.',
      },
      {
        id: 'shield-traefik-ratelimit',
        name: 'traefik-rate-limit (Middleware)',
        layer: 'traefik-ingress',
        type: 'rate-limit',
        configSummary: 'average: 100 req/s, burst: 150 req/s per IP (HTTP 429)',
        active: true,
        nonTechLabelVi: 'Lớp 2: Trạm Kiểm soát Lưu lượng (Traefik Rate-Limit)',
        nonTechDescVi: 'Tự động từ chối (mã 429) nếu một địa chỉ bắn quá 100 yêu cầu/giây.',
      },
      {
        id: 'shield-traefik-headers',
        name: 'traefik-security-headers (Middleware)',
        layer: 'traefik-ingress',
        type: 'security-headers',
        configSummary: 'HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff',
        active: true,
        nonTechLabelVi: 'Lớp 3: Khiên Chống Giả mạo Trình duyệt (Security Headers)',
        nonTechDescVi: 'Ngăn chặn nhúng trang trái phép (Clickjacking) và đánh cắp phiên.',
      },
      {
        id: 'shield-netpol',
        name: 'default-deny-all + allow-traefik-ingress',
        layer: 'k8s-network-policy',
        type: 'network-policy',
        configSummary: 'PodSelector: app=fumi-live-gateway | Ingress only from kube-system/traefik',
        active: true,
        nonTechLabelVi: 'Lớp 4: Tường lửa Nội bộ Cụm máy chủ (K8s NetworkPolicy)',
        nonTechDescVi: 'Cô lập hoàn toàn Pod ứng dụng; chỉ cho phép lưu lượng hợp lệ đi qua cổng Traefik.',
      },
      {
        id: 'shield-session-quota',
        name: 'App Gateway Session & Payload Guard',
        layer: 'app-gateway',
        type: 'session-quota',
        configSummary: 'MAX_SESSIONS=20 concurrent rooms, maxPayload=64KB, JWT Handshake Verify',
        active: true,
        nonTechLabelVi: 'Lớp 5: Giới hạn Phòng họp & Xác thực Phiên (MAX_SESSIONS=20)',
        nonTechDescVi: 'Kiểm soát số lượng phòng họp đồng thời và kích thước gói tin âm thanh để bảo vệ bộ nhớ.',
      },
      {
        id: 'shield-pod-pss',
        name: 'Pod Security Context & ResourceQuota',
        layer: 'pod-runtime',
        type: 'pod-security',
        configSummary: 'runAsNonRoot: true, readOnlyRootFilesystem: true, Memory Limit: 512Mi',
        active: true,
        nonTechLabelVi: 'Lớp 6: Két sắt Bảo vệ Máy chủ Ứng dụng (Pod Hardening)',
        nonTechDescVi: 'Chạy quyền tối thiểu (Non-Root), khóa ghi file hệ thống và giới hạn cứng 512MB RAM.',
      },
    ],
    serviceName: 'fumi-live-gateway-svc',
    servicePort: 8080,
    workload: {
      name: 'fumi-live-gateway',
      kind: 'Deployment',
      namespace: 'fumi-live-prod',
      replicas: 1,
      readyReplicas: 1,
      image: 'ghcr.io/fumirai/fumi-live-gateway:v2.4.1',
      memoryRequestMi: 256,
      memoryLimitMi: 512,
      v8HeapLimitMb: 320,
      cpuRequestMillicores: 250,
      cpuLimitMillicores: 1000,
      configEnv: {
        NODE_OPTIONS: '--max-old-space-size=320',
        MAX_SESSIONS: '20',
        WS_HEARTBEAT_INTERVAL_MS: '15000',
        MAX_PAYLOAD_BYTES: '65536',
      },
      securityContext: {
        runAsNonRoot: true,
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false,
      },
    },
    resourceQuota: {
      hardMemoryLimitMi: 1024,
      hardCpuLimitMillicores: 2000,
      maxPods: 4,
    },
    contextVariables: buildContextVariables(
      'fumifood.dpdns.org',
      'https://fumifood.dpdns.org',
      'wss://fumifood.dpdns.org/ws',
      'fumi-live-prod',
      'fumi-live-gateway',
      512,
      320,
      1000,
      1,
      20,
      100
    ),
  },
  'fumirai-lunch-prod': {
    targetId: 'fumirai-lunch-prod',
    namespace: 'fumirai-lunch-prod',
    ingressHost: 'lunch.fumifood.dpdns.org',
    tlsEnabled: true,
    routes: [
      {
        path: '/api/orders',
        pathType: 'Prefix',
        protocol: 'HTTPS',
        targetService: 'fumirai-lunch-api-svc',
        targetPort: 3000,
        middlewares: ['traefik-rate-limit', 'jwt-auth-guard'],
        descriptionVi: 'API đặt suất ăn trưa & chốt đơn theo phòng ban',
      },
      {
        path: '/api/menu',
        pathType: 'Prefix',
        protocol: 'HTTPS',
        targetService: 'fumirai-lunch-api-svc',
        targetPort: 3000,
        middlewares: ['traefik-rate-limit', 'traefik-security-headers'],
        descriptionVi: 'API danh sách thực đơn trong ngày',
      },
      {
        path: '/api/auth',
        pathType: 'Prefix',
        protocol: 'HTTPS',
        targetService: 'fumirai-lunch-api-svc',
        targetPort: 3000,
        middlewares: ['traefik-rate-limit'],
        descriptionVi: 'API đăng nhập nhân viên SSO/JWT',
      },
      {
        path: '/healthz',
        pathType: 'Exact',
        protocol: 'HTTPS',
        targetService: 'fumirai-lunch-api-svc',
        targetPort: 3000,
        middlewares: [],
        descriptionVi: 'Kiểm tra kết nối API & Database PostgreSQL',
      },
    ],
    shields: [
      {
        id: 'lunch-shield-cf',
        name: 'Cloudflare WAF & Edge Cache',
        layer: 'cloudflare-edge',
        type: 'security-headers',
        configSummary: 'TLS 1.3, Static SPA Caching, Bot Protection',
        active: true,
        nonTechLabelVi: 'Lớp 1: Cổng Đám mây Cloudflare',
        nonTechDescVi: 'Tăng tốc tải giao diện đặt cơm và chống truy cập bất thường.',
      },
      {
        id: 'lunch-shield-rl',
        name: 'traefik-rate-limit (250 req/s)',
        layer: 'traefik-ingress',
        type: 'rate-limit',
        configSummary: 'average: 250 req/s, burst: 400 req/s (HTTP 429)',
        active: true,
        nonTechLabelVi: 'Lớp 2: Điều tiết Lưu lượng Giờ Cao Điểm (250 req/s)',
        nonTechDescVi: 'Chống spam đặt đơn hàng loạt làm nghẽn cơ sở dữ liệu.',
      },
      {
        id: 'lunch-shield-netpol',
        name: 'netpol-allow-api-to-postgres',
        layer: 'k8s-network-policy',
        type: 'network-policy',
        configSummary: 'Isolates PostgreSQL; only fumirai-lunch-api Pods can connect to port 5432',
        active: true,
        nonTechLabelVi: 'Lớp 3: Tường lửa Bảo vệ Cơ sở dữ liệu (NetworkPolicy)',
        nonTechDescVi: 'Chỉ cho phép máy chủ API truy cập vào Database đơn hàng.',
      },
      {
        id: 'lunch-shield-pod',
        name: 'NestJS Pod Resource & Security Guard',
        layer: 'pod-runtime',
        type: 'pod-security',
        configSummary: 'replicas: 2, Memory Limit: 1024Mi, DB Pool Max: 40',
        active: true,
        nonTechLabelVi: 'Lớp 4: Cụm 2 Máy chủ Chạy Song song (Replicas: 2, 1GB RAM)',
        nonTechDescVi: 'Đảm bảo nếu 1 máy chủ quá tải thì máy chủ còn lại vẫn xử lý đơn bình thường.',
      },
    ],
    serviceName: 'fumirai-lunch-api-svc',
    servicePort: 3000,
    workload: {
      name: 'fumirai-lunch-api',
      kind: 'Deployment',
      namespace: 'fumirai-lunch-prod',
      replicas: 2,
      readyReplicas: 2,
      image: 'ghcr.io/fumirai/fumirai-lunch-api:v1.9.0',
      memoryRequestMi: 512,
      memoryLimitMi: 1024,
      v8HeapLimitMb: 768,
      cpuRequestMillicores: 500,
      cpuLimitMillicores: 1500,
      configEnv: {
        NODE_OPTIONS: '--max-old-space-size=768',
        MAX_SESSIONS: '150',
        DB_POOL_MAX: '40',
      },
      securityContext: {
        runAsNonRoot: true,
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false,
      },
    },
    resourceQuota: {
      hardMemoryLimitMi: 2048,
      hardCpuLimitMillicores: 3000,
      maxPods: 6,
    },
    contextVariables: buildContextVariables(
      'lunch.fumifood.dpdns.org',
      'https://lunch.fumifood.dpdns.org',
      'wss://lunch.fumifood.dpdns.org/ws',
      'fumirai-lunch-prod',
      'fumirai-lunch-api',
      1024,
      768,
      1500,
      2,
      150,
      250
    ),
  },
};

export class TargetDiscoveryManager {
  private targets: Map<string, TargetProfile> = new Map();
  private topologies: Map<string, DiscoveredTopology> = new Map();

  constructor() {
    for (const t of INITIAL_TARGETS) {
      this.targets.set(t.id, t);
    }
    this.topologies.set('fumi-live-prod', TOPOLOGY_PRESETS['fumi-live-prod']);
    this.topologies.set('fumirai-lunch-prod', TOPOLOGY_PRESETS['fumirai-lunch-prod']);

    const stagingTopo: DiscoveredTopology = JSON.parse(
      JSON.stringify(TOPOLOGY_PRESETS['fumi-live-prod'])
    );
    stagingTopo.targetId = 'fumi-live-staging';
    stagingTopo.namespace = 'fumi-live-staging';
    stagingTopo.ingressHost = 'staging.fumifood.dpdns.org';
    stagingTopo.contextVariables = buildContextVariables(
      'staging.fumifood.dpdns.org',
      'https://staging.fumifood.dpdns.org',
      'wss://staging.fumifood.dpdns.org/ws',
      'fumi-live-staging',
      'fumi-live-gateway',
      512,
      320,
      1000,
      1,
      20,
      100
    );
    this.topologies.set('fumi-live-staging', stagingTopo);
  }

  public listTargets(): TargetProfile[] {
    return Array.from(this.targets.values());
  }

  public getTarget(targetId: string): TargetProfile | undefined {
    return this.targets.get(targetId);
  }

  public getTopology(targetId: string): DiscoveredTopology {
    return (
      this.topologies.get(targetId) ||
      this.topologies.get('fumi-live-prod')!
    );
  }

  public async addOrUpdateTarget(input: {
    name: string;
    environment: 'production' | 'staging' | 'custom';
    connectionMode: TargetProfile['connectionMode'];
    namespace: string;
    externalUrl: string;
    sshTunnelCommand?: string;
    kubeconfigYaml?: string;
    memoryLimitMi?: number;
    maxSessions?: number;
    rateLimitRps?: number;
  }): Promise<{ target: TargetProfile; topology: DiscoveredTopology; liveK8sConnected: boolean }> {
    const id =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `target-${Date.now()}`;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.externalUrl.startsWith('http') ? input.externalUrl : `https://${input.externalUrl}`);
    } catch {
      parsedUrl = new URL('https://fumifood.dpdns.org');
    }

    const host = parsedUrl.host;
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${parsedUrl.host}/ws`;

    let liveK8sConnected = false;
    let discoveredMemMi = input.memoryLimitMi || 512;
    let discoveredWorkloadName = `${id}-gateway`;
    let discoveredReplicas = 1;

    if (input.kubeconfigYaml && input.kubeconfigYaml.trim().length > 20) {
      try {
        const kc = new k8s.KubeConfig();
        kc.loadFromString(input.kubeconfigYaml);
        const appsApi = kc.makeApiClient(k8s.AppsV1Api);
        const deployRes = await appsApi.listNamespacedDeployment(input.namespace || 'default');
        if (deployRes.body.items.length > 0) {
          const firstDeploy = deployRes.body.items[0];
          discoveredWorkloadName = firstDeploy.metadata?.name || discoveredWorkloadName;
          discoveredReplicas = firstDeploy.spec?.replicas || 1;
          const memLim =
            firstDeploy.spec?.template?.spec?.containers?.[0]?.resources?.limits?.['memory'];
          if (memLim && memLim.endsWith('Mi')) {
            discoveredMemMi = parseInt(memLim.replace('Mi', ''), 10) || discoveredMemMi;
          } else if (memLim && memLim.endsWith('Gi')) {
            discoveredMemMi = (parseInt(memLim.replace('Gi', ''), 10) || 1) * 1024;
          }
          liveK8sConnected = true;
        }
      } catch {
        liveK8sConnected = false;
      }
    }

    const target: TargetProfile = {
      id,
      name: input.name,
      environment: input.environment,
      connectionMode: input.connectionMode,
      namespace: input.namespace || 'default',
      availableNamespaces: [input.namespace || 'default', 'kube-system', 'traefik'],
      clusterEndpoint: 'https://127.0.0.1:6443',
      externalUrl: baseUrl,
      wsEndpoint: wsUrl,
      sshTunnel: input.sshTunnelCommand
        ? {
            enabled: true,
            host: '13.140.183.90',
            port: 22,
            user: 'root',
            localPort: 6443,
            remoteK8sPort: 6443,
            commandPreview: input.sshTunnelCommand,
            tunnelConnected: true,
          }
        : undefined,
      description: `Workspace kết nối theo chế độ ${input.connectionMode} (${baseUrl})`,
      tags: [input.connectionMode, input.namespace || 'default', host],
      lastDiscoveredAt: new Date().toISOString(),
    };

    const v8Heap = Math.round(discoveredMemMi * 0.65);
    const maxSessions = input.maxSessions || 20;
    const rateLimitRps = input.rateLimitRps || 100;

    const basePreset: DiscoveredTopology = JSON.parse(
      JSON.stringify(TOPOLOGY_PRESETS['fumi-live-prod'])
    );
    basePreset.targetId = id;
    basePreset.namespace = target.namespace;
    basePreset.ingressHost = host;
    basePreset.serviceName = `${discoveredWorkloadName}-svc`;
    basePreset.workload.name = discoveredWorkloadName;
    basePreset.workload.namespace = target.namespace;
    basePreset.workload.replicas = discoveredReplicas;
    basePreset.workload.readyReplicas = discoveredReplicas;
    basePreset.workload.memoryLimitMi = discoveredMemMi;
    basePreset.workload.v8HeapLimitMb = v8Heap;
    basePreset.workload.configEnv.MAX_SESSIONS = String(maxSessions);
    basePreset.workload.configEnv.NODE_OPTIONS = `--max-old-space-size=${v8Heap}`;
    basePreset.contextVariables = buildContextVariables(
      host,
      baseUrl,
      wsUrl,
      target.namespace,
      discoveredWorkloadName,
      discoveredMemMi,
      v8Heap,
      1000,
      discoveredReplicas,
      maxSessions,
      rateLimitRps
    );

    this.targets.set(id, target);
    this.topologies.set(id, basePreset);

    return { target, topology: basePreset, liveK8sConnected };
  }
}
