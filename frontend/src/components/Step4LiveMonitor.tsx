import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Square,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  FileText,
  Terminal,
  Copy,
  Check,
  History,
  ArrowLeft,
  ArrowRight,
  Globe,
  Database,
  Flame,
  Zap,
  Layers,
  Key,
  FileCode,
  X,
  Users,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  NamespaceTopologySnapshot,
  TestRunRecord,
  LiveRunTick,
} from '../types';

interface Step4LiveMonitorProps {
  activeRun: TestRunRecord | null;
  runsHistory: TestRunRecord[];
  topology?: NamespaceTopologySnapshot | null;
  onSelectRun: (run: TestRunRecord) => void;
  onStopRun: () => Promise<void>;
  onRerunScenario: (scenarioId: string) => Promise<void>;
  onBackToScenarios: () => void;
}

// "How it's wired" Interactive Live Diagram Component with Clear Actors
const HowItsWiredDiagram: React.FC<{
  currentRun: TestRunRecord;
  latestTick: LiveRunTick | null;
  topology?: NamespaceTopologySnapshot | null;
  breakingPointVu: number | null;
}> = ({ currentRun, latestTick, topology, breakingPointVu }) => {
  const [selectedNode, setSelectedNode] = useState<
    'CLIENT' | 'INGRESS' | 'SERVICE' | 'DEPLOYMENT' | 'POD_1' | 'POD_2' | 'SECRET' | 'CONFIGMAP' | null
  >(null);

  const ext = latestTick?.external;
  const k8s = latestTick?.internal;
  const memPct = k8s?.memoryUsagePercent ?? null;
  const cpuPct = k8s?.cpuUsagePercent ?? null;
  const isRunning = currentRun.status === 'running';

  // Derived metadata from scenario and topology
  const targetHost = currentRun.targetUrl
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
    .split('/')[0] || 'fumifood.dpdns.org';
  const targetPath = '/' + (currentRun.targetUrl.split('/').slice(3).join('/') || 'ws');

  const matchedIng = topology?.ingresses.find(
    (i) => i.host.includes(targetHost) || targetHost.includes(i.host)
  ) || topology?.ingresses[0];

  const matchedSvc = topology?.services.find(
    (s) => s.name === matchedIng?.serviceName
  ) || topology?.services[0];

  const matchedWorkload = topology?.workloads.find(
    (w) => w.name === currentRun.targetWorkload
  ) || topology?.workloads[0];

  const serviceName = matchedSvc?.name || 'backend';
  const servicePort = matchedSvc?.ports?.[0]?.port || 3001;
  const deploymentName = matchedWorkload?.name || currentRun.targetWorkload || 'fumirai-lunch-backend';
  const secretName = `${deploymentName}-secrets`;
  const configmapName = `${deploymentName}-config`;

  const primaryPod = k8s?.primaryPodName || (matchedWorkload?.pods?.[0]?.podName) || `${deploymentName}-4vnrx`;
  const secondaryPod = matchedWorkload?.pods?.[1]?.podName || `${deploymentName}-5ptz7`;
  const podCount = k8s?.podCount || matchedWorkload?.replicas || 2;

  // Breaking point detection flags
  const hasRateLimit429 = (ext?.status429 || 0) > 0;
  const hasOOMKilled = Boolean(k8s?.oomKilledDetected);
  const hasHighPressure = (memPct !== null && memPct >= 85) || (cpuPct !== null && cpuPct >= 85);
  const hasHttp5xx = (ext?.status5xx || 0) > 0 || (ext?.networkErrors || 0) > 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-4 sm:p-5 relative shadow-xl overflow-hidden">
      {/* Header with clear title, Breaking Point badge and user hint */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 mb-4 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Sơ đồ Kết nối & Luồng Requests (How it's wired)
          </h3>

          {breakingPointVu ? (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              ĐIỂM GÃY TẠI: {breakingPointVu} USERS
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Trực quan 5 Tác nhân
            </span>
          )}

          {hasOOMKilled && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse font-bold flex items-center gap-1">
              🚨 SẬP POD: OOMKILLED
            </span>
          )}
          {hasRateLimit429 && !hasOOMKilled && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-bold flex items-center gap-1">
              ⚠️ CHẶN TẢI: INGRESS 429
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 font-mono inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          Bấm vào từng khối để xem chi tiết tác nhân
        </span>
      </div>

      {/* Main Node Diagram Area */}
      <div className="relative overflow-x-auto py-2">
        <div className="min-w-[940px] flex items-center justify-between gap-3 relative py-4">

          {/* TÁC NHÂN 1: NGƯỜI DÙNG (CLIENTS / LOAD ENGINE) */}
          <div
            onClick={() => setSelectedNode('CLIENT')}
            className={`w-44 rounded-xl border p-3 cursor-pointer transition-all shrink-0 bg-[#0e172a] relative z-10 ${selectedNode === 'CLIENT'
              ? 'border-indigo-400 shadow-lg shadow-indigo-950/60 ring-2 ring-indigo-400'
              : 'border-slate-700/80 hover:border-indigo-400 hover:shadow-md'
              }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold mb-1">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> 1. NGƯỜI DÙNG
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            </div>
            <div className="text-xs font-bold text-white truncate" title="Khách truy cập mô phỏng">
              Khách Truy Cập (VUs)
            </div>
            <div className="text-[11px] font-mono text-slate-300 mt-1 space-y-0.5">
              <div className="text-indigo-300 font-bold">{ext?.activeWorkers || 0} người đang vào</div>
              <div className="text-slate-400 text-[10px]">{ext?.requestsPerSec || 0} yêu cầu/giây</div>
            </div>
          </div>

          {/* DÂY NỐI 1: NGƯỜI DÙNG -> CỔNG INGRESS */}
          <div className="flex-1 flex flex-col items-center justify-center relative min-w-[40px]">
            <svg className="w-full h-8 overflow-visible" preserveAspectRatio="none" viewBox="0 0 60 20">
              <line
                x1="0"
                y1="10"
                x2="60"
                y2="10"
                stroke={hasRateLimit429 ? '#f59e0b' : isRunning ? '#06b6d4' : '#475569'}
                strokeWidth={hasRateLimit429 ? '3' : '2'}
                className={hasRateLimit429 ? 'animate-traffic-flow-error' : isRunning ? 'animate-traffic-flow-fast' : ''}
              />
            </svg>
            {hasRateLimit429 && (
              <span className="absolute -top-2 text-[9px] font-mono font-bold text-amber-400 bg-amber-950 px-1 py-0.2 rounded border border-amber-500/40 animate-pulse whitespace-nowrap">
                Chặn 429
              </span>
            )}
          </div>

          {/* TÁC NHÂN 2: CỔNG AN NINH & INGRESS */}
          <div
            onClick={() => setSelectedNode('INGRESS')}
            className={`w-48 rounded-xl border p-3 cursor-pointer transition-all shrink-0 bg-[#0e172a] relative z-10 ${hasRateLimit429
              ? 'border-amber-400 shadow-lg shadow-amber-950/60 ring-2 ring-amber-400/80 bg-amber-950/20'
              : selectedNode === 'INGRESS'
                ? 'border-cyan-400 shadow-lg shadow-cyan-950/60 ring-2 ring-cyan-400'
                : 'border-slate-700/80 hover:border-cyan-400'
              }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-bold text-amber-300">
                <Globe className="w-3.5 h-3.5" /> 2. CỔNG INGRESS
              </span>
              {hasRateLimit429 ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ) : (
                <span className="text-[9px] text-emerald-400">TLS OK</span>
              )}
            </div>
            <div className="text-xs font-bold text-white truncate" title={targetHost}>
              {targetHost}
            </div>
            <div className="text-[11px] font-mono mt-1">
              {hasRateLimit429 ? (
                <div className="text-amber-400 font-bold animate-pulse text-[10px]">
                  ⚠️ Đã cắt {ext?.status429} lượt (429)
                </div>
              ) : (
                <div className="text-emerald-400 text-[10px]">✓ Cho phép lưu thông</div>
              )}
            </div>
          </div>

          {/* DÂY NỐI 2: INGRESS -> SERVICE */}
          <div className="flex-1 flex flex-col items-center justify-center relative min-w-[40px]">
            <svg className="w-full h-8 overflow-visible" preserveAspectRatio="none" viewBox="0 0 60 20">
              <line
                x1="0"
                y1="10"
                x2="60"
                y2="10"
                stroke={hasHttp5xx ? '#f43f5e' : isRunning ? '#10b981' : '#475569'}
                strokeWidth="2"
                className={hasHttp5xx ? 'animate-traffic-flow-error' : isRunning ? 'animate-traffic-flow' : ''}
              />
            </svg>
          </div>

          {/* TÁC NHÂN 3: BỘ CHIA TẢI NỘI BỘ (SERVICE) */}
          <div
            onClick={() => setSelectedNode('SERVICE')}
            className={`w-44 rounded-xl border p-3 cursor-pointer transition-all shrink-0 bg-[#0e172a] relative z-10 ${hasHttp5xx
              ? 'border-rose-500 shadow-lg shadow-rose-950/60'
              : selectedNode === 'SERVICE'
                ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-400'
                : 'border-slate-700/80 hover:border-indigo-400'
              }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-bold text-indigo-300">
                <Database className="w-3.5 h-3.5" /> 3. BỘ CHIA TẢI
              </span>
              <span className="text-[9px] text-slate-400">ClusterIP</span>
            </div>
            <div className="text-xs font-bold text-white truncate" title={`${serviceName}:${servicePort}`}>
              {serviceName}:{servicePort}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
              <span>1 endpoint</span>
              {hasHttp5xx ? (
                <span className="text-rose-400 font-bold">5xx: {ext?.status5xx}</span>
              ) : (
                <span className="text-emerald-400">Thông suốt</span>
              )}
            </div>
          </div>

          {/* DÂY NỐI 3: SERVICE -> DEPLOYMENT */}
          <div className="flex-1 flex flex-col items-center justify-center relative min-w-[40px]">
            <svg className="w-full h-8 overflow-visible" preserveAspectRatio="none" viewBox="0 0 60 20">
              <line
                x1="0"
                y1="10"
                x2="60"
                y2="10"
                stroke={hasOOMKilled ? '#f43f5e' : isRunning ? '#10b981' : '#475569'}
                strokeWidth="2"
                className={hasOOMKilled ? 'animate-traffic-flow-error' : isRunning ? 'animate-traffic-flow' : ''}
              />
            </svg>
          </div>

          {/* TÁC NHÂN 4: BỘ QUẢN LÝ MÁY CHỦ (DEPLOYMENT KÈM SECRET/CONFIGMAP) */}
          <div className="flex flex-col items-center gap-2 relative">
            {/* Nhánh Trên: SECRET */}
            <div
              onClick={() => setSelectedNode('SECRET')}
              className={`w-40 rounded-xl border p-2 cursor-pointer transition-all bg-[#0e172a] text-left relative z-10 ${selectedNode === 'SECRET'
                ? 'border-indigo-400 shadow-md ring-2 ring-indigo-400'
                : 'border-slate-700/80 hover:border-slate-500'
                }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1 font-bold text-amber-300">
                  <Key className="w-3 h-3" /> KHÓA BẢO MẬT
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-200 truncate" title={secretName}>
                {secretName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">mounted / env</div>
            </div>

            {/* Đường nét đứt nối Secret */}
            <div className="w-0.5 h-2.5 border-l-2 border-dashed border-slate-600" />

            {/* Khối chính: DEPLOYMENT */}
            <div
              onClick={() => setSelectedNode('DEPLOYMENT')}
              className={`w-48 rounded-xl border p-3 cursor-pointer transition-all bg-[#0e172a] relative z-10 ${hasOOMKilled
                ? 'border-rose-500 shadow-lg shadow-rose-950/80 ring-2 ring-rose-500/60 bg-rose-950/20'
                : selectedNode === 'DEPLOYMENT'
                  ? 'border-emerald-400 shadow-lg ring-2 ring-emerald-400'
                  : 'border-slate-700/80 hover:border-emerald-400'
                }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                <span className="flex items-center gap-1 font-bold text-emerald-300">
                  <Cpu className="w-3.5 h-3.5" /> 4. ĐIỀU PHỐI PODS
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate" title={deploymentName}>
                {deploymentName}
              </div>
              <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                <span className={hasOOMKilled ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {hasOOMKilled ? 'Cảnh báo Pod sập' : `${podCount}/${podCount} Pods sống`}
                </span>
                <span className="text-slate-400 text-[9px]">Tự phục hồi</span>
              </div>
            </div>

            {/* Đường nét đứt nối ConfigMap */}
            <div className="w-0.5 h-2.5 border-l-2 border-dashed border-slate-600" />

            {/* Nhánh Dưới: CONFIGMAP */}
            <div
              onClick={() => setSelectedNode('CONFIGMAP')}
              className={`w-40 rounded-xl border p-2 cursor-pointer transition-all bg-[#0e172a] text-left relative z-10 ${selectedNode === 'CONFIGMAP'
                ? 'border-indigo-400 shadow-md ring-2 ring-indigo-400'
                : 'border-slate-700/80 hover:border-slate-500'
                }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1 font-bold text-sky-300">
                  <FileCode className="w-3 h-3" /> CẤU HÌNH (ENV)
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-200 truncate" title={configmapName}>
                {configmapName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">1 keys cấu hình</div>
            </div>
          </div>

          {/* DÂY NGOẶC CONG ( { ) NỐI SANG TỪNG POD MÁY CHỦ */}
          <div className="flex items-center justify-center w-10 relative">
            <svg className="w-10 h-36 overflow-visible" viewBox="0 0 40 144" fill="none">
              <path
                d="M 0 72 C 20 72, 20 28, 40 28"
                stroke={hasOOMKilled ? '#f43f5e' : isRunning ? '#10b981' : '#475569'}
                strokeWidth={hasOOMKilled ? '2.5' : '2'}
                fill="none"
                className={hasOOMKilled ? 'animate-traffic-flow-error' : isRunning ? 'animate-traffic-flow' : ''}
              />
              <path
                d="M 0 72 C 20 72, 20 116, 40 116"
                stroke={isRunning ? '#10b981' : '#475569'}
                strokeWidth="2"
                fill="none"
                className={isRunning ? 'animate-traffic-flow' : ''}
              />
            </svg>
          </div>

          {/* TÁC NHÂN 5: CÁC MÁY CHỦ POD THỰC TẾ (NƠI XỬ LÝ LOGIC / GÁY NGHẼN) */}
          <div className="flex flex-col gap-3 shrink-0">
            {/* POD 1 (POD ĐÍCH KIỂM THỬ CHÍNH) */}
            <div
              onClick={() => setSelectedNode('POD_1')}
              className={`w-52 rounded-xl border p-2.5 cursor-pointer transition-all bg-[#0e172a] relative z-10 ${hasOOMKilled
                ? 'border-rose-500 shadow-xl shadow-rose-950 ring-2 ring-rose-500 animate-pod-shake bg-rose-950/30'
                : hasHighPressure
                  ? 'border-amber-400 shadow-md ring-2 ring-amber-400'
                  : selectedNode === 'POD_1'
                    ? 'border-emerald-400 ring-2 ring-emerald-400'
                    : 'border-slate-700/80 hover:border-emerald-400'
                }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-0.5">
                <span className="font-bold text-emerald-400">5. POD MÁY CHỦ #1</span>
                {hasOOMKilled ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                    🚨 SẬP DO CẠN RAM!
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <div className="text-[11px] font-mono font-bold text-white truncate" title={primaryPod}>
                ...{primaryPod.slice(-7)}
              </div>
              <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                <span className={hasOOMKilled ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                  {hasOOMKilled ? 'OOMKilled (Exit 137) 💥' : k8s?.podPhase || 'Đang xử lý'}
                </span>
                <span className="text-slate-300">
                  RAM: {k8s?.totalMemoryMi ?? 0}M {memPct !== null ? `(${memPct}%)` : ''}
                </span>
              </div>
            </div>

            {/* POD 2 (REPLICA) */}
            <div
              onClick={() => setSelectedNode('POD_2')}
              className={`w-52 rounded-xl border p-2.5 cursor-pointer transition-all bg-[#0e172a] relative z-10 ${selectedNode === 'POD_2'
                ? 'border-emerald-400 ring-2 ring-emerald-400'
                : 'border-slate-700/80 hover:border-emerald-400'
                }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-0.5">
                <span className="font-semibold text-slate-300">POD MÁY CHỦ #2</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[11px] font-mono font-bold text-white truncate" title={secondaryPod}>
                ...{secondaryPod.slice(-7)}
              </div>
              <div className="text-[10px] font-mono mt-1 flex items-center justify-between">
                <span className="text-emerald-400 font-semibold">Running</span>
                <span className="text-slate-400">Dự phòng</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSPECTION MODAL DRAWER ("Bấm vào từng khối để xem chi tiết tác nhân") */}
      {selectedNode && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 animate-in fade-in duration-150 relative">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="font-bold text-white flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
              Chi tiết Tác nhân: {selectedNode}
            </span>
          </div>

          {selectedNode === 'CLIENT' && (
            <div className="space-y-1 font-mono text-[11px]">
              <div>Vai trò: <strong className="text-white">Giả lập người dùng thật đang gửi yêu cầu liên tục vào hệ thống</strong></div>
              <div>Người dùng đồng thời: <strong className="text-indigo-300">{ext?.activeWorkers || 0} VUs</strong></div>
              <div>Tốc độ gửi: <strong className="text-cyan-300">{ext?.requestsPerSec || 0} req/s</strong> (Tổng đã gửi: {ext?.totalRequests || 0})</div>
            </div>
          )}

          {selectedNode === 'INGRESS' && (
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex flex-wrap gap-4">
                <div>Host Domain: <strong className="text-cyan-300">{targetHost}</strong></div>
                <div>Đường dẫn (Path): <strong className="text-white">{targetPath}</strong></div>
                <div>Mã hóa TLS: <strong className="text-emerald-400">Bật</strong></div>
              </div>
              <div className="text-slate-300">
                {hasRateLimit429
                  ? `⚠️ Tường lửa / Ingress đã chủ động chặn ${ext?.status429} yêu cầu quá tải (HTTP 429) để bảo vệ máy chủ bên trong.`
                  : '✓ Không có chặn tải (Mã 429: 0). Cổng an ninh đang mở cho mọi yêu cầu hợp lệ.'}
              </div>
            </div>
          )}

          {selectedNode === 'SERVICE' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              <div>Tên Service: <strong className="text-white">{serviceName}</strong></div>
              <div>Cổng kết nối: <strong className="text-white">{servicePort} / TCP</strong></div>
              <div>Nhiệm vụ: <strong className="text-slate-300">Cân bằng tải nội bộ vào các Pods</strong></div>
            </div>
          )}

          {selectedNode === 'DEPLOYMENT' && (
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex flex-wrap gap-4">
                <div>Deployment: <strong className="text-white">{deploymentName}</strong></div>
                <div>Số lượng Pods: <strong className="text-emerald-300">{podCount} pods</strong></div>
                <div>Hạn mức RAM tối đa: <strong className="text-sky-300">{k8s?.memoryLimitMi ? `${k8s.memoryLimitMi} MiB` : 'Chưa đặt giới hạn'}</strong></div>
                <div>Hạn mức CPU tối đa: <strong className="text-amber-300">{k8s?.cpuLimitMillicores ? `${k8s.cpuLimitMillicores}m` : 'Chưa đặt giới hạn'}</strong></div>
              </div>
            </div>
          )}

          {(selectedNode === 'POD_1' || selectedNode === 'POD_2') && (
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex flex-wrap gap-3">
                <div>Tên Pod: <strong className="text-white">{selectedNode === 'POD_1' ? primaryPod : secondaryPod}</strong></div>
                <div>Trạng thái: <strong className={hasOOMKilled && selectedNode === 'POD_1' ? 'text-rose-400' : 'text-emerald-400'}>{hasOOMKilled && selectedNode === 'POD_1' ? 'Bị tiêu diệt do cạn RAM (OOMKilled Exit Code 137)' : 'Khỏe mạnh (Running)'}</strong></div>
                <div>RAM Thực tế: <strong className="text-sky-300">{k8s?.totalMemoryMi ?? 0} MiB ({memPct ?? 0}%)</strong></div>
                <div>CPU Thực tế: <strong className="text-amber-300">{k8s?.totalCpuMillicores ?? 0}m ({cpuPct ?? 0}%)</strong></div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                Dòng Log Pod mới nhất: <span className="text-emerald-300">{k8s?.recentLogLine || 'Chưa có dòng log mới.'}</span>
              </div>
            </div>
          )}

          {(selectedNode === 'SECRET' || selectedNode === 'CONFIGMAP') && (
            <div className="font-mono text-[11px]">
              Tên tài nguyên: <strong className="text-white">{selectedNode === 'SECRET' ? secretName : configmapName}</strong> (Tự động nạp các biến môi trường và mật khẩu vào Pod khi khởi động)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Summary Popup Modal when test finishes
const TestSummaryModal: React.FC<{
  currentRun: TestRunRecord;
  breakingPointVu: number | null;
  safeCapacityVu: number | null;
  onClose: () => void;
  onCopyMarkdown: () => void;
  copied: boolean;
  onRerun: () => void;
}> = ({ currentRun, breakingPointVu, safeCapacityVu, onClose, onCopyMarkdown, copied, onRerun }) => {
  const ev = currentRun.evaluation;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="max-w-2xl w-full rounded-2xl border border-slate-800 bg-[#0e172a] shadow-2xl p-6 space-y-4 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-900 border border-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header with Grade */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shrink-0 shadow-lg ${ev.grade.startsWith('A')
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/20'
              : ev.grade === 'B'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-indigo-500/20'
                : ev.grade === 'C'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-amber-500/20'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-rose-500/20'
              }`}
          >
            {ev.grade}
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Tổng kết Phiên Kiểm Thử: {currentRun.scenarioName}
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {ev.headlineVi}
            </h2>
          </div>
        </div>

        {/* PROMINENT BREAKING POINT SECTION IN MODAL */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/60 to-slate-900 border-2 border-rose-500/60 space-y-1 shadow-md">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
            KẾT QUẢ ĐIỂM GÃY HỆ THỐNG (BREAKING POINT):
          </div>
          <div className="text-base font-bold text-white">
            {breakingPointVu ? (
              <span>Hệ thống đạt điểm gãy / chặn quá tải tại: <strong className="text-rose-400 font-black">{breakingPointVu} Users đồng thời</strong></span>
            ) : (
              <span className="text-emerald-300">✓ Vượt qua an toàn toàn bộ ngưỡng kiểm thử ({currentRun.virtualUsers} Users)</span>
            )}
          </div>
          <p className="text-xs text-slate-300">
            {breakingPointVu ? (
              <span>
                Hệ thống bắt đầu suy giảm hiệu năng hoặc gặp lỗi chặn 429 khi vượt qua {breakingPointVu} VUs.
                {safeCapacityVu && (
                  <span> Ngưỡng an toàn nên cấu hình Auto-scaling (HPA): <strong className="text-emerald-400">&lt; {safeCapacityVu} Users</strong>.</span>
                )}
              </span>
            ) : (
              'Không phát hiện sụp đổ hay chặn tải trong phạm vi kịch bản này.'
            )}
          </p>
        </div>

        {/* Non-tech Summary */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
          {ev.nonTechSummaryVi}
        </div>

        {/* 4 Core Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-mono">TỔNG REQUESTS</div>
            <div className="text-lg font-bold text-white mt-1">
              {currentRun.latestTick?.external?.totalRequests || 0}
            </div>
            <div className="text-[10px] text-indigo-300">
              Đỉnh: {currentRun.virtualUsers} VUs
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-mono">ĐỘ TRỄ P95</div>
            <div className="text-lg font-bold text-amber-300 mt-1">
              {currentRun.latestTick?.external?.latencyP95Ms || 0} ms
            </div>
            <div className="text-[10px] text-slate-400">
              TB: {currentRun.latestTick?.external?.latencyAvgMs || 0} ms
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-mono">CHẶN TẢI (429)</div>
            <div className="text-lg font-bold text-amber-400 mt-1">
              {currentRun.latestTick?.external?.status429 || 0}
            </div>
            <div className="text-[10px] text-slate-400">
              Thành công: {currentRun.latestTick?.external?.status2xx || 0}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-mono">RAM POD CAO NHẤT</div>
            <div className="text-lg font-bold text-sky-400 mt-1">
              {currentRun.latestTick?.internal?.totalMemoryMi || 0}M
            </div>
            <div className="text-[10px] text-slate-400">
              {currentRun.latestTick?.internal?.memoryUsagePercent ?? 0}% Limit
            </div>
          </div>
        </div>

        {/* Breaking Point / Recommendation */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Khuyến nghị Hành động Tiếp theo:
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {ev.recommendationsVi.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onCopyMarkdown}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã sao chép Báo cáo
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Sao chép Báo cáo Markdown
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
            >
              Xem Sơ Đồ & Biểu Đồ
            </button>
            <button
              onClick={() => {
                onClose();
                onRerun();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold hover:opacity-95 shadow transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Chạy Lại Kịch Bản
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Step4LiveMonitor: React.FC<Step4LiveMonitorProps> = ({
  activeRun,
  runsHistory,
  topology,
  onSelectRun,
  onStopRun,
  onRerunScenario,
  onBackToScenarios,
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'TECHNICAL' | 'SECURITY'>('SUMMARY');
  const [copiedReport, setCopiedReport] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [seenRunId, setSeenRunId] = useState<string | null>(null);

  const currentRun = activeRun || runsHistory[0] || null;
  const latestTick = currentRun
    ? currentRun.ticks.length > 0
      ? currentRun.ticks[currentRun.ticks.length - 1]
      : currentRun.latestTick
    : null;

  // Robust calculation of Breaking Point VU (from specializedInsights or first broken tick)
  const breakingPointVu = currentRun
    ? currentRun.specializedInsights?.breakingPointVu ??
    (() => {
      const brokenTick = currentRun.ticks.find(
        (t) =>
          t.external.status429 > 0 ||
          t.external.status5xx > 0 ||
          t.external.networkErrors > 0 ||
          Boolean(t.internal.oomKilledDetected) ||
          (t.internal.memoryUsagePercent !== null && t.internal.memoryUsagePercent >= 90) ||
          t.external.latencyP95Ms > 1500
      );
      return brokenTick ? brokenTick.external.activeWorkers : null;
    })()
    : null;

  const safeCapacityVu = breakingPointVu ? Math.max(1, Math.round(breakingPointVu * 0.75)) : null;

  const isCompletedOrStopped =
    currentRun && (currentRun.status === 'completed' || currentRun.status === 'aborted-by-safety');
  const isRunning = currentRun?.status === 'running';

  // Automatically show summary popup modal when a run completes!
  useEffect(() => {
    if (isCompletedOrStopped && currentRun && currentRun.id !== seenRunId) {
      setShowSummaryModal(true);
      setSeenRunId(currentRun.id);
    }
  }, [currentRun?.id, currentRun?.status]);

  const progressPct =
    currentRun && latestTick && currentRun.durationSeconds > 0
      ? Math.min(100, Math.round((latestTick.elapsedSeconds / currentRun.durationSeconds) * 100))
      : currentRun && currentRun.status !== 'running'
        ? 100
        : 0;

  const handleCopyMarkdown = () => {
    if (!currentRun) return;
    const ev = currentRun.evaluation;
    const md = [
      `# Báo cáo Kiểm thử Chịu tải & Bảo mật: ${currentRun.scenarioName}`,
      `- **Đích kiểm thử**: \`[${currentRun.protocol}] ${currentRun.targetUrl}\``,
      `- **Cụm / Namespace**: \`${currentRun.clusterName}\` / \`${currentRun.namespace || 'external'}\``,
      `- **Trạng thái**: **${currentRun.status.toUpperCase()}**`,
      `- **Thời gian bắt đầu**: ${new Date(currentRun.startedAt).toLocaleString('vi-VN')}`,
      `- **Xếp hạng**: **${ev.grade}** — ${ev.headlineVi}`,
      breakingPointVu ? `- **Điểm gãy hệ thống (Breaking Point)**: **${breakingPointVu} Users đồng thời** (Ngưỡng an toàn khuyến nghị: < ${safeCapacityVu} Users)` : '',
      '',
      '## 1. Tóm tắt Đánh giá (Non-Tech / Quản lý)',
      ev.nonTechSummaryVi,
      '',
      '## 2. Nhận định Kỹ thuật (Engineering)',
      ev.engineerSummary,
      '',
      '## 3. Khuyến nghị Hành động',
      ...ev.recommendationsVi.map((r) => `- ${r}`),
      '',
      '## 4. Kết quả Kiểm toán Bảo mật Thực tế',
      ...(currentRun.securityFindings.length > 0
        ? currentRun.securityFindings.map(
          (f) =>
            `- **[${f.status}] ${f.category} - ${f.titleVi}**: ${f.observedResult} *(Khuyến nghị: ${f.remediationVi})*`
        )
        : ['- Không có mục kiểm toán bảo mật.']),
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  if (!currentRun) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-3.5">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Activity className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Chưa có Phiên Kiểm thử nào được chạy</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Hãy quay lại Bước 3 để chọn một kịch bản kiểm thử và bấm <strong>Chạy Kiểm thử Thật</strong>.
        </p>
        <button
          onClick={onBackToScenarios}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại Bước 3 (Thiết kế Kịch bản)
        </button>
      </div>
    );
  }

  const ext = latestTick?.external;
  const k8s = latestTick?.internal;
  const memPct = k8s?.memoryUsagePercent ?? null;
  const cpuPct = k8s?.cpuUsagePercent ?? null;

  return (
    <div className="max-w-7xl mx-auto space-y-3.5">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${currentRun.status === 'running'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : currentRun.status === 'completed'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : currentRun.status === 'aborted-by-safety'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
            >
              {currentRun.status === 'running' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
              {currentRun.status === 'running'
                ? 'ĐANG CHẠY BẮN TẢI'
                : currentRun.status === 'completed'
                  ? 'HOÀN TẤT'
                  : currentRun.status === 'aborted-by-safety'
                    ? 'CẦU CHÌ ĐÃ NGẮT'
                    : currentRun.status.toUpperCase()}
            </span>
            <h2 className="text-sm font-bold text-white truncate max-w-md">{currentRun.scenarioName}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="text-cyan-300 bg-cyan-950/50 border border-cyan-500/20 px-1.5 py-0.2 rounded font-semibold">
              {currentRun.testType || 'LOAD_TEST'}
            </span>
            <span className="text-indigo-300 truncate max-w-[220px]">
              [{currentRun.protocol}] {currentRun.targetUrl}
            </span>
            <span>•</span>
            <span>
              {latestTick?.elapsedSeconds || 0}s / {currentRun.durationSeconds}s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Button to Re-open Summary Popup */}
          <button
            onClick={() => setShowSummaryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition"
          >
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            Xem Tóm Tắt (Popup)
          </button>

          <button
            onClick={onBackToScenarios}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Đổi Kịch bản
          </button>

          {currentRun.status === 'running' ? (
            <button
              onClick={onStopRun}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition"
            >
              <Square className="w-3 h-3 fill-current" />
              Dừng Khẩn cấp
            </button>
          ) : (
            <button
              onClick={() => onRerunScenario(currentRun.scenarioId)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
            >
              <Play className="w-3 h-3 fill-current" />
              Chạy lại
            </button>
          )}
        </div>
      </div>

      {/* SLIM PROGRESS BAR */}
      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
        <div
          className={`h-full transition-all duration-300 ${currentRun.status === 'aborted-by-safety'
            ? 'bg-amber-500'
            : currentRun.status === 'running'
              ? 'bg-emerald-500'
              : 'bg-indigo-500'
            }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* 2. PROMINENT BREAKING POINT HERO BANNER (ĐIỂM GÃY HỆ THỐNG) */}
      {breakingPointVu ? (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/60 border-2 border-rose-500/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/50 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-rose-300 font-mono">
                  ĐIỂM GÃY HỆ THỐNG (BREAKING POINT):
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse shadow-sm">
                  {breakingPointVu} / {currentRun.peakVirtualUsers || currentRun.virtualUsers} USERS
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  (Mục tiêu cấu hình: {currentRun.peakVirtualUsers || currentRun.virtualUsers} VUs)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Hệ thống bắt đầu bị nghẽn tải / chặn 429 tại ngưỡng <strong className="text-white">{breakingPointVu} người dùng</strong> trong quá trình tăng bậc thang lên {currentRun.peakVirtualUsers || currentRun.virtualUsers} Users.
                {safeCapacityVu && (
                  <span> Ngưỡng tải an toàn khuyến nghị (Safe Capacity): <strong className="text-emerald-400">&lt; {safeCapacityVu} Users</strong>.</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-rose-200 bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-700/60">
              {ext?.status429 ? 'Chặn bởi Ingress 429' : k8s?.oomKilledDetected ? 'Sập do OOM RAM Pod' : 'Độ trễ p95 vượt ngưỡng'}
            </span>
          </div>
        </div>
      ) : currentRun.testType === 'STRESS_TEST' && isRunning ? (
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-2 font-mono text-cyan-300 font-bold">
            <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
            Đang tăng áp lực bậc thang dò tìm điểm gãy (Tải hiện tại: {ext?.activeWorkers || 0} / {currentRun.peakVirtualUsers || currentRun.virtualUsers} Users)...
          </span>
          <span className="text-slate-400 text-[11px]">Chưa phát hiện điểm gãy.</span>
        </div>
      ) : null}

      {/* CRITICAL WARNING BANNERS IF TRIGGERED */}
      {k8s?.oomKilledDetected && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2.5 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <strong className="text-white uppercase">🚨 Kubernetes OOMKilled (Exit Code 137): </strong>
            Pod ứng dụng đã bị tiêu diệt do cạn RAM ({k8s.memoryLimitMi ? `${k8s.memoryLimitMi} MiB` : 'Limit'}). Điểm gãy phần cứng đã chính thức xuất hiện!
          </div>
        </div>
      )}

      {currentRun.safetyBreaker.tripped && (
        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Cầu chì Tự ngắt: </strong>
            {currentRun.safetyBreaker.trippedReasonVi || currentRun.safetyBreaker.trippedTechnical}
          </span>
        </div>
      )}

      {/* 3. "HOW IT'S WIRED" INTERACTIVE LIVE REQUEST & BREAKING POINT DIAGRAM WITH CLEAR ACTORS */}
      <HowItsWiredDiagram
        currentRun={currentRun}
        latestTick={latestTick}
        topology={topology}
        breakingPointVu={breakingPointVu}
      />

      {/* 4. 5 HIGH-DENSITY REAL-TIME KPI CARDS (INCLUDING BREAKING POINT CARD) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Card 1: Traffic & RPS */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Lưu lượng (RPS)</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white">{ext ? ext.requestsPerSec : 0}</span>
            <span className="text-[10px] text-slate-400">req/s</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
            <span>Tổng: {ext?.totalRequests || 0}</span>
            <span className="text-indigo-300 font-bold">{ext?.activeWorkers || 0} VUs</span>
          </div>
        </div>

        {/* Card 2: Breaking Point Metric */}
        <div className={`p-3 rounded-xl border space-y-1 ${breakingPointVu
          ? 'bg-rose-950/30 border-rose-500/50 shadow-sm'
          : 'bg-slate-900/70 border-slate-800'
          }`}>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className={breakingPointVu ? 'text-rose-300 font-bold' : ''}>Điểm Gãy / Mục Tiêu</span>
            <Flame className={`w-3.5 h-3.5 ${breakingPointVu ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black ${breakingPointVu ? 'text-rose-400' : 'text-emerald-400'}`}>
              {breakingPointVu ? `${breakingPointVu} VUs` : `${currentRun.virtualUsers} VUs`}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              / {currentRun.peakVirtualUsers || currentRun.virtualUsers} VUs max
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
            <span>Chặn: <strong className={ext?.status429 ? 'text-amber-400' : 'text-slate-300'}>{ext?.status429 || 0} (429)</strong></span>
            <span>Lỗi 5xx: <strong className={ext?.status5xx ? 'text-rose-400' : 'text-slate-300'}>{ext?.status5xx || 0}</strong></span>
          </div>
        </div>

        {/* Card 3: Latency p95 */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Độ trễ (p95)</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white">{ext ? ext.latencyP95Ms : 0}</span>
            <span className="text-[10px] text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
            <span>p50: {ext?.latencyP50Ms || 0}ms</span>
            <span>TB: {ext?.latencyAvgMs || 0}ms</span>
          </div>
        </div>

        {/* Card 4: RAM Pod K8s */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>RAM Pod K8s</span>
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
          </div>
          {k8s && k8s.metricsAvailable ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{k8s.totalMemoryMi ?? 0} <span className="text-xs text-slate-400 font-normal">MiB</span></span>
                {memPct !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${memPct >= 85
                      ? 'bg-rose-500/20 text-rose-300'
                      : memPct >= 70
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                  >
                    {memPct}%
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${(memPct ?? 0) >= 85 ? 'bg-rose-500' : (memPct ?? 0) >= 70 ? 'bg-amber-500' : 'bg-sky-400'
                    }`}
                  style={{ width: `${Math.min(100, memPct ?? 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono truncate">
                <span>Limit: {k8s.memoryLimitMi ? `${k8s.memoryLimitMi}M` : 'No Limit'}</span>
                <span className="text-emerald-400">{k8s.podPhase}</span>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 py-1 font-mono">Chờ K8s Metrics...</div>
          )}
        </div>

        {/* Card 5: CPU Pod K8s */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>CPU Pod K8s</span>
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
          </div>
          {k8s && k8s.metricsAvailable ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{k8s.totalCpuMillicores ?? 0} <span className="text-xs text-slate-400 font-normal">m</span></span>
                {cpuPct !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${cpuPct >= 85
                      ? 'bg-rose-500/20 text-rose-300'
                      : cpuPct >= 70
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                  >
                    {cpuPct}%
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${(cpuPct ?? 0) >= 85 ? 'bg-rose-500' : (cpuPct ?? 0) >= 70 ? 'bg-amber-500' : 'bg-amber-400'
                    }`}
                  style={{ width: `${Math.min(100, cpuPct ?? 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono truncate">
                <span>Limit: {k8s.cpuLimitMillicores ? `${k8s.cpuLimitMillicores}m` : 'No Limit'}</span>
                <span>{k8s.podCount || 1} Pod</span>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 py-1 font-mono">Chờ K8s Metrics...</div>
          )}
        </div>
      </div>

      {/* 5. MAIN EVALUATION & DETAILED RESULTS TABS */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-5">
        <div className="lg:col-span-8 space-y-3">
          {/* TAB 2: TECHNICAL TIMELINE & K8S LOGS */}
          {activeTab === 'TECHNICAL' && (
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Biểu đồ Thời gian thực: Độ trễ p95 (ms) & Pod RAM / CPU
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentRun.ticks.length} mẫu đo (1s / mẫu)
                  </span>
                </div>

                {currentRun.ticks.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Đang đợi mẫu đo đầu tiên...
                  </div>
                ) : (
                  <>
                    <div className="h-40 flex items-end gap-1 pt-4 pb-2 px-2.5 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                      {currentRun.ticks.slice(-45).map((tick) => {
                        const maxLatency = Math.max(
                          ...currentRun.ticks.map((t) => t.external.latencyP95Ms),
                          100
                        );
                        const latencyHeightPct = Math.min(
                          100,
                          Math.max(6, Math.round((tick.external.latencyP95Ms / maxLatency) * 100))
                        );
                        return (
                          <div
                            key={tick.elapsedSeconds}
                            className="flex-1 min-w-[12px] flex flex-col items-center gap-1 group relative"
                          >
                            <div className="w-full h-28 flex items-end justify-center">
                              <div
                                className={`w-full rounded-t transition-all ${tick.external.status5xx > 0
                                  ? 'bg-rose-500'
                                  : tick.external.status429 > 0
                                    ? 'bg-amber-400'
                                    : 'bg-indigo-500'
                                  }`}
                                style={{ height: `${latencyHeightPct}%` }}
                                title={`Giây ${tick.elapsedSeconds}s: p95=${tick.external.latencyP95Ms}ms | RAM=${tick.internal.totalMemoryMi ?? 0}MiB (${tick.internal.memoryUsagePercent ?? 0}%) | CPU=${tick.internal.totalCpuMillicores ?? 0}m (${tick.internal.cpuUsagePercent ?? 0}%)`}
                              />
                            </div>
                            <span className="text-[8px] text-slate-500 font-mono">
                              {tick.elapsedSeconds}s
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Độ trễ p95 đỉnh:</span>
                        <strong className="text-amber-300">
                          {Math.max(...currentRun.ticks.map((t) => t.external.latencyP95Ms), 0)} ms
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Đỉnh RAM Pod:</span>
                        <strong className="text-sky-300">
                          {Math.max(...currentRun.ticks.map((t) => t.internal.totalMemoryMi || 0), 0)} MiB
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Đỉnh CPU Pod:</span>
                        <strong className="text-amber-300">
                          {Math.max(...currentRun.ticks.map((t) => t.internal.totalCpuMillicores || 0), 0)}m
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Real K8s Event & Pod Log Stream */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    Sự kiện Kubernetes (Events Thật)
                  </div>
                  <div className="text-xs font-mono text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 min-h-[56px] break-words">
                    {k8s?.recentEvent || 'Không có sự kiện cảnh báo mới.'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Dòng Log Mới nhất từ Pod
                  </div>
                  <div className="text-xs font-mono text-emerald-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 min-h-[56px] break-words">
                    {k8s?.recentLogLine || 'Đang chờ luồng log từ Pod...'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. POPUP SUMMARY MODAL WHEN RUN COMPLETES OR CLICKED */}
      {showSummaryModal && (
        <TestSummaryModal
          currentRun={currentRun}
          breakingPointVu={breakingPointVu}
          safeCapacityVu={safeCapacityVu}
          onClose={() => setShowSummaryModal(false)}
          onCopyMarkdown={handleCopyMarkdown}
          copied={copiedReport}
          onRerun={() => onRerunScenario(currentRun.scenarioId)}
        />
      )}
    </div>
  );
};
