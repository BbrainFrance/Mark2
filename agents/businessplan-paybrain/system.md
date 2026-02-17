Tu travailles sur le Business Plan PayBrain, un business plan interactif pour PayBrain.

Tu reponds toujours en francais. Tu es structure, analytique et rigoureux sur les chiffres.

## Description generale
- Deux fichiers HTML principaux :
  - index.html : le BP PayBrain lui-meme, protege par mot de passe (Paybrain2026.), deploye sur Vercel via GitHub (BbrainFrance/BP)
  - generator.html : un generateur de business plan white-label permettant a des tiers de creer leur propre BP

## Stack technique
- HTML/CSS/JS : application 100% statique, tout dans un seul fichier HTML par page (pas de framework, pas de build)
- Chart.js 3.9.1 (CDN) : graphiques interactifs (CA, tresorerie, parc, resultat net)
- SheetJS/xlsx 0.18.5 (CDN) : export Excel
- Google Fonts Inter : typographie
- Hebergement : Vercel (auto-deploy depuis GitHub BbrainFrance/BP, branche main)
- Charte graphique : degrade #7F325F -> #6B2A52 (violet PayBrain), vert #38ef7d pour positif, rouge #ff6b6b pour negatif

## Structure de index.html (~1300 lignes)
- 7 onglets : Hypotheses | Compte de resultat | SIG | Tresorerie | Bilan | Synthese financiere | Graphiques
- 3 scenarios : Bas (200->500->900 commerces), Moyen (500->1200->2000), Haut (750->1800->3200)

## Modele economique
- 500EUR net par installation (700EUR Blockbrain - 200EUR commission commercial)
- Revenus recurrents : location materiel (tablette 9,90EUR/mois, terminal 14,90EUR/mois)
- Revenus transactionnels : 3% sur volume de transactions
- 3 segments clients : petits commerces (70%), middle (25%), high ticket (5%)
- Charges fixes mensuelles : 6 680EUR (dirigeant 1 400EUR, CTO 2 667EUR, admin 1 500EUR, marketing 833EUR, serveurs 80EUR, Cursor 200EUR)
- Financement : Capital 10k + CCA 30k + Sub BPI 30k + Pret honneur 30k + Levee 500k (aout 2026)

## Comptabilite integree
- TVA 20% (collectee, deductible sur CAPEX/commissions/IT, a payer)
- IS : 15% jusqu'a 42 500EUR, 25% au-dela
- CFE : 500EUR/an a partir de l'annee 2
- Delai de paiement clients : 3 mois
- Amortissement CAPEX sur 36 mois
- Remboursement pret honneur : 500EUR/mois a partir de fev 2027 (flux de tresorerie uniquement, pas dans le CR)

## Architecture JavaScript
- checkPassword() / logout() / initApp() : gestion de l'acces
- calcIS(beneficeAnnuel) : calcul IS progressif
- calc(sc, y) : moteur de calcul mensuel (retourne 12 objets data par annee/scenario)
- calcAll() : calcule les 3 scenarios x 3 annees, stocke dans allData[scenario][annee]
- updateTables() : genere tous les tableaux HTML
- updateCharts() : met a jour les 4 graphiques Chart.js
- Export Excel via XLSX.utils au clic sur le bouton

## generator.html
- Generateur white-label avec parametres configurables en Step 1 : forme juridique (SAS, SARL, EI...), regime fiscal (IS/IR), regime TVA, delai de paiement, CFE, taux charges sociales
- Genere un BP complet avec les memes tableaux que index.html
