import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { storageRepo } from './storage/repository.js';
import { k8sDiscoveryService } from './services/k8sDiscoveryService.js';
import { RealRunnerEngine } from './services/realRunnerEngine.js';
import { TestRunRecord } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/studio' });

function broadcastRunUpdate(run: TestRunRecord) {
  const payload = JSON.stringify({
    type: 'RUN_UPDATE',
    run,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const runnerEngine = new RealRunnerEngine((run) => {
  broadcastRunUpdate(run);
});

wss.on('connection', (ws) => {
  const activeRun = runnerEngine.getActiveRun();
  if (activeRun) {
    ws.send(
      JSON.stringify({
        type: 'RUN_UPDATE',
        run: activeRun,
      })
    );
  }
});

// ============================================================================
// STEP 1: CLUSTER CONNECTIONS & ENCRYPTED VAULT API
// ============================================================================
app.get('/api/clusters', (_req, res) => {
  res.json({
    clusters: storageRepo.listClustersPublic(),
  });
});

app.post('/api/clusters/import-local', async (_req, res) => {
  try {
    const imported = storageRepo.importFromLocalKubeconfig();
    // Verify connectivity for each imported cluster
    for (const pub of imported) {
      const internal = storageRepo.getClusterInternal(pub.id);
      if (internal) {
        await k8sDiscoveryService.verifyClusterConnection(internal);
      }
    }
    res.json({
      clusters: storageRepo.listClustersPublic(),
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Không thể đọc ~/.kube/config',
    });
  }
});

app.post('/api/clusters', async (req, res) => {
  try {
    const {
      name,
      environment,
      connectionType,
      kubeconfigYaml,
      externalBaseUrl,
      sshTunnelHint,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập tên kết nối (Cluster / Hệ thống)' });
      return;
    }

    const created = storageRepo.addClusterConnection({
      name,
      environment: environment || 'production',
      connectionType: connectionType || 'imported-kubeconfig',
      kubeconfigYaml,
      externalBaseUrl: externalBaseUrl || '',
      sshTunnelHint,
    });

    const pingResult = await k8sDiscoveryService.verifyClusterConnection(created);
    const updated = storageRepo.getClusterInternal(created.id)!;

    res.json({
      cluster: storageRepo.toPublicCluster(updated),
      pingResult,
      clusters: storageRepo.listClustersPublic(),
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Lỗi khi lưu kết nối cụm',
    });
  }
});

app.post('/api/clusters/:id/ping', async (req, res) => {
  const cluster = storageRepo.getClusterInternal(req.params.id);
  if (!cluster) {
    res.status(404).json({ error: 'Không tìm thấy kết nối cụm' });
    return;
  }
  const pingResult = await k8sDiscoveryService.verifyClusterConnection(cluster);
  const updated = storageRepo.getClusterInternal(cluster.id)!;
  res.json({
    cluster: storageRepo.toPublicCluster(updated),
    pingResult,
    clusters: storageRepo.listClustersPublic(),
  });
});

app.delete('/api/clusters/:id', (req, res) => {
  storageRepo.deleteClusterConnection(req.params.id);
  res.json({
    clusters: storageRepo.listClustersPublic(),
  });
});

// ============================================================================
// STEP 2: REAL K8S NAMESPACE & TOPOLOGY DISCOVERY API
// ============================================================================
app.get('/api/clusters/:id/namespaces', async (req, res) => {
  const cluster = storageRepo.getClusterInternal(req.params.id);
  if (!cluster) {
    res.status(404).json({ error: 'Không tìm thấy kết nối cụm' });
    return;
  }
  try {
    const namespaces = await k8sDiscoveryService.listNamespaces(cluster);
    res.json({ namespaces });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Không thể lấy danh sách Namespace từ K8s API',
    });
  }
});

app.get('/api/clusters/:id/topology', async (req, res) => {
  const cluster = storageRepo.getClusterInternal(req.params.id);
  if (!cluster) {
    res.status(404).json({ error: 'Không tìm thấy kết nối cụm' });
    return;
  }
  const namespace = String(req.query.namespace || 'default');
  const snapshot = await k8sDiscoveryService.discoverNamespaceTopology(cluster, namespace);
  res.json({
    snapshot,
    cluster: storageRepo.toPublicCluster(storageRepo.getClusterInternal(cluster.id)!),
  });
});

// ============================================================================
// STEP 3: DYNAMIC SCENARIO BUILDER API
// ============================================================================
app.get('/api/scenarios', (req, res) => {
  const clusterId = req.query.clusterId ? String(req.query.clusterId) : undefined;
  res.json({
    scenarios: storageRepo.listScenarios(clusterId),
  });
});

app.post('/api/scenarios/generate-from-topology', async (req, res) => {
  const { clusterId, namespace } = req.body as { clusterId: string; namespace: string };
  const cluster = storageRepo.getClusterInternal(clusterId);
  if (!cluster) {
    res.status(404).json({ error: 'Không tìm thấy kết nối cụm' });
    return;
  }
  const snapshot = await k8sDiscoveryService.discoverNamespaceTopology(
    cluster,
    namespace || 'default'
  );
  const generated = storageRepo.generateScenariosFromTopology(cluster, snapshot);
  res.json({
    generated,
    scenarios: storageRepo.listScenarios(clusterId),
  });
});

app.post('/api/scenarios', (req, res) => {
  try {
    const saved = storageRepo.saveScenario(req.body);
    res.json({
      scenario: saved,
      scenarios: storageRepo.listScenarios(saved.clusterId),
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Không thể lưu kịch bản',
    });
  }
});

app.delete('/api/scenarios/:id', (req, res) => {
  const existing = storageRepo.getScenario(req.params.id);
  storageRepo.deleteScenario(req.params.id);
  res.json({
    scenarios: storageRepo.listScenarios(existing?.clusterId),
  });
});

// ============================================================================
// STEP 4: REAL LOAD & SECURITY RUNNER + RUN HISTORY API
// ============================================================================
app.get('/api/runs', (req, res) => {
  const clusterId = req.query.clusterId ? String(req.query.clusterId) : undefined;
  res.json({
    activeRun: runnerEngine.getActiveRun(),
    runs: storageRepo.listTestRuns(clusterId),
  });
});

app.post('/api/runs/start', async (req, res) => {
  try {
    const { scenarioId } = req.body as { scenarioId: string };
    const scenario = storageRepo.getScenario(scenarioId);
    if (!scenario) {
      res.status(404).json({ error: 'Không tìm thấy kịch bản kiểm thử' });
      return;
    }
    const cluster = storageRepo.getClusterInternal(scenario.clusterId);
    if (!cluster) {
      res.status(404).json({ error: 'Không tìm thấy cụm máy chủ của kịch bản này' });
      return;
    }

    const run = await runnerEngine.startScenarioRun(cluster, scenario);
    res.json({ run });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Không thể bắt đầu chạy kịch bản',
    });
  }
});

