const fs = require('fs');
const path = require('path');

// --- READ FILE ---

const readDefinition = {
  name: 'read_file',
  description: 'Lit le contenu d\'un fichier. Retourne le texte avec numeros de ligne.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Chemin du fichier a lire (absolu ou relatif au workspace)',
      },
      offset: {
        type: 'number',
        description: 'Ligne de depart (1-indexed, optionnel)',
      },
      limit: {
        type: 'number',
        description: 'Nombre de lignes a lire (optionnel)',
      },
    },
    required: ['file_path'],
  },
};

function readFile(input, context = {}) {
  const filePath = resolvePath(input.file_path, context.workspace);

  if (!fs.existsSync(filePath)) {
    return `Erreur: fichier introuvable "${filePath}"`;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let start = 0;
    let end = lines.length;

    if (input.offset) {
      start = Math.max(0, input.offset - 1);
    }
    if (input.limit) {
      end = Math.min(lines.length, start + input.limit);
    }

    const numbered = lines
      .slice(start, end)
      .map((line, i) => `${String(start + i + 1).padStart(4)}| ${line}`)
      .join('\n');

    return numbered || '(fichier vide)';
  } catch (err) {
    return `Erreur lecture: ${err.message}`;
  }
}

// --- WRITE FILE ---

const writeDefinition = {
  name: 'write_file',
  description: 'Ecrit ou remplace le contenu d\'un fichier. Cree le fichier et les dossiers parents si necessaire.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Chemin du fichier a ecrire',
      },
      content: {
        type: 'string',
        description: 'Contenu a ecrire dans le fichier',
      },
    },
    required: ['file_path', 'content'],
  },
};

function writeFile(input, context = {}) {
  const filePath = resolvePath(input.file_path, context.workspace);

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, input.content, 'utf-8');
    return `Fichier ecrit: ${filePath} (${input.content.length} caracteres)`;
  } catch (err) {
    return `Erreur ecriture: ${err.message}`;
  }
}

// --- LIST FILES ---

const listDefinition = {
  name: 'list_files',
  description: 'Liste les fichiers et dossiers dans un repertoire.',
  input_schema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Chemin du repertoire (defaut: workspace)',
      },
      recursive: {
        type: 'boolean',
        description: 'Lister recursivement (defaut: false)',
      },
    },
    required: [],
  },
};

function listFiles(input, context = {}) {
  const dir = resolvePath(input.directory || '.', context.workspace);

  if (!fs.existsSync(dir)) {
    return `Erreur: repertoire introuvable "${dir}"`;
  }

  try {
    if (input.recursive) {
      const results = [];
      walkDir(dir, dir, results, 0, 3); // max 3 niveaux de profondeur
      return results.join('\n') || '(repertoire vide)';
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const lines = entries.map(e => {
      const prefix = e.isDirectory() ? '[DIR]  ' : '       ';
      return `${prefix}${e.name}`;
    });
    return lines.join('\n') || '(repertoire vide)';
  } catch (err) {
    return `Erreur: ${err.message}`;
  }
}

// --- SEARCH FILE (grep basique) ---

const searchDefinition = {
  name: 'search_files',
  description: 'Recherche un pattern (regex) dans les fichiers d\'un repertoire.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern de recherche (regex)',
      },
      directory: {
        type: 'string',
        description: 'Repertoire de recherche (defaut: workspace)',
      },
      file_glob: {
        type: 'string',
        description: 'Filtre de fichiers, ex: "*.js", "*.py" (defaut: tous)',
      },
    },
    required: ['pattern'],
  },
};

function searchFiles(input, context = {}) {
  const dir = resolvePath(input.directory || '.', context.workspace);
  const regex = new RegExp(input.pattern, 'gi');
  const glob = input.file_glob;
  const results = [];
  const maxResults = 50;

  function search(dirPath) {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      const fullPath = path.join(dirPath, entry.name);

      // Ignorer node_modules, .git, etc.
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) continue;
        search(fullPath);
      } else if (entry.isFile()) {
        if (glob && !matchGlob(entry.name, glob)) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const rel = path.relative(dir, fullPath);
              results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
              if (results.length >= maxResults) break;
            }
            regex.lastIndex = 0;
          }
        } catch {
          // Ignorer fichiers binaires
        }
      }
    }
  }

  search(dir);

  if (results.length === 0) {
    return `Aucun resultat pour "${input.pattern}"`;
  }
  return results.join('\n') + (results.length >= maxResults ? `\n... (limite de ${maxResults} resultats)` : '');
}

// --- Utilitaires ---

function resolvePath(filePath, workspace) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(workspace || process.cwd(), filePath);
}

function walkDir(baseDir, currentDir, results, depth, maxDepth) {
  if (depth > maxDepth) return;
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const rel = path.relative(baseDir, path.join(currentDir, entry.name));
    const indent = '  '.repeat(depth);
    if (entry.isDirectory()) {
      results.push(`${indent}[DIR] ${rel}/`);
      walkDir(baseDir, path.join(currentDir, entry.name), results, depth + 1, maxDepth);
    } else {
      results.push(`${indent}      ${rel}`);
    }
  }
}

function matchGlob(filename, glob) {
  const ext = glob.replace('*', '');
  return filename.endsWith(ext);
}

module.exports = {
  readFile: { definition: readDefinition, execute: readFile },
  writeFile: { definition: writeDefinition, execute: writeFile },
  listFiles: { definition: listDefinition, execute: listFiles },
  searchFiles: { definition: searchDefinition, execute: searchFiles },
};
