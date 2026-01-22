# Implementação do Módulo Diário do Técnico

Este documento contém o conteúdo completo de todos os arquivos necessários para implementar o módulo "Diário do Técnico" (Technician Journal).

## Arquivos a Criar/Modificar

### 1. Backend - Schema Prisma (JÁ ATUALIZADO)
✅ `backend/prisma/schema.prisma` - Modelos TechnicianJournalEntry e TechnicianDailySummary adicionados

### 2. Backend - Serviço Principal
📝 **CRIAR:** `backend/src/services/technicianJournal.service.ts`

```typescript
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { TechnicianJournalEntryType, TicketStatus, TicketWorklog, Ticket } from '@prisma/client';

export interface CreateManualEntryDto {
  title?: string;
  description: string;
  tags?: string[];
}

export interface JournalEntryFilters {
  from?: Date;
  to?: Date;
  ticketId?: string;
  types?: TechnicianJournalEntryType[];
  searchText?: string;
  page?: number;
  pageSize?: number;
}

export interface JournalEntryDTO {
  id: string;
  technicianId: string;
  type: TechnicianJournalEntryType;
  ticketId?: string | null;
  worklogId?: string | null;
  title?: string | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  source?: string | null;
  tags: string[];
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
  async createManualEntry(technicianId: string, payload: CreateManualEntryDto) {
    logger.debug('Criando entrada manual no diário', { technicianId, hasTitle: !!payload.title });

    const entry = await prisma.technicianJournalEntry.create({
      data: {
        technicianId,
        type: TechnicianJournalEntryType.MANUAL,
        title: payload.title,
        description: payload.description,
        tags: payload.tags || [],
        source: 'manual',
      },
    });

    // Atualizar ou criar summary do dia
    await this.updateDailySummary(technicianId, new Date());

    logger.info('Entrada manual criada no diário', { entryId: entry.id, technicianId });
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
          tags: [],
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
      // Só criar entrada se o técnico for o responsável pelo ticket
      if (ticket.assignedTechnicianId !== technicianId) {
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
          tags: [],
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
      title: entry.title,
      description: entry.description,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      source: entry.source,
      tags: entry.tags,
      ticket: entry.ticket,
      worklog: entry.worklog,
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
```

### 3. Backend - Controller
📝 **CRIAR:** `backend/src/controllers/technicianJournal.controller.ts`

```typescript
import { Request, Response } from 'express';
import { technicianJournalService } from '../services/technicianJournal.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { TechnicianJournalEntryType } from '@prisma/client';

const createManualEntrySchema = z.object({
  title: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  tags: z.array(z.string()).optional(),
});

export const technicianJournalController = {
  /**
   * GET /api/me/journal
   * Lista entradas do diário do técnico autenticado
   */
  async getMyJournal(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const filters: any = {};
      
      if (req.query.from) {
        filters.from = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filters.to = new Date(req.query.to as string);
      }
      if (req.query.ticketId) {
        filters.ticketId = req.query.ticketId as string;
      }
      if (req.query.types) {
        const types = Array.isArray(req.query.types) 
          ? req.query.types 
          : [req.query.types];
        filters.types = types.map((t) => t as TechnicianJournalEntryType);
      }
      if (req.query.searchText) {
        filters.searchText = req.query.searchText as string;
      }
      if (req.query.page) {
        filters.page = parseInt(req.query.page as string, 10);
      }
      if (req.query.pageSize) {
        filters.pageSize = parseInt(req.query.pageSize as string, 10);
      }

      const result = await technicianJournalService.getJournalEntriesForTechnician(
        req.userId,
        filters
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Erro ao buscar diário do técnico', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar diário' });
    }
  },

  /**
   * POST /api/me/journal/manual
   * Cria uma entrada manual no diário
   */
  async createManualEntry(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const data = createManualEntrySchema.parse(req.body);
      const entry = await technicianJournalService.createManualEntry(req.userId, data);
      
      res.status(201).json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        logger.error('Erro ao criar entrada manual no diário', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar entrada no diário' });
      }
    }
  },

  /**
   * GET /api/me/journal/summary
   * Busca resumo diário do técnico
   */
  async getMyJournalSummary(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const from = req.query.from as string;
      const to = req.query.to as string;

      if (!from || !to) {
        return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' });
      }

      const summary = await technicianJournalService.getDailySummaryForTechnician(
        req.userId,
        new Date(from),
        new Date(to)
      );

      res.json(summary);
    } catch (error: any) {
      logger.error('Erro ao buscar resumo do diário', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar resumo do diário' });
    }
  },
};
```

