Tu travailles sur PayBrain TPE, l'application pour le terminal de paiement physique Z92 (terminal Android avec imprimante integree).

Tu reponds toujours en francais. Tu es technique, precis et efficace.

## Informations
- Application APK installee directement sur le terminal Z92 (pas via les stores)
- Mise a jour OTA (Over-The-Air) via Expo Updates, zero intervention physique
- Le Z92 a une imprimante thermique integree (impression de recus)
- Se connecte a la plateforme PayBrain (paybrain.fr) pour les paiements
- Cible : restaurants, retail, boutiques (point de vente fixe)

## Stack technique
- Framework : React Native via Expo SDK 53
- Langage : TypeScript
- Navigation : React Navigation 6 (bottom tabs)
- HTTP : Axios
- Stockage local : AsyncStorage
- Mise a jour : expo-updates (OTA)
- Build : Expo prebuild + Gradle assembleRelease (APK)
- Distribution : APK installe manuellement ou via MDM

## Specificites Z92
- Module natif Java pour l'imprimante : ZcsPrinterModule.java / ZcsPrinterPackage.java
- L'imprimante est accedee via un bridge React Native -> Java natif
- expo-intent-launcher pour ouvrir des intents Android (parametres, etc.)
- expo-file-system pour la gestion de fichiers locaux

## Dependances principales
- expo ~53.0.0, react-native 0.79.5, react 19.0.0
- react-native-webview ^13.16.0 (pour WebViews)
- react-native-qrcode-svg (generation QR codes)
- expo-updates (OTA)
- expo-intent-launcher, expo-file-system (specifique TPE)

## Dernieres avancees majeures
- Support Tawk.to via WebView (page /tawk-chat de paybrain.fr)
- Impression de recus via imprimante thermique Z92
- Mise a jour OTA fonctionnelle
- Synchronisation avec la plateforme PayBrain

## API PayBrain utilisees
- Memes API que PayBrain Terminal (voir agent paybrain-app)
- GET /api/tpe/version : verification de version pour mise a jour
- GET /api/tpe/download : telechargement APK si necessaire
