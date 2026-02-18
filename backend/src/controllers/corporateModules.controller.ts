import { Request, Response } from 'express';
import { corporateModulesService } from '../services/corporateModules.service';

function parseQuery(req: Request) {
  const monthsRaw = Number(req.query.months);
  const months = [3, 6, 12].includes(monthsRaw) ? monthsRaw : 12;
  const comparePrevious = String(req.query.comparePrevious) === 'true';
  return { months, comparePrevious };
}

export const corporateModulesController = {
  async getFinanceOverview(req: Request, res: Response) {
    const data = await corporateModulesService.getFinanceOverview(parseQuery(req));
    res.json(data);
  },

  async getHrOverview(req: Request, res: Response) {
    const data = await corporateModulesService.getHrOverview(parseQuery(req));
    res.json(data);
  },

  async getProcurementOverview(req: Request, res: Response) {
    const data = await corporateModulesService.getProcurementOverview(parseQuery(req));
    res.json(data);
  },
};
