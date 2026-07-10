import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTeacherAttendanceDto, BulkTeacherAttendanceDto } from './dto/create-attendance.dto';
import { TeacherAttendance } from '@prisma/client';

@Injectable()
export class TeacherAttendanceService {
  constructor(private prisma: PrismaService) {}

  async findByDate(tenantId: string, date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.teacherAttendance.findMany({
      where: { tenantId, date: { gte: start, lte: end } },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTeacher(tenantId: string, teacherId: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId, teacherId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    return this.prisma.teacherAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async findByPeriod(tenantId: string, startDate: string, endDate: string) {
    return this.prisma.teacherAttendance.findMany({
      where: {
        tenantId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async upsert(tenantId: string, dto: CreateTeacherAttendanceDto) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: dto.teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    return this.prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: dto.teacherId, date } },
      update: { status: dto.status as any, justification: dto.justification },
      create: {
        tenantId,
        teacherId: dto.teacherId,
        date,
        status: dto.status as any,
        justification: dto.justification,
      },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async bulkUpsert(tenantId: string, dto: BulkTeacherAttendanceDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    const results: TeacherAttendance[] = [];
    for (const record of dto.records) {
      const teacher = await this.prisma.teacher.findFirst({ where: { id: record.teacherId, tenantId } });
      if (!teacher) continue;

      const attendance = await this.prisma.teacherAttendance.upsert({
        where: { teacherId_date: { teacherId: record.teacherId, date } },
        update: { status: record.status as any, justification: record.justification },
        create: {
          tenantId,
          teacherId: record.teacherId,
          date,
          status: record.status as any,
          justification: record.justification,
        },
      });
      results.push(attendance);
    }

    return results;
  }

  async getStats(tenantId: string, teacherId: string, startDate: string, endDate: string) {
    const records = await this.prisma.teacherAttendance.findMany({
      where: {
        tenantId,
        teacherId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const excused = records.filter((r) => r.status === 'EXCUSED').length;

    return { total, present, absent, late, excused, rate: total > 0 ? (present / total) * 100 : 0 };
  }
}
