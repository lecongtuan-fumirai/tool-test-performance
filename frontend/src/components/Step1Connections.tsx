import React, { useState } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Trash2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Lock,
  Laptop,
  Globe,
  FileKey,
} from 'lucide-react';
import {
  ClusterConnectionPublic,
  ConnectionType,
  EnvironmentType,
} from '../types';

interface Step1ConnectionsProps {
  clusters: ClusterConnectionPublic[];
  selectedClusterId: string | null;
  onSelectClusterAndProceed: (clusterId: string) => void;
  onRefreshClusters: (updated: ClusterConnectionPublic[]) => void;
}

export const Step1Connections: React.FC<Step1ConnectionsProps> = ({
  clusters,
  selectedClusterId,
  onSelectClusterAndProceed,
  onRefreshClusters,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<EnvironmentType>('production');
  const [connectionType, setConnectionType] =
    useState<ConnectionType>('imported-kubeconfig');
  const [externalBaseUrl, setExternalBaseUrl] = useState('');
  const [kubeconfigYaml, setKubeconfigYaml] = useState('');
  const [sshTunnelHint, setSshTunnelHint] = useState('');

  const handleImportLocalKube = async () => {
    setLoadingAction('import-local');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/clusters/import-local', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể đọc ~/.kube/config');
      } else {
        onRefreshClusters(data.clusters);
      }
    } catch {
      setErrorMsg('Lỗi kết nối tới Backend server');
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePingCluster = async (clusterId: string) => {
    setLoadingAction(`ping-${clusterId}`);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/ping`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.clusters) {
        onRefreshClusters(data.clusters);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    setLoadingAction(`del-${clusterId}`);
    try {
      const res = await fetch(`/api/clusters/${clusterId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.clusters) {
        onRefreshClusters(data.clusters);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction('create');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          environment,
          connectionType,
          kubeconfigYaml:
            connectionType === 'imported-kubeconfig' ? kubeconfigYaml : undefined,
          externalBaseUrl,
          sshTunnelHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể thêm kết nối');
      } else {
        onRefreshClusters(data.clusters);
        setShowAddForm(false);
        setName('');
        setKubeconfigYaml('');
        setExternalBaseUrl('');
      }
    } catch {
      setErrorMsg('Lỗi mạng khi lưu kết nối');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 mb-2">
            <Lock className="w-3.5 h-3.5" />
            Bảo mật AES-256-GCM Credential Vault (Zero Hardcode)
          </div>
          <h1 className="text-xl font-bold text-white">
            Bước 1: Kết nối Cụm Kubernetes hoặc Hệ thống Đích
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Mọi thông tin chứng chỉ Kubeconfig được mã hóa AES-256-GCM an toàn. Tuyệt đối không lưu file khóa bí mật trong mã nguồn Git.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleImportLocalKube}
            disabled={loadingAction === 'import-local'}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 transition disabled:opacity-50"
          >
            <Laptop className="w-4 h-4 text-emerald-400" />
            {loadingAction === 'import-local'
              ? 'Đang quét ~/.kube/config...'
              : 'Nhận diện từ ~/.kube/config trên máy'}
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Thêm Kết nối Mới
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Collapsible Add Connection Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateCluster}
          className="rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">
              Thêm Kết nối Cụm K8s hoặc URL Đích Mới
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConnectionType('imported-kubeconfig')}
              className={`p-4 rounded-xl border text-left transition ${
                connectionType === 'imported-kubeconfig'
                  ? 'border-cyan-400 bg-cyan-500/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                <FileKey className="w-4 h-4 text-cyan-400" />
                1. Kết nối Cụm K8s qua Kubeconfig (Khuyên dùng)
              </div>
              <p className="text-xs opacity-80">
                Tự động khám phá Namespace, Ingress, Pod RAM/CPU thực tế và kích hoạt Cầu chì An toàn. Chuỗi YAML được mã hóa AES-256-GCM.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setConnectionType('external-url')}
              className={`p-4 rounded-xl border text-left transition ${
                connectionType === 'external-url'
                  ? 'border-amber-400 bg-amber-500/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                <Globe className="w-4 h-4 text-amber-400" />
                2. Chỉ Kiểm thử qua Domain / URL Bên ngoài (Black-box)
              </div>
              <p className="text-xs opacity-80">
                Dùng khi bạn không có quyền vào K8s và chỉ muốn bắn tải HTTP / WebSocket từ bên ngoài vào một URL.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tên Môi trường / Hệ thống *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Production K3s Cluster"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Phân loại Môi trường
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Domain Chính (Tùy chọn - có thể tự phát hiện từ Ingress)
              </label>
              <input
                type="text"
                required={connectionType === 'external-url'}
                value={externalBaseUrl}
                onChange={(e) => setExternalBaseUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {connectionType === 'imported-kubeconfig' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Dán Nội dung File Kubeconfig (YAML) * — Sẽ được mã hóa AES-256-GCM ngay khi lưu
                </label>
                <textarea
                  rows={5}
                  required
                  value={kubeconfigYaml}
                  onChange={(e) => setKubeconfigYaml(e.target.value)}
                  placeholder="apiVersion: v1&#10;clusters:&#10;- cluster: ..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ghi chú lệnh mở SSH Tunnel (Nếu K8s API đi qua cổng forward 127.0.0.1:6443)
                </label>
                <input
                  type="text"
                  value={sshTunnelHint}
                  onChange={(e) => setSshTunnelHint(e.target.value)}
                  placeholder="VD: ssh -L 6443:127.0.0.1:6443 user@server-ip"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 font-mono text-xs text-slate-300"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loadingAction === 'create'}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {loadingAction === 'create'
                ? 'Đang mã hóa & kiểm tra kết nối...'
                : 'Mã hóa & Lưu Kết nối'}
            </button>
          </div>
        </form>
      )}

      {/* Cluster Cards List */}
      {clusters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-4">
          <Server className="w-12 h-12 text-cyan-400 mx-auto opacity-80" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">
              Chưa có Cụm máy chủ nào được kết nối
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Hãy bấm nút <strong>"Nhận diện từ ~/.kube/config trên máy"</strong> ở góc trên nếu bạn đã có sẵn cấu hình K8s trên máy tính, hoặc bấm <strong>"Thêm Kết nối Mới"</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clusters.map((c) => {
            const isSelected = c.id === selectedClusterId;
            const isOnline = c.status === 'connected';
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                  isSelected
                    ? 'border-cyan-400 bg-slate-900 shadow-lg'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{c.name}</h3>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300">
                          {c.environment}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Loại kết nối:{' '}
                        <span className="text-slate-200 font-medium">
                          {c.connectionType === 'external-url'
                            ? 'External URL'
                            : `Kubernetes API (Context: ${c.kubeContext || 'default'})`}
                        </span>
                      </p>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isOnline
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {isOnline ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* Connection Details Box */}
                  <div className="rounded-xl bg-slate-950/90 border border-slate-800/80 p-3 text-xs space-y-1.5">
                    {c.k8sVersion && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Phiên bản K8s:</span>
                        <span className="font-mono text-emerald-300 font-semibold">
                          {c.k8sVersion} ({c.apiLatencyMs}ms)
                        </span>
                      </div>
                    )}
                    {c.externalBaseUrl && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Domain chính:</span>
                        <span className="font-mono text-cyan-300">{c.externalBaseUrl}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Trạng thái:</span>
                      <span className="text-slate-200 truncate max-w-[260px]">
                        {c.statusMessage || 'Chưa kiểm tra'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePingCluster(c.id)}
                      disabled={loadingAction === `ping-${c.id}`}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          loadingAction === `ping-${c.id}` ? 'animate-spin text-cyan-400' : ''
                        }`}
                      />
                      Kiểm tra (Ping)
                    </button>

                    <button
                      onClick={() => handleDeleteCluster(c.id)}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-400"
                      title="Xóa kết nối"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectClusterAndProceed(c.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:opacity-95 shadow"
                  >
                    Khám phá Hạ tầng (Bước 2)
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
