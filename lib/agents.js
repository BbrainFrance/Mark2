const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

// Cache des configs agents
const agentCache = new Map();

/**
 * Charge la config d'un agent depuis son dossier
 * @param {string} agentId - Ex: 'jarvis', 'comptaapp', etc.
 * @returns {Object|null} { id, label, system, workspace, memory, tools }
 */
function loadAgent(agentId) {
  if (agentCache.has(agentId)) {
    return agentCache.get(agentId);
  }

  const agentDir = path.join(AGENTS_DIR, agentId);
  const configPath = path.join(agentDir, 'config.json');
  const systemPath = path.join(agentDir, 'system.md');

  if (!fs.existsSync(configPath)) {
    console.error(`[Agents] Config introuvable: ${configPath}`);
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    let system = '';
    if (fs.existsSync(systemPath)) {
      system = fs.readFileSync(systemPath, 'utf-8');
    }

    const agent = {
      id: agentId,
      label: config.label || agentId,
      system,
      workspace: config.workspace || null,
      enabledTools: config.tools || ['execute_command', 'read_file', 'write_file', 'list_files'],
      model: config.model || null,
      maxTokens: config.maxTokens || 4096,
      ...config,
    };

    agentCache.set(agentId, agent);
    return agent;
  } catch (err) {
    console.error(`[Agents] Erreur chargement ${agentId}:`, err.message);
    return null;
  }
}

/**
 * Liste tous les agents disponibles
 * @returns {Array} [{id, label, status}]
 */
function listAgents() {
  if (!fs.existsSync(AGENTS_DIR)) {
    return [];
  }

  const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  return dirs.map(id => {
    const agent = loadAgent(id);
    if (!agent) return null;
    return {
      id: agent.id,
      label: agent.label,
      status: 'active',
    };
  }).filter(Boolean);
}

/**
 * Charge la memoire persistante d'un agent
 */
function loadMemory(agentId) {
  const memPath = path.join(AGENTS_DIR, agentId, 'memory.json');
  if (!fs.existsSync(memPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(memPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Sauvegarde la memoire persistante d'un agent
 */
function saveMemory(agentId, memory) {
  const memPath = path.join(AGENTS_DIR, agentId, 'memory.json');
  fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), 'utf-8');
}

/**
 * Recharge la config d'un agent (apres modification)
 */
function reloadAgent(agentId) {
  agentCache.delete(agentId);
  return loadAgent(agentId);
}

/**
 * Recharge tous les agents
 */
function reloadAll() {
  agentCache.clear();
}

module.exports = {
  loadAgent,
  listAgents,
  loadMemory,
  saveMemory,
  reloadAgent,
  reloadAll,
};