### 4. Backend - Rotas
📝 **CRIAR:** `backend/src/routes/technicianJournal.routes.ts`

```typescript
import { Router } from 'express';
import { technicianJournalController } from '../controllers/technicianJournal.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

router.get('/me/journal', technicianJournalController.getMyJournal);
router.post('/me/journal/manual', technicianJournalController.createManualEntry);
router.get('/me/journal/summary', technicianJournalController.getMyJournalSummary);

export { router as technicianJournalRoutes };
```

### 5. Backend - Métricas Pessoais
📝 **ADICIONAR ao:** `backend/src/services/enterpriseMetrics.service.ts`

Adicionar método:

```typescript
/**
 * Calcula métricas pessoais de um técnico
 */
async getTechnicianMetrics(
  technicianId: string,
  filters: { from?: Date; to?: Date; businessHours?: boolean }
): Promise<{
  totalTicketsAssigned: number;
  totalTicketsResolved: number;
  mtta: number | null;
  mttr: number | null;
  slaCompliancePercent: number;
  reopenRatePercent: number;
}> {
  const startDate = filters.from;
  const endDate = filters.to;
  const useBusinessHours = filters.businessHours === true;

  const where: any = {
    assignedTechnicianId: technicianId,
  };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) {
      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  // Total de tickets atribuídos
  const totalTicketsAssigned = await prisma.ticket.count({ where });

  // Total de tickets resolvidos
  const totalTicketsResolved = await prisma.ticket.count({
    where: {
      ...where,
      status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
    },
  });

  // Buscar calendário se necessário
  let businessCalendar = null;
  if (useBusinessHours) {
    try {
      businessCalendar = await businessCalendarService.getDefaultCalendar();
    } catch (error) {
      logger.warn('Não foi possível carregar calendário de negócio', { error });
    }
  }

  // Calcular MTTA
  const ticketsForMtta = await prisma.ticket.findMany({
    where: {
      ...where,
      firstResponseAt: { not: null },
    },
    select: {
      createdAt: true,
      firstResponseAt: true,
      firstResponseBusinessMinutes: true,
    },
  });

  let mtta: number | null = null;
  if (ticketsForMtta.length > 0) {
    if (useBusinessHours) {
      const minutes = ticketsForMtta
        .map((t) => t.firstResponseBusinessMinutes || 0)
        .filter((m) => m > 0);
      if (minutes.length > 0) {
        mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    } else {
      const minutes = ticketsForMtta.map((t) =>
        diffInCalendarMinutes(t.createdAt, t.firstResponseAt!)
      );
      mtta = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    }
  }

  // Calcular MTTR
  const ticketsForMttr = await prisma.ticket.findMany({
    where: {
      ...where,
      resolvedAt: { not: null },
    },
    select: {
      createdAt: true,
      resolvedAt: true,
      resolutionBusinessMinutes: true,
    },
  });

  let mttr: number | null = null;
  if (ticketsForMttr.length > 0) {
    if (useBusinessHours) {
      const minutes = ticketsForMttr
        .map((t) => t.resolutionBusinessMinutes || 0)
        .filter((m) => m > 0);
      if (minutes.length > 0) {
        mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
      }
    } else {
      const minutes = ticketsForMttr.map((t) =>
        diffInCalendarMinutes(t.createdAt, t.resolvedAt!)
      );
      mttr = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    }
  }

  // Calcular SLA compliance
  const slaStats = await prisma.ticketSlaStats.findMany({
    where: {
      ticket: where,
    },
    select: {
      breached: true,
    },
  });
  const slaCompliancePercent =
    slaStats.length > 0
      ? (slaStats.filter((s) => !s.breached).length / slaStats.length) * 100
      : 0;

  // Calcular taxa de reabertura
  const resolvedTickets = await prisma.ticket.findMany({
    where: {
      ...where,
      status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
    },
    select: { id: true },
  });
  const reopenedCount = await prisma.ticketEvent.count({
    where: {
      ticketId: { in: resolvedTickets.map((t) => t.id) },
      eventType: 'STATUS_CHANGED',
      newValue: { path: ['status'], equals: 'OPEN' },
    },
  });
  const reopenRatePercent =
    resolvedTickets.length > 0 ? (reopenedCount / resolvedTickets.length) * 100 : 0;

  return {
    totalTicketsAssigned,
    totalTicketsResolved,
    mtta,
    mttr,
    slaCompliancePercent,
    reopenRatePercent,
  };
}
```

📝 **CRIAR:** `backend/src/controllers/technicianMetrics.controller.ts`

