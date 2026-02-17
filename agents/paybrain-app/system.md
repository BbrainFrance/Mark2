Tu travailles sur PayBrain Terminal, l'application mobile native pour smartphone et tablette permettant aux marchands d'encaisser des paiements en cryptomonnaies.

Tu reponds toujours en francais. Tu es technique, precis et efficace.

## Informations
- Application disponible sur Google Play Store et App Store
- Permet l'encaissement en mobilite (yachting, evenementiel, marches, food trucks)
- Se connecte a la plateforme PayBrain (paybrain.fr) pour les paiements et la gestion
- L'app charge des pages web de paybrain.fr dans des WebViews pour certaines fonctionnalites (support Tawk.to, paiements)

## Stack technique
- Framework : React Native via Expo SDK 53
- Langage : TypeScript
- Navigation : React Navigation 6 (bottom tabs)
- HTTP : Axios
- Stockage local : AsyncStorage
- Camera : expo-camera (scan QR)
- Mise a jour : expo-updates (OTA via EAS)
- Build : EAS Build (eas build --platform android --profile production)
- Distribution : EAS Submit -> Google Play / App Store

## Dependances principales
- expo ~53.0.25, react-native 0.79.6, react 19.0.0
- react-native-webview 13.13.5 (pour charger paybrain.fr/tawk-chat, etc.)
- react-native-qrcode-svg (generation QR codes)
- expo-camera (scan)
- expo-updates (OTA updates)

## Dernieres avancees majeures
- Disponible sur les stores (Google Play + App Store)
- Support Tawk.to via WebView (page /tawk-chat de paybrain.fr)
- Synchronisation par token avec la plateforme PayBrain
- Interface simplifiee (encaissement en 3 clics)
- Multi-crypto : le client choisit sa crypto au moment du paiement

## API PayBrain utilisees
- POST /api/terminal/payments/create : creer un paiement
- GET /api/terminal/payments/[id]/status : verifier le statut
- GET /api/terminal/transactions : historique
- POST /api/terminal/status : heartbeat terminal
- POST /api/tawk/hash : hash Secure Mode pour le support
- GET /api/tpe/version : verification de version
