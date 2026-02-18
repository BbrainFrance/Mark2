const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'data', 'history');

// S'assurer que le dossier existe
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

/**
 * Genere le chemin du fichier d'historique pour un agent
 */
function historyPath(agentId) {
  return path.join(HISTORY_DIR, `${agentId}.json`);
}

/**
 * Charge l'historique de conversation d'un agent
 * @param {string} agentId
 * @returns {Array} Messages [{role, content, timestamp, source}]
 */
function loadHistory(agentId) {
  const filePath = historyPath(agentId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`[History] Erreur lecture ${agentId}:`, err.message);
    return [];
  }
}

/**
 * Sauvegarde l'historique complet d'un agent
 */
function saveHistory(agentId, messages) {
  const filePath = historyPath(agentId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[History] Erreur ecriture ${agentId}:`, err.message);
  }
}

/**
 * Ajoute un message a l'historique d'un agent
 * @param {string} agentId
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Contenu du message
 * @param {string} source - Source: 'WEB', 'ANDROID', 'TELEGRAM', 'APPEL'
 */
function appendMessage(agentId, role, content, source = 'WEB') {
  const messages = loadHistory(agentId);
  messages.push({
    role,
    content,
    timestamp: Date.now(),
    source,
  });
  saveHistory(agentId, messages);
  return messages;
}

/**
 * Estime grossierement le nombre de tokens (~4 chars par token).
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/**
 * Retourne les N derniers messages pour le contexte API
 * (format compatible Anthropic Messages API).
 * Respecte un budget de tokens pour eviter de depasser la limite Claude.
 * @param {string} agentId
 * @param {number} limit - Nombre max de messages
 * @param {number} maxTokens - Budget max de tokens (~150k par defaut)
 * @returns {Array} [{role: 'user'|'assistant', content: string}]
 */
function getContextMessages(agentId, limit = 50, maxTokens = 80000) {
  const messages = loadHistory(agentId);
  const recent = messages.slice(-limit);
  
  // Convertir au format Anthropic (role + content seulement)
  const formatted = recent.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  // Verifier le budget de tokens et retirer les plus anciens si necessaire
  let totalTokens = formatted.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  while (totalTokens > maxTokens && formatted.length > 2) {
    const removed = formatted.shift();
    totalTokens -= estimateTokens(removed.content);
  }

  return formatted;
}

/**
 * Retourne l'historique complet avec metadata (pour l'UI)
 */
function getFullHistory(agentId, limit = 100) {
  const messages = loadHistory(agentId);
  return messages.slice(-limit);
}

/**
 * Efface l'historique d'un agent
 */
function clearHistory(agentId) {
  const filePath = historyPath(agentId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  loadHistory,
  saveHistory,
  appendMessage,
  getContextMessages,
  getFullHistory,
  clearHistory,
};
