/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Body, Controller, Get, HttpCode, Param, Post, Query, Headers, Put, UseInterceptors } from '@nestjs/common';
import moment from 'moment';
import { In } from 'typeorm';
import { constant } from '../../config/constant';
import { PermissionRefEnum } from '../../config/permissonRef';
import { AdminUserDto } from '../../core/adminUtil/jwt.util';
import { AdminJwtInterceptor } from '../../core/interceptors/adminJwt.interceptor';
import { Logger } from '../../core/utils';
import { AdminUserDecorator } from '../../decorators/adminUser.decorator';
import { CBMAutoRefreshMeetingsDtoData } from '../../dto/cbmAutoRefreshMeetings.dto';
// import { UpdateC2mConfigDto } from '../../dto/c2mConfig.dto';
import { CBMCreatingMeetingDto } from '../../dto/cbmCreateMeeting.dto';
import { CBMPaginateBuyerDto } from '../../dto/cbmFilterBuyer.dto';
import { CBMPaginateExhibitorDto } from '../../dto/cbmFilterExhibitor.dto';
import { CBMPaginateMeetingDto } from '../../dto/cbmFilterMeeting.dto';
import { CBMPermission } from '../../dto/cbmPermission.dto';
import { GetCombinedUnavailableTimeslotsDto } from '../../dto/getCombinedUnavilableTimeslots.dto';
import { GetNearestTimeslotDto } from '../../dto/getNearestTimeslot.dto';
import { TimeslotDto } from '../../dto/timeslot.dto';
import { UpdateMeetingDto } from '../../dto/updateMeeting.dto';
import { Meeting } from '../../entities/meeting.entity';
import { UnavailableTimeslot } from '../../entities/unavailableTimeslot.entity';
import { TimeslotHelper } from '../../helpers/timeslotHelper';
import { ApiFairService } from '../api/fair/fair.service';
import { C2MService } from '../c2m/c2m.service';
import { MeetingService } from '../c2m/meeting/meeting.service';
import { MeetingRole, MeetingStatus, MeetingType } from '../c2m/meeting/meeting.type';
import { MeetingValidator } from '../c2m/meeting/meeting.validator';
import { NotificationTemplatesId, NotificationType } from '../c2m/notification/notification.type';
import { UnavailableTimeslotService } from '../c2m/unavailableTimeslot/unavailableTimeslot.service';
import { checkInputTimeIsPassCurrentTime } from '../c2m/utils';
import { BuyerService } from './buyer/buyer.service';
import { CBMService } from './cbm.service';
import { C2mConfigUnit } from './cbm.type';
import { CBMMeetingService } from './cbmMeeting/cbmMeeting.service';
import { ContentService } from './content/content.service';
import { ExhibitorService } from './exhibitor/exhibitor.service';
import { FairService } from './fair/fair.service';

@Controller(['cbm', 'admin/v1/cbm'])
export class CBMController {
  private meetingTypeMapping: Record<string, MeetingType> = {
    ONLINE: MeetingType.ONLINE,
    F2F: MeetingType.F2F,
  };

  constructor(
    private meetingService: MeetingService,
    private unavailableTimeslotService: UnavailableTimeslotService,
    private apiFairService: ApiFairService,
    private contentMeetingService: CBMMeetingService,
    private buyerService: BuyerService,
    private exhibitorService: ExhibitorService,
    private fairService: FairService,
    private contentService: ContentService,
    private c2mService: C2MService,
    private cbmService: CBMService,
    private logger: Logger
  ) {}

  @Get('healthcheck')
  public healthcheck(@Body() body: CBMPermission): any {
    return {
      data: 'Running',
      permission: body.permission,
    };
  }

  @Post('getVodStatus')
  public async getVodStatus(@Body() body: any): Promise<any> {
    const { seminarId } = body;
    return this.c2mService.getVodStatus(seminarId);
  }

  @Post('getRtmpStatus')
  public async getRtmpStatus(@Body() body: any): Promise<any> {
    const { seminarId } = body;
    return this.c2mService.getRtmpStatus(seminarId);
  }

