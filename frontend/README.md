# Ecole SaaS - Application Electron

Client desktop de gestion scolaire multi-etablissement avec synchronisation offline.

## Stack technique

- **Framework**: Electron 28 + React 18 + TypeScript 5
- **Bundler**: electron-vite (Vite 5)
- **UI**: Shadcn/ui (Radix primitives + Tailwind CSS 3)
- **Formulaires**: React Hook Form + Zod
- **Requetes HTTP**: Axios + TanStack React Query
- **Etat local**: Zustand
- **Base locale**: better-sqlite3 (synchronisation offline)
- **Routing**: React Router DOM 7

## Pre-requis

- Node.js >= 20
- npm ou yarn
- Le serveur API doit etre lance (voir `server/README.md`)

## Installation

```bash
cd frontend
yarn install
```

## Configuration

Creer un fichier `.env` a la racine du frontend (ou configurer via les variables d'environnement) :

```
VITE_API_URL=http://localhost:3000/api/v1
```

Par defaut, l'application pointe sur `http://localhost:3000/api/v1`.

## Developpement

```bash
# Lancer en mode developpement avec rechargement a chaud
yarn dev

# Lancer sans rechargement automatique
yarn dev:nowatch
```

L'application Electron se lance automatiquement. Le rendu web est accessible sur `http://localhost:5173`.

## Scripts disponibles

- `yarn dev` - Developpement avec rechargement a chaud
- `yarn dev:nowatch` - Developpement sans watch
- `yarn build` - Compilation + typecheck
- `yarn start` - Preview de la build de production
- `yarn lint` - Verification ESLint
- `yarn format` - Formatage Prettier
- `yarn typecheck` - Verification TypeScript (node + web)
- `yarn build:win` - Build Windows
- `yarn build:mac` - Build macOS
- `yarn build:linux` - Build Linux

## Architecture

```
src/
├── api/
│   └── client.ts              # Client Axios avec intercepteurs JWT
├── assets/                    # Ressources statiques
├── components/                # Composants Shadcn/ui reutilisables
├── lib/                       # Utilitaires et helpers
├── main/                      # Processus principal Electron
│   └── index.ts
├── pages/                     # Pages de l'application
│   ├── administration/        # Gestion etablissement
│   ├── attendance/            # Presences
│   ├── auth/                  # Connexion, inscription, 2FA
│   ├── classes/               # Classes et matieres
│   ├── communications/        # Messagerie
│   ├── dashboard/             # Tableau de bord
│   ├── finances/              # Frais et paiements
│   ├── grades/                # Notes et bulletins
│   ├── students/              # Gestion des eleves
│   └── sync/                  # Statut synchronisation
├── preload/                   # Scripts de prechargement Electron
├── renderer/                  # Configuration du renderer
├── router/                    # Configuration React Router
├── stores/                    # Stores Zustand
│   ├── auth-store.ts          # Etat d'authentification
│   ├── sync-store.ts          # Etat de synchronisation
│   └── ui-store.ts            # Etat de l'interface
├── types/                     # Types TypeScript partages
├── App.tsx                    # Composant racine
├── global.css                 # Styles globaux Tailwind
└── main.tsx                   # Point d'entree renderer
```

## Fonctionnalites

- **Multi-tenant** - Connexion et gestion de plusieurs etablissements
- **Authentification** - Connexion JWT avec refresh tokens et 2FA TOTP
- **Gestion des eleves** - CRUD, filtres, recherche, photo
- **Notes et bulletins** - Saisie simple et groupee, moyennes, publication
- **Presences** - Appel groupe, statistiques
- **Messagerie interne** - Communication entre enseignants, administration et parents
- **Finances** - Frais scolaires, paiements, soldes
- **Synchronisation offline** - Fonctionnement hors-ligne avec reconciliation automatique (voir `server/SYNC_PROTOCOL.md`)
- **Tableau de bord** - Indicateurs et statistiques
- **Themes** - Support mode clair/sombre
- **Builds multiplateforme** - Windows, macOS, Linux

## Build de production

```bash
# Verification TypeScript
yarn typecheck

# Build
yarn build

# Empaquetage
yarn build:linux   # Linux (.AppImage, .deb)
yarn build:win     # Windows (.exe, .msi)
yarn build:mac     # macOS (.dmg)
```

Les binaires sont generes dans le dossier `dist/`.

## Synchronisation offline

L'application utilise une base SQLite locale (`better-sqlite3`) pour fonctionner hors-ligne. Les donnees sont synchronisees avec le serveur des que la connexion est retablie.

Voir `server/SYNC_PROTOCOL.md` pour les details du protocole de synchronisation.

## IDE recommande

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
