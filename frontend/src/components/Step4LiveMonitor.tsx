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
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Activity className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Chưa có Phiên Kiểm thử nào được chạy</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Hãy quay lại Bước 3 để chọn một kịch bản kiểm thử và bấm <strong>Chạy Kiểm thử Thật</strong>.
        </p>
        <button
          onClick={onBackToScenarios}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Bước 3 (Thiết kế Kịch bản)
        </button>
      </div>
    );
  }

  const ext = latestTick?.external;
  const k8s = latestTick?.internal;
  const memPct = k8s?.memoryUsagePercent ?? null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Action Header */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
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
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
              {currentRun.status === 'running'
                ? 'ĐANG BẮN TẢI THỰC TẾ'
                : currentRun.status === 'completed'
                ? 'HOÀN TẤT'
                : currentRun.status === 'aborted-by-safety'
                ? 'CẦU CHÌ AN TOÀN ĐÃ NGẮT'
                : currentRun.status.toUpperCase()}
            </span>
            <h2 className="text-lg font-bold text-white">{currentRun.scenarioName}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-500/20 px-2 py-0.5 rounded font-semibold">
              {currentRun.testType || 'LOAD_TEST'}
            </span>
            <span className="font-mono text-indigo-300 bg-indigo-950/50 border border-indigo-500/20 px-2 py-0.5 rounded">
              [{currentRun.protocol}] {currentRun.targetUrl}
            </span>
            <span>•</span>
            <span>
              Cụm: <strong className="text-slate-200">{currentRun.clusterName}</strong>
              {currentRun.namespace ? ` (${currentRun.namespace})` : ''}
            </span>
            <span>•</span>
            <span>
              Thời lượng:{' '}
              <strong className="text-slate-200">
                {latestTick?.elapsedSeconds || 0}s / {currentRun.durationSeconds}s
              </strong>
            </span>
            {latestTick?.stageLabel && (
              <>
                <span>•</span>
                <span className="text-emerald-300 font-semibold">
                  Giai đoạn: {latestTick.stageLabel}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onBackToScenarios}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Đổi Kịch bản
          </button>

          {currentRun.status === 'running' ? (
            <button
              onClick={onStopRun}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/25 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Dừng Khẩn cấp (Stop)
            </button>
          ) : (
            <button
              onClick={() => onRerunScenario(currentRun.scenarioId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Chạy lại Kịch bản này
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Circuit Breaker Banner */}
      <div className="space-y-2">
        <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
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

        {currentRun.safetyBreaker.tripped && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-3 text-amber-200 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold">
                Cầu chì Tự ngắt Bảo vệ Pod (Safety Circuit Breaker):{' '}
              </span>
              {currentRun.safetyBreaker.trippedReasonVi ||
                currentRun.safetyBreaker.trippedTechnical}
            </div>
          </div>
        )}

        {/* Specialized Metrics Strip for the 6 Performance Test Types */}
        {currentRun.specializedInsights && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Activity className="w-4 h-4" />
              <span>Chỉ số Chuyên biệt ({currentRun.specializedInsights.testType}):</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-300 font-mono">
              {currentRun.specializedInsights.testType === 'STRESS_TEST' && (
                <span>
                  Điểm gãy (Breaking Point):{' '}
                  <strong className="text-rose-300">
                    {currentRun.specializedInsights.breakingPointVu
                      ? `${currentRun.specializedInsights.breakingPointVu} Users`
                      : `Chưa gãy (Chịu tốt tới ${currentRun.peakVirtualUsers || currentRun.virtualUsers} Users)`}
                  </strong>
                </span>
              )}
              {currentRun.specializedInsights.testType === 'SPIKE_TEST' && (
                <span>
                  Thời gian hồi phục sau Spike 10x:{' '}
                  <strong className="text-amber-300">
                    {currentRun.specializedInsights.spikeRecoverySeconds !== null &&
                    currentRun.specializedInsights.spikeRecoverySeconds !== undefined
                      ? `${currentRun.specializedInsights.spikeRecoverySeconds} giây`
                      : 'Đang đo lường...'}
                  </strong>
                </span>
              )}
              {currentRun.specializedInsights.testType === 'SOAK_ENDURANCE_TEST' && (
                <span>
                  Độ lệch Rò rỉ Bộ nhớ (Memory Drift):{' '}
                  <strong className="text-emerald-300">
                    {currentRun.specializedInsights.memoryDriftMi !== null &&
                    currentRun.specializedInsights.memoryDriftMi !== undefined
                      ? `${currentRun.specializedInsights.memoryDriftMi >= 0 ? '+' : ''}${currentRun.specializedInsights.memoryDriftMi} MiB`
                      : 'Chờ K8s Metrics...'}
                  </strong>
                </span>
              )}
              {currentRun.specializedInsights.testType === 'SCALABILITY_TEST' && (
                <span>
                  Hiệu suất mở rộng:{' '}
                  <strong className="text-indigo-300">
                    {currentRun.specializedInsights.rpsPerPod ?? 0} req/s/Pod (Quan sát:{' '}
                    {currentRun.specializedInsights.minPodsObserved || 1} →{' '}
                    {currentRun.specializedInsights.maxPodsObserved || 1} Pods)
                  </strong>
                </span>
              )}
              {currentRun.specializedInsights.testType === 'VOLUME_TEST' && (
                <span>
                  Khối lượng Dữ liệu Lớn đã xử lý:{' '}
                  <strong className="text-purple-300">
                    {currentRun.specializedInsights.totalVolumeMbProcessed ?? 0} MB ({ext?.throughputKbps || 0} KB/s)
                  </strong>
                </span>
              )}
              {currentRun.specializedInsights.testType === 'LOAD_TEST' && (
                <span>
                  Tải dự kiến duy trì:{' '}
                  <strong className="text-cyan-300">
                    {currentRun.virtualUsers} Users đồng thời
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4 Clean Real-Time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Real Traffic */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Lưu lượng Thực tế (Outside-In)</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{ext ? ext.requestsPerSec : 0}</span>
            <span className="text-xs text-slate-400">req/giây</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>
              Tổng đã gửi: <strong className="text-slate-200">{ext?.totalRequests || 0}</strong>
            </span>
            <span>
              Workers: <strong className="text-indigo-300">{ext?.activeWorkers || 0}</strong>
            </span>
          </div>
        </div>

        {/* Card 2: Real Latency */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Độ trễ Phản hồi Thực (p95)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{ext ? ext.latencyP95Ms : 0}</span>
            <span className="text-xs text-slate-400">ms (p95)</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>
              p50: <strong className="text-slate-200">{ext?.latencyP50Ms || 0} ms</strong>
            </span>
            <span>
              Trung bình: <strong className="text-slate-200">{ext?.latencyAvgMs || 0} ms</strong>
            </span>
          </div>
        </div>

        {/* Card 3: Real HTTP/WS Status Codes */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Phân bổ Mã Phản hồi Thật</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-xs">
            <div className="px-2 py-1 rounded bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 flex justify-between">
              <span>2xx OK:</span>
              <strong>{ext?.status2xx || 0}</strong>
            </div>
            <div className="px-2 py-1 rounded bg-amber-950/40 border border-amber-500/20 text-amber-300 flex justify-between">
              <span>429 Chặn:</span>
              <strong>{ext?.status429 || 0}</strong>
            </div>
            <div className="px-2 py-1 rounded bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 flex justify-between">
              <span>401/403:</span>
              <strong>{ext?.status401_403 || 0}</strong>
            </div>
            <div className="px-2 py-1 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 flex justify-between">
              <span>5xx/Lỗi:</span>
              <strong>{(ext?.status5xx || 0) + (ext?.networkErrors || 0)}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Real Inside-Out K8s Pod Metrics */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sức khỏe Pod Thật (Inside-Out)</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          {k8s && k8s.metricsAvailable ? (
            <>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white">{k8s.totalMemoryMi ?? 0}</span>
                  <span className="text-xs text-slate-400">
                    / {k8s.memoryLimitMi ? `${k8s.memoryLimitMi} MiB` : 'Không giới hạn'}
                  </span>
                </div>
                {memPct !== null && (
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      memPct >= 85
                        ? 'bg-rose-500/20 text-rose-300'
                        : memPct >= 70
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {memPct}% RAM
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="truncate max-w-[140px]" title={k8s.primaryPodName}>
                  Pod: <strong className="text-slate-200">{k8s.primaryPodName}</strong>
                </span>
                <span>
                  CPU: <strong className="text-sky-300">{k8s.totalCpuMillicores ?? 0}m</strong>
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-1 space-y-1">
              <div>
                Pod: <strong className="text-slate-200">{k8s?.primaryPodName || 'N/A'}</strong> (
                {k8s?.podPhase || 'External'})
              </div>
              <div className="text-[11px] text-slate-500">
                Chế độ External URL hoặc Metrics Server đang cập nhật...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Layout: Left 3 Tabs + Right Run History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          {/* Tab Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('SUMMARY')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'SUMMARY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                1. Báo cáo Dễ hiểu (Quản lý / Non-Tech)
              </button>
              <button
                onClick={() => setActiveTab('TECHNICAL')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'TECHNICAL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                2. Biểu đồ & Log K8s (Kỹ sư)
              </button>
              <button
                onClick={() => setActiveTab('SECURITY')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'SECURITY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                3. Kiểm toán Bảo mật ({currentRun.securityFindings.length})
              </button>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Đã chép Markdown
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Chép Báo cáo Markdown
                </>
              )}
            </button>
          </div>

          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeTab === 'SUMMARY' && (
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-slate-800">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
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
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Kết luận Đánh giá Tự động từ Số liệu Thực tế
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {currentRun.evaluation.headlineVi}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentRun.evaluation.nonTechSummaryVi}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-indigo-300">
                {currentRun.evaluation.engineerSummary}
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Khuyến nghị Hành động Tiếp theo
                </h4>
                <ul className="space-y-2">
                  {currentRun.evaluation.recommendationsVi.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL TIMELINE & K8S LOGS */}
          {activeTab === 'TECHNICAL' && (
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Biểu đồ Đối chiếu Thời gian thực: Độ trễ p95 (ms) & Pod RAM (MiB)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {currentRun.ticks.length} mẫu đo (1 giây / mẫu)
                  </span>
                </div>

                {currentRun.ticks.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Đang đợi mẫu đo đầu tiên...
                  </div>
                ) : (
                  <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 px-3 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
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
                          className="flex-1 min-w-[14px] flex flex-col items-center gap-1 group relative"
                        >
                          <div className="w-full h-32 flex items-end justify-center gap-0.5">
                            <div
                              className={`w-full rounded-t transition-all ${
                                tick.external.status5xx > 0
                                  ? 'bg-rose-500'
                                  : tick.external.status429 > 0
                                  ? 'bg-amber-400'
                                  : 'bg-indigo-500'
                              }`}
                              style={{ height: `${latencyHeightPct}%` }}
                              title={`Giây ${tick.elapsedSeconds}s: p95=${tick.external.latencyP95Ms}ms, RPS=${tick.external.requestsPerSec}, RAM=${tick.internal.totalMemoryMi ?? 0}MiB`}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {tick.elapsedSeconds}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Real K8s Event & Pod Log Stream */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    Sự kiện Kubernetes (K8s Events Thật)
                  </div>
                  <div className="text-xs font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800 min-h-[72px] break-words">
                    {k8s?.recentEvent || 'Không có sự kiện cảnh báo mới trong Namespace.'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Dòng Log Mới nhất từ Pod Đích
                  </div>
                  <div className="text-xs font-mono text-emerald-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800 min-h-[72px] break-words">
                    {k8s?.recentLogLine || 'Đang chờ luồng log từ Pod...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REAL SECURITY AUDIT FINDINGS */}
          {activeTab === 'SECURITY' && (
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              {currentRun.securityFindings.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Kịch bản này chỉ chạy bắn tải thuần túy hoặc đang thu thập kết quả kiểm toán bảo mật...
                </div>
              ) : (
                currentRun.securityFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3.5"
                  >
                    {finding.status === 'PASS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : finding.status === 'WARN' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{finding.titleVi}</span>
                        <div className="flex items-center gap-1.5">
                          {finding.automationLevel && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              Tự động hóa: {finding.automationLevel}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
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
                      </div>
                      <p className="text-xs font-mono text-slate-400">
                        {finding.technicalCheck} → {finding.observedResult}
                      </p>
                      <p className="text-xs text-slate-300">{finding.nonTechExplanationVi}</p>
                      <p className="text-[11px] text-indigo-300 pt-1">
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
        <div className="lg:col-span-4 space-y-3">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Lịch sử Chạy Kiểm thử ({runsHistory.length})
              </h3>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {runsHistory.map((run) => {
                const isSelected = run.id === currentRun.id;
                return (
                  <button
                    key={run.id}
                    onClick={() => onSelectRun(run)}
                    className={`w-full text-left p-3 rounded-xl border transition space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {run.scenarioName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300">
                        Hạng {run.evaluation.grade}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
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
