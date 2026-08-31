// Code de licence court : 16 caractères sur un alphabet sans ambiguïté
// (pas de 0/O ni 1/I), affiché par groupes de 4 : XXXX-XXXX-XXXX-XXXX.
// 32^16 ≈ 1,2 × 10^24 combinaisons : impossible à deviner.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 16;

/** Normalise une saisie utilisateur : majuscules, sans tirets/espaces. */
export function normalizeLicenseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formate un code normalisé en XXXX-XXXX-XXXX-XXXX. */
export function formatLicenseCode(code: string): string {
  return normalizeLicenseCode(code).match(/.{1,4}/g)?.join('-') ?? '';
}
