const history = require('../history');
const agentsLib = require('../agents');

/**
 * Outil read_agent_history : permet a un agent (typiquement Jarvis) 
 * de lire l'historique de conversation d'un autre agent.
 */
const readHistoryDefinition = {
  name: 'read_agent_history',
  description: 'Lit l\'historique de conversation d\'un autre agent. Utile pour savoir ce qui a ete discute avec un agent specialise. Agents disponibles : jarvis, aifc, comptaapp, paybrain, paybrain-app, paybrain-tpe, salesbrain, blockbrain, businessplan-paybrain, tradebrain, swapdf, bucket-todo.',
  input_schema: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: 'ID de l\'agent dont on veut lire l\'historique (ex: paybrain, comptaapp, tradebrain)',
      },
      limit: {
        type: 'number',
        description: 'Nombre de messages a recuperer (defaut: 20, max: 100)',
      },
    },
    required: ['agent_id'],
  },
};

function readAgentHistory(input) {
  const { agent_id, limit = 20 } = input;

  // Verifier que l'agent existe
  const agent = agentsLib.loadAgent(agent_id);
  if (!agent) {
    const available = agentsLib.listAgents().map(a => a.id).join(', ');
    return `Agent "${agent_id}" introuvable. Agents disponibles : ${available}`;
  }

  const messages = history.getFullHistory(agent_id, Math.min(limit, 100));

  if (messages.length === 0) {
    return `Aucun historique pour l'agent "${agent.label}" (${agent_id}).`;
  }

  const formatted = messages.map(m => {
    const date = new Date(m.timestamp).toLocaleString('fr-FR');
    const source = m.source ? ` [${m.source}]` : '';
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content;
    return `[${date}]${source} ${m.role}: ${truncated}`;
  }).join('\n\n');

  return `Historique de ${agent.label} (${messages.length} messages) :\n\n${formatted}`;
}

/**
 * Outil list_agents : liste tous les agents disponibles avec leur description
 */
const listAgentsDefinition = {
  name: 'list_agents',
  description: 'Liste tous les agents disponibles dans Mark2 avec leur description.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

function listAgentsExecute() {
  const agents = agentsLib.listAgents();
  if (agents.length === 0) {
    return 'Aucun agent configure.';
  }

  const agent = agentsLib.loadAgent;
  const lines = agents.map(a => {
    const full = agentsLib.loadAgent(a.id);
    const desc = full?.description || '';
    return `- ${a.label} (${a.id}) : ${desc}`;
  });

  return `${agents.length} agents disponibles :\n${lines.join('\n')}`;
}

module.exports = {
  readAgentHistory: { definition: readHistoryDefinition, execute: readAgentHistory },
  listAgents: { definition: listAgentsDefinition, execute: listAgentsExecute },
};
