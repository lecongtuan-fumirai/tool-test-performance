import React, { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Save,
  Trash2,
  Sliders,
  ShieldAlert,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  ClusterConnectionPublic,
  NamespaceTopologySnapshot,
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
  const [protocol, setProtocol] = useState<ScenarioProtocol>('HTTP');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [targetBaseUrl, setTargetBaseUrl] = useState('');
  const [targetPath, setTargetPath] = useState('/healthz');
  const [authHeader, setAuthHeader] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [virtualUsers, setVirtualUsers] = useState(20);
  const [durationSeconds, setDurationSeconds] = useState(15);
  const [rampUpSeconds, setRampUpSeconds] = useState(5);
  const [targetNamespace, setTargetNamespace] = useState(selectedNamespace);
  const [targetWorkload, setTargetWorkload] = useState('');
  const [safetyAbortMemoryPercent, setSafetyAbortMemoryPercent] = useState(85);
  const [savedToast, setSavedToast] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync form when activeScenario changes
  useEffect(() => {
    if (activeScenario) {
      setId(activeScenario.id);
      setName(activeScenario.name);
      setDescription(activeScenario.description);
      setProtocol(activeScenario.protocol);
      setMethod(activeScenario.method);
      setTargetBaseUrl(activeScenario.targetBaseUrl);
      setTargetPath(activeScenario.targetPath);
      setAuthHeader(activeScenario.headers?.['Authorization'] || '');
      setRequestBody(activeScenario.requestBody || '');
      setVirtualUsers(activeScenario.virtualUsers);
      setDurationSeconds(activeScenario.durationSeconds);
      setRampUpSeconds(activeScenario.rampUpSeconds);
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
    const firstIng = topology?.ingresses[0];
    const defaultUrl = firstIng
      ? `${firstIng.tlsEnabled ? 'https' : 'http'}://${firstIng.host}`
      : cluster.externalBaseUrl || 'https://localhost';

    setId(undefined);
    setName(`Kịch bản Kiểm thử Mới (${selectedNamespace})`);
    setDescription('Kiểm thử chịu tải & đối chiếu tài nguyên thực tế trên K8s');
    setProtocol('HTTP');
    setMethod('GET');
    setTargetBaseUrl(defaultUrl);
    setTargetPath(firstIng?.path || '/healthz');
    setAuthHeader('');
    setRequestBody('');
    setVirtualUsers(20);
    setDurationSeconds(15);
    setRampUpSeconds(5);
    setTargetNamespace(selectedNamespace);
    setTargetWorkload(topology?.workloads[0]?.name || '');
    setSafetyAbortMemoryPercent(85);
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
      protocol,
      method,
      targetBaseUrl: targetBaseUrl.trim(),
      targetPath: targetPath.trim() || '/',
      headers,
      requestBody: requestBody.trim() || undefined,
      virtualUsers: Number(virtualUsers) || 10,
      durationSeconds: Number(durationSeconds) || 15,
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

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT 4 COLS: SAVED SCENARIO LIST */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Danh sách Kịch bản</h2>
            <p className="text-[11px] text-slate-400">
              Cụm: {cluster.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1"
              title="Tự động tạo kịch bản từ các đường dẫn Ingress thực tế"
            >
              <Sparkles className="w-3.5 h-3.5" /> Tự sinh
            </button>
            <button
              type="button"
              onClick={handleInitNewBlankScenario}
              className="rounded-lg bg-cyan-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo mới
            </button>
          </div>
        </div>

        {scenarios.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center space-y-3">
            <p className="text-xs text-slate-400">
              Chưa có kịch bản nào cho cụm này.
            </p>
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              <Sparkles className="w-4 h-4" />
              Tự động tạo từ Ingress của {selectedNamespace}
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {scenarios.map((scen) => {
              const selected = scen.id === id;
              return (
                <div
                  key={scen.id}
                  onClick={() => onSelectScenario(scen.id)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition ${
                    selected
                      ? 'border-cyan-400 bg-cyan-950/30 shadow'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white leading-snug">
                      {scen.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScenario(scen.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-300">
                      {scen.protocol} ({scen.virtualUsers} VU / {scen.durationSeconds}s)
                    </span>
                    <span className="text-slate-400 truncate max-w-[130px]">
                      {scen.targetPath}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT 8 COLS: DYNAMIC SCENARIO CONFIG FORM */}
      <form
        onSubmit={handleSaveOnly}
        className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/75 p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                Bước 3: Thiết kế & Tùy chỉnh Tham số Kịch bản
              </h2>
              <p className="text-xs text-slate-400">
                Mọi thông số URL, đường dẫn, số lượng người dùng đồng thời và ngưỡng cầu chì đều có thể tùy chỉnh tự do.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400"
            >
              {savedToast ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" /> Đã lưu
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-cyan-400" /> Lưu Kịch bản
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleSaveAndRun}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:opacity-95 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              Lưu & Chạy Kiểm thử Thật (Sang Bước 4)
            </button>
          </div>
        </div>

        {/* Name & Protocol */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tên Kịch bản *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Giao thức Kiểm thử (Protocol)
            </label>
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="HTTP">HTTP / REST Load Test</option>
              <option value="WEBSOCKET">WebSocket Realtime Stream</option>
              <option value="SECURITY_AUDIT">Security & K8s Spec Audit</option>
            </select>
          </div>
        </div>

        {/* Target URL & Path with Quick-Select from Discovered Ingresses */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Địa chỉ Đích & Đường dẫn (Target Endpoint)
            </span>
            {topology && topology.ingresses.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">
                  Chọn nhanh từ Ingress:
                </span>
                {topology.ingresses.map((r, idx) => (
                  <button
                    key={`${r.path}-${idx}`}
                    type="button"
                    onClick={() => {
                      const isWs = r.protocol === 'WSS';
                      setProtocol(isWs ? 'WEBSOCKET' : 'HTTP');
                      setTargetBaseUrl(
                        `${isWs ? (r.tlsEnabled ? 'wss' : 'ws') : r.tlsEnabled ? 'https' : 'http'}://${r.host}`
                      );
                      setTargetPath(r.path);
                    }}
                    className="rounded-md bg-slate-900 border border-slate-700 hover:border-cyan-400 px-2 py-0.5 font-mono text-[11px] text-cyan-300"
                  >
                    {r.path}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {protocol !== 'WEBSOCKET' && (
              <div className="md:col-span-1">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono text-xs text-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            )}

            <div className={protocol === 'WEBSOCKET' ? 'md:col-span-4' : 'md:col-span-3'}>
              <label className="block text-[11px] text-slate-400 mb-1">
                Base URL (https://... hoặc wss://...)
              </label>
              <input
                type="text"
                required
                value={targetBaseUrl}
                onChange={(e) => setTargetBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">
                Đường dẫn (Path)
              </label>
              <input
                type="text"
                required
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/healthz"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-cyan-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Authorization Header (Tùy chọn - VD: Bearer eyJ...)
              </label>
              <input
                type="text"
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="Bearer <JWT_TOKEN>"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-200"
              />
            </div>
            {(method === 'POST' || method === 'PUT') && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  JSON Request Body (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-200"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sliders: Load Scale & Duration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">
                Số Người dùng (Virtual Users):
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {virtualUsers} VU
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={virtualUsers}
              onChange={(e) => setVirtualUsers(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <span className="text-[10px] text-slate-400">
              Số luồng kết nối thật bắn đồng thời từ máy của bạn
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">
                Thời gian chạy (Duration):
              </span>
              <span className="font-mono font-bold text-emerald-300">
                {durationSeconds} giây
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <span className="text-[10px] text-slate-400">
              Tổng thời lượng thực hiện bài kiểm thử
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">
                Thời gian tăng tốc (Ramp-up):
              </span>
              <span className="font-mono font-bold text-purple-300">
                {rampUpSeconds} giây
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={rampUpSeconds}
              onChange={(e) => setRampUpSeconds(Number(e.target.value))}
              className="w-full accent-purple-400"
            />
            <span className="text-[10px] text-slate-400">
              Tăng dần người dùng để quan sát điểm nghẽn
            </span>
          </div>
        </div>

        {/* K8s Correlation Scope & Safety Circuit Breaker */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4" />
            Đối chiếu K8s & Cầu chì Tự ngắt An toàn (Safety Circuit Breaker)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-slate-300 mb-1">
                K8s Namespace Giám sát
              </label>
              <input
                type="text"
                value={targetNamespace}
                onChange={(e) => setTargetNamespace(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 mb-1">
                Workload (Deployment / Pod) Giám sát
              </label>
              <select
                value={targetWorkload}
                onChange={(e) => setTargetWorkload(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white"
              >
                <option value="">-- Tự động lấy Pod đầu tiên --</option>
                {topology?.workloads.map((w) => (
                  <option key={w.name} value={w.name}>
                    {w.name} (Limit: {w.memoryLimitMi ? `${w.memoryLimitMi}Mi` : 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-amber-200 font-medium">
                  Ngưỡng Cầu chì Tự ngắt RAM:
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {safetyAbortMemoryPercent}% Limit
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={safetyAbortMemoryPercent}
                onChange={(e) => setSafetyAbortMemoryPercent(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

