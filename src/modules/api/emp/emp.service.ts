import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../../core/utils';

@Injectable()
export class EMPService {
  private baseUri: string;
  private apiVersion: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger
  ) {
    this.baseUri = this.configService.get<string>('api.EMP_SERVICE_URI') || '';
    this.apiVersion = this.configService.get<string>('apiVersion.EMP_SERVICE') || '';
  }

  public async getMessageCenterUser(accessToken: string): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUser', step: '1', detail: { accessToken } }));
    return this.httpService.get(`${this.baseUri}/message-centre-integration/graphql/message-center-user`, 
    {
      headers: {
        'access-token': accessToken
      }
    })
    .toPromise();
  }

  public async getMessageCenterUserPreference(accessToken: string, userId: string): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUserPreference', step: '1', detail: { accessToken, userId } }));
    return this.httpService.get(`${this.baseUri}/message-centre-delivery/${this.apiVersion}/user-preference/${userId}`, 
    {
      headers: {
        'access-token': accessToken
      }
    })
    .toPromise();
  }

  public async getMessageCenterSupportedLanguageList(locale: string): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUserPreference', step: '1', detail: { locale } }));
    return this.httpService.get(`${this.baseUri}/message-centre-delivery/${this.apiVersion}/translation-languages`, 
    {
      params:{
        locale
      }
    })
    .toPromise();
  }

  public async updateMessageCenterUserPreference(accessToken: string, userId: string, emailNotification: boolean, translationLanguage: string): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'EMP', action: 'updateMessageCenterUserPreference', step: '1', detail: { accessToken, userId, emailNotification, translationLanguage } }));
    return this.httpService.post(`${this.baseUri}/message-centre-delivery/${this.apiVersion}/user-preference/${userId}`, 
    {
      emailNotification,
      translationLanguage
      
    },
    {
      headers: {
        'access-token': accessToken
      }
    })
    .toPromise();
  }
}
