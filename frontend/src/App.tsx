import React, { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Layers,
  Sliders,
  Activity,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  ClusterConnectionPublic,
  DiscoveredIngressRoute,
  NamespaceTopologySnapshot,
  TestScenario,
  TestRunRecord,
} from './types';
import { Step1Connections } from './components/Step1Connections';
import { Step2TopologyExplorer } from './components/Step2TopologyExplorer';
import { Step3ScenarioStudio } from './components/Step3ScenarioStudio';
import { Step4LiveMonitor } from './components/Step4LiveMonitor';

type StudioStep = 1 | 2 | 3 | 4;

export function App() {
  const [currentStep, setCurrentStep] = useState<StudioStep>(1);
  const [clusters, setClusters] = useState<ClusterConnectionPublic[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('default');
  const [topology, setTopology] = useState<NamespaceTopologySnapshot | null>(null);
  const [loadingTopology, setLoadingTopology] = useState(false);

  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const [runsHistory, setRunsHistory] = useState<TestRunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<TestRunRecord | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) || null;

  const fetchInitialData = useCallback(async () => {
    try {
      const [clustersRes, scenariosRes, runsRes] = await Promise.all([
        fetch('/api/clusters'),
        fetch('/api/scenarios'),
        fetch('/api/runs'),
      ]);
      const clustersData = await clustersRes.json();
      const scenariosData = await scenariosRes.json();
      const runsData = await runsRes.json();

      const loadedClusters: ClusterConnectionPublic[] = clustersData.clusters || [];
      const loadedScenarios: TestScenario[] = scenariosData.scenarios || [];
      const loadedRuns: TestRunRecord[] = runsData.runs || [];

      setClusters(loadedClusters);
      setScenarios(loadedScenarios);
      setRunsHistory(loadedRuns);
      if (runsData.activeRun) {
        setActiveRun(runsData.activeRun);
      }

      if (!selectedClusterId && loadedClusters.length > 0) {
        setSelectedClusterId(loadedClusters[0].id);
      }
      if (!selectedScenarioId && loadedScenarios.length > 0) {
        setSelectedScenarioId(loadedScenarios[0].id);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Không thể tải dữ liệu từ Backend API.');
    }
  }, [selectedClusterId, selectedScenarioId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // WebSocket live stream for active test runs
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsUrl = `${protocol}//${window.location.host}/ws/studio`;
    const configuredApiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      (configuredApiBase
        ? configuredApiBase.replace(/^https?:\/\//, protocol === 'wss:' ? 'wss://' : 'ws://') + '/ws/studio'
        : defaultWsUrl);
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'RUN_UPDATE' && payload.run) {
            const updatedRun: TestRunRecord = payload.run;
            setActiveRun(updatedRun);
            setRunsHistory((prev) => {
              const exists = prev.some((r) => r.id === updatedRun.id);
              if (exists) {
                return prev.map((r) => (r.id === updatedRun.id ? updatedRun : r));
              }
              return [updatedRun, ...prev];
            });
          }
        } catch {
          // ignore malformed messages
        }
      };
      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connectWs, 2500);
      };
    };

    connectWs();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Load namespaces & topology when a cluster is selected
  const loadClusterTopology = useCallback(
    async (cluster: ClusterConnectionPublic, targetNamespace?: string) => {
      setLoadingTopology(true);
      setErrorBanner(null);
      try {
        if (cluster.hasKubeconfig) {
          const nsRes = await fetch(`/api/clusters/${cluster.id}/namespaces`);
          const nsData = await nsRes.json();
          if (!nsRes.ok) throw new Error(nsData.error || 'Không thể đọc danh sách Namespace');

          const nsList: string[] = nsData.namespaces || ['default'];
          setNamespaces(nsList);

          const chosenNs =
            targetNamespace ||
            (nsList.find((n) => n.includes('prod') || n.includes('fumi')) ??
              (nsList.includes('default') ? 'default' : nsList[0]));
          setSelectedNamespace(chosenNs);

          const topoRes = await fetch(
            `/api/clusters/${cluster.id}/topology?namespace=${encodeURIComponent(chosenNs)}`
          );
          const topoData = await topoRes.json();
          if (!topoRes.ok) throw new Error(topoData.error || 'Không thể khám phá Topology');

          setTopology(topoData.snapshot);
        } else {
          // External URL mode
          setNamespaces(['external']);
          setSelectedNamespace('external');
          const topoRes = await fetch(`/api/clusters/${cluster.id}/topology?namespace=external`);
          const topoData = await topoRes.json();
          if (topoRes.ok) {
            setTopology(topoData.snapshot);
          }
        }
      } catch (err: any) {
        setErrorBanner(err.message);
      } finally {
        setLoadingTopology(false);
      }
    },
    []
  );

  const handleSelectClusterAndProceed = async (clusterId: string) => {
    setSelectedClusterId(clusterId);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (cluster) {
      await loadClusterTopology(cluster);
      setCurrentStep(2);
    }
  };

  const handleAutoGenerateScenarios = async () => {
    if (!selectedCluster) return;
    setErrorBanner(null);
    const res = await fetch('/api/scenarios/generate-from-topology', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clusterId: selectedCluster.id,
        namespace: selectedNamespace || 'default',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorBanner(data.error || 'Không thể sinh kịch bản từ Topology');
      return;
    }
    const allScenariosRes = await fetch('/api/scenarios');
    const allScenariosData = await allScenariosRes.json();
    const list: TestScenario[] = allScenariosData.scenarios || [];
    setScenarios(list);
    if (data.generated?.length > 0) {
      setSelectedScenarioId(data.generated[0].id);
    }
  };

  const handleCreateScenarioForRoute = async (
    route: DiscoveredIngressRoute,
    workloadName?: string
  ) => {
    if (!selectedCluster) return;
    const protocol = route.protocol === 'WSS' ? 'WEBSOCKET' : 'HTTP';
    const baseUrl =
      route.host && route.host !== '*'
        ? `${route.tlsEnabled ? 'https' : 'http'}://${route.host}`
        : selectedCluster.externalBaseUrl || 'https://localhost';

    const saved = await handleSaveScenario({
      clusterId: selectedCluster.id,
      name: `[${protocol}] ${route.host}${route.path}`,
      description: `Kịch bản kiểm thử thực tế cho Ingress ${route.ingressName} (${route.path} -> ${route.serviceName}:${route.servicePort})`,
      protocol,
      method: 'GET',
      targetBaseUrl: baseUrl,
      targetPath: route.path || '/',
      headers: {},
      virtualUsers: 20,
      durationSeconds: 20,
      rampUpSeconds: 5,
      targetNamespace: selectedNamespace || 'default',
      targetWorkload: workloadName,
      safetyAbortMemoryPercent: 85,
    });
    setSelectedScenarioId(saved.id);
    setCurrentStep(3);
  };

  const handleSaveScenario = async (
    payload: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<TestScenario> => {
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể lưu kịch bản');
    await fetchInitialData();
    setSelectedScenarioId(data.scenario.id);
    return data.scenario as TestScenario;
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    await fetch(`/api/scenarios/${scenarioId}`, { method: 'DELETE' });
    await fetchInitialData();
  };

  const handleRunScenarioAndProceed = async (scenarioId: string) => {
    setErrorBanner(null);
    const res = await fetch('/api/runs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorBanner(data.error || 'Không thể khởi chạy kịch bản');
      return;
    }
    setActiveRun(data.run);
    setCurrentStep(4);
  };

  const handleStopRun = async () => {
    await fetch('/api/runs/stop', { method: 'POST' });
  };

  const clusterScenarios = scenarios.filter(
    (s) => !selectedClusterId || s.clusterId === selectedClusterId
  );

  const steps: { id: StudioStep; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      id: 1,
      title: 'Bước 1: Kết nối Đích',
      subtitle: selectedCluster ? selectedCluster.name : 'Chọn Kubeconfig / URL',
      icon: <Server className="w-4 h-4" />,
    },
    {
      id: 2,
      title: 'Bước 2: Khám phá Hạ tầng',
      subtitle: selectedNamespace ? `Namespace: ${selectedNamespace}` : 'Tự động quét K8s',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 3,
      title: 'Bước 3: Thiết kế Kịch bản',
      subtitle: `${clusterScenarios.length} kịch bản động`,
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 4,
      title: 'Bước 4: Chạy & Báo cáo',
      subtitle:
        activeRun?.status === 'running'
          ? 'Đang bắn tải thực tế...'
          : `${runsHistory.length} phiên lịch sử`,
      icon: <Activity className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Clean Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  KubePulse Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  AES-256 Vault • 100% Real Traffic
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Nền tảng Kiểm thử Chịu tải & Bảo mật Độc lập theo mô hình OpenLens / Rancher
              </p>
            </div>
          </div>

          {/* 4-Step Progressive Navigation */}
          <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted =
                (step.id === 1 && selectedCluster !== null) ||
                (step.id === 2 && topology !== null) ||
                (step.id === 3 && clusterScenarios.length > 0) ||
                (step.id === 4 && runsHistory.length > 0);

              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900/70 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted && !isActive ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{step.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{step.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Global Error Notification */}
      {errorBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-3 text-rose-200 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-rose-300 hover:text-white underline text-[11px]"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Step Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentStep === 1 && (
          <Step1Connections
            clusters={clusters}
            selectedClusterId={selectedClusterId}
            onSelectClusterAndProceed={handleSelectClusterAndProceed}
            onRefreshClusters={(updated) => {
              setClusters(updated);
              if (!selectedClusterId && updated.length > 0) {
                setSelectedClusterId(updated[0].id);
              }
            }}
          />
        )}

        {currentStep === 2 &&
          (selectedCluster ? (
            <Step2TopologyExplorer
              cluster={selectedCluster}
              namespaces={namespaces}
              selectedNamespace={selectedNamespace}
              topology={topology}
              loadingTopology={loadingTopology}
              onSelectNamespace={(ns: string) => {
                loadClusterTopology(selectedCluster, ns);
              }}
              onRefreshTopology={() => {
                loadClusterTopology(selectedCluster, selectedNamespace);
              }}
              onGenerateScenariosAndProceed={async () => {
                await handleAutoGenerateScenarios();
                setCurrentStep(3);
              }}
              onCreateScenarioForRoute={handleCreateScenarioForRoute}
            />
          ) : (
            <div className="max-w-xl mx-auto py-16 text-center space-y-4">
              <p className="text-sm text-slate-400">
                Vui lòng chọn hoặc thêm một Kết nối Hệ thống ở Bước 1 trước khi khám phá hạ tầng.
              </p>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                Quay lại Bước 1
              </button>
            </div>
          ))}

        {currentStep === 3 &&
          (selectedCluster ? (
            <Step3ScenarioStudio
              cluster={selectedCluster}
              selectedNamespace={selectedNamespace}
              topology={topology}
              scenarios={clusterScenarios}
              selectedScenarioId={selectedScenarioId}
              onSelectScenario={(id) => setSelectedScenarioId(id)}
              onSaveScenario={handleSaveScenario}
              onDeleteScenario={handleDeleteScenario}
              onAutoGenerateScenarios={handleAutoGenerateScenarios}
              onRunScenarioAndProceed={handleRunScenarioAndProceed}
            />
          ) : (
            <div className="max-w-xl mx-auto py-16 text-center space-y-4">
              <p className="text-sm text-slate-400">
                Vui lòng chọn một Kết nối Hệ thống ở Bước 1 trước khi thiết kế kịch bản.
              </p>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                Quay lại Bước 1
              </button>
            </div>
          ))}

        {currentStep === 4 && (
          <Step4LiveMonitor
            activeRun={activeRun}
            runsHistory={runsHistory}
            onSelectRun={(run) => setActiveRun(run)}
            onStopRun={handleStopRun}
            onRerunScenario={handleRunScenarioAndProceed}
            onBackToScenarios={() => setCurrentStep(3)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
