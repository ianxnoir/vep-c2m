import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../../core/utils';

@Injectable()
export class BuyerService {
  private baseUri: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger
  ) {
    this.baseUri = this.configService.get<string>('api.BUYER_SERVICE_URI') || '';
  }

  public async getTimezoneAndPreferredLang(fairCode: string, ssouid: string, emailId: string): Promise<any> {
    try {
      // const headers = { 'x-access-token': '1', 'x-sso-uid': ssouid, 'x-email-id': emailId, 'x-sso-firstname': '1', 'x-sso-lastname': '1' };
      const data = { ssoUid: ssouid, emailId: emailId };
      const { data: userProfile } = (await this.httpService.post(`${this.baseUri}/profile-internal`, data).toPromise());
      this.logger.log(JSON.stringify({ section: 'Buyer', action: 'getTimezoneAndPreferredLang', step: 'success', detail: { input: { fairCode, ssouid, emailId }, userProfile } }));
      return userProfile;
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'Buyer', action: 'getTimezoneAndPreferredLang', step: 'error', detail: { input: { fairCode, ssouid, emailId }, error: e } }));
    }
  }

}
