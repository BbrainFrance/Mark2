require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { chat } = require('./lib/anthropic');
const agents = require('./lib/agents');
const history = require('./lib/history');
const { getToolDefinitions, executeTool } = require('./lib/tools');

const app = express();
const PORT = process.env.PORT || 3456;
const API_KEY = process.env.MARK2_API_KEY;

// --- Middleware ---

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!API_KEY || token === API_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Non autorise' });
}

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// --- Routes ---

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    name: 'Mark2',
    uptime: process.uptime(),
    agents: agents.listAgents().length,
  });
});

// Liste des agents
app.get('/agents', auth, (req, res) => {
  const list = agents.listAgents();
  res.json({ agents: list });
});

// Detail d'un agent
app.get('/agents/:id', auth, (req, res) => {
  const agent = agents.loadAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent introuvable' });
  }
  res.json({
    id: agent.id,
    label: agent.label,
    enabledTools: agent.enabledTools,
    model: agent.model,
  });
});

// Chat avec un agent
app.post('/chat', auth, async (req, res) => {
  const {
    message,
    agentId = 'jarvis',
    source = 'WEB',
    sessionKey,
  } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide' });
  }

  // Charger l'agent
  const effectiveAgentId = sessionKey || agentId;
  const agent = agents.loadAgent(effectiveAgentId);
  if (!agent) {
    return res.status(404).json({ error: `Agent "${effectiveAgentId}" introuvable` });
  }

  console.log(`[Chat] ${source} -> ${agent.label}: "${message.substring(0, 80)}..."`);

  try {
    // Ajouter le message utilisateur a l'historique
    history.appendMessage(effectiveAgentId, 'user', message, source);

    // Charger le contexte (derniers messages)
    const contextMessages = history.getContextMessages(effectiveAgentId, 40);

    // Preparer les outils
    const toolDefs = getToolDefinitions(agent.enabledTools);
    const context = { workspace: agent.workspace, agentId: effectiveAgentId };

    // Appel Claude avec boucle tool_use
    const result = await chat({
      system: agent.system,
      messages: contextMessages,
      tools: toolDefs,
      executeTool: (name, input) => executeTool(name, input, context),
      model: agent.model,
      maxTokens: agent.maxTokens,
    });

    // Sauvegarder la reponse dans l'historique
    history.appendMessage(effectiveAgentId, 'assistant', result.response, 'MARK2');

    res.json({
      response: result.response,
      agentId: effectiveAgentId,
      agentLabel: agent.label,
      toolCalls: result.toolCalls.map(t => ({ name: t.name, input: t.input })),
      timestamp: Date.now(),
    });

  } catch (err) {
    console.error(`[Chat] Erreur:`, err.message);

    if (err.status === 429) {
      return res.status(429).json({ error: 'Rate limit Anthropic. Reessayez dans quelques secondes.' });
    }
    if (err.status === 401) {
      return res.status(500).json({ error: 'Cle API Anthropic invalide.' });
    }

    res.status(500).json({ error: `Erreur interne: ${err.message}` });
  }
});

// Historique de conversation
app.get('/history/:agentId', auth, (req, res) => {
  const { agentId } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const messages = history.getFullHistory(agentId, limit);
  res.json({ agentId, messages, count: messages.length });
});

// Effacer l'historique
app.delete('/history/:agentId', auth, (req, res) => {
  history.clearHistory(req.params.agentId);
  res.json({ ok: true, message: `Historique de ${req.params.agentId} efface` });
});

// Endpoint vocal (pour l'app Android et le mode appel web)
app.post('/voice', auth, async (req, res) => {
  const {
    message,
    agentId = 'jarvis',
    source = 'ANDROID',
  } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide' });
  }

  const agent = agents.loadAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: `Agent "${agentId}" introuvable` });
  }

  console.log(`[Voice] ${source} -> ${agent.label}: "${message.substring(0, 80)}..."`);

  try {
    history.appendMessage(agentId, 'user', message, source);
    const contextMessages = history.getContextMessages(agentId, 20);

    // Pour le vocal, pas d'outils (reponse directe et rapide)
    const result = await chat({
      system: agent.system + '\n\nIMPORTANT: Tu reponds a l\'oral. Sois concis, naturel, direct. Pas de markdown, pas de backticks, pas de listes. Maximum 3-4 phrases courtes.',
      messages: contextMessages,
      tools: [], // Pas d'outils en mode vocal
      model: agent.model,
      maxTokens: 1024,
    });

    history.appendMessage(agentId, 'assistant', result.response, 'MARK2');

    res.json({
      response: result.response,
      agentId,
      timestamp: Date.now(),
    });

  } catch (err) {
    console.error(`[Voice] Erreur:`, err.message);
    res.status(500).json({ error: `Erreur: ${err.message}` });
  }
});

// Recharger la config des agents
app.post('/reload', auth, (req, res) => {
  agents.reloadAll();
  const list = agents.listAgents();
  res.json({ ok: true, agents: list });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║          MARK2 Engine v1.0.0         ║');
  console.log('  ║   Moteur d\'Agents IA Custom          ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  Port:    ${PORT}`);
  console.log(`  Modele:  ${process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250514'}`);
  console.log(`  Auth:    ${API_KEY ? 'active' : 'DESACTIVEE (pas de MARK2_API_KEY)'}`);
  console.log(`  Agents:  ${agents.listAgents().length} charge(s)`);
  console.log('');

  const agentList = agents.listAgents();
  if (agentList.length > 0) {
    console.log('  Agents disponibles:');
    agentList.forEach(a => console.log(`    - ${a.label} (${a.id})`));
  } else {
    console.log('  ⚠ Aucun agent configure dans /agents/');
  }
  console.log('');
});
