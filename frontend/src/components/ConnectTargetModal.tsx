import React, { useState } from 'react';
import { X, Server, Terminal, Globe, ShieldCheck } from 'lucide-react';
import { ConnectionMode } from '../types';

interface ConnectTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (payload: {
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
  }) => Promise<void>;
}

export const ConnectTargetModal: React.FC<ConnectTargetModalProps> = ({
  isOpen,
  onClose,
  onConnect,
}) => {
  const [name, setName] = useState('my-new-service-prod');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'custom'>('production');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('k8s-ssh-tunnel');
  const [namespace, setNamespace] = useState('default');
  const [externalUrl, setExternalUrl] = useState('https://api.example.com');
  const [sshTunnelCommand, setSshTunnelCommand] = useState(
    'ssh -L 6443:127.0.0.1:6443 root@13.140.183.90'
  );
  const [kubeconfigYaml, setKubeconfigYaml] = useState('');
  const [memoryLimitMi, setMemoryLimitMi] = useState(512);
  const [maxSessions, setMaxSessions] = useState(25);
  const [rateLimitRps, setRateLimitRps] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConnect({
        name,
        environment,
        connectionMode,
        namespace,
        externalUrl,
        sshTunnelCommand: connectionMode === 'k8s-ssh-tunnel' ? sshTunnelCommand : undefined,
        kubeconfigYaml: kubeconfigYaml || undefined,
        memoryLimitMi,
        maxSessions,
        rateLimitRps,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Kết nối Hệ thống Đích Mới (Add Target / K8s Cluster)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Chế độ Kết nối (Operating Mode)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setConnectionMode('k8s-ssh-tunnel')}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                  connectionMode === 'k8s-ssh-tunnel'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Full Introspection (SSH + K8s)
                </div>
                <span className="text-[11px] leading-tight opacity-80">
                  Giống OpenLens: Đọc trực tiếp Pod RAM/CPU, Ingress & Events qua SSH Tunnel
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConnectionMode('hybrid-simulator')}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                  connectionMode === 'hybrid-simulator'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Hybrid Simulator
                </div>
                <span className="text-[11px] leading-tight opacity-80">
                  Mô phỏng vật lý cụm K8s + bắn thử an toàn không cần mở SSH Tunnel
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConnectionMode('external-url')}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                  connectionMode === 'external-url'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                  <Globe className="w-4 h-4 text-amber-400" />
                  Black-box External URL
                </div>
                <span className="text-[11px] leading-tight opacity-80">
                  Chỉ cần nhập Domain/URL đích khi không có quyền truy cập K8s
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Tên Hồ sơ Hệ thống (Workspace Name)</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="vd: payment-gateway-prod"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Môi trường</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as 'production' | 'staging' | 'custom')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Domain / Endpoint Đích (Outside-In URL)
              </label>
              <input
                type="text"
                required
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="https://fumifood.dpdns.org"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Kubernetes Namespace (Inside-Out Scope)
              </label>
              <input
                type="text"
                required
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                placeholder="fumi-live-prod"
              />
            </div>
          </div>

          {connectionMode === 'k8s-ssh-tunnel' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
              <div>
                <label className="block text-xs text-cyan-300 mb-1 font-medium">
                  Lệnh SSH Port-Forward tới K3s / K8s API (Tự động đối chiếu)
                </label>
                <input
                  type="text"
                  value={sshTunnelCommand}
                  onChange={(e) => setSshTunnelCommand(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-cyan-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Dán nội dung Kubeconfig YAML (Tùy chọn - nếu để trống sẽ dùng Hybrid Discovery)
                </label>
                <textarea
                  rows={3}
                  value={kubeconfigYaml}
                  onChange={(e) => setKubeconfigYaml(e.target.value)}
                  placeholder="apiVersion: v1&#10;kind: Config&#10;clusters: ..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-300"
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
            <div className="text-xs font-medium text-slate-300 mb-2">
              Thông số Ngưỡng Tài nguyên & Khiên (Dùng để map biến động <code className="text-cyan-400">{'{{target.*}}'}</code>)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Pod Memory Limit (MiB)
                </label>
                <input
                  type="number"
                  value={memoryLimitMi}
                  onChange={(e) => setMemoryLimitMi(Number(e.target.value))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  MAX_SESSIONS (Quota)
                </label>
                <input
                  type="number"
                  value={maxSessions}
                  onChange={(e) => setMaxSessions(Number(e.target.value))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Ingress Rate-Limit (req/s)
                </label>
                <input
                  type="number"
                  value={rateLimitRps}
                  onChange={(e) => setRateLimitRps(Number(e.target.value))}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {submitting ? 'Đang khám phá hạ tầng...' : 'Kết nối & Khám phá Topology'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