  @Get('pavilion')
  public async getPavilion(@Body() body: CBMPermission): Promise<any> {
    const data = await this.exhibitorService.getPavilion();
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getPavilion - pavilion', step: '1', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: data.map((row: any) => ({
        code: row.code,
        value: row.value,
      })),
    };
  }

  @Get('countryCode')
  public async getCountryCode(@Body() body: CBMPermission): Promise<any> {
    const data = await this.contentService.getCountryCode();
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getCountryCode - countryCode', step: '1', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Get('branchOfficeCode')
  public async getBranchOffice(@Body() body: CBMPermission): Promise<any> {
    const data = await this.contentService.getBranchOfficeCode();
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getBranchOffice - branchOfficeCode', step: '1', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Get('targetMarketCode')
  public async getTargetMarketCode(@Body() body: CBMPermission): Promise<any> {
    const data = await this.contentService.getTargetMarketCode();
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getTargetMarketCode - targetMarketCode', step: '1', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Get('nobCode')
  public async getNobCode(@Body() body: CBMPermission): Promise<any> {
    const data = await this.contentService.getNobCode();
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getNobCode - nobCode', step: '1', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Get('adminRole')
  @UseInterceptors(AdminJwtInterceptor)
  public getFairAccessList(@AdminUserDecorator() currentUser: AdminUserDto): Record<string, any> {
    if (!currentUser) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.WRONG_USER_TOKEN,
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: {
        ...currentUser,
      },
    };
  }

  @Get('adminRoleType')
  @UseInterceptors(AdminJwtInterceptor)
  public async getAdminRole(@AdminUserDecorator() currentUser: AdminUserDto): Promise<Record<string, any>> {
    if (!currentUser) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.WRONG_USER_TOKEN,
      };
    }
    const adminRoleDetailArr = await this.contentService.getRoleId(currentUser.emailAddress);
    if (!adminRoleDetailArr.length) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.USER_ROLE_NOT_FOUND,
      };
    }
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: {
        roleId: adminRoleDetailArr[0].roleId,
        roleName: adminRoleDetailArr[0].roleName,
      },
    };
  }

  @Get('getLatestUserPermission')
  @UseInterceptors(AdminJwtInterceptor)
  public async getLatestUserPermission(@AdminUserDecorator() currentUser: AdminUserDto): Promise<any> {
    const permissionObj = await this.contentService.getLatestUserPermission(currentUser.emailAddress);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      permissions: permissionObj.permissions,
    };
  }

  @Get('getFiscalYearListFromFairRegistration')
  public async getFiscalYearListFromFairRegistration(): Promise<any> {
    const res = await this.contentService.getFiscalYearListFromFairRegistration();
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: res,
    };
  }

  @Get('getAdminUserList')
  @UseInterceptors(AdminJwtInterceptor)
  public async getAdminUserList(): Promise<any> {
    return this.contentService.getAdminUserList();
  }

  @Get('getCouncilBranchOfficeList')
  @UseInterceptors(AdminJwtInterceptor)
  public async getCouncilBranchOfficeList(
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const res = await this.contentService.getCouncilBranchOfficeList(currentUser.branchOfficeUser, currentUser.branchOffice);
    if (res.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: res.status,
        data: res.message
      };
    }
    return {
      status: res.status,
      data: res.data.branchOfficeList
    };
  }

  @Get('getAgentSrc/fairs/:fairCode')
  public async getAgentSrc(
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string
    ): Promise<any> {
      // not apply fairYear logic, just follow what provided from wordpress
      const eoaFairIdJson = await this.apiFairService.getFairSetting(fairCode);
      const { eoa_fair_id: eoaFairId } = eoaFairIdJson?.data?.data;
    const res = await this.exhibitorService.getAgentSrc(eoaFairId);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: res ?? [],
      eoaFairId
    };
  }

  // this is a shortCut to insert c2mConfig
  @Post('addConfig')
  public async addConfig():Promise<any> {
    const res = await this.contentService.addConfig();
    return res;
  }

  @Get('fairs/:fairCode/combinedUnavailableTimeslots')
  public async getCombinedUnavailableTimeslots(
    @Param('fairCode') fairCode: string,
    @Query() q: GetCombinedUnavailableTimeslotsDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any>> {
    const { responderSsoUid, requesterSsoUid } = q;

    // Get combined faircode and year array
    const { status, message, fairCodes, fiscalYears } = await this.apiFairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'cbm/fairs/:fairCode/combinedUnavailableTimeslots - getCombinedFairCodes', step: 'error', ${JSON.stringify({
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

    // Get unavailableTimeslots by requester or responder set in profile
    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [requesterSsoUid, responderSsoUid],
      fairCodes!,
      fiscalYears!,
      {}
    );
    // Format entity into timeslot array
    const unavailableTimeslotDtos: TimeslotDto[] = unavailableTimeslots.map((unavailableTimeslot: UnavailableTimeslot) => ({
      startTime: unavailableTimeslot.startTime,
      endTime: unavailableTimeslot.endTime,
    }));

    // Get confirmed meetings of requester and responder
    const collidedMeetings = await this.meetingService.findCollided(requesterSsoUid, responderSsoUid, requesterSsoUid, fairCodes!, fiscalYears!, false);

    collidedMeetings.forEach((meeting: Meeting) => {
      unavailableTimeslotDtos.push({ startTime: meeting.startTime, endTime: meeting.endTime });
    });

    const data = TimeslotHelper.groupTimeslotsByDate(unavailableTimeslotDtos, tz);
    this.logger.log(
      JSON.stringify({
        section: 'CBM',
        action: 'getCombinedUnavailableTimeslots - fairs/:fairCode/combinedUnavailableTimeslots',
        step: '1',
        detail: {
          input: q,
          fairCodes,
          fiscalYears,
          unavailableTimeslotDtos,
          collidedMeetings,
          output: data,
        },
      })
    );
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  @Get('fairs/:fairCode/pendingTimeslots')
  public async getPendingTimeslots(
    @Param('fairCode') fairCode: string,
    @Query() q: GetCombinedUnavailableTimeslotsDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any>> {
    const { requesterSsoUid, responderSsoUid } = q;
    const timeslotDtos: TimeslotDto[] = [];

    // Support combined fair logic
    const { status, message, fairCodes, fiscalYears } = await this.apiFairService.getCombinedFairCodes(fairCode);

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

    const commonFilter = { status: MeetingStatus.PENDING, fiscalYear: In(fiscalYears!), fairCode: In(fairCodes!) };

    // Either requester or responder exist one of ssouid
    const pendingFilter = [
      { ...commonFilter, requesterSsoUid: In([requesterSsoUid, responderSsoUid]) },
      { ...commonFilter, responderSsoUid: In([requesterSsoUid, responderSsoUid]) },
    ];

    const meetings = await this.meetingService.findByParams({ where: pendingFilter });
    meetings.forEach((meeting: Meeting) => {
      timeslotDtos.push({ startTime: meeting.startTime, endTime: meeting.endTime });
    });
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getPendingTimeslots - fairs/:fairCode/pendingTimeslots', step: '1', detail: meetings }));

    const data = TimeslotHelper.groupTimeslotsByDate(timeslotDtos, tz);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'getPendingTimeslots - fairs/:fairCode/pendingTimeslots', step: '2', detail: data }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data,
    };
  }

  // @Get('fairs/:fairCode/:fairYear/timeslot')
  // public async getNearestMeeting(
  //   @Param('fairCode') fairCode: string,
  //   @Query() query: GetNearestTimeslotDto,
  //   @Headers('X-USER-TZ') tz: string = 'UTC'
  // ): Promise<Record<string, any> | null> {
  //   return this.meetingService.getNearestMeeting(fairCode, );
  // }

  @Get('fairs/:fairCode/:fairYear/timeslot')
  public async getNearestTimeslotWithMeeting(
    @Param('fairCode') fairCode: string,
    @Query() query: GetNearestTimeslotDto,
    @Headers('X-USER-TZ') tz: string = 'UTC'
  ): Promise<Record<string, any> | null> {
    let meetingType = null;
    if (query.meetingType) {
      meetingType = this.meetingTypeMapping[query.meetingType];
    }
    let timeslot = await this.meetingService.getNearestTimeslotWithMeeting(fairCode, moment().utc().toDate(), meetingType);
    if (timeslot) {
      timeslot.start = moment(timeslot.start).tz(tz);
      timeslot.end = moment(timeslot.end).tz(tz);
    }
    this.logger.log(
      JSON.stringify({ section: 'CBM', action: 'getNearestTimeslotWithMeeting - fairs/:fairCode/:fairYear/timeslot', step: '1', detail: timeslot })
    );
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: timeslot,
    };
  }

  @Post('fairs/:fairCode/count')
  public async countAcceptedMeetingByIds(@Body() body: Record<string, any>): Promise<Record<string, any>> {
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: await this.meetingService.countAcceptedMeetingByIds(body.data.ids),
    };
  }

  @Get('fairs/:fairCode/meeting/:meetingId')
  @UseInterceptors(AdminJwtInterceptor)
  public async findSingleMeeting(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('fairCode') fairCode: string,
    @Param('meetingId') meetingId: string
  ): Promise<any> {
  return this.meetingService.findOneByMeetingId(meetingId, fairCode);
  }

  @Post('fairs/:fairCode/:fairYear/buyers')
  @UseInterceptors(AdminJwtInterceptor)
  public async findBuyer(
    @Headers('X-USER-TZ') tz: string = 'UTC',
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Body() body: CBMPaginateBuyerDto,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const filterOption = {
      ...body.data?.filterOption,
    };

    const sortingOption = {
      ...body.data?.sortingOption,
    };

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (
      !this.contentService.checkPermission(
        [PermissionRefEnum.VIEW_CBM_SUMMARY_MANAGEMENT, PermissionRefEnum.SCHEDULE_MEETING_AT_BM_LIST_MANAGEMENT],
        latestUserPermission.permissions,
        true
      )
    ) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    const result = await this.buyerService.filterBuyer(fairCode, fairYear, tz, filterOption, sortingOption);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'findBuyer - fairs/:fairCode/:fairYear/buyers', step: '1', detail: result }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result,
    };
  }

  @Post('fairs/:fairCode/:fairYear/buyersV2')
  @UseInterceptors(AdminJwtInterceptor)
  public async findBuyerV2(
    @Headers('X-USER-TZ') tz: string = 'UTC',
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Body() body: CBMPaginateBuyerDto,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const filterOption = {
      ...body.data?.filterOption,
    };

    const sortingOption = {
      ...body.data?.sortingOption,
    };

    const paginateOption = {
      ...body.data?.paginateOption,
    };

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);
    if (
      !this.contentService.checkPermission(
        [PermissionRefEnum.VIEW_CBM_SUMMARY_MANAGEMENT],
        latestUserPermission.permissions,
        true
      )
    ) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    if (currentUser.branchOfficeUser) {
      filterOption.branchOffice = currentUser.branchOffice;
    }

    const result = await this.buyerService.filterBuyerWithPagination(fairCode, fairYear, tz, filterOption, sortingOption, paginateOption);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'findBuyer - fairs/:fairCode/:fairYear/buyers', step: '1', detail: result }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result,
    };
  }

  @Post('fairs/:fairCode/:fairYear/exhibitors')
  @UseInterceptors(AdminJwtInterceptor)
  public async findExhibitor(
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Body() body: CBMPaginateExhibitorDto,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const filterOption = {
      ...body.data?.filterOption,
    };

    // const sortingOption = {
    //   ...body.data?.sortingOption,
    // };

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (
      !this.contentService.checkPermission(
        [PermissionRefEnum.VIEW_CBM_SUMMARY_MANAGEMENT, PermissionRefEnum.SCHEDULE_MEETING_AT_BM_LIST_MANAGEMENT],
        latestUserPermission.permissions,
        true
      )
    ) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    const result = await this.exhibitorService.filterExhibitor(fairCode, fairYear, filterOption, undefined);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'findExhibitor - fairs/:fairCode/:fairYear/exhibitors', step: '1', detail: result }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result,
    };
  }

  @Post('fairs/:fairCode/exhibitorsV2')
  @UseInterceptors(AdminJwtInterceptor)
  public async findExhibitorV2(
    @Param('fairCode') fairCode: string,
    @Body() body: CBMPaginateExhibitorDto,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const filterOption = {
      ...body.data?.filterOption,
    };

    const sortingOption = {
      ...body.data?.sortingOption,
    };

    const paginateOption = {
      ...body.data?.paginateOption,
    };

    const buyerProfile = {
      ...body.data?.buyerProfile,
    };

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (
      !this.contentService.checkPermission(
        [PermissionRefEnum.VIEW_CBM_SUMMARY_MANAGEMENT, PermissionRefEnum.SCHEDULE_MEETING_AT_BM_LIST_MANAGEMENT],
        latestUserPermission.permissions,
        true
      )
    ) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    const result = await this.exhibitorService.filterExhibitorWithPagination(fairCode, filterOption, sortingOption, paginateOption, buyerProfile);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'findExhibitor - fairs/:fairCode/:fairYear/exhibitors', step: '1', detail: result }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result,
    };
  }

  @Post('fairs/:fairCode/:fairYear/meetings')
  @UseInterceptors(AdminJwtInterceptor)
  public async findMeeting(
    @Headers('X-USER-TZ') tz: string = 'UTC',
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Body() body: CBMPaginateMeetingDto,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    const { filterOption, sortOption, paginateOption, searchOption } = {
      ...body.data,
    };

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (!this.contentService.checkPermission([PermissionRefEnum.VIEW_MEETING_MANAGEMENT], latestUserPermission.permissions, true)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    if (currentUser.branchOfficeUser) {
      filterOption.buyerBranchOffice = [currentUser.branchOffice];
    }

    const result = await this.contentMeetingService.filterMeeting(fairCode, fairYear, tz, filterOption, sortOption, searchOption, paginateOption);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'findMeeting - fairs/:fairCode/:fairYear/meetings', step: '1', detail: result }));
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result,
    };
  }

  // cbm - Auto Refresh meeting
  @Post('fairs/:fairCode/:fairYear/autoRefreshMeetings')
  @UseInterceptors(AdminJwtInterceptor)
  public async autoRefreshMeetings(
    @Headers('X-USER-TZ') tz: string = 'UTC',
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Body() body: CBMAutoRefreshMeetingsDtoData,
    @AdminUserDecorator() currentUser: AdminUserDto
  ): Promise<any> {
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'autoRefreshfilterMeeting - fairs/:fairCode/:fairYear/autoRefreshMeetings', step: '0', detail: { fairCode, fairYear, body } }));

    // use meetingId only to get updated data
    const { meetingIds } = body;

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (!this.contentService.checkPermission([PermissionRefEnum.VIEW_MEETING_MANAGEMENT], latestUserPermission.permissions, true)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    const result = await this.contentMeetingService.autoRefreshfilterMeeting(tz, meetingIds);

    this.logger.log(JSON.stringify({ section: 'CBM', action: 'autoRefreshfilterMeeting - fairs/:fairCode/:fairYear/autoRefreshMeetings', step: '1', detail: result }));

    if (result.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: result?.message
      };
    }

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: result.data,
    };
  }

  // Todo: assigner doesn't have  ssoUid
  @Post('fairs/:fairCode/meetings/create')
  @HttpCode(201)
  @UseInterceptors(AdminJwtInterceptor)
  public async createMeeting(
    @Param('fairCode') fairCode: string,
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Body() body: CBMCreatingMeetingDto
  ): Promise<any> {
    const { startTime, endTime, requesterSsoUid: requesterId, responderSsoUid: responderId, type, responderRole, f2fLocation, isSkipSeminarChecking } = body.data;
    const adminIdArr = await this.contentService.getAdminId(currentUser.emailAddress);

    if (!currentUser.fairAccessList.split(',').includes(fairCode)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.NO_ACCESS_RIGHT_FAIRCODE,
      };
    }

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (
      !this.contentService.checkPermission(
        [PermissionRefEnum.VIEW_CBM_SUMMARY_MANAGEMENT, PermissionRefEnum.SCHEDULE_MEETING_AT_BM_LIST_MANAGEMENT],
        latestUserPermission.permissions,
        true
      )
    ) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (!adminIdArr.length) {
      this.logger.log("route: 'createMeeting - fairs/:fairCode/meetings/create - getAdminID', step: 'error', adminID not found");
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.ADMIN_NOT_FOUND,
      };
    }

    const assignerId = adminIdArr[0].adminId;
    const assignerRole = MeetingRole.ADMIN;
    // const { nameID: assignerId } = body?.adminProfile;

    // new validation from c2m updates
    if (!startTime || !endTime) {
      const message = constant.MEETING.ERROR_MESSAGE.MISSING_TIMESLOT;
      this.logger.log(`route: 'createMeeting - cbm/fairs/:fairCode/meetings - basic validation', step: 'error', ${message}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    if (type === 1 && !f2fLocation) {
      const message = constant.MEETING.ERROR_MESSAGE.MISSING_BOOTH_NUMBER;
      this.logger.log(`route: 'createMeeting - cbm/fairs/:fairCode/meetings - basic validation', step: 'error', ${message}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    if (!checkInputTimeIsPassCurrentTime(startTime)) {
      this.logger.log(
        `route: 'createMeeting - cbm/fairs/:fairCode/meetings - checkInputTimeIsPassCurrentTime', step: 'error', ${constant.MEETING.ERROR_MESSAGE.STARTTIME_OVER_CURRENT_TIME}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.STARTTIME_OVER_CURRENT_TIME,
      };
    }

    // Prepare submission data
    const startMoment = moment(startTime);
    const endMoment = moment(endTime);
    const startDate = startMoment.toDate();
    const endDate = endMoment.toDate();

    const { status, message, fairCodes, fiscalYears } = await this.apiFairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'createMeeting - cbm/fairs/:fairCode/meetings - getCombinedFairCodes', step: 'error', ${JSON.stringify({
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

    this.logger.log(
      JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '1', detail: { fairCodes, fiscalYears } })
    );

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
        message: constant.MEETING.ERROR_MESSAGE.SYSTEM_ERROR,
      };
    }

    const fairDatesData = await this.apiFairService.getFairDates(fairCode);

    if (fairDatesData?.status === constant.GENERAL_STATUS.FAIL || (!fairDatesData?.data?.online?.length && !fairDatesData?.data?.physical?.length)) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - getFairDates', step: 'error', ${JSON.stringify({ fairDatesData })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.SYSTEM_ERROR,
      };
    }

    this.logger.log(JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '2', detail: fairDatesData }));

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

    let fairDates: any[] = [];

    // Validation - fairDates

    // Set fairDate depends on meeting type
    if (type === MeetingType.ONLINE) {
      fairDates = fairDatesData.data.online;
    } else {
      fairDates = fairDatesData.data.physical;
    }

    const matchedFairDate = fairDates.find(({ start, end }: { start: string; end: string }) => {
      const fairStartTime = moment(start);
      const fairEndTime = moment(end);

      return startMoment.isBetween(fairStartTime, fairEndTime, undefined, '[]') && endMoment.isBetween(fairStartTime, fairEndTime, undefined, '[]');
    });

    if (!matchedFairDate) {
      this.logger.log(
        JSON.stringify({
          section: 'CBM',
          action: 'createMeeting - fairs/:fairCode/meetings/create',
          step: '2.1',
          detail: 'Meeting start time or end time is out of fair period.',
        })
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.OUT_OF_FAIR_PERIOD,
      };
    }

    // Validation - unavailableTimeslots set by uesr's profile
    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [requesterId, responderId],
      fairCodes!,
      fiscalYears!,
      {}
    );
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '3', detail: unavailableTimeslots }));

    // Validation - confirmed meetings
    const collidedMeetings = await this.meetingService.findCollided(requesterId, responderId, requesterId, fairCodes!, fiscalYears!, false, startDate, endDate);
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '4', detail: collidedMeetings }));

    // validate availability on requester and responder
    const validationResult = MeetingValidator.validateCreateMeeting(requesterId, responderId, startDate, endDate, collidedMeetings, unavailableTimeslots);

    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - validateCreateMeeting', step: 'error', ${JSON.stringify({ validationResult })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    if (!isSkipSeminarChecking) {
      const registeredSeminar = await this.apiFairService.countRegisteredSeminarsByUserAndTimeRange(requesterId, requesterId, responderId, fairCode, moment(startTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'), moment(endTime).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm:ss'));

      if (registeredSeminar?.data?.status === constant.GENERAL_STATUS.FAIL) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.FAIL_TO_GET_REGISTERED_SEMINAR,
        };
      }

      if (registeredSeminar?.data?.count > 0) {
        return {
          status: 422,
          message: constant.MEETING.ERROR_MESSAGE.COLLIDED_SEMINAR,
        };
      }
    }

    // create a new meeting
    const getFairSettingResponse = await this.apiFairService.getFairSetting(fairCode);

    if (getFairSettingResponse.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - fairs/:fairCode/meetings - getFairSetting', step: 'error', ${JSON.stringify({ getFairSettingResponse })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: getFairSettingResponse?.message,
      };
    }

    const {
      status: cbmCreateMeetingStatus,
      message: cbmCreateMeetingErrorMessage,
      result: assignedMeeting,
    } = await this.meetingService.createMeeting(assignerId, assignerRole, {
      ...body.data,
      fairCode,
      fiscalYear: getFairSettingResponse?.data?.data?.fiscal_year,
    });

    // data.status === 0 -> success
    if (cbmCreateMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'createMeeting - cbm/fairs/:fairCode/meetings - createMeeting', step: 'error', ${JSON.stringify({ assignedMeeting })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: cbmCreateMeetingErrorMessage,
      };
    }

    // cancel pending meeting only create meeting successfully
    const { result: releasedPendingMeetings } = await this.meetingService.releasePendingMeeting(
      [requesterId, responderId],
      fairCodes!,
      startDate,
      endDate,
      assignerId
    );
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '5', detail: releasedPendingMeetings }));

    // Email Logic
    // Ricky - New BM Meeting for pending + no pending
    // Check whether requester or responder exist in pendingUserArray
    const pendingUserArray = (<Meeting[]>releasedPendingMeetings).flatMap((meeting: Meeting) => [meeting.requesterSsoUid, meeting.responderSsoUid]);

    const isRequesterReleasedPending: boolean = pendingUserArray.includes(requesterId);
    const isResponderReleasedPending: boolean = pendingUserArray.includes(responderId);

    const { templateResponderId, templateRequesterId } = this.determineTemplateId(isRequesterReleasedPending, isResponderReleasedPending, responderRole);

    await this.c2mService.handleNotification({
      templateId: templateResponderId,
      notificationType: NotificationType.BM_CREATE_MEETING,
      // @ts-ignore
      meetingData: assignedMeeting,
      fairCode,
      isRequester: false,
      skipWebNotifiction: false,
    });

    await this.c2mService.handleNotification({
      templateId: templateRequesterId,
      notificationType: NotificationType.BM_CREATE_MEETING,
      // @ts-ignore
      meetingData: assignedMeeting,
      fairCode,
      isRequester: true,
      skipWebNotifiction: false,
    });

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: assignedMeeting,
    };
  }

  @Put('fairs/:fairCode/meetings/:id/cancel')
  @UseInterceptors(AdminJwtInterceptor)
  public async cancelMeeting(
    @Param('fairCode') fairCode: string,
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('id') meetingId: string,
    @Body() body: Record<string, any>
  ): Promise<any> {
    const { status: statusOfFindId, message: messageOfFindId, result: meeting } = await this.meetingService.findByMeetingId(meetingId);

    const latestUserPermission = await this.contentService.getLatestUserPermission(currentUser.emailAddress);

    if (!this.contentService.checkPermission([PermissionRefEnum.CANCEL_MEETING_AT_MEETING_MANAGEMENT], latestUserPermission.permissions, true)) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'no permission',
      };
    }

    if (statusOfFindId === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'updateMeeting - cbm/fairs/:fairCode/meetings/:id - findByMeetingId', step: 'error', ${JSON.stringify({
          statusOfFindId,
          messageOfFindId,
          result: meeting,
        })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        messageOfFindId,
      };
    }

    const { status, message, fairCodes, fiscalYears } = await this.apiFairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(
        `route: 'fairs/:fairCode/unavailableTimeslots - getCombinedFairCodes', step: 'error', ${JSON.stringify({ status, message, fairCodes, fiscalYears })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    // Todo: validate whether meeting start already
    const adminIdArr = await this.contentService.getAdminId(currentUser.emailAddress);

    if (!adminIdArr.length) {
      this.logger.log("route: 'updateMeeting - fairs/:fairCode/meetings/:id - getAdminID', step: 'error', adminID not found");
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'adminID not found',
      };
    }

    const data = await this.meetingService.cancelMeeting(adminIdArr[0].adminId, <Meeting>meeting, {
      cancelledReason: body.cancelledReason || '',
      cancelledByRole: MeetingRole.ADMIN,
      tdcCancelBy: body.tdcCancelBy
    });
    if (data.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - cancelMeeting', step: 'error', ${JSON.stringify({ data })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: data.message,
      };
    }

    void this.meetingService.reverseReleasedMeeting((<Meeting>meeting).responderSsoUid, fairCodes!, (<Meeting>meeting).startTime, (<Meeting>meeting).endTime);
    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: data.result,
    };
  }

  // Update Meeting by meeting Id
  @Put('fairs/:fairCode/meetings/:id/reschedule')
  @UseInterceptors(AdminJwtInterceptor)
  public async reschedule(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('fairCode') fairCode: string,
    @Param('id') meetingId: string,
    @Body() updateMeetingDto: UpdateMeetingDto
  ): Promise<any> {
    const fields: Record<string, any> = {};

    const { status, message, result: meeting } = await this.meetingService.findByMeetingId(meetingId, fields);

    if (status === constant.GENERAL_STATUS.FAIL || !meeting) {
      this.logger.log(
        `route: 'CBMrescheduleMeeting - fairs/:fairCode/meetings/:id - findByMeetingId', step: 'error', ${JSON.stringify({ status, message, result: meeting })}`
      );
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    let response;
    let useractivity: any;

    const rescheduleField:Record<string, any> = updateMeetingDto.data;
    const adminIdArr = await this.contentService.getAdminId(currentUser.emailAddress);
    if (!adminIdArr.length) {
      this.logger.log("route: 'rescheduleMeeting - fairs/:fairCode/meetings/create - getAdminID', step: 'error', adminID not found");
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.ADMIN_NOT_FOUND,
      };
    }

    const { adminId } = adminIdArr[0];

    rescheduleField.adminDetail = currentUser;
    rescheduleField.adminDetail.adminId = adminId;

    response = await this.rescheduleMeeting(fairCode, meeting, rescheduleField);

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
      ssoUid: response.data.newMeeting.requesterSsoUid,
      role: response.data.newMeeting.requesterRole,
      firstName: response.data.newMeeting.requesterFirstName,
      lastName: response.data.newMeeting.requesterLastName,
      avatar: '',
      country: response.data.newMeeting.requesterCountryCode,
      companyName: response.data.newMeeting.requesterCompanyName || '',
      companyLogo: response.data.newMeeting.requesterCompanyLogo || '',
      supplierUrn: response.data.newMeeting.requesterSupplierUrn || '',
      exhibitorUrn: response.data.newMeeting.requsterExhibitorUrn || '',
      fairCode: response.data.newMeeting.fairCode || '',
      fiscalYear: response.data.newMeeting.fiscalYear || '',
    };

    // void this.c2mService.handleNotification({
    //   templateId: NotificationTemplatesId.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
    //   notificationType: NotificationType.RESCHEDULE_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
    //   meetingData: response.data.newMeeting,
    //   fairCode,
    //   isRequester: false,
    //   skipWebNotifiction: false,
    // });

    useractivity = {
      actionType: 'Reschedule C2M meeting',
      beforeUpdate: response.data.oldMeeting,
      afterUpdate: response.data.newMeeting,
    };

    this.logger.log(`route: 'updateMeeting - fairs/:fairCode/meetings/:id - end', step: '2', ${JSON.stringify({ response })}`);

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      data: response.data,
      'user-activity': useractivity,
    };
  }

  @Post('createConfigRecord')
  @UseInterceptors(AdminJwtInterceptor)
  public createConfigRecord(@AdminUserDecorator() currentUser: AdminUserDto, @Body() body: any): Record<string, any> {
    const { id, fieldName, unit, configValue } = body;
    const { name } = currentUser;
    return this.cbmService.createConfigRecord({ id, fieldName, unit, configValue, lastUpdatedBy: name });
  }

  @Post('getConfigValue')
  @UseInterceptors(AdminJwtInterceptor)
  public getConfigValue(@AdminUserDecorator() currentUser: AdminUserDto, @Body() body: any): Record<string, any> {
    const { page, count } = body;
    return this.cbmService.getConfigValue({ page, count });
  }

  @Post('updateConfigValue')
  @UseInterceptors(AdminJwtInterceptor)
  public async updateConfigValue(@AdminUserDecorator() currentUser: AdminUserDto, @Body() body: any): Promise<Record<string, any>> {
    const { name } = currentUser;
    const { id, configValue } = body;

    const idNumber = Number(id);
    const configInfoById = await this.c2mService.getConfigValueById({ id: idNumber });
    const unit = configInfoById?.data?.unit;

    if (unit === C2mConfigUnit.MINUTE || unit === C2mConfigUnit.DAY || unit === C2mConfigUnit.NUMBER || unit === C2mConfigUnit.SIZE) {
      // To check whether a string is equal or greater than 0
      const numberFormatValidate: boolean = /^[0-9]\d*$/.test(configValue);

      if (!numberFormatValidate) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: 'The format of configValue input is wrong. It should be greater than or equal to 0',
        };
      }
    }

    if (unit === C2mConfigUnit.TIME) {
      // To check whether a string matches a 24h format (range 00:00 → 23:59)
      const timeFormatValidate: boolean = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(configValue);

      if (!timeFormatValidate) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: 'The format of configValue input is wrong. It should be HH:MM',
        };
      }
    }

    return this.cbmService.updateConfigValue({ id, configValue, lastUpdatedBy: name });
  }

  @Get('getFairRegistrationId/:ssoUid')
  @UseInterceptors(AdminJwtInterceptor)
  public async getFairRegistrationIdBySsoUid(@Param('ssoUid') ssoUid: string): Promise<any> {
    return this.fairService.getFairRegistrationIdBySsoUid(ssoUid);
  }

  @Get('searchExhibitorOptionsList')
  public async getSearchExhibitorOptionsList(): Promise<any> {
    return this.exhibitorService.getSearchExhibitorOptionsList();
  }

  @Post('searchExhibitorPavilionListByFaircode')
  // @UseInterceptors(AdminJwtInterceptor)
  public async searchExhibitorPavilionListByFaircode(
    // @AdminUserDecorator() currentUser: AdminUserDto,
    @Body() body: any
  ): Promise<any> {
    const { fairCodeList } = body;
    return this.exhibitorService.searchExhibitorPavilionListByFaircode(fairCodeList);
  }

  // *****Meeting Configuration - Feedback Form - Start*****
  @Get('fairs/:fairCode/:fairYear/getFeedbackForm')
  public async getFeedbackFormIdByFair(
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string
  ): Promise<any> {
    return this.c2mService.getFeedbackFormIdByFair(fairCode, fairYear);
  }

  @Post('fairs/:fairCode/:fairYear/createFeedbackForm')
  @UseInterceptors(AdminJwtInterceptor)
  public async createFeedbackFormIdByFair(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('fairCode') fairCode: string, 
    @Param('fairYear') fairYear: string,
    @Body() body: any
  ): Promise<any> {
    const emailId = currentUser.emailAddress;
    const { feedbackFormId } = body;

    if (!feedbackFormId) { 
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'feedbackFormId is missing',
      };
    }
    
    return this.c2mService.createFeedbackFormIdByFair(fairCode, fairYear, feedbackFormId, emailId);
  }

  @Post('fairs/deleteFeedbackForm')
  @UseInterceptors(AdminJwtInterceptor)
  public async deleteFeedbackFormIdById(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Body() body: any
  ): Promise<any> {
    const emailId = currentUser.emailAddress;
    const { id } = body;

    if (!id) { 
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'id is missing',
      };
    }
    
    return this.c2mService.deleteFeedbackFormIdById(id, emailId);
  }

  // *****Meeting Configuration - Feedback Form - End*****


  // Simplified template id logic
  private determineTemplateId(
    isRequesterReleasedPending: boolean,
    isResponderReleasedPending: boolean,
    responderRole: MeetingRole
  ): Record<string, NotificationTemplatesId> {
    let templateResponderId;
    let templateRequesterId;
    if (responderRole === MeetingRole.BUYER) {
      templateResponderId = isResponderReleasedPending
        ? NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_BUYER
        : NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_BUYER;
      templateRequesterId = isRequesterReleasedPending
        ? NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR
        : NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR;
    } else {
      templateResponderId = isResponderReleasedPending
        ? NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR
        : NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR;
      templateRequesterId = isRequesterReleasedPending
        ? NotificationTemplatesId.BM_CREATE_MEETING_WITH_PENDING_MEETING_TO_BUYER
        : NotificationTemplatesId.BM_CREATE_MEETING_NO_PENDING_MEETING_TO_BUYER;
    }
    return {
      templateResponderId,
      templateRequesterId,
    };
  }

  private async rescheduleMeeting(fairCode: string, meeting: Meeting, fields: Record<string, any>): Promise<any> {
    const { startTime, endTime, adminDetail } = fields;
    console.log('adminDetail', adminDetail);

    let fairDates: any[] = [];
    const { requesterSsoUid, responderSsoUid } = meeting;

    const { status, message, fairCodes, fiscalYears } = await this.apiFairService.getCombinedFairCodes(fairCode);

    if (status === constant.GENERAL_STATUS.FAIL || !fairCodes || !fiscalYears) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message,
      };
    }

    this.logger.log(`route: 'CBMrescheduleMeeting - start', step: '1', ${JSON.stringify({ fairCodes, fiscalYears })}`);
    const fairDatesResult = await this.apiFairService.getFairDates(fairCode);

    if (!fairDatesResult?.data?.online?.length && !fairDatesResult?.data?.physical?.length) {
      this.logger.log(`route: 'CBMrescheduleMeeting - fairs/:fairCode/meetings - getFairDates', step: 'error', ${JSON.stringify({ fairDatesResult })}`);
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
      this.logger.log(`route: 'CBMrescheduleMeeting', step: '2', ${JSON.stringify({ fairDatesResult, matchedFairDate })}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.OUT_OF_FAIR_PERIOD,
      };
    }

    const unavailableTimeslots = await this.unavailableTimeslotService.findUnavailableTimeslotsByUsers(
      [requesterSsoUid, responderSsoUid],
      fairCodes,
      fiscalYears,
      {}
    );

    const collidedMeetings = await this.meetingService.findCollided(
      requesterSsoUid,
      responderSsoUid,
      requesterSsoUid,
      fairCodes,
      fiscalYears,
      false,
      moment(startTime).toDate(),
      moment(endTime).toDate()
    );

    const validationResult = MeetingValidator.validateRescheduleMeeting(
      requesterSsoUid,
      meeting,
      collidedMeetings.filter((m: Meeting) => m.id !== meeting.id),
      unavailableTimeslots,
      fields
    );

    this.logger.log(`route: 'CBMrescheduleMeeting', step: '3', ${JSON.stringify({ unavailableTimeslots, collidedMeetings, validationResult })}`);
    if (validationResult.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: validationResult.message,
      };
    }

    const rescheduleMeetingResult = await this.meetingService.rescheduleMeeting(requesterSsoUid, meeting, fields);

    this.logger.log(`route: 'CBMrescheduleMeeting', step: '4', ${JSON.stringify({ rescheduleMeetingResult })}`);
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
    } = await this.meetingService.reverseReleasedMeeting(meeting.responderSsoUid, fairCodes, meeting.startTime, meeting.endTime);

    this.logger.log(`route: 'rescheduleMeeting', step: '5', ${JSON.stringify({ result })}`);
    if (reverseReleasedMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: reverseReleasedMeetingErrorMessage,
      };
    }

    const adminIdArr = await this.contentService.getAdminId(fields.adminDetail.emailAddress);
    if (!adminIdArr.length) {
      this.logger.log("route: 'rescheduleMeeting - fairs/:fairCode/meetings/create - getAdminID', step: 'error', adminID not found");
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.ADMIN_PORTAL.ADMIN_NOT_FOUND,
      };
    }

    const assignerId = adminIdArr[0].adminId;

    // cancel pending meeting only create meeting successfully
    const { result: releasedPendingMeetings } = await this.meetingService.releasePendingMeeting(
      [requesterSsoUid, responderSsoUid],
      fairCodes,
      startTime,
      endTime,
      assignerId
    );
    this.logger.log(JSON.stringify({ section: 'CBM', action: 'createMeeting - fairs/:fairCode/meetings/create', step: '5', detail: releasedPendingMeetings }));
    if (!releasedPendingMeetings) {
      return {
        status: constant.GENERAL_STATUS.FAIL
      };
    }

    // Email Logic
    // Ricky - New BM Meeting for pending + no pending
    // Check whether requester or responder exist in pendingUserArray
    const pendingUserArray = (releasedPendingMeetings).flatMap((meeting: Meeting) => [meeting.requesterSsoUid, meeting.responderSsoUid]);

    const isRequesterReleasedPending: boolean = pendingUserArray.includes(requesterSsoUid);
    const isResponderReleasedPending: boolean = pendingUserArray.includes(responderSsoUid);

    // const responderRole = MeetingRole.EXHIBITOR;
    const responderRole = meeting?.responderRole;
    const { templateResponderId, templateRequesterId } = this.determineTemplateIdForBMReschedule(isRequesterReleasedPending, isResponderReleasedPending, responderRole);

    await this.c2mService.handleNotification({
      templateId: templateResponderId,
      notificationType: NotificationType.BM_RESCHEDULE_MEETING,
      // @ts-ignore
      meetingData: rescheduleMeetingResult.newMeeting,
      fairCode,
      isRequester: false,
      skipWebNotifiction: false
    });

    await this.c2mService.handleNotification({
      templateId: templateRequesterId,
      notificationType: NotificationType.BM_RESCHEDULE_MEETING,
      // @ts-ignore
      meetingData: rescheduleMeetingResult.newMeeting,
      fairCode,
      isRequester: true,
      skipWebNotifiction: false
    });

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

  private determineTemplateIdForBMReschedule(isRequesterReleasedPending: boolean, isResponderReleasedPending: boolean, responderRole: string): Record<string, NotificationTemplatesId> {
  let templateResponderId;
  let templateRequesterId;
  if (responderRole === MeetingRole.BUYER) {
    templateResponderId = isResponderReleasedPending ? NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER : NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER;
    templateRequesterId = isRequesterReleasedPending ? NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR : NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR;
  } else {
    templateResponderId = isResponderReleasedPending ? NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_EXHIBITOR : NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_EXHIBITOR;
    templateRequesterId = isRequesterReleasedPending ? NotificationTemplatesId.BM_RESCHEDULE_MEETING_WITH_PENDING_MEETING_TO_BUYER : NotificationTemplatesId.BM_RESCHEDULE_MEETING_NO_PENDING_MEETING_TO_BUYER;
  }
  return {
    templateResponderId,
    templateRequesterId
  };
}
}
