const twilio = require('twilio');

let client = null;

function getClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN requis dans .env');
    }
    client = twilio(sid, token);
  }
  return client;
}

// Conferences actives en memoire
const activeConferences = new Map();

/**
 * Cree une conference et appelle les participants.
 *
 * @param {Object} opts
 * @param {string} opts.userPhone - Numero du user (format E.164: +33...)
 * @param {string} opts.targetPhone - Numero de la personne a appeler
 * @param {string} opts.targetName - Nom du contact
 * @param {string} opts.baseUrl - URL publique de Mark2 (pour webhooks)
 * @returns {Object} { conferenceId, conferenceName }
 */
async function createConference({ userPhone, targetPhone, targetName, baseUrl }) {
  const twilioClient = getClient();
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioNumber) {
    throw new Error('TWILIO_PHONE_NUMBER requis dans .env');
  }

  const conferenceName = `jarvis-conf-${Date.now()}`;
  const conferenceId = conferenceName;

  // Stocker les infos de la conference
  activeConferences.set(conferenceId, {
    id: conferenceId,
    name: conferenceName,
    userPhone,
    targetPhone,
    targetName,
    status: 'initiating',
    createdAt: new Date(),
    participants: [],
    transcription: [],
  });

  console.log(`[Twilio] Creating conference: ${conferenceName}`);
  console.log(`[Twilio] User: ${userPhone}, Target: ${targetName} (${targetPhone})`);

  // Appeler le user d'abord - quand il decroche, il rejoint la conference
  try {
    const userCall = await twilioClient.calls.create({
      to: userPhone,
      from: twilioNumber,
      url: `${baseUrl}/twilio/voice?conference=${encodeURIComponent(conferenceName)}&role=user`,
      statusCallback: `${baseUrl}/twilio/status?conference=${encodeURIComponent(conferenceName)}&role=user`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    console.log(`[Twilio] User call SID: ${userCall.sid}`);

    activeConferences.get(conferenceId).participants.push({
      role: 'user',
      callSid: userCall.sid,
      phone: userPhone,
      status: 'calling',
    });
  } catch (err) {
    console.error(`[Twilio] Error calling user: ${err.message}`);
    activeConferences.get(conferenceId).status = 'error';
    throw new Error(`Impossible d'appeler ${userPhone}: ${err.message}`);
  }

  // Appeler la cible - rejoint la meme conference
  try {
    const targetCall = await twilioClient.calls.create({
      to: targetPhone,
      from: twilioNumber,
      url: `${baseUrl}/twilio/voice?conference=${encodeURIComponent(conferenceName)}&role=target`,
      statusCallback: `${baseUrl}/twilio/status?conference=${encodeURIComponent(conferenceName)}&role=target`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    console.log(`[Twilio] Target call SID: ${targetCall.sid}`);

    activeConferences.get(conferenceId).participants.push({
      role: 'target',
      callSid: targetCall.sid,
      phone: targetPhone,
      name: targetName,
      status: 'calling',
    });

    activeConferences.get(conferenceId).status = 'calling';
  } catch (err) {
    console.error(`[Twilio] Error calling target: ${err.message}`);
    activeConferences.get(conferenceId).status = 'partial_error';
    throw new Error(`Impossible d'appeler ${targetName} (${targetPhone}): ${err.message}`);
  }

  return {
    conferenceId,
    conferenceName,
  };
}

/**
 * Genere le TwiML pour rejoindre une conference.
 * Inclut <Stream> pour envoyer l'audio a Mark2 via WebSocket.
 *
 * @param {string} conferenceName
 * @param {string} role - 'user' ou 'target'
 * @param {string} baseUrl - URL publique de Mark2
 * @returns {string} TwiML XML
 */
function generateConferenceTwiml(conferenceName, role, baseUrl) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Petit message d'accueil
  if (role === 'user') {
    response.say({ language: 'fr-FR', voice: 'alice' },
      'Jarvis rejoint la conversation.');
  } else {
    response.say({ language: 'fr-FR', voice: 'alice' },
      'Connexion en cours.');
  }

  // Rejoindre la conference
  const dial = response.dial();
  const conference = dial.conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: role === 'user',
    beep: false,
    statusCallback: `${baseUrl}/twilio/conference-status?conference=${encodeURIComponent(conferenceName)}`,
    statusCallbackEvent: 'start end join leave',
    statusCallbackMethod: 'POST',
  }, conferenceName);

  // Stream audio vers Mark2 via WebSocket
  const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  response.connect().stream({
    url: `${wsUrl}/twilio/audio-stream`,
    name: `${conferenceName}-${role}`,
  });

  return response.toString();
}

/**
 * Met a jour le statut d'un participant dans la conference.
 */
function updateParticipantStatus(conferenceId, role, status) {
  const conf = activeConferences.get(conferenceId);
  if (!conf) return;

  const participant = conf.participants.find(p => p.role === role);
  if (participant) {
    participant.status = status;
    console.log(`[Twilio] ${conferenceId} - ${role} status: ${status}`);
  }

  // Mettre a jour le statut global
  const allCompleted = conf.participants.every(p =>
    p.status === 'completed' || p.status === 'failed'
  );
  if (allCompleted) {
    conf.status = 'ended';
    console.log(`[Twilio] Conference ${conferenceId} ended`);
  } else if (conf.participants.some(p => p.status === 'in-progress')) {
    conf.status = 'active';
  }
}

/**
 * Termine une conference active.
 */
async function endConference(conferenceId) {
  const conf = activeConferences.get(conferenceId);
  if (!conf) {
    throw new Error(`Conference ${conferenceId} introuvable`);
  }

  const twilioClient = getClient();

  // Raccrocher tous les participants
  for (const participant of conf.participants) {
    if (participant.status !== 'completed' && participant.status !== 'failed') {
      try {
        await twilioClient.calls(participant.callSid).update({ status: 'completed' });
      } catch (err) {
        console.error(`[Twilio] Error ending call ${participant.callSid}: ${err.message}`);
      }
    }
  }

  conf.status = 'ended';
  console.log(`[Twilio] Conference ${conferenceId} terminated`);

  return { status: 'ended', transcription: conf.transcription };
}

/**
 * Ajoute une ligne de transcription a la conference.
 */
function addTranscription(conferenceId, role, text) {
  const conf = activeConferences.get(conferenceId);
  if (!conf) return;

  conf.transcription.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Retourne les conferences actives.
 */
function getActiveConferences() {
  const result = [];
  for (const [id, conf] of activeConferences) {
    if (conf.status !== 'ended') {
      result.push({
        id,
        targetName: conf.targetName,
        status: conf.status,
        participants: conf.participants.map(p => ({
          role: p.role,
          status: p.status,
          name: p.name || p.phone,
        })),
        createdAt: conf.createdAt,
      });
    }
  }
  return result;
}

/**
 * Retourne les infos d'une conference.
 */
function getConference(conferenceId) {
  return activeConferences.get(conferenceId) || null;
}

// Nettoyage des conferences terminees (> 2h)
setInterval(() => {
  const now = Date.now();
  for (const [id, conf] of activeConferences) {
    if (conf.status === 'ended' && now - conf.createdAt.getTime() > 7200000) {
      activeConferences.delete(id);
      console.log(`[Twilio] Cleaned up conference: ${id}`);
    }
  }
}, 600000);

module.exports = {
  getClient,
  createConference,
  generateConferenceTwiml,
  updateParticipantStatus,
  endConference,
  addTranscription,
  getActiveConferences,
  getConference,
};
