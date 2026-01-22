import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  TechnicianJournalEntryType,
  TicketStatus,
  TicketWorklog,
  Ticket,
  TicketComment,
} from '@prisma/client';

export interface CreateManualEntryDto {
  title?: string;
  description: string;
  contentHtml?: string; // Conteúdo rico em HTML
  tagIds?: string[]; // IDs das tags da plataforma
}

export interface JournalEntryFilters {
  from?: Date;
  to?: Date;
  ticketId?: string;
  types?: TechnicianJournalEntryType[];
  searchText?: string;
  tagIds?: string[]; // Filtro por tags
  page?: number;
  pageSize?: number;
}

export interface JournalEntryDTO {
  id: string;
  technicianId: string;
  type: TechnicianJournalEntryType;
  ticketId?: string | null;
  worklogId?: string | null;
  commentId?: string | null;
  title?: string | null;
  description: string;
  contentHtml?: string | null;
  createdAt: Date;
  updatedAt: Date;
  source?: string | null;
  tags: Array<{
    id: string;
    name: string;
    group: string;
  }>;
  ticket?: {
    id: string;
    title: string;
    status: TicketStatus;
  } | null;
  worklog?: {
    id: string;
    durationMinutes: number;
    description?: string | null;
  } | null;
  comment?: {
    id: string;
    content: string;
    createdAt: Date;
  } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    filePath: string;
    fileSize?: number | null;
    mimeType?: string | null;
    url: string;
  }>;
}

export interface DailySummaryDTO {
  date: Date;
  ticketsWorked: number;
  totalWorkMinutes?: number | null;
  entriesCount: number;
}

export interface JournalSummaryResponse {
  daily: DailySummaryDTO[];
  aggregates: {
    totalTicketsWorked: number;
    totalWorkMinutes: number;
    totalJournalEntries: number;
  };
}

