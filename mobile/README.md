# École Prof — application mobile des enseignants

Application Expo (React Native) reliée à l'API École SaaS. Les enseignants y font l'appel, saisissent les notes, consultent leur emploi du temps et leurs messages. Les saisies faites sans réseau sont mises en file et envoyées au retour de la connexion.

## Prérequis
- L'API NestJS doit être **joignable depuis le téléphone** : `localhost` ne fonctionne pas. Utilisez l'IP LAN du poste (`http://192.168.x.x:3000/api/v1`) ou un serveur public, et ajoutez cette origine à `CORS_ORIGIN` si besoin.
- Un compte **enseignant** (rôle TEACHER) avec un mot de passe défini en ligne, et une fiche enseignant affectée à ses classes.

## Lancer
```bash
npm install
npx expo start          # Expo Go / dev client
npx expo run:android    # build natif
```
L’adresse du serveur est fixée dans `app.json` → `extra.apiUrl` (non modifiable par l’utilisateur) ; changez-la puis reconstruisez l’app.