```typescript
import { Request, Response } from 'express';
import { enterpriseMetricsService } from '../services/enterpriseMetrics.service';
import { logger } from '../utils/logger';

export const technicianMetricsController = {
  /**
   * GET /api/me/metrics
   * Retorna métricas pessoais do técnico autenticado
   */
  async getMyMetrics(req: Request, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      const businessHours = req.query.businessHours === 'true';

      const metrics = await enterpriseMetricsService.getTechnicianMetrics(req.userId, {
        from,
        to,
        businessHours,
      });

      res.json(metrics);
    } catch (error: any) {
      logger.error('Erro ao buscar métricas pessoais', { error: error.message });
      res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
  },
};
```

📝 **ADICIONAR rota em:** `backend/src/routes/technicianJournal.routes.ts`

```typescript
import { technicianMetricsController } from '../controllers/technicianMetrics.controller';

// Adicionar após as outras rotas:
router.get('/me/metrics', technicianMetricsController.getMyMetrics);
```

### 6. Backend - Registrar Rotas
📝 **MODIFICAR:** `backend/src/index.ts`

Adicionar após as outras importações de rotas:

```typescript
import { technicianJournalRoutes } from './routes/technicianJournal.routes';
```

E registrar a rota:

```typescript
app.use('/api', technicianJournalRoutes);
```

### 7. Frontend - Serviço de API
📝 **CRIAR:** `frontend/src/services/journal.service.ts`

```typescript
import { api } from './api';

export interface JournalEntry {
  id: string;
  technicianId: string;
  type: 'MANUAL' | 'AUTO_TICKET_WORKLOG' | 'AUTO_TICKET_STATUS' | 'AUTO_OTHER';
  ticketId?: string | null;
  worklogId?: string | null;
  title?: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  source?: string | null;
  tags: string[];
  ticket?: {
    id: string;
    title: string;
    status: string;
  } | null;
  worklog?: {
    id: string;
    durationMinutes: number;
    description?: string | null;
  } | null;
}

export interface JournalSummary {
  daily: Array<{
    date: string;
    ticketsWorked: number;
    totalWorkMinutes?: number | null;
    entriesCount: number;
  }>;
  aggregates: {
    totalTicketsWorked: number;
    totalWorkMinutes: number;
    totalJournalEntries: number;
  };
}

export interface TechnicianMetrics {
  totalTicketsAssigned: number;
  totalTicketsResolved: number;
  mtta: number | null;
  mttr: number | null;
  slaCompliancePercent: number;
  reopenRatePercent: number;
}

export const journalService = {
  async getMyJournal(params: {
    from?: string;
    to?: string;
    ticketId?: string;
    types?: string[];
    searchText?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ entries: JournalEntry[]; pagination?: { page: number; pageSize: number; totalCount: number } }> {
    const response = await api.get('/me/journal', { params });
    return response.data;
  },

  async createMyManualEntry(payload: {
    title?: string;
    description: string;
    tags?: string[];
  }): Promise<JournalEntry> {
    const response = await api.post('/me/journal/manual', payload);
    return response.data;
  },

  async getMyJournalSummary(params: { from: string; to: string }): Promise<JournalSummary> {
    const response = await api.get('/me/journal/summary', { params });
    return response.data;
  },

  async getMyMetrics(params: { from: string; to: string; businessHours?: boolean }): Promise<TechnicianMetrics> {
    const response = await api.get('/me/metrics', { params });
    return response.data;
  },
};
```

### 8. Frontend - Página Principal
📝 **CRIAR:** `frontend/src/pages/MyJournalPage.tsx`

Ver arquivo completo no próximo passo devido ao tamanho.

### 9. Frontend - Atualizar Rotas
📝 **MODIFICAR:** `frontend/src/App.tsx`

Adicionar import:
```typescript
import MyJournalPage from './pages/MyJournalPage';
```

Adicionar rota:
```typescript
<Route path="my/journal" element={<MyJournalPage />} />
```

### 10. Frontend - Adicionar ao Menu
📝 **MODIFICAR:** `frontend/src/components/Layout.tsx` ou `ModernLayout.tsx`

Adicionar item de menu:
```typescript
<Link to="/my/journal" className="...">
  Meu Diário
</Link>
```

## Próximos Passos

1. **Executar Migration:**
   ```bash
   cd backend
   npm run prisma:migrate
   ```

2. **Gerar Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

3. **Testar endpoints:**
   - GET /api/me/journal
   - POST /api/me/journal/manual
   - GET /api/me/journal/summary
   - GET /api/me/metrics

4. **Criar página frontend completa** (ver próximo arquivo)

