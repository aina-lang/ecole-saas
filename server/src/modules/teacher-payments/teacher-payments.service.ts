import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTeacherPaymentDto, CalculateTeacherPaymentDto } from './dto/create-payment.dto';

@Injectable()
export class TeacherPaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, teacherId?: string) {
    const where: any = { tenantId };
    if (teacherId) where.teacherId = teacherId;

    return this.prisma.teacherPayment.findMany({
      where,
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const payment = await this.prisma.teacherPayment.findFirst({
      where: { id, tenantId },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Paiement enseignant non trouvé');
    return payment;
  }

  async create(tenantId: string, dto: CreateTeacherPaymentDto) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: dto.teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    return this.prisma.teacherPayment.create({
      data: {
        tenantId,
        teacherId: dto.teacherId,
        periodLabel: dto.periodLabel,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalHours: dto.totalHours ?? 0,
        hourlyRate: dto.hourlyRate,
        baseAmount: dto.baseAmount ?? 0,
        bonusAmount: dto.bonusAmount ?? 0,
        deductionAmount: dto.deductionAmount ?? 0,
        totalAmount: dto.totalAmount ?? 0,
        notes: dto.notes,
      },
      include: {
        teacher: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async calculate(tenantId: string, dto: CalculateTeacherPaymentDto) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: dto.teacherId, tenantId },
      include: {
        contract: true,
        timetable: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!teacher) throw new NotFoundException('Enseignant non trouvé');

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    // Calculate teaching hours from timetable slots in the period
    // Count how many times each slot occurs in the period (weekly recurring)
    const dayCount = this.countWeekdaysInPeriod(periodStart, periodEnd);
    let totalHours = 0;
    for (const slot of teacher.timetable) {
      const occurrences = dayCount.filter((d) => d.dayOfWeek === slot.dayOfWeek).length;
      const slotHours = this.calculateSlotHours(slot.startTime, slot.endTime);
      totalHours += slotHours * occurrences;
    }

    // Get attendance stats for the period
    const attendances = await this.prisma.teacherAttendance.findMany({
      where: {
        tenantId,
        teacherId: dto.teacherId,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    const presentDays = attendances.filter((a) => a.status === 'PRESENT').length;
    const totalDays = attendances.length || 1;

    // Calculate payment based on contract type
    const contract = teacher.contract;
    let baseAmount = 0;
    let hourlyRate = contract?.hourlyRate || 0;
    const attendanceRate = presentDays / totalDays;

    if (contract) {
      switch (contract.contractType) {
        case 'HOURLY':
          baseAmount = totalHours * (contract.hourlyRate || 0);
          hourlyRate = contract.hourlyRate || 0;
          break;
        case 'MONTHLY':
          baseAmount = contract.monthlySalary || 0;
          break;
        case 'FIXED':
          baseAmount = contract.fixedAmount || 0;
          break;
      }
    }

    // Apply attendance bonus/penalty
    const bonusAmount = attendanceRate >= 0.95 ? baseAmount * 0.05 : 0;
    const deductionAmount = attendanceRate < 0.8 ? baseAmount * 0.1 * (1 - attendanceRate) : 0;
    const totalAmount = baseAmount + bonusAmount - deductionAmount;

    return {
      teacherId: dto.teacherId,
      teacherName: `${teacher.user.firstName} ${teacher.user.lastName}`,
      periodLabel: `${dto.periodStart} - ${dto.periodEnd}`,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      totalHours,
      hourlyRate,
      baseAmount: Math.round(baseAmount),
      attendanceRate: Math.round(attendanceRate * 100),
      presentDays,
      totalDays: attendances.length,
      bonusAmount: Math.round(bonusAmount),
      deductionAmount: Math.round(deductionAmount),
      totalAmount: Math.round(totalAmount),
    };
  }

  private calculateSlotHours(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh + em / 60) - (sh + sm / 60);
  }

  private countWeekdaysInPeriod(start: Date, end: Date): { dayOfWeek: number; date: Date }[] {
    const days: { dayOfWeek: number; date: Date }[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
      days.push({ dayOfWeek, date: new Date(current) });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  async markAsPaid(id: string, tenantId: string) {
    const payment = await this.prisma.teacherPayment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException('Paiement enseignant non trouvé');

    return this.prisma.teacherPayment.update({
      where: { id },
      data: {
        status: 'PAID' as any,
        paidAt: new Date(),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const payment = await this.prisma.teacherPayment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException('Paiement enseignant non trouvé');

    await this.prisma.teacherPayment.delete({ where: { id } });
    return { message: 'Paiement supprimé' };
  }
}
