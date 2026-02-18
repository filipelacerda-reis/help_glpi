import { Request, Response } from 'express';
import { z } from 'zod';
import { slaQueue } from '../lib/queue';
import { platformAuditService } from '../services/platformAudit.service';

const recalculateSlaSchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    teamId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return new Date(value.from) <= new Date(value.to);
    },
    {
      message: 'Data inicial deve ser menor ou igual à data final',
      path: ['from'],
    }
  );

export const adminToolsController = {
  async recalculateSla(req: Request, res: Response) {
    if (!slaQueue) {
      res.status(500).json({ error: 'Fila de SLA indisponível' });
      return;
    }

    const payload = recalculateSlaSchema.parse(req.body || {});
    const { from, to, teamId, categoryId } = payload;
    const job = await slaQueue.add('recalculate-sla', {
      type: 'RECALCULATE_SLA',
      ticketId: 'batch',
      data: { from, to, teamId, categoryId },
      requestId: req.requestId,
      correlationId: req.correlationId || req.requestId,
    });

    await platformAuditService.log(req.userId as string, 'TOOL_EXECUTED', 'SLA', {
      jobId: job.id,
      filters: { from, to, teamId, categoryId },
    });

    res.json({ success: true, jobId: job.id });
  },
};
