import React from 'react';
import {
  Activity,
  Shield,
  Server,
  Cpu,
  Zap,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  ActiveTestRunState,
  DiscoveredTopology,
  HealthSignal,
} from '../types';

interface LiveTopologyCanvasProps {
  topology: DiscoveredTopology;
  runState: ActiveTestRunState;
  viewMode: 'engineer' | 'nontech';
  selectedNode: string;
  onSelectNode: (nodeId: string) => void;
}

function getStatusBadge(signal: HealthSignal, viewMode: 'engineer' | 'nontech') {
  switch (signal) {
    case 'healthy':
      return {
        border: 'border-emerald-500/60 bg-emerald-950/20',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.12)]',
        dot: 'bg-emerald-400',
        text: 'text-emerald-300',
        label: viewMode === 'engineer' ? 'NOMINAL / HEALTHY' : 'Thông suốt (An toàn)',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      };
    case 'blocked-safely':
      return {
        border: 'border-cyan-400 bg-cyan-950/30',
        glow: 'shadow-[0_0_25px_rgba(34,211,238,0.22)]',
        dot: 'bg-cyan-400 animate-ping',
        text: 'text-cyan-200',
        label:
          viewMode === 'engineer'
            ? 'SHIELD ACTIVE (429/403 DROP)'
            : 'Khiên đang chặn tấn công!',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />,
      };
    case 'warning':
      return {
        border: 'border-amber-500/80 bg-amber-950/30',
        glow: 'shadow-[0_0_25px_rgba(245,158,11,0.2)]',
        dot: 'bg-amber-400 animate-pulse',
        text: 'text-amber-200',
        label: viewMode === 'engineer' ? 'HIGH PRESSURE / QUOTA' : 'Chậm nhịp (Sắp chạm trần)',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
      };
    case 'critical':
      return {
        border: 'border-rose-500 bg-rose-950/40',
        glow: 'shadow-[0_0_30px_rgba(244,63,94,0.3)]',
        dot: 'bg-rose-500 animate-ping',
        text: 'text-rose-200',
        label: viewMode === 'engineer' ? 'SATURATED / BOTTLENECK' : 'Nghẽn tải tại đây!',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
      };
  }
}

