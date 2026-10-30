import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Play,
  Save,
  Check,
  Activity,
  Flame,
  Zap,
  ArrowRight,
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
  whenToUse: string;
  curveShape: 'trapezoid' | 'staircase' | 'spike';
  accentBorder: string;
  activeBg: string;
  activeBorder: string;
  textColor: string;
  icon: React.ReactNode;
}> = [
  {
    type: 'LOAD_TEST',
    title: '1. Load Testing',
    badgeLabel: 'Baseline SLA',
    subtitle: 'Tải Ổn Định Cam Kết',
    purpose: 'Kiểm tra hệ thống chạy ổn định ở mức tải dự kiến thường ngày, đối chiếu SLA p95 và RAM/CPU nền.',
    whenToUse: 'Dùng để nghiệm thu định kỳ & kiểm tra cam kết SLA với khách hàng.',
    curveShape: 'trapezoid',
    accentBorder: 'border-cyan-500/40',
    activeBg: 'bg-cyan-950/40',
    activeBorder: 'border-cyan-400',
    textColor: 'text-cyan-400',
    icon: <Activity className="w-4 h-4 text-cyan-400" />,
  },
  {
    type: 'STRESS_TEST',
    title: '2. Stress Testing',
    badgeLabel: 'Breaking Point',
    subtitle: 'Tìm Điểm Gãy Bậc Thang',
    purpose: 'Tăng tải 5 nấc liên tục vượt ngưỡng chịu đựng để tìm chính xác giới hạn nghẽn hoặc sập (429, 5xx, OOM).',
    whenToUse: 'Dùng để xác định điểm giới hạn và thiết lập quy tắc tự động co giãn HPA.',
    curveShape: 'staircase',
    accentBorder: 'border-rose-500/40',
    activeBg: 'bg-rose-950/40',
    activeBorder: 'border-rose-400',
    textColor: 'text-rose-400',
    icon: <Flame className="w-4 h-4 text-rose-400" />,
  },
  {
    type: 'SPIKE_TEST',
    title: '3. Spike Testing',
    badgeLabel: '10x Flash Sale',
    subtitle: 'Sốc Tải & Đo Tự Phục Hồi',
    purpose: 'Đang chạy tải nền thấp thì tăng vọt 10x đột ngột trong vài giây rồi hạ để đo thời gian hồi phục (Recovery Time).',
    whenToUse: 'Dùng trước các sự kiện mở bán Flash Sale hoặc chiến dịch Marketing lớn.',
    curveShape: 'spike',
    accentBorder: 'border-amber-500/40',
    activeBg: 'bg-amber-950/40',
    activeBorder: 'border-amber-400',
    textColor: 'text-amber-400',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
];

// Sleek high-contrast curve preview visualizer
const MiniCurvePreview: React.FC<{ shape: 'trapezoid' | 'staircase' | 'spike'; active: boolean }> = ({
  shape,
  active,
}) => {
  if (shape === 'trapezoid') {
    return (
      <svg className="w-full h-11" viewBox="0 0 120 36" fill="none">
        <path
          d="M 6 30 L 26 10 L 94 10 L 114 30"
          stroke={active ? '#22d3ee' : '#475569'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {active && (
          <>
            <path d="M 6 30 L 26 10 L 94 10 L 114 30 L 6 30 Z" fill="url(#cyan-grad)" opacity="0.15" />
            <circle cx="60" cy="10" r="3.5" fill="#22d3ee" className="animate-ping" />
          </>
        )}
        <circle cx="60" cy="10" r="3" fill="#ffffff" stroke="#22d3ee" strokeWidth="1.5" />
        <defs>
          <linearGradient id="cyan-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (shape === 'staircase') {
    return (
      <svg className="w-full h-11" viewBox="0 0 120 36" fill="none">
        <path
          d="M 6 30 L 26 30 L 26 22 L 50 22 L 50 14 L 74 14 L 74 7 L 100 7 L 114 7"
          stroke={active ? '#fb7185' : '#475569'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {active && (
          <circle cx="106" cy="7" r="3.5" fill="#fb7185" className="animate-ping" />
        )}
        <circle cx="106" cy="7" r="3" fill="#ffffff" stroke="#fb7185" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className="w-full h-11" viewBox="0 0 120 36" fill="none">
      <path
        d="M 6 30 L 42 30 L 56 6 L 68 6 L 82 30 L 114 30"
        stroke={active ? '#fbbf24' : '#475569'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active && (
        <circle cx="62" cy="6" r="3.5" fill="#fbbf24" className="animate-ping" />
      )}
      <circle cx="62" cy="6" r="3" fill="#ffffff" stroke="#fbbf24" strokeWidth="1.5" />
    </svg>
  );
};

export const Step3ScenarioStudio: React.FC<Step3ScenarioStudioProps> = ({
  cluster,
  selectedNamespace,
  topology,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onSaveScenario,
  onRunScenarioAndProceed,
}) => {
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const [id, setId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [testType, setTestType] = useState<PerformanceTestType>('LOAD_TEST');
  const [protocol, setProtocol] = useState<ScenarioProtocol>('WEBSOCKET');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [targetBaseUrl, setTargetBaseUrl] = useState('');
  const [targetPath, setTargetPath] = useState('/ws');
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

  // Sync form when activeScenario changes with strict protocol URL coercion
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
      
      const proto = activeScenario.protocol;
      setProtocol(proto);
      setMethod(activeScenario.method);

      // Enforce: WebSocket MUST use wss:// or ws://; HTTP MUST use https:// or http://
      let bUrl = activeScenario.targetBaseUrl || '';
      if (proto === 'WEBSOCKET') {
        bUrl = bUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
        if (!bUrl.startsWith('ws://') && !bUrl.startsWith('wss://')) {
          bUrl = 'wss://' + bUrl.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
        }
      } else {
        bUrl = bUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
        if (!bUrl.startsWith('http://') && !bUrl.startsWith('https://')) {
          bUrl = 'https://' + bUrl.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
        }
      }
      setTargetBaseUrl(bUrl);

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
    const isDefaultWs = Boolean(wsRoute);
    const defaultUrl = wsRoute
      ? `${wsRoute.tlsEnabled ? 'wss' : 'ws'}://${wsRoute.host}`
      : firstIng
        ? `${firstIng.tlsEnabled ? 'https' : 'http'}://${firstIng.host}`
        : cluster.externalBaseUrl
          ? (isDefaultWs ? cluster.externalBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') : cluster.externalBaseUrl)
          : (isDefaultWs ? 'wss://fumifood.dpdns.org' : 'https://fumifood.dpdns.org');

    setId(undefined);
    setName(`[1. Load Test] Tải Chuẩn SLA (${selectedNamespace})`);
    setDescription('Kiểm tra tải ổn định đối chiếu SLA và CPU/RAM Pod K8s');
    setTestType('LOAD_TEST');
    setProtocol(isDefaultWs ? 'WEBSOCKET' : 'HTTP');
    setMethod('GET');
    setTargetBaseUrl(defaultUrl);
    setTargetPath(wsRoute ? wsRoute.path : firstIng?.path || '/ws');
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

  // Safe Protocol Switcher enforcing URL scheme synchronization
  const handleProtocolChange = (p: ScenarioProtocol) => {
    setProtocol(p);
    setTargetBaseUrl((prev) => {
      let url = prev.trim();
      if (p === 'WEBSOCKET') {
        url = url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          url = 'wss://' + url.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
        }
        if (targetPath === '/' || targetPath === '/healthz') {
          setTargetPath('/ws');
        }
      } else {
        url = url.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
        }
        if (targetPath === '/ws') {
          setTargetPath('/healthz');
        }
      }
      return url;
    });
  };

  const buildPayload = () => {
    const headers: Record<string, string> = {};
    if (authHeader.trim()) {
      headers['Authorization'] = authHeader.trim();
    }

    // Strict URL sanity check before emitting payload
    let finalBaseUrl = targetBaseUrl.trim();
    if (protocol === 'WEBSOCKET') {
      finalBaseUrl = finalBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      if (!finalBaseUrl.startsWith('ws://') && !finalBaseUrl.startsWith('wss://')) {
        finalBaseUrl = 'wss://' + finalBaseUrl.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
      }
    } else {
      finalBaseUrl = finalBaseUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
      if (!finalBaseUrl.startsWith('http://') && !finalBaseUrl.startsWith('https://')) {
        finalBaseUrl = 'https://' + finalBaseUrl.replace(/^(wss?:\/\/|https?:\/\/)?/, '');
      }
    }

    return {
      id,
      clusterId: cluster.id,
      name: name.trim() || 'Kịch bản Kiểm thử',
      description: description.trim(),
      testType,
      protocol,
      method,
      targetBaseUrl: finalBaseUrl,
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
    <div className="max-w-6xl w-full mx-auto space-y-3.5">
      <form
        onSubmit={handleSaveOnly}
        className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 space-y-4 shadow-xl"
      >
        {/* TOP ACTION HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Bước 3: Thiết Kế Kịch Bản Kiểm Thử
              </h2>
              <p className="text-xs text-slate-400">
                Chọn 1 trong 3 mô hình kịch bản chuẩn và tinh chỉnh thông số chịu tải
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white transition shadow-sm"
            >
              {savedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã lưu
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-cyan-400" /> Lưu Kịch bản
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={handleSaveAndRun}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:opacity-95 shadow-md shadow-cyan-950/40 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Lưu & Chạy Thật (Sang Bước 4)
            </button>
          </div>
        </div>

        {/* 1. THREE DISTINCT TEST TYPE PRESET CARDS WITH CURVES */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TEST_TYPE_CATALOG.map((item) => {
              const isSelected = testType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleSelectTestTypePreset(item.type)}
                  className={`p-3.5 sm:p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-2 relative ${
                    isSelected
                      ? `${item.activeBorder} ${item.activeBg} shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/40`
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      {item.icon}
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${item.accentBorder} ${item.textColor}`}
                    >
                      {item.badgeLabel}
                    </span>
                  </div>

                  {/* Curve Visualizer */}
                  <div className="bg-slate-950/90 rounded-xl p-1.5 border border-slate-800/80 my-0.5">
                    <MiniCurvePreview shape={item.curveShape} active={isSelected} />
                  </div>

                  <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                    {item.purpose}
                  </p>
                </button>
              );
            })}
          </div>

          {/* EXPECTED WIRING FLOW PREVIEW */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-indigo-300 font-bold bg-indigo-950/70 px-2 py-0.5 rounded-lg border border-indigo-500/40">
                1. KubePulse ({virtualUsers}{showPeak ? ` ➔ ${peakVirtualUsers}` : ''} VUs)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-amber-300 font-bold bg-amber-950/70 px-2 py-0.5 rounded-lg border border-amber-500/40">
                2. Ingress {protocol === 'WEBSOCKET' ? 'WSS' : 'HTTPS'} ({targetPath})
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-emerald-300 font-bold bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                3. Pod ({targetWorkload || 'gateway'})
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-sky-300 font-bold bg-sky-950/70 px-2 py-0.5 rounded-lg border border-sky-500/40">
                4. Database
              </span>
            </div>
            <span className="text-xs text-slate-400 italic">
              {activeMeta.whenToUse}
            </span>
          </div>
        </div>

        {/* 2. TARGET ENDPOINT CONFIGURATION CARD */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
            <span>Cấu Hình Điểm Đích (Target Endpoint)</span>
            <span className="text-[11px] font-normal text-slate-400 lowercase">
              Tự động chuẩn hóa {protocol === 'WEBSOCKET' ? 'wss://' : 'https://'}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-2.5">
            {protocol === 'HTTP' && (
              <div className="col-span-12 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Phương thức</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            )}

            <div className={protocol === 'HTTP' ? 'col-span-12 sm:col-span-3' : 'col-span-12 sm:col-span-4'}>
              <label className="block text-xs font-medium text-slate-400 mb-1">Giao thức</label>
              <select
                value={protocol}
                onChange={(e) => handleProtocolChange(e.target.value as ScenarioProtocol)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-cyan-300 focus:border-cyan-400 focus:outline-none font-bold"
              >
                <option value="WEBSOCKET">WebSocket (WSS / WS)</option>
                <option value="HTTP">HTTP / REST API (HTTPS / HTTP)</option>
              </select>
            </div>

            <div className={protocol === 'HTTP' ? 'col-span-12 sm:col-span-4' : 'col-span-12 sm:col-span-5'}>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Host / Domain *
              </label>
              <input
                type="text"
                required
                value={targetBaseUrl}
                onChange={(e) => setTargetBaseUrl(e.target.value)}
                onBlur={() => {
                  if (protocol === 'WEBSOCKET' && targetBaseUrl.startsWith('http')) {
                    setTargetBaseUrl((prev) =>
                      prev.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
                    );
                  } else if (protocol === 'HTTP' && targetBaseUrl.startsWith('ws')) {
                    setTargetBaseUrl((prev) =>
                      prev.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:')
                    );
                  }
                }}
                placeholder={protocol === 'WEBSOCKET' ? 'wss://fumifood.dpdns.org' : 'https://fumifood.dpdns.org'}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none font-semibold"
              />
            </div>

            <div className="col-span-12 sm:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Đường dẫn (Path) *
              </label>
              <input
                type="text"
                required
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder={protocol === 'WEBSOCKET' ? '/ws' : '/healthz'}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none font-semibold"
              />
            </div>
          </div>
        </div>

        {/* 3. PROMINENT TRAFFIC & DURATION SLIDERS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* VUs Base */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400 font-medium">
                {testType === 'STRESS_TEST' ? 'Khởi điểm' : testType === 'SPIKE_TEST' ? 'Tải nền' : 'VUs Đều'}:
              </span>
              <span className="font-mono text-xl font-black text-cyan-400">{virtualUsers} VUs</span>
            </div>
            <input
              type="range"
              min={1}
              max={300}
              value={virtualUsers}
              onChange={(e) => setVirtualUsers(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 font-mono">Người dùng gửi request đồng thời</div>
          </div>

          {/* Peak VUs */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400 font-medium">
                {showPeak ? (testType === 'SPIKE_TEST' ? 'Đỉnh Sốc 10x' : 'Đỉnh Gãy') : 'Mục tiêu SLA'}:
              </span>
              <span className={`font-mono text-xl font-black ${showPeak ? 'text-rose-400' : 'text-slate-300'}`}>
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
                className="w-full accent-rose-400 cursor-pointer"
              />
            ) : (
              <div className="h-6 flex items-center text-[10px] text-slate-400 font-mono">Duy trì mức ổn định</div>
            )}
            <div className="text-[10px] text-slate-400 font-mono">Ngưỡng áp lực lớn nhất thử nghiệm</div>
          </div>

          {/* Duration */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400 font-medium">Thời lượng test:</span>
              <span className="font-mono text-xl font-black text-emerald-400">{durationSeconds}s</span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 font-mono">Tổng thời gian kịch bản chạy</div>
          </div>

          {/* Safety Breaker */}
          <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-amber-400 font-medium">Cầu chì an toàn:</span>
              <span className="font-mono text-xl font-black text-amber-300">{safetyAbortMemoryPercent}% RAM</span>
            </div>
            <input
              type="range"
              min={50}
              max={98}
              value={safetyAbortMemoryPercent}
              onChange={(e) => setSafetyAbortMemoryPercent(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 font-mono">Tự ngắt để chống sập Pod K8s</div>
          </div>
        </div>

        {/* 4. COLLAPSIBLE ADVANCED CONFIG */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition py-0.5"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Tùy chọn Nâng cao (Authorization JWT, Pod Target K8s, Request Body)
          </button>

          {showAdvanced && (
            <div className="mt-2 p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tên Kịch bản</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mục tiêu Pod Workload (K8s)</label>
                  <input
                    type="text"
                    value={targetWorkload}
                    onChange={(e) => setTargetWorkload(e.target.value)}
                    placeholder="fumi-live-gateway"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Authorization Header (JWT / Token)</label>
                <input
                  type="text"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="Bearer eyJhbGciOi..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {protocol === 'HTTP' && (method === 'POST' || method === 'PUT') && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">JSON Request Body</label>
                  <textarea
                    rows={2}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"action": "test"}'
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
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
