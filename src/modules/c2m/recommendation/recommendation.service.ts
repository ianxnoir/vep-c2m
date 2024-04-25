import { HttpService, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Brackets, getConnection, In, Repository } from 'typeorm';
import { constant } from '../../../config/constant';
import {
  CheckDuplicateExhibitorsMustInterface,
  CreateRecommendationRecordDto,
  CreateRecommendationRecordMustInterface,
  TargetExhibitorPayload,
  GetBMListManagementRecorFilter,
} from '../../../dto/createRecommendationRecord.dto';
import { UpdateRecommendationRecordDto } from '../../../dto/updateRecommendationRecord.dto';
import { Recommendation } from '../../../entities/recommendation.entity';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { InterestedStatus, ReadStatus, NotificationStatus, PublishType } from './recommendation.type';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { Logger } from '../../../core/utils';
import { VepError } from '../../../core/exception/exception';
import { VepErrorMsg } from '../../../config/exception-constant';
import { paginate, PaginationTypeEnum } from 'nestjs-typeorm-paginate';
// import { UserMeta } from '../../../entities/userMeta';
import moment from 'moment-timezone';
import { ChannelType, NotificationTemplatesId, NotificationType, ReceiverRole } from '../notification/notification.type';
import { C2MService } from '../c2m.service';
import { NotificationService } from '../notification/notification.service';
import { ApiFairService } from '../../api/fair/fair.service';
// import { MeetingStatus } from '../meeting/meeting.type';

@Injectable()
export class RecommendationService {
  private bmaiBaseURL: string;
  private bmaiXApiKey: string;
  private fairBaseURL: string;

  constructor(
    @InjectRepository(Recommendation)
    private recommendationRepository: Repository<Recommendation>,
    @InjectRepository(RecommendationItem)
    private recommendationItemRepository: Repository<RecommendationItem>,
    // @InjectRepository(UserMeta)
    // private userMetaRepository: Repository<UserMeta>,
    private httpService: HttpService,
    private configService: ConfigService,
    private logger: Logger,
    private c2mService: C2MService,
    private notificationService: NotificationService,
    private apiFairService: ApiFairService
  ) {
    this.bmaiBaseURL = this.configService.get<string>('api.BMAI_SERVICE.URI') || '';
    this.bmaiXApiKey = this.configService.get<string>('api.BMAI_SERVICE.X_API_KEY') || '';
    this.fairBaseURL = this.configService.get<string>('api.FAIR_SERVICE_URI') || '';
  }

  public async find(fields: Record<string, any>): Promise<RecommendationItem[]> {
    return this.recommendationItemRepository.find({ ...fields, interestedStatus: In([InterestedStatus.PENDING, InterestedStatus.INTERESTED]) });
  }

  public async findOne(fields: Record<string, any>): Promise<Recommendation> {
    return this.recommendationRepository.findOneOrFail({ ...fields });
  }

  public async updateRecord(ssoUid: string, interestedRecord: Recommendation, updateDto: UpdateRecommendationRecordDto): Promise<Recommendation> {
    const { interestedStatus }: { interestedStatus: InterestedStatus } = updateDto.data;
    return this.recommendationRepository.save({
      ...interestedRecord,
      interestedStatus,
      lastUpdatedBy: ssoUid,
    });
  }

  public async createRecord(bmSsoUid: string, fairCode: string, createRecordDto: CreateRecommendationRecordDto): Promise<Record<string, any>> {
    return Promise.resolve({ status: 200 });
    // const record = this.recommendationRepository.create({
    //   ...createRecordDto.data,
    //   fairCode,
    //   interestedStatus: InterestedStatus.PENDING,
    //   readStatus: ReadStatus.NOT_READ,
    //   emailStatus: EmailStatus.NOT_SEND,
    //   notificationStatus: NotificationStatus.NOT_SEND,
    //   createdBy: bmSsoUid,
    //   creationTime: new Date(),
    //   lastUpdatedBy: bmSsoUid,
    // });
    // return this.recommendationRepository.save(record);
  }

  public async findRecommendedBuyer(companyCcdId: string, fairCode: string, fiscalYear: string): Promise<Record<string, any>> {
    const headers = {
      'X-Request-ID': uuid(),
      'x-api-key': this.bmaiXApiKey,
      'Content-Type': 'application/json',
    };

    // Find Recommended Buyer
    // https://api-bmai-internal-uat.hktdc.com/v1/recommendation/fairs/${fairId}/years/${year}/exhibitors/${ccdId}/buyerRecommendation
    const FIND_BUYER_RECOMMENDATION = `/v1/recommendation/fairs/${fairCode}/years/${fiscalYear}/exhibitors/${companyCcdId}/buyerRecommendation`;

    const config: AxiosRequestConfig = {
      url: FIND_BUYER_RECOMMENDATION,
      method: 'GET',
      headers,
      baseURL: this.bmaiBaseURL,
    };

    return this.bmaiQuery<any>(config);
  }

  public async findRecommendedExhibitor(ssoUid: string, fairCode: string, fiscalYear: string): Promise<Record<string, any>> {
    const headers = {
      'X-Request-ID': uuid(),
      'x-api-key': this.bmaiXApiKey,
      'Content-Type': 'application/json',
    };

    // Find Recommended Exhibitor
    // https://api-bmai-internal-uat.hktdc.com/v1/recommendation/fairs/${fairId}/years/${year}/buyers/${ssoUid}/exhibitorRecommendation
    const FIND_EXHIBITOR_RECOMMENDATION = `/v1/recommendation/fairs/${fairCode}/years/${fiscalYear}/buyers/${ssoUid}/exhibitorRecommendation`;

    const config: AxiosRequestConfig = {
      url: FIND_EXHIBITOR_RECOMMENDATION,
      method: 'GET',
      headers,
      baseURL: this.bmaiBaseURL,
    };

    return this.bmaiQuery<any>(config);
  }

  public async bmaiQuery<T>(config: AxiosRequestConfig): Promise<T> {
    return new Promise(async (resolve, reject) => {
      axios(config)
        .then((response: AxiosResponse) => {
          this.logger.debug(JSON.stringify(response.data));
          this.logger.log(`Received data from BMAI Service, url: ${response.config.url}, Request ID ${response.config.headers['X-Request-ID']}`);
          resolve(response.data);
        })
        .catch((error: AxiosError) => {
          this.logger.error(
            `Error in call BMAI Service, url: ${config.url}, Request ID ${config.headers['X-Request-ID']}, error message: ${JSON.stringify(error.message)}`
          );
          reject(new VepError(VepErrorMsg.Recommendation_BMAIService_Error, error.message));
        });
    });
  }

