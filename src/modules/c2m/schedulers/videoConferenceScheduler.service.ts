import { Injectable } from '@nestjs/common';
import { Between, getConnection, In, LessThan } from 'typeorm';
import { Logger } from '../../../core/utils';
import { Meeting } from '../../../entities/meeting.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { LambdaService } from '../../api/lambda/lambda.service';
import { ZoomService } from '../../api/zoom/zoom.service';
import { MeetingService } from '../meeting/meeting.service';
import { LiveStatus, MeetingStatus, MESSAGE_TYPE, SENDBIRD_MESSAGE_TYPE, SYSTEM_MESSAGE } from '../meeting/meeting.type';
import { ReuseLicenseService } from '../reuseLicense/reuseLicense.service';
import { VideoConferenceService } from '../videoConference/videoConference.service';
import { CallBackEvent, MeetingEndingIn } from '../videoConference/videoConference.type';

@Injectable()
export class VideoConferenceSchedulerService {
  constructor(
    //
    private logger: Logger,
    private videoConferenceService: VideoConferenceService,
    private meetingService: MeetingService,
    private zoomService : ZoomService,
    private reuseLicense: ReuseLicenseService,
    private lambdaService: LambdaService
  ) {}

  public async askForMeetingsExtension(targetTime: Date): Promise<void> {
    const meetings: Meeting[] = await this.meetingService.findByParams({
      isExtended: false,
      isRefusedExtend: false,
      status: 1,
      endTime: Between(new Date(), targetTime),
    });

    const promises = meetings.map(async (meeting: Meeting) => {
      const { responderSsoUid, requesterSsoUid, endTime } = meeting;

      return new Promise((resolve: (value: Record<string, any>) => void, reject: (reason?: any) => void) => {
        this.meetingService
          .findNextMeetings([responderSsoUid, requesterSsoUid], endTime)
          .then((nextMeetings: Meeting[]) => {
            resolve({
              meetingId: meeting.meetingId,
              haveNextMeetings: nextMeetings.length > 0,
            });
          })
          .catch((error: any) => {
            reject(error);
          });
      });
    });

    const mappings = await Promise.all(promises);

    const callbackPromises = mappings
      .filter((mapping: Record<string, any>) => !mapping.haveNextMeetings)
      .map(async (mapping: Record<string, any>) => {
        this.logger.log(`Meeting ${mapping.meetingId} will be asked for extension`);
        return this.videoConferenceService.actionCallBackToRoom(CallBackEvent.EXTEND_MEETING, mapping.meetingId, null, { extendDuration: 30 });
      });

    await Promise.all(callbackPromises);
    if (callbackPromises.length) {
      this.logger.log(JSON.stringify({
        action: 'C2M',
        section: 'ask meeting extend cron job result',
        step: '1',
        detail: { meetingIDs: meetings.map((e: Meeting) => e.id), callbackPromises },
      }));
    }
    this.logger.log(`Callback to all ongoing meetings to ask for extension. Count: ${callbackPromises.length}.`);
  }

  public killZoom(meetingData: Meeting[]) {
    meetingData.forEach((meeting: Meeting) => {
      Promise.all([
        this.zoomService.deleteMeeting(meeting.zoomId!),
        this.meetingService.updateZoomInfo(meeting, null, null, null),
        this.reuseLicense.releaseZOOMLicense({ meetingId: `${meeting.meetingId}`})
      ])
      .catch(error => {
        this.logger.log(`VideoConferenceSchedulerService error -> meetingData: ${ meetingData } , error: ${ error }`);
      })
    })
  }

  public async deleteSendBirdChannel(meetingIds: String[]): Promise<any> {
    meetingIds.forEach(id => {
      this.lambdaService.deleteChannel({ channelId: id })
      .catch(error => {
        this.logger.log(`deleteSendBirdChannel - error - Can't delete send bird channel to (meeting id) :  ${id}, error: ${error?.message ?? JSON.stringify(error)}`);
      });
    });
  }


