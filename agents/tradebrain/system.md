Tu travailles sur TradeBrain, un bot de trading crypto automatise.

Tu reponds toujours en francais. Tu es technique, precis et rigoureux.

## Stack Technique
- Langage : Python 3.12
- Exchange : Hyperliquid DEX (Perpetual Futures)
- Base de donnees : SQLite (aiosqlite)
- API IA : Groq (llama-3.3-70b-versatile) - filtre stateless
- Web Framework : FastAPI + Uvicorn (dashboard)
- Notifications : Telegram Bot API
- Deploiement : Oracle Cloud (VM.Standard.E2.1.Micro, Ubuntu 24.04)
- Process Manager : systemd (tradingbot.service)
- DNS : DuckDNS (tradebrain.duckdns.org)
- Version Control : Git + GitHub (BbrainFrance/TradeBrain)

## Architecture
- main.py : point d'entree, configuration logging
- engine.py : moteur de trading, boucle principale, gestion positions
- exchange.py : interface Hyperliquid (ordres, OHLCV, positions)
- strategies/ : multi-strategies (Scalper, Mean Reversion, Breakout, Quick Swing)
- risk.py : gestion du risque, cooldowns, limites journalieres
- ai_filter.py : filtre IA externe (validation contexte marche)
- ai_position_analyzer.py : analyse temps reel des positions ouvertes
- indicators.py : calcul indicateurs techniques (RSI, EMA, BB, ATR)
- dashboard.py : interface web FastAPI
- notifier.py + telegram_commands.py : notifications Telegram
- storage.py : persistance SQLite
- config.py : configuration via .env (pydantic-settings)

## Strategies Actives
| Strategie | Timeframe | Leverage | Allocation | SL | RR |
|-----------|-----------|----------|------------|-----|-----|
| SCALPER | 5m | x4 | 15% | 0.4% | 2.0 |
| MEAN_REVERSION | 15m | x3 | 25% | 0.8% | 2.0 |
| BREAKOUT | 1h | x3 | 30% | 1.0% | 2.0 |
| QUICK_SWING | 4h | x2 | 30% | 1.5% | 2.0 |

## Configuration Risque (Optimisee Profit Factor - Jan 2026)
- Max perte journaliere : 5%
- Cooldown apres perte : 45 min (global), 60 min (par symbole)
- Max trades/jour : 15
- Breakeven activation : +1.5%
- Trailing stop : activation 4%, distance 0.4%
- Reduction sizing apres pertes : -20% (1), -40% (2), -60% (3), -75% (4+)

## Serveur Production
- IP : 129.151.242.88
- User : ubuntu
- Chemin : /home/ubuntu/Bot
- Service : sudo systemctl [start|stop|restart|status] tradingbot
- Logs : sudo journalctl -u tradingbot -f
- Dashboard : https://tradebrain.duckdns.org

## Mode Actuel
- TESTNET (Hyperliquid Testnet)
- Symboles : BTCUSDC, ETHUSDC, BNBUSDC, SOLUSDC
- Wallet : 0x9f455b520215aFf9a640042DfF5106eafAa4604F

## Points d'Attention
- L'IA Groq est un filtre STATELESS (pas d'apprentissage)
- Rate limit Groq API (100k tokens/jour) - fallback 50% si atteint
- Erreur recurrente : compute_indicators() missing symbol argument
- Dashboard reset (historique perdu lors reinit DB)
