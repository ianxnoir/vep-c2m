import { Injectable, NestMiddleware, HttpException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: NextFunction): void {
    const headerKeys = ['x-access-token', 'x-email-id', 'x-sso-uid', 'x-sso-firstname', 'x-sso-lastname'];
    const notEnoughHeaders = headerKeys.map((header: string) => header in req.headers).includes(false);
    const { adminId } = req.body?.adminProfile || {};
    if (notEnoughHeaders && adminId) {
      throw new HttpException('Unauthorized', 401);
    }

    next();
  }
}
