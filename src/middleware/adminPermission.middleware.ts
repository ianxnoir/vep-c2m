import { Injectable, NestMiddleware, Req } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class AdminPermission implements NestMiddleware {
  public use(@Req() req: Request, res: Response, next: NextFunction): void {
    // Todo
    // // frontend pass sesstion-token via cookie
    // // throw new HttpException(req.cookies, 401);
    // const sessionToken = req?.cookies['session-token'] || null;
    // // const sessionToken = req.headers['session-token'];
    // if (sessionToken) {
    //   let adminToken = Array.isArray(sessionToken) ? sessionToken[0] : sessionToken;

    //   const payload = <Record<string, any>> this.jwtService.decode(adminToken);
    //   // const { permission, fairAccessList } = payload;
    //   // if (!permission || !fairAccessList) {
    //   //   throw new HttpException('Unauthorized', 401);
    //   // }
    //   req.body = {
    //     ...req.body,
    //     permission: payload
    //   };
    // }

    const { adminid, permission, fairaccess, name } = req?.headers;
    if (adminid) {
      req.body = {
        ...req.body,
        adminProfile: { adminid, permission, fairaccess, name }
      };
    }

    next();
  }
}
