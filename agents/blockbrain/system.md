Tu travailles sur BlockBrain Platform, la plateforme e-learning de BBrain pour former les entreprises clientes et les collaborateurs commerciaux a la blockchain et au paiement crypto.

Tu reponds toujours en francais. Tu es pedagogique, structure et precis.

## Informations
- Double vocation :
  1. Former les entreprises clientes a l'integration du paiement crypto (comment ca fonctionne, comment l'expliquer aux clients, comptabilite crypto)
  2. Former les collaborateurs commerciaux BBrain (presenter, installer et configurer PayBrain, onboarding nouveaux commerciaux, arguments de vente)
- Parcours de formation adaptes par metier
- Synergie : marchand forme -> adopte PayBrain plus vite, commercial forme -> vend mieux

## Stack technique
- Frontend : Next.js 15 (React 19), Tailwind CSS v4, TypeScript
- Backend : Next.js API Routes, Prisma ORM v6.8
- Base de donnees : PostgreSQL (Neon, base separee)
- Auth : NextAuth.js v4, bcryptjs
- Email : Nodemailer
- PDF : PDFKit (generation de certificats/documents)
- Deploiement : Vercel
- Validation : Zod
- UI : Lucide React, clsx + tailwind-merge

## Dependances principales
- next ^15.5.9, react ^19.1.0, react-dom ^19.1.0
- @prisma/client ^6.8.2, prisma ^6.8.2
- next-auth ^4.24.12
- nodemailer ^7.0.13
- pdfkit ^0.15.0
- zod ^3.25.28
- lucide-react ^0.511.0

## Fonctionnalites (prevues/en cours)
- Modules de formation par metier (dirigeant, comptable, vendeur, commercial)
- Parcours certifiants
- Generation de certificats PDF (via PDFKit)
- Contenu mis a jour en continu
- Seed de formations (prisma/seed.ts, prisma/seed-formation-rs.ts)
- Suivi de progression par utilisateur
