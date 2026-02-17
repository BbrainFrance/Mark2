Tu travailles sur ComptaApp, une application web de comptabilite pour gerer deux entites juridiques francaises (Blockbrain SASU et Paybrain EURL). Usage interne non commercialise, visant a remplacer des solutions type Indy.

Tu reponds toujours en francais. Tu es rigoureux, precis et tu connais les normes comptables francaises.

## Deploiement
- URL : https://compta-tau.vercel.app
- Repo GitHub : https://github.com/BbrainFrance/Compta.git

## Stack technique
- Framework : Next.js 14.2.35 (App Router), TypeScript 5 (mode strict)
- UI : Tailwind CSS 3.4.1 + shadcn/ui (Radix UI)
- Charts : Recharts 3.6.0
- Auth : NextAuth 4.24.13 (Credentials en prod, Google OAuth configurable)
- ORM : Prisma 5.22.0
- Database : Neon PostgreSQL (production)
- Migrations : prisma db push (schema-first)
- Banque : API Qonto (synchronisation transactions)
- Fichiers : import CSV (PapaParse 5.5.3)
- Exports : CSV + PDF (jsPDF 4.0.0, jspdf-autotable 5.0.7)
- Validation : Zod 3.23.8
- Tests : Vitest 4.0.17
- Crypto : crypto-js 4.2.0 (chiffrement API keys)
- Dates : date-fns 4.1.0

## Architecture de donnees (Prisma Schema)
### Modeles principaux
- User, Account, Session, VerificationToken : auth NextAuth
- Company : entites juridiques (SASU/EURL, SIREN, regime TVA, exercice fiscal)
- CompanyUser : relation users <-> companies (RBAC: OWNER/ADMIN/VIEWER)
- BankAccount : comptes bancaires par entite
- Transaction : transactions enrichies (date, montant, categorie, TVA, hash pour deduplication)
- TransactionRaw : donnees brutes d'import
- SourceFile : fichiers CSV importes
- Category : 80 categories Indy (revenus, charges, taxes) avec groupes et codes comptables
- Rule : regles automatiques (pattern matching sur description)
- Invoice, InvoiceLine : factures clients
- Client : tiers (clients/fournisseurs)
- TaxDeclaration : echeances fiscales (TVA, IS, CFE, DSN, Liasse)
- FiscalSettings : parametres fiscaux par entreprise
- VatPeriod : suivi TVA par periode avec report automatique du credit
- AnnualMileage : frais kilometriques (bareme fiscal 2024/2025)
- PeriodClose : cloture mensuelle
- BankConnection : connexions bancaires (Qonto chiffre)
- AuditLog : journal d'audit
- Attachment : pieces jointes

## Routes principales
### Pages UI (/app/[companyId]/...)
- / : Dashboard (KPIs, graphiques, alertes)
- /transactions : liste, filtres, edition bulk, auto-classification IA
- /import : wizard import CSV
- /vat : declaration TVA par periode
- /invoices : gestion factures
- /bilan : bilan comptable + frais kilometriques
- /fiscal : calendrier fiscal avec notifications urgentes
- /close : cloture mensuelle
- /settings : parametres entite, categories, regles, sync bancaire

### API Routes (/api/...)
- /transactions : CRUD, filtres, pagination
- /transactions/bulk : edition en masse
- /transactions/auto-classify : auto-classification intelligente
- /import/csv : upload & mapping CSV
- /vat/period et /vat/periods : calcul TVA par periode avec report credit
- /invoices : CRUD factures
- /bilan : calcul bilan (actif/passif/resultat)
- /taxes : calcul IS, CFE, echeances fiscales
- /mileage : frais kilometriques
- /sync/qonto : synchronisation bancaire
- /close : cloture/deverrouillage
- /exports/ : exports CSV
- /rules/apply : appliquer regles automatiques

## Fonctionnalites cles implementees
- Auth multi-entites + switch Blockbrain/Paybrain
- Import CSV wizard avec mapping colonnes, detection doublons (hash)
- 80 categories Indy + regles automatiques + auto-classification IA (similarite Jaccard)
- TVA (0/5.5/10/20%), direction collectee/deductible, report credit automatique
- Dashboard resultat YTD, graphs Recharts, alertes
- Factures CRUD avec lignes, TVA, statuts
- Bilan comptable actif/passif/compte de resultat
- Frais kilometriques (bareme fiscal 2024/2025)
- Calendrier fiscal avec generation echeances et notifications urgentes
- Calcul IS (bareme 15% <=42.5kEUR + 25% au-dela) et CFE
- Sync bancaire Qonto API
- Exports CSV transactions & TVA

## Points d'attention
- Prisma 5.22.0 (ne PAS migrer vers Prisma 7)
- Commande : node node_modules\prisma\build\index.js pour eviter version globale
- API keys Qonto chiffrees (AES-256-CBC)
- Index sur companyId, date, categoryId
- Pagination 50 items/page, debounce recherche 300ms
