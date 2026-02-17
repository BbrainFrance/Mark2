const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

// Cache des configs agents (expire apres 5 min pour rafraichir les commits)
const agentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Charge la config d'un agent depuis son dossier
 * @param {string} agentId - Ex: 'jarvis', 'comptaapp', etc.
 * @returns {Object|null} { id, label, system, workspace, memory, tools }
 */
function loadAgent(agentId) {
  // Verifier le cache avec TTL
  if (agentCache.has(agentId)) {
    const cached = agentCache.get(agentId);
    if (Date.now() - cached._cachedAt < CACHE_TTL) {
      return cached;
    }
    agentCache.delete(agentId);
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

    // Injection dynamique des derniers commits git
    const workspace = config.workspace || null;
    if (workspace) {
      const gitLog = getRecentCommits(workspace);
      if (gitLog) {
        system += `\n\n## DERNIERS COMMITS (auto-genere)\n${gitLog}`;
      }
    }

    const agent = {
      id: agentId,
      label: config.label || agentId,
      system,
      workspace,
      enabledTools: config.tools || ['execute_command', 'read_file', 'write_file', 'list_files'],
      model: config.model || null,
      maxTokens: config.maxTokens || 4096,
      ...config,
      _cachedAt: Date.now(),
    };

    agentCache.set(agentId, agent);
    return agent;
  } catch (err) {
    console.error(`[Agents] Erreur chargement ${agentId}:`, err.message);
    return null;
  }
}

/**
 * Recupere les 10 derniers commits git d'un workspace
 * @param {string} workspace - Chemin du repo
 * @returns {string|null} Commits formmates ou null si pas de repo git
 */
function getRecentCommits(workspace) {
  try {
    if (!fs.existsSync(workspace)) return null;

    const gitDir = path.join(workspace, '.git');
    if (!fs.existsSync(gitDir)) return null;

    const log = execSync(
      'git log --oneline --no-decorate -n 10 --format="%h %s (%cr)"',
      { cwd: workspace, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    return log || null;
  } catch {
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
 * Cree un nouvel agent
 * @param {string} agentId - Identifiant unique (slug)
 * @param {Object} options - { label, description, system, tools }
 * @returns {Object} L'agent cree
 */
function createAgent(agentId, { label, description, system, tools }) {
  const agentDir = path.join(AGENTS_DIR, agentId);

  if (fs.existsSync(agentDir)) {
    throw new Error(`L'agent "${agentId}" existe deja`);
  }

  fs.mkdirSync(agentDir, { recursive: true });

  const config = {
    label: label || agentId,
    description: description || '',
    workspace: null,
    tools: tools || ['execute_command', 'read_file', 'write_file', 'list_files', 'search_files'],
    model: null,
    maxTokens: 4096,
  };

  fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
  fs.writeFileSync(path.join(agentDir, 'system.md'), system || '', 'utf-8');
  fs.writeFileSync(path.join(agentDir, 'memory.json'), '{}', 'utf-8');

  console.log(`[Agents] Agent cree: ${agentId} (${label})`);
  return loadAgent(agentId);
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
  createAgent,
  loadMemory,
  saveMemory,
  reloadAgent,
  reloadAll,
};
