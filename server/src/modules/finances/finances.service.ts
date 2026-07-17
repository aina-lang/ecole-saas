import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class FinancesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createFeeStructure(tenantId: string, dto: CreateFeeStructureDto, userId?: string) {
    const fee = await this.prisma.feeStructure.create({
      data: {
        tenantId,
        label: dto.label,
        amount: dto.amount,
        dueDay: dto.dueDay ?? 15,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'FeeStructure',
      entityId: fee.id,
      newValue: dto,
    });

    // Propager vers CouchDB
    this.prisma.notifyWrite('FeeStructure', fee);

    return fee;
  }

  async findAllFeeStructures(tenantId: string) {
    return this.prisma.feeStructure.findMany({
      where: { tenantId },
      include: { _count: { select: { payments: true } } },
      orderBy: { label: 'asc' },
    });
  }

  async findFeeStructureById(id: string, tenantId: string) {
    const fee = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        payments: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!fee) throw new NotFoundException('Structure de frais non trouvée');
    return fee;
  }

  async updateFeeStructure(id: string, tenantId: string, dto: Partial<CreateFeeStructureDto>, userId?: string) {
    const existing = await this.prisma.feeStructure.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Structure de frais non trouvée');

    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        label: dto.label,
        amount: dto.amount,
        dueDay: dto.dueDay,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'FeeStructure',
      entityId: id,
      oldValue: existing,
      newValue: dto,
    });

    // Propager la mise à jour vers CouchDB
    this.prisma.notifyWrite('FeeStructure', updated);

    return updated;
  }

  async deleteFeeStructure(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { payments: true } } },
    });
    if (!existing) throw new NotFoundException('Structure de frais non trouvée');
    if (existing._count.payments > 0) {
      throw new ConflictException('Impossible de supprimer une structure de frais avec des paiements associés');
    }

    await this.prisma.feeStructure.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'FeeStructure',
      entityId: id,
      oldValue: existing,
    });

    // Propager la suppression vers CouchDB (deletedAt → _deleted)
    this.prisma.notifyWrite('FeeStructure', { id, tenantId, deletedAt: new Date() });

    return { message: 'Structure de frais supprimée' };
  }

  async createPayment(tenantId: string, dto: CreatePaymentDto, userId?: string) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException('Élève non trouvé');

    if (dto.feeStructureId) {
      const feeStructure = await this.prisma.feeStructure.findFirst({ where: { id: dto.feeStructureId, tenantId } });
      if (!feeStructure) throw new NotFoundException('Structure de frais non trouvée');
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        feeStructureId: dto.feeStructureId,
        academicYearId: dto.academicYearId,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        notes: dto.notes,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
        feeStructure: { select: { id: true, label: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { studentId: dto.studentId, amount: dto.amount },
    });

    // Propager vers CouchDB
    this.prisma.notifyWrite('Payment', payment);

    return payment;
  }

  async findAllPayments(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { tenantId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
          feeStructure: { select: { id: true, label: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findPaymentById(id: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true, classId: true } },
        feeStructure: true,
      },
    });
    if (!payment) throw new NotFoundException('Paiement non trouvé');
    return payment;
  }

  async updatePayment(id: string, tenantId: string, dto: Partial<CreatePaymentDto>, userId?: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Paiement non trouvé');

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        amount: dto.amount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        feeStructureId: dto.feeStructureId,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'Payment',
      entityId: id,
      oldValue: existing,
      newValue: dto,
    });

    // Propager la mise à jour vers CouchDB
    this.prisma.notifyWrite('Payment', updated);

    return updated;
  }

  async deletePayment(id: string, tenantId: string, userId?: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Paiement non trouvé');

    await this.prisma.payment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'Payment',
      entityId: id,
      oldValue: existing,
    });

    // Propager la suppression (soft) vers CouchDB (deletedAt → _deleted)
    this.prisma.notifyWrite('Payment', { id, tenantId, deletedAt: new Date() });

    return { message: 'Paiement supprimé' };
  }

  async recordPayment(id: string, tenantId: string, paidAmount: number, paymentMethod?: string, reference?: string, userId?: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, tenantId } });
    if (!payment) throw new NotFoundException('Paiement non trouvé');
    if (payment.status === 'PAID') throw new ConflictException('Ce paiement a déjà été effectué');

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        paidAmount,
        paymentMethod,
        reference,
        paidAt: new Date(),
        status: 'PAID' as PaymentStatus,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'RECORD_PAYMENT',
      entityType: 'Payment',
      entityId: id,
      newValue: { paidAmount, paymentMethod, reference },
    });

    // Propager le paiement enregistré vers CouchDB
    this.prisma.notifyWrite('Payment', updated);

    return updated;
  }

  async getStudentBalance(studentId: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) throw new NotFoundException('Élève non trouvé');

    const payments = await this.prisma.payment.findMany({
      where: { studentId, tenantId, deletedAt: null, status: { not: 'CANCELLED' } },
    });

    const totalDue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
    const balance = totalDue - totalPaid;

    return {
      studentId,
      totalDue,
      totalPaid,
      balance,
      paymentCount: payments.length,
      payments,
    };
  }

  async getOverduePayments(tenantId: string) {
    const now = new Date();
    return this.prisma.payment.findMany({
      where: {
        tenantId,
        dueDate: { lt: now },
        status: { in: ['PENDING', 'OVERDUE'] },
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } },
        feeStructure: { select: { id: true, label: true } },
      },
    });
  }

  async getDashboard(tenantId: string) {
    const now = new Date();

    const [totalCollected, pendingPayments, overduePayments, totalDue] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'PAID', deletedAt: null },
        _sum: { paidAmount: true },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, status: 'PENDING', dueDate: { gte: now }, deletedAt: null },
        select: { amount: true, paidAmount: true },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, dueDate: { lt: now }, status: { in: ['PENDING', 'OVERDUE'] }, deletedAt: null },
        select: { amount: true, paidAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: { not: 'CANCELLED' }, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const pendingTotal = pendingPayments.reduce((sum, p) => sum + (p.amount - p.paidAmount), 0);
    const overdueTotal = overduePayments.reduce((sum, p) => sum + (p.amount - p.paidAmount), 0);

    return {
      totalCollected: totalCollected._sum.paidAmount ?? 0,
      pending: pendingTotal,
      overdue: overdueTotal,
      totalDue: totalDue._sum.amount ?? 0,
      overdueCount: overduePayments.length,
    };
  }

  async exportCsv(tenantId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true, registrationNumber: true } },
        feeStructure: { select: { label: true } },
      },
    });

    const header = 'Élève,Matricule,Frais, Montant dû,Montant payé,Statut,Date d\'échéance,Date de paiement,Référence,Méthode de paiement';
    const rows = payments.map((p) => {
      const studentName = `${p.student.firstName} ${p.student.lastName}`;
      const feeLabel = p.feeStructure?.label ?? '';
      const dueDate = p.dueDate.toISOString().split('T')[0];
      const paidAt = p.paidAt ? p.paidAt.toISOString().split('T')[0] : '';
      return `${studentName},${p.student.registrationNumber},${feeLabel},${p.amount},${p.paidAmount},${p.status},${dueDate},${paidAt},${p.reference ?? ''},${p.paymentMethod ?? ''}`;
    });

    const csv = [header, ...rows].join('\n');
    return csv;
  }
}