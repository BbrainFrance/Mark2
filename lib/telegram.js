/**
 * Module Telegram pour Mark2.
 * Gere l'envoi/reception de messages via Telegram Bot API.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// State par chat_id : { agentId, model }
const chatStates = {};

function getState(chatId) {
  if (!chatStates[chatId]) {
    chatStates[chatId] = { agentId: 'jarvis' };
  }
  return chatStates[chatId];
}

function setState(chatId, updates) {
  chatStates[chatId] = { ...getState(chatId), ...updates };
}

/**
 * Envoie un message Telegram.
 * Supporte le markdown Telegram (MarkdownV2 simplifie via HTML).
 */
async function sendMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] Pas de TELEGRAM_BOT_TOKEN configure');
    return false;
  }

  // Telegram a une limite de 4096 caracteres par message
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown',
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        // Si le markdown echoue, renvoyer en texte brut
        if (data.description && data.description.includes("can't parse")) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: chunk,
            }),
          });
        } else {
          console.error('[Telegram] sendMessage error:', data.description);
          return false;
        }
      }
    } catch (err) {
      console.error('[Telegram] sendMessage failed:', err.message);
      return false;
    }
  }

  return true;
}

/**
 * Decoupe un message long en chunks de maxLen caracteres.
 */
function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Couper au dernier saut de ligne avant la limite
    let cutIndex = remaining.lastIndexOf('\n', maxLen);
    if (cutIndex < maxLen / 2) {
      // Sinon couper au dernier espace
      cutIndex = remaining.lastIndexOf(' ', maxLen);
    }
    if (cutIndex < maxLen / 2) {
      cutIndex = maxLen;
    }

    chunks.push(remaining.substring(0, cutIndex));
    remaining = remaining.substring(cutIndex).trimStart();
  }

  return chunks;
}

/**
 * Verifie si un chat_id est autorise.
 */
function isAuthorized(chatId) {
  if (!TELEGRAM_CHAT_ID) return true; // Si pas configure, accepter tous
  const allowedIds = TELEGRAM_CHAT_ID.split(',').map(id => id.trim());
  return allowedIds.includes(String(chatId));
}

/**
 * Parse les commandes Telegram specifiques.
 * Retourne { handled, response, stateUpdate } ou { handled: false }
 */
function parseTelegramCommand(text, chatId) {
  const trimmed = text.trim().toLowerCase();
  const state = getState(chatId);

  // /start -> message de bienvenue
  if (trimmed === '/start') {
    return {
      handled: true,
      response: `Salut ! Je suis *Jarvis* via Mark2.\n\nCommandes :\n/agent - voir l'agent actif\n/agent <nom> - changer d'agent\n/modele - voir le modele actif\n/modele <nom> - changer de modele\n/agents - lister les agents\n/clear - effacer l'historique\n/help - cette aide`,
    };
  }

  // /agent (sans argument) -> afficher l'agent actif
  if (trimmed === '/agent') {
    return {
      handled: true,
      response: `Agent actif : *${state.agentId}*\n\nPour changer : /agent paybrain, /agent comptaapp, etc.`,
    };
  }

  // /agent <nom> -> switcher d'agent
  const agentMatch = text.trim().match(/^\/agent\s+(.+)$/i);
  if (agentMatch) {
    const newAgent = agentMatch[1].trim().toLowerCase();
    setState(chatId, { agentId: newAgent });
    return {
      handled: true,
      response: `Agent change : *${newAgent}*`,
    };
  }

  return { handled: false };
}

/**
 * Configure le webhook Telegram.
 */
async function setupWebhook(webhookUrl) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] Pas de TELEGRAM_BOT_TOKEN configure');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log(`[Telegram] Webhook configure: ${webhookUrl}`);
    } else {
      console.error('[Telegram] Webhook error:', data.description);
    }
    return data.ok;
  } catch (err) {
    console.error('[Telegram] Webhook setup failed:', err.message);
    return false;
  }
}

module.exports = {
  sendMessage,
  isAuthorized,
  parseTelegramCommand,
  getState,
  setState,
  setupWebhook,
};
