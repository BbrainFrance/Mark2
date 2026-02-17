require('dotenv').config();

const fs = require('fs');
const path = require('path');
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

// --- Modeles ---

// Modele actif (par defaut celui du .env, modifiable a chaud)
let activeModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250514';

function loadModels() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'models.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { models: [], default: activeModel };
  }
}

function findModelByAlias(input) {
  const { models } = loadModels();
  const search = input.toLowerCase().trim();
  for (const m of models) {
    if (m.id === search) return m;
    if (m.alias.some(a => a === search)) return m;
  }
  return null;
}

/**
 * Traite les commandes slash (/modele, /agents, /clear, etc.)
 * Retourne { handled: true, response } si c'est une commande, sinon { handled: false }
 */
function handleSlashCommand(message, agentId) {
  const trimmed = message.trim().toLowerCase();

  // /modele ou /model (sans argument) -> liste les modeles + actif
  if (trimmed === '/modele' || trimmed === '/model' || trimmed === '/modeles' || trimmed === '/models') {
    const { models } = loadModels();
    const lines = models.map(m => {
      const active = m.id === activeModel ? ' [ACTIF]' : '';
      return `- **${m.label}**${active} : ${m.description} (aliases: ${m.alias.join(', ')})`;
    });
    return {
      handled: true,
      response: `Modele actif : **${getActiveModelLabel()}**\n\nModeles disponibles :\n${lines.join('\n')}\n\nPour changer : \`/modele opus\`, \`/modele sonnet\`, \`/modele haiku\`, etc.`,
    };
  }

  // /modele <alias> -> switch de modele
  const modelMatch = trimmed.match(/^\/(modele|model)\s+(.+)$/);
  if (modelMatch) {
    const alias = modelMatch[2].trim();
    const model = findModelByAlias(alias);
    if (!model) {
      const { models } = loadModels();
      const available = models.map(m => m.alias[0]).join(', ');
      return {
        handled: true,
        response: `Modele "${alias}" introuvable. Modeles disponibles : ${available}`,
      };
    }
    activeModel = model.id;
    return {
      handled: true,
      response: `Modele change : **${model.label}** (${model.id})\n${model.description}`,
    };
  }

  // /agents -> liste les agents
  if (trimmed === '/agents') {
    const list = agents.listAgents();
    const lines = list.map(a => `- **${a.label}** (${a.id})`);
    return {
      handled: true,
      response: `${list.length} agents disponibles :\n${lines.join('\n')}`,
    };
  }

  // /clear -> efface l'historique de l'agent courant
  if (trimmed === '/clear' || trimmed === '/reset') {
    history.clearHistory(agentId);
    return {
      handled: true,
      response: `Historique de ${agentId} efface.`,
    };
  }

  // /help -> liste les commandes
  if (trimmed === '/help' || trimmed === '/aide') {
    return {
      handled: true,
      response: `Commandes disponibles :\n- \`/modele\` : voir le modele actif et les modeles disponibles\n- \`/modele <nom>\` : changer de modele (ex: /modele opus, /modele haiku)\n- \`/agents\` : lister les agents\n- \`/clear\` : effacer l'historique de l'agent courant\n- \`/help\` : cette aide`,
    };
  }

  return { handled: false };
}

function getActiveModelLabel() {
  const { models } = loadModels();
  const m = models.find(m => m.id === activeModel);
  return m ? m.label : activeModel;
}

// --- Middleware ---

app.use(cors());
app.use(express.json({ limit: '20mb' }));

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
    version: '1.1.0',
    name: 'Mark2',
    uptime: process.uptime(),
    model: activeModel,
    modelLabel: getActiveModelLabel(),
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

// Liste des modeles disponibles
app.get('/models', auth, (req, res) => {
  const { models } = loadModels();
  res.json({
    active: activeModel,
    activeLabel: getActiveModelLabel(),
    models: models.map(m => ({
      id: m.id,
      label: m.label,
      description: m.description,
      tier: m.tier,
      active: m.id === activeModel,
    })),
  });
});

