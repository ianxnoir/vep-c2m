import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosResponse } from 'axios';
import moment from 'moment';
import { AwsV4HttpService } from 'nestjs-aws-v4';
import TLSSigAPIv2 from 'tls-sig-api-v2-typescript';
import { DeepPartial, In, IsNull, Not, Repository } from 'typeorm';
import { VideoConference } from '../../../entities/videoConference.entity';
import { LambdaService } from '../../api/lambda/lambda.service';
import { MeetingService } from '../meeting/meeting.service';
import { LiveStatus, MeetingStatus, MESSAGE_TYPE, SENDBIRD_MESSAGE_TYPE, SYSTEM_MESSAGE, SYSTEM_MESSAGE_TYPE } from '../meeting/meeting.type';
import { CallBackEvent, EndMeetingEvent, MeetingEndingIn, MINUTES, Role } from './videoConference.type';

export const BM_QUOTA = 3;
export const HOST_QUOTA = 2;
export const GUEST_QUOTA = 4;

export const BEFORE_START_TIME = 15;

export const TDC_COMPANY_NAME = 'TDC';

@Injectable()
export class VideoConferenceService {
  private trtcSecretArn: string;
  private trtcExpire: number;
  constructor(
    private configService: ConfigService,
    @InjectRepository(VideoConference)
    private videoConferenceRepository: Repository<VideoConference>,
    private http: AwsV4HttpService,
    private meetingService: MeetingService,
    private lambdaService: LambdaService,
    private logger: Logger
  ) {
    this.trtcSecretArn = this.configService.get('trtc.secretArn') || '';
    this.trtcExpire = this.configService.get('settings.trtc_expire') || 0;
  }

  public async findLiveConnections(meetingIds: string[]): Promise<VideoConference[]> {
    return this.videoConferenceRepository.find({ meetingId: In(meetingIds), disconnectedAt: IsNull() });
  }

  public async findByParams(params: Record<string, any>): Promise<VideoConference | undefined> {
    return this.videoConferenceRepository.findOne(params);
  }

  public async findByMeetingId(meetingId: string): Promise<VideoConference[]> {
    return this.videoConferenceRepository.find({
      where: [
        { meetingId, disconnectedAt: IsNull(), isAdmitted: true },
        { meetingId, disconnectedAt: IsNull(), role: Role.HOST },
        { meetingId, disconnectedAt: IsNull(), role: Role.BM },
      ],
    });
  }

  public async findOneByMeetingId(meetingId: string, fields: Record<string, any> = {}): Promise<Nullable<VideoConference>> {
    const vc = await this.videoConferenceRepository.findOne({
      ...fields,
      meetingId,
    });

    return vc || null;
  }

  public async findOneById(meetingId: string, ssoUid: string, connectionId: string, fields: Record<string, any> = {}): Promise<Nullable<VideoConference>> {
    const vc = await this.videoConferenceRepository.findOne({
      where: [
        { meetingId, ssoUid, ...fields },
        { meetingId, connectionId, ...fields },
      ],
    });

    return vc || null;
  }

  public async upsertRoomConnection(meetingId: string, ssoUid: string, connectionId: string, data: DeepPartial<VideoConference>): Promise<VideoConference> {
    const vc = await this.videoConferenceRepository.findOne({
      where: [
        { meetingId, ssoUid, isKicked: false },
        { meetingId, connectionId, isKicked: false },
      ],
    });
    data.id = vc?.id;
    data.meetingId = meetingId;
    data.connectionId = connectionId;
    data.ssoUid = ssoUid;
    data.disconnectedAt = null;

    const result = await this.videoConferenceRepository.save(data);
    await this.meetingService.updateMeetingByMeetingId(result.meetingId, result.ssoUid, 1);
    return result;
  }

  public async removeRoomConnection(connectionId: string): Promise<Nullable<VideoConference>> {
    let vc = await this.videoConferenceRepository.findOne({ connectionId });

    if (vc) {
      vc.disconnectedAt = new Date();
      vc = await this.videoConferenceRepository.save(vc);
    }

    return vc || null;
  }

  public async checkCanStartVideoConference(meetingId: string): Promise<boolean> {
    const connections = await this.videoConferenceRepository.find({
      where: { meetingId, disconnectedAt: IsNull() },
    });

    const bmCount = connections.filter((vc: VideoConference) => vc.role === Role.BM).length;

    // At least 2 people and not only BM connected
    return connections.length >= 2 && connections.length !== bmCount;
  }

