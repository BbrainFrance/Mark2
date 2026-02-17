const shell = require('./shell');
const files = require('./files');
const agentTools = require('./agents');
const pdf = require('./pdf');

/**
 * Registre central des outils disponibles.
 * Chaque outil a: { definition, execute(input, context) }
 */
const TOOLS = {
  execute_command: {
    definition: shell.definition,
    execute: shell.execute,
  },
  read_file: {
    definition: files.readFile.definition,
    execute: files.readFile.execute,
  },
  write_file: {
    definition: files.writeFile.definition,
    execute: files.writeFile.execute,
  },
  list_files: {
    definition: files.listFiles.definition,
    execute: files.listFiles.execute,
  },
  search_files: {
    definition: files.searchFiles.definition,
    execute: files.searchFiles.execute,
  },
  read_agent_history: {
    definition: agentTools.readAgentHistory.definition,
    execute: agentTools.readAgentHistory.execute,
  },
  list_agents: {
    definition: agentTools.listAgents.definition,
    execute: agentTools.listAgents.execute,
  },
  generate_document: {
    definition: pdf.generateDocument.definition,
    execute: pdf.generateDocument.execute,
  },
  generate_pdf: {
    definition: pdf.generatePdf.definition,
    execute: pdf.generatePdf.execute,
  },
};

/**
 * Retourne les definitions d'outils pour l'API Anthropic
 * @param {Array} enabledTools - Liste de noms d'outils a activer
 * @returns {Array} Definitions format Anthropic
 */
function getToolDefinitions(enabledTools = null) {
  const toolNames = enabledTools || Object.keys(TOOLS);
  return toolNames
    .filter(name => TOOLS[name])
    .map(name => TOOLS[name].definition);
}

/**
 * Execute un outil par son nom
 * @param {string} toolName
 * @param {Object} toolInput
 * @param {Object} context - { workspace, agentId }
 * @returns {string} Resultat
 */
async function executeTool(toolName, toolInput, context = {}) {
  const tool = TOOLS[toolName];
  if (!tool) {
    return `Outil inconnu: ${toolName}`;
  }
  return tool.execute(toolInput, context);
}

module.exports = { TOOLS, getToolDefinitions, executeTool };
