import { Body, Controller, Get, Post } from '@nestjs/common';
import moment from 'moment';
import { ApiFairService } from '../../api/fair/fair.service';
import { MeetingEndingIn } from '../videoConference/videoConference.type';
import { MeetingSchedulerService } from './meetingScheduler.service';
import { VideoConferenceSchedulerService } from './videoConferenceScheduler.service';
import { Logger } from '../../../core/utils';
import { getConnection } from 'typeorm';

@Controller('scheduler')
export class SchedulerController {
  private canRunCronJob: boolean = false;
  constructor(
    private logger: Logger,
    private meetingScheduler: MeetingSchedulerService,
    private videoConferenceScheduler: VideoConferenceSchedulerService,
    private fairService: ApiFairService
  ) {
    this.checkIsAbleToRunCronJob();
  }

  private checkIsAbleToRunCronJob(): void {
    const env = process.env.NODE_ENV;
    if (!env || env === 'develop') {
      this.canRunCronJob = false;
    } else {
      this.canRunCronJob = true;
    }
    console.log("canRunCronJob: ", this.canRunCronJob);
  }

  /*
  C2M Kick off Reminder - Meeting
  */
  @Get('/KickOffMeetingReminder')
  public async KickOffMeetingReminder(): Promise<any> {
    const redisKey = 'KickOffMeetingReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - KickOffMeetingReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('KickOffMeetingReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  C2M Kick off Reminder - Exhibitor
  */
  @Get('/exhibitorLoginReminder')
  public async exhibitorLoginReminder(): Promise<any> {
    const redisKey = 'exhibitorLoginReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - exhibitorLoginReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('exhibitorLoginReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  C2M Kick off Reminder - Buyer
  */
  @Get('/buyerLoginReminder')
  public async buyerLoginReminder(): Promise<any> {
    const redisKey = 'buyerLoginReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - buyerLoginReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('buyerLoginReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  C2M Daily Reminder - Meeting
  */
  @Get('/dailyMeetingReminder')
  public async dailyMeetingReminder(): Promise<any> {
    const redisKey = 'dailyMeetingReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - dailyMeetingReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('dailyMeetingReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  Schedule Meeting Noti Retry
  */
  @Get('/retrySendingMeetingNoti')
  public retrySendingMeetingNoti(): Record<string, any> {
    return this.meetingScheduler.retrySendingMeetingNoti();
  }

  /*
  Auto Cancel C2M Pending Meeting
  */
  @Get('/cancelPendingMeetingsOverHrs')
  public cancelPendingMeetingsOverHrs(): Record<string, any> {
    return this.meetingScheduler.cancelPendingMeetingsOverHrs();
  }

  /*
  C2M Upcoming Reminder - Meeting
  */
  @Get('/findUpcomingMeeingsOver15Min')
  public findUpcomingMeeingsOver15Min(): Record<string, any> {
    return this.meetingScheduler.findUpcomingMeeingsOver15Min()
  }

  /*
  Attending Seminar Reminder - Seminar
  */
  @Get('/attendingSeminarReminder')
  public async attendingSeminarReminder(): Promise<any> {
    const redisKey = 'attendingSeminarReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - attendingSeminarReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.seminarSummaryNoti('attendingSeminarReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  Seminar Summary Reminder - Seminar
  */
  @Get('/seminarSummaryReminder')
  public async seminarSummaryReminder(): Promise<any> {
    const redisKey = 'seminarSummaryReminder';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - attendingSeminarReminder', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.seminarSummaryNoti('seminarSummaryReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  Schedule Seminar Noti Retry
  */
  @Get('/retrySendingSeminarNoti')
  public retrySendingSeminarNoti(): Record<string, any> {
    return this.meetingScheduler.retrySendingSeminarNoti();
  }

  /*
  Schedule Seminar Summary Noti Retry
  */
  @Get('/retrySendingSeminarSummaryNoti')
  public retrySendingSeminarSummaryNoti(): Record<string, any> {
    return this.meetingScheduler.retrySendingSeminarSummaryNoti();
  }

  /*
  No response is received - BM List
  */
  @Get('/noResponseInBmList')
  public async noResponseInBmList(): Promise<any> {
    const redisKey = 'noResponseInBmList';
    // await this.fairService.deleteCache(redisKey);
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - noResponseInBmList', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('noResponseInBmListReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  Not Enough Interest - BM List
  */
  @Get('/notEnoughInterestInBmList')
  public async notEnoughInterestInBmList(): Promise<any> {
    const redisKey = 'notEnoughInterestInBmList';
    const cache = await this.fairService.getApiCache(redisKey);

    if (cache) {
      this.logger.log(JSON.stringify({ action: 'get cache', section: 'Notification - notEnoughInterestInBmList', step: '1', detail: `cache is set. cache: ${cache}` }));
      return;
    } else {
      const cahceresult = await this.fairService.setApiCacheForNoti(redisKey , '1');
      console.log(cahceresult)

      const reuslt = await this.meetingScheduler.C2MMeetingReminder('notEnoughInterestInBmListReminder');
      const delCacheResult = await this.fairService.deleteCache(redisKey);
      return {
        reuslt,
        delCacheResult,
      }
    }
  }

  /*
  Schedule BM Noti Retry
  */
  @Get('/retrySendingBMNoti')
  public retrySendingBMNoti(): Record<string, any> {
    return this.meetingScheduler.retrySendingBMNoti();
  }

  @Get('/askForMeetingsExtension')
  public async askForMeetingsExtension(@Body() body: Record<string, any>): Promise<any> {
    const { timeFromLambda } = body;
    await this.awaitTimeGap(timeFromLambda, 1);
    return this.videoConferenceScheduler.askForMeetingsExtension(moment.tz(timeFromLambda, "UTC").set({ second: 0, millisecond: 0 }).add(5, 'minutes').toDate());
  }

  @Get('/killVideoConferenceConnections')
  public killVideoConferenceConnections(): Record<string, any> {
    return this.videoConferenceScheduler.killVideoConferenceConnections();
  }

  @Get('/startVideoConferences')
  public startVideoConferences(): Record<string, any> {
    return this.videoConferenceScheduler.startVideoConferences();
  }

  public wait(ms: any): Promise<void> {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
  };

  @Post('/checkIfMeetingsAreEndingInTenMinutes')
  public async checkIfMeetingsAreEndingInTenMinutes(@Body() body: Record<string, any> = {timeFromLambda: moment().utc()}): Promise<any> {
    const { timeFromLambda } = body;
    const targetTime = await this.awaitTimeGap(timeFromLambda, 1);
    return this.videoConferenceScheduler.checkIfMeetingsAreEndingSoon(MeetingEndingIn.TEN_MINUTES, targetTime);
  }

  @Post('/checkIfMeetingsAreEndingInFiveMinutes')
  public async checkIfMeetingsAreEndingInFiveMinutes(@Body() body: Record<string, any> = {timeFromLambda: moment().utc()}): Promise<any> {
    const { timeFromLambda } = body;
    const targetTime = await this.awaitTimeGap(timeFromLambda, 1);
    return this.videoConferenceScheduler.checkIfMeetingsAreEndingSoon(MeetingEndingIn.FIVE_MINUTES, targetTime);
  }

  public async awaitTimeGap(targetTime: string, min: number) {
    const now = moment.tz(targetTime, "UTC");
    const nextMin = moment(now).set({ second: 0, millisecond: 0 }).add(min, 'minutes');
    const diffInMillionsecond = moment(nextMin).diff(moment(now));
    if (diffInMillionsecond > 0) {
      await this.wait(diffInMillionsecond);
    }
    return moment.tz(now, "UTC").format('YYYY-MM-DD HH:mm:ss');
  }
  
  @Get('/stopRtmpBySeminarEndTime')
  public stopRtmpBySeminarEndTime(): Promise<any>  {
    return this.fairService.stopRtmpBySeminarEndTime()
    .then(result => {
      return result.data;
    })
    .catch(error => {
      return error;
    })
  }

  @Get('/updatePlaybackByExistingVODFile')
  public updatePlaybackByExistingVODFile(): Promise<any>  {
    return this.fairService.updatePlaybackByExistingVODFile()
    .then(result => {
      return result.data;
    })
    .catch(error => {
      return error;
    })
  }

  @Get('/callExhibitorMarketPreferenceView')
  public callExhibitorMarketPreferenceView(): Promise<any> {
    return getConnection("exhibitorDatabase").query("CALL exhibitorMarketPreferenceView()");
  }

}
