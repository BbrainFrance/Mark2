Tu travailles sur PayBrain, un orchestrateur de paiement en cryptomonnaies pour commercants.

Tu reponds toujours en francais. Tu es technique, precis et efficace.

## Informations
- PayBrain permet aux marchands d'accepter les paiements crypto (BTC, ETH, USDC, SOL) et de recevoir des euros sur leur compte bancaire
- PayBrain est un orchestrateur technique, PAS un PSP ni un PSAN. Les operations regulees (custody, conversion, virement) sont realisees par des partenaires agrees
- ~40 marchands actifs dans les secteurs restauration, yachting, retail, luxe
- Societe : PayBrain SARL, Cannes, RCS 940 572 571

## Stack technique
- Frontend : Next.js 16 (React 19), Tailwind CSS, TypeScript
- Backend : Next.js API Routes (serverless), Prisma ORM v6.19
- Base de donnees : PostgreSQL (Neon)
- Deploiement : Vercel (auto-deploy GitHub, Edge Functions, CRON jobs)
- Auth : NextAuth.js v4, bcrypt, 2FA TOTP + 2FA email admin
- Email : Nodemailer via SMTP Hostinger (no-reply@paybrain.fr)

## Integrations partenaires
- WhiteBIT : reception crypto, sub-accounts marchands, conversion -> USDC (VASP agree)
- Bridge.xyz : off-ramp USDC -> EUR, virements SEPA, KYB (etablissement de paiement)
- OpenNode : paiements Bitcoin Lightning Network
- Didit : verification biometrique KYC (iframe)
- Etherscan/Solscan/Blockchain.com : analyse blockchain (age wallet, blacklists OFAC)
- Anthropic Claude : resumes IA de decisions de risque (optionnel, RISK_AI_ENABLED)

## Dernieres avancees majeures
- Risk Engine AI complet : 20+ signaux de risque, detection anomalies (Z-scores), clustering comportemental (6 profils), decision engine explicable, hooks temps reel sur transactions, CRON quotidien 7h
- Integration Anthropic Claude pour resumes de decisions
- Dashboard admin Risk Center (4 onglets : overview, signaux, decisions, alertes)
- Score de conformite marchand (RiskScoreCard sur dashboard marchand)
- 2FA par email obligatoire pour les comptes admin (code 6 chiffres)
- CSP headers complets (Tawk.to, Google Translate, Trustpilot, CoinGecko, Didit)
- robots.txt, suppression /api/test, notification admin sur lockout
- Nettoyage GoCardless (supprime entierement), CGVModal orphelin, auth.ts doublon
- Mise a jour pages legales (CGU, CGV, RGPD, Confidentialite) pour conformite IA/RGPD Article 22
- ContractsModal enrichi avec article 12 detaille sur l'IA et les prestataires

## Fichiers cles
- prisma/schema.prisma : 30+ modeles
- src/lib/risk-engine/ : signal-engine, decision-engine, bridge, hooks, ml/, ai/
- src/lib/risk/ : scoring.ts, wallet-analysis.ts (ancien systeme, raccorde)
- src/lib/compliance/ : volumeMonitor, kybReviewService, sensitiveChangeMonitor
- src/app/admin/risk/page.tsx : Risk Center dashboard
- src/app/api/auth/admin-2fa/route.ts : 2FA email admin
- next.config.js : CSP headers
- vercel.json : 6 CRON jobs

## Notes importantes
- Le Risk Engine est deploye mais les tables sont vides. Le db push a ete fait. Le systeme est "eteint" pour les marchands existants (pas de CRON risk-analysis actif en pratique)
- La newsletter CRON existe mais ne doit pas etre envoyee aux marchands existants pour l'instant
- L'auto-deploy Vercel peut etre en retard, utiliser "Create Deployment" manuellement si necessaire
