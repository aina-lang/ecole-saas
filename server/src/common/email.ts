import { ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * L'e-mail est l'identifiant de connexion, et la connexion le cherche SANS
 * connaître l'établissement (auth.service.login). Deux comptes portant le même
 * e-mail dans deux établissements rendraient l'un des deux injoignable : le
 * serveur en choisirait un au hasard. L'e-mail est donc unique sur toute la
 * plateforme — garanti en base par l'index users_email_key, vérifié ici pour
 * renvoyer un message clair plutôt qu'une erreur d'index.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function assertEmailAvailable(
  prisma: PrismaService,
  email: string,
  exceptUserId?: string,
): Promise<void> {
  const taken = await prisma.user.findFirst({
    where: { email, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  if (taken) throw new ConflictException('Cet e-mail est déjà utilisé par un autre compte.');
}
