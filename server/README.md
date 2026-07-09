# Ecole SaaS - Serveur API

Système de gestion scolaire multi-établissement avec API REST.

## Stack technique

- **Framework**: NestJS 11
- **Base de donnees**: PostgreSQL avec Prisma ORM 7
- **Authentification**: JWT (access + refresh tokens), 2FA TOTP
- **Securite**: Rate limiting, validations, audit trail
- **Files d'attente**: Bull (Redis)
- **Tests**: Jest

## Pre-requis

- Node.js >= 20
- PostgreSQL >= 14 installe et lance nativement (pas de conteneur)
- Redis (optionnel, requis pour les files Bull)
- npm

## Installation

1. Cloner le depot

2. Installer les dependances :

   ```bash
   cd server
   npm install
   ```

3. Creer la base de donnees PostgreSQL :

   ```bash
   psql -U postgres
   CREATE DATABASE ecole_saas;
   CREATE USER ecole_user WITH PASSWORD 'ecole_pass';
   GRANT ALL PRIVILEGES ON DATABASE ecole_saas TO ecole_user;
   \q
   ```

4. Configurer les variables d'environnement dans `.env` :

   ```
   DATABASE_URL="postgresql://ecole_user:ecole_pass@localhost:5432/ecole_saas?schema=public"
   JWT_SECRET="votre-secret-jwt-32-caracteres-minimum"
   JWT_REFRESH_SECRET="votre-secret-refresh-32-caracteres"
   JWT_EXPIRES_IN="15m"
   JWT_REFRESH_EXPIRES_IN="7d"
   STORAGE_PATH="./storage"
   PORT=3000
   CORS_ORIGIN="http://localhost:5173"
   REDIS_URL="redis://localhost:6379"
   ```

   Un fichier `.env.example` est fourni avec les valeurs par defaut.

5. Synchroniser le schema Prisma avec la base de donnees :

   ```bash
   npx prisma db push --url="$DATABASE_URL"
   ```

6. Generer le client Prisma :

   ```bash
   npx prisma generate
   ```

7. Lancer le serveur de developpement :

   ```bash
   npm run start:dev
   ```

## Scripts disponibles

- `npm run start:dev` - Lancement en developpement avec rechargement a chaud
- `npm run build` - Compilation TypeScript
- `npm run start:prod` - Lancement en production
- `npm run start:debug` - Lancement avec debug
- `npm run test` - Tests unitaires
- `npm run test:watch` - Tests en mode watch
- `npm run test:cov` - Tests avec couverture
- `npm run test:e2e` - Tests d'integration
- `npm run lint` - Verification ESLint
- `npm run format` - Formatage Prettier

## Architecture

```
src/
├── common/
│   ├── prisma/               # Service Prisma (singleton)
│   ├── decorators/           # Decorateurs (CurrentUser, Roles, Public)
│   ├── guards/               # Guards (JwtAuthGuard, RolesGuard, TenantGuard)
│   └── filters/              # Filtres d'exception
├── config/                   # Configuration centralisee
├── modules/
│   ├── auth/                 # Authentification, inscription, 2FA
│   ├── tenants/              # Gestion multi-etablissement
│   ├── users/                # Gestion utilisateurs
│   ├── students/             # Eleves
│   ├── classes/              # Classes, matieres, professeurs
│   ├── grades/               # Notes, moyennes, bulletins
│   ├── attendance/           # Presences
│   ├── communications/       # Messagerie interne
│   ├── finances/             # Frais scolaires, paiements
│   ├── documents/            # Gestion documentaire
│   ├── upload/               # Gestion de fichiers
│   ├── statistics/           # Statistiques et rapports
│   ├── sync/                 # Moteur de synchronisation offline
│   ├── audit/                # Journal d'audit
│   └── administration/       # Administration systeme
└── main.ts                   # Point d'entree
```

## Modeles de donnees

Le schema Prisma definit les modeles suivants :

- **Tenant** - Etablissement scolaire (multi-tenant)
- **User** - Utilisateurs avec roles (SUPER_ADMIN, ADMIN, TEACHER, SECRETARY, PARENT)
- **Student** - Eleves avec soft delete et versioning
- **StudentParent** - Lien parent-enfant
- **Class** - Classes et niveaux
- **Subject** - Matieres avec coefficient
- **Teacher** - Professeurs lies aux utilisateurs
- **Grade** - Notes avec versioning offline
- **Attendance** - Presences avec statuts (PRESENT, ABSENT, LATE, EXCUSED, HOLIDAY)
- **FeeStructure** - Structures de frais
- **Payment** - Paiements avec suivi
- **Message** / **MessageRecipient** - Messagerie interne
- **Document** - Fichiers avec categories
- **AuditLog** - Journal d'audit
- **SyncDevice** / **SyncLog** / **SyncJob** - Synchronisation offline

## API Endpoints

Tous les endpoints sont prefixes par `/api/v1`.

