/* eslint-disable @typescript-eslint/no-inferrable-types */
import { Controller, Get, Post, Put, Query, Param, Body, Headers, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import moment from 'moment-timezone';
import { In, MoreThanOrEqual } from 'typeorm';
import { constant } from '../../config/constant';
import { Logger } from '../../core/utils';
import { Auth } from '../../decorators/auth.decorator';
// import { UpdateC2mConfigDto } from '../../dto/c2mConfig.dto';
import { CreateMeetingDto } from '../../dto/createMeeting.dto';
import { CreateCIPUnavailableTimeslot, CreateUnavailableTimeslot, CreateUnavailableTimeslotDto, CreateUnavailableTimeslotDtoData } from '../../dto/createUnavailableTimeslot.dto';
import { getAndSetC2MLoginStatus } from '../../dto/getAndSetC2MLoginStatus.dto';
import { GetCombinedUnavailableTimeslotsDto } from '../../dto/getCombinedUnavilableTimeslots.dto';
import { GetConfigValueByIdDto } from '../../dto/getConfigValueByIdDto.dto';
import { GetMeetingsDto } from '../../dto/getMeetings.dto';
import { seminarRegistrationDto } from '../../dto/seminarRegistration.dto';
// import { HandleNotificationForSeminarDto } from '../../dto/handleNotificationForSeminar.dto';
import { TimeslotDto } from '../../dto/timeslot.dto';
import { UpdateMeetingDto, UpdateMeetingDtoAction } from '../../dto/updateMeeting.dto';
import { Meeting } from '../../entities/meeting.entity';
import { UnavailableTimeslot } from '../../entities/unavailableTimeslot.entity';
import { TimeslotHelper } from '../../helpers/timeslotHelper';
import { ContentApiService } from '../api/content/content.service';
import { ApiExhibitorService } from '../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../api/fair/fair.service';
import { NotificationAPIService } from '../api/notificationAPI/notificationAPI.service';
import { CBMService } from '../cbm/cbm.service';
import { C2MService } from './c2m.service';
import { MeetingService } from './meeting/meeting.service';
import { MeetingRole, MeetingStatus, MeetingType } from './meeting/meeting.type';
import { MeetingValidator } from './meeting/meeting.validator';
import { NotificationTemplatesId, NotificationType, templateSource } from './notification/notification.type';
import { UnavailableTimeslotService } from './unavailableTimeslot/unavailableTimeslot.service';
import { checkInputTimeIsPassCurrentTime } from './utils';

@Controller(['c2m', 'admin/v1/c2m'])
export class C2MController {
  constructor(
    private c2mService: C2MService,
    private meetingService: MeetingService,
    private unavailableTimeslotService: UnavailableTimeslotService,
    private fairService: ApiFairService,
    private logger: Logger,
    private exhibitorService: ApiExhibitorService,
    private contentService: ContentApiService,
    private apiFairService: ApiFairService,
    private cbmService: CBMService,
    private notificationAPIService: NotificationAPIService,
  ) {}

  @Get()
  public index(): Record<string, any> {
    return {
      data: 'C2M Service is Ready',
    };
  }

  @Get('getMultipleFairDatas/:fairCode')
  public async getMultipleFairDatas(@Param('fairCode') fairCode: string): Promise<any> {
    const language = 'en';
    return this.apiFairService.getMultipleFairDatas([fairCode]).then((result: any) => {
      if (!result?.data?.length) {
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return (
        result?.data?.length
        && result?.data?.flatMap(
          (fairData: any) => fairData?.relatedFair?.length
            && fairData?.relatedFair?.flatMap((fair: any) => ({
              fairCode: fair.fair_code,
              fiscalYear: fair.fiscal_year,
              fairShortName: language ? fair.fair_short_name?.[language] : fair.fair_short_name?.en,
            }))
        )
      );
    });
  }

  @Get('userFairData')
  public async getUserFairData(@Auth('EMAIL_ID') emailId: string): Promise<Record<string, any>> {
    const fairResponse = await this.fairService.getFairParticipant(emailId);
    const exhibitorResponse = await this.exhibitorService.getExhibitorProfile(emailId);

    const exhibitorData: any[] = [];
    exhibitorResponse.data.data.records.forEach((e: any) => {
      const exhibitor: Record<string, any> = {};

      exhibitor.fairCode = e.fairCode;
      exhibitor.fiscalYear = e.fiscalYear;
      exhibitor.companyCCDID = e.companyCCDID;
      exhibitor.individualCCDID = e.individualCCDID;
      exhibitor.role = 'exhibitor';

      exhibitorData.push(exhibitor);
    });

    return {
      emailId,
      fairData: [...fairResponse.data, ...exhibitorData],
    };
  }

  @Post('postMeetingFeedbackFormId')
  public async postMeetingFeedbackFormId(@Body() body: { fairCode :string, year:string, feedbackFormId:string }): Promise<any> {
    return this.meetingService
      .postMeetingFeedbackFormId(body)
      .then((result: any) => result)
      .catch((error: any) => {
        this.logger.log(`Fail to request postMeetingFeedbackFormId: ${JSON.stringify(error)}`);
        return JSON.stringify(error);
      });
  }

  @Get('fairSetting/:fairCode')
  public async getFairCodes(@Param('fairCode') fairCode: string): Promise<any> {
    return this.fairService
      .getCombinedFairCodes(fairCode)
      .then((result: any) => result)
      .catch((error: any) => {
        this.logger.log(`Fail to request fairSetting/:fairCode : ${JSON.stringify(error)}`);
        return JSON.stringify(error);
      });
  }

  @Post('fairSetting/:fairCode')
  public async getFairSetting(@Param('fairCode') fairCode: string): Promise<any> {
    return this.fairService
      .getWordpressFairSetting(fairCode)
      .then((result: any) => result)
      .catch((error: any) => {
        this.logger.log(`Fail to request fairSetting/:fairCode : ${JSON.stringify(error)}`);
        return JSON.stringify(error);
      });
  }

  // Get meeting by ssoUid and fair code
  // support multiple id
  @Get('fairs/:fairCode/meetings/:id')
  public async getMeeting(@Auth('SSOUID') ssoUid: string, @Param('fairCode') fairCode: string, @Param('id') meetingId: string): Promise<Record<string, any>> {
    this.logger.log(
      JSON.stringify({ section: 'C2M', action: 'getMeeting - fairs/:fairCode/meetings/:id', step: '1', detail: { ssoUid, fairCode, meetingId } })
    );
    const { result: data } = await this.meetingService.findOneBySsoUid(meetingId, ssoUid, fairCode);

    if (!data) {
      this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeeting - fairs/:fairCode/meetings/:id - error', step: 'error', detail: { ssoUid, fairCode, meetingId } }));
      return {
        data: {}
      }
    }

    let responder = {
      ssoUid: data.responderSsoUid,
      role: data.responderRole,
      firstName: data.responderFirstName,
      lastName: data.responderLastName,
      avatar: '',
      country: data.responderCountryCode,
      companyName: data.responderCompanyName || '',
      companyLogo: data.responderCompanyLogo || '',
      supplierUrn: data.responderSupplierUrn || '',
      exhibitorUrn: data.responderExhibitorUrn || '',
      fairCode: data.responderFairCode || '',
      fiscalYear: data.responderFiscalYear || '',
    };
    data.responder = responder;

    let requester = {
      ssoUid: data.requesterSsoUid,
      role: data.requesterRole,
      firstName: data.requesterFirstName,
      lastName: data.requesterLastName,
      avatar: '',
      country: data.requesterCountryCode,
      companyName: data.requesterCompanyName || '',
      companyLogo: data.requesterCompanyLogo || '',
      supplierUrn: data.requesterSupplierUrn || '',
      exhibitorUrn: data.requesterExhibitorUrn || '',
      fairCode: data.fairCode || '',
      fiscalYear: data.fiscalYear || '',
    };

    data.requester = requester;

    (<Meeting & { commonMeetingData: Record<string, any> }>data).commonMeetingData = {
      meetingName: data?.name,
      startTime: data?.startTime,
      endTime: data?.endTime,
      requesterCompanyName: data?.requesterCompanyName,
      responderCompanyName: data?.responderCompanyName,
      zoomStartUrl: data?.zoomStartUrl,
      zoomJoinUrl: data?.zoomJoinUrl
    };

    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeeting - fairs/:fairCode/meetings/:id', step: '2', detail: { data } }));
    return { data };
  }

  @Get('fairs/:fairCode/meetings/:id/guest')
  public async getMeetingGuest(@Param('fairCode') fairCode: string, @Param('id') meetingId: string): Promise<Record<string, any>> {
    this.logger.log(
      JSON.stringify({ section: 'C2M', action: 'getMeetingGuest - fairs/:fairCode/meetings/:id/guest', step: '1', detail: { fairCode, meetingId } })
    );
    const { result: meeting } = await this.meetingService.findByMeetingId(meetingId);
    const { name, startTime, endTime, requesterCompanyName, responderCompanyName, zoomJoinUrl, zoomStartUrl } = <Meeting>meeting;

    const data = {
      name,
      startTime: moment(startTime).toISOString(),
      endTime: moment(endTime).toISOString(),
      requesterCompanyName,
      responderCompanyName,
      zoomStartUrl,
      zoomJoinUrl,
    };
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetingGuest - fairs/:fairCode/meetings/:id/guest', step: '2', detail: { data } }));
    return { data };
  }

  // Get meetings by ssoUid and fair code
  @Post('fairs/:fairCode/meetingListing')
  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async getMeetings(
    @Auth('SSOUID') ssoUid: string,
    @Auth('SECONDARY_ID') secondaryId: string,
    @Param('fairCode') fairCode: string,
    @Body() filterOptions: GetMeetingsDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any>> {
    this.logger.log(
      JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '1', detail: { ssoUid, fairCode, filterOptions, timezone: tz } })
    );
    const ssoUidArr = [ssoUid, secondaryId];
    const { filteredFairCodes, filteredDate, combinedFairData } = <GetMeetingsDto & { combinedFairData: Record<string, any>[] }>filterOptions;
    let targetFairData: Record<string, any>[] | null;

    if (!combinedFairData?.length) {
      return {
        meta: {},
        data: {
          status: 400,
          message: 'Couldnt find any fair data',
        },
      };
    }
    // if nothing selected from the dropdown, it means the page is being init for the first time, then we get all fairs by default
    if (!filteredFairCodes?.length) {
      targetFairData = combinedFairData;
    } else {
      targetFairData = combinedFairData.filter((fairData: Record<string, any>) => filteredFairCodes?.find((fairCode: string) => fairCode === fairData.fairCode));
    }

    const fairCodes = targetFairData.map((fair: any) => fair.fairCode);
    const fiscalYears = targetFairData.map((fair: any) => fair.fiscalYear);

    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '2', detail: { fairCodes, fiscalYears } }));
    const { fields, limit, page, status } = this.extractMeetingsParams(filterOptions);
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '3', detail: { fields, limit, page, status } }));
    // support multiple id
    const { items: data, meta } = await this.meetingService.paginateByConditions(
      ssoUidArr,
      status,
      fairCodes,
      fiscalYears,
      fields,
      page,
      limit,
      filteredDate ?? [],
      tz
    );
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '4', detail: { items: data, meta } }));
    // support multiple id
    // uid2nd
    const meetingDates = await this.meetingService.findMeetingDatesByUserAndFairCode(ssoUidArr, fairCodes, fiscalYears, status);
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '5', detail: { meetingDates } }));
    const meetingIsoDate = this.removeDuplicateDate(meetingDates, tz);
    meta.allStartTime = Array.from(new Set(meetingIsoDate));
    meta.allFairData = combinedFairData;
    data.forEach((meeting: Meeting) => {
      meeting.collisionMeetings = meeting.collisionMeetings?.filter(
        (m: Meeting) => fairCodes.find((code: string) => code === m.fairCode) && (ssoUidArr.includes(m.responderSsoUid) || ssoUidArr.includes(m.requesterSsoUid))
      );
      meeting.isCollided = !!meeting.collisionMeetings?.length;
      // support multiple id
      if (meeting.requesterSsoUid === ssoUid) {
        meeting.isCollided = false;
      }
      if (meeting.collisionMeetings && meeting.status === MeetingStatus.PENDING) {
        const collidedMeeting = meeting.collisionMeetings.find(
          (m: Meeting) => m.status === MeetingStatus.ACCEPTED || meeting.responderSsoUid === m.requesterSsoUid
        );
        // support multiple id
        meeting.canAccept = ssoUidArr.includes(meeting.responderSsoUid) && !collidedMeeting;
      }
      if (moment(meeting.startTime).isSameOrBefore()) {
        meeting.canAccept = false;
      }
      meeting.collisionMeetings = undefined;
      meeting.responder = {
        ssoUid: meeting.responderSsoUid,
        role: meeting.responderRole,
        firstName: meeting.responderFirstName,
        lastName: meeting.responderLastName,
        avatar: '',
        country: meeting.responderCountryCode,
        companyName: meeting.responderCompanyName || '',
        companyLogo: meeting.responderCompanyLogo || '',
        supplierUrn: meeting.responderSupplierUrn || '',
        exhibitorUrn: meeting.responderExhibitorUrn || '',
        fairCode: meeting.responderFairCode || '',
        fiscalYear: meeting.responderFiscalYear || '',
      };
      meeting.requester = {
        ssoUid: meeting.requesterSsoUid,
        role: meeting.requesterRole,
        firstName: meeting.requesterFirstName,
        lastName: meeting.requesterLastName,
        avatar: '',
        country: meeting.requesterCountryCode,
        companyName: meeting.requesterCompanyName || '',
        companyLogo: meeting.requesterCompanyLogo || '',
        supplierUrn: meeting.requesterSupplierUrn || '',
        exhibitorUrn: meeting.requesterExhibitorUrn || '',
        fairCode: meeting.fairCode || '',
        fiscalYear: meeting.fiscalYear || '',
      };
      meeting.fairThemeColor = this.fairService.getFairColor(meeting.fairCode);
    });

    for await (const meeting of data) {
      const targetCcdid = meeting.requesterRole.toLowerCase() === 'buyer' ? meeting.responderSsoUid : meeting.requesterSsoUid;
      const convertedSsoUid = (await this.contentService.getExhibitorSelfSsoUid(targetCcdid))?.ccdid;
      const registeredSeminar = await this.fairService.countRegisteredSeminarsByUserAndTimeRange(
        meeting.requesterSsoUid,
        convertedSsoUid,
        meeting.responderSsoUid,
        fairCode, moment(meeting?.startTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'),
        moment(meeting?.endTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss')
        );
      meeting.isCollidedWithEvent = !!registeredSeminar?.data?.count;
    }

    const isReachedAvailabilityPage = await this.unavailableTimeslotService.findIsReachedAvailabilityPage(ssoUid);
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '6', detail: { isReachedAvailabilityPage } }));
    if (!isReachedAvailabilityPage) {
      const dbResult = await this.unavailableTimeslotService.createReachedAvailabilityPageRecord(ssoUid);
      this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '6.1', detail: { dbResult } }));
    }
    meta.isReachedAvailabilityPage = isReachedAvailabilityPage;
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'getMeetings - fairs/:fairCode/meetings', step: '7', detail: { meta, data } }));
    return { meta, data };
  }

  // Create Meeting
  @Post('fairs/:fairCode/meetings')
  @HttpCode(201)
  public async createMeeting(
    @Auth('SSOUID') ssoUid: string,
    @Auth('SECONDARY_ID') secondaryId: string,
    @Param('fairCode') fairCode: string,
    @Body() body: CreateMeetingDto
): Promise<any> {
    const { responderSsoUid, startTime, endTime, isSkipSeminarChecking } = { ...body.data };
    let fairDates: any[] = [];

    this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - start', step: '1', detail: ${JSON.stringify({ ssoUid, fairCode, body })}`);

    if (!checkInputTimeIsPassCurrentTime(startTime)) {
      this.logger.log(
        `route: 'createMeeting - fairs/:fairCode/meetings - checkInputTimeIsPassCurrentTime', step: 'error', ${constant.MEETING.ERROR_MESSAGE.STARTTIME_OVER_CURRENT_TIME}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.STARTTIME_OVER_CURRENT_TIME,
      };
    }

    const { status, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'createMeeting - fairs/:fairCode/meetings - getCombinedFairCodes', step: 'error', ${JSON.stringify({
          status,
          message,
          fairCodes,
          fiscalYears,
        })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    const fairDatesData = await this.fairService.getFairDates(fairCode);

    if (fairDatesData?.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - getFairDates', step: 'error', ${JSON.stringify({ fairDatesData })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: fairDatesData?.message,
      };
    }

    if (!fairDatesData?.data?.online?.length && !fairDatesData?.data?.physical?.length) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - getFairDates', step: 'error', ${JSON.stringify({ fairDatesData })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.NO_FAIRDATE,
      };
    }

    if (body.data.type === MeetingType.ONLINE) {
      fairDates = fairDatesData.data.online;
    } else if (body.data.type === MeetingType.F2F) {
      fairDates = fairDatesData.data.physical;
    }

    const matchedFairDate = fairDates.find(({ start, end }: { start: string; end: string }) => {
      const fairStartTime = moment(start);
      const fairEndTime = moment(end);

      return moment(startTime).isBetween(fairStartTime, fairEndTime, undefined, '[]') && moment(endTime).isBetween(fairStartTime, fairEndTime, undefined, '[]');
    });
    if (!matchedFairDate) {
      this.logger.log(
        `route: 'createMeeting - fairs/:fairCode/meetings - matchedFairDate', step: 'error', detail: ${constant.MEETING.ERROR_MESSAGE.OUT_OF_FAIR_PERIOD}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.OUT_OF_FAIR_PERIOD,
      };
    }

    if (!isSkipSeminarChecking) {
      const registeredSeminar = await this.fairService.countRegisteredSeminarsByUserAndTimeRange(ssoUid, secondaryId, body.data.responderSsoUid, fairCode, moment(startTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'), moment(endTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'));

      if (registeredSeminar?.data?.status === constant.GENERAL_STATUS.FAIL) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.FAIL_TO_GET_REGISTERED_SEMINAR,
        };
      }

      if (registeredSeminar?.data?.count > 0) {
        return {
          status: 405,
          message: constant.MEETING.ERROR_MESSAGE.COLLIDED_SEMINAR,
        };
      }
    }

    const collidedMeetings = await this.meetingService.findCollided(
      ssoUid,
      responderSsoUid,
      secondaryId,
      fairCodes!,
      fiscalYears!,
      true,
      moment(startTime).toDate(),
      moment(endTime).toDate()
    );

    const combinedUnavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [ssoUid, responderSsoUid],
      fairCodes!,
      fiscalYears!,
      {}
    );

    const validationResult = MeetingValidator.validateCreateMeeting(
      ssoUid,
      responderSsoUid,
      moment(startTime).toDate(),
      moment(endTime).toDate(),
      collidedMeetings,
      combinedUnavailableTimeslots
    );

    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - validateCreateMeeting', step: 'error', ${JSON.stringify({ validationResult })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    const getFairSettingResponse = await this.fairService.getFairSetting(fairCode);

    if (getFairSettingResponse.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - getFairSetting', step: 'error', ${JSON.stringify({ getFairSettingResponse })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: getFairSettingResponse?.message,
      };
    }

    this.logger.log(
      `route: 'createMeeting - fairs/:fairCode/meetings - ready to createMeeting', step: '2', ${JSON.stringify({
        fairCodes,
        fiscalYears,
        fairDatesData,
        matchedFairDate,
        collidedMeetings,
        combinedUnavailableTimeslots,
        validationResult,
        getFairSettingResponse,
      })}`
    );

    const {
      status: createMeetingStatus,
      message: createMeetingErrorMessage,
      result: data,
    } = await this.meetingService.createMeeting(ssoUid, body.data.requesterRole, {
      ...body.data,
      fairCode,
      requesterSsoUid: ssoUid,
      fiscalYear: getFairSettingResponse?.data?.data?.fiscal_year || '',
    });

    // data.status === 0 -> success
    if (createMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - createMeeting', step: 'error', ${JSON.stringify({ data })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: createMeetingErrorMessage,
      };
    }

    await this.c2mService.handleNotification({
      templateId: NotificationTemplatesId.CREATE_MEETING,
      notificationType: NotificationType.CREATE_MEETING,
      meetingData: data!,
      fairCode,
      isRequester: false,
      skipWebNotifiction: false,
    });

    (<Meeting>data).responder = {
      ssoUid: data!.responderSsoUid,
      role: data!.responderRole,
      firstName: data!.responderFirstName,
      lastName: data!.responderLastName,
      avatar: '',
      country: data!.responderCountryCode,
      companyName: data!.responderCompanyName || '',
      companyLogo: data!.responderCompanyLogo || '',
      supplierUrn: data!.responderSupplierUrn || '',
      exhibitorUrn: data!.responderExhibitorUrn || '',
      fairCode: data!.responderFairCode || '',
      fiscalYear: data!.responderFiscalYear || '',
    };

    (<Meeting>data).requester = {
      ssoUid: data!.requesterSsoUid,
      role: data!.requesterRole,
      firstName: data!.requesterFirstName,
      lastName: data!.requesterLastName,
      avatar: '',
      country: data!.requesterCountryCode,
      companyName: data!.requesterCompanyName || '',
      companyLogo: data!.requesterCompanyLogo || '',
      supplierUrn: data!.requesterSupplierUrn || '',
      exhibitorUrn: data!.requesterExhibitorUrn || '',
      fairCode: data!.fairCode || '',
      fiscalYear: data!.fiscalYear || '',
    };

    let responseData: any = {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };

    if (data) {
      responseData['user-activity'] = {
        actionType: 'Create C2M Meeting',
        afterUpdate: data,
      };
    }

    this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - end', step: '3', ${JSON.stringify({ responseData })}`);
    return responseData;
  }

  // Update Meeting by meeting Id
  @Put('fairs/:fairCode/meetings/:id')
  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async updateMeeting(
    @Auth('SSOUID') ssoUid: string,
    @Auth('SECONDARY_ID') secondaryId: string,
    @Param('fairCode') fairCode: string,
    @Param('id') meetingId: string,
    @Body() updateMeetingDto: UpdateMeetingDto
  ): Promise<any> {
    this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - start', step: '1', ${JSON.stringify({ ssoUid, fairCode, meetingId, updateMeetingDto })}`);

    const meetingPayload = await this.meetingService.findByMeetingId(meetingId);
    const fields: Record<string, any> = {};
    switch (updateMeetingDto.action) {
      case UpdateMeetingDtoAction.REJECT:
        fields.responderSsoUid = In([ssoUid, secondaryId]);
        fields.status = In([MeetingStatus.PENDING, MeetingStatus.RELEASED]);
        break;
      case UpdateMeetingDtoAction.ACCEPT:
        fields.responderSsoUid = In([ssoUid, secondaryId]);
        fields.status = MeetingStatus.PENDING;
        break;

      default:
        break;
    }

    const finalUserId = [meetingPayload.result?.requesterSsoUid, meetingPayload.result?.responderSsoUid].find((userId:string | undefined) => {
      if (userId) {
        return [ssoUid, secondaryId].includes(userId);
      } return false;
    });

    if (!finalUserId) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'errors in userProfile, please try later'
      };
    }

    const { status, message, result: meeting } = await this.meetingService.findByMeetingId(meetingId, fields);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'updateMeeting - fairs/:fairCode/meetings/:id - findByMeetingId', step: 'error', ${JSON.stringify({ status, message, result: meeting })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    let response;
    let useractivity: any;
    const startTimeFromMeeting = meeting?.startTime;
    const endTimeFromMeeting = meeting?.endTime;
    switch (updateMeetingDto.action) {
      case UpdateMeetingDtoAction.ACCEPT: {
        if (!updateMeetingDto.data.isSkipSeminarChecking) {
          if (!startTimeFromMeeting || !endTimeFromMeeting) {
            return {
              status: constant.GENERAL_STATUS.FAIL,
              // suppose startTimeFromMeeting & endTimeFromMeeting must not null
              message: constant.MEETING.ERROR_MESSAGE.COLLIDED_SEMINAR,
            };
          }

          const registeredSeminar = await this.fairService.countRegisteredSeminarsByUserAndTimeRange(
            finalUserId, secondaryId, meeting!.responderSsoUid,
            fairCode, moment(startTimeFromMeeting).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'),
            moment(endTimeFromMeeting).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss')
            );

          if (registeredSeminar?.data?.status === constant.GENERAL_STATUS.FAIL) {
            return {
              status: constant.GENERAL_STATUS.FAIL,
              message: constant.MEETING.ERROR_MESSAGE.FAIL_TO_GET_REGISTERED_SEMINAR,
            };
          }

          if (registeredSeminar?.data?.count > 0) {
            return {
              status: 405,
              message: constant.MEETING.ERROR_MESSAGE.COLLIDED_SEMINAR,
            };
          }
        }

        response = await this.acceptMeeting(finalUserId, fairCode, <Meeting>meeting);

        if (response.status === constant.GENERAL_STATUS.FAIL) {
          this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - acceptMeeting', step: 'error', ${JSON.stringify({ response })}`);
          return {
            status: constant.GENERAL_STATUS.FAIL,
            message: response.message,
          };
        }

        await this.c2mService.handleNotification({
          templateId: NotificationTemplatesId.ACCEPT_MEETING_TO_REQUESTER,
          notificationType: NotificationType.ACCEPT_MEETING,
          meetingData: response.data,
          fairCode,
          isRequester: true,
          skipWebNotifiction: false,
        });

        await this.c2mService.handleNotification({
          templateId: NotificationTemplatesId.ACCEPT_MEETING_TO_RESPONDER,
          notificationType: NotificationType.ACCEPT_MEETING,
          meetingData: response.data,
          fairCode,
          isRequester: false,
          skipWebNotifiction: false,
        });

        useractivity = {
          actionType: 'Accpet C2M Meeting',
          beforeUpdate: meeting,
          afterUpdate: response.data
        };

        break;
      }

      case UpdateMeetingDtoAction.RESCHEDULE: {
        if (!updateMeetingDto.data.isSkipSeminarChecking) {
          const registeredSeminar = await this.fairService.countRegisteredSeminarsByUserAndTimeRange(finalUserId, secondaryId, meeting!.responderSsoUid, fairCode, moment(updateMeetingDto.data.startTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'), moment(updateMeetingDto.data.endTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'));

          if (registeredSeminar?.data?.status === constant.GENERAL_STATUS.FAIL) {
            return {
              status: constant.GENERAL_STATUS.FAIL,
              message: constant.MEETING.ERROR_MESSAGE.FAIL_TO_GET_REGISTERED_SEMINAR,
            };
          }

          if (registeredSeminar?.data?.count > 0) {
            return {
              status: 405,
              message: constant.MEETING.ERROR_MESSAGE.COLLIDED_SEMINAR,
            };
          }
        }

        response = await this.rescheduleMeeting(finalUserId, fairCode, <Meeting>meeting, updateMeetingDto.data);

        if (response.status === constant.GENERAL_STATUS.FAIL) {
          this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - rescheduleMeeting', step: 'error', ${JSON.stringify({ response })}`);
          return {
            status: constant.GENERAL_STATUS.FAIL,
            message: response.message,
          };
        }

        response.data.responder = {
          ssoUid: response.data.responderSsoUid,
          role: response.data.responderRole,
          firstName: response.data.responderFirstName,
          lastName: response.data.responderLastName,
          avatar: '',
          country: response.data.responderCountryCode,
          companyName: response.data.responderCompanyName || '',
          companyLogo: response.data.responderCompanyLogo || '',
          supplierUrn: response.data.responderSupplierUrn || '',
          exhibitorUrn: response.data.responderExhibitorUrn || '',
          fairCode: response.data.responderFairCode || '',
          fiscalYear: response.data.responderFiscalYear || '',
        };

        response.data.requester = {
          ssoUid: response.data.requesterSsoUid,
          role: response.data.requesterRole,
          firstName: response.data.requesterFirstName,
          lastName: response.data.requesterLastName,
          avatar: '',
          country: response.data.requesterCountryCode,
          companyName: response.data.requesterCompanyName || '',
          companyLogo: response.data.requesterCompanyLogo || '',
          supplierUrn: response.data.requesterSupplierUrn || '',
          exhibitorUrn: response.data.requsterExhibitorUrn || '',
          fairCode: response.data.fairCode || '',
          fiscalYear: response.data.fiscalYear || '',
        };

        if (response.data.newMeeting.assignerRole !== MeetingRole.ADMIN) {
          await this.c2mService.handleNotification({
            templateId: NotificationTemplatesId.RESCHEDULE_MEETING,
            notificationType: NotificationType.RESCHEDULE_MEETING,
            meetingData: response.data.newMeeting,
            fairCode,
            isRequester: false,
            skipWebNotifiction: false,
          });
        } else {
          await this.c2mService.handleNotification({
            templateId: NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
            notificationType: NotificationType.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
            meetingData: response.data.newMeeting,
            fairCode,
            isRequester: false,
            skipWebNotifiction: false,
          });
        }
        useractivity = {
          actionType: 'Reschedule C2M meeting',
          beforeUpdate: response.data.oldMeeting,
          afterUpdate: response.data.newMeeting
        };
        break;
      }

      case UpdateMeetingDtoAction.REJECT: {
        response = await this.rejectMeeting(finalUserId, <Meeting>meeting, updateMeetingDto.data);

        if (response.status === constant.GENERAL_STATUS.FAIL) {
          this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - rejectMeeting', step: 'error', ${JSON.stringify({ response })}`);
          return {
            status: constant.GENERAL_STATUS.FAIL,
            message: response.message,
          };
        }

        await this.c2mService.handleNotification({
          templateId: NotificationTemplatesId.REJECT_MEETING,
          notificationType: NotificationType.REJECT_MEETING,
          meetingData: response.data,
          fairCode,
          isRequester: true,
          skipWebNotifiction: false,
        });

        useractivity = {
          actionType: 'Reject C2M meeting',
          beforeUpdate: meeting,
          afterUpdate: response.data
        };

        break;
      }

      case UpdateMeetingDtoAction.CANCEL: {
        response = await this.cancelMeeting(finalUserId, <Meeting>meeting, { ...updateMeetingDto.data, cancelledByRole: finalUserId === (<Meeting>meeting).responderSsoUid ? (<Meeting>meeting).responderRole : (<Meeting>meeting).requesterRole });

        if (response.status === constant.GENERAL_STATUS.FAIL) {
          this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - cancelMeeting', step: 'error', ${JSON.stringify({ response })}`);
          return {
            status: constant.GENERAL_STATUS.FAIL,
            message: response.message,
          };
        }

        useractivity = {
          actionType: 'Cancel C2M meeting',
          beforeUpdate: meeting,
          afterUpdate: response.data
        };

        break;
      }
      default:
        break;
    }

    this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - end', step: '2', ${JSON.stringify({ response })}`);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: response.data,
      'user-activity': useractivity,
    };
  }

  // Get Unavailable Timeslot by SSOUID
  @Get('fairs/:fairCode/unavailableTimeslots')
  public async getUnavailableTimeslots(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any>> {
    const { status, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);
    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'fairs/:fairCode/unavailableTimeslots - getCombinedFairCodes', step: 'error', ${JSON.stringify({ status, message, fairCodes, fiscalYears })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }
    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers([ssoUid], fairCodes!, fiscalYears!, {});

    const data = TimeslotHelper.groupTimeslotsByDate(unavailableTimeslots, tz);

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  // Get both requester and responder unavailable timeslot combine with meetings and preset
  @Get('fairs/:fairCode/combinedUnavailableTimeslots')
  public async getCombinedUnavailableTimeslots(
    @Auth('SSOUID') ssoUid: string,
    @Auth('SECONDARY_ID') secondaryId: string,
    @Param('fairCode') fairCode: string,
    @Query() q: GetCombinedUnavailableTimeslotsDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any>> {
    const { responderSsoUid, requesterSsoUid } = q;
    const timeslotDtos: TimeslotDto[] = [];

    const { status, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'fairs/:fairCode/combinedUnavailableTimeslots - getCombinedFairCodes', step: 'error', ${JSON.stringify({
          status,
          message,
          fairCodes,
          fiscalYears,
        })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    const targetSsoUid = requesterSsoUid ?? ssoUid;
    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [targetSsoUid, responderSsoUid],
      fairCodes!,
      fiscalYears!,
      {}
    );

    unavailableTimeslots.forEach((unavailableTimeslot: UnavailableTimeslot) => {
      timeslotDtos.push({
        startTime: unavailableTimeslot.startTime,
        endTime: unavailableTimeslot.endTime,
      });
    });

    const meetings = await this.meetingService.findCollided(targetSsoUid, responderSsoUid, secondaryId, fairCodes!, fiscalYears!, true);

    meetings.forEach((meeting: Meeting) => {
      timeslotDtos.push({ startTime: meeting.startTime, endTime: meeting.endTime });
    });

    const data = TimeslotHelper.groupTimeslotsByDate(timeslotDtos, tz);

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Post('fairs/:fairCode/upcomingMeetingCollide')
  public async checkUpcomingMeetingCollide(
    @Auth('SSOUID') ssoUid: string,
    @Auth('SECONDARY_ID') secondaryId: string,
    @Param('fairCode') fairCode: string,
    @Body() body: CreateUnavailableTimeslotDtoData & GetMeetingsDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<any> {
    const ssoUidArr = [ssoUid, secondaryId];
    const { status: fairResultStatus, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);

    if (fairResultStatus === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'fairs/:fairCode/upcomingMeetingCollide - getCombinedFairCodes', step: 'error', ${JSON.stringify({
          status: fairResultStatus,
          message,
          fairCodes,
          fiscalYears,
        })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    const { fields, limit, page, status } = this.extractMeetingsParams({
      startTime: body.startTime,
      endTime: body.endTime,
      limit: body.limit,
      status: body.status,
      page: body.page,
      withCombinedFairs: true,
    });
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'upcomingMeetingCollide', step: '1', detail: { ssoUid, body } }));
    const upcomingMeetingFullDetails = await this.meetingService.paginateByConditions(ssoUidArr, status, fairCodes!, fiscalYears!, fields, page, limit, [], tz);
    const upcomingMeetingStartEnd = upcomingMeetingFullDetails.items.map((meeting: Meeting) => ({
      startTime: moment(meeting.startTime).toISOString(),
      endTime: moment(meeting.endTime).toISOString(),
    }));

    const timeslot = {
      startTime: moment(body.timeslots[0].startTime).toISOString(),
      endTime: moment(body.timeslots[0].endTime).toISOString(),
    };

    this.logger.log(JSON.stringify({ section: 'C2M', action: 'upcomingMeetingCollide', step: '2', detail: { upcomingMeetingStartEnd, timeslot } }));
    const deepEqual = (object1: Record<string, any>, object2: Record<string, any>): boolean => {
      const isObject = (object: Record<string, any>): boolean => object != null && typeof object === 'object';
      const keys1 = Object.keys(object1);
      const keys2 = Object.keys(object2);
      if (keys1.length !== keys2.length) {
        return false;
      }
      for (const key of keys1) {
        const val1 = object1[key];
        const val2 = object2[key];
        const areObjects = isObject(val1) && isObject(val2);
        if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
          return false;
        }
      }
      return true;
    };
    const isAnyMeetingCrashWithUpcomingMeeting = upcomingMeetingStartEnd.find((upcomingMeeting: any) => deepEqual(timeslot, upcomingMeeting));
    this.logger.log(JSON.stringify({ section: 'C2M', action: 'upcomingMeetingCollide', step: '3', detail: { isAnyMeetingCrashWithUpcomingMeeting } }));
    if (isAnyMeetingCrashWithUpcomingMeeting) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        data: { status: 400 },
        message: 'selected timeslot crashed with upcoming meeting(s)',
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: { status: 200 },
      message: 'no collided with upcoming meetings',
    };
  }

  @Post('fairs/:fairCode/unavailableTimeslots')
  public async updateUnavailableTimeslots(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Body() createUnavailableTimeslotDto: CreateUnavailableTimeslotDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<any> {
    // get fiscal year and fair code
    const [getFairSettingResponse, fairCodesResponse] = await Promise.all([
      this.fairService.getFairSetting(fairCode),
      this.fairService.getCombinedFairCodes(fairCode),
    ]);
    if (getFairSettingResponse.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'fairs/:fairCode/unavailableTimeslots - getFairSetting', step: 'error', ${JSON.stringify({ getFairSettingResponse })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: getFairSettingResponse.message,
      };
    }

    if (fairCodesResponse.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'fairs/:fairCode/unavailableTimeslots - getCombinedFairCodes', step: 'error', ${JSON.stringify({ fairCodesResponse })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: fairCodesResponse.message,
      };
    }

    const fiscalYear = getFairSettingResponse.data?.data?.fiscal_year || '';
    const fairCodes = fairCodesResponse?.fairCodes;

    // query user existing unavailableTimeslots and format it into timeslot
    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers([ssoUid], fairCodes!, [fiscalYear], {});
    let existingTimeslots: CreateUnavailableTimeslot[] = unavailableTimeslots.map((item: UnavailableTimeslot) => ({
      startTime: moment(item.startTime).tz(tz).toISOString(),
      endTime: moment(item.endTime).tz(tz).toISOString(),
    }));

    // format timeslot
    let timeslots: CreateUnavailableTimeslot[] = createUnavailableTimeslotDto.data.flatMap((dtoData: CreateUnavailableTimeslotDtoData) => dtoData.timeslots);

    timeslots = timeslots.flatMap((timeslot: CreateUnavailableTimeslot) => ({
      startTime: moment(timeslot.startTime).tz(tz).toISOString(),
      endTime: moment(timeslot.endTime).tz(tz).toISOString(),
    }));

    this.logger.log(
      JSON.stringify({
        section: 'UnavailableTimeslot',
        action: 'updateUnavailableTimeslots',
        step: '',
        detail: { existingTimeslots, targetTimeslots: timeslots },
      })
    );

    let resultMsg = '';
    // REMOVE unavailable timeslot
    if (createUnavailableTimeslotDto.isDelete) {
      const startTime: string[] = [];
      const endTime: string[] = [];

      // time string format
      timeslots.forEach((timeslot: CreateUnavailableTimeslot) => {
        startTime.push(timeslot.startTime);
        endTime.push(timeslot.endTime);
      });

      // look timeslot entity for deletion
      const timeslotEntitiesForDelete = await this.unavailableTimeslotService.findUnavailableTimeslotsByUser([ssoUid], fairCodes!, [fiscalYear], {
        startTime: In(startTime),
        endTime: In(endTime),
      });

      this.logger.log(
        JSON.stringify({ section: 'UnavailableTimeslot', action: 'updateUnavailableTimeslots', step: 'deleteTimeslots', detail: { timeslotEntitiesForDelete } })
      );
      await this.unavailableTimeslotService.remove(timeslotEntitiesForDelete);

      resultMsg = 'Successful release unavailable timeslot';

      // ADD unavailable timeslot
    } else {
      const startTime: string[] = [];
      const endTime: string[] = [];

      // time string format
      timeslots.forEach((timeslot: CreateUnavailableTimeslot) => {
        startTime.push(timeslot.startTime);
        endTime.push(timeslot.endTime);
      });

      // Check any upcoming meeting
      const collidedUpcomingMeetings: Meeting[] = await this.meetingService.findByParams({
        where: [
          {
            requesterSsoUid: ssoUid,
            status: MeetingStatus.ACCEPTED,
            fairCode: In(fairCodes!),
            fiscalYear,
            startTime: In(startTime),
            endTime: In(endTime),
          },
          {
            responderSsoUid: ssoUid,
            status: MeetingStatus.ACCEPTED,
            fairCode: In(fairCodes!),
            fiscalYear,
            startTime: In(startTime),
            endTime: In(endTime),
          },
        ],
      });

      if (collidedUpcomingMeetings.length) {
        return {
          data: {
            code: 1001,
            id: 0,
          },
          message: 'error-1001, Create unavailable timeslot collided with upcoming meeting',
        };
      }

      // Check any pending meeting - requester = ssouid
      const collidedPendingOthersMeetings: Meeting[] = await this.meetingService.findByParams({
        where: [
          {
            requesterSsoUid: ssoUid,
            status: MeetingStatus.PENDING,
            fairCode: In(fairCodes!),
            fiscalYear,
            startTime: In(startTime),
            endTime: In(endTime),
          },
        ],
      });

      if (collidedPendingOthersMeetings.length) {
        return {
          data: {
            code: 1002,
            id: 0,
          },
          message: 'error-1002, Create unavailable timeslot collided with pending meeting',
        };
      }

      // create unavailableTimeslots
      let timeslotsForCreate = timeslots.filter(
        (timeslot: CreateUnavailableTimeslot) => !existingTimeslots.some((temp: CreateUnavailableTimeslot) => this.timeslotComparison(timeslot, temp))
      );
      await this.unavailableTimeslotService.createUnavailableTimeslots(ssoUid, fairCode, fiscalYear, timeslotsForCreate);
      resultMsg = 'Successful create unavailable timeslot';
    }

    // return unavailableTimeslotService
    this.logger.log(JSON.stringify({ section: 'UnavailableTimeslot', action: 'updateUnavailableTimeslots', step: '', detail: { timeslots } }));
    const updatedUnavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers([ssoUid], fairCodes!, [fiscalYear], {});

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: updatedUnavailableTimeslots,
      message: resultMsg,
    };
  }

  @Get('fairs/:fairCode/verifyCollidedSeminars')
  public verifyCollidedSeminars(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Record<string, any> {
    const data = this.c2mService.verifyCollidedSeminar(fairCode, ssoUid, moment(startTime).toDate(), moment(endTime).toDate());

    return { data };
  }

  @Get('user/consent')
  public async getConsentRecord(@Auth('SSOUID') ssoUid: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    data.acceptedConsent = await this.c2mService.getUserConsent(ssoUid);
    return { data };
  }

  @Post('user/consent')
  @HttpCode(201)
  public async createConsentRecord(@Auth('SSOUID') ssoUid: string): Promise<Record<string, any>> {
    const data = await this.c2mService.createUserConsent(ssoUid);
    return { data };
  }

  private timeslotComparison(a: CreateUnavailableTimeslot, b: CreateUnavailableTimeslot): boolean {
    return a.startTime === b.startTime && a.endTime === b.endTime;
  }

  /**
   * Update meeting splited by actions
   */
  private async acceptMeeting(ssoUid: string, fairCode: string, meeting: Meeting): Promise<any> {
    const { requesterSsoUid, startTime, endTime } = meeting;
    const { status, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    this.logger.log(`route: 'acceptMeeting - start', step: '1', ${JSON.stringify({ fairCodes, fiscalYears })}`);
    // Find confirmed meetings - set withSelfPending = false
    const collidedMeetings = await this.meetingService.findCollided(
      requesterSsoUid,
      ssoUid,
      ssoUid,
      fairCodes!,
      fiscalYears!,
      false,
      moment(startTime).toDate(),
      moment(endTime).toDate()
    );

    const combinedUnavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [ssoUid, requesterSsoUid],
      fairCodes!,
      fiscalYears!,
      {}
    );

    const validationResult = MeetingValidator.validateAcceptMeeting(meeting, collidedMeetings, combinedUnavailableTimeslots);
    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    this.logger.log(`route: 'acceptMeeting', step: '2', ${JSON.stringify({ collidedMeetings, combinedUnavailableTimeslots, validationResult })}`);
    const {
      status: acceptMeetingStatus,
      message: acceptMeetingErrorMessage,
      result: acceptMeetingResult,
    } = await this.meetingService.acceptMeeting(ssoUid, meeting);

    if (acceptMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: acceptMeetingErrorMessage,
      };
    }

    const {
      status: releaseMeetingStatus,
      message: releaseMeetingErrorMessage,
      result: releaseMeetingResult,
    } = await this.meetingService.releasePendingMeeting([ssoUid, meeting.requesterSsoUid], fairCodes!, moment(startTime).toDate(), moment(endTime).toDate());

    if (releaseMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: releaseMeetingErrorMessage,
      };
    }

    this.logger.log(`route: 'acceptMeeting - end', step: '3', ${JSON.stringify({ acceptMeetingResult, releaseMeetingResult })}`);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: acceptMeetingResult,
    };
  }

  private async rescheduleMeeting(ssoUid: string, fairCode: string, meeting: Meeting, fields: Record<string, any>): Promise<any> {
    // const isUserRequester = meeting.requesterSsoUid === ssoUid;
    const { startTime, endTime } = fields;
    let fairDates: any[] = [];
    const requesterSsoUid = ssoUid;
    const responderSsoUid = meeting.responderSsoUid === ssoUid ? meeting.requesterSsoUid : meeting.responderSsoUid;
    // fields.responderSsoUid = meeting.responderSsoUid === ssoUid ? meeting.requesterSsoUid : meeting.responderSsoUid;
    // fields.requesterSsoUid = isUserRequester ? meeting.requesterSsoUid : meeting.responderSsoUid;

    const { status, message, fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    this.logger.log(`route: 'rescheduleMeeting - start', step: '1', ${JSON.stringify({ fairCodes, fiscalYears })}`);
    const fairDatesResult = await this.fairService.getFairDates(fairCode);

    if (!fairDatesResult?.data?.online?.length && !fairDatesResult?.data?.physical?.length) {
      this.logger.log(`route: 'rescheduleMeeting - fairs/:fairCode/meetings - getFairDates', step: 'error', ${JSON.stringify({ fairDatesResult })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.NO_FAIRDATE,
      };
    }

    if (fields.type === MeetingType.ONLINE) {
      fairDates = fairDatesResult.data.online;
    } else if (fields.type === MeetingType.F2F) {
      fairDates = fairDatesResult.data.physical;
    } else {
      return {
        status: constant.MEETING.ERROR_MESSAGE.NO_MEETINGTYPE,
        message: fairDatesResult.message,
      };
    }

    if (fairDatesResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: fairDatesResult.message,
      };
    }

    const matchedFairDate = fairDates.find(({ start, end }: { start: string; end: string }) => {
      const fairStartTime = moment(start);
      const fairEndTime = moment(end);

      return moment(startTime).isBetween(fairStartTime, fairEndTime, undefined, '[]') && moment(endTime).isBetween(fairStartTime, fairEndTime, undefined, '[]');
    });

    if (!matchedFairDate) {
      this.logger.log(`route: 'rescheduleMeeting', step: '2', ${JSON.stringify({ fairDatesResult, matchedFairDate })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.OUT_OF_FAIR_PERIOD,
      };
    }

    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [requesterSsoUid, responderSsoUid],
      fairCodes!,
      fiscalYears!,
      {}
    );

    const collidedMeetings = await this.meetingService.findCollided(
      requesterSsoUid,
      responderSsoUid,
      requesterSsoUid,
      fairCodes!,
      fiscalYears!,
      true,
      moment(startTime).toDate(),
      moment(endTime).toDate()
    );

    const validationResult = MeetingValidator.validateRescheduleMeeting(
      ssoUid,
      meeting,
      collidedMeetings.filter((m: Meeting) => m.id !== meeting.id),
      unavailableTimeslots,
      fields
    );

    this.logger.log(`route: 'rescheduleMeeting', step: '3', ${JSON.stringify({ unavailableTimeslots, collidedMeetings, validationResult })}`);
    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    const rescheduleMeetingResult = await this.meetingService.rescheduleMeeting(ssoUid, meeting, fields);

    this.logger.log(`route: 'rescheduleMeeting', step: '4', ${JSON.stringify({ rescheduleMeetingResult })}`);
    if (rescheduleMeetingResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: rescheduleMeetingResult.message,
      };
    }

    const {
      status: reverseReleasedMeetingStatus,
      message: reverseReleasedMeetingErrorMessage,
      result,
    } = await this.meetingService.reverseReleasedMeeting(meeting.responderSsoUid, fairCodes!, meeting.startTime, meeting.endTime);

    this.logger.log(`route: 'rescheduleMeeting', step: '5', ${JSON.stringify({ result })}`);
    if (reverseReleasedMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: reverseReleasedMeetingErrorMessage,
      };
    }

    this.logger.log(
      `route: 'rescheduleMeeting - end', step: '6', ${JSON.stringify({
        oldMeeting: rescheduleMeetingResult.oldMeeting,
        newMeeting: rescheduleMeetingResult.newMeeting,
      })}`
    );
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: {
        oldMeeting: rescheduleMeetingResult.oldMeeting,
        newMeeting: rescheduleMeetingResult.newMeeting,
      },
    };
  }

  private async rejectMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): Promise<any> {
    const validationResult = MeetingValidator.validateRejectMeeting(fields);
    this.logger.log(`route: 'rejectMeeting - start', step: '1', ${JSON.stringify({ validationResult })}`);
    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    const { status, message, result: data } = await this.meetingService.rejectMeeting(ssoUid, meeting, fields);
    this.logger.log(`route: 'rejectMeeting', step: '2', ${JSON.stringify({ status, message, result: data })}`);
    if (status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    this.logger.log(`route: 'rejectMeeting - end', step: '3', ${JSON.stringify({ data })}`);
    return {
      status: 200,
      data,
    };
  }

  private async cancelMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): Promise<any> {
    const validationResult = MeetingValidator.validateCancelMeeting(ssoUid, meeting, fields);
    this.logger.log(`route: 'cancelMeeting - start', step: '1', ${JSON.stringify({ validationResult })}`);
    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    const { status: cancelMeetingStatus, message: cancelMeetingErrorMessage, result: data } = await this.meetingService.cancelMeeting(ssoUid, meeting, fields);
    this.logger.log(`route: 'cancelMeeting', step: '2', ${JSON.stringify({ data })}`);
    if (cancelMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: cancelMeetingErrorMessage,
      };
    }

    const { status, message, fairCodes } = await this.fairService.getCombinedFairCodes(meeting.fairCode);
    this.logger.log(`route: 'cancelMeeting', step: '3', ${JSON.stringify({ fairCodes })}`);
    if (status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    const {
      status: reverseReleasedMeetingStatus,
      message: reverseReleasedMeetingErrorMessage,
      result,
    } = await this.meetingService.reverseReleasedMeeting(meeting.responderSsoUid, fairCodes!, meeting.startTime, meeting.endTime);

    this.logger.log(`route: 'cancelMeeting', step: '4', ${JSON.stringify({ result })}`);
    if (reverseReleasedMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: reverseReleasedMeetingErrorMessage,
      };
    }

    this.logger.log(`route: 'cancelMeeting - end', step: '5', ${JSON.stringify({ data })}`);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  private extractMeetingsParams(q: GetMeetingsDto): Record<string, any> {
    let { startTime, endTime, limit, status, page } = q;

    const fields: Record<string, any> = {};
    if (startTime) {
      fields.startTime = moment(startTime).toDate();
    }

    if (endTime) {
      fields.endTime = moment(endTime).toDate();
    }

    if (startTime && endTime && moment(endTime).diff(startTime, 'd') >= 1) {
      limit = 0;
    }

    return { fields, limit, page, status };
  }

  @Post('getAndSetC2MLoginStatus')
  public getAndSetC2MLoginStatus(@Body() body: getAndSetC2MLoginStatus): Record<string, any> {
    let { userId, fairCode, fiscalYear, eoaFairId, role } = body;

    let request: () => Promise<any> = async () => Promise.reject({
        status: 400,
        message: 'Something is wrong',
      });

    switch (role.toUpperCase()) {
      case MeetingRole.BUYER:
        request = async () => this.fairService.getAndSetC2MLoginStatus(userId, fairCode, fiscalYear);
        break;
      case MeetingRole.EXHIBITOR:
        request = async () => this.exhibitorService.getAndSetC2MLoginStatus(userId, eoaFairId, fairCode);
        break;
      default:
        break;
    }

    return request()
      .then((result) => ({
        status: result?.data?.status,
        isReachedAvailabilityPage: result?.data?.isReachedAvailabilityPage,
        'user-activity': result?.data?.['user-activity'],
      }))
      .catch((error) => ({
        status: 400,
        message: error?.message ?? JSON.stringify(error),
      }));
  }

  @Post('getUserProfileForMeetingCreation')
  public async getUserProfileForMeetingCreation(@Body() body: Record<string, any>) {
    const { ssoUid, buyerFairCode, buyerFiscalYear, ccdId, exhibitorFairCode } = body;
    return Promise.all([
      this.fairService.getFairParticipantProfile(ssoUid, buyerFairCode, buyerFiscalYear),
      this.exhibitorService.getExhibitorProfileFromES(ccdId, exhibitorFairCode, 'en'), // eoa (exhibitor db) only saving english data
    ])
      .then(async ([buyerResponse, exhibitorResponse]) => {
        let errorMessage = '';
        if (!buyerResponse || !buyerResponse?.data || !buyerResponse?.data?.data) {
          errorMessage = "Couldn't find any buyer profile; ";
        }
        if (!exhibitorResponse || !exhibitorResponse?.data || !exhibitorResponse?.data?.data) {
          errorMessage += "Couldn't find any exhibitor profile";
        }

        if (errorMessage.length) {
          return Promise.reject({
            status: 401,
            message: errorMessage,
          });
        }

        const buyerProfile = {
          buyerFirstName: buyerResponse?.data?.data?.firstName,
          buyerLastName: buyerResponse?.data?.data?.lastName,
          buyerFairCode,
          buyerFiscalYear: buyerResponse?.data?.data?.fiscalYear,
          buyerCompanyName: buyerResponse?.data?.data?.companyName,
          buyerCountryCode: buyerResponse?.data?.data?.addressCountryCode,
        };

        const exhibitorESProfile = exhibitorResponse?.data?.data?.hits?.[0];

        const exhibitorMappedProfile = {
          exhibitorFirstName: exhibitorESProfile?.exhibitorFirstName,
          exhibitorLastName: exhibitorESProfile?.exhibitorLastName,
          exhibitorFairCode,
          exhibitorFiscalYear: exhibitorESProfile?.fairFiscalYear,
          exhibitorCompanyName: exhibitorESProfile?.exhibitorName,
          exhibitorCountryCode: exhibitorESProfile?.countrySymbol,
          exhibitorBoothNumber: exhibitorESProfile?.boothDetails?.[0]?.boothNumber,
          exhibitorSupplierUrn: exhibitorESProfile?.supplierUrn,
          exhibitorCompanylogo: exhibitorESProfile?.supplierLogo,
          countryDesc: exhibitorESProfile?.countryDescEn,
          natureofBusinessSymbols: exhibitorESProfile?.natureofBusinessSymbols,
          exhibitorType: exhibitorESProfile?.exhibitorType,
          exhibitorUrn: exhibitorESProfile?.exhibitorUrn,
          vepNatureofBusinesses: null as any,
        };

        let contentServiceObj = null;
        if (exhibitorESProfile?.natureofBusinessSymbols && exhibitorESProfile?.natureofBusinessSymbols.length > 0) {
          const nobValue = await this.contentService.getNobValue(exhibitorESProfile?.natureofBusinessSymbols);
          if (nobValue) {
            contentServiceObj = nobValue;
          }
        }

        const temp = contentServiceObj?.data?.data ? Object.values(contentServiceObj?.data?.data) : [];

        const getNobLangArr = (input: string) => {
          if (temp && temp.length > 0) {
            return temp.map((e: any) => e[input] ?? '');
          }
          return [];
        };

        exhibitorMappedProfile.vepNatureofBusinesses = {
          en: getNobLangArr('en'),
          tc: getNobLangArr('tc'),
          sc: getNobLangArr('sc'),
        };

        return {
          status: 200,
          buyerProfile,
          exhibitorProfile: exhibitorMappedProfile,
        };
      })
      .catch((error) => ({
        status: error?.status ?? 400,
        message: error?.message ?? JSON.stringify(error),
      }));
  }

  public removeDuplicateDate = (date: Date[], timezone: string) => {
    const tempDate: string[] = [];
    const mappedDate: string[] = [];
    date.forEach((date) => {
      const userTimezoneDate = moment(date).tz(timezone).format('YYYY-MM-DD');
      const utcDateTime = moment(date).utc().format('YYYY-MM-DD HH:mm:ss');
      if (!tempDate.find((temp) => temp === userTimezoneDate)) {
        tempDate.push(userTimezoneDate);
        mappedDate.push(utcDateTime);
      }
    });
    return mappedDate;
  };

  @Get('createCalendarEvent/:ssoUid/:fairCode')
  public async createiCalendarEvent(@Param('ssoUid') ssoUid: string, @Param('fairCode') fairCode: string) {
    const currentTime = moment().utc().toDate();
    return this.meetingService.findUpcomingMeetingsBySsoUid(ssoUid, fairCode, { startTime: MoreThanOrEqual(currentTime), status: MeetingStatus.ACCEPTED });
  }

  @Post('getConfigValue')
  public getConfigValue(@Body() body: any): Record<string, any> {
    const { page, count } = body;
    return this.cbmService.getConfigValue({ page, count });
  }

  @ApiOperation({ summary: 'Get C2M config value by id' })
  @ApiResponse({
    status: 200,
    description: 'Get C2M config value Success',
    schema: { example: {
      status: 200,
      data: {
        fieldName: 'Minutes before sent out seminar reminder',
        unit: 'MINUTE',
        configValue: '30'
      }
    } },
  })
  @ApiResponse({
    status: 500,
    description: 'System error',
  })
  @Post('getConfigValueById')
  public getConfigValueById(@Body() body: GetConfigValueByIdDto): Record<string, any> {
    const { id } = body;
    return this.c2mService.getConfigValueById({ id });
  }

  @Get('getMeetingById/:meetingId')
  public async getMeetingById(@Param('meetingId') meetingId: string) {
    return this.meetingService.findMeetingById(meetingId);
  }

  @Get('getOnlineMeetingStatusById/:meetingId')
  public async getOnlineMeetingStatusById(@Param('meetingId') meetingId: string) {
    return this.meetingService.getOnlineMeetingStatusById(meetingId);
  }

  @Post('/fair/:fairCode/:fiscalYear/createCIPBuyerTimeslots')
  public async createCIPBuyerTimeslots(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string,
    @Body('data') data: CreateCIPUnavailableTimeslot[]
  ): Promise<any> {
    // query CIPBuyer existing available timeslots and format it into timeslots
    const cipFairTimeSlot = await this.fairService.getCIPFairDates(fairCode, fiscalYear);
    // console.log(cipFairTimeSlot, cipFairTimeSlot.data[0].availableTimeRange, 'cipFairTime');

    // Map all CIP fair time ranges as timeslots
    if (cipFairTimeSlot.data) {
      const minPeriod = 30;
      let second = 0;

      let formattedFairTimeslots: CreateUnavailableTimeslot[];
      // format as half-hour range for all CIP timeslots
      formattedFairTimeslots = cipFairTimeSlot.data.flatMap((timeRange: any) => timeRange.availableTimeRange.flatMap((timeslots: any) => {
          const maxMinTime = moment(timeslots.endTime).diff(timeslots.startTime, 'minutes');

          const timeToAdd30Mins = maxMinTime / minPeriod;

          const formattedTimeSlots = [];
          for (let time = 0; time < timeToAdd30Mins; time += 1) {
            let startTime;
            let endTime;

            startTime = moment(timeslots.startTime)
              .add(minPeriod * time, 'minutes')
              .tz('UTC')
              .toISOString();

            second += minPeriod;
            second = second >= 60 ? second % 60 : second;

            endTime = moment(timeslots.startTime)
              .add(minPeriod * (time + 1), 'minutes')
              .tz('UTC')
              .toISOString();

            formattedTimeSlots.push({ startTime, endTime });
          }

          return formattedTimeSlots;
        }));

      // console.log(formattedFairTimeslots, 'all cip timeslot');

      const formattedSelectedTimeslots = data.flatMap((timeSlots: any) => {
        const maxMinTime = moment(timeSlots.endTime).diff(timeSlots.startTime, 'minutes');
        const timeToAdd30Mins = maxMinTime / minPeriod;

        const formattedTimeSlots = [];
        for (let time = 0; time < timeToAdd30Mins; time += 1) {
          let startTime;
          let endTime;

          startTime = moment(timeSlots.startTime)
            .add(minPeriod * time, 'minutes')
            .tz('UTC')
            .toISOString();

          second += minPeriod;
          second = second >= 60 ? second % 60 : second;

          endTime = moment(timeSlots.startTime)
            .add(minPeriod * (time + 1), 'minutes')
            .tz('UTC')
            .toISOString();

          formattedTimeSlots.push({ startTime, endTime });
        }

        return formattedTimeSlots;
      });

      // console.log(formattedSelectedTimeslots, 'after push selected');

      for (let i = formattedFairTimeslots.length - 1; i >= 0; i--) {
        for (let j = 0; j < formattedSelectedTimeslots.length; j++) {
          if (formattedFairTimeslots[i] && formattedFairTimeslots[i].startTime == formattedSelectedTimeslots[j].startTime) {
            formattedFairTimeslots.splice(i, 1);
          }
        }
      }
      // let timeslotsForCreate = formattedFairTimeslots.filter(
      //   (timeslot: any) => !formattedSelectedTimeslots.some((temp: any) => this.timeslotComparison(timeslot, temp))
      // );

      console.log(formattedFairTimeslots, 'after filter ');

      await this.unavailableTimeslotService.createUnavailableTimeslots(ssoUid, fairCode, fiscalYear, formattedFairTimeslots);
    }

    return {
      status: 200,
      message: 'Successful create unavailable CIP timeslots',
    };
  }
  // @Post('handleNotificationForSeminar')
  // public handleNotificationForSeminar(@Body() body: HandleNotificationForSeminarDto): Record<string, any> {
  //   const { templateId, notificationType, seminarData, skipWebNotifiction } = body;
  //   return this.c2mService.handleNotificationForSeminar({ templateId, notificationType, seminarData, userData: null, currFair: null, summary: false, skipWebNotifiction, configRangeStart: null, configRangeEnd: null });
  // }

  @Post('buyerRegistrationSyncSNS')
  public async buyerRegistrationSyncSNS(@Body() body: seminarRegistrationDto): Promise<any> {
    if (body) {
      return {
        status: 200,
        message: 'Successful send buyer registration sync from SNS',
        response: {
          responseMetadata: {
            RequestId: '',
            MD5OfMessageBody: '',
            MessageId: '',
            SequenceNumber: '',
          },
        },
      };
    }
      return {
        status: 400,
        message: '{sns response}',
      };
  }

  @Post('triggerSeminarRegistrationNotification')
  public async triggerSeminarRegistrationNotification(@Body() body: Record<string, any>): Promise<any> {
    const { userId, fairCode, fiscalYear, eventId, seminarId } = body;
    this.logger.log(JSON.stringify({ action: 'trigger', section: 'Notification - triggerSeminarRegistrationNotification', step: '1', detail: `input body: ${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}` }));

    return this.notificationAPIService.getMessageBodyForSns({ templateId: NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS, templateSource: templateSource.DIRECT })
    .then((messageBodyTemplate: any) => {
      if (messageBodyTemplate.status === 400 && !messageBodyTemplate.data) {
        this.logger.log(JSON.stringify({ action: 'getMessageBodyForSns', section: `Notification - handleNotificationForSeminarSummary_${NotificationType.SEMINAR_REGISTRATION_SUCCESS}`, step: 'error', detail: `Request failed ${NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}` }));
        return Promise.reject(`Request failed ${NotificationTemplatesId.SEMINAR_REGISTRATION_SUCCESS} ${fairCode}, getTemplate API response: ${JSON.stringify(messageBodyTemplate)}`)
      }
        return Promise.all([this.c2mService.seminarRegistrationReminder(userId, fairCode, fiscalYear, eventId, seminarId, messageBodyTemplate)])
    })
    .then((result) => {
      if (!result?.length) {
        this.logger.log(JSON.stringify({ action: 'return error', section: 'Notification - triggerSeminarRegistrationNotification', step: 'error', detail: `input body: ${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}. error msg: ${JSON.stringify(result)}` }));
        return Promise.reject(`no noti handled ${JSON.stringify(result)}`);
      }

      this.logger.log(JSON.stringify({ action: 'return', section: 'Notification - triggerSeminarRegistrationNotification', step: '2', detail: `input body: ${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}. error msg: ${JSON.stringify(result)}` }));
      return {
        status: 200,
        message: `message: ${JSON.stringify(result)}`,
      };
    })
    .catch((error:any) => {
      this.logger.log(JSON.stringify({ action: 'catch error', section: 'Notification - triggerSeminarRegistrationNotification', step: 'error', detail: `input body: ${userId}, ${fairCode}, ${fiscalYear}, ${eventId}, ${seminarId}. error msg: ${JSON.stringify(error)}` }));
      return {
        status: 400,
        message: `catch error detail: ${JSON.stringify(error)}`,
      };
    });
  }

  @Post('applyAllUnavailableTimeslots')
  public async applyAllUnavailableTimeslots(
    @Auth('SSOUID') ssoUid: string,
    @Body() body: any
    ): Promise<any> {
      const { fairCode, fiscalYear, selectedDate, fairStartDate, fairEndDate, skipChecking } = body;

      return this.fairService.getFairSetting(fairCode)
      .then((fairSettingResult: any): any => {
        if (fairSettingResult.status === constant.GENERAL_STATUS.FAIL) {
          this.logger.log(`route: 'fairs/:fairCode/unavailableTimeslots - getFairSetting', step: 'error', ${JSON.stringify({ fairSettingResult })}`);
          return Promise.reject({
            status: constant.GENERAL_STATUS.FAIL,
            message: fairSettingResult.message,
          });
        }

        return Promise.all([
          this.unavailableTimeslotService.getUnavailableDate(ssoUid, fairCode, fiscalYear,
            moment.utc(fairStartDate).format('YYYY-MM-DD'),
            moment.utc(fairEndDate).format('YYYY-MM-DD')),
          this.meetingService.getUserConfirmAndPendingMeeting(ssoUid, fairCode, fiscalYear)
        ]);
      })
      .then(async ([unavailableTimeslot, meeetingInfo]) => {
        const collidedTimeSlot: any = [];
        let haveConflict = false;
        unavailableTimeslot?.length && unavailableTimeslot.forEach((timeslot: any) => {
          meeetingInfo?.length && meeetingInfo.forEach((meeting: any) => {
            const utcMeetingTime = moment.utc(meeting.startTime).format('HH:mm:ss');
            const utcUnavailableTime = moment.utc(timeslot.startTime).format('HH:mm:ss');
            if (utcMeetingTime === utcUnavailableTime) {
              collidedTimeSlot.push(meeting.startTime);
              haveConflict = true;
            }
          });
        });

        if (!skipChecking && haveConflict) {
          return Promise.reject({
            status: 205,
            message: 'Timeslot conflict with arranged meeting'
          });
        }

        return Promise.all([
          unavailableTimeslot.filter((timeslot: any) => moment.utc(timeslot.startTime).format('YYYY-MM-DD') === selectedDate),
          collidedTimeSlot,
          this.unavailableTimeslotService.deleteUnavailableDate(ssoUid, fairCode, fiscalYear)
        ]);
      })
      .then(([unavailableTimeslot, collidedTimeSlot]) => {
        if (!unavailableTimeslot?.length) {
          return Promise.reject({
            status: 206,
            message: 'No need to apply all timeslot to other date'
          });
        }
        let collidedTimeSlotCount = 0;
        const entityArray: UnavailableTimeslot[] = [];
        const diffDays = moment.utc(fairEndDate).diff(moment.utc(fairStartDate), 'days') + 1;
        for (let index = 0; index < diffDays; index++) {
          const startDate = moment.utc(fairStartDate).add('day', index);

          const year = moment.utc(startDate).get('year');
          const month = moment.utc(startDate).get('month');
          const date = moment.utc(startDate).get('date');

          unavailableTimeslot.forEach((timeslot: any) => {
            const newStartTime = moment.utc(timeslot.startTime).set({
              year,
              month,
              date
            }).toDate();

            const newEndTime = moment.utc(timeslot.startTime).set({
              year,
              month,
              date
            }).add('minutes', 30).toDate();

            if (!collidedTimeSlot.find((CTS: any) => moment(CTS).format('YYYY-MM-DD') === moment(newStartTime).format('YYYY-MM-DD'))) {
              const newEntity = new UnavailableTimeslot();
              newEntity.ssoUid = ssoUid;
              newEntity.fairCode = fairCode;
              newEntity.fiscalYear = fiscalYear;
              newEntity.startTime = newStartTime;
              newEntity.endTime = newEndTime;
              newEntity.createdBy = ssoUid;
              newEntity.creationTime = moment.utc().toDate();
              entityArray.push(newEntity);
            } else {
              ++collidedTimeSlotCount;
            }
          });
        }
        this.unavailableTimeslotService.saveTimeslotByBatch(entityArray);

        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          beingInsertCount: diffDays * unavailableTimeslot.length - collidedTimeSlotCount
        };
      })
      .catch((error) => ({
        status: error?.status ?? constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error)
      }));
  }

  @Post('countUnavailableTimeslot')
  public async countUnavailableTimeslot(
    @Auth('SSOUID') ssoUid: string,
    @Body() body: any
  ) {
    const { fairCode, fiscalYear } = body;
    return this.unavailableTimeslotService.countUnavailableTimeslot(ssoUid, fairCode, fiscalYear)
    .then((result) => ({
        status: 200,
        count: result
      }))
    .catch((error) => ({
        status: error?.status ?? constant.GENERAL_STATUS.FAIL,
        message: error?.message ?? JSON.stringify(error)
      }));
  }

  @Post('countMeetingBetweenTimeslot')
  public async countMeetingBetweenTimeslot(
    @Body() body: any
  ) {
    const { timeRanges } = body;
    return this.meetingService.countMeetingBetweenTimeslot(timeRanges);
  }
    // testing only
    @Post('getCache')
    public getCache(@Body('key') key: string) {
      return this.fairService.getCache(key);
    }
  
    @Post('removeCache')
    public removeCache(@Body('key') key: string) {
      return this.fairService.deleteCache(key);
    }
  
    @Post('getKeysByPattern')
    public getKeysByPattern(@Body('key') key: string) {
      return this.fairService.getKeysByPattern(key);
    }
  
    @Post('addCache')
    public addCache(@Body('key') key: string, @Body('value') value: string) {
      return this.fairService.addCache(key, value);
    }
}
