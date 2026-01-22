import { Request, Response } from 'express';
import { attachmentService } from '../services/attachment.service';

export const attachmentController = {
  async getTicketAttachments(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const attachments = await attachmentService.getTicketAttachments(id);
    res.json(attachments);
  },

  async deleteAttachment(req: Request, res: Response) {
    if (!req.userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    await attachmentService.deleteAttachment(id, req.userId);
    res.status(204).send();
  },
};