### Authentification
- `POST /auth/register` - Inscription d'un etablissement
- `POST /auth/login` - Connexion
- `POST /auth/refresh` - Rafraichissement du token
- `POST /auth/logout` - Deconnexion
- `POST /auth/2fa/setup` - Configuration 2FA
- `POST /auth/2fa/verify` - Verification 2FA
- `GET /auth/me` - Profil utilisateur courant

### Multi-tenant
- `GET /tenants` - Liste des etablissements (Super Admin)
- `GET /tenants/:id` - Detail d'un etablissement
- `PATCH /tenants/:id` - Mise a jour
- `POST /tenants/:id/suspend` - Suspension
- `POST /tenants/:id/activate` - Activation

### Utilisateurs
- `GET /users` - Liste avec filtres
- `GET /users/:id` - Detail
- `POST /users` - Creation
- `PATCH /users/:id` - Modification
- `DELETE /users/:id` - Suppression
- `GET /users/teachers` - Liste des enseignants

### Eleves
- `GET /students` - Liste avec filtres (classe, statut, recherche)
- `GET /students/:id` - Detail
- `POST /students` - Creation
- `PATCH /students/:id` - Modification
- `DELETE /students/:id` - Suppression (soft delete)
- `POST /students/:id/restore` - Restauration

### Classes
- `GET /classes` - Liste
- `GET /classes/:id` - Detail avec effectifs
- `POST /classes` - Creation
- `PATCH /classes/:id` - Modification
- `DELETE /classes/:id` - Suppression

### Matieres
- `GET /subjects` - Liste
- `POST /subjects` - Creation
- `PATCH /subjects/:id` - Modification

### Notes
- `GET /grades` - Liste avec filtres (classe, matiere, periode)
- `POST /grades` - Creation
- `POST /grades/class/:classId/bulk` - Saisie groupee
- `GET /grades/student/:studentId/report` - Bulletin
- `GET /grades/student/:studentId/averages` - Moyennes
- `POST /grades/:id/publish` - Publication

### Presences
- `GET /attendance` - Liste avec filtres
- `POST /attendance` - Creation
- `POST /attendance/bulk` - Appel groupe
- `GET /attendance/stats` - Statistiques

### Communications
- `GET /messages` - Messages recus/envoyes
- `POST /messages` - Envoi
- `GET /messages/:id` - Detail
- `PATCH /messages/:id/read` - Marquer comme lu

### Finances
- `GET /finances/fees` - Structure des frais
- `POST /finances/fees` - Creation
- `GET /finances/payments` - Liste des paiements
- `POST /finances/payments` - Enregistrement
- `GET /finances/student/:id/balance` - Solde d'un eleve
- `GET /finances/dashboard` - Tableau de bord financier

### Documents
- `POST /upload` - Upload de fichier
- `GET /documents` - Liste
- `GET /documents/:id` - Telechargement
- `DELETE /documents/:id` - Suppression

### Synchronisation
- `POST /sync/batch` - Envoi d'un lot de modifications
- `POST /sync/device` - Enregistrement d'un appareil
- `GET /sync/conflicts` - Liste des conflits
- `POST /sync/conflicts/:id/resolve` - Resolution d'un conflit
- `GET /sync/status` - Statut de la synchronisation

### Statistiques
- `GET /statistics/dashboard` - Indicateurs generaux
- `GET /statistics/attendance` - Statistiques de presence
- `GET /statistics/grades` - Statistiques de notes
- `GET /statistics/financial` - Statistiques financieres

### Audit
- `GET /audit/logs` - Journal d'audit (filtrable)
- `GET /audit/export` - Export CSV/JSON

## Securite

- JWT avec tokens d'acces (15 min) et refresh (7 jours)
- 2FA TOTP pour les comptes administrateurs
- Rate limiting (100 requetes/minute par IP)
- Validation stricte des entrees (`class-validator`)
- Journal d'audit pour toutes les actions sensibles
- Soft delete systematique
- Isolation multi-tenant par `tenant_id`
- Hachage des mots de passe avec `bcrypt`
- Protection CSRF via CORS origin

## Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests d'integration (serveur requis)
npm run test:e2e
```

## Variables d'environnement

| Variable | Description | Valeur par defaut |
|---|---|---|
| `DATABASE_URL` | URL de connexion PostgreSQL | requise |
| `JWT_SECRET` | Cle de signature access token | requise |
| `JWT_REFRESH_SECRET` | Cle de signature refresh token | requise |
| `JWT_EXPIRES_IN` | Duree de validite access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duree de validite refresh token | `7d` |
| `PORT` | Port du serveur | `3000` |
| `CORS_ORIGIN` | Origine autorisee CORS | `http://localhost:5173` |
| `STORAGE_PATH` | Chemin de stockage fichiers | `./storage` |
| `REDIS_URL` | URL Redis pour Bull | `redis://localhost:6379` |
