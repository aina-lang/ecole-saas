import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { DocumentCategory } from '@prisma/client';

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

  private getStoragePath(tenantId: string): string {
    return path.join(process.cwd(), 'storage', `tenant_${tenantId}`);
  }

  async uploadFile(
    file: Express.Multer.File,
    tenantId: string,
    metadata: { category: string; studentId?: string; messageId?: string; uploadedBy: string },
  ) {
    const category = metadata.category || 'OTHER';
    const tenantDir = this.getStoragePath(tenantId);
    const categoryDir = path.join(tenantDir, category);

    fs.mkdirSync(categoryDir, { recursive: true });

    const uuid = randomUUID();
    const fileName = `${uuid}-${file.originalname}`;
    const filePath = path.join(categoryDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const document = await this.prisma.document.create({
      data: {
        tenantId,
        studentId: metadata.studentId || null,
        messageId: metadata.messageId || null,
        category: category as DocumentCategory,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        uploadedBy: metadata.uploadedBy,
      },
    });

    return document;
  }

  async getDocument(id: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!doc) throw new NotFoundException('Document non trouvé');

    if (!fs.existsSync(doc.path)) {
      throw new NotFoundException('Fichier introuvable sur le disque');
    }

    const stream = createReadStream(doc.path);
    return {
      stream: new StreamableFile(stream, {
        type: doc.mimeType,
        disposition: `inline; filename="${doc.originalName}"`,
      }),
      metadata: doc,
    };
  }

  async deleteDocument(id: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!doc) throw new NotFoundException('Document non trouvé');

    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Document supprimé' };
  }

  async getStorageUsage(tenantId: string) {
    const result = await this.prisma.document.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { size: true },
      _count: true,
    });

    return {
      totalBytes: result._sum.size || 0,
      totalFiles: result._count,
    };
  }
}
