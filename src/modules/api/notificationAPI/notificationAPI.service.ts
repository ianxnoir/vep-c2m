import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../../core/utils';
// import { Logger } from '../../../core/utils';

@Injectable()
export class NotificationAPIService {
  private baseUri: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger
  ) {
    this.baseUri = this.configService.get<string>('api.NOTIFICATION_SERVICE_URI') || '';
  }

  public async getTemplateContent({ templateId, fairCode }: Record<string, any>): Promise<any> {
    return this.httpService.get(`${this.baseUri}/api/system-template/${templateId}`, {
      params: {
        fairCode
      }
    }).toPromise()
    .then(result => {
      if (result.status !== 200 || !result?.data?.content) {
          this.logger.log(JSON.stringify({ section: 'Notification', action: 'getTemplateContent', step: 'error', detail: { result: JSON.stringify(result.data) } }));
          return {
            status: 400,
            data: result.data
          };
      }

      return {
        status: 200,
        data: result.data
      };
      
    })
    .catch(error => {
      this.logger.log(JSON.stringify({ section: 'Notification', action: 'getTemplateContent', step: 'error', detail: { error: error?.message ?? error } }));
      return {
        status: 400,
        message: error?.message ?? JSON.stringify(error)
      };
    })
  }

  public async getTemplateContentR2BVersion({ templateId }: Record<string, any>): Promise<any> {
    // this.logger.log(JSON.stringify({ section: 'Notification', action: 'getTemplateContent R2B Version', step: '1', detail: { templateId } }));
    return this.httpService.get(`${this.baseUri}/admin/v1/notification/system-template/${templateId}`).toPromise()
    .then(result => {
      // this.logger.log(JSON.stringify({ section: 'Notification', action: 'getTemplateContent R2B Version', step: 'success', detail: { result } }));
      return {
        status: 200,
        data: result.data
      };
    })
    .catch(error => {
      // this.logger.log(JSON.stringify({ section: 'Notification', action: 'getTemplateContent  R2B Version', step: 'error', detail: { error: error?.message ?? error } }));
      return {
        status: 400,
        message: error?.message ?? JSON.stringify(error)
      };
    })
  }

  public async getMessageBodyForSns({ templateId, templateSource }: Record<any, any>): Promise<any> {
    return this.httpService.get(`${this.baseUri}/notification/system-template/${templateId}/messageBody`, {
      params: {
        templateSource
      }
    }).toPromise()
    .then(result => {
      return {
        status: 200,
        data: result?.data
      };
    })
    .catch(error => {
      return {
        status: 400,
        message: error?.message ?? JSON.stringify(error)
      };
    })
  }
}
