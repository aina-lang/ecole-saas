# Publier une mise à jour de l'application desktop

L'application vérifie toute seule s'il existe une version plus récente
(30 s après le démarrage, puis toutes les 6 heures). Elle interroge pour cela
`http://51.178.50.63:3000/updates/latest.yml`. Publier une mise à jour revient
donc à déposer deux fichiers sur le serveur.

## 1. Incrémenter la version

Dans `frontend/package.json` :

```json
"version": "1.0.1"
```

C'est **la seule** source du numéro de version : elle nomme l'installateur,
remplit `latest.yml`, et s'affiche dans Paramètres › Général › Mises à jour.
Une version qui n'augmente pas ne sera jamais proposée aux postes.

## 2. Construire

```bash
cd frontend
npm run build:win
```

`frontend/dist/` contient alors :

| Fichier | Rôle |
|---|---|
| `Sekoliko-1.0.1-installateur.exe` | l'installateur téléchargé par les postes |
| `latest.yml` | manifeste lu par l'app (version, taille, empreinte sha512) |
| `Sekoliko-1.0.1-portable.exe` | version clé USB — **non concernée** par la mise à jour auto |

## 3. Déposer sur le serveur

Copier les **deux** fichiers dans le dossier `updates/` du serveur API
(`UPDATES_PATH`, par défaut `<dossier du serveur>/updates`) :

```bash
scp dist/Sekoliko-1.0.1-installateur.exe dist/latest.yml <user>@51.178.50.63:<chemin-serveur>/updates/
```

Ordre important : déposer l'`.exe` **avant** le `latest.yml`. Le manifeste est
ce qui déclenche le téléchargement ; s'il arrive en premier, les postes qui
vérifient dans la seconde qui suit tombent sur un `.exe` absent.

Ne pas supprimer les installateurs des versions précédentes : un poste qui
avait commencé un téléchargement doit pouvoir le reprendre.

## 4. Vérifier

```bash
curl -s http://51.178.50.63:3000/updates/latest.yml
```

La clé `version:` doit afficher le nouveau numéro. Côté poste, la bannière
« La version 1.0.1 de Sekoliko est disponible » apparaît en haut de l'écran
dans les 6 heures, ou immédiatement via Paramètres › Général › Mises à jour ›
« Vérifier maintenant ».

## Ce que voit l'utilisateur

1. Bannière d'annonce, avec **Télécharger** et **Plus tard**. Rien n'est
   téléchargé sans son accord — c'est délibéré, les connexions sur le terrain
   sont lentes et souvent facturées au volume.
2. Barre de progression pendant le téléchargement.
3. Bannière verte « prête à être installée », avec **Redémarrer maintenant**.
   S'il ne clique pas, l'installation se fait à la prochaine fermeture de
   l'application.

Une vérification qui échoue faute de réseau n'affiche rien : l'application est
conçue pour tourner hors ligne, une alerte à chaque tentative serait du bruit.
L'erreur n'est montrée que si l'utilisateur a lui-même cliqué « Vérifier
maintenant ».

## Limites connues

- **La version portable ne se met pas à jour** : c'est un exe autonome, il n'y
  a pas d'installation à remplacer. L'app l'indique dans les réglages.
- **Le flux est en HTTP, et les binaires ne sont pas signés.** Un réseau
  hostile peut donc servir un faux installateur. À corriger avant toute
  diffusion large : passer `/updates` en HTTPS (domaine + certificat) et
  signer l'exe — electron-updater vérifie alors que la mise à jour porte la
  même signature d'éditeur que l'application installée.
