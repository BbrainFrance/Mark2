# Mark2 - Moteur d'Agents IA

Moteur d'agents IA custom de Bbrain France. Remplace OpenClaw avec un controle total.

## Architecture

```
Mark2/
├── server.js              # Serveur Express principal
├── lib/
│   ├── anthropic.js       # Client API Anthropic (boucle tool_use)
│   ├── agents.js          # Gestionnaire d'agents
│   ├── history.js         # Historique de conversations persistant
│   └── tools/             # Outils disponibles pour les agents
│       ├── index.js       # Registre central des outils
│       ├── shell.js       # execute_command
│       └── files.js       # read_file, write_file, list_files, search_files
├── agents/                # Configuration des agents
│   ├── jarvis/            # Agent principal
│   │   ├── config.json    # Configuration
│   │   └── system.md      # System prompt
│   ├── comptaapp/
│   ├── paybrain/
│   └── ...
└── data/
    └── history/           # Historiques JSON par agent
```

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Health check + modele actif |
| GET | `/agents` | Liste des agents |
| GET | `/agents/:id` | Detail d'un agent |
| POST | `/chat` | Chat avec un agent (avec tool_use) |
| POST | `/voice` | Mode vocal (reponse courte, sans outils) |
| GET | `/models` | Liste des modeles disponibles |
| POST | `/model` | Changer le modele actif |
| GET | `/history/:agentId` | Historique de conversation |
| DELETE | `/history/:agentId` | Effacer l'historique |
| POST | `/reload` | Recharger la config des agents |

## Commandes Slash

Depuis n'importe quel chat (web ou app) :

| Commande | Description |
|----------|-------------|
| `/modele` | Voir le modele actif et les modeles disponibles |
| `/modele opus` | Passer sur Claude Opus 4 |
| `/modele sonnet` | Passer sur Claude Sonnet 4.5 |
| `/modele haiku` | Passer sur Claude Haiku 3.5 |
| `/agents` | Lister les agents |
| `/clear` | Effacer l'historique de l'agent courant |
| `/help` | Aide |

## Installation

```bash
# Cloner
git clone https://github.com/BbrainFrance/Mark2.git
cd Mark2

# Installer
npm install

# Configurer
cp .env.example .env
nano .env  # Ajouter ANTHROPIC_API_KEY et MARK2_API_KEY

# Lancer
npm start
```

## Deploiement VPS (systemd)

```bash
# Creer le service
sudo nano /etc/systemd/system/mark2.service
```

```ini
[Unit]
Description=Mark2 AI Agent Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mark2
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mark2
sudo systemctl start mark2
```

## Licence

MIT - Bbrain France 2026
