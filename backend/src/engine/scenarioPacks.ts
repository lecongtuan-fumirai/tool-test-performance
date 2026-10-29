import { DiscoveredTopology, ScenarioPack } from '../types.js';

export const BUILTIN_SCENARIO_PACKS: ScenarioPack[] = [
  {
    id: 'ws-realtime-capacity-ramp',
    name: '1. [Load] Chịu tải Luồng WebSocket & Giới hạn Phiên (WS Stream + Session Quota)',
    category: 'load-testing',
    protocolDrivers: ['ws-realtime', 'http-rest'],
    compatibleTargets: ['*'],
    summaryVi:
      'Tăng dần lượng người dùng truyền luồng âm thanh/dữ liệu thời gian thực qua WebSocket để tìm ngưỡng trễ phụ đề và kiểm tra giới hạn MAX_SESSIONS={{target.config.MAX_SESSIONS}}.',
    technicalDescription:
      'Bắn kết nối WSS đồng thời vào {{target.ingress.wsUrl}} kèm binary frames (16kHz PCM chunk) + REST polling vào {{target.ingress.baseUrl}}/projects. Đối chiếu độ trễ p95/p99 với V8 Heap ({{target.workload.v8HeapLimitMb}}MB) và Pod RAM ({{target.workload.memoryLimitMi}}Mi).',
    durationSeconds: 24,
    templateConfig: {
      endpointTemplate: '{{target.ingress.wsUrl}}',
      maxVirtualUsers: 800,
      rampUpSeconds: 18,
      targetRps: 90,
      payloadType: 'binary-audio-chunks',
      safetyAbortAtMemoryPercent: 85,
      dynamicVariablesUsed: [
        '{{target.ingress.wsUrl}}',
        '{{target.workload.memoryLimitMi}}',
        '{{target.workload.v8HeapLimitMb}}',
        '{{target.config.MAX_SESSIONS}}',
        '{{target.safety.abortMemoryMi}}',
      ],
    },
    assertions: [
      {
        id: 'assert-ws-latency',
        layer: 'app-gateway',
        titleVi: 'Độ trễ truyền nhận (Latency p95) dưới 450ms ở mức tải chuẩn',
        technicalCheck: 'ws_rtt_p95_ms < 450 @ VU <= 500',
        expectedOutcome: 'Phụ đề/phản hồi hiển thị mượt mà dưới 0.5 giây',
      },
      {
        id: 'assert-session-cap',
        layer: 'app-gateway',
        titleVi: 'Bảo vệ hạn mức phòng họp (MAX_SESSIONS = {{target.config.MAX_SESSIONS}})',
        technicalCheck: 'active_rooms <= {{target.config.MAX_SESSIONS}} (excess rejected with 429/1013 Try Again Later)',
        expectedOutcome: 'Từ chối gọn các phòng vượt ngưỡng, không làm rớt các phòng đang họp',
      },
      {
        id: 'assert-pod-heap',
        layer: 'pod-runtime',
        titleVi: 'Bộ nhớ Pod dưới ngưỡng Cầu chì An toàn ({{target.safety.abortMemoryMi}}Mi / {{target.workload.memoryLimitMi}}Mi)',
        technicalCheck: 'container_memory_working_set_bytes < {{target.safety.abortMemoryMi}}Mi',
        expectedOutcome: 'Pod không bị OOMKilled, Garbage Collector thu hồi bộ nhớ ổn định',
      },
    ],
    yamlManifestPreview: `apiVersion: kubepulse.io/v1alpha1
kind: ScenarioPack
metadata:
  id: ws-realtime-capacity-ramp
  drivers: [ws-realtime, http-rest]
spec:
  target:
    wsEndpoint: "{{target.ingress.wsUrl}}"
    restEndpoint: "{{target.ingress.baseUrl}}/projects"
  stages:
    - duration: 8s
      targetUsers: 300
    - duration: 10s
      targetUsers: 650
    - duration: 6s
      targetUsers: 800
  assertions:
    maxActiveSessions: {{target.config.MAX_SESSIONS}}
  safetyCircuitBreaker:
    enabled: true
    maxPodMemoryMi: {{target.safety.abortMemoryMi}} # 85% of {{target.workload.memoryLimitMi}}Mi
    maxReactionMs: 500`,
  },
  {
    id: 'ingress-rate-limit-spike',
    name: '2. [Load + Shield] Đột biến Lưu lượng Cửa ngõ (Traefik Rate-Limit vs Pod Stability)',
    category: 'load-testing',
    protocolDrivers: ['http-rest'],
    compatibleTargets: ['*'],
    summaryVi:
      'Bắn lưu lượng đột biến gấp 3 lần giới hạn cửa ngõ ({{target.middleware.rateLimitRps}} req/s) để chứng minh Traefik Ingress chặn đứng lũ request bên ngoài mà RAM/CPU của Pod bên trong vẫn phẳng lặng.',
    technicalDescription:
      'Tạo Spike 320 RPS vào {{target.ingress.baseUrl}}/auth và /projects vượt ngưỡng Middleware traefik-rate-limit ({{target.middleware.rateLimitRps}} req/s). Đối chiếu tỷ lệ HTTP 429 ở ngoài và mức CPU/RAM thực tế của Pod {{target.workload.name}}.',
    durationSeconds: 20,
    templateConfig: {
      endpointTemplate: '{{target.ingress.baseUrl}}/projects',
      maxVirtualUsers: 500,
      rampUpSeconds: 6,
      targetRps: 320,
      payloadType: 'json-rest',
      safetyAbortAtMemoryPercent: 85,
      dynamicVariablesUsed: [
        '{{target.ingress.baseUrl}}',
        '{{target.middleware.rateLimitRps}}',
        '{{target.workload.name}}',
      ],
    },
    assertions: [
      {
        id: 'assert-traefik-429',
        layer: 'traefik-ingress',
        titleVi: 'Traefik Middleware tự động cắt lưu lượng vượt {{target.middleware.rateLimitRps}} req/s (HTTP 429)',
        technicalCheck: 'http_status_429_rate > 60% when incoming_rps > {{target.middleware.rateLimitRps}}',
        expectedOutcome: 'Tầng cửa ngõ hấp thụ toàn bộ đợt tấn công lũ quét',
      },
      {
        id: 'assert-pod-calm',
        layer: 'pod-runtime',
        titleVi: 'Máy chủ ứng dụng ({{target.workload.name}}) bình an vô sự',
        technicalCheck: 'pod_memory_delta < 15% && pod_restart_count == 0',
        expectedOutcome: 'Người dùng hợp lệ đã kết nối từ trước không bị giật lag',
      },
    ],
    yamlManifestPreview: `apiVersion: kubepulse.io/v1alpha1
kind: ScenarioPack
metadata:
  id: ingress-rate-limit-spike
  drivers: [http-rest]
spec:
  target:
    endpoint: "{{target.ingress.baseUrl}}/projects"
  loadProfile:
    spikeRps: 320
    expectedIngressLimitRps: {{target.middleware.rateLimitRps}}
  correlationRule:
    expectExternal429: true
    expectInternalPodMemoryBelowPercent: 55`,
  },
  {
    id: 'multi-layer-security-verification',
    name: '3. [Security] Kiểm toán Khiên Bảo mật 6 Tầng (Outside-In Attack + Inside-Out K8s Audit)',
    category: 'security-verification',
    protocolDrivers: ['http-rest', 'ws-realtime', 'k8s-manifest-audit'],
    compatibleTargets: ['*'],
    summaryVi:
      'Thực hiện đồng thời các mũi tấn công giả lập từ bên ngoài (Unauthenticated WS, Origin Spoofing, Flood, Oversize Payload) và kiểm toán cấu hình K8s bên trong (NetworkPolicy, Non-Root, ReadOnlyFS).',
    technicalDescription:
      'Kiểm chứng 6 lớp phòng thủ trên {{target.ingress.host}} và Namespace {{target.namespace}}: Cloudflare WAF -> Traefik Middleware -> K8s NetworkPolicy -> JWT/Session Guard -> Pod Security Context.',
    durationSeconds: 18,
    templateConfig: {
      endpointTemplate: '{{target.ingress.baseUrl}}',
      maxVirtualUsers: 120,
      rampUpSeconds: 5,
      targetRps: 140,
      payloadType: 'security-probe-suite',
      safetyAbortAtMemoryPercent: 85,
      dynamicVariablesUsed: [
        '{{target.ingress.host}}',
        '{{target.namespace}}',
        '{{target.workload.name}}',
        '{{target.config.MAX_SESSIONS}}',
      ],
    },
    assertions: [
      {
        id: 'sec-ws-unauth',
        layer: 'app-gateway',
        titleVi: 'Chặn kết nối WebSocket không có Token xác thực (Unauthenticated Handshake)',
        technicalCheck: 'WSS {{target.ingress.wsUrl}} without JWT -> HTTP 401 / WS Close 1008',
        expectedOutcome: 'Chặn 100% kết nối nghe lén trái phép',
      },
      {
        id: 'sec-oversize-payload',
        layer: 'app-gateway',
        titleVi: 'Chặn gói tin âm thanh/JSON khổng lồ làm tràn bộ nhớ (Payload Bomb > 64KB)',
        technicalCheck: 'Send 2MB binary frame -> WS Close 1009 Message Too Big',
        expectedOutcome: 'Ngắt kết nối độc hại ngay lập tức, bảo vệ V8 Heap',
      },
      {
        id: 'sec-k8s-netpol',
        layer: 'k8s-network-policy',
        titleVi: 'Cô lập mạng nội bộ bằng K8s NetworkPolicy (Default Deny All)',
        technicalCheck: 'NetworkPolicy in {{target.namespace}} enforces Ingress only from traefik',
        expectedOutcome: 'Ngăn chặn tấn công leo thang ngang (Lateral Movement) giữa các Pod',
      },
      {
        id: 'sec-k8s-pss',
        layer: 'pod-runtime',
        titleVi: 'Khóa quyền Root & khóa ghi File hệ thống trên Pod {{target.workload.name}}',
        technicalCheck: 'runAsNonRoot == true && readOnlyRootFilesystem == true',
        expectedOutcome: 'Kẻ tấn công không thể cài mã độc hay chiếm quyền điều khiển máy chủ',
      },
    ],
    yamlManifestPreview: `apiVersion: kubepulse.io/v1alpha1
kind: ScenarioPack
metadata:
  id: multi-layer-security-verification
  drivers: [http-rest, ws-realtime, k8s-manifest-audit]
spec:
  targetHost: "{{target.ingress.host}}"
  namespace: "{{target.namespace}}"
  probes:
    - name: unauth-ws-handshake
      expectStatus: 401
    - name: origin-csrf-spoof
      expectStatus: 403
    - name: oversize-frame-2mb
      expectWsCloseCode: 1009
    - name: k8s-manifest-hardening
      verify: [NetworkPolicy, runAsNonRoot, readOnlyRootFilesystem, ResourceQuota]`,
  },
  {
    id: 'oom-safety-circuit-breaker-test',
    name: '4. [Chaos & Safety] Bắn tải Cực hạn & Kiểm chứng Cầu chì Tự ngắt (< 500ms Auto-Abort)',
    category: 'chaos-safety',
    protocolDrivers: ['ws-realtime', 'http-rest'],
    compatibleTargets: ['*'],
    summaryVi:
      'Cố tình ép tải bộ nhớ Pod tiến sát ngưỡng nguy hiểm 85% ({{target.safety.abortMemoryMi}}Mi / {{target.workload.memoryLimitMi}}Mi) để kiểm chứng Cầu chì An toàn tự động ngắt bài test trước khi Pod bị sập (OOMKilled).',
    technicalDescription:
      'Bắn luồng binary buffer liên tục vào {{target.workload.name}} để ép V8 Heap và RSS tăng nhanh. Khi K8s Metrics báo RAM >= {{target.safety.abortMemoryMi}}Mi (85%), Safety Circuit Breaker lập tức ngắt toàn bộ Worker trong < 500ms.',
    durationSeconds: 20,
    templateConfig: {
      endpointTemplate: '{{target.ingress.wsUrl}}',
      maxVirtualUsers: 1200,
      rampUpSeconds: 10,
      targetRps: 220,
      payloadType: 'binary-audio-chunks',
      safetyAbortAtMemoryPercent: 85,
      dynamicVariablesUsed: [
        '{{target.workload.name}}',
        '{{target.workload.memoryLimitMi}}',
        '{{target.safety.abortMemoryMi}}',
        '{{target.safety.abortPercent}}',
      ],
    },
    assertions: [
      {
        id: 'safety-trip-85',
        layer: 'pod-runtime',
        titleVi: 'Kích hoạt Cầu chì Tự ngắt ngay khi RAM chạm {{target.safety.abortPercent}}% ({{target.safety.abortMemoryMi}}Mi)',
        technicalCheck: 'abort_triggered == true when pod_memory_mi >= {{target.safety.abortMemoryMi}}',
        expectedOutcome: 'Ngắt tải chủ động trong < 500ms, giữ cho Pod sống 100% (RestartCount = 0)',
      },
    ],
    yamlManifestPreview: `apiVersion: kubepulse.io/v1alpha1
kind: ScenarioPack
metadata:
  id: oom-safety-circuit-breaker-test
  drivers: [ws-realtime]
spec:
  workload: "{{target.workload.name}}"
  memoryLimitMi: {{target.workload.memoryLimitMi}}
  safetyCircuitBreaker:
    triggerAtPercent: {{target.safety.abortPercent}}
    triggerAtMemoryMi: {{target.safety.abortMemoryMi}}
    maxAbortLatencyMs: 500`,
  },
];

export function interpolateTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export function resolveScenarioForTopology(
  scenario: ScenarioPack,
  topology: DiscoveredTopology
): ScenarioPack {
  const vars = topology.contextVariables;
  return {
    ...scenario,
    summaryVi: interpolateTemplate(scenario.summaryVi, vars),
    technicalDescription: interpolateTemplate(scenario.technicalDescription, vars),
    templateConfig: {
      ...scenario.templateConfig,
      endpointTemplate: interpolateTemplate(scenario.templateConfig.endpointTemplate, vars),
    },
    assertions: scenario.assertions.map((a) => ({
      ...a,
      titleVi: interpolateTemplate(a.titleVi, vars),
      technicalCheck: interpolateTemplate(a.technicalCheck, vars),
      expectedOutcome: interpolateTemplate(a.expectedOutcome, vars),
    })),
    yamlManifestPreview: interpolateTemplate(scenario.yamlManifestPreview, vars),
  };
}
