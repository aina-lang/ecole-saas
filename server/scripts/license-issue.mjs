#!/usr/bin/env node
// Émet un code de licence ANNUEL (élèves et enseignants illimités) pour
// l'établissement dont l'administrateur a l'adresse e-mail donnée, et
// l'enregistre en base.
//   npm run license:issue -- --email admin@ecole.mg [--tenant <id> si ambigu]
// Lit DATABASE_URL dans l'environnement ou ./.env.
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : arr[i + 1]]);
    return acc;
  }, []),
);
if (!args.email) {
  console.error('Usage : npm run license:issue -- --email <adresse de l’administrateur> [--tenant <id>]');
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
    `SELECT t.id, t.name, u.role FROM users u JOIN tenants t ON t.id = u."tenantId"
     WHERE lower(u.email) = $1 ORDER BY u."createdAt"`, [email]);
  if (rows.length === 0) { console.error(`Aucun compte avec l’adresse ${email}`); process.exit(1); }
  if (rows.length > 1 && !args.tenant) {
    console.error(`Adresse présente dans ${rows.length} établissements — précisez --tenant <id> :`);
    for (const r of rows) console.error(`  ${r.id}  ${r.name}  (${r.role})`);
    process.exit(1);
  }
  const tenant = args.tenant ? rows.find((r) => r.id === args.tenant) : rows[0];
  if (!tenant) { console.error('Identifiant --tenant introuvable pour cette adresse'); process.exit(1); }

  const code = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const expires = new Date(); expires.setFullYear(expires.getFullYear() + 1);
  const id = 'lic_' + Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('').toLowerCase();
  await client.query(
    `INSERT INTO licenses (id, code, "tenantId", email, "expiresAt") VALUES ($1, $2, $3, $4, $5)`,
    [id, code, tenant.id, email, expires]);
  const pretty = code.match(/.{4}/g).join('-');
  console.log(`\nLicence annuelle — ${tenant.name} (${email}) — valable jusqu'au ${expires.toLocaleDateString('fr-FR')}\n`);
  console.log(`    ${pretty}\n`);
} finally {
  await client.end();
}