app.post('/api/runs/stop', (_req, res) => {
  const run = runnerEngine.stopActiveRun();
  res.json({ run });
});

// Serve frontend static build if available (supports single Web Service deployment on Render/Docker)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleFrontendPaths = [
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, 'public'),
  path.resolve(process.cwd(), 'backend/public'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist'),
];

let frontendDistPath: string | null = null;
for (const p of possibleFrontendPaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    frontendDistPath = p;
    break;
  }
}

if (frontendDistPath) {
  console.log(`[KubePulse] Serving Frontend UI from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath!, 'index.html'));
  });
} else {
  console.warn(
    `[KubePulse Warning] Could not find frontend index.html in any of:\n` +
      possibleFrontendPaths.map((p) => `  - ${p}`).join('\n')
  );
  app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>KubePulse Backend Online</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #030712; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; max-width: 580px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            code { background: #1e293b; color: #f43f5e; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
            ol { color: #cbd5e1; font-size: 13px; padding-left: 20px; line-height: 1.7; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">● Backend API & WebSocket Online</div>
            <h1>KubePulse Backend Đang Hoạt Động!</h1>
            <p>Máy chủ Backend đã chạy bình thường, nhưng chưa tìm thấy thư mục build <code>frontend/dist</code>.</p>
            <p><strong>Cách khắc phục trên Render:</strong></p>
            <ol>
              <li>Kiểm tra <strong>Build Command</strong> trên Render: Phải là <code>pnpm install && pnpm run build</code></li>
              <li>Kiểm tra <strong>Root Directory</strong> trên Render: Để <strong>trống</strong> (không điền <code>backend</code>) để Render build đầy đủ cả Frontend và Backend.</li>
            </ol>
            <p style="margin-top: 20px; font-size: 12px; color: #64748b;">API Health: <a href="/api/clusters" style="color: #38bdf8;">/api/clusters</a> | WebSocket: <code>/ws/studio</code></p>
          </div>
        </body>
      </html>
    `);
  });
}

const PORT = Number(process.env.PORT) || 3335;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(
    `[KubePulse Backend] Listening on http://${HOST}:${PORT} (WS: ws://${HOST}:${PORT}/ws/studio)`
  );
});
