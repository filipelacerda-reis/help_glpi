import { Request, Response } from 'express';
import { platformAuditService } from '../services/platformAudit.service';

export const adminAuditController = {
  async list(req: Request, res: Response) {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const result = await platformAuditService.list(limit, cursor);
    res.json(result);
  },

  async exportJson(_req: Request, res: Response) {
    const result = await platformAuditService.list(500);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-audit.json"');
    res.send(JSON.stringify(result.data, null, 2));
  },
};
