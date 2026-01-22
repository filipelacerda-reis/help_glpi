import { Request, Response } from 'express';
import { slaQueue } from '../lib/queue';
import { platformAuditService } from '../services/platformAudit.service';

export const adminToolsController = {
  async recalculateSla(req: Request, res: Response) {
    if (!slaQueue) {
      res.status(500).json({ error: 'Fila de SLA indisponível' });
      return;
    }

    const { from, to, teamId, categoryId } = req.body || {};
    const job = await slaQueue.add('recalculate-sla', {
      type: 'RECALCULATE_SLA',
      ticketId: 'batch',
      data: { from, to, teamId, categoryId },
    });

    await platformAuditService.log(req.userId as string, 'TOOL_EXECUTED', 'SLA', {
      jobId: job.id,
      filters: { from, to, teamId, categoryId },
    });

    res.json({ success: true, jobId: job.id });
  },
};
