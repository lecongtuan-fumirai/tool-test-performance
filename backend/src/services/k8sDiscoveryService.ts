import * as k8s from '@kubernetes/client-node';
import {
  ClusterConnection,
  DiscoveredIngressRoute,
  DiscoveredNetworkPolicy,
  DiscoveredPodMetric,
  DiscoveredService,
  DiscoveredWorkload,
  NamespaceTopologySnapshot,
} from '../types.js';
import { storageRepo } from '../storage/repository.js';

export function parseK8sMemoryToMi(raw?: string): number | null {
  if (!raw) return null;
  const val = raw.trim();
  if (val.endsWith('Ki')) return Math.round(parseInt(val.slice(0, -2), 10) / 1024);
  if (val.endsWith('Mi')) return parseInt(val.slice(0, -2), 10);
  if (val.endsWith('Gi')) return parseInt(val.slice(0, -2), 10) * 1024;
  if (val.endsWith('M')) return Math.round(parseInt(val.slice(0, -1), 10) * 0.9537);
  if (val.endsWith('G')) return Math.round(parseInt(val.slice(0, -1), 10) * 953.7);
  const num = parseInt(val, 10);
  return isNaN(num) ? null : Math.round(num / (1024 * 1024));
}

export function parseK8sCpuToMillicores(raw?: string): number | null {
  if (!raw) return null;
  const val = raw.trim();
  if (val.endsWith('n')) return Math.round(parseInt(val.slice(0, -1), 10) / 1_000_000);
  if (val.endsWith('u')) return Math.round(parseInt(val.slice(0, -1), 10) / 1_000);
  if (val.endsWith('m')) return parseInt(val.slice(0, -1), 10);
  const num = parseFloat(val);
  return isNaN(num) ? null : Math.round(num * 1000);
}

const SYSTEM_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'cert-manager',
  'system-upgrade',
  'argocd',
  'logging',
  'monitoring',
  'traefik',
  'default',
]);

