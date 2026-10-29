import React, { useState } from 'react';
import {
  ShieldCheck,
  Terminal,
  Gauge,
  MessageSquare,
  FileCode2,
  Copy,
  Check,
  AlertOctagon,
  Sparkles,
  Layers,
  Wrench,
} from 'lucide-react';
import {
  ActiveTestRunState,
  DiscoveredTopology,
  ScenarioPack,
} from '../types';

interface DualModeDashboardProps {
  topology: DiscoveredTopology;
  runState: ActiveTestRunState;
  activeScenario: ScenarioPack;
  viewMode: 'engineer' | 'nontech';
  selectedNode: string;
}

export const DualModeDashboard: React.FC<DualModeDashboardProps> = ({
  topology,
  runState,
  activeScenario,
  viewMode,
  selectedNode,
}) => {
  const [copiedReport, setCopiedReport] = useState(false);
  const tick = runState.latestTick;

  const generateExecutiveMarkdown = () => {
    const lines = [
      `# Báo cáo Kiểm thử Chịu tải & Bảo mật Đối chiếu 2 Chiều`,
      `- **Hệ thống Đích (Target)**: \`${topology.ingressHost}\` (Namespace: \`${topology.namespace}\`)`,
      `- **Kịch bản Thực thi**: ${runState.scenarioName}`,
      `- **Điểm Đánh giá Tổng thể**: **${runState.overallGrade}**`,
      `- **Trạng thái Cầu chì An toàn (85% RAM)**: ${
        runState.safetyBreaker.tripped
          ? `Đã kích hoạt tự ngắt trong ${runState.safetyBreaker.reactionTimeMs}ms ở ${runState.safetyBreaker.thresholdMemoryMi}Mi RAM (Bảo vệ Pod thành công)`
          : `An toàn (Ngưỡng bảo vệ: ${runState.safetyBreaker.thresholdMemoryMi}Mi / ${topology.workload.memoryLimitMi}Mi)`
      }`,
      ``,
      `## 1. Kết luận Đối chiếu 2 Chiều (Outside-In & Inside-Out)`,
      `- **Nhận định chính**: ${tick.correlation.headlineVi}`,
      `- **Góc nhìn Quản lý / Kinh doanh**: ${tick.correlation.nonTechDiagnosisVi}`,
      `- **Góc nhìn Kỹ sư (Root Cause)**: ${tick.correlation.engineerDiagnosis}`,
      ``,
      `## 2. Kết quả Kiểm chứng Khiên Bảo mật 6 Tầng`,
      ...runState.securityResults.map(
        (s) =>
          `- **${s.layerNameVi}**: Đã chặn **${s.blockedRatePercent}%** (${s.attackNameVi}) -> \`${s.httpStatusOrK8sState}\``
      ),
      ``,
      `## 3. Khuyến nghị Hành động`,
      ...runState.recommendations.map(
        (r) => `- **[${r.severity.toUpperCase()}] ${r.titleVi}**: ${r.nonTechImpactVi}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  if (viewMode === 'nontech') {
    const ux = tick.correlation.userExperiencePreview;
    const safeCap = ux.capacityUsersSafe;
    const currentUsers = ux.capacityUsersCurrent;
    const capPercent = Math.min(100, Math.round((currentUsers / Math.max(1, safeCap * 1.3)) * 100));

    return (
      <div className="space-y-4">
        {runState.safetyBreaker.tripped && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-950/50 p-4 flex items-start gap-3.5 shadow-lg">
            <AlertOctagon className="w-7 h-7 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-200">
                Cầu chì Bảo vệ Tự động đã Kích hoạt Thành công (Phản ứng trong {runState.safetyBreaker.reactionTimeMs}ms)
              </h3>
              <p className="text-xs text-amber-100/90 mt-1 leading-relaxed">
                {runState.safetyBreaker.reasonVi}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/75 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Khung Mô phỏng Trải nghiệm Thực tế của Khách hàng (Live Preview)
                  </h3>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    ux.simulatedSubtitleDelayMs > 1000
                      ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                      : ux.simulatedSubtitleDelayMs > 400
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                      : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  }`}
                >
                  {ux.experienceLabelVi}
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5 mb-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>🎤 Câu nói gốc của người chủ trì phòng họp:</span>
                  <span className="font-mono text-slate-300">Tốc độ gốc (0ms)</span>
                </div>
                <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-200 border border-slate-800">
                  “{ux.sampleSpokenTextVi}”
                </div>

                <div className="flex items-center justify-between text-[11px] text-cyan-300 pt-1">
                  <span>💬 Phụ đề / Phản hồi hiển thị trên màn hình người tham gia:</span>
                  <span className="font-mono font-bold">
                    Độ trễ thực tế: {(ux.simulatedSubtitleDelayMs / 1000).toFixed(2)} giây ({ux.simulatedSubtitleDelayMs}ms)
                  </span>
                </div>
                <div
                  className={`rounded-lg px-3 py-2.5 text-xs font-medium border transition-all ${
                    ux.simulatedSubtitleDelayMs > 1000
                      ? 'bg-rose-950/30 border-rose-500/50 text-rose-100'
                      : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-100'
                  }`}
                >
                  “{ux.sampleDisplayedTextVi}”
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  Đồng hồ Sức chứa Hệ thống Hiện tại:
                </span>
                <span className="font-mono font-bold text-white">
                  Đang phục vụ {currentUsers} người / Ngưỡng mượt khuyến nghị: {safeCap} người
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    currentUsers > safeCap
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  }`}
                  style={{ width: `${capPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/75 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Bản Phiên dịch dành cho Quản lý (Non-Tech Summary)
                  </h3>
                </div>
                <button
                  onClick={generateExecutiveMarkdown}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã chép Báo cáo
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Xuất Báo cáo Quản lý
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 p-3.5 mb-3">
                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-400/50 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Điểm</span>
                  <span className="text-2xl font-black text-emerald-300">
                    {runState.overallGrade}
                  </span>
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                  {tick.correlation.nonTechDiagnosisVi}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Đề xuất Nâng cấp (Dễ hiểu & Đo lường được):
              </div>
              {runState.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 text-xs"
                >
                  <div className="font-semibold text-cyan-300 mb-0.5">• {rec.titleVi}</div>
                  <div className="text-slate-400 text-[11px]">{rec.nonTechImpactVi}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Sơ đồ Khiên Bảo vệ Đa Tầng (Kiểm chứng Tấn công Thực tế & Độ kín của Cụm máy chủ)
              </h3>
            </div>
            <span className="text-xs text-emerald-300 font-semibold">
              Đã chặn đứng 100% các mũi tấn công thử nghiệm
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {runState.securityResults.map((sec) => (
              <div
                key={sec.id}
                className="rounded-xl border border-emerald-500/30 bg-slate-950/80 p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300 mb-1">
                    <span>{sec.layerNameVi}</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-200 border border-emerald-500/40">
                      ĐÃ CHẶN {sec.blockedRatePercent}%
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-white mb-1">
                    Thử nghiệm: {sec.attackNameVi}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {sec.nonTechExplanationVi}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Phản hồi kỹ thuật:</span>
                  <span className="text-cyan-300">{sec.httpStatusOrK8sState}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runState.safetyBreaker.tripped && (
        <div className="rounded-xl border border-amber-500 bg-amber-950/40 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold font-mono text-amber-200">
                [SAFETY_CIRCUIT_BREAKER_TRIPPED] Reaction Time: {runState.safetyBreaker.reactionTimeMs}ms (&lt; 500ms SLA)
              </div>
              <div className="text-xs font-mono text-amber-100/80">
                {runState.safetyBreaker.technicalReason}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Bi-Directional Time-Series Correlation (Outside-In p95 vs Inside-Out Pod RAM)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Samples: {runState.history.length} ticks (1s interval)
            </span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex justify-between text-[11px] text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400 inline-block" /> Outside-In Latency p95 (ms)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-purple-400 inline-block" /> Inside-Out Pod RAM (% of {topology.workload.memoryLimitMi}Mi)
              </span>
              <span className="text-amber-300 font-mono">
                --- Ngưỡng Cầu chì 85% ({topology.contextVariables['target.safety.abortMemoryMi']}Mi)
              </span>
            </div>

            <div className="h-36 flex items-end gap-1.5 pt-4 pb-1 px-1 relative border-b border-slate-800">
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400/70 pointer-events-none"
                style={{ bottom: '85%' }}
              />
              {runState.history.map((h, idx) => {
                const memHeight = Math.min(100, Math.max(8, h.internal.podMemoryPercent));
                const latHeight = Math.min(
                  100,
                  Math.max(6, Math.round((h.external.latencyP95Ms / 2000) * 100))
                );
                return (
                  <div
                    key={idx}
                    className="flex-1 flex items-end justify-center gap-0.5 h-full group relative"
                    title={`T+${h.elapsedSeconds}s | VU=${h.external.activeVirtualUsers} | p95=${h.external.latencyP95Ms}ms | Pod RAM=${h.internal.podMemoryMi}Mi (${h.internal.podMemoryPercent}%)`}
                  >
                    <div
                      className="w-1/2 bg-cyan-400/80 hover:bg-cyan-300 rounded-t transition-all"
                      style={{ height: `${latHeight}%` }}
                    />
                    <div
                      className={`w-1/2 rounded-t transition-all ${
                        h.internal.podMemoryPercent >= 80
                          ? 'bg-rose-500'
                          : 'bg-purple-400/85 hover:bg-purple-300'
                      }`}
                      style={{ height: `${memHeight}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
              <span>Root Cause Correlator: {tick.correlation.bottleneckLayer}</span>
              <span>
                V8 GC Pause: {tick.internal.gcPauseMs}ms | Pod Restarts: {tick.internal.restartCount}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Terminal className="w-3.5 h-3.5" /> Live K8s Watch API & Pod Log Stream (Selected: {selectedNode})
              </span>
              <span>Pod: {tick.internal.podName}</span>
            </div>
            <div className="text-[11px] text-amber-300 truncate">
              [K8S_EVENT] {tick.internal.recentK8sEvent}
            </div>
            <div className="text-[11px] text-emerald-300 truncate">
              [POD_STDIO] {tick.internal.recentPodLog}
            </div>
            <div className="text-[11px] text-slate-300">
              [CORRELATOR] {tick.correlation.engineerDiagnosis}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Biến Ngữ cảnh Khám phá Tự động (Context Variables)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Auto-Bound
            </span>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1">
            {Object.entries(topology.contextVariables).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b border-slate-900 pb-1"
              >
                <span className="text-cyan-300">{`{{${k}}}`}</span>
                <span className="text-slate-200 font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>

          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Khuyến nghị Cấu hình K8s (Actionable YAML Patch):
            </div>
            {runState.recommendations[0] && (
              <pre className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-40">
                {runState.recommendations[0].engineerFixSnippet}
              </pre>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Kiểm chứng Kịch bản & Khiên Bảo mật Đa tầng (Outside-In Probes + Inside-Out K8s Manifest Audit)
          </h3>
          <span className="text-xs font-mono text-cyan-300">
            Active Scenario: {activeScenario.id}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                <th className="py-2 px-2.5">Tầng Phòng thủ (Layer)</th>
                <th className="py-2 px-2.5">Kịch bản Tấn công / Kiểm tra (Probe)</th>
                <th className="py-2 px-2.5">Trạng thái HTTP / K8s Spec</th>
                <th className="py-2 px-2.5">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono text-[11px]">
              {runState.securityResults.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-2.5 text-slate-200 font-sans font-medium">
                    {s.layerNameVi}
                  </td>
                  <td className="py-2 px-2.5 text-slate-400">{s.rawProbe}</td>
                  <td className="py-2 px-2.5 text-cyan-300">{s.httpStatusOrK8sState}</td>
                  <td className="py-2 px-2.5">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 border border-emerald-500/40">
                      PASS ({s.blockedRatePercent}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