export const LiveTopologyCanvas: React.FC<LiveTopologyCanvasProps> = ({
  topology,
  runState,
  viewMode,
  selectedNode,
  onSelectNode,
}) => {
  const tick = runState.latestTick;
  const isRunning = runState.status === 'running';
  const breakerTripped = runState.safetyBreaker.tripped;

  const ingressBadge = getStatusBadge(tick.nodeStates.ingressStatus, viewMode);
  const netpolBadge = getStatusBadge(tick.nodeStates.networkPolicyStatus, viewMode);
  const serviceBadge = getStatusBadge(tick.nodeStates.serviceStatus, viewMode);
  const podBadge = getStatusBadge(tick.nodeStates.podStatus, viewMode);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 relative overflow-hidden">
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${
          breakerTripped
            ? 'border-amber-500/70 bg-amber-950/40 text-amber-100'
            : tick.nodeStates.podStatus === 'critical'
            ? 'border-rose-500/70 bg-rose-950/40 text-rose-100'
            : tick.nodeStates.ingressStatus === 'blocked-safely'
            ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-100'
            : 'border-emerald-500/40 bg-emerald-950/25 text-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isRunning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
            }`}
          />
          <span className="text-xs font-semibold tracking-wide">
            {tick.correlation.headlineVi}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="rounded bg-slate-950/70 px-2 py-0.5 font-mono text-slate-300 border border-slate-700/70">
            Target: <strong className="text-cyan-300">{topology.ingressHost}</strong> ({topology.namespace})
          </span>
          <span className="rounded bg-slate-950/70 px-2 py-0.5 font-mono text-slate-300 border border-slate-700/70">
            Time: {tick.elapsedSeconds}s / {tick.totalDurationSeconds}s
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch relative">
        <div
          onClick={() => onSelectNode('runner')}
          className={`cursor-pointer rounded-xl border p-3.5 transition relative flex flex-col justify-between ${
            selectedNode === 'runner'
              ? 'ring-2 ring-cyan-400 border-cyan-500 bg-slate-900'
              : 'border-slate-700/80 bg-slate-950/70 hover:border-slate-600'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                {viewMode === 'engineer' ? '1. Outside-In Runner' : '1. Đoàn Khách / Tác nhân Test'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                OUTSIDE-IN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">
              {viewMode === 'engineer'
                ? `Active Drivers: WS + REST -> ${topology.ingressHost}`
                : 'Giả lập người dùng thật và các mũi tấn công thử nghiệm từ Internet'}
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-900/90 p-2.5 border border-slate-800 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Virtual Users (VU):' : 'Số người đang vào:'}
              </span>
              <span className="font-mono font-bold text-white">
                {tick.external.activeVirtualUsers} người
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Throughput (RPS):' : 'Tốc độ gửi yêu cầu:'}
              </span>
              <span className="font-mono font-semibold text-cyan-300">
                {tick.external.currentRps} req/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Latency p95:' : 'Độ trễ phản hồi:'}
              </span>
              <span
                className={`font-mono font-semibold ${
                  tick.external.latencyP95Ms > 1000
                    ? 'text-rose-400'
                    : tick.external.latencyP95Ms > 400
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {tick.external.latencyP95Ms} ms
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => onSelectNode('ingress')}
          className={`cursor-pointer rounded-xl border p-3.5 transition relative flex flex-col justify-between ${
            ingressBadge.border
          } ${ingressBadge.glow} ${
            selectedNode === 'ingress' ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-white">
                <Shield className="w-4 h-4 text-cyan-400" />
                {viewMode === 'engineer' ? '2. Traefik Ingress & WAF' : '2. Cổng An ninh & Điều tiết'}
              </span>
              {ingressBadge.icon}
            </div>
            <div className={`text-[11px] font-medium mb-2 ${ingressBadge.text}`}>
              {ingressBadge.label}
            </div>
            <p className="text-[11px] text-slate-300/90 mb-2">
              {viewMode === 'engineer'
                ? `Host: ${topology.ingressHost} (${topology.routes.length} routes) | Limit: ${topology.contextVariables['target.middleware.rateLimitRps']} req/s`
                : `Kiểm tra thẻ ra vào, chặn spam vượt quá ${topology.contextVariables['target.middleware.rateLimitRps']} yêu cầu/giây`}
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-950/80 p-2.5 border border-slate-800/80 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Passed (HTTP 200):' : 'Cho phép đi qua:'}
              </span>
              <span className="font-mono font-semibold text-emerald-400">
                {tick.external.status2xxPerSec}/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Rate-Limited (429):' : 'Chặn quá tải (429):'}
              </span>
              <span
                className={`font-mono font-bold ${
                  tick.external.status429RateLimitedPerSec > 0
                    ? 'text-cyan-300'
                    : 'text-slate-500'
                }`}
              >
                {tick.external.status429RateLimitedPerSec}/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'WAF/Auth Drop (401/403):' : 'Chặn xâm nhập:'}
              </span>
              <span
                className={`font-mono font-bold ${
                  tick.external.status401or403BlockedPerSec > 0
                    ? 'text-amber-300'
                    : 'text-slate-500'
                }`}
              >
                {tick.external.status401or403BlockedPerSec}/s
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => onSelectNode('netpol')}
          className={`cursor-pointer rounded-xl border p-3.5 transition relative flex flex-col justify-between ${
            netpolBadge.border
          } ${netpolBadge.glow} ${
            selectedNode === 'netpol' ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-white">
                <Lock className="w-4 h-4 text-emerald-400" />
                {viewMode === 'engineer'
                  ? '3. K8s NetworkPolicy'
                  : '3. Tường lửa Nội bộ Cụm'}
              </span>
              {netpolBadge.icon}
            </div>
            <div className={`text-[11px] font-medium mb-2 ${netpolBadge.text}`}>
              {netpolBadge.label}
            </div>
            <p className="text-[11px] text-slate-300/90 mb-2">
              {viewMode === 'engineer'
                ? `Policy: default-deny-all | Namespace: ${topology.namespace}`
                : 'Cô lập hoàn toàn máy chủ; chỉ nhận lưu lượng sạch từ Cổng số 2'}
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-950/80 p-2.5 border border-slate-800/80 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Ingress Policy:' : 'Chế độ cô lập:'}
              </span>
              <span className="font-mono text-emerald-300 font-semibold">Strict Whitelist</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Lateral Attack:' : 'Xâm nhập ngang:'}
              </span>
              <span className="font-mono text-emerald-400 font-semibold">Chặn 100%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Service Port:' : 'Cổng kết nối:'}
              </span>
              <span className="font-mono text-slate-300">:{topology.servicePort}</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => onSelectNode('service')}
          className={`cursor-pointer rounded-xl border p-3.5 transition relative flex flex-col justify-between ${
            serviceBadge.border
          } ${serviceBadge.glow} ${
            selectedNode === 'service' ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-white">
                <Activity className="w-4 h-4 text-purple-400" />
                {viewMode === 'engineer'
                  ? '4. App Session Guard'
                  : '4. Quản lý Phòng họp & Phiên'}
              </span>
              {serviceBadge.icon}
            </div>
            <div className={`text-[11px] font-medium mb-2 ${serviceBadge.text}`}>
              {serviceBadge.label}
            </div>
            <p className="text-[11px] text-slate-300/90 mb-2">
              {viewMode === 'engineer'
                ? `Service: ${topology.serviceName} | MAX_SESSIONS=${topology.contextVariables['target.config.MAX_SESSIONS']}`
                : `Kiểm soát tối đa ${topology.contextVariables['target.config.MAX_SESSIONS']} phòng hoạt động cùng lúc & giới hạn gói tin 64KB`}
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-950/80 p-2.5 border border-slate-800/80 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Active WS Rooms:' : 'Số phòng đang mở:'}
              </span>
              <span className="font-mono font-bold text-white">
                {tick.external.activeWsSessions} /{' '}
                {topology.contextVariables['target.config.MAX_SESSIONS']}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'Max Payload Guard:' : 'Chặn gói tin quá khổ:'}
              </span>
              <span className="font-mono text-emerald-400 font-semibold">&lt;= 64 KB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'JWT Handshake:' : 'Xác thực Token:'}
              </span>
              <span className="font-mono text-emerald-400 font-semibold">Bắt buộc (100%)</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => onSelectNode('pod')}
          className={`cursor-pointer rounded-xl border p-3.5 transition relative flex flex-col justify-between ${
            podBadge.border
          } ${podBadge.glow} ${
            selectedNode === 'pod' ? 'ring-2 ring-cyan-400' : ''
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-white">
                <Cpu className="w-4 h-4 text-rose-400" />
                {viewMode === 'engineer'
                  ? `5. Pod: ${topology.workload.name}`
                  : '5. Máy chủ Ứng dụng (Lõi Pod)'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/40">
                INSIDE-OUT K8S
              </span>
            </div>
            <div className={`text-[11px] font-medium mb-2 ${podBadge.text}`}>
              {podBadge.label}
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-slate-950/90 p-2.5 border border-slate-800 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">
                  {viewMode === 'engineer' ? 'Pod RAM (RSS / Limit):' : 'Bộ nhớ Máy chủ (RAM):'}
                </span>
                <span className="font-mono font-bold text-white">
                  {tick.internal.podMemoryMi}Mi / {tick.internal.podMemoryLimitMi}Mi (
                  {tick.internal.podMemoryPercent}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-300 z-10"
                  style={{ left: '85%' }}
                  title="Ngưỡng Cầu chì Tự ngắt An toàn (85%)"
                />
                <div
                  className={`h-full transition-all duration-300 ${
                    tick.internal.podMemoryPercent >= 80
                      ? 'bg-rose-500'
                      : tick.internal.podMemoryPercent >= 65
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, tick.internal.podMemoryPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>V8 Heap: {tick.internal.v8HeapUsedMb}/{tick.internal.v8HeapLimitMb}MB</span>
                <span className="text-amber-300 font-mono">
                  Cầu chì 85%: {topology.contextVariables['target.safety.abortMemoryMi']}Mi
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">
                {viewMode === 'engineer' ? 'CPU / Replicas:' : 'Sức mạnh CPU / Số máy:'}
              </span>
              <span className="font-mono text-slate-200">
                {tick.internal.podCpuMillicores}m ({topology.workload.replicas} Pod)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Nhấp vào bất kỳ khối kiến trúc nào ở trên để xem cấu hình K8s khám phá tự động & biến ngữ cảnh{' '}
            <code className="text-cyan-300">{'{{target.*}}'}</code>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Thông suốt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Khiên đang chặn (429/403)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Chạm ngưỡng Quota
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Nghẽn tải / Đầy RAM
          </span>
        </div>
      </div>
    </div>
  );
};
