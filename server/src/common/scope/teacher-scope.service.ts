import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Périmètre d'un enseignant : il ne voit et ne modifie que SES classes
// (celles auxquelles sa fiche est rattachée), leurs élèves, leurs cours,
// appels et notes. Les autres rôles (admin, secrétaire) ne sont pas
// restreints. Utilisé par les contrôleurs classes / students / attendance /
// grades / timetable — l'app mobile ne fait que refléter cette règle.

export interface ScopedUser { id: string; role: string; tenantId: string }

@Injectable()
export class TeacherScopeService {
  constructor(private prisma: PrismaService) {}

  isTeacher(user?: ScopedUser | null): boolean {
    return user?.role === 'TEACHER';
  }

  /** Ids des classes de l'enseignant ; null = pas de restriction (autre rôle). */
  async classIds(user?: ScopedUser | null): Promise<string[] | null> {
    if (!this.isTeacher(user)) return null;
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: user!.id, tenantId: user!.tenantId },
      select: { classes: { select: { id: true } } },
    });
    return teacher ? teacher.classes.map((c) => c.id) : [];
  }

  /** Lève 403 si l'enseignant n'est pas rattaché à cette classe. */
  async assertClass(user: ScopedUser | null | undefined, classId?: string | null): Promise<void> {
    const ids = await this.classIds(user);
    if (ids === null) return;
    if (!classId || !ids.includes(classId)) {
      throw new ForbiddenException("Cette classe n'est pas dans vos classes");
    }
  }

  /** Lève 403 si l'élève n'appartient pas à une classe de l'enseignant. */
  async assertStudent(user: ScopedUser | null | undefined, studentId: string): Promise<void> {
    const ids = await this.classIds(user);
    if (ids === null) return;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user!.tenantId },
      select: { classId: true },
    });
    if (!student?.classId || !ids.includes(student.classId)) {
      throw new ForbiddenException("Cet élève n'est pas dans vos classes");
    }
  }

  /**
   * Filtre de classe à appliquer à une recherche : la classe demandée si
   * elle est dans le périmètre, sinon l'ensemble du périmètre. Retourne
   * `undefined` (aucun filtre) pour les rôles non restreints.
   */
  async classFilter(user: ScopedUser | null | undefined, classId?: string | null): Promise<string | string[] | undefined> {
    const ids = await this.classIds(user);
    if (ids === null) return classId || undefined;
    if (classId) {
      if (!ids.includes(classId)) throw new ForbiddenException("Cette classe n'est pas dans vos classes");
      return classId;
    }
    return ids;
  }

  /** Fiche enseignant de l'utilisateur (null pour les autres rôles). */
  async teacherOf(user?: ScopedUser | null): Promise<{ id: string; subjectIds: string[] } | null> {
    if (!this.isTeacher(user)) return null;
    const t = await this.prisma.teacher.findFirst({
      where: { userId: user!.id, tenantId: user!.tenantId },
      select: { id: true, subjects: { select: { id: true } } },
    });
    return t ? { id: t.id, subjectIds: t.subjects.map((s) => s.id) } : { id: '', subjectIds: [] };
  }

  /** Lève 403 si la matière n'est pas enseignée par cet enseignant. */
  async assertSubject(user: ScopedUser | null | undefined, subjectId?: string | null): Promise<void> {
    const t = await this.teacherOf(user);
    if (!t) return;
    if (!subjectId || !t.subjectIds.includes(subjectId)) {
      throw new ForbiddenException("Cette matière n'est pas dans vos matières");
    }
  }

  /**
   * Appel d'un enseignant : uniquement pendant SON cours — le créneau doit
   * lui appartenir, concerner cette classe, tomber aujourd'hui et être en
   * cours (tolérance 15 min avant/après). Heure de Madagascar (UTC+3).
   */
  async assertSlotNow(user: ScopedUser | null | undefined, slotId: string | undefined | null, classId: string | undefined | null, recordedAt?: string | null): Promise<{ subjectId: string | null } | null> {
    const t = await this.teacherOf(user);
    if (!t) return null;
    if (!slotId) throw new ForbiddenException("L'appel se fait depuis votre cours en cours (emploi du temps)");
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id: slotId, tenantId: user!.tenantId },
      select: { classId: true, teacherId: true, dayOfWeek: true, startTime: true, endTime: true, subjectId: true },
    });
    if (!slot || slot.teacherId !== t.id) throw new ForbiddenException("Ce créneau n'est pas le vôtre");
    if (classId && slot.classId !== classId) throw new ForbiddenException('Ce créneau ne concerne pas cette classe');
    // Instant de référence : la SAISIE si elle est fournie et plausible
    // (pas dans le futur de plus de 10 min, pas plus vieille que 24 h), sinon
    // l'heure de réception. Heure de Madagascar (UTC+3).
    let ref = Date.now();
    if (recordedAt) {
      const t = new Date(recordedAt).getTime();
      if (Number.isNaN(t)) throw new ForbiddenException('Horodatage de saisie invalide');
      if (t - Date.now() > 10 * 60 * 1000) throw new ForbiddenException("Horodatage de saisie dans le futur — vérifiez l'heure du téléphone");
      if (Date.now() - t > 24 * 60 * 60 * 1000) throw new ForbiddenException('Appel trop ancien (plus de 24 h) — il ne peut plus être enregistré');
      ref = t;
    }
    const now = new Date(ref + 3 * 60 * 60 * 1000); // UTC+3
    const day = now.getUTCDay();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + (m || 0); };
    const TOL = 15;
    if (slot.dayOfWeek !== day || minutes < toMin(slot.startTime) - TOL || minutes > toMin(slot.endTime) + TOL) {
      throw new ForbiddenException(`L'appel n'est possible que pendant ce cours (${slot.startTime}–${slot.endTime})`);
    }
    return { subjectId: slot.subjectId ?? null };
  }
}
