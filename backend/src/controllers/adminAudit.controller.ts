import { Request, Response } from 'express';
import { z } from 'zod';
import { platformAuditService } from '../services/platformAudit.service';

const listAuditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().min(1).max(80).optional(),
  resource: z.string().min(1).max(80).optional(),
  from: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  to: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

export const adminAuditController = {
  async list(req: Request, res: Response) {
    const query = listAuditSchema.parse(req.query);
    const result = await platformAuditService.list(query.limit || 50, query.cursor, {
      actorUserId: query.actorUserId,
      action: query.action,
      resource: query.resource,
      from: query.from,
      to: query.to,
    });
    res.json(result);
  },

  async exportJson(req: Request, res: Response) {
    const query = listAuditSchema.parse(req.query);
    const allData: any[] = [];
    let cursor: string | undefined = query.cursor;
    const pageSize = 200;

    for (let i = 0; i < 100; i += 1) {
      const result = await platformAuditService.list(pageSize, cursor, {
        actorUserId: query.actorUserId,
        action: query.action,
        resource: query.resource,
        from: query.from,
        to: query.to,
      });
      allData.push(...result.data);
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="platform-audit.json"');
    res.send(JSON.stringify(allData, null, 2));
  },
};
