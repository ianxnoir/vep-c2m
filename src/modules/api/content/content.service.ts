import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import moment from 'moment';
import { Connection, getConnection } from 'typeorm';

@Injectable()
export class ContentApiService {
  private baseUri: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService
  ) {
    this.baseUri = this.configService.get<string>('api.CONTENT_SERVICE_URI') || '';
  }

  public async checkSensitiveWord(word: string): Promise<any> {
    return this.httpService.get(`${this.baseUri}/suggester/vep-senskwblockedwords?q=${encodeURI(word)}`).toPromise();
  }

  public async getNobValue(code: string[]): Promise<any> {
    return this.httpService.get(`${this.baseUri}/definition/council/nobV2`, { params: { type: 'code', id: code.join(',') } }).toPromise();
  }

  public async getProductInterestHistory(ssoUid: string, fairCode:string, fiscalyear:string): Promise<any> {
    try {
      const headersRequest = {
        'Content-Type': 'application/json',
        'x-access-token': 'token',
        'x-sso-uid': `${ssoUid}`,
        'x-email-id': 'email',
        'x-sso-firstname': 'firstname',
        'x-sso-lastname': 'lastname'
    };
      const res = await this.httpService.get(`${this.baseUri}/buyerDetail/fair/${fairCode}/fiscalYear/${fiscalyear}/productInterestHistory?pageNum=1&size=1&orderBy=DESC`, { headers: headersRequest }).toPromise();
      const resTime = res?.data?.data?.[0]?.eventTime;
      return resTime && moment(resTime) ? moment(resTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD') : '';
    } catch (error:any) {
      console.log(JSON.stringify(error));
      return '';
    }
  }

  public async getExhibitorSelfSsoUid(ccdid: string): Promise<any> {
    const query = `SELECT companyCcdid, ssoUid from vepExhibitorDb.vepExhibitor where companyCcdid = '${ccdid}'`;
    const connection: Connection = getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      const res: any[] = await connection.query(query, undefined, slaveRunner);
      return {
        status: 200,
        ccdid: res?.length ? res[0].ssoUid : ''
    };
    } catch (error:any) {
      return {
        status: 400,
        message: JSON.stringify(error)
      };
    } finally {
      slaveRunner.release();
    }
  }
}
