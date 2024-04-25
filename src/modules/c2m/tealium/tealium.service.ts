import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { constant } from '../../../config/constant';
import { Logger } from '../../../core/utils/logger.service';
import { Meeting } from '../../../entities/meeting.entity';
import { ContentApiService } from '../../api/content/content.service';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { MeetingRole } from '../meeting/meeting.type';

@Injectable()
export class TealiumService {
  constructor(
    @InjectRepository(Meeting)
    private meetingRepository: Repository<Meeting>,
    private exhibitorService: ApiExhibitorService,
    private contentService: ContentApiService,
    private logger: Logger,
  ) {}

    public async getExhibitorDataByMeetingId({ meetingId, exhibitorUrn, fairCode }: Record<string, any>): Promise<any> {
      return this.meetingRepository.createQueryBuilder('meeting')
      .where('meetingId = :meetingId', { meetingId })
      .getOne()
      .then(meetingData => {
        if (!meetingData) {
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: "No meeting data found"
          });
        }
        const targetFairCode = meetingData.requesterRole === MeetingRole.EXHIBITOR ? meetingData.fairCode : meetingData.responderFairCode;//
        return Promise.all([
          this.exhibitorService.getExhibitorDetail(exhibitorUrn, targetFairCode),
          Promise.resolve(meetingData)
        ]);
      })
      .then(([exhibitorResult, meetingData]) => {
        if (!exhibitorResult?.data?.data) {
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: "No exhibitor data found"
          })
        }
        this.logger.log(`action: "getExhibitorDataByMeetingId - exhibitorResult", step: "1", detail: ${JSON.stringify({
          exhibitorResult: exhibitorResult?.data
        })}})`);
        
        const { exhibitorUrn, countryDescEn, countryDescZhHant, countryDescZhHans, exhibitorPreferredNobs, supplierUrn: supplierId, exhibitorName: supplierCompanyName, exhibitorType: supplierType } = exhibitorResult?.data?.data;
        return Promise.all([
          Promise.resolve({
            meetingId: meetingData.meetingId,
            fairCode: meetingData.requesterRole === MeetingRole.EXHIBITOR ? meetingData.fairCode : meetingData.fairCode,
            fairYear: meetingData.requesterRole === MeetingRole.EXHIBITOR ? meetingData.fiscalYear : meetingData.responderFiscalYear,
            buyerSsoUid: meetingData.requesterRole === MeetingRole.EXHIBITOR ? meetingData.responderSsoUid : meetingData.requesterSsoUid,
            exhibitorUrn,
            supplierId,
            supplierCompanyName,
            supplierType,
            supplierCountry: {
              en: countryDescEn,
              tc: countryDescZhHant,
              sc: countryDescZhHans
            },
            supploerNobs: []
          }),
          exhibitorPreferredNobs?.length ? this.contentService.getNobValue(exhibitorPreferredNobs) : Promise.resolve({})
        ])
      })
      .then(([mappedData, nobResult]) => {
        let supploerNobs =  nobResult?.data?.data || null;
        if (supploerNobs) {
          supploerNobs = Object.values(supploerNobs).map((nob: any) => {
            return {
              en: nob?.en,
              tc: nob?.tc,
              sc: nob?.sc
            }
          })
        }
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          data: {
            ...mappedData,
            supploerNobs: supploerNobs ?? []
          }
        }
      })
      .catch(error => {
        this.logger.log(`action: "getExhibitorDataByMeetingId - error", step: "error", detail: ${JSON.stringify(error)}})`);
        return {
          status: error?.status ?? constant.GENERAL_STATUS.FAIL,
          message: error?.message ?? JSON.stringify(error)
        }
      })
    }
}
