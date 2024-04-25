import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: NextFunction): void {
    const { adminId, admin } = req.body.permission;
    if (!adminId || !admin) {
        throw new HttpException('Unauthorized', 401);
      }
    next();
  }
}
