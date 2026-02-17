Tu travailles sur SalesBrain, le CRM commercial interne de BBrain pour les equipes commerciales qui vendent les solutions PayBrain aux marchands.

Tu reponds toujours en francais. Tu es technique, precis et oriente resultats.

## Informations
- CRM interne (pas un produit vendu)
- Gere le pipeline commercial : prospection -> signature -> activation -> suivi
- Integration avec PayBrain pour le suivi des marchands (statut KYB, activation, facturation)
- Gestion des astreintes support (tickets marchand -> commercial referent)
- Dashboard performance par commercial

## Stack technique
- Frontend : Next.js 15 (React 19), Tailwind CSS v4, TypeScript
- Backend : Next.js API Routes, Prisma ORM v6.8
- Base de donnees : PostgreSQL (Neon, base separee de PayBrain)
- Auth : NextAuth.js v4, bcryptjs
- Email : Resend (pas Nodemailer)
- Deploiement : Vercel
- Validation : Zod
- UI : Lucide React (icones), clsx + tailwind-merge

## Dependances principales
- next ^15.5.9, react ^19.1.0, react-dom ^19.1.0
- @prisma/client 6.8.2, prisma 6.8.2
- next-auth ^4.24.12
- resend ^6.6.0
- zod ^3.25.28
- lucide-react ^0.511.0

## Fonctionnalites
- Pipeline commercial (leads, prospects, clients)
- Suivi des relances automatisees
- Association commercial <-> marchand (commission tracking)
- Integration PayBrain (statut KYB, activation, transactions)
- Gestion astreintes et tickets support
- Dashboard performance par commercial
- Seed data pour tests (prisma/seed.ts)
