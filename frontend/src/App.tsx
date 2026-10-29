import React, { useEffect, useState } from 'react';
import {
  Activity,
  Plus,
  Play,
  Square,
  Shield,
  Sliders,
  Eye,
  Code2,
  Terminal,
  Layers,
  CheckCircle2,
  Zap,
  FileCode,
} from 'lucide-react';
import {
  ActiveTestRunState,
  ConnectionMode,
  DiscoveredTopology,
  ScenarioPack,
  TargetProfile,
} from './types';
import { LiveTopologyCanvas } from './components/LiveTopologyCanvas';
import { DualModeDashboard } from './components/DualModeDashboard';
import { ConnectTargetModal } from './components/ConnectTargetModal';

export const App: React.FC = () => {
  const [targets, setTargets] = useState<TargetProfile[]>([]);
  const [activeTarget, setActiveTarget] = useState<TargetProfile | null>(null);
  const [topology, setTopology] = useState<DiscoveredTopology | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioPack[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    'ws-realtime-capacity-ramp'
  );
  const [runState, setRunState] = useState<ActiveTestRunState | null>(null);
  const [viewMode, setViewMode] = useState<'engineer' | 'nontech'>('nontech');
  const [executionMode, setExecutionMode] = useState<
    'hybrid-physics-correlator' | 'live-http-ws-probe'
  >('hybrid-physics-correlator');
  const [selectedNode, setSelectedNode] = useState<string>('pod');
  const [showYamlModal, setShowYamlModal] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/studio/bootstrap')
      .then((r) => r.json())
      .then((data) => {
        setTargets(data.targets);
        setActiveTarget(data.activeTarget);
        setTopology(data.topology);
        setScenarios(data.scenarios);
        setRunState(data.runState);
        if (data.scenarios?.length > 0) {
          setSelectedScenarioId(data.scenarios[0].id);
        }
      })
      .catch((err) => console.error('Bootstrap error:', err));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/studio`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE' && msg.state) {
          setRunState(msg.state);
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSelectTarget = async (targetId: string) => {
    const res = await fetch('/api/targets/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTarget(data.activeTarget);
      setTopology(data.topology);
      setScenarios(data.scenarios);
      setRunState(data.runState);
    }
  };

  const handleConnectNewTarget = async (payload: {
    name: string;
    environment: 'production' | 'staging' | 'custom';
    connectionMode: ConnectionMode;
    namespace: string;
    externalUrl: string;
    sshTunnelCommand?: string;
    kubeconfigYaml?: string;
    memoryLimitMi?: number;
    maxSessions?: number;
    rateLimitRps?: number;
  }) => {
    const res = await fetch('/api/targets/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setTargets(data.targets);
      setActiveTarget(data.activeTarget);
      setTopology(data.topology);
      setScenarios(data.scenarios);
      setRunState(data.runState);
    }
  };

  const handleStartScenario = async (scenarioIdToRun?: string) => {
    const id = scenarioIdToRun || selectedScenarioId;
    setSelectedScenarioId(id);
    const res = await fetch('/api/scenarios/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioId: id,
        executionMode,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRunState(data.runState);
    }
  };

  const handleStopScenario = async () => {
    const res = await fetch('/api/scenarios/stop', {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setRunState(data.runState);
    }
  };

  if (!activeTarget || !topology || !runState) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-mono">
          <Activity className="w-5 h-5 text-cyan-400 animate-spin" />
          Đang khởi tạo KubePulse Studio (OpenLens + Active Load & Security Engine)...
        </div>
      </div>
    );
  }

  const activeScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];
  const isRunning = runState.status === 'running';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow">
              KP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  KubePulse Studio
                </span>
                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-500/30">
                  OpenLens + Active Load & Security
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Kiểm thử Chịu tải & Bảo mật Đối chiếu 2 Chiều (Outside-In Probes + Inside-Out K8s Telemetry)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`hidden md:flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
              runState.safetyBreaker.tripped
                ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Cầu chì Tự ngắt:{' '}
              <strong className="font-mono">
                {runState.safetyBreaker.thresholdPercent}% RAM (
                {runState.safetyBreaker.thresholdMemoryMi}Mi / {topology.workload.memoryLimitMi}Mi)
              </strong>
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('nontech')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'nontech'
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Chế độ Trực quan (Non-Tech)
            </button>
            <button
              onClick={() => setViewMode('engineer')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'engineer'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Chế độ Kỹ sư (OpenLens Mode)
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-3.5 shrink-0 overflow-y-auto">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  1. Hệ thống Đích (Workspaces)
                </span>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-1 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
                >
                  <Plus className="w-3 h-3" /> Thêm Đích
                </button>
              </div>

              <div className="space-y-1.5">
                {targets.map((t) => {
                  const selected = t.id === activeTarget.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTarget(t.id)}
                      className={`w-full text-left rounded-xl border p-2.5 transition ${
                        selected
                          ? 'border-cyan-500 bg-cyan-950/30 shadow-sm'
                          : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">
                          {t.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            t.environment === 'production'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {t.environment}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyan-300 font-mono truncate mt-0.5">
                        {t.externalUrl}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        {t.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  2. Khám phá Tự động (K8s)
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Synced
                </span>
              </div>

              <div className="text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Namespace:</span>
                  <span className="font-mono text-white">{topology.namespace}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ingress Host:</span>
                  <span className="font-mono text-cyan-300">{topology.ingressHost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Workload:</span>
                  <span className="font-mono text-emerald-300">{topology.workload.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RAM / V8 Heap:</span>
                  <span className="font-mono text-white">
                    {topology.workload.memoryLimitMi}Mi / {topology.workload.v8HeapLimitMb}MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">MAX_SESSIONS:</span>
                  <span className="font-mono text-amber-300">
                    {topology.contextVariables['target.config.MAX_SESSIONS']} rooms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rate-Limit:</span>
                  <span className="font-mono text-cyan-300">
                    {topology.contextVariables['target.middleware.rateLimitRps']} req/s
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                  Điểm vào Ingress đã phát hiện ({topology.routes.length} routes):
                </div>
                <div className="space-y-1">
                  {topology.routes.map((r) => (
                    <div
                      key={r.path}
                      className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-[11px] font-mono"
                    >
                      <span className="text-white">{r.path}</span>
                      <span className="text-[10px] text-cyan-400">{r.protocol}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeTarget.sshTunnel && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[11px] space-y-1 mt-4">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  SSH Tunnel K3s API
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Ready</span>
              </div>
              <div className="rounded bg-slate-900 p-1.5 font-mono text-[10px] text-cyan-200 break-all">
                {activeTarget.sshTunnel.commandPreview}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  3. Kho Kịch bản Động (Pluggable Scenario Engine — Tự động gắn vào {activeTarget.id})
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeScenario.summaryVi}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={executionMode}
                  onChange={(e) =>
                    setExecutionMode(
                      e.target.value as 'hybrid-physics-correlator' | 'live-http-ws-probe'
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="hybrid-physics-correlator">
                    Chế độ: Hybrid Correlator (An toàn)
                  </option>
                  <option value="live-http-ws-probe">
                    Chế độ: Live Probe + K8s Telemetry
                  </option>
                </select>

                <button
                  onClick={() => setShowYamlModal(!showYamlModal)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  {showYamlModal ? 'Ẩn YAML Manifesto' : 'Xem Biến Động YAML'}
                </button>

                {!isRunning ? (
                  <button
                    onClick={() => handleStartScenario()}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-lg hover:opacity-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Chạy Kịch bản (Start Test)
                  </button>
                ) : (
                  <button
                    onClick={handleStopScenario}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-rose-600"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Dừng Khẩn cấp (Stop)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {scenarios.map((scen) => {
                const isSelected = scen.id === selectedScenarioId;
                return (
                  <div
                    key={scen.id}
                    onClick={() => {
                      setSelectedScenarioId(scen.id);
                      handleStartScenario(scen.id);
                    }}
                    className={`cursor-pointer rounded-xl border p-3 transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/35 shadow'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-white mb-1">
                        <span className="line-clamp-1">{scen.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                        {scen.summaryVi}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-cyan-300">
                        Drivers: {scen.protocolDrivers.join(' + ')}
                      </span>
                      <span className="text-emerald-300 font-sans font-semibold flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Bấm để chạy
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {showYamlModal && (
              <div className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-950 p-3">
                <div className="flex items-center justify-between text-xs text-cyan-300 mb-1.5 font-mono">
                  <span>
                    Manifesto Kịch bản (Các biến {'{{target.*}}'} đã được tự động điền từ{' '}
                    {activeTarget.id}):
                  </span>
                  <span>
                    Variables bound: {activeScenario.templateConfig.dynamicVariablesUsed.join(', ')}
                  </span>
                </div>
                <pre className="font-mono text-xs text-emerald-300 overflow-x-auto">
                  {activeScenario.yamlManifestPreview}
                </pre>
              </div>
            )}
          </div>

          <LiveTopologyCanvas
            topology={topology}
            runState={runState}
            viewMode={viewMode}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />

          <DualModeDashboard
            topology={topology}
            runState={runState}
            activeScenario={activeScenario}
            viewMode={viewMode}
            selectedNode={selectedNode}
          />
        </main>
      </div>

      <ConnectTargetModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={handleConnectNewTarget}
      />
    </div>
  );
};
