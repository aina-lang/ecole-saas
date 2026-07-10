import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';

const SLOT_INCLUDE = {
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      coefficient: true,
      level: true,
      class: { select: { id: true, name: true } },
    },
  },
  teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
};

@Injectable()
export class TimetableService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findByClass(classId: string, tenantId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { tenantId, classId },
      include: SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findById(id: string, tenantId: string) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id, tenantId },
      include: SLOT_INCLUDE,
    });
    if (!slot) throw new NotFoundException('Créneau non trouvé');
    return slot;
  }

  private async validateRelations(dto: CreateTimetableSlotDto | UpdateTimetableSlotDto, tenantId: string) {
    if (dto.classId) {
      const cls = await this.prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
      if (!cls) throw new BadRequestException('Classe non trouvée');
    }
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({ where: { id: dto.subjectId, tenantId } });
      if (!subject) throw new BadRequestException('Matière non trouvée');
    }
    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({ where: { id: dto.teacherId, tenantId } });
      if (!teacher) throw new BadRequestException('Enseignant non trouvé');
    }
  }

  async create(tenantId: string, dto: CreateTimetableSlotDto, userId?: string) {
    await this.validateRelations(dto, tenantId);

    const slot = await this.prisma.timetableSlot.create({
      data: {
        tenantId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      newValue: dto,
    });

    return this.findById(slot.id, tenantId);
  }

  async update(id: string, tenantId: string, dto: UpdateTimetableSlotDto, userId?: string) {
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id, tenantId } });
    if (!slot) throw new NotFoundException('Créneau non trouvé');

    await this.validateRelations(dto, tenantId);

    const data: any = {};
    if (dto.classId !== undefined) data.classId = dto.classId;
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId;
    if (dto.teacherId !== undefined) data.teacherId = dto.teacherId;
    if (dto.dayOfWeek !== undefined) data.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.room !== undefined) data.room = dto.room;

    await this.prisma.timetableSlot.update({ where: { id }, data });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'TimetableSlot',
      entityId: id,
      newValue: dto,
    });

    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const slot = await this.prisma.timetableSlot.findFirst({ where: { id, tenantId } });
    if (!slot) throw new NotFoundException('Créneau non trouvé');

    await this.prisma.timetableSlot.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'TimetableSlot',
      entityId: id,
    });

    return { message: 'Créneau supprimé' };
  }
}
