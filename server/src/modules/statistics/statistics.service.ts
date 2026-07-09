import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      activeStudents,
      totalTeachers,
      totalClasses,
      todayAttendance,
      gradeAgg,
      paymentsAgg,
      newStudents,
      totalPayments,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.attendance.aggregate({
        where: { tenantId, date: today, deletedAt: null },
        _count: true,
      }),
      this.prisma.grade.aggregate({
        where: { tenantId, deletedAt: null },
        _avg: { value: true },
        _count: { value: true },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { paidAmount: true },
      }),
      this.prisma.student.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: firstOfMonth } },
      }),
      this.prisma.payment.count({ where: { tenantId } }),
    ]);

    const paidCount = await this.prisma.payment.count({
      where: { tenantId, status: 'PAID' },
    });

    return {
      totalActiveStudents: activeStudents,
      totalTeachers,
      totalClasses,
      attendanceRateToday:
        todayAttendance._count > 0
          ? await this.calculateTodayAttendanceRate(tenantId, today)
          : 0,
      averageGrade: gradeAgg._avg.value ? Math.round(gradeAgg._avg.value * 100) / 100 : 0,
      paymentCollectionRate:
        totalPayments > 0
          ? Math.round((paidCount / totalPayments) * 10000) / 100
          : 0,
      newStudentsThisMonth: newStudents,
      totalRevenue: paymentsAgg._sum.paidAmount || 0,
    };
  }

  private async calculateTodayAttendanceRate(tenantId: string, today: Date) {
    const total = await this.prisma.attendance.count({
      where: { tenantId, date: today, deletedAt: null },
    });
    if (total === 0) return 0;

    const present = await this.prisma.attendance.count({
      where: { tenantId, date: today, deletedAt: null, status: 'PRESENT' },
    });

    return Math.round((present / total) * 10000) / 100;
  }

  async getAttendanceStats(tenantId: string, period?: string) {
    const dateFilter = this.buildDateFilter(period);

    const byClass = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null, ...dateFilter },
      _count: true,
    });

    const totalRecords = byClass.reduce((sum, s) => sum + s._count, 0);

    const byClassDetailed = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        class: { select: { id: true, name: true } },
      },
    });

    const classStats: Record<string, { total: number; present: number }> = {};

    for (const s of byClassDetailed) {
      if (!s.class) continue;
      if (!classStats[s.class.id]) {
        classStats[s.class.id] = { total: 0, present: 0 };
      }
    }

    const classAttendance = await this.prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { tenantId, deletedAt: null, ...dateFilter },
      _count: true,
    });

    const studentClassMap = new Map<string, string>();
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null, classId: { not: null } },
      select: { id: true, classId: true },
    });
    for (const s of students) {
      if (s.classId) studentClassMap.set(s.id, s.classId);
    }

    for (const record of classAttendance) {
      const classId = studentClassMap.get(record.studentId);
      if (!classId) continue;
      if (!classStats[classId]) {
        classStats[classId] = { total: 0, present: 0 };
      }
      classStats[classId].total += record._count;
      if (record.status === 'PRESENT') {
        classStats[classId].present += record._count;
      }
    }

    const byMonth = await this.prisma.$queryRawUnsafe<Array<{ month: string; status: string; count: number }>>(
      `SELECT to_char("date", 'YYYY-MM') as month, status, COUNT(*)::int as count
       FROM attendances
       WHERE "tenantId" = $1 AND "deletedAt" IS NULL
       GROUP BY month, status
       ORDER BY month ASC`,
      tenantId,
    );

    return {
      summary: {
        total: totalRecords,
        byStatus: byClass.reduce((acc, s) => {
          acc[s.status] = s._count;
          return acc;
        }, {} as Record<string, number>),
      },
      byClass: Object.entries(classStats).map(([classId, stats]) => ({
        classId,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 10000) / 100 : 0,
        total: stats.total,
        present: stats.present,
      })),
      byMonth: byMonth.map((r) => ({
        month: r.month,
        status: r.status,
        count: Number(r.count),
      })),
    };
  }

  async getGradeStats(tenantId: string, period?: string) {
    const dateFilter = this.buildDateFilter(period);

    const grades = await this.prisma.grade.findMany({
      where: { tenantId, deletedAt: null, ...dateFilter },
      include: {
        subject: { select: { id: true, name: true, coefficient: true } },
        student: { select: { classId: true } },
      },
    });

    const values = grades.map((g) => (g.value / g.maxValue) * 20);
    const distribution = {
      '0-5': 0,
      '5-8': 0,
      '8-10': 0,
      '10-12': 0,
      '12-15': 0,
      '15-18': 0,
      '18-20': 0,
    };

    for (const v of values) {
      if (v < 5) distribution['0-5']++;
      else if (v < 8) distribution['5-8']++;
      else if (v < 10) distribution['8-10']++;
      else if (v < 12) distribution['10-12']++;
      else if (v < 15) distribution['12-15']++;
      else if (v < 18) distribution['15-18']++;
      else distribution['18-20']++;
    }

    const subjectMap = new Map<string, { name: string; values: number[]; coeffs: number[] }>();
    for (const g of grades) {
      if (!subjectMap.has(g.subjectId)) {
        subjectMap.set(g.subjectId, { name: g.subject.name, values: [], coeffs: [] });
      }
      const entry = subjectMap.get(g.subjectId);
      entry.values.push(g.value);
      entry.coeffs.push(g.coefficient);
    }

    const subjectAverages = Array.from(subjectMap.entries()).map(([id, data]) => {
      const weightedSum = data.values.reduce((sum, v, i) => sum + (v / 20) * 20 * data.coeffs[i], 0);
      const totalWeight = data.coeffs.reduce((a, b) => a + b, 0);
      return {
        subjectId: id,
        subjectName: data.name,
        average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0,
        count: data.values.length,
      };
    });

    const classMap = new Map<string, { values: number[] }>();
    for (const g of grades) {
      if (!g.student.classId) continue;
      if (!classMap.has(g.student.classId)) {
        classMap.set(g.student.classId, { values: [] });
      }
      classMap.get(g.student.classId).values.push((g.value / g.maxValue) * 20);
    }

    const classAverages = Array.from(classMap.entries()).map(([classId, data]) => ({
      classId,
      average: data.values.length > 0
        ? Math.round((data.values.reduce((a, b) => a + b, 0) / data.values.length) * 100) / 100
        : 0,
      count: data.values.length,
    }));

    return {
      overallAverage:
        values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
          : 0,
      totalGrades: grades.length,
      distribution,
      subjectAverages,
      classAverages,
    };
  }

  async getFinancialStats(tenantId: string, period?: string) {
    const dateFilter = this.buildDateFilter(period);

    const revenueByMonth = await this.prisma.$queryRawUnsafe<Array<{ month: string; total: number; count: number }>>(
      `SELECT to_char("paidAt", 'YYYY-MM') as month, COALESCE(SUM("paidAmount"), 0) as total, COUNT(*)::int as count
       FROM payments
       WHERE "tenantId" = $1 AND status = 'PAID' AND "paidAt" IS NOT NULL
       GROUP BY month
       ORDER BY month ASC`,
      tenantId,
    );

    const outstandingAgg = await this.prisma.payment.aggregate({
      where: { tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { amount: true },
      _count: true,
    });

    const methodBreakdown = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { tenantId, status: 'PAID' },
      _sum: { paidAmount: true },
      _count: true,
    });

    return {
      revenueByMonth: revenueByMonth.map((r) => ({
        month: r.month,
        total: Number(r.total),
        count: Number(r.count),
      })),
      outstanding: {
        total: outstandingAgg._sum.amount || 0,
        count: outstandingAgg._count,
      },
      paymentMethods: methodBreakdown.map((m) => ({
        method: m.paymentMethod || 'OTHER',
        total: m._sum.paidAmount || 0,
        count: m._count,
      })),
    };
  }

  async getStudentEvolution(tenantId: string, years?: number) {
    const numYears = years || 5;
    const startYear = new Date().getFullYear() - numYears;

    const result = await this.prisma.$queryRawUnsafe<Array<{ year: string; count: number }>>(
      `SELECT to_char("createdAt", 'YYYY') as year, COUNT(*)::int as count
       FROM students
       WHERE "tenantId" = $1 AND "deletedAt" IS NULL
         AND "createdAt" >= $2::timestamp
       GROUP BY year
       ORDER BY year ASC`,
      tenantId,
      `${startYear}-01-01`,
    );

    return result.map((r) => ({
      year: r.year,
      count: Number(r.count),
    }));
  }

  async exportToExcel(tenantId: string, type: string) {
    let rows: Record<string, any>[] = [];
    let headers: string[] = [];

    switch (type) {
      case 'attendance': {
        headers = ['Étudiant', 'Classe', 'Date', 'Statut', 'Justification'];
        const records = await this.prisma.attendance.findMany({
          where: { tenantId, deletedAt: null },
          include: {
            student: {
              select: { firstName: true, lastName: true, class: { select: { name: true } } },
            },
          },
          orderBy: { date: 'desc' },
          take: 10000,
        });
        rows = records.map((r) => ({
          Étudiant: `${r.student.firstName} ${r.student.lastName}`,
          Classe: r.student.class?.name || '',
          Date: r.date.toISOString().split('T')[0],
          Statut: r.status,
          Justification: r.justification || '',
        }));
        break;
      }
      case 'grades': {
        headers = ['Étudiant', 'Matière', 'Note', 'Max', 'Coefficient', 'Semestre'];
        const records = await this.prisma.grade.findMany({
          where: { tenantId, deletedAt: null },
          include: {
            student: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = records.map((r) => ({
          Étudiant: `${r.student.firstName} ${r.student.lastName}`,
          Matière: r.subject.name,
          Note: r.value,
          Max: r.maxValue,
          Coefficient: r.coefficient,
          Semestre: r.semester,
        }));
        break;
      }
      case 'payments': {
        headers = ['Étudiant', 'Montant', 'Payé', 'Statut', 'Méthode', 'Date'];
        const records = await this.prisma.payment.findMany({
          where: { tenantId },
          include: {
            student: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = records.map((r) => ({
          Étudiant: `${r.student.firstName} ${r.student.lastName}`,
          Montant: r.amount,
          Payé: r.paidAmount,
          Statut: r.status,
          Méthode: r.paymentMethod || '',
          Date: r.createdAt.toISOString().split('T')[0],
        }));
        break;
      }
      case 'students': {
        headers = ['Prénom', 'Nom', 'Matricule', 'Classe', 'Statut', 'Date inscription'];
        const records = await this.prisma.student.findMany({
          where: { tenantId, deletedAt: null },
          include: { class: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = records.map((r) => ({
          Prénom: r.firstName,
          Nom: r.lastName,
          Matricule: r.registrationNumber,
          Classe: r.class?.name || '',
          Statut: r.status,
          'Date inscription': r.createdAt.toISOString().split('T')[0],
        }));
        break;
      }
      default:
        headers = ['Aucune donnée'];
        rows = [];
    }

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = row[h];
          const str = val != null ? String(val) : '';
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','),
      ),
    ].join('\n');

    return csv;
  }

  private buildDateFilter(period?: string): { createdAt?: { gte: Date } } | Record<string, never> {
    if (!period) return {};
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return {};
    }

    return { createdAt: { gte: start } };
  }
}
