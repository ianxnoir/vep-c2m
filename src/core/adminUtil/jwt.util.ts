import jwt from 'jsonwebtoken';
import { VepErrorMsg } from '../../config/exception-constant';
import { VepError } from '../exception/exception';
// let jwt = require('jsonwebtoken');

export class JwtUtil {
    public static retrieveAdminUserInfo(adminJwtToken: string, algorithms: 'HS256' | 'RS256', jwtVerifyKey: string): AdminUserDto {
        try {
            let jwtPayload:any = jwt.verify(adminJwtToken, jwtVerifyKey,
                {
                    algorithms: [algorithms],
                });

            let branchOfficeUser = 0;
            if (jwtPayload.branchOfficeUser?.data?.length) {
                branchOfficeUser = parseInt(jwtPayload.branchOfficeUser.data[0], 10);
            } else {
                branchOfficeUser = jwtPayload.branchOfficeUser === 1 ? 1 : 0;
            }
            return {
                name: jwtPayload.name,
                emailAddress: jwtPayload.emailAddress,
                permission: jwtPayload.permission,
                branchOffice: jwtPayload.branchOffice,
                branchOfficeUser,
                fairAccessList: jwtPayload.fairAccessList,
            };
        } catch (ex: any) {
            throw new VepError(VepErrorMsg.Admin_Invalid_Jwt, ex?.message);
        }
    }
}

export class AdminUserDto {
    public name!: string;
    public emailAddress!: string;
    public permission!: string[];
    public branchOffice!: string;
    public branchOfficeUser!: number;
    public fairAccessList!: string;
}
