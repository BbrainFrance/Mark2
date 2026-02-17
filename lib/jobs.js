const crypto = require('crypto');

/**
 * Gestionnaire de jobs asynchrones.
 * Permet de lancer des taches en arriere-plan et de les interroger.
 */

const jobs = new Map();

function createJob(agentId, agentLabel, message, source) {
  const id = crypto.randomBytes(12).toString('hex');
  const job = {
    id,
    agentId,
    agentLabel,
    message: message.substring(0, 100),
    source,
    status: 'processing', // processing | completed | error
    createdAt: Date.now(),
    completedAt: null,
    result: null,
    error: null,
  };
  jobs.set(id, job);
  return id;
}

function completeJob(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'completed';
  job.result = result;
  job.completedAt = Date.now();
}

function failJob(jobId, errorMessage) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'error';
  job.error = errorMessage;
  job.completedAt = Date.now();
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function getActiveJobs() {
  const active = [];
  for (const job of jobs.values()) {
    if (job.status === 'processing') {
      active.push({
        id: job.id,
        agentId: job.agentId,
        agentLabel: job.agentLabel,
        message: job.message,
        createdAt: job.createdAt,
      });
    }
  }
  return active;
}

// Nettoyage des jobs termines de plus d'1 heure
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.completedAt && now - job.completedAt > 3600000) {
      jobs.delete(id);
    }
  }
}, 300000);

module.exports = { createJob, completeJob, failJob, getJob, getActiveJobs };
