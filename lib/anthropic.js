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
async function chat({ system, messages, tools = [], executeTool, model, maxTokens = 4096, maxToolRounds = 15 }) {
  const anthropic = getClient();
  model = model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250514';

  const workingMessages = [...messages];
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
    workingMessages.push({ role: 'assistant', content: response.content });

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

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }

    // Ajouter les resultats au contexte
    workingMessages.push({ role: 'user', content: toolResults });

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
