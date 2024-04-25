import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LambdaService {
  private baseUri: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService
  ) {
    this.baseUri = this.configService.get<string>('api.LAMBDA_URI') || '';
  }

  public async sendMessageToSendbird({messageType, userId, message, channelId, customType, data}: Record<string, any>): Promise<any> {
    return this.httpService.post(`${this.baseUri}/sendbird/sendMessage`, { messageType, userId, message, channelId, customType, data }).toPromise();
  }

  public async getChannelDeatils({channelId}: Record<string, any>): Promise<any> {
    return this.httpService.post(`${this.baseUri}/sendbird/getChannelDeatils`, { channelId }).toPromise();
  }

  public async sendMessageToMeetingChatroom({messageType, message, channelId, customType, data}: Record<string, any>): Promise<any> {
    return this.getChannelDeatils({channelId})
    .then(result => {
      const userId = result?.data?.created_by?.user_id;
      return this.sendMessageToSendbird({messageType, userId, message, channelId, customType, data});
    })
  }

  public async getSecretValue(secretId: String): Promise<any> {
    return this.httpService.post(`${this.baseUri}/aws/getSecretValue`, { secretId }).toPromise();
  }

  public async deleteChannel({ channelId }: Record<string, any>): Promise<any> {
    return this.httpService.post(`${this.baseUri}/sendbird/deleteChannel`, { channelId }).toPromise();
  }
}