  public async checkQuota(meetingId: string, role: Role): Promise<boolean> {
    let quotaQuery: Record<string, any> = {
      meetingId,
      role,
      disconnectedAt: IsNull()
    };

    if (role === Role.GUEST) {
      quotaQuery.isAdmitted = true;
    }

    const connections = await this.videoConferenceRepository.find({ where: quotaQuery });
    const currentCapacity = connections.filter((conn: VideoConference) => conn.role === role).length;

    switch (role) {
      case Role.HOST:
        return currentCapacity >= HOST_QUOTA;
      case Role.GUEST:
        return currentCapacity >= GUEST_QUOTA;
      case Role.BM:
        return currentCapacity >= BM_QUOTA;
      default:
        return false;
    }
  }

  public async actionCallBackToRoom(
    event: CallBackEvent,
    meetingId: string,
    fromConnectionId: Nullable<string> = null,
    payload: Record<string, any> = {}
  ): Promise<AxiosResponse[]> {
    const wsUrl = this.configService.get<string>('api.WEBSOCKET_URI');

    const hostConditions = { meetingId, role: In([Role.BM, Role.HOST]), disconnectedAt: IsNull() };
    const normalConditions = [
      { meetingId, role: Not(Role.GUEST), disconnectedAt: IsNull() },
      { meetingId, role: Role.GUEST, isAdmitted: true, disconnectedAt: IsNull() },
    ];

    // Filter callback to BM / HOST only
    const isHostEvent = [CallBackEvent.REQUEST_TO_JOIN, CallBackEvent.REJECTED_GUEST, CallBackEvent.EXTEND_MEETING, CallBackEvent.EXTEND_MEETING_WHEN_COLLIDED].includes(event);

    const connections = await this.videoConferenceRepository.find({
      where: isHostEvent ? hostConditions : normalConditions,
    });

    const promises = connections.map(async (connection: VideoConference) => {
      const url = `${wsUrl}/@connections/${connection.connectionId}`;
      return this.http.post(url, { event, payload: { ...payload, fromConnectionId } }).toPromise();
    });

    return Promise.all(promises);
  }

  public async actionCallBackToUser(event: CallBackEvent, targetConnectionId: string, payload: Record<string, any> = {}): Promise<AxiosResponse> {
    const wsUrl = this.configService.get<string>('api.WEBSOCKET_URI');
    const url = `${wsUrl}/@connections/${targetConnectionId}`;

    return this.http.post(url, { event, payload }).toPromise();
  }

  public async killConnection(targetConnectionId: string): Promise<AxiosResponse> {
    const wsUrl = this.configService.get<string>('api.WEBSOCKET_URI');
    const url = `${wsUrl}/@connections/${targetConnectionId}`;

    return this.http.delete(url).toPromise();
  }

  public handlePromiseRejectedResults(rejectedPromises: PromiseRejectedResult[]): Promise<Nullable<VideoConference>>[] {
    // Remove room connection if gone
    const connectionIds = rejectedPromises.map((result: PromiseRejectedResult) => {
      const { path }: { path: string } = result.reason.request;
      return path.split('/').slice(-1).pop() || null;
    });

    const uniqueConnectionIds = Array.from(new Set(connectionIds));

    return uniqueConnectionIds.map(async (connectionId: any) => this.removeRoomConnection(connectionId));
  }

  public getUserSig(sdkAppId: number, secretKey: string, ssoUid: string, expire: number): string {
    const api = new TLSSigAPIv2.Api(sdkAppId, secretKey);
    return api.genSig(ssoUid, expire);
  }

  public wait(ms: any): Promise<void> {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
  };

  public minsBeforeMeetingEndTime(mins: MeetingEndingIn, now: string): Record<string, string> {
    return {
      minsBeforeEndTime: moment(now).set({ second: 0, millisecond: 0 }).add(MINUTES[mins], 'minutes').add(55, 'seconds').format('YYYY-MM-DD HH:mm:ss'),
      minsAfterEndTime: moment(now).set({ second: 0, millisecond: 0 }).add(MINUTES[mins] + 1, 'minutes').add(5, 'seconds').format('YYYY-MM-DD HH:mm:ss')
    }
  }

