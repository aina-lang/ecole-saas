import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../../common/mail/mail.service';
import { generateTemporaryPassword, credentialsMail } from '../../common/mail/temporary-password';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

const TEACHER_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: {
        select: { value: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' as const },
      },
      isActive: true,
      role: true,
      photoUrl: true,
    },
  },
  classes: { select: { id: true, name: true } },
  subjects: { select: { id: true, name: true, code: true, level: true } },
};

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  async findByUserId(userId: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, tenantId },
      include: TEACHER_INCLUDE,
    });
    if (!teacher) throw new NotFoundException("Aucune fiche enseignant n'est associée à ce compte");
    return teacher;
  }

  async findAll(tenantId: string) {
    return this.prisma.teacher.findMany({
      where: { tenantId },
      include: TEACHER_INCLUDE,
      orderBy: { user: { lastName: 'asc' } },
    });
  }

  async findById(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: TEACHER_INCLUDE,
    });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');
    return teacher;
  }

  private normalizePhones(phones?: string[]): string[] {
    if (!phones) return [];
    return Array.from(new Set(phones.map((p) => p.trim()).filter(Boolean))).slice(0, 3);
  }

  async create(tenantId: string, dto: CreateTeacherDto, userId?: string) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('Cet email existe déjà');
    }

    const phones = this.normalizePhones(dto.phones);

    const userData: any = {
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'TEACHER',
      phones: phones.length
        ? { create: phones.map((value, sortOrder) => ({ value, sortOrder })) }
        : undefined,
    };
    if (dto.email) userData.email = dto.email;
    // Sans mot de passe fourni : mot de passe TEMPORAIRE généré, renvoyé à
    // l'administrateur (affiché à l'écran) et envoyé par e-mail à l'enseignant ;
    // changement obligatoire à la première connexion.
    const temporaryPassword = dto.password ? null : generateTemporaryPassword();
    userData.passwordHash = await bcrypt.hash(dto.password ?? temporaryPassword!, 12);
    if (temporaryPassword) userData.mustChangePassword = true;

    // Ne relier que des classes/matières qui existent côté serveur : une classe
    // créée hors ligne et pas encore synchronisée ferait échouer toute la création.
    const [validClasses, validSubjects] = await Promise.all([
      dto.classIds?.length ? this.prisma.class.findMany({ where: { tenantId, id: { in: dto.classIds } }, select: { id: true } }) : [],
      dto.subjectIds?.length ? this.prisma.subject.findMany({ where: { tenantId, id: { in: dto.subjectIds } }, select: { id: true } }) : [],
    ]);
    dto = { ...dto, classIds: validClasses.map((c) => c.id), subjectIds: validSubjects.map((s) => s.id) };

    const teacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: userData,
      });

      const created = await tx.teacher.create({
        data: {
          tenantId,
          userId: user.id,
          specialty: dto.specialty,
          classes: dto.classIds?.length
            ? { connect: dto.classIds.map((id) => ({ id })) }
            : undefined,
          subjects: dto.subjectIds?.length
            ? { connect: dto.subjectIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Teacher',
      entityId: teacher.id,
      newValue: dto,
    });

    // Propager vers CouchDB (fiche + compte utilisateur)
    const created = await this.findById(teacher.id, tenantId);
    this.prisma.notifyWrite('Teacher', toTeacherDoc(created));
    const createdUser = await this.prisma.user.findUnique({ where: { id: teacher.userId } });
    if (createdUser) this.prisma.notifyWrite('User', createdUser);

    let credentialsEmailed = false;
    if (temporaryPassword && dto.email) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const mail = credentialsMail({ firstName: dto.firstName, email: dto.email, password: temporaryPassword, schoolName: tenant?.name });
      credentialsEmailed = await this.mail.send(dto.email, mail.subject, mail.text, mail.html);
    }
    return { ...created, temporaryPassword, credentialsEmailed };
  }

  async update(id: string, tenantId: string, dto: UpdateTeacherDto, userId?: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    if (dto.firstName || dto.lastName || dto.email || dto.phones !== undefined || dto.password) {
      const data: any = {};
      if (dto.firstName) data.firstName = dto.firstName;
      if (dto.lastName) data.lastName = dto.lastName;
      if (dto.email) data.email = dto.email;
      if (dto.phones !== undefined) {
        const phones = this.normalizePhones(dto.phones);
        data.phones = {
          deleteMany: {},
          create: phones.map((value, sortOrder) => ({ value, sortOrder })),
        };
      }
      if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
      await this.prisma.user.update({ where: { id: teacher.userId }, data });
    }

    const data: any = {};
    if (dto.specialty !== undefined) data.specialty = dto.specialty;
    if (dto.classIds) data.classes = { set: dto.classIds.map((cid) => ({ id: cid })) };
    if (dto.subjectIds) data.subjects = { set: dto.subjectIds.map((sid) => ({ id: sid })) };

    if (Object.keys(data).length > 0) {
      await this.prisma.teacher.update({ where: { id }, data });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Teacher',
      entityId: id,
      newValue: dto,
    });

    // Propager la mise à jour vers CouchDB
    const updated = await this.findById(id, tenantId);
    this.prisma.notifyWrite('Teacher', toTeacherDoc(updated));

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Teacher',
      entityId: id,
    });

    // Propager la désactivation vers CouchDB (isActive:false) pour que le client pull la nouvelle version
    this.prisma.notifyWrite('Teacher', { id: teacher.id, tenantId, isActive: false });

    return { message: 'Enseignant désactivé' };
  }
}

/**
 * Document enseignant tel que les postes le manipulent : en plus des
 * relations, les tableaux d'ids (classIds/subjectIds) et les champs plats
 * user_* utilisés par les listes et le détail de classe hors ligne.
 */
function toTeacherDoc(t: any) {
  const phones: string[] = (t.user?.phones ?? []).map((p: any) => p.value);
  const flatPhones = Object.fromEntries(phones.map((v, i) => [`user_phone_${i}`, v]));
  return {
    ...t,
    classIds: (t.classes ?? []).map((c: any) => c.id),
    subjectIds: (t.subjects ?? []).map((s: any) => s.id),
    user_firstName: t.user?.firstName ?? null,
    user_lastName: t.user?.lastName ?? null,
    user_email: t.user?.email ?? null,
    ...flatPhones,
  };
}
