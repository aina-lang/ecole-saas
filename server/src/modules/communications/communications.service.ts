import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Prisma, MessageStatus } from '@prisma/client';

@Injectable()
export class CommunicationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async send(dto: CreateMessageDto, senderId: string, tenantId: string) {
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        senderId,
        subject: dto.subject,
        body: dto.body,
        priority: dto.priority ?? 'NORMAL',
        recipients: {
          create: dto.recipientIds.map((userId) => ({
            userId,
          })),
        },
        documents: dto.documentIds?.length
          ? { connect: dto.documentIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        recipients: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        documents: { select: { id: true, fileName: true, originalName: true, mimeType: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId: senderId,
      action: 'SEND_MESSAGE',
      entityType: 'Message',
      entityId: message.id,
      newValue: { subject: dto.subject, recipientCount: dto.recipientIds.length },
    });

    return message;
  }

  async getInbox(userId: string, tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.messageRecipient.findMany({
        where: { userId, message: { tenantId } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          message: {
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, email: true } },
              recipients: { select: { userId: true } },
            },
          },
        },
      }),
      this.prisma.messageRecipient.count({ where: { userId, message: { tenantId } } }),
    ]);
    return { data, total, page, limit };
  }

  async getSent(userId: string, tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { senderId: userId, tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          recipients: {
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
          documents: { select: { id: true, fileName: true, originalName: true } },
        },
      }),
      this.prisma.message.count({ where: { senderId: userId, tenantId } }),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string, userId: string, tenantId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipients: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        documents: { select: { id: true, fileName: true, originalName: true, mimeType: true, size: true } },
      },
    });
    if (!message) throw new NotFoundException('Message non trouvé');

    const isSender = message.senderId === userId;
    const isRecipient = message.recipients.some((r) => r.userId === userId);
    if (!isSender && !isRecipient) throw new ForbiddenException('Accès non autorisé à ce message');

    return message;
  }

  async markAsRead(id: string, userId: string, tenantId: string) {
    const recipient = await this.prisma.messageRecipient.findFirst({
      where: { messageId: id, userId, message: { tenantId } },
    });
    if (!recipient) throw new NotFoundException('Message non trouvé dans votre boîte de réception');

    const updated = await this.prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { status: 'READ' as MessageStatus, readAt: new Date() },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'READ_MESSAGE',
      entityType: 'Message',
      entityId: id,
    });

    return updated;
  }

  async archive(id: string, userId: string, tenantId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId, senderId: userId },
    });
    if (!message) throw new NotFoundException('Message non trouvé');

    const updated = await this.prisma.message.update({
      where: { id },
      data: { status: 'ARCHIVED' as MessageStatus },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ARCHIVE_MESSAGE',
      entityType: 'Message',
      entityId: id,
    });

    return updated;
  }

  async getConversation(userId: string, otherUserId: string, tenantId: string) {
    return this.prisma.message.findMany({
      where: {
        tenantId,
        OR: [
          { senderId: userId, recipients: { some: { userId: otherUserId } } },
          { senderId: otherUserId, recipients: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        recipients: { select: { userId: true } },
      },
    });
  }

  async broadcastToClass(classId: string, subject: string, body: string, senderId: string, tenantId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: {
        students: {
          include: {
            parents: { select: { parentId: true } },
          },
        },
      },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const parentIds = new Set<string>();
    for (const student of cls.students) {
      for (const parent of student.parents) {
        parentIds.add(parent.parentId);
      }
    }

    const recipientIds = Array.from(parentIds);

    if (recipientIds.length === 0) {
      throw new NotFoundException('Aucun parent trouvé pour cette classe');
    }

    return this.send({ subject, body, recipientIds }, senderId, tenantId);
  }

  async remove(id: string, userId: string, tenantId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId, senderId: userId },
    });
    if (!message) throw new NotFoundException('Message non trouvé');

    await this.prisma.message.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE_MESSAGE',
      entityType: 'Message',
      entityId: id,
      oldValue: { subject: message.subject },
    });

    return { message: 'Message supprimé' };
  }
}