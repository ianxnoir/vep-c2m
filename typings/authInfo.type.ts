export interface AuthInfo extends Record<string, any> {
  ACCESS_TOKEN: string;
  EMAIL_ID: string;
  SSOUID: string;
  SSO_FIRSTNAME: string;
  SSO_LASTNAME: string;
  COMPANY_CCDIDS: string[];
}
