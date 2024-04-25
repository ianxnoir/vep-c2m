import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUserDto } from '../core/adminUtil/jwt.util';

export const AdminUserDecorator = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): AdminUserDto | null => {
        const request = ctx.switchToHttp().getRequest();

        if (!request.headers['x-internal-adminuserinfo']) {
            return null;
        }

        return JSON.parse(request.headers['x-internal-adminuserinfo']);
    }
);