  public getEndMeetingEventByMinutes(mins: MeetingEndingIn): EndMeetingEvent {
    switch(true) {
      case mins === MeetingEndingIn.FIVE_MINUTES:
        return {
          socketEvent: CallBackEvent.MEETING_COUNT_DOWN_5_MIN,
          sendbirdEvent: SYSTEM_MESSAGE_TYPE.MEETING_COUNT_DOWN_5_MIN
        }
      case mins === MeetingEndingIn.TEN_MINUTES:
        return {
          socketEvent: CallBackEvent.MEETING_COUNT_DOWN_10_MIN,
          sendbirdEvent: SYSTEM_MESSAGE_TYPE.MEETING_COUNT_DOWN_10_MIN
        }
      default:
        return {
          socketEvent: CallBackEvent.MEETING_COUNT_DOWN_5_MIN,
          sendbirdEvent: SYSTEM_MESSAGE_TYPE.MEETING_COUNT_DOWN_5_MIN
        }
    }
  }

  public async checkIfMeetingsAreEndingSoon(mins: MeetingEndingIn, now: string): Promise<any> {
    const targetTime = this.minsBeforeMeetingEndTime(mins, now);
    return this.videoConferenceRepository
    .createQueryBuilder('videoConference')
    .leftJoinAndSelect('videoConference.meetingOfVideoConference', 'meeting')
    .where('meeting.liveStatus = :liveStatus', { liveStatus: LiveStatus.RUNNING })
    .andWhere('meeting.status = :status', { status: MeetingStatus.ACCEPTED })
    .andWhere('meeting.endTime between :minsBeforeEndTime and :minsAfterEndTime', { minsBeforeEndTime: targetTime.minsBeforeEndTime, minsAfterEndTime: targetTime.minsAfterEndTime } )
    .andWhere('videoConference.disconnectedAt is null')
    .getMany()
    .then(result => {
      const event = this.getEndMeetingEventByMinutes(mins);
      const meetingIds = new Set();
      result.forEach(record => {
          this.actionCallBackToUser(event.socketEvent, record.connectionId)
          .catch(error => {
            this.logger.log(`checkIfMeetingsAreEndingSoon - error - Can't send event to (connection id) :  ${record.connectionId}, error: ${error?.message ?? JSON.stringify(error)}`);
          })
        if (record?.meetingOfVideoConference?.meetingId) {
          meetingIds.add(record?.meetingOfVideoConference?.meetingId);
        }
      })
      meetingIds.forEach(id => {
        this.lambdaService.sendMessageToMeetingChatroom({
          messageType: SENDBIRD_MESSAGE_TYPE.MESG,
          message: event.sendbirdEvent,
          channelId: id,
          customType: MESSAGE_TYPE.SYSTEM
        }).catch(error => {
          this.logger.log(`checkIfMeetingsAreEndingSoon - error - Can't send message to (meeting id) :  ${id}, message: ${SYSTEM_MESSAGE.MEETING_COUNT_DOWN_10_MIN}, error: ${error?.message ?? JSON.stringify(error)}`);
        })
      })

      return {
        status: 200,
        now,
        targetTime,
        meeting: meetingIds
      }
    })
    .catch(error => {
      return {
        status: 400,
        now,
        targetTime,
        error: error?.message ?? JSON.stringify(error)
      }
    })
  }

  public getTrtcConfig(fairCode: string): Promise<any> {
    if (!this.trtcSecretArn?.length) {
      return Promise.reject({
        status: 400,
        message: 'Missing trtcSecretArn'
      })
    }

    return this.lambdaService.getSecretValue(this.trtcSecretArn)
    .then(result => {
      if (result?.data?.status !== 200 || !result?.data?.data?.length) {
        return Promise.reject({
          status: 400,
          message: 'Something wrong requesting the api'
        })
      }

      const secretData = JSON.parse(result?.data?.data)

      if (!secretData[`${fairCode}_trtc_secret_key`] || !secretData[`${fairCode}_trtc_appid`]) {
        return Promise.reject({
          status: 400,
          message: 'Cant find the target vod appid or secret key by fair code'
        })
      }
      return {
        status: 200,
        trtcSdkAppId: parseInt(secretData[`${fairCode}_trtc_appid`]),
        trtcSecretKey: secretData[`${fairCode}_trtc_secret_key`],
        trtcExpire: this.trtcExpire
      }
    })
    .catch(error => {
      return {
        status: error?.status || 400,
        message: error?.message || JSON.parse(error)
      }
    })
  }

}
