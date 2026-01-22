import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import * as ticketIntegrations from './ticketIntegrations.service';

export interface CreateAttachmentDto {
  ticketId: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedById: string;
}

export const attachmentService = {
  async createAttachment(data: CreateAttachmentDto) {
    logger.debug('Criando anexo', { ticketId: data.ticketId, fileName: data.fileName });

    const attachment = await prisma.ticketAttachment.create({
      data,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info('Anexo criado', { attachmentId: attachment.id, ticketId: data.ticketId });

    // Registrar evento de anexo adicionado (apenas se não for de comentário)
    if (!attachment.commentId) {
      await ticketIntegrations.recordAttachmentAdded(data.ticketId, data.uploadedById, attachment.id);
    }

    return attachment;
  },

  async getTicketAttachments(ticketId: string) {
    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId, commentId: null }, // Apenas anexos do ticket, não dos comentários
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { uploadedAt: 'asc' },
    });

    // Adicionar URL pública para cada anexo
    return attachments.map((att) => ({
      ...att,
      url: `/uploads/tickets/${att.filePath}`,
    }));
  },

  async getCommentAttachments(commentId: string) {
    const attachments = await prisma.ticketAttachment.findMany({
      where: { commentId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { uploadedAt: 'asc' },
    });

    // Adicionar URL pública para cada anexo
    return attachments.map((att) => ({
      ...att,
      url: `/uploads/tickets/${att.filePath}`,
    }));
  },

  async deleteAttachment(attachmentId: string, userId: string) {
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new AppError('Anexo não encontrado', 404);
    }

    // Verificar permissão (apenas quem fez upload ou admin pode deletar)
    // Por enquanto, permitir apenas quem fez upload
    if (attachment.uploadedById !== userId) {
      throw new AppError('Acesso negado', 403);
    }

    await prisma.ticketAttachment.delete({
      where: { id: attachmentId },
    });

    // Registrar evento de anexo removido (apenas se não for de comentário)
    if (!attachment.commentId) {
      await ticketIntegrations.recordAttachmentRemoved(attachment.ticketId, userId, attachmentId);
    }

    logger.info('Anexo deletado', { attachmentId, userId });
  },
};

