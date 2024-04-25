import { Controller, Post, Delete, Param, BadRequestException, Body, Get, Query, HttpCode } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AxiosResponse } from 'axios';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import { constant } from '../../../config/constant';
import { Logger } from '../../../core/utils';
import { Auth } from '../../../decorators/auth.decorator';
import { setFeedbackDtoData } from '../../../dto/feedback.dto';
import {
  ConnectionRenameActionDto,
  ConnectionTargetActionDto,
  ConnectionHandleDto,
  DisconnectHandleDto,
  ConnectionActionDto,
  ConnectionSyncNetworkLevelActionDto,
  ConnectionSyncConnectionTestingActionDto,
  ConnectionConfirmExtendMeetingActionDto
} from '../../../dto/videoConferenceConnection.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { VideoConference } from '../../../entities/videoConference.entity';
import { EMPService } from '../../api/emp/emp.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { LambdaService } from '../../api/lambda/lambda.service';
import { ZoomService } from '../../api/zoom/zoom.service';
import { C2MService } from '../c2m.service';
import { MeetingService } from '../meeting/meeting.service';
import { MeetingStatus, MESSAGE_TYPE, SENDBIRD_MESSAGE_TYPE, SYSTEM_MESSAGE } from '../meeting/meeting.type';
import { ReuseLicenseService } from '../reuseLicense/reuseLicense.service';
import { VideoConferenceService, HOST_QUOTA, BM_QUOTA, GUEST_QUOTA, TDC_COMPANY_NAME, BEFORE_START_TIME } from './videoConference.service';
import { CallBackEvent, JwtPayload, Role } from './videoConference.type';

@Controller('c2m')
export class VideoConferenceController {
  constructor(
    private videoConferenceService: VideoConferenceService,
    private meetingService: MeetingService,
    private jwtService: JwtService,
    private zoomService: ZoomService,
    private logger: Logger,
    private empService: EMPService,
    private reuseLicense: ReuseLicenseService,
    private lambdaService: LambdaService,
    private fairService: ApiFairService,
    private c2mService: C2MService,
  ) {}

