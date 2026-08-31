#!/usr/bin/env node
// Réinitialise le mot de passe d'un compte (support) : génère un mot de passe
// TEMPORAIRE, le hache en base et force son changement à la prochaine connexion.
//   npm run password:reset -- --email admin@ecole.mg [--tenant <id> si ambigu]
// Communiquez le mot de passe affiché à l'utilisateur (WhatsApp / téléphone).
import pg from 'pg';
import bcrypt from 'bcrypt';
import { readFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1]]);
    return acc;
  }, []),
);
if (!args.email) {
  console.error('Usage : npm run password:reset -- --email <adresse> [--tenant <id>]');
  process.exit(1);
}
const envFile = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const dbUrl = process.env.DATABASE_URL || /^DATABASE_URL="?([^"\n]+)"?/m.exec(envFile)?.[1];
if (!dbUrl) { console.error('DATABASE_URL introuvable (env ou .env)'); process.exit(1); }

const client = new pg.Client({ connectionString: dbUrl.replace(/\?schema=public$/, '') });
await client.connect();
try {
  const email = args.email.trim().toLowerCase();
  const { rows } = await client.query(
    `SELECT u.id, u."firstName", u."lastName", u.role, t.id AS "tenantId", t.name
     FROM users u JOIN tenants t ON t.id = u."tenantId"
     WHERE lower(u.email) = $1 ORDER BY u."createdAt"`, [email]);
  if (rows.length === 0) { console.error(`Aucun compte avec l’adresse ${email}`); process.exit(1); }
  if (rows.length > 1 && !args.tenant) {
    console.error(`Adresse présente dans ${rows.length} établissements — précisez --tenant <id> :`);
    for (const r of rows) console.error(`  ${r.tenantId}  ${r.name}  (${r.role})`);
    process.exit(1);
  }
  const user = args.tenant ? rows.find((r) => r.tenantId === args.tenant) : rows[0];
  if (!user) { console.error('Identifiant --tenant introuvable pour cette adresse'); process.exit(1); }

  const temp = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const hash = await bcrypt.hash(temp, 12);
  await client.query(
    `UPDATE users SET "passwordHash" = $1, "mustChangePassword" = true, "refreshToken" = NULL,
       "passwordResetToken" = NULL, "passwordResetExpiresAt" = NULL, "updatedAt" = now()
     WHERE id = $2`, [hash, user.id]);
  console.log(`\nMot de passe temporaire — ${user.firstName ?? ''} ${user.lastName} (${email}) — ${user.name}\n`);
  console.log(`    ${temp}\n`);
  console.log('À changer obligatoirement à la prochaine connexion.');
} finally {
  await client.end();
}