// Changer le modele actif
app.post('/model', auth, (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: 'Parametre "model" requis' });
  }
  const found = findModelByAlias(model);
  if (!found) {
    const { models } = loadModels();
    const available = models.map(m => `${m.label} (${m.alias[0]})`).join(', ');
    return res.status(404).json({ error: `Modele "${model}" introuvable. Disponibles : ${available}` });
  }
  activeModel = found.id;
  console.log(`[Model] Switch -> ${found.label} (${found.id})`);
  res.json({ ok: true, model: found.id, label: found.label });
});

// Chat avec un agent
app.post('/chat', auth, async (req, res) => {
  const {
    message,
    agentId = 'jarvis',
    source = 'WEB',
    sessionKey,
    image,
    imageType,
  } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide' });
  }

  // Charger l'agent
  const effectiveAgentId = sessionKey || agentId;

  // Intercepter les commandes slash
  if (message.trim().startsWith('/')) {
    const cmd = handleSlashCommand(message, effectiveAgentId);
    if (cmd.handled) {
      console.log(`[Cmd] ${source} -> commande: "${message.trim()}"`);
      history.appendMessage(effectiveAgentId, 'user', message, source);
      history.appendMessage(effectiveAgentId, 'assistant', cmd.response, 'MARK2');
      return res.json({
        response: cmd.response,
        agentId: effectiveAgentId,
        agentLabel: effectiveAgentId,
        toolCalls: [],
        timestamp: Date.now(),
        isCommand: true,
      });
    }
  }

  const agent = agents.loadAgent(effectiveAgentId);
  if (!agent) {
    return res.status(404).json({ error: `Agent "${effectiveAgentId}" introuvable` });
  }

  const hasImage = image && typeof image === 'string' && image.length > 0;
  console.log(`[Chat] ${source} -> ${agent.label}: "${message.substring(0, 80)}..."${hasImage ? ' [+IMAGE]' : ''}`);

  try {
    // Sauvegarder le texte dans l'historique (pas l'image base64)
    const historyText = hasImage ? `[Image jointe] ${message}` : message;
    history.appendMessage(effectiveAgentId, 'user', historyText, source);

    // Charger le contexte (derniers messages)
    const contextMessages = history.getContextMessages(effectiveAgentId, 40);

    // Si une image est presente, modifier le dernier message user pour inclure l'image
    if (hasImage && contextMessages.length > 0) {
      const lastIdx = contextMessages.length - 1;
      const lastMsg = contextMessages[lastIdx];
      if (lastMsg.role === 'user') {
        const mediaType = imageType || 'image/jpeg';
        contextMessages[lastIdx] = {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: message },
          ],
        };
      }
    }

    // Preparer les outils
    const toolDefs = getToolDefinitions(agent.enabledTools);
    const context = { workspace: agent.workspace, agentId: effectiveAgentId };

    // Utiliser le modele actif (sauf si l'agent a un override)
    const model = agent.model || activeModel;

    // Appel Claude avec boucle tool_use
    const result = await chat({
      system: agent.system,
      messages: contextMessages,
      tools: toolDefs,
      executeTool: (name, input) => executeTool(name, input, context),
      model,
      maxTokens: agent.maxTokens,
    });

    // Sauvegarder la reponse dans l'historique
    history.appendMessage(effectiveAgentId, 'assistant', result.response, 'MARK2');

    res.json({
      response: result.response,
      agentId: effectiveAgentId,
      agentLabel: agent.label,
      model,
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
    image,
    imageType,
  } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide' });
  }

  // Intercepter les commandes slash en vocal aussi
  if (message.trim().startsWith('/')) {
    const cmd = handleSlashCommand(message, agentId);
    if (cmd.handled) {
      // En vocal, retirer le markdown de la reponse
      const cleanResponse = cmd.response.replace(/\*\*/g, '').replace(/`/g, '').replace(/\n/g, ' ');
      history.appendMessage(agentId, 'user', message, source);
      history.appendMessage(agentId, 'assistant', cleanResponse, 'MARK2');
      return res.json({ response: cleanResponse, agentId, timestamp: Date.now(), isCommand: true });
    }
  }

  const agent = agents.loadAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: `Agent "${agentId}" introuvable` });
  }

  const hasImage = image && typeof image === 'string' && image.length > 0;
  console.log(`[Voice] ${source} -> ${agent.label}: "${message.substring(0, 80)}..."${hasImage ? ' [+IMAGE]' : ''}`);

  try {
    const historyText = hasImage ? `[Image jointe] ${message}` : message;
    history.appendMessage(agentId, 'user', historyText, source);
    const contextMessages = history.getContextMessages(agentId, 20);

    // Si une image est presente, modifier le dernier message user
    if (hasImage && contextMessages.length > 0) {
      const lastIdx = contextMessages.length - 1;
      const lastMsg = contextMessages[lastIdx];
      if (lastMsg.role === 'user') {
        const mediaType = imageType || 'image/jpeg';
        contextMessages[lastIdx] = {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: message },
          ],
        };
      }
    }

    const model = agent.model || activeModel;

    // Pour le vocal, pas d'outils (reponse directe et rapide)
    const result = await chat({
      system: agent.system + '\n\nIMPORTANT: Tu reponds a l\'oral. Sois concis, naturel, direct. Pas de markdown, pas de backticks, pas de listes. Maximum 3-4 phrases courtes.',
      messages: contextMessages,
      tools: [], // Pas d'outils en mode vocal
      model,
      maxTokens: 1024,
    });

    history.appendMessage(agentId, 'assistant', result.response, 'MARK2');

    res.json({
      response: result.response,
      agentId,
      model,
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

// --- Telegram Webhook ---
const telegram = require('./lib/telegram');

app.post('/telegram/webhook', async (req, res) => {
  // Repondre immediatement a Telegram (eviter timeout)
  res.json({ ok: true });

  try {
    const update = req.body;
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // Verifier l'autorisation
    if (!telegram.isAuthorized(chatId)) {
      console.log(`[Telegram] Message non autorise de chat_id=${chatId}`);
      return;
    }

    console.log(`[Telegram] Message de ${msg.from?.first_name || chatId}: "${text.substring(0, 80)}"`);

    // Commandes Telegram specifiques (/start, /agent)
    const tgCmd = telegram.parseTelegramCommand(text, chatId);
    if (tgCmd.handled) {
      await telegram.sendMessage(chatId, tgCmd.response);
      return;
    }

    // Commandes slash Mark2 (/modele, /agents, /clear, /help)
    const state = telegram.getState(chatId);
    if (text.startsWith('/')) {
      const cmd = handleSlashCommand(text, state.agentId);
      if (cmd.handled) {
        // Nettoyer le markdown Mark2 pour Telegram
        history.appendMessage(state.agentId, 'user', text, 'TELEGRAM');
        history.appendMessage(state.agentId, 'assistant', cmd.response, 'MARK2');
        await telegram.sendMessage(chatId, cmd.response);
        return;
      }
    }

    // Message normal -> envoyer a l'agent actif
    const agent = agents.loadAgent(state.agentId);
    if (!agent) {
      await telegram.sendMessage(chatId, `Agent "${state.agentId}" introuvable. Utilise /agent jarvis pour revenir a Jarvis.`);
      return;
    }

    // Sauvegarder et charger le contexte
    history.appendMessage(state.agentId, 'user', text, 'TELEGRAM');
    const contextMessages = history.getContextMessages(state.agentId, 30);

    const model = agent.model || activeModel;

    const result = await chat({
      system: agent.system,
      messages: contextMessages,
      tools: getToolDefinitions(agent.enabledTools),
      executeTool: (name, input) => executeTool(name, input, { workspace: agent.workspace, agentId: state.agentId }),
      model,
      maxTokens: agent.maxTokens,
    });

    history.appendMessage(state.agentId, 'assistant', result.response, 'MARK2');

    await telegram.sendMessage(chatId, result.response);

  } catch (err) {
    console.error('[Telegram] Erreur webhook:', err.message);
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) {
        await telegram.sendMessage(chatId, `Erreur: ${err.message}`);
      }
    } catch { /* ignore */ }
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║          MARK2 Engine v1.1.0         ║');
  console.log('  ║   Moteur d\'Agents IA Custom          ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  Port:    ${PORT}`);
  console.log(`  Modele:  ${getActiveModelLabel()} (${activeModel})`);
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
