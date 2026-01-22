import { Request, Response, NextFunction } from 'express';
import { getIo } from '../lib/socket';

export const attachIo = (req: Request, _res: Response, next: NextFunction): void => {
  const io = getIo();

  if (io) {
    req.io = io;
  }

  next();
};


