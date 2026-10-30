import React, { useState } from 'react';
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
} from 'lucide-react';
import { TestRunRecord } from '../types';

interface Step4LiveMonitorProps {
  activeRun: TestRunRecord | null;
  runsHistory: TestRunRecord[];
  onSelectRun: (run: TestRunRecord) => void;
  onStopRun: () => Promise<void>;
  onRerunScenario: (scenarioId: string) => Promise<void>;
  onBackToScenarios: () => void;
}

export const Step4LiveMonitor: React.FC<Step4LiveMonitorProps> = ({
  activeRun,
  runsHistory,
  onSelectRun,
  onStopRun,
  onRerunScenario,
  onBackToScenarios,
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'TECHNICAL' | 'SECURITY'>('SUMMARY');
  const [copiedReport, setCopiedReport] = useState(false);

  const currentRun = activeRun || runsHistory[0] || null;
  const latestTick = currentRun
    ? currentRun.ticks.length > 0
      ? currentRun.ticks[currentRun.ticks.length - 1]
      : currentRun.latestTick
    : null;

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
    ].join('\n');

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
      {/* 1. TOP COMPACT HEADER & PROGRESS */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                currentRun.status === 'running'
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
          className={`h-full transition-all duration-300 ${
            currentRun.status === 'aborted-by-safety'
              ? 'bg-amber-500'
              : currentRun.status === 'running'
              ? 'bg-emerald-500'
              : 'bg-indigo-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* CRITICAL WARNING BANNERS IF TRIGGERED */}
      {k8s?.oomKilledDetected && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2.5 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <strong className="text-white uppercase">🚨 Kubernetes OOMKilled (Exit Code 137): </strong>
            Pod ứng dụng đã bị tiêu diệt do cạn RAM ({k8s.memoryLimitMi ? `${k8s.memoryLimitMi} MiB` : 'Limit'}). Hệ thống đã chính thức đạt điểm gãy!
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

      {/* 2. ULTRA-COMPACT LIVE ARCHITECTURAL TELEMETRY STRIP */}
      <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-sm text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          {/* Node 1: Engine */}
          <span className="flex items-center gap-1 text-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <strong>KubePulse:</strong> {ext?.activeWorkers || 0} VUs ({ext?.requestsPerSec || 0} rps)
          </span>

          <ArrowRight className="w-3 h-3 text-slate-600 hidden sm:inline" />

          {/* Node 2: Ingress */}
          <span className="flex items-center gap-1 text-amber-300">
            <Globe className="w-3 h-3 text-amber-400" />
            <strong>Ingress:</strong> {(ext?.status429 || 0) > 0 ? (
              <span className="text-rose-400 font-bold">429: {ext?.status429}</span>
            ) : (
              <span className="text-emerald-400">Rate-Limit OK</span>
            )}
          </span>

          <ArrowRight className="w-3 h-3 text-slate-600 hidden sm:inline" />

          {/* Node 3: Target Pod */}
          <span className="flex items-center gap-1 text-emerald-300">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <strong>Pod:</strong> RAM {k8s?.totalMemoryMi ?? 0}M ({memPct ?? 0}%) | CPU {k8s?.totalCpuMillicores ?? 0}m ({cpuPct ?? 0}%)
          </span>

          <ArrowRight className="w-3 h-3 text-slate-600 hidden sm:inline" />

          {/* Node 4: SLA */}
          <span className="flex items-center gap-1 text-sky-300">
            <Database className="w-3 h-3 text-sky-400" />
            <strong>SLA:</strong> p95: {ext?.latencyP95Ms || 0}ms | 2xx: {ext?.status2xx || 0}
          </span>
        </div>

        {/* Live Stage Badge */}
        {latestTick?.stageLabel && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold flex items-center gap-1">
            {currentRun.testType === 'STRESS_TEST' ? (
              <Flame className="w-3 h-3 text-rose-400" />
            ) : currentRun.testType === 'SPIKE_TEST' ? (
              <Zap className="w-3 h-3 text-amber-400" />
            ) : (
              <Activity className="w-3 h-3 text-cyan-400" />
            )}
            {latestTick.stageLabel}
          </span>
        )}
      </div>

      {/* 3. 5 HIGH-DENSITY REAL-TIME KPI CARDS */}
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

        {/* Card 2: Latency p95 */}
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

        {/* Card 3: Status Codes */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Mã Trả về</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-1 pt-0.5 text-[11px] font-mono">
            <div className="px-1 rounded bg-emerald-950/40 text-emerald-300 flex justify-between">
              <span>2xx:</span> <strong>{ext?.status2xx || 0}</strong>
            </div>
            <div className="px-1 rounded bg-amber-950/40 text-amber-300 flex justify-between">
              <span>429:</span> <strong>{ext?.status429 || 0}</strong>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
            <span className="text-rose-400">5xx/Lỗi: {(ext?.status5xx || 0) + (ext?.networkErrors || 0)}</span>
            <span className="text-slate-400">Auth: {ext?.status401_403 || 0}</span>
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
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      memPct >= 85
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
                  className={`h-full transition-all duration-300 ${
                    (memPct ?? 0) >= 85 ? 'bg-rose-500' : (memPct ?? 0) >= 70 ? 'bg-amber-500' : 'bg-sky-400'
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
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      cpuPct >= 85
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
                  className={`h-full transition-all duration-300 ${
                    (cpuPct ?? 0) >= 85 ? 'bg-rose-500' : (cpuPct ?? 0) >= 70 ? 'bg-amber-500' : 'bg-amber-400'
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

      {/* 4. MAIN EVALUATION & DETAILED RESULTS TABS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-3">
          {/* Tab Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('SUMMARY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'SUMMARY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <FileText className="w-3 h-3" />
                1. Tóm tắt Đánh giá
              </button>
              <button
                onClick={() => setActiveTab('TECHNICAL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'TECHNICAL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Terminal className="w-3 h-3" />
                2. Biểu đồ & Log K8s
              </button>
              <button
                onClick={() => setActiveTab('SECURITY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'SECURITY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                3. Kiểm toán Bảo mật ({currentRun.securityFindings.length})
              </button>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  Đã chép
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Chép Markdown PR
                </>
              )}
            </button>
          </div>

          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeTab === 'SUMMARY' && (
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 pb-3.5 border-b border-slate-800">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
                    currentRun.evaluation.grade.startsWith('A')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : currentRun.evaluation.grade === 'B'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : currentRun.evaluation.grade === 'C'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {currentRun.evaluation.grade}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Kết luận Đánh giá Tự động từ Số liệu Thực tế
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {currentRun.evaluation.headlineVi}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentRun.evaluation.nonTechSummaryVi}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-indigo-300">
                {currentRun.evaluation.engineerSummary}
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Khuyến nghị Hành động
                </h4>
                <ul className="space-y-1.5">
                  {currentRun.evaluation.recommendationsVi.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
                                className={`w-full rounded-t transition-all ${
                                  tick.external.status5xx > 0
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

          {/* TAB 3: REAL SECURITY AUDIT FINDINGS */}
          {activeTab === 'SECURITY' && (
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
              {currentRun.securityFindings.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Kịch bản này chỉ chạy bắn tải thuần túy hoặc đang thu thập kết quả kiểm toán bảo mật...
                </div>
              ) : (
                currentRun.securityFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5"
                  >
                    {finding.status === 'PASS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : finding.status === 'WARN' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">{finding.titleVi}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            finding.status === 'PASS'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : finding.status === 'WARN'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {finding.category} • {finding.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400">
                        {finding.technicalCheck} → {finding.observedResult}
                      </p>
                      <p className="text-xs text-slate-300">{finding.nonTechExplanationVi}</p>
                      <p className="text-[11px] text-indigo-300">
                        <strong>Khuyến nghị:</strong> {finding.remediationVi}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Run History */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              Lịch sử Chạy ({runsHistory.length})
            </h3>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {runsHistory.map((run) => {
                const isSelected = run.id === currentRun.id;
                return (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run)}
                    className={`w-full text-left p-2.5 rounded-xl border transition space-y-1 ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {run.scenarioName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-indigo-300">
                        Hạng {run.evaluation.grade}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      [{run.protocol}] {run.targetUrl}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{new Date(run.startedAt).toLocaleTimeString('vi-VN')}</span>
                      <span
                        className={
                          run.status === 'running'
                            ? 'text-emerald-400 font-semibold'
                            : run.status === 'aborted-by-safety'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {run.status.toUpperCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
