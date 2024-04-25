import { BadRequestException, Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AxiosResponse } from 'axios';
import moment from 'moment';
import { Logger } from '../../../core/utils';
import {
  ConnectionActionDto,
  ConnectionHandleDto,
  ConnectionRenameActionDto,
  ConnectionTargetActionDto,
  DisconnectHandleDto,
} from '../../../dto/videoConferenceConnection.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { ZoomService } from '../../api/zoom/zoom.service';
import { MeetingService } from '../../c2m/meeting/meeting.service';
import { MeetingStatus } from '../../c2m/meeting/meeting.type';
import { BEFORE_START_TIME, BM_QUOTA, GUEST_QUOTA, HOST_QUOTA, TDC_COMPANY_NAME, VideoConferenceService } from '../../c2m/videoConference/videoConference.service';
import { CallBackEvent, JwtPayload, Role } from '../../c2m/videoConference/videoConference.type';

@Controller('cbm')
export class CBMVideoConferenceController {
  constructor(
    private videoConferenceService: VideoConferenceService,
    private meetingService: MeetingService,
    private jwtService: JwtService,
    private zoomService: ZoomService,
    private logger: Logger
  ) {}

  // Todo admin doesn't have ssouid
  @Post('fairs/:fairCode/meetings/:id/video-conference')
  public async startVideoConference(@Param('fairCode') fairCode: string, @Param('id') meetingId: string, @Body() body: Record<string, any>): Promise<any> {
    // replace ssoUid with nameID for admin
    const { adminid: adminId, name: adminName } = body?.adminProfile || {};

    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED });
    const startTime = moment((<Meeting>meeting).startTime).subtract(BEFORE_START_TIME, 'm');

    if (false && !(moment(startTime).isBefore() && moment((<Meeting>meeting).endTime).isAfter())) {
      throw new BadRequestException({ detail: 'This meeting cannot be joined.' });
    }

    const role = Role.BM;

    const isFull = await this.videoConferenceService.checkQuota(meetingId, role);

    if (!isFull) {
      // since adminId are not belongs to requester or responder, therefore both meeting are not regarded as joined
      await this.meetingService.updateMeetingByMeetingId(meetingId, adminId, 1);
    }

    const payload: JwtPayload = {
      role,
      name: adminName,
      company: TDC_COMPANY_NAME,
      sub: adminId,
      meetingId: (<Meeting>meeting).meetingId,
      // exp: moment((<Meeting>meeting).endTime).unix(),
    };

    const vodSecretResult = await this.videoConferenceService.getTrtcConfig((<Meeting>meeting).fairCode);
    if (vodSecretResult.status !== 200) {
      this.logger.log(JSON.stringify({ section: 'video',
        action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference',
        step: '3.1',
        detail: {
          message: vodSecretResult?.message
        }
      }));
      throw new Error(vodSecretResult?.message || 'TRTC sdkAppId, secretKey or expire are invalid');
    }

    const trtcUserSig = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, adminId, vodSecretResult.trtcExpire);
    const trtcUserSigForShareScreen = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, `share_${adminId}`, vodSecretResult.trtcExpire);
    const trtcUserSigForConnectionTest = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, 'test', vodSecretResult.trtcExpire);
    const waitingParti: any[] = await this.videoConferenceService.findLiveConnections([meetingId]);

    const data: Record<string, any> = {
      ssoUid: adminId,
      role,
      jwtToken: this.jwtService.sign(payload),
      waitingParti,
      trtcSdkAppId: vodSecretResult.trtcSdkAppId,
      trtcUserSig,
      trtcUserSigForShareScreen,
      trtcUserSigForConnectionTest,
      isFull,
      commonMeetingData: {
        meetingName: meeting?.name,
        startTime: meeting?.startTime,
        endTime: meeting?.endTime,
        requesterCompanyName: meeting?.requesterCompanyName,
        responderCompanyName: meeting?.responderCompanyName,
        zoomStartUrl: meeting?.zoomStartUrl,
        zoomJoinUrl: meeting?.zoomJoinUrl
      }
    };

    this.logger.log(JSON.stringify({ section: 'CBM', action: 'startVideoConference - fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: data }));
    return {
      data
    };
  }

  @Delete('fairs/:fairCode/meetings/:id/video-conference')
  public async endVideoConfernece(@Param('fairCode') fairCode: string, @Param('id') meetingId: string, @Body() body: Record<string, any>): Promise<any> {
    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED });

    const { zoomId } = <Meeting>meeting;
    if (zoomId) {
      await this.zoomService.deleteMeeting(zoomId);
      await this.meetingService.updateZoomInfo(<Meeting>meeting, null, null, null);
    }

    // End meeting and kill all socket connections
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.ENDED_MEETING, meetingId);

    const connections = await this.videoConferenceService.findByMeetingId(meetingId);
    const promises = connections.map(async (conn: VideoConference) => this.videoConferenceService.killConnection(conn.connectionId));

    await Promise.all(promises);

    this.logger.log(JSON.stringify({ section: 'CBM', action: 'endVideoConfernece - fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: { meetingId, zoomId } }));
    return {
      data: { meetingId, zoomId },
    };
  }

  @Post('fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom')
  public async switchToZoom(@Param('fairCode') fairCode: string, @Param('id') meetingId: string): Promise<Record<string, any>> {
    let { result: meeting } = await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED });

    const { zoomId, zoomStartUrl, zoomJoinUrl } = <Meeting>meeting;

    if (!zoomId || !zoomJoinUrl || !zoomStartUrl) {
      const zoomMeeting = await this.zoomService.createMeeting({
        topic: (<Meeting>meeting).name,
        type: 2,
        timezone: 'UTC', // Indicates the start time timezone
        start_time: moment((<Meeting>meeting).startTime).toISOString(),
        duration: moment((<Meeting>meeting).endTime).diff(moment((<Meeting>meeting).startTime), 'm'),
        settings: {
          waiting_room: true,
        },
      });

      meeting = await this.meetingService.updateZoomInfo(<Meeting>meeting, zoomMeeting.id, zoomMeeting.start_url, zoomMeeting.join_url);
    }

    const data = {
      meetingId,
      zoomId: (<Meeting>meeting).zoomId,
      zoomStartUrl: (<Meeting>meeting).zoomStartUrl,
      zoomJoinUrl: (<Meeting>meeting).zoomJoinUrl,
    };

    // TO-DO Callback to client for the urls
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.SWITCH_TO_ZOOM, meetingId, null, data);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'switchToZoom - fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom', step: '1', detail: data }));
    return { data };
  }

  @Post('video-conference/join')
  public async wsJoinRoom(@Body() body: ConnectionHandleDto): Promise<Record<string, any>> {
    try {
      const { connectionId, jwtToken } = body;

      const { sub: id, meetingId, role, company: displayCompany, name: displayName }: JwtPayload = await this.jwtService.verify(jwtToken);

      let params: Record<string, any> = { role };

      // If Guest was admitted, connectionId and role is stored.
      if (role === Role.GUEST) {
        params.connectionId = connectionId;
        params.isAdmitted = true;
      } else {
        params.ssoUid = id;
      }

      // Check if joined / admitted before
      const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, params);
      const upsertData: Record<string, any> = { role, displayName, displayCompany };

      if (!vc) {
        const isFull = await this.videoConferenceService.checkQuota(meetingId, role);

        if (isFull) {
          await this.videoConferenceService.actionCallBackToUser(CallBackEvent.QUOTA_FULL, connectionId, { role });
          await this.videoConferenceService.killConnection(connectionId);
          return { message: 'The meeting video conference is fulled.' };
        }

        if (role === Role.GUEST) {
          await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.REQUEST_TO_JOIN, meetingId, connectionId, { displayName, displayCompany });
          await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, upsertData);
          return { message: `You are waiting for admission to join room: ${meetingId}` };
        }
        upsertData.joinedAt = new Date();
      }

      if (vc && !vc.joinedAt) {
        upsertData.joinedAt = new Date();
      }

      // Update connection info
      await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, upsertData);

      const [canStart, connections] = await Promise.all([
        this.videoConferenceService.checkCanStartVideoConference(meetingId),
        this.videoConferenceService.findByMeetingId(meetingId),
      ]);

      const promises = [
        this.videoConferenceService.actionCallBackToRoom(CallBackEvent.JOINED_ROOM, meetingId, connectionId),
        this.videoConferenceService.actionCallBackToRoom(CallBackEvent.UPDATED_ATTENDEES, meetingId, null, {
          connections,
          quota: {
            host: HOST_QUOTA,
            bm: BM_QUOTA,
            guest: GUEST_QUOTA,
          },
        }),
      ];

      if (canStart) {
        promises.push(this.videoConferenceService.actionCallBackToRoom(CallBackEvent.START_VIDEO_CONFERENCE, meetingId));
      }

      const settledResults = await Promise.allSettled(promises);
      const rejectedResults = settledResults.filter((r: PromiseSettledResult<AxiosResponse[]>): r is PromiseRejectedResult => r.status === 'rejected');

      this.videoConferenceService.handlePromiseRejectedResults(rejectedResults);

      return { message: `You have joined room: ${meetingId}` };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/mute')
  public async wsMutePeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canMute = [Role.BM, Role.HOST].includes(role);

    if (!canMute) {
      throw new BadRequestException({ detail: 'You are not allowed to mute others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, id }),
      // Find if target in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId: targetConnectionId }),
    ]);

    const targetCanBeMuted = selfVc && targetVc && targetVc.role === Role.GUEST;

    if (!targetCanBeMuted) {
      throw new BadRequestException({ detail: 'The target participant cannot be muted.' });
    }

    await this.videoConferenceService.actionCallBackToUser(CallBackEvent.MUTED, targetConnectionId);

    return { message: `You have muted ${targetConnectionId} in meeting ${meetingId}` };
  }

  @Post('video-conference/unmute')
  public async wsUnmutePeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canUnmute = [Role.BM, Role.HOST].includes(role);

    if (!canUnmute) {
      throw new BadRequestException({ detail: 'You are not allowed to unmute others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, id }),
      // Find if target in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId: targetConnectionId }),
    ]);

    const targetCanBeUnmuted = selfVc && targetVc && targetVc.role === Role.GUEST;

    if (!targetCanBeUnmuted) {
      throw new BadRequestException({ detail: 'The target participant cannot be unmuted.' });
    }

    await this.videoConferenceService.actionCallBackToUser(CallBackEvent.UNMUTED, targetConnectionId);

    return { message: `You have unmuted ${targetConnectionId} in meeting ${meetingId}` };
  }

  @Post('video-conference/kick')
  public async wsKickPeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canKick = [Role.BM, Role.HOST].includes(role);

    if (!canKick) {
      throw new BadRequestException({ detail: 'You are not allowed to kick others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, id }),
      // Find if target in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId: targetConnectionId }),
    ]);

    const targetCanBeKicked = selfVc && targetVc && targetVc.role === Role.GUEST;

    if (!targetCanBeKicked) {
      throw new BadRequestException({ detail: 'The target participant cannot be kicked.' });
    }

    await this.videoConferenceService.actionCallBackToUser(CallBackEvent.KICKED, targetConnectionId);
    await this.videoConferenceService.killConnection(targetConnectionId);

    return { message: `You have kicked ${targetConnectionId} in meeting ${meetingId}` };
  }

  @Post('video-conference/admit')
  public async wsAdmitPeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);

    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, id });
    const canAdmit = vc && [Role.BM, Role.HOST].includes(role);

    if (!canAdmit) {
      throw new BadRequestException({ detail: 'You are not allowed to admit others.' });
    }

    await this.videoConferenceService.upsertRoomConnection(meetingId, '', targetConnectionId, { role: Role.GUEST, isAdmitted: true });
    await this.videoConferenceService.actionCallBackToUser(CallBackEvent.ADMITTED_TO_JOIN, targetConnectionId);

    return { message: `You have admitted ${targetConnectionId} to meeting ${meetingId}` };
  }

  @Post('video-conference/reject')
  public async wsRejectPeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);

    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, id });
    const canReject = vc && [Role.BM, Role.HOST].includes(role);

    if (!canReject) {
      throw new BadRequestException({ detail: 'You are not allowed to reject others.' });
    }

    await Promise.all([
      this.videoConferenceService.actionCallBackToUser(CallBackEvent.REJECTED_TO_JOIN, targetConnectionId),
      this.videoConferenceService.actionCallBackToRoom(CallBackEvent.REJECTED_GUEST, meetingId, null, { targetConnectionId }),
    ]);

    await this.videoConferenceService.killConnection(targetConnectionId);

    return { message: `You have rejected ${targetConnectionId} to meeting ${meetingId}` };
  }

  @Post('video-conference/rename')
  public async wsRename(@Body() body: ConnectionRenameActionDto): Promise<Record<string, any>> {
    const { connectionId, jwtToken, payload } = body;

    let { sub: id, meetingId }: JwtPayload = await this.jwtService.verify(jwtToken);

    await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, payload);

    const connections = await this.videoConferenceService.findByMeetingId(meetingId);
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.UPDATED_ATTENDEES, meetingId, null, {
      connections,
      quota: {
        host: HOST_QUOTA,
        bm: BM_QUOTA,
        guest: GUEST_QUOTA,
      },
    });

    return { message: `You have been renamed in meeting ${meetingId}` };
  }

  @Post('video-conference/confirm-extend-meeting')
  public async wsConfirmExtendMeeting(@Body() body: ConnectionActionDto): Promise<Record<string, any>> {
    const { connectionId, jwtToken } = body;

    const { sub: id, meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);

    // Find if meeting is not extended yet
    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId, { isExtended: false });

    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId((<Meeting>meeting).meetingId, { connectionId, id });
    const canExtend = vc && [Role.BM, Role.HOST].includes(role);

    if (!canExtend) {
      throw new BadRequestException({ detail: 'You are not allowed to extend meeting.' });
    }

    await this.meetingService.extendMeeting(meetingId, 30);
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.EXTENDED_MEETING, meetingId);

    return { message: `You have extended meeting ${meetingId}` };
  }

  @Post('video-conference/disconnect')
  public async wsDisconnect(@Body() body: DisconnectHandleDto): Promise<Record<string, any>> {
    const { connectionId } = body;

    const vc = await this.videoConferenceService.removeRoomConnection(connectionId);

    if (vc) {
      const connections = await this.videoConferenceService.findByMeetingId(vc.meetingId);

      await Promise.all([
        this.videoConferenceService.actionCallBackToRoom(CallBackEvent.LEFT_ROOM, vc.meetingId, connectionId),
        this.videoConferenceService.actionCallBackToRoom(CallBackEvent.UPDATED_ATTENDEES, vc.meetingId, null, {
          connections,
          quota: {
            host: HOST_QUOTA,
            bm: BM_QUOTA,
            guest: GUEST_QUOTA,
          },
        }),
      ]);
    }

    return { message: `${connectionId} disconnected room: ${vc?.meetingId}` };
  }
}
