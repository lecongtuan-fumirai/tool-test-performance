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
  Activity,
  Flame,
  Zap,
  Clock,
  TrendingUp,
  Database,
  ShieldCheck,
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

const TEST_TYPE_CATALOG: Array<{
  type: PerformanceTestType;
  group: 'PERFORMANCE' | 'SECURITY';
  automation?: 'Có' | 'Một phần';
  title: string;
  purpose: string;
  example: string;
  badgeColor: string;
  icon: React.ReactNode;
}> = [
  // === 6 PERFORMANCE TESTING TYPES ===
  {
    type: 'LOAD_TEST',
    group: 'PERFORMANCE',
    title: '1. Load Testing',
    purpose: 'Kiểm tra hệ thống với tải dự kiến',
    example: 'VD: 1.000 users truy cập cùng lúc',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    icon: <Activity className="w-4 h-4 text-cyan-400" />,
  },
  {
    type: 'STRESS_TEST',
    group: 'PERFORMANCE',
    title: '2. Stress Testing',
    purpose: 'Tăng tải vượt giới hạn để tìm điểm gãy',
    example: 'VD: Tăng bậc thang từ 1.000 lên 10.000 users',
    badgeColor: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    icon: <Flame className="w-4 h-4 text-rose-400" />,
  },
  {
    type: 'SPIKE_TEST',
    group: 'PERFORMANCE',
    title: '3. Spike Testing',
    purpose: 'Kiểm tra khi tải tăng hoặc giảm đột ngột',
    example: 'VD: Traffic tăng 10 lần trong 1 phút',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
  },
  {
    type: 'SOAK_ENDURANCE_TEST',
    group: 'PERFORMANCE',
    title: '4. Endurance / Soak Testing',
    purpose: 'Kiểm tra hệ thống khi chịu tải lâu dài',
    example: 'VD: 500 users chạy liên tục nhiều giờ (Dò Memory Leak)',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    icon: <Clock className="w-4 h-4 text-emerald-400" />,
  },
  {
    type: 'SCALABILITY_TEST',
    group: 'PERFORMANCE',
    title: '5. Scalability Testing',
    purpose: 'Kiểm tra khả năng mở rộng khi tăng tài nguyên',
    example: 'VD: Tăng số Pod từ 2 lên 10 & đo RPS/Pod',
    badgeColor: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
    icon: <TrendingUp className="w-4 h-4 text-indigo-400" />,
  },
  {
    type: 'VOLUME_TEST',
    group: 'PERFORMANCE',
    title: '6. Volume Testing',
    purpose: 'Kiểm tra khi dữ liệu có khối lượng lớn',
    example: 'VD: Payload lớn (64KB–512KB) / Truy vấn bản ghi lớn',
    badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    icon: <Database className="w-4 h-4 text-purple-400" />,
  },
  // === 5 SECURITY TESTING TYPES ===
  {
    type: 'SECURITY_DAST',
    group: 'SECURITY',
    automation: 'Có',
    title: '7. DAST (Dynamic App Security)',
    purpose: 'Phát hiện một số lỗ hổng web khi chạy',
    example: 'Tự động: Có • Quét XSS/SQLi reflection, Security Headers',
    badgeColor: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
    icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,
  },
  {
    type: 'SECURITY_API',
    group: 'SECURITY',
    automation: 'Một phần',
    title: '8. API Security',
    purpose: 'Kiểm tra input, quyền và hành vi API',
    example: 'Tự động: Một phần • Kiểm tra Malformed JSON, CORS, Rate Limit',
    badgeColor: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    icon: <ShieldCheck className="w-4 h-4 text-sky-400" />,
  },
  {
    type: 'SECURITY_AUTH',
    group: 'SECURITY',
    automation: 'Một phần',
    title: '9. Authentication / Authorization',
    purpose: 'Xác minh các vai trò và quyền truy cập',
    example: 'Tự động: Một phần • Thử Token giả mạo (alg:none), kiểm tra RBAC/BOLA',
    badgeColor: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    icon: <ShieldAlert className="w-4 h-4 text-violet-400" />,
  },
  {
    type: 'SECURITY_INFRA',
    group: 'SECURITY',
    automation: 'Có',
    title: '10. Infrastructure Scan',
    purpose: 'Phát hiện cấu hình không an toàn',
    example: 'Tự động: Có • Kiểm toán K8s NetworkPolicy, Pod SecurityContext, TLS',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
  },
  {
    type: 'SECURITY_PENTEST',
    group: 'SECURITY',
    automation: 'Một phần',
    title: '11. Pentest (Exploit Chain)',
    purpose: 'Phát hiện chuỗi khai thác và lỗi logic phức tạp',
    example: 'Tự động: Một phần • Mô phỏng chuỗi Recon -> Path Traversal & Log Pod',
    badgeColor: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    icon: <ShieldAlert className="w-4 h-4 text-orange-400" />,
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
  const [targetPath, setTargetPath] = useState('/healthz');
  const [authHeader, setAuthHeader] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [virtualUsers, setVirtualUsers] = useState(50);
  const [peakVirtualUsers, setPeakVirtualUsers] = useState(200);
  const [volumePayloadKb, setVolumePayloadKb] = useState(64);
  const [targetPodReplicas, setTargetPodReplicas] = useState(6);
  const [durationSeconds, setDurationSeconds] = useState(20);
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
      setTestType(
        activeScenario.testType ||
          (activeScenario.protocol === 'SECURITY_AUDIT' ? 'SECURITY_AUDIT' : 'LOAD_TEST')
      );
      setProtocol(activeScenario.protocol);
      setMethod(activeScenario.method);
      setTargetBaseUrl(activeScenario.targetBaseUrl);
      setTargetPath(activeScenario.targetPath);
      setAuthHeader(activeScenario.headers?.['Authorization'] || '');
      setRequestBody(activeScenario.requestBody || '');
      setVirtualUsers(activeScenario.virtualUsers);
      setPeakVirtualUsers(activeScenario.peakVirtualUsers || activeScenario.virtualUsers * 4);
      setVolumePayloadKb(activeScenario.volumePayloadKb || 64);
      setTargetPodReplicas(activeScenario.targetPodReplicas || 6);
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
    setName(`[1. Load Testing] Kiểm thử Tải Dự kiến (${selectedNamespace})`);
    setDescription('Kiểm tra hệ thống với tải dự kiến và đối chiếu RAM/CPU thực tế trên K8s');
    setTestType('LOAD_TEST');
    setProtocol('HTTP');
    setMethod('GET');
    setTargetBaseUrl(defaultUrl);
    setTargetPath(firstIng?.path || '/healthz');
    setAuthHeader('');
    setRequestBody('');
    setVirtualUsers(50);
    setPeakVirtualUsers(250);
    setVolumePayloadKb(64);
    setTargetPodReplicas(6);
    setDurationSeconds(20);
    setRampUpSeconds(5);
    setTargetNamespace(selectedNamespace);
    setTargetWorkload(topology?.workloads[0]?.name || '');
    setSafetyAbortMemoryPercent(85);
  };

  const handleSelectTestTypePreset = (selectedType: PerformanceTestType) => {
    setTestType(selectedType);
    const meta = TEST_TYPE_CATALOG.find((c) => c.type === selectedType);
    if (meta) {
      setName(`[${meta.title}] ${meta.purpose} (${targetPath})`);
      setDescription(`${meta.purpose} — ${meta.example}`);
    }

    if (selectedType.startsWith('SECURITY_')) {
      setProtocol('SECURITY_AUDIT');
      setVirtualUsers(selectedType === 'SECURITY_PENTEST' ? 10 : 5);
      setDurationSeconds(selectedType === 'SECURITY_PENTEST' ? 15 : 10);
      if (selectedType === 'SECURITY_API') {
        setMethod('POST');
      } else {
        setMethod('GET');
      }
    } else {
      if (protocol === 'SECURITY_AUDIT') setProtocol('HTTP');
      if (selectedType === 'LOAD_TEST') {
        setVirtualUsers(50);
        setPeakVirtualUsers(50);
        setDurationSeconds(20);
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
      } else if (selectedType === 'SOAK_ENDURANCE_TEST') {
        setVirtualUsers(40);
        setPeakVirtualUsers(40);
        setDurationSeconds(90);
        setRampUpSeconds(10);
      } else if (selectedType === 'SCALABILITY_TEST') {
        setVirtualUsers(50);
        setPeakVirtualUsers(150);
        setTargetPodReplicas(8);
        setDurationSeconds(25);
        setRampUpSeconds(5);
      } else if (selectedType === 'VOLUME_TEST') {
        setMethod('POST');
        setVolumePayloadKb(64);
        setVirtualUsers(25);
        setDurationSeconds(20);
        setRampUpSeconds(4);
      }
    }
  };

  const buildPayload = () => {
    const headers: Record<string, string> = {};
    if (authHeader.trim()) {
      headers['Authorization'] = authHeader.trim();
    }
    if (testType === 'VOLUME_TEST' && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
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
      volumePayloadKb: Number(volumePayloadKb) || 64,
      targetPodReplicas: Number(targetPodReplicas) || 4,
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

  const showPeakSlider =
    testType === 'STRESS_TEST' ||
    testType === 'SPIKE_TEST' ||
    testType === 'SCALABILITY_TEST';

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT 4 COLS: SAVED SCENARIO LIST */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Bộ Kịch bản ({scenarios.length})
            </h2>
            <p className="text-[11px] text-slate-400">Cụm: {cluster.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1"
              title="Tự động tạo đủ 6 loại Performance Test + 5 loại Security Test từ hạ tầng K8s"
            >
              <Sparkles className="w-3.5 h-3.5" /> Sinh đủ 11 loại Test
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
              Chưa có kịch bản nào cho cụm này. Hãy bấm nút bên dưới để tự động tạo đủ 6 loại Performance Test chuẩn (Load, Stress, Spike, Soak, Scalability, Volume) + Security Audit!
            </p>
            <button
              type="button"
              onClick={onAutoGenerateScenarios}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              <Sparkles className="w-4 h-4" />
              Sinh Bộ 7 Kịch bản Chuẩn cho {selectedNamespace}
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
            {scenarios.map((scen) => {
              const selected = scen.id === id;
              const sType = scen.testType || 'LOAD_TEST';
              const meta =
                TEST_TYPE_CATALOG.find((c) => c.type === sType) || TEST_TYPE_CATALOG[0];
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
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                    {scen.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className={`rounded border px-1.5 py-0.5 ${meta.badgeColor}`}>
                      {sType} (
                      {scen.peakVirtualUsers && scen.peakVirtualUsers > scen.virtualUsers
                        ? `${scen.virtualUsers}→${scen.peakVirtualUsers} VU`
                        : `${scen.virtualUsers} VU`}{' '}
                      / {scen.durationSeconds}s)
                    </span>
                    <span className="text-slate-400 truncate max-w-[110px]">
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
                Bước 3: Chọn Loại Kiểm thử & Thiết kế Kịch bản Động
              </h2>
              <p className="text-xs text-slate-400">
                Hỗ trợ đầy đủ 6 loại Kiểm thử Hiệu năng chuẩn (Load, Stress, Spike, Soak, Scalability, Volume) & Kiểm toán Bảo mật.
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

        {/* 6 PERFORMANCE TEST TYPES + 5 SECURITY TEST TYPES SELECTOR GRID */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300">
              1A. Nhóm Kiểm thử Hiệu năng & Chịu tải (6 Loại Performance Testing Chuẩn)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TEST_TYPE_CATALOG.filter((item) => item.group === 'PERFORMANCE').map(
                (item) => {
                  const isSelected = testType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleSelectTestTypePreset(item.type)}
                      className={`text-left p-3 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/35 shadow-sm'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {item.icon}
                          {item.title}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium leading-snug">
                        {item.purpose}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">{item.example}</p>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300">
              1B. Nhóm Kiểm thử Bảo mật (5 Loại Security Testing: DAST, API, Auth/RBAC, Infra Scan, Pentest)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TEST_TYPE_CATALOG.filter((item) => item.group === 'SECURITY').map(
                (item) => {
                  const isSelected = testType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleSelectTestTypePreset(item.type)}
                      className={`text-left p-3 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-950/35 shadow-sm'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {item.icon}
                          {item.title}
                        </span>
                        {item.automation && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              item.automation === 'Có'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            Tự động: {item.automation}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium leading-snug">
                        {item.purpose}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">{item.example}</p>
                    </button>
                  );
                }
              )}
            </div>
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
              Giao thức (Protocol)
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
              <option value="HTTP">HTTP / REST API</option>
              <option value="WEBSOCKET">WebSocket Realtime Stream</option>
              <option value="SECURITY_AUDIT">Security & K8s Spec Audit</option>
            </select>
          </div>
        </div>

        {/* Target URL & Path with Quick-Select from Discovered Ingresses */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              2. Địa chỉ Đích & Đường dẫn (Target Endpoint)
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
                  JSON Request Body (Để trống nếu dùng Volume Auto-Batch)
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

        {/* Sliders: Load Scale & Duration & Mode-Specific Parameters */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-300">
            3. Thông số Tải & Đường cong Lưu lượng ({testType})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">
                  {showPeakSlider ? 'Users Khởi điểm / Nền:' : 'Số Người dùng (Virtual Users):'}
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {virtualUsers} Users
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={500}
                value={virtualUsers}
                onChange={(e) => setVirtualUsers(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-[10px] text-slate-400">
                {showPeakSlider
                  ? 'Mức tải nền ban đầu trước khi tăng Stress / Spike'
                  : 'Số luồng người dùng truy cập đồng thời'}
              </span>
            </div>

            {showPeakSlider && (
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-rose-300 font-medium">
                    {testType === 'SPIKE_TEST'
                      ? 'Đỉnh Spike Đột ngột (10x):'
                      : 'Users Cực đại (Peak Users):'}
                  </span>
                  <span className="font-mono font-bold text-rose-300">
                    {peakVirtualUsers} Users
                  </span>
                </div>
                <input
                  type="range"
                  min={virtualUsers}
                  max={1000}
                  step={10}
                  value={peakVirtualUsers}
                  onChange={(e) => setPeakVirtualUsers(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
                <span className="text-[10px] text-slate-400">
                  {testType === 'STRESS_TEST'
                    ? 'Tăng bậc thang 5 nấc lên mức cực đại để tìm điểm gãy'
                    : testType === 'SPIKE_TEST'
                    ? 'Tăng vọt tức thì lên đỉnh Spike rồi hạ về nền'
                    : 'Mức tải mở rộng tối đa để đo RPS/Pod'}
                </span>
              </div>
            )}

            {testType === 'VOLUME_TEST' && (
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-purple-300 font-medium">
                    Khối lượng Dữ liệu / Request:
                  </span>
                  <span className="font-mono font-bold text-purple-300">
                    {volumePayloadKb} KB / req
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={2048}
                  step={32}
                  value={volumePayloadKb}
                  onChange={(e) => setVolumePayloadKb(Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
                <span className="text-[10px] text-slate-400">
                  Tự sinh lô bản ghi JSON lớn (lên tới 2048 KB) để kiểm tra bộ nhớ V8 & crash OOM
                </span>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">
                  Thời lượng chạy (Duration):
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {durationSeconds} giây
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={testType === 'SOAK_ENDURANCE_TEST' ? 600 : 180}
                step={5}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <span className="text-[10px] text-slate-400">
                {testType === 'SOAK_ENDURANCE_TEST'
                  ? 'Chạy dài hạn (lên tới 600s+) để dò Memory Leak'
                  : 'Tổng thời gian thực hiện bài kiểm thử'}
              </span>
            </div>

            {!showPeakSlider && testType !== 'VOLUME_TEST' && (
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
            )}
          </div>
        </div>

        {/* K8s Correlation Scope & Safety Circuit Breaker */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4" />
            4. Đối chiếu K8s & Cầu chì Tự ngắt An toàn (Safety Circuit Breaker)
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
