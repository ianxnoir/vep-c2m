import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constant } from '../../../config/constant';
import { Logger } from '../../../core/utils';
import { ExhibitorQueryDto } from '../../../dto/esFilterExhibitor.dto';

@Injectable()
export class ApiExhibitorService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger
  ) {}

  public async getExhibitorProfile(contactEmail: string): Promise<Record<string, any>> {
    try {
      return this.httpService
        .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/v1/internal/profiles-v2`, {
          contactEmail,
        })
        .toPromise();
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'Exhibitor', action: 'Get Exhibitor Profile V2', step: 'error', detail: { input: contactEmail, error: e } }));
      return {
        status: 400,
        message: JSON.stringify(e),
      }
    }
  }

  public async getExhibitorProfileV3(contactEmail: string): Promise<Record<string, any>> {
    return this.httpService
      .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/v1/internal/profiles-v3`, {
        contactEmail,
      })
      .toPromise();
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public async getExhibitorProfilesByCCDID(companyCcdIds: string[]): Promise<Record<string, any>> {
    try {
      const { data: res } = await this.httpService
      .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/v1/internal/profiles`, {
        companyCcdIds,
      })
      .toPromise();
      this.logger.log(JSON.stringify({ section: 'Exhibitor', action: 'Get Exhibitor Profile', step: 'success', detail: { input: companyCcdIds, res } }));
      return res;
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'Exhibitor', action: 'Get Exhibitor Profile', step: 'error', detail: { input: companyCcdIds, error: e } }));
      return {
        status: 400,
        message: JSON.stringify(e),
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public async filterExhibitorByES(data: ExhibitorQueryDto): Promise<Record<string, any>> {
    return this.httpService
      .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/exhibitor/list`, data)
      .toPromise();
  }

  public async getAndSetC2MLoginStatus(ccdid: string, eoaFairId: string, fairCode: string): Promise<Record<string, any>> {
    return this.httpService
      .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/eoa/getAndSetC2MLoginStatus`, {
        ccdid,
        eoaFairId,
        fairCode
      })
      .toPromise();
  }

  public async getExhibitorProfileFromES(filterRecommendedCCDID: string, fairCode: string, language: string): Promise<Record<string, any>> {
    return this.httpService
      .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/exhibitor/list`, {
        filterRecommendedCCDID: [filterRecommendedCCDID],
        fairCode,
        size: 9999,
        lang: language
      })
      .toPromise();
    }

  public async getExhibitorParticipantStatus(ccdid: string, fairCode: string): Promise<Record<string, any>> {
    return this.httpService
    .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/exhibitor/getExhibitorParticipantStatus`,
    { ccdid, fairCode }).toPromise()
    .then(result => {
      if (result?.data?.status !== 200) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          // api error message or general error message
          message: result.data?.message ?? constant.MEETING.ERROR_MESSAGE.EXHIBITOR_PROFILE_NOT_FOUND
        }
      }

      if (result?.data?.status === 200 && result?.data?.data?.ParticipantStatus?.toLowerCase() === 'restricted') {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          // api error message or general error message
          message: result.data?.message ?? constant.MEETING.ERROR_MESSAGE.EXHIBITOR_RESTRICTED
        }
      }
      return {
        status: constant.GENERAL_STATUS.SUCCESS
      }
    })
    .catch(error => {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error)
      }
    })
  }

  public async getExhibitorForSendingNoti(): Promise<Record<string, any>> {
    return this.httpService.get(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/v1/internal/getExhibitorForSendingNoti`).toPromise();
  }

  public async getExhibitorDetail(exhibitorUrn: string, fairCode: string): Promise<Record<string, any>> {
    return this.httpService.get(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/exhibitor/detail?exhibitorUrn=${exhibitorUrn}&fairCode=${fairCode}`).toPromise();
  }
}
