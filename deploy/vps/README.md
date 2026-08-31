# Déploiement de l'API sur le VPS

L'API NestJS tourne sur le VPS sous pm2 (`ecole-api`, port 3000). **Chaque push sur `main`** qui touche `server/` redéploie automatiquement via GitHub Actions (`.github/workflows/deploy-api.yml`), qui se connecte en SSH et exécute `deploy/vps/deploy-api.sh`.

## Mise en place (une fois)
1. Sur le VPS, le fichier `~/ecole-saas.env` contient la configuration de production (copie de `server/.env` avec `NODE_ENV=production`, `PORT=3000`, `CORS_ORIGIN`, `DATABASE_URL`, `JWT_*`, `COUCHDB_*`, `SMTP_*`).
2. Une clé SSH dédiée est autorisée sur le VPS (`~/.ssh/authorized_keys`) : `~/.ssh/ecole_deploy.pub` du poste de développement.
3. Dans GitHub → *Settings › Secrets and variables › Actions*, créer :
   - `VPS_HOST` = `51.178.50.63`
   - `VPS_USER` = `ubuntu`
   - `VPS_SSH_KEY` = contenu de la clé **privée** `~/.ssh/ecole_deploy` (`cat ~/.ssh/ecole_deploy`)
4. Ouvrir le port : `sudo ufw allow 3000/tcp`.

## À la main
```bash
ssh ubuntu@51.178.50.63 'bash ~/ecole-saas/deploy/vps/deploy-api.sh'
ssh ubuntu@51.178.50.63 'pm2 logs ecole-api'      # journaux
```
