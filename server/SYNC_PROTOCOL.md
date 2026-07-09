# Protocole de Synchronisation Offline

## Principe

Le systeme utilise un **Outbox Pattern** pour garantir l'integrite des donnees en mode deconnecte :

1. Toute ecriture passe d'abord dans SQLite local
2. Une entree est creee dans la table `sync_outbox`
3. La synchronisation avec le serveur se fait de maniere asynchrone

Le client (application Electron) peut fonctionner entierement hors-ligne et synchroniser ses donnees des que la connexion est retablie.

## Architecture

```
Client (Electron + SQLite)          Serveur (NestJS + PostgreSQL)
         |                                      |
         |-- POST /sync/device ---------------->|
         |   { deviceId, deviceName }            |
         |                                      |-- Enregistrement appareil
         |<---- { deviceId } -------------------|
         |                                      |
         |-- POST /sync/batch ----------------->|
         |   { deviceId, entries[],             |
         |     lastSyncTimestamp }               |
         |                                      |-- Traitement des entrees
         |                                      |-- Detection de conflits
         |                                      |-- Resolution auto/manuel
         |<---- SyncResult ---------------------|
         |   { results[], changes[],            |
         |     serverTimestamp }                 |
         |                                      |
         |-- Mise a jour SQLite local           |
         |-- Application des changements        |
```

## Detection de connexion

- `navigator.onLine` + ping HTTP toutes les 30s vers `/api/v1/sync/health`
- Cycle de sync declenche automatiquement a la reconnexion
- File d'attente locale si hors-ligne

## Format des lots (Batch)

### Envoi client -> serveur

```json
{
  "deviceId": "uuid-du-poste",
  "deviceName": "Poste Salle 103",
  "lastSyncTimestamp": "2024-01-15T10:30:00Z",
  "entries": [
    {
      "localId": "uuid-local",
      "entityType": "Student",
      "entityId": "uuid-local-ou-id-serveur",
      "operation": "CREATE|UPDATE|DELETE",
      "payload": { ... },
      "version": 1,
      "deviceId": "uuid-du-poste",
      "clientTimestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Reponse serveur -> client

```json
{
  "results": [
    {
      "localId": "uuid-local",
      "serverId": "uuid-serveur",
      "serverVersion": 1,
      "status": "SYNCED|CONFLICT|ERROR",
      "conflictData": { ... }
    }
  ],
  "changes": [
    {
      "entityType": "Student",
      "entityId": "uuid",
      "operation": "CREATE|UPDATE|DELETE",
      "payload": { ... },
      "serverVersion": 2,
      "deviceId": "autre-poste",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ],
  "serverTimestamp": "2024-01-15T11:00:00Z"
}
```

## Entites synchronisees

Toutes les entites critiques sont synchronisees :

| Entite | Operations | Champs sensibles |
|---|---|---|
| `Student` | CREATE, UPDATE, DELETE | tous les champs |
| `Grade` | CREATE, UPDATE | value, maxValue, coefficient |
| `Attendance` | CREATE, UPDATE | status |
| `Payment` | CREATE, UPDATE | amount, paidAmount, status |
| `Message` | CREATE | subject, body |

Les entites de configuration (classes, matieres, structures de frais) sont synchronisees en lecture seule depuis le serveur.

## Gestion des conflits

### Champs non critiques (last-write-wins)

Les champs suivants utilisent la strategie **last-write-wins** : la version la plus recente par `clientTimestamp` est conservee.

- Telephone, adresse, email
- Notes medicales, allergies
- Commentaires
- Photo URL

### Champs critiques (conflit obligatoire)

Les champs suivants declenchent un conflit necessitant resolution :

- Notes : `value`, `maxValue`, `coefficient`
- Presences : `status`
- Paiements : `amount`, `paidAmount`, `status`

### Strategies de resolution

1. **USE_SERVER** - Conserver la version serveur (ecrase la version client)
2. **USE_CLIENT** - Appliquer la version client (ecrase la version serveur)
3. **USE_MERGE** - Fusion manuelle avec choix champ par champ

Les conflits non resolus sont stockes dans `sync_logs` avec le statut `CONFLICT` et exposes via `GET /sync/conflicts`.

## Gestion des IDs

- Le client genere des UUIDs v4 pour les nouvelles entites
- Le serveur maintient un mapping `local_id -> server_id`
- Les IDs sont retournes dans la reponse de synchronisation
- Les entites deja synchronisees referencent directement le `server_id`

## Versionning

Chaque entite synchronisable possede un champ `version` (entier incrementiel) :

- La version permet de detecter les ecritures concurrentes
- Une tentative d'ecriture avec une version obsolete est refusee
- Le serveur retourne la version courante dans les `changes`

## Stockage local (SQLite)

Le client maintient une base SQLite locale avec le meme schema que le serveur, plus :

- `sync_outbox` - File d'attente des operations en attente
- `sync_metadata` - Timestamps et etat de synchronisation
- `sync_conflicts` - Conflits en attente de resolution

## Cycle de synchronisation

1. **Collecte** : Lecture des entrees dans `sync_outbox` depuis le dernier `lastSyncTimestamp`
2. **Envoi** : POST `/api/v1/sync/batch` avec le lot d'ecritures
3. **Traitement** : Le serveur traite chaque entree, detecte les conflits
4. **Reponse** : Retourne les resultats, les changements distants, et les conflits
5. **Mise a jour** : Le client applique les changements distants dans SQLite
6. **Resolution** : Les conflits sont affiches a l'utilisateur pour resolution
