import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GradesService } from '../grades/grades.service';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BulletinsService {
  constructor(
    private prisma: PrismaService,
    private gradesService: GradesService,
  ) {}

  private getStoragePath(tenantId: string, category: string): string {
    return path.join(process.cwd(), 'storage', `tenant_${tenantId}`, category);
  }

  private savePdf(tenantId: string, category: string, fileName: string, buffer: Buffer): string {
    const dir = this.getStoragePath(tenantId, category);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/storage/tenant_${tenantId}/${category}/${fileName}`;
  }

  async generateClassBulletins(classId: string, tenantId: string, userId?: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const students = await this.prisma.student.findMany({
      where: { classId, tenantId, deletedAt: null },
      include: { class: { select: { id: true, name: true } } },
      orderBy: { lastName: 'asc' },
    });

    if (students.length === 0) {
      throw new BadRequestException('Aucun élève dans cette classe');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = tenant?.settings as any

    const documentUrls: string[] = [];

    for (const student of students) {
      const report = await this.gradesService.getStudentReport(student.id, tenantId);
      const pdfBuffer = await this.renderBulletinPdf(student, report, settings);
      
      const fileName = `bulletin-${student.id}-${Date.now()}.pdf`;
      const fileUrl = this.savePdf(tenantId, 'bulletins', fileName, pdfBuffer);
      
      await this.prisma.document.create({
        data: {
          tenantId,
          studentId: student.id,
          category: 'PEDAGOGICAL',
          fileName,
          originalName: `Bulletin - ${student.firstName} ${student.lastName}.pdf`,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
          path: fileUrl,
          uploadedBy: userId || student.id,
        },
      });

      documentUrls.push(fileUrl);
    }

    return {
      message: `${students.length} bulletin(s) généré(s)`,
      count: students.length,
      documents: documentUrls,
    };
  }

  async generateStudentBulletin(studentId: string, tenantId: string, userId?: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: { class: { select: { id: true, name: true } } },
    });
    if (!student) throw new NotFoundException('Étudiant non trouvé');

    const report = await this.gradesService.getStudentReport(studentId, tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = tenant?.settings as any

    const pdfBuffer = await this.renderBulletinPdf(student, report, settings);
    
    const fileName = `bulletin-${student.id}-${Date.now()}.pdf`;
    const fileUrl = this.savePdf(tenantId, 'bulletins', fileName, pdfBuffer);

    await this.prisma.document.create({
      data: {
        tenantId,
        studentId: student.id,
        category: 'PEDAGOGICAL',
        fileName,
        originalName: `Bulletin - ${student.firstName} ${student.lastName}.pdf`,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        path: fileUrl,
        uploadedBy: userId || student.id,
      },
    });

    return {
      fileName,
      url: fileUrl,
      size: pdfBuffer.length,
    };
  }

  private async renderBulletinPdf(student: any, report: any, settings: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const schoolName = settings?.schoolName || 'École';
      const academicYear = settings?.academicYear || new Date().getFullYear().toString();
      
      doc.font('Helvetica');
      
      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(schoolName, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(`Année scolaire ${academicYear}`, { align: 'center' });
      doc.moveDown(1);

      // Title
      doc.fontSize(14).font('Helvetica-Bold').text('BULLETIN SCOLAIRE', { align: 'center' });
      doc.moveDown(1);

      // Student info
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nom: ${student.lastName}`, { continued: false });
      doc.text(`Prénom: ${student.firstName}`, { continued: false });
      doc.text(`Matricule: ${student.registrationNumber}`, { continued: false });
      doc.text(`Classe: ${report.student.class?.name || '-'}`, { continued: false });
      doc.moveDown(1);

      // Grades table
      doc.font('Helvetica-Bold');
      doc.text('Matière', { continued: false });
      doc.text('Note', { continued: false });
      doc.text('Coef.', { continued: false });
      doc.text('Moyenne', { continued: false });
      doc.moveDown(0.3);

      doc.font('Helvetica');
      const bySubject = report.bySubject || [];
      
      for (const item of bySubject) {
        const avg = item.average ? item.average.toFixed(2) : '-';
        doc.text(item.subject?.name || item.subject?.id || '-', { continued: false });
        doc.text(item.count > 0 ? `${item.count} note(s)` : '-', { continued: false });
        doc.text(String(item.subject?.coefficient || 1), { continued: false });
        doc.text(avg, { continued: false });
      }

      doc.moveDown(1);
      doc.font('Helvetica-Bold');
      doc.text(`Moyenne générale: ${(report.averages?.average || 0).toFixed(2)}`, { continued: false });
      doc.text(`Nombre de notes: ${report.averages?.count || 0}`, { continued: false });

      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica').text('Document généré automatiquement', { align: 'center' });

      doc.end();
    });
  }
}
