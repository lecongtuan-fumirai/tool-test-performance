import React from 'react';
import {
  Globe,
  Shield,
  Cpu,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  ClusterConnectionPublic,
  DiscoveredIngressRoute,
  NamespaceTopologySnapshot,
} from '../types';

interface Step2TopologyExplorerProps {
  cluster: ClusterConnectionPublic;
  namespaces: string[];
  selectedNamespace: string;
  topology: NamespaceTopologySnapshot | null;
  loadingTopology: boolean;
  onSelectNamespace: (ns: string) => void;
  onRefreshTopology: () => void;
  onGenerateScenariosAndProceed: () => void;
  onCreateScenarioForRoute: (route: DiscoveredIngressRoute, workloadName?: string) => void;
}

export const Step2TopologyExplorer: React.FC<Step2TopologyExplorerProps> = ({
  cluster,
  namespaces,
  selectedNamespace,
  topology,
  loadingTopology,
  onSelectNamespace,
  onRefreshTopology,
  onGenerateScenariosAndProceed,
  onCreateScenarioForRoute,
}) => {
  const defaultWorkloadName = topology?.workloads[0]?.name;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Bar: Namespace Selector + Auto-Generate Scenarios Button */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Cụm đang chọn: {cluster.name}
          </div>
          <h1 className="text-xl font-bold text-white">
            Bước 2: Khám phá Hạ tầng Thực tế theo Namespace
          </h1>
          <p className="text-xs text-slate-400">
            Hệ thống đọc trực tiếp Ingress, Service, NetworkPolicy và Pod RAM/CPU thực tế từ Kubernetes API của cụm.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400">Namespace:</span>
            <select
              value={selectedNamespace}
              onChange={(e) => onSelectNamespace(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
            >
              {namespaces.map((ns) => (
                <option key={ns} value={ns} className="bg-slate-900 text-white">
                  {ns}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onRefreshTopology}
            disabled={loadingTopology}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingTopology ? 'animate-spin text-cyan-400' : ''}`}
            />
            Quét lại
          </button>

          <button
            onClick={onGenerateScenariosAndProceed}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:opacity-95 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            Tự động Sinh Kịch bản từ Namespace này (Sang Bước 3)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error or Loading State */}
      {topology?.errorMessage && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-4 flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>Không thể đọc K8s API cho namespace {selectedNamespace}:</strong>{' '}
            {topology.errorMessage}
          </div>
        </div>
      )}

      {loadingTopology || !topology ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center text-sm text-slate-400">
          Đang quét hạ tầng thực tế từ Kubernetes API cho namespace{' '}
          <strong className="text-cyan-300">{selectedNamespace}</strong>...
        </div>
      ) : (
        /* 3-Column Clean Topology Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* COLUMN 1: INGRESS ROUTES (OUTSIDE-IN ENTRYPOINTS) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    1. Điểm vào (Ingress Routes)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Các đường dẫn mở ra Internet
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-300">
                {topology.ingresses.length}
              </span>
            </div>

            {topology.ingresses.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Không có Ingress nào trong namespace <code>{selectedNamespace}</code>.
              </p>
            ) : (
              <div className="space-y-3">
                {topology.ingresses.map((route, idx) => (
                  <div
                    key={`${route.ingressName}-${route.path}-${idx}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5 hover:border-cyan-500/50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300 border border-cyan-500/30">
                        {route.protocol}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        → {route.serviceName}:{route.servicePort}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-white break-all font-semibold">
                      {route.tlsEnabled ? 'https://' : 'http://'}
                      {route.host}
                      <span className="text-cyan-300">{route.path}</span>
                    </div>

                    <button
                      onClick={() =>
                        onCreateScenarioForRoute(route, defaultWorkloadName)
                      }
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 py-1.5 text-xs font-semibold text-cyan-300 transition"
                    >
                      Tạo Kịch bản Test đường dẫn này
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2: SERVICES & NETWORK POLICIES */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 space-y-5">
            {/* Services */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      2. Dịch vụ (K8s Services)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Cân bằng tải nội bộ tới các Pod
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-300">
                  {topology.services.length}
                </span>
              </div>

              {topology.services.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  Không có Service nào.
                </p>
              ) : (
                <div className="space-y-2">
                  {topology.services.map((svc) => (
                    <div
                      key={svc.name}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span>{svc.name}</span>
                        <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {svc.type}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        ClusterIP: {svc.clusterIp} | Ports:{' '}
                        {svc.ports.map((p) => `${p.port}→${p.targetPort}`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NetworkPolicies */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Tường lửa K8s (NetworkPolicies)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Chính sách cô lập mạng thật trong cụm
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-mono font-bold text-purple-300">
                  {topology.networkPolicies.length}
                </span>
              </div>

              {topology.networkPolicies.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                  Namespace này hiện chưa cấu hình NetworkPolicy nào.
                </div>
              ) : (
                <div className="space-y-2">
                  {topology.networkPolicies.map((np) => (
                    <div
                      key={np.name}
                      className="rounded-xl border border-purple-500/30 bg-slate-950 p-2.5 text-xs flex items-center justify-between"
                    >
                      <span className="font-mono text-purple-200 font-medium">
                        {np.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {np.policyTypes.join(' + ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: WORKLOADS & LIVE POD METRICS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-rose-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    3. Máy chủ Ứng dụng (Workloads & Pods)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Chỉ số CPU / RAM thực tế từ K8s Metrics API
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-mono font-bold text-rose-300">
                {topology.workloads.length}
              </span>
            </div>

            {topology.workloads.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Không tìm thấy Deployment/StatefulSet nào trong namespace này.
              </p>
            ) : (
              <div className="space-y-4">
                {topology.workloads.map((wl) => (
                  <div
                    key={wl.name}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white">
                          {wl.name}
                        </span>
                        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                          {wl.kind}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {wl.readyReplicas}/{wl.replicas} Ready
                      </span>
                    </div>

                    {/* Resource Limits */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/90 p-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Giới hạn RAM (Limit):
                        </span>
                        <span className="font-mono font-bold text-white">
                          {wl.memoryLimitMi ? `${wl.memoryLimitMi} MiB` : 'Không giới hạn'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Giới hạn CPU (Limit):
                        </span>
                        <span className="font-mono font-bold text-white">
                          {wl.cpuLimitMillicores
                            ? `${wl.cpuLimitMillicores}m`
                            : 'Không giới hạn'}
                        </span>
                      </div>
                    </div>

                    {/* Live Pods List */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400">
                        Pods đang chạy thực tế ({wl.pods.length}):
                      </div>
                      {wl.pods.map((pod) => (
                        <div
                          key={pod.podName}
                          className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-cyan-300 font-semibold truncate max-w-[190px]">
                              {pod.podName}
                            </span>
                            <span className="text-emerald-400 text-[11px]">
                              {pod.phase} (Restarts: {pod.restartCount})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                            <span>
                              RAM hiện tại:{' '}
                              <strong className="text-white">
                                {pod.memoryMi !== null ? `${pod.memoryMi} MiB` : 'N/A'}
                              </strong>
                            </span>
                            <span>
                              CPU hiện tại:{' '}
                              <strong className="text-white">
                                {pod.cpuMillicores !== null
                                  ? `${pod.cpuMillicores}m`
                                  : 'N/A'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

