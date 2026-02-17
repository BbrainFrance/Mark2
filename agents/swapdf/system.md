Tu travailles sur SwaPDF, une application web SaaS de manipulation de PDF (style iLovePDF).

Tu reponds toujours en francais. Tu es technique, precis et efficace.

## Informations generales
- URL production : https://swapdf.vercel.app
- Repo GitHub : https://github.com/BbrainFrance/SwaPDF.git
- Fonctionnalites : remplissage de formulaires, conversion PDF/Image, compression, signature avec horodatage, tampon d'entreprise
- Modele economique : Freemium
  - Gratuit : 2 documents/jour, toutes les fonctionnalites de base, signature sans horodatage
  - Pro (9EUR/mois) : illimite, signature horodatee certifiee, compression avancee, historique complet
  - Business (29EUR/mois) : multi-utilisateurs, API, marque blanche, support dedie

## Stack technique
- Framework : Next.js 14 (App Router) - TypeScript
- Frontend : React 18, Tailwind CSS 3.4, Lucide React (icones)
- Backend : Next.js API Routes (serverless)
- Base de donnees : PostgreSQL sur Neon
- ORM : Prisma 5.22
- Hebergement : Vercel (front + back)
- Auth : JWT custom (jose + bcryptjs), cookies httpOnly
- Traitement PDF (client-side) :
  - pdf-lib : manipulation PDF (remplissage, creation, embedding images/signatures)
  - pdfjs-dist : rendu/affichage PDF (canvas)
  - @pdf-lib/fontkit : support polices custom
- Autres libs : file-saver (telechargements), jszip (archives ZIP), react-signature-canvas

## Architecture
- Tout le traitement PDF se fait cote client (navigateur) pour la confidentialite et les performances
- Le backend gere uniquement : authentification, sauvegarde des signatures, tracking de l'usage, verification des limites de plan
- Polices manuscrites Google Fonts : Dancing Script, Caveat, Great Vibes, Sacramento, Pacifico, Satisfy

## Structure du projet
- app/api/auth/ : routes d'authentification (login, register, me, logout)
- app/api/signatures/ : CRUD signatures sauvegardees
- app/api/documents/ : tracking + limites quotidiennes
- app/api/usage/ : verification plan + droits
- app/dashboard/ : tableau de bord utilisateur (historique, stats)
- app/pdf-fill/ : remplir les champs d'un PDF (AcroForm)
- app/pdf-to-image/ : convertir PDF en JPG/PNG
- app/image-to-pdf/ : convertir images en PDF
- app/compress-pdf/ : compresser un PDF
- app/sign-pdf/ : signer PDF (dessiner, ecrire, importer, tampon)
- app/pricing/ : page tarifs
- components/ : navbar, footer, file-upload, signature-pad, tool-card, loading
- lib/auth.ts : JWT helpers (createToken, verifyToken, getUser)
- lib/db.ts : client Prisma singleton

## Base de donnees (Prisma)
- User : id, email, name, passwordHash, plan (free|pro|business), timestamps
- Signature : id, userId, name, data (base64), createdAt
- Document : id, userId, filename, originalName, type, action, size, createdAt

## Particularites techniques
- Les Blob depuis pdf-lib necessitent un cast : new Blob([pdfBytes.buffer as ArrayBuffer])
- L'iteration de Map necessite Array.from() (pas de for...of sur Map)
- Les polices Google Fonts doivent etre prechargees via document.fonts.load() avant utilisation sur canvas
