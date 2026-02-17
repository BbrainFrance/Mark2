const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Envoie un message a Claude et gere la boucle tool_use automatiquement.
 * 
 * @param {Object} opts
 * @param {string} opts.system - System prompt
 * @param {Array} opts.messages - Historique de conversation [{role, content}]
 * @param {Array} opts.tools - Definitions d'outils Anthropic
 * @param {Function} opts.executeTool - async (toolName, toolInput) => result
 * @param {string} opts.model - Modele Claude
 * @param {number} opts.maxTokens - Tokens max par reponse
 * @param {number} opts.maxToolRounds - Nombre max de rounds tool_use (securite)
 * @returns {Object} { response: string, toolCalls: Array, messages: Array }
 */
/**
 * Estime le nombre de tokens dans un texte (~4 chars/token).
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estime les tokens d'un message Anthropic (peut contenir du texte, tool_use, etc.)
 */
function estimateMessageTokens(msg) {
  if (typeof msg.content === 'string') {
    return estimateTokens(msg.content);
  }
  if (Array.isArray(msg.content)) {
    let total = 0;
    for (const block of msg.content) {
      if (block.type === 'text') total += estimateTokens(block.text);
      else if (block.type === 'tool_use') total += estimateTokens(JSON.stringify(block.input));
      else if (block.type === 'tool_result') total += estimateTokens(block.content);
      else total += estimateTokens(JSON.stringify(block));
    }
    return total;
  }
  return estimateTokens(JSON.stringify(msg.content));
}

/**
 * Tronque les messages pour rester sous un budget de tokens.
 * Supprime les messages les plus anciens en priorite (garde toujours le dernier user).
 */
function trimMessagesToFit(messages, maxTokens = 150000) {
  let totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

  if (totalTokens <= maxTokens) return messages;

  const trimmed = [...messages];
  // Supprimer les plus anciens (jamais le dernier)
  while (totalTokens > maxTokens && trimmed.length > 1) {
    const removed = trimmed.shift();
    totalTokens -= estimateMessageTokens(removed);
  }

  console.log(`[Anthropic] Context trimmed: ${messages.length} -> ${trimmed.length} messages (~${totalTokens} tokens)`);
  return trimmed;
}

/**
 * Tronque les gros contenus tool_use dans un message assistant pour economiser des tokens.
 * Les inputs HTML/JSON > MAX_TOOL_CONTENT chars sont raccourcis.
 */
const MAX_TOOL_CONTENT = 2000;

function truncateToolContent(content) {
  if (!Array.isArray(content)) return content;

  return content.map(block => {
    if (block.type === 'tool_use' && block.input) {
      const inputStr = JSON.stringify(block.input);
      if (inputStr.length > MAX_TOOL_CONTENT) {
        // Garder un resume de l'input, pas tout le HTML
        const truncatedInput = {};
        for (const [key, val] of Object.entries(block.input)) {
          if (typeof val === 'string' && val.length > 500) {
            truncatedInput[key] = val.substring(0, 400) + `... [tronque: ${val.length} chars]`;
          } else {
            truncatedInput[key] = val;
          }
        }
        return { ...block, input: truncatedInput };
      }
    }
    if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > MAX_TOOL_CONTENT) {
      return { ...block, content: block.content.substring(0, MAX_TOOL_CONTENT) + `\n... [tronque: ${block.content.length} chars]` };
    }
    return block;
  });
}

async function chat({ system, messages, tools = [], executeTool, model, maxTokens = 4096, maxToolRounds = 15 }) {
  const anthropic = getClient();
  model = model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250514';

  // Tronquer le contexte si trop gros AVANT de commencer
  const workingMessages = trimMessagesToFit([...messages]);
  const allToolCalls = [];
  let finalResponse = '';
  let round = 0;

  while (round < maxToolRounds) {
    round++;

    const apiParams = {
      model,
      max_tokens: maxTokens,
      system,
      messages: workingMessages,
    };

    if (tools.length > 0) {
      apiParams.tools = tools;
    }

    const response = await anthropic.messages.create(apiParams);

    // Extraire texte et tool_use du contenu
    const textParts = [];
    const toolUseParts = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolUseParts.push(block);
      }
    }

    // Ajouter la reponse de l'assistant aux messages
    // Tronquer les gros tool_use inputs pour ne pas exploser le contexte
    const contentToStore = truncateToolContent(response.content);
    workingMessages.push({ role: 'assistant', content: contentToStore });

    // Si pas de tool_use, on a la reponse finale
    if (response.stop_reason !== 'tool_use' || toolUseParts.length === 0) {
      finalResponse = textParts.join('\n');
      break;
    }

    // Executer chaque outil et collecter les resultats
    const toolResults = [];
    for (const toolUse of toolUseParts) {
      allToolCalls.push({
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
      });

      let result;
      try {
        result = await executeTool(toolUse.name, toolUse.input);
      } catch (err) {
        result = `Erreur: ${err.message}`;
      }

      // Tronquer les resultats d'outils tres longs
      let resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      if (resultStr.length > MAX_TOOL_CONTENT) {
        resultStr = resultStr.substring(0, MAX_TOOL_CONTENT) + `\n... [tronque: ${resultStr.length} chars]`;
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: resultStr,
      });
    }

    // Ajouter les resultats au contexte
    workingMessages.push({ role: 'user', content: toolResults });

    // Re-verifier la taille du contexte apres chaque round
    const totalTokens = workingMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (totalTokens > 180000) {
      // Urgence: tronquer pour pouvoir continuer
      const trimmed = trimMessagesToFit(workingMessages, 150000);
      workingMessages.length = 0;
      workingMessages.push(...trimmed);
    }

    // Si on a aussi du texte, le garder pour la reponse
    if (textParts.length > 0) {
      finalResponse = textParts.join('\n');
    }
  }

  if (round >= maxToolRounds) {
    finalResponse += '\n[Limite de rounds d\'outils atteinte]';
  }

  return {
    response: finalResponse,
    toolCalls: allToolCalls,
    messages: workingMessages,
  };
}

module.exports = { chat, getClient };
