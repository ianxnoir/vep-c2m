import { Body, Controller, Get, HttpStatus, Param, Post, Logger } from '@nestjs/common';
import { NotiSqsMessageBodyDto } from '../../../dto/NotiSqsMessageBodyMetaDataDto';
import { ResetPendingMeetingNotificationStatus } from '../../../dto/resetPendingMeetingNotificationStatus.dto';
import { ApiFairService } from '../../api/fair/fair.service';
import { SnsService } from '../../api/sns/sns.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private apiFairService: ApiFairService,
    private recommendationService: RecommendationService,
    private snsService: SnsService,
    private logger: Logger,
  ) {}

  @Get('getNotificationRecordByMeetingId/:meetingId')
  public getNotificationRecordByMeetingId(@Param('meetingId') meetingId: number): Record<string, any> {
    return this.notificationService.getNotificationRecordByMeetingId(meetingId);
  }

  @Post('updateNotificationStatus')
  public updateNotificationStatus(@Body() body: any): Record<string, any> {
    const { meetingId, notificationId, status, retryCount } = body;
    return this.notificationService.updateNotificationStatus({ meetingId, notificationId, status, retryCount });
  }

  @Post('createNotificationRecord')
  public createNotificationRecord(@Body() body: any): Record<string, any> {
    const { meetingId, templateId, channelType, notificationType, receiverRole } = body;
    return this.notificationService.createNotificationRecord({ meetingId, templateId, channelType, notificationType, receiverRole });
  }

  @Post('getTemplateContent')
  public getTemplateContent(@Body() body: any): Record<string, any> {
    const { templateId, fairCode } = body;
    return this.notificationService.getTemplateContent({ templateId, fairCode });
  }

  @Post('getMessageBodyForSns')
  public getMessageBodyForSns(@Body() body: any): Record<string, any> {
    const { templateId, templateSource } = body;
    return this.notificationService.getMessageBodyForSns({ templateId, templateSource });
  }


  @Post('getTemplateContentR2BVersion')
  public getTemplateContentR2BVersion(@Body() body: any): Record<string, any> {
    const { templateId } = body;
    return this.notificationService.getTemplateContentR2BVersion({ templateId });
  }

  @Post('checkNotiSentPerUsers')
  public checkNotiSentPerUsers(@Body() body: any): Record<string, any> {
    const { templateId, channelType, refUserId, refFairCode, refFiscalYear } = body;
    return this.notificationService.checkNotiSentPerUsers(templateId, channelType, refUserId, refFairCode, refFiscalYear);
  }

  // this is fake, used to test
  @Post('notification/fairs/:fairCode/fiscalYear/:fiscalYear/recommendations/buyers')
  public async findRecommendedExhibitor(
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string,
    @Body() body: any
  ): Promise<Record<string, any>> {
    const { ssoUid } = body;

    if (ssoUid) {
      return this.apiFairService.getMultipleFairDatas([fairCode])
      .then((result: any) => {
        if (!result?.data?.length) {
          return Promise.reject('fairCode not found');
        }
        return result?.data?.[0].combinationName;
      })
      .then(async (combinationName: any) => {
        // const data = await this.recommendationService.findRecommendedExhibitor(ssoUid, combinationName, fiscalYear);
        const data = { exhibitors: [ { ccdId: '300002727346' }, { ccdId: '300002723377' }, { ccdId: '300002927626' }, { ccdId: '300002723317' }] };
        return data?.exhibitors?.map((exhibitor: any) => exhibitor.ccdId);
      })
      .then(async (ccdIdArr: any) => {
          const esData = await this.recommendationService.getExhibitorProfileFromES(ccdIdArr, fairCode, 'en');
          // const eoaData = await this.exhibitorService.filterExhibitorWithPagination(fairCode, fairYear, { companyCcdId: ccdIdArr }, undefined, paginateOption);
          return {
          // totalSize: esData?.total_size,
          // rows: esDataRestructurer(esData?.data?.hits)
            status: HttpStatus.OK,
            data: esData
        };
      })
      .catch((err:any) => ({
          status: HttpStatus.BAD_REQUEST,
          message: err ?? JSON.stringify(err)
      }));
    }
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'SSOUID not found'
      };
  }

  @Post('resetPendingMeetingNotificationStatus')
  public resetPendingMeetingNotificationStatus(@Body() body: ResetPendingMeetingNotificationStatus) {
    const { oldUserId, newUserId } = body;
    return this.notificationService.resetPendingMeetingNotificationStatus(oldUserId, newUserId);
  }

  @Post("/mock-send-sns-msg")
  public async postSnsMessageBody(@Body() notiSqsMessageBodyDto: NotiSqsMessageBodyDto) {
    try {
        let msgBody = notiSqsMessageBodyDto; // handling metadata and placeholder
        let result = await this.snsService.sendNotificationBySns(msgBody, msgBody.channels, msgBody.queueType);
        this.logger.log("sns result");
        this.logger.log(result);
        return result;
    } catch (e) {
      console.error(e);
      return {
        error: JSON.stringify(e),
        data: ""
      };
    }
  }

  // to-do - ricky - delete records by some condition
}