export class K8sDiscoveryService {
  /**
   * Tests real connectivity to the cluster (K8s Version API or External HTTP URL).
   */
  public async verifyClusterConnection(cluster: ClusterConnection): Promise<{
    connected: boolean;
    k8sVersion?: string;
    apiLatencyMs: number;
    message: string;
  }> {
    const start = Date.now();

    if (cluster.connectionType === 'external-url') {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(cluster.externalBaseUrl, {
          method: 'GET',
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const latency = Date.now() - start;
        storageRepo.updateClusterStatus(cluster.id, {
          status: 'connected',
          apiLatencyMs: latency,
          statusMessage: `HTTP ${res.status} (${latency}ms)`,
          lastCheckedAt: new Date().toISOString(),
        });
        return {
          connected: true,
          apiLatencyMs: latency,
          message: `Kết nối thành công tới ${cluster.externalBaseUrl} (HTTP ${res.status}, ${latency}ms)`,
        };
      } catch (err) {
        const latency = Date.now() - start;
        const msg = err instanceof Error ? err.message : 'Không thể kết nối tới URL';
        storageRepo.updateClusterStatus(cluster.id, {
          status: 'disconnected',
          apiLatencyMs: latency,
          statusMessage: msg,
          lastCheckedAt: new Date().toISOString(),
        });
        return { connected: false, apiLatencyMs: latency, message: msg };
      }
    }

    try {
      const kc = storageRepo.loadKubeConfigInMemory(cluster);
      const versionApi = kc.makeApiClient(k8s.VersionApi);
      const verRes = await versionApi.getCode();
      const latency = Date.now() - start;
      const k8sVersion = verRes.body.gitVersion || 'v1.x';

      storageRepo.updateClusterStatus(cluster.id, {
        status: 'connected',
        k8sVersion,
        apiLatencyMs: latency,
        statusMessage: `Online (${k8sVersion}, ${latency}ms)`,
        lastCheckedAt: new Date().toISOString(),
      });

      return {
        connected: true,
        k8sVersion,
        apiLatencyMs: latency,
        message: `Đã kết nối K8s API thành công (${k8sVersion}, ${latency}ms)`,
      };
    } catch (err) {
      const latency = Date.now() - start;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const friendlyMsg = rawMsg.includes('ECONNREFUSED')
        ? 'Không thể kết nối cổng K8s API (ECONNREFUSED). Hãy kiểm tra SSH Tunnel hoặc K3s/K8s server.'
        : `Lỗi kết nối K8s API: ${rawMsg}`;

      storageRepo.updateClusterStatus(cluster.id, {
        status: 'disconnected',
        apiLatencyMs: latency,
        statusMessage: friendlyMsg,
        lastCheckedAt: new Date().toISOString(),
      });

      return {
        connected: false,
        apiLatencyMs: latency,
        message: friendlyMsg,
      };
    }
  }

  /**
   * Lists real namespaces from the K8s cluster, sorting user application namespaces first.
   */
  public async listNamespaces(cluster: ClusterConnection): Promise<string[]> {
    if (cluster.connectionType === 'external-url') {
      return ['external-target'];
    }

    const kc = storageRepo.loadKubeConfigInMemory(cluster);
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    const res = await coreApi.listNamespace();

    const all = (res.body.items || [])
      .map((ns) => ns.metadata?.name || '')
      .filter(Boolean);

    // Put application namespaces before system namespaces
    return all.sort((a, b) => {
      const aSys = SYSTEM_NAMESPACES.has(a) ? 1 : 0;
      const bSys = SYSTEM_NAMESPACES.has(b) ? 1 : 0;
      if (aSys !== bSys) return aSys - bSys;
      return a.localeCompare(b);
    });
  }

  /**
   * Performs 100% real discovery of Ingresses, Services, Deployments/StatefulSets, Pods,
   * Metrics Server CPU/RAM, and NetworkPolicies in the given namespace.
   */
  public async discoverNamespaceTopology(
    cluster: ClusterConnection,
    namespace: string
  ): Promise<NamespaceTopologySnapshot> {
    if (cluster.connectionType === 'external-url') {
      let host = 'localhost';
      let tls = true;
      try {
        const u = new URL(cluster.externalBaseUrl);
        host = u.host;
        tls = u.protocol === 'https:';
      } catch {}

      return {
        clusterId: cluster.id,
        namespace: 'external-target',
        discoveredAt: new Date().toISOString(),
        k8sConnected: false,
        metricsServerAvailable: false,
        ingresses: [
          {
            ingressName: 'external-endpoint',
            host,
            tlsEnabled: tls,
            path: '/',
            pathType: 'Prefix',
            protocol: tls ? 'HTTPS' : 'HTTP',
            serviceName: 'external-service',
            servicePort: tls ? 443 : 80,
            annotations: {},
          },
        ],
        services: [],
        workloads: [],
        networkPolicies: [],
      };
    }

    try {
      const kc = storageRepo.loadKubeConfigInMemory(cluster);
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);
      const appsApi = kc.makeApiClient(k8s.AppsV1Api);
      const netApi = kc.makeApiClient(k8s.NetworkingV1Api);
      const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

      const [ingRes, svcRes, deployRes, stsRes, podRes, netpolRes] = await Promise.all([
        netApi.listNamespacedIngress(namespace),
        coreApi.listNamespacedService(namespace),
        appsApi.listNamespacedDeployment(namespace),
        appsApi.listNamespacedStatefulSet(namespace),
        coreApi.listNamespacedPod(namespace),
        netApi.listNamespacedNetworkPolicy(namespace),
      ]);

      // Fetch live Pod metrics from metrics.k8s.io if available
      const podMetricsMap = new Map<string, { cpuMillicores: number | null; memoryMi: number | null }>();
      let metricsServerAvailable = false;
      try {
        const metricsObj: any = await customApi.listNamespacedCustomObject(
          'metrics.k8s.io',
          'v1beta1',
          namespace,
          'pods'
        );
        const items = metricsObj?.body?.items || [];
        metricsServerAvailable = true;
        for (const item of items) {
          const podName = item.metadata?.name;
          if (!podName) continue;
          let totalCpu = 0;
          let totalMem = 0;
          for (const c of item.containers || []) {
            totalCpu += parseK8sCpuToMillicores(c.usage?.cpu) || 0;
            totalMem += parseK8sMemoryToMi(c.usage?.memory) || 0;
          }
          podMetricsMap.set(podName, {
            cpuMillicores: totalCpu,
            memoryMi: totalMem,
          });
        }
      } catch {
        metricsServerAvailable = false;
      }

      // 1. Map Ingresses
      const ingresses: DiscoveredIngressRoute[] = [];
      for (const ing of ingRes.body.items || []) {
        const ingName = ing.metadata?.name || 'ingress';
        const annotations = ing.metadata?.annotations || {};
        const tlsHosts = new Set<string>();
        for (const t of ing.spec?.tls || []) {
          for (const h of t.hosts || []) tlsHosts.add(h);
        }

        for (const rule of ing.spec?.rules || []) {
          const host = rule.host || 'localhost';
          const tlsEnabled = tlsHosts.has(host) || (ing.spec?.tls?.length || 0) > 0;
          for (const p of rule.http?.paths || []) {
            const pathStr = p.path || '/';
            const isWs = pathStr === '/ws' || pathStr.startsWith('/ws/');
            ingresses.push({
              ingressName: ingName,
              host,
              tlsEnabled,
              path: pathStr,
              pathType: p.pathType || 'Prefix',
              protocol: isWs ? 'WSS' : tlsEnabled ? 'HTTPS' : 'HTTP',
              serviceName: p.backend?.service?.name || '',
              servicePort:
                p.backend?.service?.port?.number ||
                p.backend?.service?.port?.name ||
                80,
              annotations,
            });
          }
        }
      }

      // Auto-fill cluster externalBaseUrl if empty and an Ingress host was found
      if (!cluster.externalBaseUrl && ingresses.length > 0 && ingresses[0].host !== 'localhost') {
        const first = ingresses[0];
        const discoveredUrl = `${first.tlsEnabled ? 'https' : 'http'}://${first.host}`;
        storageRepo.updateClusterStatus(cluster.id, { externalBaseUrl: discoveredUrl });
      }

      // 2. Map Services
      const services: DiscoveredService[] = (svcRes.body.items || []).map((svc) => ({
        name: svc.metadata?.name || 'service',
        type: svc.spec?.type || 'ClusterIP',
        clusterIp: svc.spec?.clusterIP || '',
        ports: (svc.spec?.ports || []).map((pt) => ({
          name: pt.name,
          port: pt.port,
          targetPort: (pt.targetPort as any) || pt.port,
          protocol: pt.protocol || 'TCP',
        })),
        selector: svc.spec?.selector || {},
      }));

      // 3. Map Pods
      const allPods: Array<{ labels: Record<string, string>; metric: DiscoveredPodMetric }> = (
        podRes.body.items || []
      ).map((pod) => {
        const podName = pod.metadata?.name || 'pod';
        const cs = pod.status?.containerStatuses || [];
        const ready = cs.length > 0 && cs.every((c) => c.ready);
        const restartCount = cs.reduce((sum, c) => sum + (c.restartCount || 0), 0);
        const createdMs = pod.metadata?.creationTimestamp
          ? new Date(pod.metadata.creationTimestamp).getTime()
          : Date.now();
        const m = podMetricsMap.get(podName);

        return {
          labels: pod.metadata?.labels || {},
          metric: {
            podName,
            phase: pod.status?.phase || 'Unknown',
            ready,
            restartCount,
            nodeName: pod.spec?.nodeName || '',
            podIp: pod.status?.podIP || '',
            cpuMillicores: m ? m.cpuMillicores : null,
            memoryMi: m ? m.memoryMi : null,
            ageSeconds: Math.max(0, Math.round((Date.now() - createdMs) / 1000)),
          },
        };
      });

      // 4. Map Workloads (Deployments & StatefulSets)
      const workloads: DiscoveredWorkload[] = [];
      const rawWorkloads = [
        ...(deployRes.body.items || []).map((d) => ({ kind: 'Deployment' as const, item: d })),
        ...(stsRes.body.items || []).map((s) => ({ kind: 'StatefulSet' as const, item: s })),
      ];

      for (const { kind, item } of rawWorkloads) {
        const wName = item.metadata?.name || 'workload';
        const matchLabels = item.spec?.selector?.matchLabels || {};
        const matchedPods = allPods
          .filter(({ labels }) =>
            Object.entries(matchLabels).every(([k, v]) => labels[k] === v)
          )
          .map((p) => p.metric);

        const container = item.spec?.template?.spec?.containers?.[0];
        const podSec = item.spec?.template?.spec?.securityContext;
        const cSec = container?.securityContext;

        workloads.push({
          name: wName,
          kind,
          replicas: item.spec?.replicas ?? 1,
          readyReplicas: item.status?.readyReplicas ?? 0,
          image: container?.image || '',
          memoryRequestMi: parseK8sMemoryToMi(container?.resources?.requests?.['memory']),
          memoryLimitMi: parseK8sMemoryToMi(container?.resources?.limits?.['memory']),
          cpuRequestMillicores: parseK8sCpuToMillicores(container?.resources?.requests?.['cpu']),
          cpuLimitMillicores: parseK8sCpuToMillicores(container?.resources?.limits?.['cpu']),
          envKeys: (container?.env || []).map((e) => e.name).filter(Boolean),
          securityContext: {
            runAsNonRoot: Boolean(cSec?.runAsNonRoot ?? podSec?.runAsNonRoot ?? false),
            readOnlyRootFilesystem: Boolean(cSec?.readOnlyRootFilesystem ?? false),
            allowPrivilegeEscalation: Boolean(cSec?.allowPrivilegeEscalation ?? true),
          },
          pods: matchedPods,
        });
      }

      // 5. Map NetworkPolicies
      const networkPolicies: DiscoveredNetworkPolicy[] = (netpolRes.body.items || []).map(
        (np) => ({
          name: np.metadata?.name || 'network-policy',
          podSelector: np.spec?.podSelector?.matchLabels || {},
          policyTypes: np.spec?.policyTypes || ['Ingress'],
          ingressRulesCount: (np.spec?.ingress || []).length,
          egressRulesCount: (np.spec?.egress || []).length,
        })
      );

      return {
        clusterId: cluster.id,
        namespace,
        discoveredAt: new Date().toISOString(),
        k8sConnected: true,
        metricsServerAvailable,
        ingresses,
        services,
        workloads,
        networkPolicies,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        clusterId: cluster.id,
        namespace,
        discoveredAt: new Date().toISOString(),
        k8sConnected: false,
        metricsServerAvailable: false,
        errorMessage: msg,
        ingresses: [],
        services: [],
        workloads: [],
        networkPolicies: [],
      };
    }
  }
}

export const k8sDiscoveryService = new K8sDiscoveryService();
