import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private isEditable(date: Date): boolean {
    return new Date(date).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  }

  async findAll(tenantId: string, filters?: { studentId?: string; classId?: string; date?: string; status?: string; startDate?: string; endDate?: string }) {
    const where: any = { tenantId, deletedAt: null };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.status) where.status = filters.status;
    if (filters?.date) where.date = new Date(filters.date);
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }
    if (filters?.classId) {
      where.student = { classId: filters.classId };
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true, class: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
      },
    });
    if (!attendance) throw new NotFoundException('Présence non trouvée');
    return attendance;
  }

  async create(tenantId: string, dto: CreateAttendanceDto, userId?: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: { studentId_date: { studentId: dto.studentId, date: new Date(dto.date) } },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Une présence existe déjà pour cet étudiant à cette date');
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        date: new Date(dto.date),
        status: dto.status,
        justification: dto.justification,
        updatedBy: userId,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Attendance',
      entityId: attendance.id,
      newValue: dto,
    });

    // Propager vers CouchDB
    this.prisma.notifyWrite('Attendance', attendance);

    return attendance;
  }

  async update(id: string, tenantId: string, dto: Partial<CreateAttendanceDto>, userId?: string) {
    const existing = await this.prisma.attendance.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Présence non trouvée');
    if (!this.isEditable(existing.date)) throw new ForbiddenException('Cette présence ne peut plus être modifiée après 24h');

    const data: any = { ...dto, updatedBy: userId };
    if (dto.date) data.date = new Date(dto.date);

    const attendance = await this.prisma.attendance.update({
      where: { id },
      data,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Attendance',
      entityId: id,
      oldValue: existing,
      newValue: dto,
    });

    // Propager la mise à jour vers CouchDB
    this.prisma.notifyWrite('Attendance', attendance);

    return attendance;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.attendance.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Présence non trouvée');
    if (!this.isEditable(existing.date)) throw new ForbiddenException('Cette présence ne peut plus être modifiée après 24h');

    await this.prisma.attendance.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Attendance',
      entityId: id,
      oldValue: existing,
    });

    // Propager la suppression vers CouchDB (deletedAt → _deleted)
    this.prisma.notifyWrite('Attendance', { id, tenantId, deletedAt: new Date() });

    return { message: 'Présence supprimée' };
  }

  async bulkCreate(tenantId: string, dto: BulkAttendanceDto, userId?: string) {
    const results = { created: 0, skipped: 0, errors: [] as any[] };

    for (const record of dto.records) {
      try {
        const existing = await this.prisma.attendance.findUnique({
          where: { studentId_date: { studentId: record.studentId, date: new Date(dto.date) } },
        });

        if (existing && !existing.deletedAt) {
          if (!this.isEditable(existing.date)) {
            results.errors.push({ studentId: record.studentId, error: 'Cette présence ne peut plus être modifiée après 24h' });
            results.skipped++;
            continue;
          }
          const updated = await this.prisma.attendance.update({
            where: { id: existing.id },
            data: { status: record.status, justification: record.justification, updatedBy: userId },
          });
          this.prisma.notifyWrite('Attendance', updated);
          results.created++;
        } else {
          const created = await this.prisma.attendance.create({
            data: {
              tenantId,
              studentId: record.studentId,
              date: new Date(dto.date),
              status: record.status,
              justification: record.justification,
              updatedBy: userId,
            },
          });
          this.prisma.notifyWrite('Attendance', created);
          results.created++;
        }
      } catch (error) {
        results.errors.push({ studentId: record.studentId, error: error.message });
        results.skipped++;
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'BULK_CREATE',
      entityType: 'Attendance',
      metadata: { date: dto.date, created: results.created, skipped: results.skipped },
    });

    return results;
  }

  async getStatistics(tenantId: string, filters?: { classId?: string; studentId?: string; startDate?: string; endDate?: string }) {
    const where: any = { tenantId, deletedAt: null };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.classId) where.student = { classId: filters.classId };
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [total, byStatus] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    const statusBreakdown = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    const rate = total > 0
      ? {
          present: ((statusBreakdown['PRESENT'] || 0) / total) * 100,
          absent: ((statusBreakdown['ABSENT'] || 0) / total) * 100,
          late: ((statusBreakdown['LATE'] || 0) / total) * 100,
          excused: ((statusBreakdown['EXCUSED'] || 0) / total) * 100,
          holiday: ((statusBreakdown['HOLIDAY'] || 0) / total) * 100,
        }
      : { present: 0, absent: 0, late: 0, excused: 0, holiday: 0 };

    return { total, statusBreakdown, rate };
  }

  async detectAbsenceAlerts(studentId: string, tenantId: string, consecutiveDays = 3) {
    const attendances = await this.prisma.attendance.findMany({
      where: { studentId, tenantId, deletedAt: null, status: 'ABSENT' },
      orderBy: { date: 'desc' },
      take: consecutiveDays * 2,
    });

    if (attendances.length < consecutiveDays) return { alert: false, message: 'Pas d\'alerte' };

    const sorted = attendances.sort((a, b) => b.date.getTime() - a.date.getTime());
    let consecutive = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i - 1].date.getTime() - sorted[i].date.getTime());
      if (diff <= 86400000 * 1.5) {
        consecutive++;
        if (consecutive >= consecutiveDays) {
          return {
            alert: true,
            message: `Absence détectée depuis ${consecutive} jours consécutifs`,
            consecutiveDays: consecutive,
            records: sorted.slice(0, consecutive),
          };
        }
      } else {
        consecutive = 1;
      }
    }

    return { alert: false, message: 'Pas d\'alerte' };
  }
}