  // ------------------------------------------------ Get Data ------------------------------------------------
  public async getExhibitorProfileFromES(filterRecommendedCCDID: string[], fairCode: string, language: string): Promise<Record<string, any>> {
    try {
      const esRes = await this.httpService
        .post(`${this.configService.get<string>('api.EXHIBITOR_SERVICE_URI')}/exhibitor/list`, {
          filterRecommendedCCDID,
          fairCode,
          size: 9999,
          lang: language,
          c2m: true
        })
        .toPromise();

      // console.log('***** getExhibitorProfileFromES - esRes:', esRes);

      return esRes.data;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async getEConfirmedMeetingCount(filterRecommendedCCDID: any, multipleFairData: any) {

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      const currentTime = moment().format();
      let exhibitors: any[] = [];
      for (let fairCode in filterRecommendedCCDID) {
        let relatedFair: string[] = [];
        multipleFairData.map((fairGroup: string[]) => {
          if (fairGroup.includes(fairCode)) {
            relatedFair = fairGroup;
          }
        });

        filterRecommendedCCDID[fairCode].map((ccdId: string) => {
          let tampExhibitor = {
            ccdId: ccdId,
            relatedFair,
          };

          exhibitors.push(tampExhibitor);
        });
      }
      // const dummy = [
      // {
      //     "ccdId": "300002717492",
      //     "relatedFair": [
      //         "hkjewellery",
      //         "hkdgp"
      //     ]
      // },
      // {
      //     "ccdId": "300002323200",
      //     "relatedFair": [
      //         "hkjewellery",
      //         "hkdgp"
      //     ]
      // }
      // ]

      const conditionSqlArr: string[] = [];
      exhibitors.map((exhibitor: { ccdId: string; relatedFair: string[] }) => {
        let tampQuery = ``;
        if (exhibitor.relatedFair.length) {
          tampQuery = `
          (
            ( 
              (requesterRole = 'EXHIBITOR' AND requesterSsoUid = '${exhibitor.ccdId}') AND 
              (fairCode in ('${exhibitor.relatedFair.join("','")}'))
            )
            OR (
              (responderRole = 'EXHIBITOR' AND responderSsoUid = '${exhibitor.ccdId}') AND 
              (responderFairCode in ('${exhibitor.relatedFair.join("','")}'))
            )
          )
          `;
        } else {
          tampQuery = `
          (
            ( requesterRole = 'EXHIBITOR' AND requesterSsoUid = '${exhibitor.ccdId}')
            OR (responderRole = 'EXHIBITOR' AND responderSsoUid = '${exhibitor.ccdId}')
          )
          `;
        }

        conditionSqlArr.push(tampQuery);
      });

      const conditionSql = conditionSqlArr.join(' OR ');
      const query = `
      SELECT 
        id,
        COUNT(id) AS upComingCount,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterSsoUid
            ELSE responderSsoUid
        END AS exhibitorSsoUid,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterResponseStatus
            ELSE responderResponseStatus
        END AS exhibitorResponseStatus,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterRole
            ELSE responderRole
        END AS exhibitorRole,
        status
      FROM
        vep_c2m_service_db.vepC2MMeeting AS meeting
      WHERE 
        (
          ${conditionSql}
        )
        AND (status = 1)
        AND (endTime > '${currentTime}')
      GROUP BY exhibitorSsoUid
      `;

      const dataResult: Record<string, any>[] = await connection.query(query, undefined, slaveRunner);
      return dataResult;
    } catch (error) {
      return Promise.reject(error);
    } finally {
      slaveRunner.release();
    }
  }

  public async getECheckedInCountData(filterRecommendedCCDID: any, multipleFairData: any) {

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      let exhibitors: any[] = [];
      for (let fairCode in filterRecommendedCCDID) {
        let relatedFair: string[] = [];
        multipleFairData.map((fairGroup: string[]) => {
          if (fairGroup.includes(fairCode)) {
            relatedFair = fairGroup;
          }
        });

        filterRecommendedCCDID[fairCode].map((ccdId: string) => {
          let tampExhibitor = {
            ccdId: ccdId,
            relatedFair,
          };

          exhibitors.push(tampExhibitor);
        });
      }

      const conditionSqlArr: string[] = [];
      exhibitors.map((exhibitor: { ccdId: string; relatedFair: string[] }) => {
        let tampQuery = ``;
        if (exhibitor.relatedFair.length) {
          tampQuery = `
          (
            ( 
              (requesterRole = 'EXHIBITOR' AND responderRole = 'BUYER' AND requesterSsoUid = '${exhibitor.ccdId}') AND 
              (fairCode in ('${exhibitor.relatedFair.join("','")}'))
            )
            OR (
              (responderRole = 'EXHIBITOR' AND requesterRole = 'BUYER' AND responderSsoUid = '${exhibitor.ccdId}') AND 
              (responderFairCode in ('${exhibitor.relatedFair.join("','")}'))
            )
          )
          `;
        } else {
          tampQuery = `
          (
            ( requesterRole = 'EXHIBITOR' AND responderRole = 'BUYER' AND requesterSsoUid = '${exhibitor.ccdId}')
            OR (responderRole = 'EXHIBITOR' AND requesterRole = 'BUYER' AND responderSsoUid = '${exhibitor.ccdId}')
          )
          `;
        }

        conditionSqlArr.push(tampQuery);
      });

      const conditionSql = conditionSqlArr.join(' OR ');
      const query = `
      SELECT 
        id,
        COUNT(id) AS bothComfirmedCount,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterSsoUid
            ELSE responderSsoUid
        END AS exhibitorSsoUid,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterResponseStatus
            ELSE responderResponseStatus
        END AS exhibitorResponseStatus,
        CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterRole
            ELSE responderRole
        END AS exhibitorRole
      FROM
        vep_c2m_service_db.vepC2MMeeting AS meeting
      WHERE (
        (
          ${conditionSql}
        )
        AND (isRequesterJoined = 1 AND isResponderJoined = 1)
      )
      GROUP BY exhibitorSsoUid
      `;

      const dataResult: Record<string, any>[] = await connection.query(query, undefined, slaveRunner);
      return dataResult;
    } catch (error) {
      return Promise.reject(error);
    } finally {
      slaveRunner.release();
    }
  }

