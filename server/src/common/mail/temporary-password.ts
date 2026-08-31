import { randomInt } from 'crypto';

/** 10 caractères lisibles (pas de 0/O/1/l/I), avec au moins une lettre et un chiffre. */
export function generateTemporaryPassword(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 10) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

/** Texte + HTML de l'e-mail « votre accès ». */
export function credentialsMail(opts: { firstName?: string | null; email: string; password: string; schoolName?: string | null }) {
  const text = [
    `Bonjour ${opts.firstName ?? ''}`.trim() + ',',
    '',
    `Un compte vient d'être créé pour vous sur Sekoliko (${opts.schoolName ?? 'votre établissement'}).`,
    '',
    `    Identifiant : ${opts.email}`,
    `    Mot de passe temporaire : ${opts.password}`,
    '',
    'Ce mot de passe est à changer dès votre première connexion. Ne le communiquez à personne.',
  ].join('\n');
  const html = text.replace(/\n/g, '<br>').replace(opts.password, `<code style="font-size:15px">${opts.password}</code>`);
  return { subject: `Votre accès Sekoliko — ${opts.schoolName ?? ''}`.trim(), text, html };
}
