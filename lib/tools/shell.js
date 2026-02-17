const { execSync } = require('child_process');

/**
 * Definition de l'outil execute_command pour l'API Anthropic
 */
const definition = {
  name: 'execute_command',
  description: 'Execute une commande shell sur le serveur. Utile pour git, npm, systeme, etc. ATTENTION: les commandes sont executees avec les permissions du serveur.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'La commande shell a executer',
      },
      working_directory: {
        type: 'string',
        description: 'Repertoire de travail (optionnel, defaut: workspace de l\'agent)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout en millisecondes (defaut: 30000)',
      },
    },
    required: ['command'],
  },
};

/**
 * Execute une commande shell
 * @param {Object} input - { command, working_directory, timeout }
 * @param {Object} context - { workspace }
 * @returns {string} Sortie de la commande
 */
function execute(input, context = {}) {
  const { command, working_directory, timeout = 30000 } = input;
  const cwd = working_directory || context.workspace || process.cwd();

  // Commandes dangereuses bloquees
  const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
  for (const b of blocked) {
    if (command.includes(b)) {
      return `BLOQUE: commande dangereuse detectee "${b}"`;
    }
  }

  try {
    const output = execSync(command, {
      cwd,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024, // 1MB
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const result = output.trim();
    return result || '(commande executee, pas de sortie)';
  } catch (err) {
    const stderr = err.stderr ? err.stderr.trim() : '';
    const stdout = err.stdout ? err.stdout.trim() : '';
    return `Erreur (code ${err.status || 'unknown'}):\n${stderr || stdout || err.message}`;
  }
}

module.exports = { definition, execute };
