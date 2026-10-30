import React, { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Save,
  Trash2,
  Sliders,
  Sparkles,
  Check,
  Activity,
  Flame,
  Zap,
  Globe,
  Cpu,
  Layers,
  Database,
  ArrowRight,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ClusterConnectionPublic,
  NamespaceTopologySnapshot,
  PerformanceTestType,
  ScenarioProtocol,
  TestScenario,
} from '../types';

interface Step3ScenarioStudioProps {
  cluster: ClusterConnectionPublic;
  selectedNamespace: string;
  topology: NamespaceTopologySnapshot | null;
  scenarios: TestScenario[];
  selectedScenarioId: string | null;
  onSelectScenario: (id: string) => void;
  onSaveScenario: (
    payload: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<TestScenario>;
  onDeleteScenario: (id: string) => Promise<void>;
  onAutoGenerateScenarios: () => Promise<void>;
  onRunScenarioAndProceed: (scenarioId: string) => Promise<void>;
}

export const TEST_TYPE_CATALOG: Array<{
  type: PerformanceTestType;
  title: string;
  badgeLabel: string;
  subtitle: string;
  purpose: string;
  flowDescription: string;
  accentBorder: string;
  activeBg: string;
  textColor: string;
  icon: React.ReactNode;
}> = [
  {
    type: 'LOAD_TEST',
    title: '1. Load Test',
    badgeLabel: 'Baseline SLA',
    subtitle: 'Tải Ổn định Dự kiến',
    purpose: 'Kiểm tra hoạt động ở tải mục tiêu, đối chiếu SLA p95 Latency và RAM/CPU Pod.',
    flowDescription: 'Bơm dòng traffic đều đặn qua Ingress vào Pod. Đo lường SLA cam kết dưới tải thông thường.',
    accentBorder: 'border-cyan-500',
    activeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/50',
    textColor: 'text-cyan-400',
    icon: <Activity className="w-4 h-4 text-cyan-400" />,
  },
  {
    type: 'STRESS_TEST',
    title: '2. Stress Test',
    badgeLabel: 'Breaking Point',
    subtitle: 'Tìm Điểm Gãy Bậc Thang',
    purpose: 'Tăng tải 5 nấc liên tục vượt ngưỡng để tìm chính xác điểm gãy (429, 5xx, hoặc OOM).',
    flowDescription: 'Leo bậc thang 5 nấc ép tải. Kiểm tra xem Cloudflare/Traefik cắt 429 hay Pod bị cạn CPU/RAM trước.',
    accentBorder: 'border-rose-500',
    activeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/50',
    textColor: 'text-rose-400',
    icon: <Flame className="w-4 h-4 text-rose-400" />,
  },
  {
    type: 'SPIKE_TEST',
    title: '3. Spike Test',
    badgeLabel: '10x Flash Sale',
    subtitle: 'Sốc Tải & Đo Hồi Phục',
    purpose: 'Tải nền thấp đột ngột vọt 10x tức thì rồi hạ để đo Thời gian tự phục hồi (Recovery Time).',
    flowDescription: 'Bơm xung tải tức thì 10x (Flash Sale) rồi ngắt đột ngột để kiểm tra xả nghẽn hàng đợi và tự phục hồi.',
    accentBorder: 'border-amber-500',
    activeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/50',
    textColor: 'text-amber-400',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
];

export const Step3ScenarioStudio: React.FC<Step3ScenarioStudioProps> = ({
  cluster,
  selectedNamespace,
  topology,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onSaveScenario,
  onDeleteScenario,
  onAutoGenerateScenarios,
  onRunScenarioAndProceed,
}) => {
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const [id, setId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [testType, setTestType] = useState<PerformanceTestType>('LOAD_TEST');
  const [protocol, setProtocol] = useState<ScenarioProtocol>('HTTP');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [targetBaseUrl, setTargetBaseUrl] = useState('');
  const [targetPath, setTargetPath] = useState('/');
  const [authHeader, setAuthHeader] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [virtualUsers, setVirtualUsers] = useState(50);
  const [peakVirtualUsers, setPeakVirtualUsers] = useState(250);
  const [durationSeconds, setDurationSeconds] = useState(25);
  const [rampUpSeconds, setRampUpSeconds] = useState(5);
  const [targetNamespace, setTargetNamespace] = useState(selectedNamespace);
  const [targetWorkload, setTargetWorkload] = useState('');
  const [safetyAbortMemoryPercent, setSafetyAbortMemoryPercent] = useState(85);
  const [savedToast, setSavedToast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync form when activeScenario changes
  useEffect(() => {
    if (activeScenario) {
      setId(activeScenario.id);
      setName(activeScenario.name);
      setDescription(activeScenario.description);
      const normalizedType: PerformanceTestType =
        activeScenario.testType === 'STRESS_TEST' || activeScenario.testType === 'SPIKE_TEST'
          ? activeScenario.testType
          : 'LOAD_TEST';
      setTestType(normalizedType);
      setProtocol(activeScenario.protocol);
      setMethod(activeScenario.method);
      setTargetBaseUrl(activeScenario.targetBaseUrl);
      setTargetPath(activeScenario.targetPath);
      setAuthHeader(activeScenario.headers?.['Authorization'] || '');
      setRequestBody(activeScenario.requestBody || '');
      setVirtualUsers(activeScenario.virtualUsers || 50);
      setPeakVirtualUsers(activeScenario.peakVirtualUsers || 250);
      setDurationSeconds(activeScenario.durationSeconds || 25);
      setRampUpSeconds(activeScenario.rampUpSeconds || 5);
      setTargetNamespace(activeScenario.targetNamespace || selectedNamespace);
      setTargetWorkload(
        activeScenario.targetWorkload || topology?.workloads[0]?.name || ''
      );
      setSafetyAbortMemoryPercent(activeScenario.safetyAbortMemoryPercent || 85);
    } else {
      handleInitNewBlankScenario();
    }
  }, [activeScenario?.id]);

  const handleInitNewBlankScenario = () => {
    const wsRoute = topology?.ingresses.find((r) => r.protocol === 'WSS');
    const firstIng = topology?.ingresses[0];
    const defaultUrl = wsRoute
      ? `${wsRoute.tlsEnabled ? 'wss' : 'ws'}://${wsRoute.host}`
      : firstIng
      ? `${firstIng.tlsEnabled ? 'https' : 'http'}://${firstIng.host}`
      : cluster.externalBaseUrl || 'https://localhost';

    setId(undefined);
    setName(`[1. Load Test] Tải Chuẩn SLA (${selectedNamespace})`);
    setDescription('Kiểm tra tải ổn định đối chiếu SLA và CPU/RAM Pod K8s');
    setTestType('LOAD_TEST');
    setProtocol(wsRoute ? 'WEBSOCKET' : 'HTTP');
    setMethod('GET');
    setTargetBaseUrl(defaultUrl);
    setTargetPath(wsRoute ? wsRoute.path : firstIng?.path || '/healthz');
    setAuthHeader('');
    setRequestBody('');
    setVirtualUsers(50);
    setPeakVirtualUsers(50);
    setDurationSeconds(25);
    setRampUpSeconds(5);
    setTargetNamespace(selectedNamespace);
    setTargetWorkload(topology?.workloads[0]?.name || '');
    setSafetyAbortMemoryPercent(85);
  };

  const handleSelectTestTypePreset = (selectedType: PerformanceTestType) => {
    setTestType(selectedType);
    const meta = TEST_TYPE_CATALOG.find((c) => c.type === selectedType);
    if (meta) {
      setName(`[${meta.title}] ${meta.subtitle} (${targetPath})`);
      setDescription(meta.purpose);
    }

    if (selectedType === 'LOAD_TEST') {
      setVirtualUsers(50);
      setPeakVirtualUsers(50);
      setDurationSeconds(25);
      setRampUpSeconds(5);
    } else if (selectedType === 'STRESS_TEST') {
      setVirtualUsers(30);
      setPeakVirtualUsers(300);
      setDurationSeconds(30);
      setRampUpSeconds(5);
    } else if (selectedType === 'SPIKE_TEST') {
      setVirtualUsers(20);
      setPeakVirtualUsers(200);
      setDurationSeconds(25);
      setRampUpSeconds(2);
    }
  };

  const buildPayload = () => {
    const headers: Record<string, string> = {};
    if (authHeader.trim()) {
      headers['Authorization'] = authHeader.trim();
    }
    return {
      id,
      clusterId: cluster.id,
      name: name.trim() || 'Kịch bản Kiểm thử',
      description: description.trim(),
      testType,
      protocol,
      method,
      targetBaseUrl: targetBaseUrl.trim(),
      targetPath: targetPath.trim() || '/',
      headers,
      requestBody: requestBody.trim() || undefined,
      virtualUsers: Number(virtualUsers) || 10,
      peakVirtualUsers: Number(peakVirtualUsers) || Number(virtualUsers) || 10,
      durationSeconds: Number(durationSeconds) || 25,
      rampUpSeconds: Number(rampUpSeconds) || 3,
      targetNamespace: targetNamespace || selectedNamespace,
      targetWorkload: targetWorkload || undefined,
      safetyAbortMemoryPercent: Number(safetyAbortMemoryPercent) || 85,
    };
  };

  const handleSaveOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await onSaveScenario(buildPayload());
      onSelectScenario(saved.id);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndRun = async () => {
    setBusy(true);
    try {
      const saved = await onSaveScenario(buildPayload());
      onSelectScenario(saved.id);
      await onRunScenarioAndProceed(saved.id);
    } finally {
      setBusy(false);
    }
  };

  const showPeak = testType === 'STRESS_TEST' || testType === 'SPIKE_TEST';
  const activeMeta = TEST_TYPE_CATALOG.find((c) => c.type === testType) || TEST_TYPE_CATALOG[0];

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT 4 COLS: SCENARIO LIST (COMPACT, FIXED SCROLL CONTAINER) */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Kịch bản ({scenarios.length})
            </h2>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
              {selectedNamespace}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1"
              title="Sinh bộ 3 kịch bản: Load, Stress, Spike"
            >
              <Sparkles className="w-3 h-3" /> Bộ 3 Kịch bản
            </button>
            <button
              type="button"
              onClick={handleInitNewBlankScenario}
              className="rounded-lg bg-cyan-500 px-2 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Mới
            </button>
          </div>
        </div>

        {scenarios.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-5 text-center space-y-2.5">
            <p className="text-xs text-slate-400 leading-relaxed">
              Chưa có kịch bản nào. Bấm nút dưới để tạo tự động bộ 3 kịch bản chuẩn!
            </p>
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              <Sparkles className="w-3.5 h-3.5" /> Tạo Bộ 3 Kịch bản
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
            {scenarios.map((scen) => {
              const selected = scen.id === id;
              const sType = scen.testType || 'LOAD_TEST';
              const meta =
                TEST_TYPE_CATALOG.find((c) => c.type === sType) || TEST_TYPE_CATALOG[0];
              return (
                <div
                  key={scen.id}
                  onClick={() => onSelectScenario(scen.id)}
                  className={`cursor-pointer rounded-xl border p-2.5 transition flex flex-col gap-1 ${
                    selected
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-sm'
                      : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">
                      {scen.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScenario(scen.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`px-1.5 py-0.2 rounded border ${meta.activeBg}`}>
                      {sType === 'LOAD_TEST' ? 'LOAD' : sType === 'STRESS_TEST' ? 'STRESS' : 'SPIKE'} (
                      {scen.peakVirtualUsers && scen.peakVirtualUsers > scen.virtualUsers
                        ? `${scen.virtualUsers}→${scen.peakVirtualUsers}`
                        : scen.virtualUsers}{' '}
                      VUs)
                    </span>
                    <span className="text-slate-400 truncate max-w-[120px]">
                      {scen.targetPath}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT 8 COLS: MINIMALIST SCENARIO STUDIO (ZERO SCROLL FIT) */}
      <form
        onSubmit={handleSaveOnly}
        className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3.5"
      >
        {/* COMPACT TOP ACTION BAR */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Thiết Kế Kịch Bản Kiểm Thử</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {protocol}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400 transition"
            >
              {savedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã lưu
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-cyan-400" /> Lưu
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleSaveAndRun}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:opacity-95 shadow transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Chạy Kiểm Thử Thật (Bước 4)
            </button>
          </div>
        </div>

        {/* 1. THREE CORE PRESET TABS (MINIMALIST SEGMENTED CONTROL) */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-2">
            {TEST_TYPE_CATALOG.map((item) => {
              const isSelected = testType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleSelectTestTypePreset(item.type)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 relative ${
                    isSelected
                      ? `${item.accentBorder} bg-slate-950 shadow-sm ring-1 ring-cyan-500/30`
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {item.icon}
                      {item.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? item.activeBg : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badgeLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* COMPACT SINGLE-LINE ARCHITECTURAL FLOW BADGE */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-indigo-400 font-bold">KubePulse ({virtualUsers}{showPeak ? `➔${peakVirtualUsers}` : ''} VUs)</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-amber-400 font-bold">Ingress ({targetPath})</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-emerald-400 font-bold">Pod ({targetWorkload || 'gateway'})</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-sky-400 font-bold">DB / Microservices</span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[280px]">
              {activeMeta.flowDescription}
            </span>
          </div>
        </div>

        {/* 2. TARGET ENDPOINT ROW (METHOD + PROTOCOL + BASE URL + PATH) */}
        <div className="grid grid-cols-12 gap-2">
          {protocol === 'HTTP' && (
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          )}

          <div className={protocol === 'HTTP' ? 'col-span-3' : 'col-span-4'}>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Giao thức</label>
            <select
              value={protocol}
              onChange={(e) => {
                const p = e.target.value as ScenarioProtocol;
                setProtocol(p);
                if (p === 'WEBSOCKET') {
                  setTargetBaseUrl((prev) =>
                    prev.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
                  );
                } else {
                  setTargetBaseUrl((prev) =>
                    prev.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:')
                  );
                }
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="WEBSOCKET">WebSocket (WSS)</option>
              <option value="HTTP">HTTP / REST API</option>
            </select>
          </div>

          <div className={protocol === 'HTTP' ? 'col-span-4' : 'col-span-5'}>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Host / Target URL *</label>
            <input
              type="text"
              required
              value={targetBaseUrl}
              onChange={(e) => setTargetBaseUrl(e.target.value)}
              placeholder="wss://fumifood.dpdns.org hoặc https://..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="col-span-3">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Đường dẫn (Path) *</label>
            <input
              type="text"
              required
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/ws"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* 3. COMPACT TRAFFIC & DURATION CONTROLS */}
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* VUs / Base Users */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium">
                  {testType === 'STRESS_TEST' ? 'Khởi điểm' : testType === 'SPIKE_TEST' ? 'Tải nền' : 'VUs Đều'}:
                </span>
                <span className="font-mono font-bold text-cyan-300">{virtualUsers} VUs</span>
              </div>
              <input
                type="range"
                min={1}
                max={300}
                value={virtualUsers}
                onChange={(e) => setVirtualUsers(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Peak VUs (for Stress / Spike) or SLA Target */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium">
                  {showPeak ? (testType === 'SPIKE_TEST' ? 'Đỉnh Sốc 10x' : 'Đỉnh Gãy') : 'Mục tiêu SLA'}:
                </span>
                <span className={`font-mono font-bold ${showPeak ? 'text-rose-400' : 'text-slate-300'}`}>
                  {showPeak ? `${peakVirtualUsers} VUs` : `${virtualUsers} VUs`}
                </span>
              </div>
              {showPeak ? (
                <input
                  type="range"
                  min={virtualUsers}
                  max={800}
                  step={10}
                  value={peakVirtualUsers}
                  onChange={(e) => setPeakVirtualUsers(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
              ) : (
                <div className="text-[10px] text-slate-500 py-1 font-mono">Duy trì mức ổn định</div>
              )}
            </div>

            {/* Duration */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium">Thời lượng:</span>
                <span className="font-mono font-bold text-emerald-300">{durationSeconds}s</span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Safety Circuit Breaker */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-amber-400 font-medium">Cầu chì Pod:</span>
                <span className="font-mono font-bold text-amber-300">{safetyAbortMemoryPercent}% RAM</span>
              </div>
              <input
                type="range"
                min={50}
                max={98}
                value={safetyAbortMemoryPercent}
                onChange={(e) => setSafetyAbortMemoryPercent(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>

        {/* 4. COLLAPSIBLE ADVANCED CONFIG (AUTH / WORKLOAD / PAYLOAD) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Tùy chọn Nâng cao (Authorization, Pod Target, Request Body)
          </button>

          {showAdvanced && (
            <div className="mt-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tên Kịch bản</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Mục tiêu Pod Workload (K8s)</label>
                  <input
                    type="text"
                    value={targetWorkload}
                    onChange={(e) => setTargetWorkload(e.target.value)}
                    placeholder="fumi-live-gateway"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Authorization Header (JWT / Token)</label>
                <input
                  type="text"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="Bearer eyJhbGciOi..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {protocol === 'HTTP' && (method === 'POST' || method === 'PUT') && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">JSON Request Body</label>
                  <textarea
                    rows={2}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"action": "test"}'
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
