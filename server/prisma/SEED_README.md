# Database Seed

Seed complet de la base de données avec plusieurs établissements scolaires et données réalistes.

## 🚀 Démarrage rapide

```bash
cd server
npm run prisma:seed
```

## 🔐 Identifiants par établissement

### Lycée Victor Hugo
- Admin : `admin@lycee-vhugo.fr` / `Admin123!`
- Super Admin : `superadmin@ecole-saas.com` / `Admin123!`
- Enseignant : `jean.dupont@lycee-vhugo.fr` / `Teacher123!`
- Secrétaire : `secretariat@lycee-vhugo.fr` / `Secretary123!`
- Parent : `parent1@example.com` / `Parent123!`

### Collège Jean Jaurès
- Admin : `admin@college-jaures.fr` / `Admin123!`
- Enseignant : `marie.curie@college-jaures.fr` / `Teacher123!`
- Secrétaire : `secretariat@college-jaures.fr` / `Secretary123!`
- Parent : `parent1@college-jaures.fr` / `Parent123!`

## 📊 Données créées

### Par établissement
- 8 utilisateurs (1 admin, 1 super admin, 3 enseignants, 1 secrétaire, 2 parents)
- 3 enseignants avec spécialités
- 10 matières
- 3 classes par niveau (2nde A, 2nde B, 1ère A)
- 12 élèves par établissement
- 48 notes par établissement
- 120 présences par établissement
- 12 paiements par établissement
- Emploi du temps complet
- Frais de scolarité
- Documents étudiants
- Journaux d'audit

## 🔄 Réinitialisation

```bash
npm run prisma:seed
```

Le script supprime toutes les données existantes avant de recréer le seed.

## ⚙️ Prérequis

- PostgreSQL en cours d'exécution
- Base de données `ecole_saas` créée
- Variables d'environnement dans `server/.env` :
  - `DATABASE_URL=postgresql://ecole_user:ecole_pass@localhost:5432/ecole_saas?schema=public`
