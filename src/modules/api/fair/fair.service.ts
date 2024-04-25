import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import moment, { Moment } from 'moment-timezone';
import { Observable } from 'rxjs';
import { constant } from '../../../config/constant';
import { ElasticacheClusterService } from '../../../core/elasticachecluster/elasticachecluster.service';
import { Logger } from '../../../core/utils';
import { MeetingType } from '../../c2m/meeting/meeting.type';

interface getC2MFairRegistrationNumbers {
  requesterSsoUid: string;
  fairCode: string;
  fiscalYear: string;
  responderSsoUid: string;
  responderFairCode: string;
  responderFiscalYear: string;
}

@Injectable()
export class ApiFairService {
  private baseUri: string;
  private contentUri: string;

  private meetingTypeMapping: Record<any, any> = {
    physical: MeetingType.F2F,
    online: MeetingType.ONLINE,
    [MeetingType.ONLINE]: 'online',
    [MeetingType.F2F]: 'physical',
  };

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger,
    private elasticacheClusterService: ElasticacheClusterService,
  ) {
    this.baseUri = this.configService.get<string>('api.FAIR_SERVICE_URI') || '';
    this.contentUri = this.configService.get<string>('api.CONTENT_SERVICE_URI') || '';
  }

    // set API cache 
    public async setApiCache( redisKey: string, apiReturn: any): Promise<Record<string, any>> {
      // create Redis cache by key and API return
      return this.elasticacheClusterService.setCache(redisKey, JSON.stringify(apiReturn), 60 * 60 * 4).catch(error => {
        return null;
      })
    }
  
    // get API cache by key
    public async getApiCache( redisKey: string): Promise<Record<string, any>> {
      return this.elasticacheClusterService.getCache(redisKey).then(async result => {
        if(result)
          return JSON.parse(result);
        else  
          return null;
      })
    }

    // set API cache for notification. Life time: 5mins
    public async setApiCacheForNoti( redisKey: string, value: string): Promise<Record<string, any>> {
      // create Redis cache by key and API return
      return this.elasticacheClusterService.setCache(redisKey, value, 60 * 5).catch(error => {
        return null;
      })
    }

  public async getFairParticipantRegistrations(ssoUids: string[]): Promise<any> {
    try {
      const { data: res } = await this.httpService.post(`${this.baseUri}/profile/fairRegistrations`, { ssoUids }).toPromise();
      this.logger.log(JSON.stringify({ section: 'Fair', action: 'getFairParticipantRegistrations', step: 'success', detail: { input: ssoUids, output: res } }));
      return res;
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'Fair', action: 'getFairParticipantRegistrations', step: 'error', detail: { error: e } }));
    }
  }

  public async getCIPFairDates(fairCode: string, fiscalYear: string): Promise<any> {
    try {
      const { data: res } = await this.httpService.get(`${this.baseUri}/fair/getCIPFairDates/${fairCode}/${fiscalYear}`).toPromise();

      this.logger.log(JSON.stringify({ section: 'Fair', action: 'getCIPFairDates', step: 'success', detail: { input: { fairCode, fiscalYear }, output: res } }));
      return res;
    } catch (e) {
      this.logger.log(JSON.stringify({ section: 'Fair', action: 'getCIPFairDates', step: 'error', detail: { error: e } }));
    }
  }

  // To-Do get back fair color
  public getFairColor(fairCode: string): any {
    if (fairCode === 'A') {
      return '#d9d252';
    }
    if (fairCode === 'B') {
      return '#7e10b5';
    }
    if (fairCode === 'C') {
      return '#1057b5';
    }

    return '#b51020';
  }

  // TO-DO get combined fair codes from other service
  // TODO: Faircode and fiscal year should be in pair array
  public async getCombinedFairCodes(fairCode: string): Promise<{ status: number; message?: string; fairCodes?: string[]; fiscalYears?: string[] }> {
    const fairSetting = await this.getWordpressFairSetting(fairCode);
    if (fairSetting?.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: fairSetting.message,
      };
    }
    const fairCodes = fairSetting.data.length ? fairSetting.data.map((fair: any) => fair.fair_code) : [];
    const fiscalYears = fairSetting.data.length ? fairSetting.data.map((fair: any) => fair.fiscal_year) : [];

    if (!fairCodes?.length || !fiscalYears?.length) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.NO_FAIRCODE_OR_FISCALYEAR,
      };
    }

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      fairCodes,
      fiscalYears: [...new Set([...fiscalYears])],
    };
  }

  public async getFairDates(fairCode: string): Promise<any> {
    return this.httpService
      .get(`${this.baseUri}/fair/${fairCode}/combinedDates`)
      .toPromise()
      .then((result) => ({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: result?.data?.data,
      }))
      .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      }));
  }

  public async getFairSetting(fairCode: string): Promise<any> {
    const ApiName =  'getWordpressSetting';
    const ApiPara =  fairCode;
    const redisKey = `${ApiName}-${ApiPara}`;
    const cache = await this.getApiCache(redisKey);
    if(!cache){
      const response = await this.httpService.get(`${this.contentUri}/wordpress/setting?fair=${fairCode}`).toPromise();
      const data = { 
        status: constant.GENERAL_STATUS.SUCCESS,
        data: response?.data 
      }
      // set cache if cant find in redis 
      this.setApiCache(redisKey , data);

      return Promise.resolve(data);
    }else{
      return Promise.resolve(cache);
    }
  }

  public async getWordpressFairSetting(fairCode: string): Promise<any> {
    return this.getCombinedFairSettingsFromCacheOrApi(fairCode)
      .then((result) => {
        const combinedFairsData = JSON.parse(result?.data);
        const combinedFairs = combinedFairsData?.data;
        
        return {
          combinationName: combinedFairs.combination_name,
          targetFairs: combinedFairs['combined-fair'].map((fair: Record<string, string>) => fair.url),
        };
      })
      .catch(() =>
        // no combined fair record
        ({
          combinationName: '',
          targetFairs: [fairCode],
        })
      )
      .then(async (combinedFairs) =>
        Promise.all([Promise.resolve(combinedFairs.combinationName), ...combinedFairs.targetFairs.map(async (fair: string) => this.getFairSetting(fair))])
      )
      .then((result) => ({
        status: constant.GENERAL_STATUS.SUCCESS,
        meta: {
          [constant.API_RESPONSE_FIELDS.STATUS]: constant.API_RESPONSE_CODE.SUCCESS,
          [constant.API_RESPONSE_FIELDS.MESSAGE]: result[0] ? constant.FAIR_RELATIONSHIP.COMBINED : constant.FAIR_RELATIONSHIP.SINGLE,
          combinationName: result[0],
        },
        data: result.filter((fair, index) => index !== 0).map((fair) => fair.data.data),
      }))
      .catch(() =>
        // no fair record found
        ({
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.NO_FAIRCODE_OR_FISCALYEAR,
          meta: {
            [constant.API_RESPONSE_FIELDS.STATUS]: constant.API_RESPONSE_CODE.FAIL,
            [constant.API_RESPONSE_FIELDS.MESSAGE]: constant.FAIR_RELATIONSHIP.NO_RECORD,
            combinationName: '',
          },
          data: [],
        })
      );
  }

  public async snapFairTimeslot(
    fairCode: string,
    startTime: Moment,
    endTime: Moment,
    fairType: MeetingType | null = null
  ): Promise<Record<string, Moment> | null> {
    const fairDates = await Promise.resolve(this.getFairDates(fairCode));
    const fairTimeslots = fairDates.data;
    let timeslots: Array<Record<string, any>> = [];
    if (fairType) {
      timeslots = fairTimeslots[this.meetingTypeMapping[fairType]];
    } else {
      timeslots = Array(fairTimeslots[this.meetingTypeMapping[MeetingType.F2F]]).concat(fairTimeslots[this.meetingTypeMapping[MeetingType.ONLINE]]);
    }
    timeslots = timeslots.sort((current: Record<string, any>, next: Record<string, any>) => current.startDate - next.startDate);
    return timeslots.filter((timeslot: Record<string, any>) => moment(timeslot.start).utc() <= startTime && moment(timeslot.end).utc() >= endTime)[0] || null;
  }

  // Ricky - get shortName, displayNames for email purpose
  public async getNamesObj(fairCode: string): Promise<any> {
    try {
      const uri = `${this.contentUri}/wordpress/setting?fair=${fairCode}`;

      const observable: Observable<AxiosResponse> = this.httpService.get(uri);
      const callback = (await observable.toPromise());
      const shortName = callback?.data.data.fair_short_name;
      const longNameEn = callback?.data.data.fair_display_name.en;
      const longNameTc = callback?.data.data.fair_display_name.tc;
      const longNameSc = callback?.data.data.fair_display_name.sc;
      return {
        Fair_Short_Name: shortName,
        Fair_long_name_EN: longNameEn,
        Fair_long_name_TC: longNameTc,
        Fair_long_name_SC: longNameSc
      };
    } catch (error) {
      this.logger.log(JSON.stringify({ section: 'getNamesObj', action: 'getNamesObj', step: 'catch error', detail: { input: fairCode, error: JSON.stringify(error) } }));
      return {
        status: 400,
        message: JSON.stringify(error),
      }
    }
  }

  public async getAdminCombinedFairSettings(combinationName: string, fiscalYear: string): Promise<AxiosResponse> {
    const baseUri = this.configService.get('api.CONTENT_SERVICE_URI') || '';
    const request = this.httpService.get(`${baseUri}/admin/combinedFairSetting?combinationName=${combinationName}&fiscalYear=${fiscalYear}`);

    return request.toPromise();
  }

  public async getAndSetC2MLoginStatus(ssoUid: string, fairCode: string, fiscalYear: string): Promise<any> {
    return this.httpService.post(`${this.baseUri}/fair/getAndSetC2MLoginStatus`, { ssoUid, fairCode, fiscalYear }).toPromise();
  }

  public async getFairParticipantProfile(ssoUid: string, fairCode: string, fiscalYear: string): Promise<any> {
    return this.httpService.post(`${this.baseUri}/fair/getFairParticipantProfile`, { ssoUid, fairCode, fiscalYear }).toPromise();
  }

  public async getFairParticipantStatus(ssoUid: string, fairCode: string): Promise<any> {
    return this.httpService
      .post(`${this.baseUri}/fair/getFairParticipantStatus`, { ssoUid, fairCode: [fairCode] })
      .toPromise()
      .then((result) => {
        if (result?.data?.status !== 200) {
          return {
            status: constant.GENERAL_STATUS.FAIL,
            // api error message or general error message
            message: result.data?.message ?? constant.MEETING.ERROR_MESSAGE.BUYER_PROFILE_NOT_FOUND,
          };
        }

        if (result?.data?.status === 200 && result?.data?.data?.ParticipantStatus?.toLowerCase() === 'restricted') {
          return {
            status: constant.GENERAL_STATUS.FAIL,
            // api error message or general error message
            message: result.data?.message ?? constant.MEETING.ERROR_MESSAGE.BUYER_RESTRICTED,
          };
        }
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
        };
      })
      .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      }));
  }

  public async getFairListing(): Promise<any> {
    return this.httpService.get(`${this.baseUri}/fair/list`).toPromise();
  }

  public async getMultipleFairDatas(fairCodes: string[]): Promise<AxiosResponse> {
    return this.httpService.get(`${this.baseUri}/fair/getMultipleFairDatas`, { params: { fairCodes : fairCodes.join(',') } }).toPromise();
  }

  public async stopRtmpBySeminarEndTime(): Promise<AxiosResponse> {
    return this.httpService.get(`${this.baseUri}/rtmpScheduler/stopRtmpBySeminarEndTime`).toPromise();
  }

  public async updatePlaybackByExistingVODFile(): Promise<AxiosResponse> {
    return this.httpService.get(`${this.baseUri}/rtmpScheduler/updatePlaybackByExistingVODFile`).toPromise();
  }

  public async getFairParticipant(emailId: string): Promise<AxiosResponse> {
    return this.httpService.post(`${this.baseUri}/fair/getFairParticipant`, { emailId }).toPromise();
  }

  public async getC2MFairRegistrationNumbers({requesterSsoUid, fairCode, fiscalYear, responderSsoUid, responderFairCode, responderFiscalYear}: getC2MFairRegistrationNumbers): Promise<any[]> {
    let registrationNoList: any[] = [];
    try {
      let results = await this.getFairParticipantRegistrations([requesterSsoUid, responderSsoUid]);
      if(Array.isArray(results?.data)) {
        let records: any[] = [];
        results?.data.forEach((data: any) => {
          if(data?.records) records.push(...data?.records);
        });
        records.forEach(record=>{
          if (
            record.ssoUid == requesterSsoUid &&
            record.fairCode == fairCode &&
            record.fiscalYear == fiscalYear
          )
            registrationNoList.push(record.registrationNo);
          else if (
            record.ssoUid == responderSsoUid &&
            record.fairCode == responderFairCode &&
            record.fiscalYear == responderFiscalYear
          )
            registrationNoList.push(record.registrationNo);
        })
      }
    } catch (ex) {

    }
    return registrationNoList.filter((number, index) => {
      return registrationNoList.indexOf(number) === index;
    });
  }
  public async findAllSeminars(vmsProjectCode: string, vmsProjectYear: string, systemCode: string, language: string): Promise<AxiosResponse> {
    return this.httpService.get(`${this.baseUri}/seminars?vmsProjectCode=${vmsProjectCode}&vmsProjectYear=${vmsProjectYear}&systemCode=${systemCode}&language=${language}`).toPromise();
  }

  public async countRegisteredSeminarsByUserAndTimeRange(userId: string, secondUserId: string, responderUserId: string, fairCode: string, startTime: string, endTime: string, flagFromVideoMeeting?: boolean): Promise<AxiosResponse> {
    return this.httpService.post(`${this.baseUri}/seminars/countRegisteredSeminarsByUserAndTimeRange`, {
      fairCode,
      userId,
      secondUserId,
      responderUserId,
      startTime,
      endTime,
      flagFromVideoMeeting
    }).toPromise();
  }

  public getCombinedFairSettingsAndCached(fairCode: string, redisKey: string) {
    let fairSettingApiResult: Record<string, any> = {};
    return this.httpService.get(`${this.contentUri}/wordpress/combinedFairSetting?fair=${fairCode}`).toPromise()
    .then(result => {
      if (!result?.data) {
        return Promise.reject({
          status: 400,
          message: `Couldn't get combined fair setting from api, fairCode: ${fairCode}`
        })
      }
      fairSettingApiResult = result?.data;
      return this.elasticacheClusterService.setCache(redisKey, JSON.stringify(result?.data), 60 * 60 * 4);
    })
    .then(result => {
      if (result !== "OK") {
        `Cant cached the api result, fairCode: ${fairCode}`
      }
      return fairSettingApiResult;
    })
    .catch(error => {
      return Promise.reject({
        status: error?.status ?? 400,
        message: error?.message ?? typeof error === "string" ? error : JSON.stringify(error)
      })
    })
  }

  public async getCombinedFairSettingsFromCacheOrApi(fairCode: string): Promise<Record<string, any>> {
    const redisKey = `combinedFairSetting-${fairCode}`;
    return this.elasticacheClusterService.getCache(redisKey)
    .then(async result => {
      if (!result) {
        return this.getCombinedFairSettingsAndCached(fairCode, redisKey)
      }
      return JSON.parse(result);
    })
    .catch(error => {
      return {
        status: error?.status ?? 400,
        message: error?.message ?? typeof error === "string" ? error : JSON.stringify(error),
      }
    })
  }

  public addCache(key: string, value: string) {
    return this.elasticacheClusterService.setCache(key, value);
  }

  public deleteCache(key: string) {
    return this.elasticacheClusterService.deleteCacheByKey(key);
  }

  public getCache(key: string) {
    return this.elasticacheClusterService.getCache(key);
  }

  public getKeysByPattern(key: string) {
    return this.elasticacheClusterService.getKeysByPattern(key);
  }
}