export const technicianJournalService = {
  /**
   * Cria uma entrada manual no diário do técnico
   */
  async createManualEntry(
    technicianId: string,
    payload: CreateManualEntryDto,
    attachments?: Array<{
      fileName: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
    }>
  ) {
    logger.debug('Criando entrada manual no diário', {
      technicianId,
      hasTitle: !!payload.title,
      hasContentHtml: !!payload.contentHtml,
      attachmentsCount: attachments?.length || 0,
    });

    const entry = await prisma.technicianJournalEntry.create({
      data: {
        technicianId,
        type: TechnicianJournalEntryType.MANUAL,
        title: payload.title,
        description: payload.description,
        contentHtml: payload.contentHtml,
        source: 'manual',
        tags: payload.tagIds && payload.tagIds.length > 0
          ? {
              create: payload.tagIds.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
        attachments: attachments
          ? {
              create: attachments.map((att) => ({
                fileName: att.fileName,
                filePath: att.filePath,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Atualizar ou criar summary do dia
    await this.updateDailySummary(technicianId, new Date());

    logger.info('Entrada manual criada no diário', {
      entryId: entry.id,
      technicianId,
      attachmentsCount: entry.attachments.length,
    });
    return entry;
  },

  /**
   * Cria entrada automática quando um worklog é registrado
   */
  async createAutoEntryForWorklog(worklog: TicketWorklog, ticket: Ticket, technicianId: string) {
    try {
      logger.debug('Criando entrada automática para worklog', {
        worklogId: worklog.id,
        ticketId: ticket.id,
        technicianId,
      });

      // Formatar descrição legível
      const hours = Math.floor(worklog.durationMinutes / 60);
      const minutes = worklog.durationMinutes % 60;
      const durationText =
        hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

      let description = `Trabalhei neste ticket por ${durationText}`;
      if (worklog.description) {
        description += `: ${worklog.description}`;
      } else {
        description += ': registro de tempo trabalhado.';
      }

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_TICKET_WORKLOG,
          ticketId: ticket.id,
          worklogId: worklog.id,
          description,
          source: 'worklog',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de worklog criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      // Não quebrar o fluxo principal se houver erro no diário
      logger.error('Erro ao criar entrada automática de worklog no diário', {
        error: error instanceof Error ? error.message : String(error),
        worklogId: worklog.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Cria entrada automática quando status do ticket muda
   */
  async createAutoEntryForStatusChange(
    ticket: Ticket,
    technicianId: string,
    previousStatus: TicketStatus | null,
    newStatus: TicketStatus
  ) {
    try {
      // Criar entrada para o técnico responsável pelo ticket
      // Verificar se o ticket tem técnico atribuído
      if (!ticket.assignedTechnicianId) {
        logger.debug('Ticket não tem técnico atribuído, não criando entrada no diário', {
          ticketId: ticket.id,
          technicianId,
        });
        return null;
      }
      
      // Verificar se o technicianId passado corresponde ao técnico atribuído
      // Isso garante que só criamos entrada no diário do técnico correto
      if (ticket.assignedTechnicianId !== technicianId) {
        logger.debug('Técnico não corresponde ao atribuído, não criando entrada no diário', {
          ticketId: ticket.id,
          technicianId,
          assignedTechnicianId: ticket.assignedTechnicianId,
        });
        return null;
      }

      logger.debug('Criando entrada automática para mudança de status', {
        ticketId: ticket.id,
        technicianId,
        previousStatus,
        newStatus,
      });

      const statusLabels: Record<TicketStatus, string> = {
        OPEN: 'Aberto',
        IN_PROGRESS: 'Em Progresso',
        WAITING_REQUESTER: 'Aguardando Solicitante',
        WAITING_THIRD_PARTY: 'Aguardando Terceiros',
        RESOLVED: 'Resolvido',
        CLOSED: 'Fechado',
      };

      const previousLabel = previousStatus ? statusLabels[previousStatus] : 'N/A';
      const newLabel = statusLabels[newStatus];

      const description = previousStatus
        ? `Alterei status do ticket #${ticket.id.substring(0, 8)} de ${previousLabel} para ${newLabel}.`
        : `Alterei status do ticket #${ticket.id.substring(0, 8)} para ${newLabel}.`;

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_TICKET_STATUS,
          ticketId: ticket.id,
          description,
          source: 'status_change',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de mudança de status criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      // Não quebrar o fluxo principal se houver erro no diário
      logger.error('Erro ao criar entrada automática de mudança de status no diário', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: ticket.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Normaliza HTML para texto limpo
   */
  stripHtml(html: string): string {
    if (!html) return '';
    
    // Remove tags HTML
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, '') // Remove todas as tags HTML
      .replace(/&nbsp;/g, ' ') // Substitui &nbsp; por espaço
      .replace(/&amp;/g, '&') // Decodifica &amp;
      .replace(/&lt;/g, '<') // Decodifica &lt;
      .replace(/&gt;/g, '>') // Decodifica &gt;
      .replace(/&quot;/g, '"') // Decodifica &quot;
      .replace(/&#39;/g, "'") // Decodifica &#39;
      .replace(/&[a-z]+;/gi, '') // Remove outras entidades HTML
      .trim();
    
    // Remove espaços múltiplos
    text = text.replace(/\s+/g, ' ');
    
    return text;
  },

  /**
   * Cria entrada automática quando um comentário é adicionado
   */
  async createAutoEntryForComment(
    comment: TicketComment & { author?: { id: string; name: string; email: string; role: string } | null },
    ticket: Ticket,
    technicianId: string
  ) {
    try {
      logger.debug('Criando entrada automática para comentário', {
        commentId: comment.id,
        ticketId: ticket.id,
        technicianId,
      });

      // Formatar descrição legível - normalizar HTML para texto limpo
      let description = `Comentei no ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`;
      if (comment.content) {
        // Normalizar HTML para texto limpo
        const cleanContent = this.stripHtml(comment.content);
        // Limitar tamanho do conteúdo na descrição
        const contentPreview = cleanContent.length > 200 
          ? cleanContent.substring(0, 200) + '...' 
          : cleanContent;
        if (contentPreview.trim()) {
          description += `: ${contentPreview}`;
        }
      }

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_TICKET_COMMENT,
          ticketId: ticket.id,
          commentId: comment.id,
          description,
          source: 'comment',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de comentário criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      // Não quebrar o fluxo principal se houver erro no diário
      logger.error('Erro ao criar entrada automática de comentário no diário', {
        error: error instanceof Error ? error.message : String(error),
        commentId: comment.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Cria entrada automática quando um ticket é atribuído a um técnico
   */
  async createAutoEntryForAssignment(
    ticket: Ticket,
    technicianId: string,
    assignedBy: string,
    wasAssigned: boolean
  ) {
    try {
      logger.debug('Criando entrada automática para atribuição', {
        ticketId: ticket.id,
        technicianId,
        assignedBy,
        wasAssigned,
      });

      // Se o técnico atribuiu para si mesmo, é "assumir", senão é "atribuído"
      const isSelfAssignment = assignedBy === technicianId;
      const description = isSelfAssignment
        ? `Assumi o ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`
        : `Fui atribuído ao ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`;

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_OTHER,
          ticketId: ticket.id,
          description,
          source: 'assignment',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de atribuição criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      logger.error('Erro ao criar entrada automática de atribuição no diário', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: ticket.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Cria entrada automática quando prioridade de ticket muda
   */
  async createAutoEntryForPriorityChange(
    ticket: Ticket,
    technicianId: string,
    oldPriority: string,
    newPriority: string
  ) {
    try {
      // Só criar entrada se o técnico for o responsável pelo ticket
      if (ticket.assignedTechnicianId !== technicianId) {
        return null;
      }

      logger.debug('Criando entrada automática para mudança de prioridade', {
        ticketId: ticket.id,
        technicianId,
        oldPriority,
        newPriority,
      });

      const priorityLabels: Record<string, string> = {
        LOW: 'Baixa',
        MEDIUM: 'Média',
        HIGH: 'Alta',
        CRITICAL: 'Crítica',
      };

      const oldLabel = priorityLabels[oldPriority] || oldPriority;
      const newLabel = priorityLabels[newPriority] || newPriority;

      const description = `Prioridade do ticket #${ticket.id.substring(0, 8)} - ${ticket.title} alterada de ${oldLabel} para ${newLabel}.`;

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_OTHER,
          ticketId: ticket.id,
          description,
          source: 'priority_change',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de mudança de prioridade criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      logger.error('Erro ao criar entrada automática de mudança de prioridade no diário', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: ticket.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Cria entrada automática quando um ticket é criado por um técnico
   */
  async createAutoEntryForTicketCreated(
    ticket: Ticket,
    technicianId: string
  ) {
    try {
      logger.debug('Criando entrada automática para ticket criado', {
        ticketId: ticket.id,
        technicianId,
      });

      const description = `Criei o ticket #${ticket.id.substring(0, 8)} - ${ticket.title}`;

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_OTHER,
          ticketId: ticket.id,
          description,
          source: 'ticket_created',
        },
      });

      // Atualizar summary do dia
      await this.updateDailySummary(technicianId, new Date());

      logger.debug('Entrada automática de ticket criado criada', { entryId: entry.id });
      return entry;
    } catch (error) {
      logger.error('Erro ao criar entrada automática de ticket criado no diário', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: ticket.id,
        technicianId,
      });
      return null;
    }
  },

  /**
   * Cria entrada automática para alterações administrativas do ticket
   */
  async createAutoEntryForMetadataChange(
    ticket: Ticket,
    technicianId: string,
    description: string,
    source: string
  ) {
    try {
      if (ticket.assignedTechnicianId !== technicianId) {
        return null;
      }

      const entry = await prisma.technicianJournalEntry.create({
        data: {
          technicianId,
          type: TechnicianJournalEntryType.AUTO_OTHER,
          ticketId: ticket.id,
          description,
          source,
        },
      });

      await this.updateDailySummary(technicianId, new Date());
      return entry;
    } catch (error) {
      logger.error('Erro ao criar entrada automática no diário', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: ticket.id,
        technicianId,
        source,
      });
      return null;
    }
  },

  /**
   * Busca entradas do diário do técnico com filtros
   */
  async getJournalEntriesForTechnician(
    technicianId: string,
    filters: JournalEntryFilters
  ): Promise<{ entries: JournalEntryDTO[]; pagination?: { page: number; pageSize: number; totalCount: number } }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: any = {
      technicianId,
    };

    // Filtro de data
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        // Adicionar 1 dia para incluir o dia completo
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Filtro de ticket
    if (filters.ticketId) {
      where.ticketId = filters.ticketId;
    }

    // Filtro de tipos
    if (filters.types && filters.types.length > 0) {
      where.type = { in: filters.types };
    }

    // Filtro de texto (busca em title e description)
    if (filters.searchText) {
      where.OR = [
        { title: { contains: filters.searchText, mode: 'insensitive' } },
        { description: { contains: filters.searchText, mode: 'insensitive' } },
      ];
    }

    // Filtro por tags
    if (filters.tagIds && filters.tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: filters.tagIds },
        },
      };
    }

    // Contar total
    const totalCount = await prisma.technicianJournalEntry.count({ where });

    // Buscar entradas
    const entries = await prisma.technicianJournalEntry.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        worklog: {
          select: {
            id: true,
            durationMinutes: true,
            description: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                group: true,
              },
            },
          },
        },
        attachments: {
          orderBy: {
            uploadedAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    const entriesDTO: JournalEntryDTO[] = entries.map((entry) => ({
      id: entry.id,
      technicianId: entry.technicianId,
      type: entry.type,
      ticketId: entry.ticketId,
      worklogId: entry.worklogId,
      commentId: entry.commentId,
      title: entry.title,
      description: entry.description,
      contentHtml: entry.contentHtml,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      source: entry.source,
      tags: entry.tags.map((jt) => ({
        id: jt.tag.id,
        name: jt.tag.name,
        group: jt.tag.group,
      })),
      ticket: entry.ticket,
      worklog: entry.worklog,
      comment: entry.comment,
      attachments: entry.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        filePath: att.filePath,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        url: `/uploads/journal/${att.filePath}`,
      })),
    }));

    return {
      entries: entriesDTO,
      pagination: {
        page,
        pageSize,
        totalCount,
      },
    };
  },

  /**
   * Busca resumo diário do técnico
   */
  async getDailySummaryForTechnician(
    technicianId: string,
    from: Date,
    to: Date
  ): Promise<JournalSummaryResponse> {
    // Normalizar datas para meia-noite
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Buscar summaries existentes
    const summaries = await prisma.technicianDailySummary.findMany({
      where: {
        technicianId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Buscar worklogs do período para calcular totalWorkMinutes
    const worklogs = await prisma.ticketWorklog.findMany({
      where: {
        userId: technicianId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        createdAt: true,
        durationMinutes: true,
        ticketId: true,
      },
    });

    // Buscar entradas do diário do período
    const entries = await prisma.technicianJournalEntry.findMany({
      where: {
        technicianId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        createdAt: true,
        ticketId: true,
      },
    });

    // Agrupar por dia
    const dailyMap = new Map<string, DailySummaryDTO>();

    // Inicializar todos os dias do período
    const currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyMap.set(dateKey, {
        date: new Date(currentDate),
        ticketsWorked: 0,
        totalWorkMinutes: 0,
        entriesCount: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Preencher com summaries existentes
    summaries.forEach((summary) => {
      const dateKey = summary.date.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey);
      if (existing) {
        existing.ticketsWorked = summary.ticketsWorked;
        existing.totalWorkMinutes = summary.totalWorkMinutes || 0;
        existing.entriesCount = summary.entriesCount;
      }
    });

    // Adicionar worklogs
    worklogs.forEach((worklog) => {
      const dateKey = worklog.createdAt.toISOString().split('T')[0];
      const day = dailyMap.get(dateKey);
      if (day) {
        day.totalWorkMinutes = (day.totalWorkMinutes || 0) + worklog.durationMinutes;
        if (worklog.ticketId && !day.ticketsWorked) {
          // Contar tickets únicos trabalhados no dia
          const uniqueTickets = new Set(
            worklogs
              .filter((w) => w.createdAt.toISOString().split('T')[0] === dateKey)
              .map((w) => w.ticketId)
          );
          day.ticketsWorked = uniqueTickets.size;
        }
      }
    });

    // Adicionar entradas
    entries.forEach((entry) => {
      const dateKey = entry.createdAt.toISOString().split('T')[0];
      const day = dailyMap.get(dateKey);
      if (day) {
        day.entriesCount += 1;
      }
    });

    // Calcular totais
    const daily = Array.from(dailyMap.values());
    const totalTicketsWorked = new Set(entries.filter((e) => e.ticketId).map((e) => e.ticketId)).size;
    const totalWorkMinutes = worklogs.reduce((sum, w) => sum + w.durationMinutes, 0);
    const totalJournalEntries = entries.length;

    return {
      daily,
      aggregates: {
        totalTicketsWorked,
        totalWorkMinutes,
        totalJournalEntries,
      },
    };
  },

  /**
   * Atualiza ou cria summary diário para um técnico
   */
  async updateDailySummary(technicianId: string, date: Date) {
    try {
      const dateKey = new Date(date);
      dateKey.setHours(0, 0, 0, 0);

      // Contar tickets únicos trabalhados no dia
      const worklogs = await prisma.ticketWorklog.findMany({
        where: {
          userId: technicianId,
          createdAt: {
            gte: dateKey,
            lt: new Date(dateKey.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        select: {
          ticketId: true,
          durationMinutes: true,
        },
      });

      const uniqueTickets = new Set(worklogs.map((w) => w.ticketId));
      const totalWorkMinutes = worklogs.reduce((sum, w) => sum + w.durationMinutes, 0);

      // Contar entradas do diário no dia
      const entriesCount = await prisma.technicianJournalEntry.count({
        where: {
          technicianId,
          createdAt: {
            gte: dateKey,
            lt: new Date(dateKey.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      await prisma.technicianDailySummary.upsert({
        where: {
          technicianId_date: {
            technicianId,
            date: dateKey,
          },
        },
        create: {
          technicianId,
          date: dateKey,
          ticketsWorked: uniqueTickets.size,
          totalWorkMinutes,
          entriesCount,
        },
        update: {
          ticketsWorked: uniqueTickets.size,
          totalWorkMinutes,
          entriesCount,
        },
      });
    } catch (error) {
      logger.error('Erro ao atualizar summary diário', {
        error: error instanceof Error ? error.message : String(error),
        technicianId,
        date,
      });
    }
  },
};