  public releaseSendbirdLicense(meetingIds: string[]) {
    meetingIds.forEach((id: string) => {
      this.reuseLicense.deactivateSendbirdLicenseRecord({meetingId: `${id}`})
      .catch(error => {
        this.logger.log(`VideoConferenceSchedulerService error -> meetingIds: ${ meetingIds } , error: ${ error }`);
      })
    })
  }

  public async killVideoConferenceConnections(): Promise<void> {
    // Get ended meetings
    this.meetingService.findByParams({ endTime: LessThan(new Date()), status: MeetingStatus.ACCEPTED, liveStatus: LiveStatus.RUNNING })
    .then((result: Meeting[]) => {
      if (!result || !result.length) {
        // no meeting need to be killed
        return;
      }

      const meetingToBeKill: Promise<any>[] = [];
      const zoomsToBeKill: Meeting[] = [];
      const meetingIds: string[] = [];

      result.forEach((meeting: Meeting) => {
        meetingIds.push(meeting.meetingId);
        meetingToBeKill.push(this.videoConferenceService.actionCallBackToRoom(CallBackEvent.ENDED_MEETING, meeting.meetingId));
        if (meeting.zoomId) {
          zoomsToBeKill.push(meeting);
        }
      });

      this.killZoom(zoomsToBeKill);
      this.releaseSendbirdLicense(meetingIds);
      this.notifyChatroom(meetingIds)
      .finally(() => {
        return this.deleteSendBirdChannel(meetingIds);
      })

      return Promise.all([
        this.videoConferenceService.findLiveConnections(meetingIds),
        this.meetingService.updateMeetingLiveStatus(meetingIds, LiveStatus.ENDED),
        Promise.all(meetingToBeKill),
      ]);
    })
    .then(([VCRecord]: any) => {
      return Promise.all(
        VCRecord.map((VC: VideoConference) => 
          this.videoConferenceService.killConnection(VC.connectionId)
          .catch((error: PromiseRejectedResult) => {
            return this.videoConferenceService.handlePromiseRejectedResults([error]);
          })
        )
      )
    })
    .catch(error => {
      this.logger.log(`killVideoConferenceConnections error ->  error: ${ error }`);
    })
  }

  public async notifyChatroom(meetingIds: String[]): Promise<any> {
    const notifyChatroomPromise: Promise<any>[] = [];
    meetingIds.forEach(id => {
        notifyChatroomPromise.push(
          this.lambdaService.sendMessageToMeetingChatroom({
          messageType: SENDBIRD_MESSAGE_TYPE.MESG,
          message: SYSTEM_MESSAGE.MEETING_END,
          channelId: id,
          customType: MESSAGE_TYPE.SYSTEM
        }).catch(error => {
          this.logger.log(`notifyChatroom - error - Can't send message to (meeting id) :  ${id}, message: ${SYSTEM_MESSAGE.MEETING_END}, error: ${error?.message ?? JSON.stringify(error)}`);
        })
      )
    })
    return Promise.all(notifyChatroomPromise);
  }

  public async startVideoConferences(): Promise<void> {
    const meetings = await this.meetingService.findByParams({ startTime: LessThan(new Date()), status: MeetingStatus.ACCEPTED, liveStatus: LiveStatus.PENDING })
    const targetMeetingIds = meetings.map((meeting: Meeting) => meeting.id);

    getConnection()
    .createQueryBuilder()
    .update('vepC2MMeeting')
    .set({ liveStatus: LiveStatus.RUNNING })
    .where({ id: In(targetMeetingIds) })
    .execute()
    .catch(error => {
      this.logger.log(`Error trying to update the meeting live status, ids: ${targetMeetingIds}, error: ${error}`);
    })
  }

  public async checkIfMeetingsAreEndingSoon(mins: MeetingEndingIn, now: string): Promise<void> {
    return this.videoConferenceService.checkIfMeetingsAreEndingSoon(mins, now);
  } 
}