  @Post('fairs/:fairCode/meetings/:id/video-conference/guest')
  public async startVideoConferenceGuest(@Param('id') meetingId: string, @Body() body: Record<string, any>): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConferenceGuest- fairs/:fairCode/meetings/:id/video-conference/guest', step: '1', detail: { meetingId, body } }));
    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId);
    // void this.dbLogService.createLog({ section: 'video', action: 'startVideoConferenceGuest- fairs/:fairCode/meetings/:id/video-conference/guest', step: '2', detail: { meeting } });
    const startTime = moment((<Meeting>meeting).startTime).subtract(BEFORE_START_TIME, 'm');

    // Hard code always true here
    if (!moment().isBetween(startTime, (<Meeting>meeting).endTime, undefined, '[]')) {
      throw new BadRequestException({ detail: 'This meeting cannot be joined.' });
    }

    const { companyName: company, displayName: name, companyRole, connectionId = '', ssoUid: id = '' } = body;

    // get connection if joined meeting before with sso login
    const connectionBySsoUid = await this.videoConferenceService.findOneByMeetingId(meetingId, { ssoUid: id, isAdmitted: true, isKicked: false });
    // if (connectionBySsoUid && connectionBySsoUid.joinedAt && !connectionBySsoUid.disconnectedAt) {
    //   await this.videoConferenceService.actionCallBackToUser(CallBackEvent.OTHER_DEVICE_LOGGED_IN, connectionBySsoUid.connectionId);
    // }

    // get connection if joined meeting before
    const connection = await this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId, isAdmitted: true, isKicked: false });

    // guest without SSO
    if (!id && !connectionId && !company && !name) {
      throw new BadRequestException({ detail: 'For guest without SSO, name and company should not be empty. ' });
    }

    // guest with SSO
    if (id && !connectionBySsoUid && !company && !name) {
      throw new BadRequestException({ detail: `For guest with SSO (ssoUid: ${id}), name and company should not be empty.` });
    }

    // guest with connection id
    if (connectionId && !connection) {
      throw new BadRequestException({ detail: `connection id :${connectionId}, fail to rejoin meeting #${meetingId}` });
    }

    let ssoUid = '';
    if (id) {
      ssoUid = id;
    } else if (!id && connection) {
      ssoUid = connection.ssoUid;
    } else {
      ssoUid = uuidv4();
    }

    const payload: JwtPayload = {
      role: Role.GUEST,
      name: connection?.displayName || name,
      company: connection?.displayCompany || company,
      sub: ssoUid,
      meetingId: (<Meeting>meeting)?.meetingId,
      // exp: moment((<Meeting>meeting).endTime).unix(),
    };

    if (connectionBySsoUid) {
      payload.name = connectionBySsoUid.displayName;
      payload.company = connectionBySsoUid.displayCompany;
    }

    const vodSecretResult = await this.videoConferenceService.getTrtcConfig((<Meeting>meeting)?.fairCode);
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

    const trtcUserSig = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, ssoUid, vodSecretResult.trtcExpire);
    const trtcUserSigForShareScreen = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, `share_${ssoUid}`, vodSecretResult.trtcExpire);
    const trtcUserSigForConnectionTest = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, 'test', vodSecretResult.trtcExpire);
    const data = {
      ssoUid,
      role: Role.GUEST,
      rejoin: !!connection || !!connectionBySsoUid,
      name: connection?.displayName || name,
      company: connection?.displayCompany || company,
      jwtToken: this.jwtService.sign(payload),
      trtcSdkAppId: vodSecretResult.trtcSdkAppId,
      trtcUserSig,
      trtcUserSigForShareScreen,
      trtcUserSigForConnectionTest,
      companyRole,
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

    if (connectionBySsoUid) {
      data.name = connectionBySsoUid.displayName;
      data.company = connectionBySsoUid.displayCompany;
    }

    this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConferenceGuest- fairs/:fairCode/meetings/:id/video-conference/guest', step: '2', detail: { data } }));
    return { data };
  }

  // Used by CBM also
  @Post('fairs/:fairCode/meetings/:id/video-conference')
  public async startVideoConference(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('id') meetingId: string,
    @Body() body: Record<string, any>
  ): Promise<any> {
    const { accessToken } = body;
    const { adminid: adminId, name: adminName } = body?.adminProfile || {};
    this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: { ssoUid, fairCode, meetingId, body } }));
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isCBMFlow = !!adminId;

    // skip ssoUid if it is CBM
    const { result: meeting } = isCBMFlow
      ? await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED })
      : await this.meetingService.findOneBySsoUid(meetingId, ssoUid, fairCode, { status: MeetingStatus.ACCEPTED });

    const fairYear = (<Meeting>meeting).fiscalYear;

    // void this.dbLogService.createLog({ section: 'video', action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference', step: '2', detail: { isCBMFlow, meeting } });
    const startTime = moment((<Meeting>meeting).startTime).subtract(BEFORE_START_TIME, 'm');

    // Hard code always true here
    if (!(moment(startTime).isBefore() && moment((<Meeting>meeting).endTime).isAfter())) {
      this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference', step: '2.1', detail: 'This meeting cannot be joined.' }));
      throw new BadRequestException({ detail: 'This meeting cannot be joined.' });
    }

    await this.meetingService.updateMeetingByMeetingId(meetingId, ssoUid, 1);

    let partiInfo: Record<string, any> = {};

    const getFirstLastNameCorrectOrdering = (fName: string, lName: string): string => {
      if (lName.match(/[\u4e00-\u9fa5]/g) || fName.match(/[\u4e00-\u9fa5]/g)) {
        return `${lName} ${fName}`;
      }
        return `${fName} ${lName}`;
    };

    if (isCBMFlow) {
      partiInfo.role = Role.BM;
      partiInfo.id = adminId;
      partiInfo.company = TDC_COMPANY_NAME;
      partiInfo.name = adminName;
    } else if (ssoUid === (<Meeting>meeting).requesterSsoUid) {
      partiInfo.role = Role.HOST;
      partiInfo.id = ssoUid;
      partiInfo.company = (<Meeting>meeting).requesterCompanyName;
      partiInfo.name = getFirstLastNameCorrectOrdering((<Meeting>meeting).requesterFirstName, (<Meeting>meeting).requesterLastName);
      partiInfo.country = (<Meeting>meeting).requesterCountryCode;
      partiInfo.companyRole = (<Meeting>meeting).requesterRole;
    } else if (ssoUid === (<Meeting>meeting).responderSsoUid) {
      partiInfo.role = Role.HOST;
      partiInfo.id = ssoUid;
      partiInfo.company = (<Meeting>meeting).responderCompanyName;
      partiInfo.name = getFirstLastNameCorrectOrdering((<Meeting>meeting).responderFirstName, (<Meeting>meeting).responderLastName);
      partiInfo.country = (<Meeting>meeting).responderCountryCode;
      partiInfo.companyRole = (<Meeting>meeting).responderRole;
    }

    const payload: JwtPayload = {
      role: partiInfo.role,
      name: partiInfo.name,
      company: partiInfo.company,
      country: partiInfo.country,
      companyRole: partiInfo.companyRole,
      sub: partiInfo.id,
      meetingId: (<Meeting>meeting).meetingId,
      // exp: moment((<Meeting>meeting).endTime).unix(),
    };

    this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference', step: '3', detail: { payload } }));
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

    // if (!isCBMFlow) {
    //   const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { ssoUid });
    //   if (vc && vc.joinedAt && !vc.disconnectedAt) {
    //     await this.videoConferenceService.actionCallBackToUser(CallBackEvent.OTHER_DEVICE_LOGGED_IN, vc.connectionId);
    //   }
    // }

    const trtcUserSig = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, partiInfo.id, vodSecretResult.trtcExpire);
    const trtcUserSigForShareScreen = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, `share_${partiInfo.id}`, vodSecretResult.trtcExpire);
    const trtcUserSigForConnectionTest = this.videoConferenceService.getUserSig(vodSecretResult.trtcSdkAppId, vodSecretResult.trtcSecretKey, 'test', vodSecretResult.trtcExpire);
    const waitingParti: any[] = await this.videoConferenceService.findLiveConnections([meetingId]);

    let feedbackId: any = '';
    if (fairYear) { 
      const meetingConfig = await this.c2mService.getFeedbackFormIdByFair(fairCode, fairYear);
      feedbackId = meetingConfig?.data?.feedbackFormId ?? null;
    }

    const data = {
      ssoUid: partiInfo.id,
      role: partiInfo.role,
      jwtToken: this.jwtService.sign(payload),
      waitingParti,
      trtcSdkAppId: vodSecretResult.trtcSdkAppId,
      trtcUserSig,
      trtcUserSigForShareScreen,
      trtcUserSigForConnectionTest,
      profileLanguage: '',
      translationLanguageList: {},
      feedbackId: feedbackId ?? null
    };
    this.logger.log(JSON.stringify({ section: 'video', action: 'startVideoConference- fairs/:fairCode/meetings/:id/video-conference', step: '4', detail: { data } }));

    // ========================= get user preference (profile language) =========================

    await this.empService.getMessageCenterUser(accessToken)
    .then(async (result) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUser- fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: result?.data }));
      const userId = result?.data?.data?.messageCenterUser?.messageCenterUserId;
      if (userId) {
        return this.empService.getMessageCenterUserPreference(accessToken, userId);
      }
      throw new Error('Couldnt find the user from message center (EMP) api');
    })
    .then((result) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUser- fairs/:fairCode/meetings/:id/video-conference', step: '2', detail: result?.data }));
      const translationLanguage = result?.data?.translationLanguage;
      if (translationLanguage) {
        data.profileLanguage = translationLanguage;
        return;
      }
      throw new Error('Couldnt find the user language preference from message center (EMP) api');
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterUser- fairs/:fairCode/meetings/:id/video-conference', step: 'error', detail: { error: error?.message ?? error } }));
    });

    // =========================================== end ===========================================

    // ========================= get supported language list =========================

    await Promise.all([
      this.getMessageCenterSupportedLanguageList('en'),
      this.getMessageCenterSupportedLanguageList('zh-Hant'),
      this.getMessageCenterSupportedLanguageList('zh-Hans')
    ])
    .then(([enList, tcList, scList]) => {
      data.translationLanguageList = {
        enList,
        tcList,
        scList
      };
    });

    // =========================================== end ===========================================
    return { data };
  }

  @Get('getMessageCenterSupportedAllLanguageList')
  public async getMessageCenterSupportedAllLanguageList() {
    return Promise.all([
      this.getMessageCenterSupportedLanguageList('en'),
      this.getMessageCenterSupportedLanguageList('zh-Hant'),
      this.getMessageCenterSupportedLanguageList('zh-Hans')
    ])
    .then(([enList, tcList, scList]) => ({
        enList,
        tcList,
        scList
      }));
  }

  @Get('getMessageCenterSupportedLanguageList')
  public async getMessageCenterSupportedLanguageList(@Query('language') language: 'en' | 'zh-Hant' | 'zh-Hans') {
    return this.empService.getMessageCenterSupportedLanguageList(language)
    .then((result: any) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterSupportedLanguageList- getMessageCenterSupportedLanguageList', step: '1', detail: result?.data }));
      return result?.data?.result ?? [];
    })
    .catch((error) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'getMessageCenterSupportedLanguageList- getMessageCenterSupportedLanguageList', step: 'error', detail: { error: error?.message ?? error } }));
      return [];
    });
  }

  @Post('updateMessageCenterUserPreference')
  public updateMessageCenterUserPreference(@Body() body: Record<string, any>): Record<string, any> {
    const { translationLanguage, accessToken } = body;
    let userId: string;
    return this.empService.getMessageCenterUser(accessToken)
    .then(async (result) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'updateMessageCenterUserPreference', step: '1', detail: result?.data }));
      userId = result?.data?.data?.messageCenterUser?.messageCenterUserId;

      if (!userId?.length) {
        return Promise.reject({
          status: 400,
          message: 'Couldnt find the user from message center (EMP) api'
        });
      }

      return this.empService.getMessageCenterUserPreference(accessToken, userId);
    })
    .then(async (result) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'updateMessageCenterUserPreference', step: '2', detail: result?.data }));

      if (!result?.data) {
        return Promise.reject({
          status: 400,
          message: 'Couldnt find the user preference from message center (EMP) api'
        });
      }

      const { emailNotification } = result?.data;
      return this.empService.updateMessageCenterUserPreference(accessToken, userId, emailNotification, translationLanguage);
    })
    .then((result) => ({
        status: 200,
        data: result?.data
      }))
    .catch((error) => {
      this.logger.log(JSON.stringify({ section: 'EMP', action: 'updateMessageCenterUserPreference', step: 'error', detail: { error: error?.message ?? error } }));
      return {
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error)
      };
    });
  }

  // integrate with CBM flow
  @Delete('fairs/:fairCode/meetings/:id/video-conference')
  public async endVideoConfernece(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('id') meetingId: string,
    @Body() body: Record<string, any>
  ): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '1', detail: { ssoUid, fairCode, meetingId, body } }));
    const { adminid: adminId } = body?.adminProfile || {};
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isCBMFlow = !!adminId;

    // skip ssoUid if it is CBM
    const { result: meeting } = isCBMFlow
      ? await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED })
      : await this.meetingService.findOneBySsoUid(meetingId, ssoUid, fairCode, { status: MeetingStatus.ACCEPTED });

    this.logger.log(JSON.stringify({ section: 'video', action: ' endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '2', detail: { isCBMFlow, meeting } }));
    const { zoomId } = <Meeting>meeting;
    if (zoomId) {
      await this.zoomService.deleteMeeting(zoomId);
      await this.meetingService.updateZoomInfo(<Meeting>meeting, null, null, null);
    }

    // End meeting and kill all socket connections
    const callBackResult = await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.ENDED_MEETING, meetingId);

    // this.logger.log(JSON.stringify({ section: 'video', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '3', detail: { callBackResult } });
    const connections = await this.videoConferenceService.findByMeetingId(meetingId);

    // this.logger.log(JSON.stringify({ section: 'video', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '4', detail: { connections } });
    const promises = connections.map(async (conn: VideoConference) => this.videoConferenceService.killConnection(conn.connectionId));

    const killConnectionResult = await Promise.all(promises);

    // eslint-disable-next-line max-len
    this.logger.log(JSON.stringify({ section: 'video', action: 'endVideoConfernece- fairs/:fairCode/meetings/:id/video-conference', step: '3', detail: { callBackResult, connections, killConnectionResult } }));
    return {
      data: { meetingId, zoomId },
    };
  }

  // integrate with CBM flow
  @Post('fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom')
  public async switchToZoom(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('id') meetingId: string,
    @Body() body: Record<string, any>
  ): Promise<Record<string, any>> {
    // eslint-disable-next-line max-len
    this.logger.log(JSON.stringify({ section: 'video', action: 'switchToZoom - fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom', step: '1', detail: { ssoUid, fairCode, meetingId, body } }));
    const zoomLicenseResult = await this.reuseLicense.getFirstPendingLicense();
    this.logger.log(JSON.stringify({ section: 'video', action: 'switchToZoom - fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom', step: '1.1', detail: { zoomLicenseResult } }));
    if (zoomLicenseResult.status === 400) {
      const retryInMins = 5;
      const callbackResult = await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.ZOOM_REJECTED, meetingId, null, {});
      this.logger.log(JSON.stringify({ section: 'video', action: 'switchToZoom - fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom', step: '1.2', detail: { zoomLicenseResult } }));
      this.lambdaService.sendMessageToMeetingChatroom({
        messageType: SENDBIRD_MESSAGE_TYPE.MESG,
        message: SYSTEM_MESSAGE.ZOOM_REJECTED,
        data: JSON.stringify({
          extraString: retryInMins
        }),
        channelId: meetingId,
        customType: MESSAGE_TYPE.SYSTEM
      }).catch((error) => {
        this.logger.log(`video-conference/switch-to-zoom - error - Can't send message to (meeting id) :  ${meetingId}, message: ${SYSTEM_MESSAGE.ZOOM_REJECTED}, error: ${error?.message ?? JSON.stringify(error)}`);
      });
      return callbackResult;
    }

    const { adminid: adminId } = body?.adminProfile || {};
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isCBMFlow = !!adminId;

    // skip ssoUid if it is CBM
    let { result: meeting } = isCBMFlow
      ? await this.meetingService.findByMeetingId(meetingId, { status: MeetingStatus.ACCEPTED })
      : await this.meetingService.findOneBySsoUid(meetingId, ssoUid, fairCode, { status: MeetingStatus.ACCEPTED });

    const { zoomId, zoomStartUrl, zoomJoinUrl } = <Meeting>meeting;

    if (!zoomId || !zoomJoinUrl || !zoomStartUrl) {
      const zoomMeeting = await this.zoomService.createMeeting({
        accountEmail: zoomLicenseResult.data?.accountEmail,
        topic: (<Meeting>meeting).name,
        type: 2,
        timezone: 'UTC', // Indicates the start time timezone
        start_time: moment((<Meeting>meeting).startTime).toISOString(),
        duration: moment((<Meeting>meeting).endTime).diff(moment((<Meeting>meeting).startTime), 'm'),
        password: 'abcd1234',
        settings: {
        host_video: false,
        participant_video: false,
        join_before_host: false,
        waiting_room: true,
        mute_upon_entry: false,
        watermark: false,
        use_pmi: false,
        approval_type: 2,
        registration_type: 1,
        auto_recording: 'none',
        registrants_email_notification: false,
        registrants_confirmation_email: false,
        alternative_hosts_email_notification: false,
        breakout_room: {
          enable: false
        },
        show_share_button: false,
      }
      });

      // update zoom quota to using
      await this.reuseLicense.updateZOOMEmailAccountStatus({ meetingId: `${meetingId}`, accountEmail: `${zoomLicenseResult.data?.accountEmail}` });

      meeting = await this.meetingService.updateZoomInfo(<Meeting>meeting, zoomMeeting.id, zoomMeeting.start_url, zoomMeeting.join_url);
      this.logger.log(JSON.stringify({ section: 'video', action: 'switchToZoom - fairs/:fairCode/meetings/:id/video-conference/switch-to-zoom', step: '2.3', detail: { meeting } }));
    }

    const data = {
      meetingId,
      zoomId: (<Meeting>meeting).zoomId,
      zoomStartUrl: (<Meeting>meeting).zoomStartUrl,
      zoomJoinUrl: (<Meeting>meeting).zoomJoinUrl,
    };

    // TO-DO Callback to client for the urls
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.SWITCH_TO_ZOOM, meetingId, null, data);

    this.lambdaService.sendMessageToMeetingChatroom({
      messageType: SENDBIRD_MESSAGE_TYPE.MESG,
      message: SYSTEM_MESSAGE.SWITCH_TO_ZOOM,
      channelId: meetingId,
      customType: MESSAGE_TYPE.SYSTEM
    }).catch((error) => {
      this.logger.log(`video-conference/switch-to-zoom - error - Can't send message to (meeting id) :  ${meetingId}, message: ${SYSTEM_MESSAGE.SWITCH_TO_ZOOM}, error: ${error?.message ?? JSON.stringify(error)}`);
    });

    return { data };
  }

  @Post('video-conference/ping')
  public async wsPingPong(@Body() body: ConnectionHandleDto) {
    try {
      const { connectionId } = body;
      await this.videoConferenceService.actionCallBackToUser(CallBackEvent.PONG, connectionId, { message: 'PONG' });
      return { message: 'ping pong success' };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/join')
  public async wsJoinRoom(@Body() body: ConnectionHandleDto): Promise<Record<string, any>> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '1', detail: { body } }));
    try {
      const { connectionId, jwtToken, connectionIdInCookies = '' } = body;

      const { sub: id, meetingId, role, company: displayCompany, name: displayName, country, companyRole }: JwtPayload = await this.jwtService.verify(jwtToken);

      let params: Record<string, any> = { role };

      // If Guest was admitted, connectionId and role is stored.
      if (role === Role.GUEST) {
        params.isAdmitted = true;
        params.isKicked = false;
      }

      // Check if joined / admitted before
      const vc = await this.videoConferenceService.findOneById(meetingId, id, connectionIdInCookies || connectionId, params);
      // this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '2', detail: { vc } });

      if (vc && vc.joinedAt && !vc.disconnectedAt) {
        await this.videoConferenceService.actionCallBackToUser(CallBackEvent.OTHER_DEVICE_LOGGED_IN, vc.connectionId);
      }

      const upsertData: Record<string, any> = { role, displayName, displayCompany, country, companyRole };
      this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '2', detail: { vc, upsertData, params } }));

      if (!vc) {
        const isFull = await this.videoConferenceService.checkQuota(meetingId, role);

        if (isFull && role === Role.GUEST) {
          const callbackResult = await this.videoConferenceService.actionCallBackToUser(CallBackEvent.QUOTA_FULL, connectionId, { role });
          const callbackResultList = await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.REQUEST_TO_JOIN, meetingId, connectionId, { displayName, displayCompany });
          const killConnectionResult = await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, upsertData);

          this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.1', detail: { callbackResult, killConnectionResult, message: 'The meeting video conference is fulled.' } }));
          this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.2', detail: { callbackResultList, killConnectionResult, message: `You are waiting for admission to join room: ${meetingId}` } }));

          return { message: `[Guest quota full] - You are waiting for admission to join room: ${meetingId}` };
        }

        if (isFull) {
          const callbackResult = await this.videoConferenceService.actionCallBackToUser(CallBackEvent.QUOTA_FULL, connectionId, { role });
          // this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.1', detail: { callbackResult } });

          const killConnectionResult = await this.videoConferenceService.killConnection(connectionId);
          this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.1', detail: { callbackResult, killConnectionResult, message: 'The meeting video conference is fulled.' } }));
          return { message: 'The meeting video conference is fulled.' };
        }

        if (role === Role.GUEST) {
          const callbackResult = await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.REQUEST_TO_JOIN, meetingId, connectionId, { displayName, displayCompany });
          // this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.2.1', detail: { callbackResult } });

          const killConnectionResult = await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, upsertData);
          this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.2', detail: { callbackResult, killConnectionResult, message: `You are waiting for admission to join room: ${meetingId}` } }));
          return { message: `You are waiting for admission to join room: ${meetingId}` };
        }
        upsertData.joinedAt = new Date();
      }

      if (vc) {
        await this.meetingService.updateMeetingByMeetingId(vc.meetingId, vc.ssoUid, 1);

        if (!vc.joinedAt) {
          upsertData.joinedAt = new Date();
        }
      }

      // Update connection info
      const upsertRoomResult = await this.videoConferenceService.upsertRoomConnection(meetingId, id, connectionId, upsertData);

      this.logger.log(JSON.stringify({ section: 'video', action: 'wsJoinRoom - video-conference/join', step: '3.3', detail: { upsertRoomResult } }));

      // TO-DO - Jack - Log
      const [canStart, connections] = await Promise.all([
        this.videoConferenceService.checkCanStartVideoConference(meetingId),
        this.videoConferenceService.findByMeetingId(meetingId),
      ]);

      const promises = [
        this.videoConferenceService.actionCallBackToRoom(CallBackEvent.JOINED_ROOM, meetingId, connectionId, { ssoUid: id }),
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

    let { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canMute = [Role.BM, Role.HOST].includes(role);

    if (!canMute) {
      throw new BadRequestException({ detail: 'You are not allowed to mute others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId }),
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

    let { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canUnmute = [Role.BM, Role.HOST].includes(role);

    if (!canUnmute) {
      throw new BadRequestException({ detail: 'You are not allowed to unmute others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId }),
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
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsKickPeople - video-conference/kick', step: '1', detail: { body } }));
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    const canKick = [Role.BM, Role.HOST].includes(role);
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsKickPeople - video-conference/kick', step: '2', detail: { meetingId, role, canKick } }));

    if (!canKick) {
      throw new BadRequestException({ detail: 'You are not allowed to kick others.' });
    }

    const [selfVc, targetVc] = await Promise.all([
      // Find if self in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId }),
      // Find if target in the video conference
      this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId: targetConnectionId }),
    ]);

    const targetCanBeKicked = selfVc && targetVc && targetVc.role === Role.GUEST;
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsKickPeople - video-conference/kick', step: '3', detail: { selfVc, targetVc, targetCanBeKicked } }));

    if (!targetCanBeKicked) {
      throw new BadRequestException({ detail: 'The target participant cannot be kicked.' });
    }

    if (targetVc) {
      await this.videoConferenceService.upsertRoomConnection(meetingId, targetVc.ssoUid, targetConnectionId, { isKicked: true });
    }
    await this.videoConferenceService.actionCallBackToUser(CallBackEvent.KICKED, targetConnectionId);
    const killConnectionResult = await this.videoConferenceService.killConnection(targetConnectionId);
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsKickPeople - video-conference/kick', step: '4', detail: { killConnectionResult } }));

    return { message: `You have kicked ${targetConnectionId} in meeting ${meetingId}` };
  }

  @Post('video-conference/admit')
  public async wsAdmitPeople(@Body() body: ConnectionTargetActionDto): Promise<Record<string, any>> {
    const {
      connectionId,
      payload: { targetConnectionId },
      jwtToken,
    } = body;

    let { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);
    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId });
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

    let { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);

    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { connectionId });
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

  // remove connection id here, need to add back later
  @Post('video-conference/confirm-extend-meeting')
  public async wsConfirmExtendMeeting(@Body() body: ConnectionConfirmExtendMeetingActionDto): Promise<Record<string, any>> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: '1', detail: { body } }));
    const { jwtToken, payload: { isSkipSeminarChecking } } = body;
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: 'debug', detail: { payload: body.payload, isSkipSeminarChecking, typeOfPayload: typeof body.payload } }));


    const { meetingId, role, sub: ssoUid }: JwtPayload = await this.jwtService.verify(jwtToken);
    const minsToBeExtend = 30;

    // Find if meeting is not extended yet
    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId, { isExtended: false, isRefusedExtend: false });
    if (!meeting) {
      throw new BadRequestException({ detail: `The meeting ${meetingId} has already been extended or refused to extend.` });
    }

    // Find if self in the video conference
    const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { ssoUid });
    const canExtend = vc && [Role.BM, Role.HOST].includes(role);
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: '2', detail: { meeting, vc, canExtend } }));

    if (!canExtend) {
      throw new BadRequestException({ detail: 'You are not allowed to extend meeting.' });
    }

    // Find when extend the meeting, whether the extended timeslot will collided with seminar
    if (!isSkipSeminarChecking) {
      const counterSsoUid = ssoUid === meeting.createdBy ? meeting.responderSsoUid : meeting.requesterSsoUid;
      const registeredSeminar = await this.fairService.countRegisteredSeminarsByUserAndTimeRange(ssoUid, ssoUid, counterSsoUid, meeting?.fairCode, moment(meeting?.startTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'), moment(meeting?.endTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'), true);
      this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: 'debug 1' }));

      if (registeredSeminar?.data?.status === constant.GENERAL_STATUS.FAIL) {
        throw new BadRequestException({ detail: 'get registeredSeminar data fail, thus cannot check whether there are collided event.' });
      }

      if (registeredSeminar?.data?.count > 0) {
        this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: 'debug 2' }));
        await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.EXTEND_MEETING_WHEN_COLLIDED, meetingId);
        this.logger.log(JSON.stringify({ section: 'video', action: 'wsConfirmExtendMeeting - video-conference/confirm-extend-meeting', step: 'debug 3' }));
        return { message: `Your next timesolot has collided seminar (meeting id: ${meetingId})` };
      }
    }

    await this.meetingService.extendMeeting(meetingId, minsToBeExtend);
    await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.EXTENDED_MEETING, meetingId);

    this.lambdaService.sendMessageToMeetingChatroom({
      messageType: SENDBIRD_MESSAGE_TYPE.MESG,
      message: SYSTEM_MESSAGE.MEETING_EXTENDED,
      data: JSON.stringify({
        extraString: `${moment((meeting).endTime).add(minsToBeExtend, 'minutes').format('YYYY-MM-DD HH:mm:ss')}`
      }),
      channelId: meetingId,
      customType: MESSAGE_TYPE.SYSTEM
    }).catch((error) => {
      this.logger.log(`video-conference/confirm-extend-meeting - error - Can't send message to (meeting id) :  ${meetingId}, message: ${SYSTEM_MESSAGE.MEETING_EXTENDED}, error: ${error?.message ?? JSON.stringify(error)}`);
    });

    return { message: `You have extended meeting ${meetingId}` };
  }

  @Post('video-conference/refuse-extend-meeting')
  public async wsRefuseExtendMeeting(@Body() body: ConnectionActionDto): Promise<Record<string, any>> {
    try {
      const { jwtToken } = body;

      const { meetingId, role, sub: ssoUid }: JwtPayload = await this.jwtService.verify(jwtToken);

      // Find if meeting is not extended and not refused yet
      const meeting = await this.meetingService.findByMeetingId(meetingId, { isExtended: false, isRefusedExtend: false });
      if (meeting.status === constant.GENERAL_STATUS.FAIL) {
        throw new BadRequestException({ detail: `The meeting ${meetingId} has already been extended or refused to extend.` });
      }

      // Find if self in the video conference
      const vc = await this.videoConferenceService.findOneByMeetingId(meetingId, { ssoUid });
      if (!vc) {
        throw new BadRequestException({ detail: `You ${ssoUid} are not in the meeting ${meetingId}.` });
      }

      const canRefuse = vc && [Role.BM, Role.HOST].includes(role);

      if (!canRefuse) {
        throw new BadRequestException({ detail: 'You are not allowed to refuse to extend meeting.' });
      }

      await this.meetingService.refuseExtendMeeting(meetingId);

      return { message: `You have refused to extend meeting ${meetingId}` };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/sync-network-level')
  public async wsSyncNetworkLevel(@Body() body: ConnectionSyncNetworkLevelActionDto): Promise<Record<string, any>> {
    try {
      const { connectionId, jwtToken, payload } = body;

      const { meetingId }: JwtPayload = await this.jwtService.verify(jwtToken);

      await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.SYNCED_NETWORK_LEVEL, meetingId, connectionId, payload);

      return { message: `Sync network level from ${connectionId}` };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/sync-connection-testing')
  public async wsSyncConnectionTesting(@Body() body: ConnectionSyncConnectionTestingActionDto): Promise<Record<string, any>> {
    try {
      const { connectionId, jwtToken, payload } = body;

      const { meetingId }: JwtPayload = await this.jwtService.verify(jwtToken);

      await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.SYNCED_CONNECTION_TESTING, meetingId, connectionId, payload);

      return { message: `Sync connection testing from ${connectionId}` };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/sync-bad-connection')
  public async wsSyncBadConnection(@Body() body: ConnectionActionDto): Promise<Record<string, any>> {
    try {
      const { jwtToken } = body;

      const { meetingId, role }: JwtPayload = await this.jwtService.verify(jwtToken);

      if (role === Role.HOST) {
        await this.videoConferenceService.actionCallBackToRoom(CallBackEvent.SYNCED_BAD_CONNECTION, meetingId);
      }

      return { message: 'Synced bad connection from host' };
    } catch (e) {
      return { message: JSON.stringify(e) };
    }
  }

  @Post('video-conference/disconnect')
  public async wsDisconnect(@Body() body: DisconnectHandleDto): Promise<Record<string, any>> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsDisconnect - video-conference/disconnect', step: '1', detail: { body } }));
    const { connectionId } = body;

    const vc = await this.videoConferenceService.removeRoomConnection(connectionId);
    this.logger.log(JSON.stringify({ section: 'video', action: 'wsDisconnect - video-conference/disconnect', step: '2', detail: { vc } }));

    if (vc) {
      await this.meetingService.updateMeetingByMeetingId(vc.meetingId, vc.ssoUid, 2);
      const connections = await this.videoConferenceService.findByMeetingId(vc.meetingId);
      this.logger.log(JSON.stringify({ section: 'video', action: 'wsDisconnect - video-conference/disconnect', step: '3', detail: { connections } }));

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

  @Post('video-conference/feedback')
  @HttpCode(201)
  public async setFeedbackForm(@Body() body: setFeedbackDtoData): Promise<Record<string, any>> {
    this.logger.log(JSON.stringify({ section: 'video', action: 'setFeedback', step: '1', detail: { body } }));
    const { answer, score, userType, meetingId } = body;

    return this.meetingService.setFeedback(answer, score, userType, meetingId);
  }
}
