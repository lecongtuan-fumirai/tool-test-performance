import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TargetDiscoveryManager } from './connectors/targetDiscovery.js';
import { BUILTIN_SCENARIO_PACKS, resolveScenarioForTopology } from './engine/scenarioPacks.js';
import { BiDirectionalCorrelatorEngine } from './engine/correlatorEngine.js';
import { ActiveTestRunState, ScenarioPack } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/studio' });

const discoveryManager = new TargetDiscoveryManager();
let activeTargetId = 'fumi-live-prod';
const customScenarios: ScenarioPack[] = [];

function getAllResolvedScenarios(targetId: string): ScenarioPack[] {
  const topology = discoveryManager.getTopology(targetId);
  return [...BUILTIN_SCENARIO_PACKS, ...customScenarios].map((s) =>
    resolveScenarioForTopology(s, topology)
  );
}

function broadcastState(state: ActiveTestRunState) {
  const payload = JSON.stringify({
    type: 'STATE_UPDATE',
    state,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const correlator = new BiDirectionalCorrelatorEngine(
  discoveryManager.getTopology(activeTargetId),
  (updatedState) => {
    broadcastState(updatedState);
  }
);

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'STATE_UPDATE',
      state: correlator.getState(),
    })
  );
});

app.get('/api/studio/bootstrap', (_req, res) => {
  const targets = discoveryManager.listTargets();
  const activeTarget = discoveryManager.getTarget(activeTargetId) || targets[0];
  const topology = discoveryManager.getTopology(activeTarget.id);
  const scenarios = getAllResolvedScenarios(activeTarget.id);

  res.json({
    targets,
    activeTarget,
    topology,
    scenarios,
    runState: correlator.getState(),
  });
});

app.post('/api/targets/select', (req, res) => {
  const { targetId } = req.body as { targetId: string };
  const target = discoveryManager.getTarget(targetId);
  if (!target) {
    res.status(404).json({ error: `Target '${targetId}' not found` });
    return;
  }
  activeTargetId = target.id;
  const topology = discoveryManager.getTopology(activeTargetId);
  const runState = correlator.switchTarget(topology);
  const scenarios = getAllResolvedScenarios(activeTargetId);

  res.json({
    activeTarget: target,
    topology,
    scenarios,
    runState,
  });
});

app.post('/api/targets/connect', async (req, res) => {
  try {
    const result = await discoveryManager.addOrUpdateTarget(req.body);
    activeTargetId = result.target.id;
    const runState = correlator.switchTarget(result.topology);
    const scenarios = getAllResolvedScenarios(activeTargetId);

    res.json({
      targets: discoveryManager.listTargets(),
      activeTarget: result.target,
      topology: result.topology,
      scenarios,
      runState,
      liveK8sConnected: result.liveK8sConnected,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to connect target',
    });
  }
});

app.post('/api/scenarios/start', (req, res) => {
  const { scenarioId, executionMode } = req.body as {
    scenarioId: string;
    executionMode?: 'hybrid-physics-correlator' | 'live-http-ws-probe';
  };
  const topology = discoveryManager.getTopology(activeTargetId);
  const rawScenario =
    [...BUILTIN_SCENARIO_PACKS, ...customScenarios].find((s) => s.id === scenarioId) ||
    BUILTIN_SCENARIO_PACKS[0];

  const runState = correlator.startScenarioRun(
    topology,
    rawScenario,
    executionMode || 'hybrid-physics-correlator'
  );
  res.json({ runState });
});

app.post('/api/scenarios/stop', (_req, res) => {
  const topology = discoveryManager.getTopology(activeTargetId);
  const runState = correlator.stopCurrentRun(topology);
  res.json({ runState });
});

const PORT = Number(process.env.PORT) || 3334;
server.listen(PORT, () => {
  console.log(
    `[KubePulse Backend] Listening on http://localhost:${PORT} (WS: ws://localhost:${PORT}/ws/studio)`
  );
});
