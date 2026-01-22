import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TagGroup } from '@prisma/client';
import * as ticketIntegrations from './ticketIntegrations.service';

export interface CreateTagDto {
  name: string;
  group: TagGroup;
  isActive?: boolean;
}

export interface UpdateTagDto {
  name?: string;
  group?: TagGroup;
  isActive?: boolean;
}

export interface TagFilters {
  group?: TagGroup;
  search?: string;
  isActive?: boolean;
}

export const tagService = {
  async getAllTags(filters?: TagFilters) {
    logger.debug('Buscando tags', { filters });

    const where: any = {};

    if (filters?.group) {
      where.group = filters.group;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.name = {
        contains: filters.search.toLowerCase(),
        mode: 'insensitive',
      };
    }

    const tags = await prisma.tag.findMany({
      where,
      orderBy: [
        { group: 'asc' },
        { name: 'asc' },
      ],
    });

    return tags;
  },

  async getTagById(id: string) {
    const tag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new AppError('Tag não encontrada', 404);
    }

    return tag;
  },

  async createTag(data: CreateTagDto) {
    logger.debug('Criando tag', { name: data.name, group: data.group });

    // Normalizar nome da tag (minúsculas, snake_case)
    const normalizedName = data.name.toLowerCase().trim().replace(/\s+/g, '_');

    // Verificar se já existe
    const existing = await prisma.tag.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new AppError('Tag com este nome já existe', 400);
    }

    const tag = await prisma.tag.create({
      data: {
        name: normalizedName,
        group: data.group,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    logger.info('Tag criada', { tagId: tag.id, name: tag.name });
    return tag;
  },

  async updateTag(id: string, data: UpdateTagDto) {
    logger.debug('Atualizando tag', { tagId: id, data });

    const tag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new AppError('Tag não encontrada', 404);
    }

    const updateData: any = {};

    if (data.name !== undefined) {
      // Normalizar nome
      const normalizedName = data.name.toLowerCase().trim().replace(/\s+/g, '_');
      
      // Verificar se o novo nome já existe (exceto para a própria tag)
      if (normalizedName !== tag.name) {
        const existing = await prisma.tag.findUnique({
          where: { name: normalizedName },
        });

        if (existing) {
          throw new AppError('Tag com este nome já existe', 400);
        }
      }

      updateData.name = normalizedName;
    }

    if (data.group !== undefined) {
      updateData.group = data.group;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: updateData,
    });

    logger.info('Tag atualizada', { tagId: id });
    return updated;
  },

  async deleteTag(id: string) {
    logger.debug('Deletando tag', { tagId: id });

    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        tickets: {
          take: 1,
        },
      },
    });

    if (!tag) {
      throw new AppError('Tag não encontrada', 404);
    }

    // Se a tag está associada a tickets, desativar ao invés de deletar
    if (tag.tickets.length > 0) {
      const updated = await prisma.tag.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info('Tag desativada (está associada a tickets)', { tagId: id });
      return updated;
    }

    // Se não está associada, deletar
    const deleted = await prisma.tag.delete({
      where: { id },
    });
    
    logger.info('Tag deletada', { tagId: id });
    return deleted;

    logger.info('Tag deletada', { tagId: id });
  },

  async getTagsByGroup(group: TagGroup) {
    return this.getAllTags({ group, isActive: true });
  },

  async getTagsForTicket(ticketId: string) {
    const ticketTags = await prisma.ticketTag.findMany({
      where: { ticketId },
      include: {
        tag: true,
      },
      orderBy: {
        tag: {
          group: 'asc',
        },
      },
    });

    return ticketTags.map((tt) => tt.tag);
  },

  async addTagsToTicket(ticketId: string, tagIds: string[], userId?: string) {
    logger.debug('Adicionando tags ao ticket', { ticketId, tagIds });

    // Verificar se o ticket existe
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError('Ticket não encontrado', 404);
    }

    // Verificar se as tags existem e estão ativas
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
        isActive: true,
      },
    });

    if (tags.length !== tagIds.length) {
      throw new AppError('Uma ou mais tags não foram encontradas ou estão inativas', 400);
    }

    // Criar associações (ignorar duplicatas)
    await prisma.ticketTag.createMany({
      data: tagIds.map((tagId) => ({
        ticketId,
        tagId,
      })),
      skipDuplicates: true,
    });

    // Registrar eventos de tags adicionadas
    if (userId) {
      for (const tagId of tagIds) {
        await ticketIntegrations.recordTagAdded(ticketId, userId, tagId);
      }
    }

    logger.info('Tags adicionadas ao ticket', { ticketId, count: tagIds.length });
    return this.getTagsForTicket(ticketId);
  },

  async removeTagFromTicket(ticketId: string, tagId: string, userId?: string) {
    logger.debug('Removendo tag do ticket', { ticketId, tagId });

    await prisma.ticketTag.deleteMany({
      where: {
        ticketId,
        tagId,
      },
    });

    // Registrar evento de tag removida
    if (userId) {
      await ticketIntegrations.recordTagRemoved(ticketId, userId, tagId);
    }

    logger.info('Tag removida do ticket', { ticketId, tagId });
  },
};

