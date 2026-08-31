#!/usr/bin/env bash
# Déploiement de l'API École SaaS sur le VPS. Lancé par GitHub Actions à
# chaque push sur main (dossier server/), ou à la main :  bash deploy-api.sh
#
# Idempotent : clone au premier passage, puis se cale sur origin/main,
# installe, génère Prisma, compile, applique les migrations, recharge pm2.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/aina-lang/ecole-saas.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$HOME/ecole-saas}"
ENV_FILE="${ENV_FILE:-$HOME/ecole-saas.env}"   # .env de production, hors du dépôt
PM2_NAME="ecole-api"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

if [ ! -d "$APP_DIR/.git" ]; then
  log "Clonage de $REPO_URL ($BRANCH)"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ "${SKIP_GIT:-0}" != "1" ]; then
  log "Mise à jour du code ($BRANCH)"
  git fetch --prune origin
  git reset --hard "origin/$BRANCH"
  git log -1 --oneline
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "✖ Fichier d'environnement manquant : $ENV_FILE" >&2
  echo "  Copiez server/.env du poste de développement vers $ENV_FILE (PORT, DATABASE_URL, JWT_*, COUCHDB_*, SMTP_*)." >&2
  exit 1
fi
ln -sf "$ENV_FILE" server/.env

cd server
log "Dépendances"
npm ci --no-audit --no-fund

log "Client Prisma + compilation"
npx prisma generate
npm run build

log "Migrations"
npx prisma migrate deploy

log "Redémarrage pm2 ($PM2_NAME)"
pm2 startOrReload "$APP_DIR/deploy/vps/ecosystem.config.cjs" --update-env
pm2 save >/dev/null

PORT_="$(grep -oP '^PORT=\K[0-9]+' "$ENV_FILE" || echo 3000)"
# Nest met quelques secondes à démarrer (Prisma, CouchDB) : on attend jusqu'à 40 s.
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT_}/api/v1/license/status" 2>/dev/null || true)"
  if [ "$code" = "200" ] || [ "$code" = "401" ]; then
    log "API en ligne sur le port ${PORT_} ✔"
    exit 0
  fi
  sleep 2
done
echo "✖ L'API ne répond pas sur le port ${PORT_} après 40 s — voir : pm2 logs $PM2_NAME" >&2
exit 1
