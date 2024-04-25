import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { AdminUserDto, JwtUtil } from '../adminUtil/jwt.util';

@Injectable()
export class AdminJwtInterceptor implements NestInterceptor<Response> {
    // private httpServer: any;
    private ADMIN_JWT_PUBLIC_KEY: string;
    private ADMIN_JWT_PUBLIC_KEY_RS256: string;
    constructor(private configService: ConfigService) {
        this.ADMIN_JWT_PUBLIC_KEY = this.configService.get('admin.ADMIN_JWT_PUBLIC_KEY') || '';
        this.ADMIN_JWT_PUBLIC_KEY_RS256 = Buffer.from(<string> this.configService.get('admin.ADMIN_JWT_PUBLIC_KEY_RS256') || '', 'base64').toString();
    }

    public intercept(context: ExecutionContext, next: CallHandler): Observable<Response> {
        const request: Request = context.switchToHttp().getRequest();
        const adminJwtToken = request.cookies['session-token'];
        let userInfo: AdminUserDto;
        try {
            userInfo = JwtUtil?.retrieveAdminUserInfo(adminJwtToken, 'RS256', this.ADMIN_JWT_PUBLIC_KEY_RS256);
        } catch {
            userInfo = JwtUtil?.retrieveAdminUserInfo(adminJwtToken, 'HS256', this.ADMIN_JWT_PUBLIC_KEY);
        }
        request.headers['x-internal-adminuserinfo'] = JSON.stringify(userInfo);
        return next.handle();
    }
}
