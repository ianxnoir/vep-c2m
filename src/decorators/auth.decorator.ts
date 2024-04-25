import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthInfo } from '../../typings/authInfo.type';

export const Auth = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  const authInfo: AuthInfo = {
    ACCESS_TOKEN: request.headers['x-access-token'],
    EMAIL_ID: request.headers['x-email-id'],
    SSOUID: request.headers['x-sso-uid'],
    SECONDARY_ID: request.headers['x-secondary-id'],
    SSO_FIRSTNAME: request.headers['x-sso-firstname'],
    SSO_LASTNAME: request.headers['x-sso-lastname'],
    COMPANY_CCDIDS: request.headers['x-company-ccdids'] ? request.headers['x-company-ccdids'] : [],
  };

  return data ? authInfo[data] : authInfo;
});