  public async getFairList(): Promise<any> {
    try {
      const fRes = await this.httpService.get(`${this.fairBaseURL}/fair/list`).toPromise();
      return fRes.data.data;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async getMultipleFairDatas(fairCodes: string[]): Promise<any> {
    try {
      const res = await this.httpService.get(`${this.fairBaseURL}/fair/getMultipleFairDatas`, { params: { fairCodes : fairCodes.join(',') } }).toPromise();
      let multipleFair: any[] = [];
      res.data.map((data: any) => {
        const tampFairGp: string[] = [];
        data.relatedFair.map((fair: any) => {
          tampFairGp.push(fair.fair_code);
        });
        multipleFair.push(tampFairGp);
      });
      return multipleFair;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  // ------------------------------------------------ End Of Get Data ------------------------------------------------

  // ------------------------------------------------ Recommend by tdc ------------------------------------------------

  public async showIfBuyerHasBMList(ssoUid: string, fairCode:string, fairYear:string ) {
    this.logger.log(
      `action: "showIfBuyerHasBMList", ssoUid: ${ssoUid}, , fairCode: ${fairCode}, fairYear: ${fairYear}`
    );

    return this.recommendationRepository
      .createQueryBuilder('recommendation')
      .where(`recommendation.ssoUid = '${ssoUid}'`)
      .andWhere(`recommendation.fairCode = '${fairCode}'`)
      .andWhere(`recommendation.fairYear = '${fairYear}'`)
      .andWhere(`recommendation.publishType = '${PublishType.external}'`)
      .getMany()
      .then((recommendation) => {
        return Promise.resolve({
          status: constant.GENERAL_STATUS.SUCCESS,
          result: recommendation.length? true: false,
        });
        
      })
      .catch((err) => {
        this.logger.log(
          JSON.stringify({
            action: 'showIfBuyerHasBMList - GET - /showIfBuyerHasBMList',
            section: 'c2m - recommendation',
            step: 'error',
            detail: err,
          })
        );
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: err?.message ?? JSON.stringify(err),
        });
      });

  }

  public async updateRecommendationReadStatus(recommendationIds: number[]) {
    recommendationIds.map((id) => {
      this.recommendationRepository.update({ id }, { readStatus: 1, lastUpdatedAt: new Date() });
    });
  }

  public async findRecommendedByTDCRecord(ssoUid: string, fairCode: string, fairYear: string, language: string, pageNum: string, pageSize: string) {
    this.logger.log(
      `action: "findRecommendedByTDCRecord", step: "start", ssoUid: ${ssoUid}, fairCode: ${fairCode}, fairYear: ${fairYear}, language: ${language}}, pageNum: ${pageNum}}, pageSize: ${pageSize}`
    );

    const page = pageNum;
    const limit = pageSize;

    const queryBuilder = this.recommendationItemRepository
      .createQueryBuilder('recommendationItem')
      .leftJoinAndSelect('recommendationItem.recommendationOfRecommendationItem', 'recommendation')
      .where(`recommendation.ssoUid = '${ssoUid}'`)
      .andWhere(`recommendation.fairCode = '${fairCode}'`)
      .andWhere(`recommendation.fairYear = '${fairYear}'`)
      .andWhere(`recommendation.publishType = '${PublishType.external}'`)
      .andWhere(
        new Brackets((qb) => {
          qb.where(`recommendationItem.interestedStatus = ${InterestedStatus.PENDING}`).orWhere(
            `recommendationItem.interestedStatus = ${InterestedStatus.INTERESTED}`
          );
        })
      )
      .orderBy('recommendation.sentTime', 'DESC')
      .addOrderBy('recommendationItem.id', 'DESC');

    return paginate<RecommendationItem>(queryBuilder, { page, limit, paginationType: PaginationTypeEnum.TAKE_AND_SKIP })
      .then(async (result: any) => {
        JSON.stringify({
          action: 'findRecommendedByTDCRecordStatus - GET - /recommendedByTDC',
          section: 'c2m - recommendation',
          step: 'success',
          detail: result,
        });

        const items = result.items;
        const meta = result.meta;
        const totalSize = meta.totalItems;

        const filterRecommendedCCDID: string[] = [];
        const filterRecommendationId: number[] = [];

        items.map((item: Record<string, any>) => {
          const ccdId = item.targetId;
          const recommendationId = item.recommendationId;

          if (!filterRecommendedCCDID.includes(ccdId)) {
            filterRecommendedCCDID.push(ccdId);
          }

          if (item.recommendationOfRecommendationItem.readStatus === 0 && !filterRecommendationId.includes(recommendationId)) {
            filterRecommendationId.push(recommendationId);
          }
        });

        if (!filterRecommendedCCDID.length) {
          return Promise.reject({
            meta: {
              status: constant.GENERAL_STATUS.FAIL,
            },
            message: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
          });
        }

        if (filterRecommendationId.length) {
          await this.updateRecommendationReadStatus(filterRecommendationId);
        }

        const exhibitorProfileRes = await this.getExhibitorProfileFromES(filterRecommendedCCDID, fairCode, language);
        const exhibitorProfiles = exhibitorProfileRes.data.hits;

        const combinedRes: Record<string, any>[] = [];
        items.map((item: Record<string, any>) => {
          const id = item.id;
          const ccdId = item.targetId;
          const sentTime = item.recommendationOfRecommendationItem.sentTime;
          const creationTime = item.creationTime;
          const interestedStatus = item.interestedStatus;
          const profile = {
            id,
            ccdId,
            sentTime,
            creationTime,
            interestedStatus,
            data: {},
          };

          exhibitorProfiles.map((exhibitorProfile: any) => {
            if (exhibitorProfile.ccdid === ccdId) {
              profile.data = exhibitorProfile;
            }
          });

          combinedRes.push(profile);
        });

        this.logger.log(JSON.stringify({ action: 'getExhibitProfiles - GET - /recommendedByTDC', section: 'c2m - recommendation', step: 'success' }));
        return Promise.resolve({
          meta: {
            status: constant.GENERAL_STATUS.SUCCESS,
          },
          data: {
            totalSize,
            exhibitor: combinedRes,
          },
        });
      })
      .catch((error) => {
        this.logger.log(
          JSON.stringify({
            action: 'findRecommendedByTDCRecordStatus - GET - /recommendedByTDC',
            section: 'c2m - recommendation',
            step: 'error',
            detail: error,
          })
        );
        return Promise.reject({
          meta: {
            status: constant.GENERAL_STATUS.FAIL,
          },
          message: error?.message ?? JSON.stringify(error),
        });
      });
  }

  public async updateRecommendedByTDCRecordStatus(
    ssoUid: string,
    fairCode: string,
    fairYear: string,
    ccdId: string,
    itemId: number,
    interestedStatus: InterestedStatus
  ) {
    this.logger.log(
      `action: "updateRecommendedByTDCRecordStatus", step: "start", ssoUid: ${ssoUid}, fairCode: ${fairCode}, fairYear, : ${fairYear}, ccdId: ${ccdId}, itemId: ${itemId}, interestedStatus: ${interestedStatus}`
    );

    return this.recommendationItemRepository
      .createQueryBuilder('recommendationItem')
      .leftJoinAndSelect('recommendationItem.recommendationOfRecommendationItem', 'recommendation')
      .where(`recommendationItem.targetId = '${ccdId}'`)
      .andWhere(`recommendationItem.id = ${itemId}`)
      .andWhere(`recommendation.ssoUid = '${ssoUid}'`)
      .andWhere(`recommendation.fairCode = '${fairCode}'`)
      .andWhere(`recommendation.fairYear = '${fairYear}'`)
      .getOne()
      .then((result: any) => {
        const currentInterestedStatus = result.interestedStatus;

        if (!result) {
          this.logger.log(
            JSON.stringify({
              action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDC',
              section: 'c2m - recommendation',
              step: 'error',
              detail: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
            })
          );
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
          });
        }

        if (currentInterestedStatus == interestedStatus) {
          this.logger.log(
            JSON.stringify({
              action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDC',
              section: 'c2m - recommendation',
              step: 'error',
              detail: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
            })
          );
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: constant.RECOMMENDATION.BY_TDC.STATUS_UPDATE_WRONG,
          });
        }

        return this.recommendationItemRepository.update({ id: itemId }, { interestedStatus, lastUpdatedBy: ssoUid, lastUpdatedAt: new Date() });
      })
      .then((result: any) => {
        if (result.affected == 0) {
          this.logger.log(
            JSON.stringify({
              action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDC',
              section: 'c2m - recommendation',
              step: 'error',
              detail: constant.RECOMMENDATION.BY_TDC.STATUS_UPDATE_WRONG,
            })
          );
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: constant.RECOMMENDATION.BY_TDC.STATUS_UPDATE_WRONG,
          });
        }
        this.logger.log(
          JSON.stringify({
            action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDC',
            section: 'c2m - recommendation',
            step: 'success',
            detail: result,
          })
        );
        return Promise.resolve({
          status: constant.GENERAL_STATUS.SUCCESS,
          data: result,
        });
      })
      .catch((error) => {
        this.logger.log(
          JSON.stringify({
            action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDC',
            section: 'c2m - recommendation',
            step: 'error',
            detail: error,
          })
        );
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: error?.message ?? JSON.stringify(error),
        });
      });
  }

  public async findpendingRecommendationRecord(ssoUid: string, fairCode: string, fairYear: string, language: string) {
    this.logger.log(
      `action: "findpendingRecommendationRecord", step: "start", ssoUid: ${ssoUid}, fairCode: ${fairCode}, fairYear: ${fairYear}, language: ${language}}`
    );

    const queryBuilder = this.recommendationItemRepository
      .createQueryBuilder('recommendationItem')
      .leftJoinAndSelect('recommendationItem.recommendationOfRecommendationItem', 'recommendation')
      .where(`recommendation.ssoUid = '${ssoUid}'`)
      .andWhere(`recommendation.fairCode = '${fairCode}'`)
      .andWhere(`recommendation.fairYear = '${fairYear}'`)
      .andWhere(`recommendationItem.interestedStatus = ${InterestedStatus.PENDING}`)
      .orderBy('recommendation.sentTime', 'DESC')
      .addOrderBy('recommendationItem.id', 'DESC')
      .limit(4);

    return queryBuilder
      .getManyAndCount()
      .then(async (result: any) => {
        this.logger.log(`action: "findpendingRecommendationRecord", step: "success", detail: ${result}`);
        const items = result[0];
        const totalSize = result[1];

        const filterRecommendedCCDID: string[] = [];

        items.map((item: Record<string, string>) => {
          const ccdId = item.targetId;
          filterRecommendedCCDID.push(ccdId);
        });

        if (!filterRecommendedCCDID.length) {
          return Promise.reject({
            meta: {
              status: constant.GENERAL_STATUS.FAIL,
            },
            message: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
          });
        }

        const exhibitorProfileRes = await this.getExhibitorProfileFromES(filterRecommendedCCDID, fairCode, language);
        const exhibitorProfiles = exhibitorProfileRes.data.hits;

        const combinedRes: Record<string, any>[] = [];
        items.map((item: Record<string, any>) => {
          const id = item.id;
          const ccdId = item.targetId;
          const sentTime = item.recommendationOfRecommendationItem.sentTime;
          const creationTime = item.creationTime;
          const interestedStatus = item.interestedStatus;
          const profile = {
            id,
            ccdId,
            sentTime,
            creationTime,
            interestedStatus,
            data: {},
          };

          exhibitorProfiles.map((exhibitorProfile: any) => {
            if (exhibitorProfile.ccdid === ccdId) {
              profile.data = exhibitorProfile;
            }
          });

          combinedRes.push(profile);
        });

        this.logger.log(JSON.stringify({ action: 'findpendingRecommendationRecord', section: 'c2m - recommendation', step: 'success' }));
        return Promise.resolve({
          meta: {
            status: constant.GENERAL_STATUS.SUCCESS,
          },
          data: {
            totalSize,
            exhibitor: combinedRes,
          },
        });
      })
      .catch((error) => {
        this.logger.log(
          JSON.stringify({
            action: 'findpendingRecommendationRecord',
            section: 'c2m - recommendation',
            step: 'error',
            detail: error,
          })
        );
        return Promise.reject({
          meta: {
            status: constant.GENERAL_STATUS.FAIL,
          },
          message: error?.message ?? JSON.stringify(error),
        });
      });
  }

  public async getTotalNumOfTDCRecommend(ssoUid: string, fairCode: string, fairYear: string) {
    this.logger.log(JSON.stringify({ action: 'getTotalNumOfTDCRecommend', step: 'start' }));
    const queryBuilder = this.recommendationItemRepository
      .createQueryBuilder('recommendationItem')
      .leftJoinAndSelect('recommendationItem.recommendationOfRecommendationItem', 'recommendation')
      .where(`recommendation.ssoUid = '${ssoUid}'`)
      .andWhere(`recommendation.fairCode = '${fairCode}'`)
      .andWhere(`recommendation.fairYear = '${fairYear}'`)
      .andWhere(`recommendation.publishType = '${PublishType.external}'`)
      .andWhere(
        new Brackets((qb) => {
          qb.where(`recommendationItem.interestedStatus = ${InterestedStatus.PENDING}`).orWhere(
            `recommendationItem.interestedStatus = ${InterestedStatus.INTERESTED}`
          );
        })
      );

    return queryBuilder
      .getCount()
      .then((result: any) => {
        this.logger.log(JSON.stringify({ action: 'getTotalNumOfTDCRecommend', step: 'success' }));
        return Promise.resolve({
          meta: {
            status: constant.GENERAL_STATUS.SUCCESS,
          },
          data: {
            result,
          },
        });
      })
      .catch((e) => {
        this.logger.log(JSON.stringify({ action: 'getTotalNumOfTDCRecommend', step: 'error', detail: e }));

        return Promise.reject({
          meta: {
            status: constant.GENERAL_STATUS.FAIL,
          },
          message: e?.message ?? JSON.stringify(e),
        });
      });
  }
  // --------------------------------------------- end of Recommend by tdc ---------------------------------------------

  // ------------------------------------------------ BM List ------------------------------------------------
  public async createRecommendBMListRecord(data: CreateRecommendationRecordMustInterface, fairCode: string, emailId: string) {
    const { ssoUid, publishType, fairYear, bmMessage, targetList } = data;

    if (!targetList.length) {
      this.logger.log(
        JSON.stringify({ action: 'createRecommendBMListRecord - POST - /createRecommendBMList', step: 'error', detail: 'empty recommend target list' })
      );
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: 'empty recommend target list',
      });
    }

    this.logger.log(JSON.stringify({ action: 'createRecommendBMListRecord - POST - /createRecommendBMList', step: 'start', detail: data }));

    const newRecord = {
      ssoUid,
      sentTime: new Date(),
      publishType,
      readStatus: ReadStatus.NOT_READ,
      emailStatus: NotificationStatus.NOT_SEND,
      notificationStatus: NotificationStatus.NOT_SEND,
      fairCode,
      fairYear,
      bmMessage,
      createdBy: emailId,
      creationTime: new Date(),
      lastUpdatedBy: emailId,
      lastUpdatedAt: new Date(),
    };
    return this.recommendationRepository
      .save(newRecord)
      .then((result) => {
        this.logger.log(
          JSON.stringify({
            action: 'createRecommendBMListRecord - POST - /createRecommendBMList',
            step: 'create recommendation success',
            detail: { id: result.id },
          })
        );

        const recommendationId = result.id;

        const newItemRecord = targetList.map((targetPayload) => {
          const targetId = targetPayload.ccdId;
          const targetFairCode = targetPayload.fairCode;
          const targetFiscalYear = targetPayload.fiscalYear;

          const tampData = {
            recommendationId,
            targetId,
            fairCode: targetFairCode,
            fiscalYear: targetFiscalYear,
            interestedStatus: publishType === PublishType.external ? InterestedStatus.PENDING : InterestedStatus.INTERESTED,
            createdBy: emailId,
            creationTime: new Date(),
            lastUpdatedBy: emailId,
            lastUpdatedAt: new Date(),
          };

          return tampData;
        });

        return Promise.all([result, this.recommendationItemRepository.save(newItemRecord)]);
      })
      .then(([result, itemResult]) => {
        this.logger.log(
          JSON.stringify({
            action: 'createRecommendBMListRecord - POST - /createRecommendBMList',
            step: 'create recommendationItem success',
            data: `${itemResult.length} record(s) insert success`,
          })
        );

        return Promise.all([
          result,
          itemResult,
          this.notificationService.checkNotiSentPerUsers(
            NotificationTemplatesId.NEW_BM_LIST,
            ChannelType.EMAIL,
            result.ssoUid,
            result.fairCode,
            result.fairYear
          ),
        ]);
      })
      .then(async ([result, itemResult, sendUpdatedBMList]) => {
        if (result.publishType === PublishType.external) {
          if (sendUpdatedBMList.length !== 0) {
            await this.c2mService.handleNotificationForBmList({
              templateId: NotificationTemplatesId.UPDATED_BM_LIST,
              notificationType: NotificationType.UPDATED_BM_LIST,
              receiverRole: ReceiverRole.BUYER,
              userData: result,
            });
          } else {
            await this.c2mService.handleNotificationForBmList({
              templateId: NotificationTemplatesId.NEW_BM_LIST,
              notificationType: NotificationType.NEW_BM_LIST,
              receiverRole: ReceiverRole.BUYER,
              userData: result,
            });
          }
        }

        return Promise.resolve({
          status: constant.GENERAL_STATUS.SUCCESS,
          message: `${itemResult.length} record(s) insert success`,
        });
      })
      .catch((error) => {
        this.logger.log(JSON.stringify({ action: 'createRecommendBMListRecord - POST - /createRecommendBMList', step: 'error', detail: error }));
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: error?.message ?? JSON.stringify(error),
        });
      });
  }

  public async checkDuplicateExhibitors(data: CheckDuplicateExhibitorsMustInterface, fairCode: string) {
    try {
      this.logger.log(JSON.stringify({ action: 'checkDuplicateExhibitors', step: 'start', detail: data }));
      const { ssoUid, fairYear, targetList } = data;

      if (!targetList.length) {
        return Promise.reject({
          status: constant.GENERAL_STATUS.FAIL,
          message: 'no exhibitor input',
        });
      }

      const filterExhibitorQArr = targetList.map((target: TargetExhibitorPayload) => {
        const { ccdId, fairCode, fiscalYear } = target;
        return `( targetId = "${ccdId}" AND fairCode = "${fairCode}" AND fiscalYear = "${fiscalYear}" )`;
      });
      const filterExhibitorQ = filterExhibitorQArr.join(' OR ');

      const targetDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
      const cutOffTime = moment(targetDate + ' ' + '16:00').format('YYYY-MM-DD HH:mm:ss');

      const findDuplicateQ = `
      SELECT
        *
      FROM vep_c2m_service_db.vepC2MBMRecommendationItem AS recommendationItem
      LEFT JOIN (
        SELECT
          id as rId,
          fairCode as buyerFairCode,
          fairYear as buyerFairYear,
          ssoUid as buyerSsoUid,
          sentTime as bmListSentTime,
          creationTime as bmListCreationTime,
          createdBy as bmListCreatedBy
        FROM vep_c2m_service_db.vepC2MBMRecommendation AS recommendation
      ) recommendation ON rId = recommendationItem.recommendationId
      LEFT JOIN (
        SELECT 
          faircode as eoaFairCode,
          fiscal_year as eoaFiscalYear,
          meta_value as eoaFairId
        FROM vep_content.vep_fair_setting AS eoaFairSetting
        WHERE meta_key = "eoa_fair_id" AND meta_value > 0
      ) eoaFairSetting ON eoaFairCode = recommendationItem.fairCode AND eoaFiscalYear = recommendationItem.fiscalYear
      LEFT JOIN (
        SELECT 
          companyCcdId as exhibitorCcdId,
          eoaFairId as exhibitorEoaFairId,
          companyName as exhibitorCompanyName,
          country as exhibitorCountryCode
        FROM vepExhibitorDb.vepExhibitor AS exhibitor
      ) exhibitor ON exhibitorCcdId = recommendationItem.targetId AND exhibitorEoaFairId = eoaFairSetting.eoaFairId
      LEFT JOIN (
        SELECT 
          code as countryCode,
          english_description as exhibitorCountry
        FROM vep_content.vep_council_global_country AS countryList
      ) countryList ON countryCode = exhibitor.exhibitorCountryCode
      WHERE buyerSsoUid = "${ssoUid}" AND buyerFairCode = "${fairCode}" AND buyerFairYear = "${fairYear}" AND bmListSentTime > "${cutOffTime}" AND ( ${filterExhibitorQ} )
      GROUP BY targetId, fairCode, fiscalYear, exhibitorCompanyName, exhibitorCountry
      `
        .split('\n')
        .join('')
        .replace(/ +/g, ' ');

      let duplicateExhibitorRecords: any;
      const connection = await getConnection('contentDatabase');
      const slaveRunner = connection.createQueryRunner('slave');
      try {
        duplicateExhibitorRecords = await connection.query(findDuplicateQ, undefined, slaveRunner);
      } catch (error) {
        console.log("Error in checkDuplicateExhibitors api", error);
      } finally {
        slaveRunner.release();
      }

      if (!duplicateExhibitorRecords.length) {
        this.logger.log(JSON.stringify({ action: 'checkDuplicateExhibitors', step: 'success', detail: 'no duplicate data' }));
        return Promise.resolve({
          status: constant.GENERAL_STATUS.SUCCESS,
          message: `0 duplicate data found`,
        });
      }

      const duplicatedExhibitors = duplicateExhibitorRecords.map((profile: any) => {
        return {
          ccdId: profile.targetId,
          fairCode: profile.fairCode,
          fairYear: profile.fiscalYear,
          name: `${profile.exhibitorCompanyName} - ${profile.exhibitorCountry}`,
        };
      });

      this.logger.log(JSON.stringify({ action: 'checkDuplicateExhibitors', step: 'success', detail: `${duplicatedExhibitors.length} duplicate data found` }));
      return Promise.resolve({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: {
          duplicates: duplicatedExhibitors,
        },
        message: `${duplicatedExhibitors.length} duplicate data found`,
      });
    } catch (error: any) {
      this.logger.log(JSON.stringify({ action: 'checkDuplicateExhibitors', step: 'error', detail: error }));
      return Promise.reject({
        status: constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error),
      });
    }
  }
  // --------------------------------------------- end of BM List ---------------------------------------------

  // ----------------------------------- Admin Portal - BM List Management -----------------------------------
  public generateMutiQuerySql(conditions: string, fieldName: string) {
    const conditionsArr = conditions.split(',');
    const tampSqlArr: string[] = [];

    if (fieldName === 'eAvoidMarkets') {
      conditionsArr.map((condition: string) => {
        tampSqlArr.push(`eAvoidMarkets LIKE "%${condition}%"`);
      });
    } else {
      conditionsArr.map((condition: string) => {
        tampSqlArr.push(`${fieldName} = "${condition}"`);
      });
    }

    const conditionSql = tampSqlArr.join(' OR ');
    const tampQuery = `( ${conditionSql} )`;
    return tampQuery;
  }

  public async bmListManagementCrossDBFilter(
    pageNum: string,
    pageSize: string,
    orderBy: string,
    sortOrder: string,
    filterOption: GetBMListManagementRecorFilter,
    type: 'query' | 'count'
  ) {
    let filterQueryArr: string[] = [];
    let freeTxtQueryArr: string[] = [];
    let filterSQL: string = ``;
    let order = `ORDER BY recommendationItemid DESC`;

    const limit = pageSize;
    const offset = (Number(pageSize) - 1) * (Number(pageNum) - 1);

    if (filterOption) {
      // buyerName: free text
      if (filterOption.buyerName) {
        let tampQuery = ``;
        if (/^[\u0000-\u007f]*$/.test(filterOption.buyerName)) {
          tampQuery = `( 
            match( frgFirstName ) AGAINST ( '${filterOption.buyerName}' IN BOOLEAN MODE) OR 
            match( frgLastname ) AGAINST ( '${filterOption.buyerName}' IN BOOLEAN MODE) OR 
            match( frgDisplayname ) AGAINST ( '${filterOption.buyerName}' IN BOOLEAN MODE) 
          )`;
        } else {
          tampQuery = `( 
            frgFirstName LIKE '%${filterOption.buyerName}%' OR
            frgLastname LIKE '%${filterOption.buyerName}%' OR
            frgDisplayname LIKE '%${filterOption.buyerName}%'
          )`;
        }
        freeTxtQueryArr.push(tampQuery);
      }

      // buyerCompany: free text
      if (filterOption.buyerCompany) {
        let tampQuery = ``;
        if (/^[\u0000-\u007f]*$/.test(filterOption.buyerCompany)) {
          tampQuery = `( match( frgCompanyName ) AGAINST ( '${filterOption.buyerCompany}' IN BOOLEAN MODE) )`;
        } else {
          tampQuery = `( frgCompanyName LIKE '%${filterOption.buyerCompany}%' )`;
        }
        freeTxtQueryArr.push(tampQuery);
      }

      // exhibitorName: free text
      if (filterOption.exhibitorName) {
        let tampQuery = ``;
        if (/^[\u0000-\u007f]*$/.test(filterOption.exhibitorName)) {
          tampQuery = `( match( exhibitorName ) AGAINST ( '${filterOption.exhibitorName}' IN BOOLEAN MODE) )`;
        } else {
          tampQuery = `( exhibitorName LIKE '%${filterOption.exhibitorName}%' )`;
        }
        freeTxtQueryArr.push(tampQuery);
      }

      // exhibitorCompany: free text
      if (filterOption.exhibitorCompany) {
        let tampQuery = ``;
        if (/^[\u0000-\u007f]*$/.test(filterOption.exhibitorCompany)) {
          tampQuery = `( match( exhibitorCompanyName ) AGAINST ( '${filterOption.exhibitorCompany}' IN BOOLEAN MODE) )`;
        } else {
          tampQuery = `( exhibitorCompanyName LIKE '%${filterOption.exhibitorCompany}%' )`;
        }
        freeTxtQueryArr.push(tampQuery);
      }

      // buyerFairCode: multiple(fairCode)
      if (filterOption.buyerFairCode) {
        const tampQuery = this.generateMutiQuerySql(filterOption.buyerFairCode, 'buyerFairCode');
        filterQueryArr.push(tampQuery);
      }

      // buyerFiscalyear: single
      if (filterOption.buyerFiscalyear) {
        const tampQuery = `( buyerProjectYear = "${filterOption.buyerFiscalyear}" )`;
        filterQueryArr.push(tampQuery);
      }

      // buyerType: multiple(1: general, 2: vip_cip, 3: vip_mission, 99: past)
      if (filterOption.buyerType) {
        const tampBTypeArr = filterOption.buyerType.split(',');
        const bTypeArr = tampBTypeArr.filter((word: string) => word === '1' || word === '2' || word === '3' || word === '99');

        let tampQuery = ``;
        bTypeArr.map((bType: string, index: number) => {
          index === 0 ? (tampQuery += `( `) : (tampQuery += ` OR `);
          tampQuery += `frgBuyerType = '${bType}'`;
        });
        tampQuery += ` )`;
        filterQueryArr.push(tampQuery);
      }

      // buyerCountry: multiple
      if (filterOption.buyerCountry) {
        let tampQuery = this.generateMutiQuerySql(filterOption.buyerCountry, 'frgCountry');
        filterQueryArr.push(tampQuery);
      }

      // eAvoidMarket: multiple
      if (filterOption.eAvoidMarket) {
        let tampQuery = this.generateMutiQuerySql(filterOption.eAvoidMarket, 'eAvoidMarkets');
        filterQueryArr.push(tampQuery);
      }

      // exhibitorCountry: multiple
      if (filterOption.exhibitorCountry) {
        let tampQuery = this.generateMutiQuerySql(filterOption.exhibitorCountry, 'exhibitorCountry');
        filterQueryArr.push(tampQuery);
      }

      // pavilion: multiple
      if (filterOption.pavilion) {
        let tampQuery = this.generateMutiQuerySql(filterOption.pavilion, 'pavilionValue');
        filterQueryArr.push(tampQuery);
      }

      // bmResponse: multiple(extInt, intInt, notInt, noReply)
      if (filterOption.bmResponse) {
        const tampBmResponseArr = filterOption.bmResponse.split(',');
        const bmResponseArr = tampBmResponseArr.filter((word) => word === 'extInt' || word === 'intInt' || word === 'notInt' || word === 'noReply');
        let tampQuery = ``;
        bmResponseArr.map((bmResponse: string, index: number) => {
          index === 0 ? (tampQuery += `( `) : (tampQuery += ` OR `);

          switch (bmResponse) {
            case 'extInt':
              tampQuery += `recommendation.publishType = '${PublishType.external}' AND recommendationItem.interestedStatus = '${InterestedStatus.INTERESTED}'`;
              break;
            case 'intInt':
              tampQuery += `recommendation.publishType = '${PublishType.internal}'`;
              break;
            case 'notInt':
              tampQuery += `recommendationItem.interestedStatus = '${InterestedStatus.NOT_INTERESTED}'`;
              break;
            case 'noReply':
              tampQuery += `recommendationItem.interestedStatus = '${InterestedStatus.PENDING}'`;
              break;
          }
        });
        tampQuery += ` )`;
        filterQueryArr.push(tampQuery);
      }

      // exhibitorFairCode: multiple(fairCode)
      if (filterOption.exhibitorFairCode) {
        let tampQuery = this.generateMutiQuerySql(filterOption.exhibitorFairCode, 'fairCode');
        filterQueryArr.push(tampQuery);
      }

      // buyerBranchOffice: multiple
      if (filterOption.buyerBranchOffice) {
        let tampQuery = this.generateMutiQuerySql(filterOption.buyerBranchOffice, 'bBranchOffice');
        filterQueryArr.push(tampQuery);
      }

      // publish: single( int | ext )
      if (filterOption.publish) {
        if (filterOption.publish === 'int') {
          filterQueryArr.push(`(recommendation.publishType = '${PublishType.internal}')`);
        } else if (filterOption.publish === 'ext') {
          filterQueryArr.push(`(recommendation.publishType = '${PublishType.external}')`);
        }
      }

      // arrangedOrPlanted: single( yes | no )
      if (filterOption.arrangedOrPlanted) {
        if (filterOption.arrangedOrPlanted === 'yes') {
          filterQueryArr.push(`(recommendationItem.meetingId IS NOT null)`);
        } else if (filterOption.arrangedOrPlanted === 'no') {
          filterQueryArr.push(`(recommendationItem.meetingId IS null)`);
        }
      }

      // default Buyer - search bm list by ssouid
      if (filterOption.defaultBuyerSsoUid && filterOption.defaultFairCode && filterOption.defaultFiscalYear) {
        let query = `(buyerSsoUid = '${filterOption.defaultBuyerSsoUid}' AND buyerFairCode = '${filterOption.defaultFairCode}' AND buyerFairYear = '${filterOption.defaultFiscalYear}')`;
        filterQueryArr.push(query);
      }
    }

    if (filterQueryArr.length || freeTxtQueryArr.length) {
      let tampSelectSql = '';
      let tampFreeTxtSql = '';

      if (filterQueryArr.length) {
        tampSelectSql = '( ' + filterQueryArr.join(' AND ') + ' )';
      }

      if (freeTxtQueryArr.length) {
        tampFreeTxtSql = '( ' + freeTxtQueryArr.join(' OR ') + ' )';
      }

      if (tampSelectSql && tampFreeTxtSql) {
        filterSQL = `WHERE ${tampFreeTxtSql} AND ${tampSelectSql}`;
      } else if (tampFreeTxtSql) {
        filterSQL = `WHERE ${tampFreeTxtSql}`;
      } else if (tampSelectSql) {
        filterSQL = `WHERE ${tampSelectSql}`;
      }
    }

    // ORDER BY
    if (orderBy && sortOrder) {
      if (sortOrder !== 'DESC' && sortOrder !== 'ASC') {
        sortOrder = 'DESC';
      }
      switch (orderBy) {
        case 'exhibitorCompany':
          order = `ORDER BY exhibitorCompanyName ${sortOrder}`;
          break;
        case 'exhibitorCountry':
          order = `ORDER BY exhibitorCountry ${sortOrder}`;
          break;
        case 'pavilion':
          order = `ORDER BY pavilion ${sortOrder}`;
          break;
        case 'buyerCoName':
          order = `ORDER BY frgCompanyName ${sortOrder}`;
          break;
        case 'buyerName':
          order = `ORDER BY frgDisplayname ${sortOrder}`;
          break;
        case 'buyerCountry':
          order = `ORDER BY frgCountry ${sortOrder}`;
          break;
        case 'bBranchOffice':
          order = `ORDER BY bBranchOffice ${sortOrder}`;
          break;
        case 'bRegFairLabel':
          order = `ORDER BY buyerFairCode ${sortOrder}`;
          break;
        case 'buyerType':
          order = `ORDER BY frgBuyerType ${sortOrder}`;
          break;
        case 'boothNo':
          order = `ORDER BY exhibitorBoothNumber ${sortOrder}`;
          break;
        case 'exhibitorFairLabel':
          order = `ORDER BY fairCode ${sortOrder}`;
          break;
        case 'eBrand':
          order = `ORDER BY eBrand ${sortOrder}`;
          break;
        case 'exhibitorName':
          order = `ORDER BY exhibitorName ${sortOrder}`;
          break;
        case 'exhibitorType':
          order = `ORDER BY exhibitorType ${sortOrder}`;
          break;
        case 'bmResponse':
          order = `ORDER BY interestedStatus ${sortOrder}`;
          break;
        case 'publish':
          order = `ORDER BY publishType ${sortOrder}`;
          break;
        case 'arrangedOrPlanted':
          order = `ORDER BY meetingId AND recommendationItemid ${sortOrder}`;
          break;
        case 'responseDate':
          order = `ORDER BY responseDate ${sortOrder}`;
          break;
        case 'bmListSentTime':
          order = `ORDER BY bmListSentTime ${sortOrder}`;
          break;
        case 'bFairVisit':
          order = `ORDER BY TRIM(buyerFairVisit) ${sortOrder}`;
          break;
        case 'bmStaff':
          order = `ORDER BY createdBy ${sortOrder}`;
          break;
        default:
          order = `ORDER BY recommendationItemid DESC`;
      }
    }

    let query = `
    SELECT
      ${
        type === 'query'
          ? `
        *,
        CASE WHEN recommendationItem.interestedStatus != 0 THEN recommendationItem.lastUpdatedAt ELSE null END as responseDate,
        recommendationItem.id as recommendationItemid
      `
          : `
        COUNT(DISTINCT(id)) as totalCount
      `
      }
    FROM vep_c2m_service_db.vepC2MBMRecommendationItem AS recommendationItem
    LEFT JOIN (
      SELECT
        id as rId,
        fairCode as buyerFairCode,
        fairYear as buyerFairYear,
        buyerProjectYear,
        ssoUid as buyerSsoUid,
        sentTime as bmListSentTime,
        creationTime as bmListCreationTime,
        createdBy as bmListCreatedBy,
        publishType,
        fptId,
        fptSsoUid,
        buyerRegistrationId,
        frgFairCode,
        frgFiscalYear,
        frgCompanyName,
        frgFirstName,
        frgLastname,
        frgDisplayname,
        frgCountry,
        frgBuyerType,
        buyerFairVisit,
        bBranchOffice
      FROM vep_c2m_service_db.vepC2MBMRecommendation AS recommendation
      LEFT JOIN (
        SELECT
          id as fptId,
          ssoUid as fptSsoUid,
          frgId as buyerRegistrationId,
          frgFairCode,
          frgFiscalYear,
          buyerProjectYear,
          frgCompanyName,
          frgFirstName,
          frgLastname,
          frgDisplayname,
          frgCountry,
          frgBuyerType,
          buyerFairVisit,
          bBranchOffice
        FROM vepFairDb.fairParticipant AS fpt
        LEFT JOIN (
          SELECT
            id as frgId,
            fairParticipantId as frgFptId,
            fairCode as frgFairCode,
            fiscalYear as frgFiscalYear,
            projectYear as buyerProjectYear,
            companyName as frgCompanyName,
            firstName as frgFirstName,
            lastName as frgLastname,
            displayName as frgDisplayname,
            addressCountryCode as frgCountry,
            fairParticipantTypeId as frgBuyerType,
            buyerFairVisit,
            overseasBranchOffice as bBranchOffice
          FROM vepFairDb.fairRegistration AS frg
          LEFT JOIN (
            SELECT
              fairRegistrationId as fairVisitRegId,
              TRIM(value) as buyerFairVisit
            FROM
              vepFairDb.fairRegistrationDynamicBM as fairVisit
            WHERE
              formFieldId = 'br_bm_fair_visit'
          ) fairVisit ON fairVisitRegId = frg.id
        ) frg ON frgFptId = fpt.id
      ) fpt ON fptSsoUid = recommendation.ssoUid AND frgFairCode = recommendation.fairCode AND frgFiscalYear = recommendation.fairYear
    ) recommendation ON rId = recommendationItem.recommendationId
    LEFT JOIN (
      SELECT 
        faircode as efsFairCode,
        fiscal_year as efsFiscalYear,
        meta_value as efsExhibitorEoaFairId
      FROM vep_content.vep_fair_setting AS efs
      WHERE meta_key = "eoa_fair_id" AND meta_value > 0
    ) efs ON efsFairCode = recommendationItem.fairCode AND efsFiscalYear = recommendationItem.fiscalYear
    LEFT JOIN (
      SELECT
        id as exhibitorId,
        companyCcdId as exhibitorCcdId,
        eoaFairId as exhibitorEoaFairId,
        companyName as exhibitorCompanyName,
        contactName as exhibitorName,
        firstName as exhibitorFirstName,
        lastName as exhibitorLastName,
        country as exhibitorCountry,
        vepType as exhibitorType,
        boothNumber as exhibitorBoothNumber
      FROM vepExhibitorDb.vepExhibitor AS exhibitor
      WHERE active = 1
    ) exhibitor ON exhibitorCcdId = recommendationItem.targetId AND exhibitorEoaFairId = efsExhibitorEoaFairId
    LEFT JOIN (
      SELECT
        companyCcdId as pavilionCcdId,
        eoaFairId as pavilionEoaFairId,
        value as pavilionValue,
        GROUP_CONCAT(DISTINCT pavilion.value ORDER BY pavilion.value ) as pavilion
      FROM vepExhibitorDb.vepExhibitorAttributes AS pavilion
      WHERE pavilion.attribute = 'pavilion' AND pavilion.locale = 'en'
      GROUP BY pavilion.companyCcdId, pavilion.eoaFairId
    ) pavilion ON pavilionCcdId = recommendationItem.targetId AND pavilionEoaFairId = efsExhibitorEoaFairId
    LEFT JOIN (
      SELECT
        companyCcdId as eBrandCcdId,
        eoaFairId as eBrandEoaFairId,
        GROUP_CONCAT(DISTINCT eBrand.value ORDER BY eBrand.value ) as eBrand
      FROM vepExhibitorDb.vepExhibitorAttributes AS eBrand
      WHERE eBrand.attribute = 'brandName'
      GROUP BY eBrand.companyCcdId, eBrand.eoaFairId
    ) eBrand ON eBrandCcdId = recommendationItem.targetId AND pavilionEoaFairId = efsExhibitorEoaFairId
    LEFT JOIN 
      vepExhibitorDb.exhibitorMarketPreference_view exhibitorMarketPreference 
    ON exhibitorMarketPreference.eQueCcdId = recommendationItem.targetId AND exhibitorMarketPreference.eQueEoaFairId = efsExhibitorEoaFairId
    LEFT JOIN (
      SELECT
        name as bmStaff,
        email as adminEmail
      FROM vep_admin.user as admin
    ) admin ON adminEmail = recommendationItem.createdBy
    ${filterSQL} 
    ${type === 'query' ? ` GROUP BY recommendationItemid ${order} LIMIT ${limit} OFFSET ${offset}` : ``}
    `
      .split('\n')
      .join('')
      .replace(/ +/g, ' ');
      
    let bmListRecords: any;
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      bmListRecords = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in bmListManagementCrossDBFilter api", error);
    } finally {
      slaveRunner.release();
    }
    if (bmListRecords.length) {
      if (type === 'count') {
        return bmListRecords[0].totalCount;
      } else {
        return bmListRecords;
      }
    }
    return [];
  }

  public async getBMListManagementRecord(pageNum: string, pageSize: string, orderBy: string, sortOrder: string, filterOption: GetBMListManagementRecorFilter) {
    try {
      this.logger.log(`action: "getBMListManagementRecord", step: "start", filterOption: ${filterOption ? filterOption : 'null'}}`);
      const items = await this.bmListManagementCrossDBFilter(pageNum, pageSize, orderBy, sortOrder, filterOption, 'query');
      const totalSize = await this.bmListManagementCrossDBFilter(pageNum, pageSize, orderBy, sortOrder, filterOption, 'count');

      const filterRecommendedCCDID: string[] = [];
      const tampSsouid: string[] = [];
      const filterBuyerInfo: { ssoUid: any; fairCode: any; fairYear: any }[] = [];
      const filterExhibitor: any = {};
      const filterMeetingId: string[] = [];
      const filterFairCode: string[] = [];

      items.map((item: Record<string, any>) => {
        const ccdId = item.targetId;
        const eFairCode = item.fairCode;
        const meetingId = item.meetingId;
        const ssoUid = item.fptSsoUid;
        const fairCode = item.buyerFairCode;
        const fairYear = item.buyerFairYear;
        const tampBuyerData = { ssoUid, fairCode, fairYear };

        if (!filterRecommendedCCDID.includes(ccdId)) {
          filterRecommendedCCDID.push(ccdId);
        }

        if (!tampSsouid.includes(ssoUid)) {
          tampSsouid.push(ssoUid);
          filterBuyerInfo.push(tampBuyerData);
        }

        if (!filterMeetingId.includes(meetingId)) {
          filterMeetingId.push(meetingId);
        }

        if (!filterFairCode.includes(fairCode)) {
          filterFairCode.push(fairCode);
        }

        if (filterExhibitor[eFairCode]) {
          if (!filterExhibitor[eFairCode].includes(ccdId)) {
            filterExhibitor[eFairCode].push(ccdId);
          }
        } else {
          filterExhibitor[eFairCode] = [ccdId];
        }
      });

      if (!filterRecommendedCCDID.length) {
        return Promise.reject({
          meta: {
            status: constant.GENERAL_STATUS.FAIL,
          },
          message: constant.RECOMMENDATION.BY_TDC.NO_RECORD_FOUND,
        });
      }

      const fairSrcList = await this.getFairList();
      const multipleFairData = await this.getMultipleFairDatas(filterFairCode);
      const eConfirmedMeetingCountData = await this.getEConfirmedMeetingCount(filterExhibitor, multipleFairData);
      // return eConfirmedMeetingCountData
      const eCheckedInCountData = await this.getECheckedInCountData(filterExhibitor, multipleFairData);

      const combinedRes: Record<string, any>[] = [];
      items.map((item: Record<string, any>) => {
        const id = item.id;
        const ssoUid = item.fptSsoUid;
        const ccdId = item.targetId;
        const exhibitorFair = item.fairCode;
        const bmListSentTime = item.bmListSentTime;
        const bmListCreationTime = item.bmListCreationTime;
        const bInterestedStatus = item.interestedStatus;
        const bRegFair = item.buyerFairCode;
        const bmStaff = item.bmStaff;
        const publish = item.publishType;
        const responseDate = item.responseDate;
        // const meetingId = item.meetingId;
        const exhibitorName = item.exhibitorName;
        const exhibitorFirstName = item.exhibitorFirstName;
        const exhibitorLastName = item.exhibitorLastName;
        const exhibitorCompany = item.exhibitorCompanyName;
        const exhibitorType = item.exhibitorType;
        const exhibitorCountry = item.exhibitorCountry;
        const boothNo = item.exhibitorBoothNumber;
        const eBrand = item.eBrand;
        const pavilion = item.pavilion;
        const arrangedOrPlanted = item.meetingId ? 'Y' : 'N';
        const bBranchOffice = item.bBranchOffice;
        const buyerCoName = item.frgCompanyName;
        const buyerName = item.frgDisplayname;
        const buyerFirstName = item.frgFirstName;
        const buyerLastName = item.frgLastname;
        const buyerCountry = item.frgCountry;
        const buyerType = item.frgBuyerType;
        const eAvoidMarkets = item.eAvoidMarkets;
        const buyerFairYear = item.buyerFairYear;
        const exhibitorFiscalYear = item.fiscalYear;
        const buyerRegistrationId = item.buyerRegistrationId;
        const bFairVisit = this.spaceTrim(item.buyerFairVisit);
        const eCurrentExportMarkets = item.eCurrentExportMarkets;

        let bmResponse = '';
        publish === 'internal'
          ? (bmResponse = 'Interest(int)')
          : bInterestedStatus === 0
          ? (bmResponse = 'No response')
          : bInterestedStatus === 1
          ? (bmResponse = 'Interest(ext)')
          : (bmResponse = 'Not Interested');

        const profile = {
          id,
          ssoUid,
          ccdId,
          bInterestedStatus,
          buyerRegistrationId,
          buyerCoName,
          buyerName,
          buyerFirstName,
          buyerLastName,
          buyerCountry,
          bBranchOffice,
          bRegFair,
          bRegFairLabel: '',
          buyerType,
          buyerFairYear,
          bmResponse,
          publish,
          responseDate,
          exhibitorCompany,
          exhibitorCountry,
          exhibitorFiscalYear,
          pavilion,
          boothNo,
          exhibitorFair,
          exhibitorFairLabel: '',
          eBrand,
          exhibitorName,
          exhibitorFirstName,
          exhibitorLastName,
          exhibitorType,
          bmListCreationTime,
          bmListSentTime,
          bmStaff,
          eAvoidMarkets,
          arrangedOrPlanted,
          eConfirmedMeeting: '0',
          eCheckedIn: '0',
          bFairVisit,
          eCurrentExportMarkets,
        };

        fairSrcList.map((fair: any) => {
          if (fair.fairCode === bRegFair) {
            profile.bRegFairLabel = `${fair.vmsProjectNo} - ${fair.fairShortName}`;
          }

          if (fair.fairCode === exhibitorFair) {
            profile.exhibitorFairLabel = `${fair.vmsProjectNo} - ${fair.fairShortName}`;
          }
        });

        eConfirmedMeetingCountData.map((data: any) => {
          if (data.exhibitorSsoUid === ccdId) {
            profile.eConfirmedMeeting = data.upComingCount;
          }
        });

        eCheckedInCountData.map((data: any) => {
          if (data.exhibitorSsoUid === ccdId) {
            profile.eCheckedIn = data.bothComfirmedCount;
          }
        });

        combinedRes.push(profile);
      });

      this.logger.log(JSON.stringify({ action: 'getBMListManagementRecord', section: 'getExhibitProfiles', step: 'success' }));
      return Promise.resolve({
        meta: {
          status: constant.GENERAL_STATUS.SUCCESS,
        },
        data: {
          totalSize,
          records: combinedRes,
        },
      });
    } catch (error: any) {
      this.logger.log(JSON.stringify({ action: 'getBMListManagementRecord', step: 'error', detail: error }));
      return Promise.reject({
        meta: {
          status: constant.GENERAL_STATUS.FAIL,
        },
        message: error?.message ?? JSON.stringify(error),
      });
    }
  }
  // -------------------------------- end of Admin Portal - BM List Management --------------------------------

  // const data = {
  //   exhibitors: [{ ccdId: '300002931538' }, { ccdId: '300002723461' }, { ccdId: '300002930062' }, { ccdId: '300002934032' }, { ccdId: '300002934034' }],
  // };
  public findRecommendedExhibitorForNoti(fairCode: string, fiscalYear: string, ssoUid: string, c2mParticipantStatusId: string): Promise<Record<string, any>> {


    return this.apiFairService
      .getMultipleFairDatas([fairCode])
      .then((result: any) => {
        if (c2mParticipantStatusId === '2' || c2mParticipantStatusId === '3') {
          return {
            status: HttpStatus.OK,
            data: []
          }
        }

        if (!result?.data?.length) {
          this.logger.log(JSON.stringify({ action: 'findRecommendedExhibitorForNoti', section: `Notification - handleKickOffBuyerReminder`, step: '1', detail: `[${fairCode}, ${fiscalYear} ${ssoUid}] fairCode not found` }));
          return Promise.reject('fairCode not found');
        }
        return result?.data?.[0].combinationName;
      })
      .then((combinationName: any) => {
        const fairName = combinationName || fairCode;
        // const data = { exhibitors: [{ ccdId: '300002723307' }] };
        // return data
        return this.findRecommendedExhibitor(ssoUid, fairName, fiscalYear);
      })
      .then((data) => {
        if (data.exhibitors.length === 0) {
          this.logger.log(JSON.stringify({ action: 'findRecommendedExhibitorForNoti', section: `Notification - handleKickOffBuyerReminder`, step: '3', detail: `[${fairCode}, ${fiscalYear} ${ssoUid}] recommended exhibitors not found` }));
          return Promise.reject({ status: 200, message: 'recommended exhibitors not found' });
        }

        let firstFourthData: any[] = [];
        if (data.exhibitors.length > 4) {
          // extract first forth exhibitors
          firstFourthData = data?.exhibitors?.slice(0, 4);
        } else {
          firstFourthData = data?.exhibitors;
        }

        return firstFourthData.map((exhibitor: any) => exhibitor.ccdId);
      })
      .then((ccdIdArr: any) => {
        if (ccdIdArr.length === 0) {
          this.logger.log(JSON.stringify({ action: 'findRecommendedExhibitorForNoti', section: `Notification - handleKickOffBuyerReminder`, step: '4', detail: `[${fairCode}, ${fiscalYear} ${ssoUid}] recommended exhibitors not found after slice` }));
          return Promise.reject({ status: 400, message: 'recommended exhibitors not found after slice' });
        }
        return this.getExhibitorProfileFromES(ccdIdArr, fairCode, 'en');
      })
      .then((esData: any) => {
        // if (esData.data.hits.length === 0) {
        //   return Promise.reject('no ES data');
        // }

        return {
          status: HttpStatus.OK,
          data: esData,
        };
      })
      .catch((err: any) => {
        if (err.status === 200) {
          return {
            status: HttpStatus.OK,
            data: []
          }
        } else {
          return {
            status: HttpStatus.BAD_REQUEST,
            message: err ?? JSON.stringify(err),
          }
        }
      });
  }

  private spaceTrim(str: string | undefined | null): string {
    if (typeof str === 'string') {
      return str.trim();
    }
      return 'N';
  }
}
