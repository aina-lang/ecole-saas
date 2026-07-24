import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';

// @types/node 24.x + lib ES2023 a un bug de typage connu où Buffer (typé
// Uint8Array<ArrayBufferLike>) n'est plus reconnu compatible avec les
// overloads crypto (qui attendent Uint8Array<ArrayBuffer>), alors que c'est
// exactement l'usage standard et documenté du module crypto de Node. Les
// casts ci-dessous contournent ce faux positif de typage, pas un problème de
// sécurité runtime.

/**
 * Dérive une clé de chiffrement à partir d'un secret serveur (jamais stockée
 * telle quelle). Réutilise JWT_SECRET par défaut pour éviter d'imposer une
 * nouvelle variable d'environnement obligatoire ; CREDENTIALS_ENCRYPTION_KEY
 * permet de la dédier si souhaité.
 */
function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY ou JWT_SECRET requis pour chiffrer des secrets au repos',
    );
  }
  return scryptSync(secret, 'ecole-saas-credentials', 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey() as any, iv as any);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()] as any);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv(ALGO, getKey() as any, iv as any);
  decipher.setAuthTag(tag as any);
  const out = Buffer.concat([decipher.update(enc as any), decipher.final()] as any);
  return out.toString('utf8');
}
