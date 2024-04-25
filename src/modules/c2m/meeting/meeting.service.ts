import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import moment from 'moment-timezone';
import { paginate, Pagination, PaginationTypeEnum } from 'nestjs-typeorm-paginate';
import { Repository, MoreThan, LessThan, LessThanOrEqual, MoreThanOrEqual, Raw, In, FindConditions, getManager, Brackets, getConnection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { constant } from '../../../config/constant';
import { Logger } from '../../../core/utils';
import { GetMeetingsDtoStatus } from '../../../dto/getMeetings.dto';
import { Meeting } from '../../../entities/meeting.entity';
import { RecommendationItem } from '../../../entities/recommendationItem.entity';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { C2MService } from '../c2m.service';
import { NotificationTemplatesId, NotificationType } from '../notification/notification.type';
import { EmailDeliveryStatus, JoinMeetingStatus, MeetingRole, MeetingStatus, MeetingType, ResponseStatus } from './meeting.type';

@Injectable()
export class MeetingService {
  constructor(
    @InjectRepository(Meeting)
    private meetingsRepository: Repository<Meeting>,
    @InjectRepository(RecommendationItem)
    private recommendationItemRepository: Repository<RecommendationItem>,
    private fairService: ApiFairService,
    private exhibitorService: ApiExhibitorService,
    private logger: Logger,
    private c2mService: C2MService
  ) {
  }

  // to-do - jack - update to bulk insert if have time.....
  public async updateMeetingLiveStatus(meetingIds: string[], liveStatus: number) {
    return Promise.all([
      meetingIds.map(async (meetingId: string) => this.meetingsRepository.update({ meetingId }, { liveStatus }))
    ]);
  }

  public async findMeetingById(meetingId: string): Promise<Meeting | undefined> {
    return this.meetingsRepository.findOne({
      meetingId
    });
  }

  public async getOnlineMeetingStatusById(meetingId: string): Promise<any> {
    try {
      const query = `
      SELECT companyRole, ssoUid, displayName, displayCompany, joinedAt, disconnectedAt, TIMEDIFF(disconnectedAt, joinedAt) as attendanceDuration, guestNum
      FROM vep_c2m_service_db.vepC2MVideoConference as vc
      LEFT JOIN (
        SELECT displayCompany as representComp, COUNT(displayCompany) as guestNum
        FROM vep_c2m_service_db.vepC2MVideoConference as countGuest
        WHERE meetingId = '${meetingId}' AND role = 'GUEST'
        GROUP BY displayCompany
      ) countGuest on countGuest.representComp = vc.displayCompany
      WHERE meetingId = '${meetingId}' AND role = 'HOST'
      GROUP BY ssoUid, role, companyRole
      `
      .split('\n')
      .join('')
      .replace(/ +/g, ' ');

      const connection = await getConnection('c2mDatabase');
      const slaveRunner = connection.createQueryRunner('slave');
      let onlineMeetingStatus: any;
      try {
        onlineMeetingStatus = await connection.query(query, undefined, slaveRunner);
      } catch (error) {
        console.log("Error in getOnlineMeetingStatusById api", error);
      } finally {
        slaveRunner.release();
      }

      return onlineMeetingStatus;
    } catch (err) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: err
      };
    }
  }

  public async findByParams(params: Record<string, any>): Promise<Meeting[]> {
    return this.meetingsRepository.find(params);
  }

  public async getNearestMeeting(fairCode: string, targetTime: Date, meetingType: MeetingType | undefined = undefined): Promise<any> {
    return this.meetingsRepository.findOne({
      where: {
        startTime: MoreThanOrEqual(targetTime),
        type: meetingType
      },
      order: {
        startTime: 'ASC'
      }
    });
  }

  public async getNearestTimeslotWithMeeting(fairCode: string, currentTime: Date, meetingType: MeetingType | null = null): Promise<Record<string, any> | null> {
    let queryWhereOption: Record<string, any> = {
      startTime: MoreThanOrEqual(currentTime),
    };

    if (meetingType) {
      queryWhereOption.type = meetingType;
    }

    const nearestMeeting = await this.meetingsRepository.findOne({
      where: queryWhereOption,
      order: {
        startTime: 'ASC',
      },
    });

    let result = null;

    if (nearestMeeting) {
      result = this.fairService.snapFairTimeslot(fairCode, moment(nearestMeeting.startTime).utc(), moment(nearestMeeting.endTime).utc(), meetingType);
    } else {
      result = this.fairService.snapFairTimeslot(fairCode, moment(currentTime).utc(), moment(currentTime).utc(), meetingType);
    }
    return result;
  }

  public async countAcceptedMeetingByIds(ids: string[]): Promise<Record<string, any>[]> {
    // to-do[uuid] - check if cbm need fit the UUID flow(unionMeeting.meetingId)
    const currentTime = moment().format();
    return getManager().query(
      `
      SELECT id, Count(id) as count
      FROM (
        SELECT requesterSsoUid as id, status, endTime
        FROM vepC2MMeeting AS meeting
        UNION ALL
        SELECT responderSsoUid as id, status, endTime
        FROM vepC2MMeeting AS meeting
      ) AS unionMeeting
      WHERE (
        (unionMeeting.status = ${MeetingStatus.ACCEPTED})
        AND
        (unionMeeting.id In (${ids})
        AND
        (endTime > '${currentTime}')
        )
      )
      GROUP BY id
    `
    );
  }

  public async paginateByConditions(
    ssoUidArr: string[],
    dtoStatus: GetMeetingsDtoStatus,
    fairCodes: string[],
    fiscalYears: string[],
    fields: Record<string, any>,
    page: number = 1,
    limit: number = 15,
    filteredDate: string[] | [],
    timezone: string | null
  ): Promise<Pagination<Meeting>> {
    fields.fairCode = In(fairCodes);
    fields.fiscalYear = In(fiscalYears);

    const where: string[] = this.getWhereConditions(ssoUidArr, dtoStatus, fields);

    // support multiple id
    const leftJoinCond = [
        // to-do[uuid] - check if cbm need fit the UUID flow('meeting.id != m2.id',)
      [
        '(m2.startTime <= meeting.startTime AND m2.endTime > meeting.startTime)',
        '(m2.startTime < meeting.endTime AND m2.endTime >= meeting.endTime)',
        '(m2.startTime >= meeting.startTime AND m2.endTime <= meeting.endTime)',
      ].join(' OR '),
      [`m2.requesterSsoUid IN (${this.toSQLArraySting(ssoUidArr)})`, `m2.responderSsoUid IN (${this.toSQLArraySting(ssoUidArr)})`].join(' OR '),
      'meeting.meetingId != m2.meetingId',
      `m2.status IN (${[MeetingStatus.PENDING, MeetingStatus.ACCEPTED].join(',')})`,
    ].map((condition: string) => `(${condition})`);

    const queryBuilder = this.meetingsRepository
      .createQueryBuilder('meeting')
      .leftJoinAndMapMany('meeting.collisionMeetings', Meeting, 'm2', leftJoinCond.join(' AND '))
      .where(new Brackets((qb) => {
        qb.where(where);
      }));

    if (filteredDate?.length && timezone?.length) {
      queryBuilder.andWhere(new Brackets((qb) => {
        filteredDate.forEach((date, index) => {
          const startOfDay = moment(date).tz(timezone).startOf('day').utc().format('YYYY-MM-DD HH:mm:ss');
          const endOfDay = moment(date).tz(timezone).endOf('day').utc().format('YYYY-MM-DD HH:mm:ss');

          if (index === 0) {
            qb.where(`meeting.startTime between '${startOfDay}' and '${endOfDay}'`);
          } else {
            qb.orWhere(`meeting.startTime between '${startOfDay}' and '${endOfDay}'`);
          }
        });
      }));
    }

    queryBuilder.orderBy({ 'meeting.startTime': `${dtoStatus === 'past' || dtoStatus === 'cancelled' ? 'DESC' : 'ASC'}` });
    return paginate<Meeting>(queryBuilder, { page, limit, paginationType: PaginationTypeEnum.TAKE_AND_SKIP });
  }

  public async findEndedMeetings(): Promise<Meeting[]> {
    return this.meetingsRepository.find({ endTime: LessThan(new Date()), status: MeetingStatus.ACCEPTED });
  }

  public async findUpcomingMeetings(): Promise<Meeting[]> {
    return this.meetingsRepository.find({ startTime: MoreThan(new Date()), status: MeetingStatus.ACCEPTED });
  }

  public async findNextMeetings(ssoUids: string[], startTime: Date): Promise<Meeting[]> {
    const where = [
      { requesterSsoUid: In(ssoUids), startTime, status: In([MeetingStatus.PENDING, MeetingStatus.ACCEPTED]) },
      { responderSsoUid: In(ssoUids), startTime, status: MeetingStatus.ACCEPTED },
    ];

    return this.meetingsRepository.find({ where });
  }

  public async findMeetingDatesByUserAndFairCode(ssoUidArr: string[], fairCodes: string[], fiscalYears: string[], dtoStatus: GetMeetingsDtoStatus): Promise<Date[]> {
    const where = this.getWhereConditions(ssoUidArr, dtoStatus, { fairCode: In(fairCodes), fiscalYear: In(fiscalYears) });

    const meetings = await this.meetingsRepository.createQueryBuilder('m').select(['m.startTime', 'm.endTime']).where(where).orderBy({ 'm.startTime': 'ASC' }).getMany();

    return meetings.map((m: Meeting) => m.startTime);
  }

  public async findByMeetingId(meetingId: string, fields: Record<string, any> = {}): Promise<{ status: number, message?: string, result?: Meeting }> {
    return this.meetingsRepository.findOne({
      ...fields,
      meetingId,
    })
    .then((result) => {
      if (!result) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.NO_MEETING_DATA_FOUND
        };
      }

      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    });
  }

  public async findOneBySsoUid(meetingId: string, ssoUid: string, fairCode: string, fields: Record<string, any> = {}): Promise<{ status: number, message?: string, result?: Meeting }> {
    const { fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);
    const where = [
      { ...fields, fairCode: In(fairCodes!), fiscalYear: In(fiscalYears!), meetingId, responderSsoUid: ssoUid },
      { ...fields, fairCode: In(fairCodes!), fiscalYear: In(fiscalYears!), meetingId, requesterSsoUid: ssoUid },
    ];
    return this.meetingsRepository.findOne({ where })
    .then((result) => {
      if (!result) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.NO_MEETING_DATA_FOUND
        };
      }

      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    });
  }

  public async findOneByMeetingId(meetingId: string, fairCode: string, fields: Record<string, any> = {}): Promise<{ status: number, message?: string, data?: Meeting }> {
    const { fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);
    if (!fairCodes || !fiscalYears) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: constant.MEETING.ERROR_MESSAGE.NO_FAIRCODE_OR_FISCALYEAR
      };
    }
    const where = [
      { ...fields, fairCode: In(fairCodes), fiscalYear: In(fiscalYears), meetingId },
      { ...fields, fairCode: In(fairCodes), fiscalYear: In(fiscalYears), meetingId },
    ];
    return this.meetingsRepository.findOne({ where })
    .then(async (data:any) => {
      if (!data) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.NO_MEETING_DATA_FOUND
        };
      }
      let ccdid: string;
      let exhibitorFairCode: string;
      if (data.requesterRole === 'EXHIBITOR') {
        ccdid = data.requesterSsoUid;
        exhibitorFairCode = data.fairCode;
      } else {
        ccdid = data.responderSsoUid;
        exhibitorFairCode = data.responderFairCode;
      }
      const exhibitorData = await this.exhibitorService.filterExhibitorByES({ fairCode: exhibitorFairCode, from: 0, size: 99, filterRecommendedCCDID: [ccdid] });
      if (exhibitorData?.data?.data?.hits?.length) {
        data.exhibitorType = exhibitorData.data.data.hits[0].exhibitorType;
      }
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        data
      };
    });
  }

  public async findUpcomingMeetingsBySsoUid(ssoUid: string, fairCode: string, fields: Record<string, any> = {}): Promise<any> {
    const { fairCodes, fiscalYears } = await this.fairService.getCombinedFairCodes(fairCode);
    const where = [
      { ...fields, fairCode: In(fairCodes!), fiscalYear: In(fiscalYears!), responderSsoUid: ssoUid },
      { ...fields, fairCode: In(fairCodes!), fiscalYear: In(fiscalYears!), requesterSsoUid: ssoUid },
    ];
    return this.meetingsRepository.find({ where })
    .then((result) => {
      if (!result) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: constant.MEETING.ERROR_MESSAGE.NO_MEETING_DATA_FOUND
        };
      }

      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    });
  }

  public async findCollided(
    selfSsoUid: string,
    otherSsoUid: string,
    self2ndSsoUid: string,
    fairCodes: string[],
    fiscalYears: string[],
    withSelfPending: boolean = false,
    start?: Date,
    end?: Date
  ): Promise<Meeting[]> {
    const startEndConditions: FindConditions<Meeting[]> = [];
    const fairCode = In(fairCodes);
    const fiscalYear = In(fiscalYears);

    // Add overlay time range condition if start and end provided
    if (start && end) {
      startEndConditions.push(
        { startTime: LessThanOrEqual(start), endTime: MoreThan(start) },
        { startTime: LessThan(end), endTime: MoreThanOrEqual(end) },
        { startTime: MoreThanOrEqual(start), endTime: LessThanOrEqual(end) }
      );
    }

    // Find accepted meetings by requester or responder
    const targetUsersArr = [selfSsoUid, otherSsoUid, self2ndSsoUid].filter((ssoUid:string) => ssoUid);
    const commonConditions: FindConditions<Meeting[]> = [
      { fairCode, fiscalYear, requesterSsoUid: In(targetUsersArr), status: MeetingStatus.ACCEPTED },
      { fairCode, fiscalYear, responderSsoUid: In(targetUsersArr), status: MeetingStatus.ACCEPTED },
    ];

    // Find pending meetings by requester if withSelfPending = true
    // in CBM flow, withSelfPending = false { because BM has right to overwrite pending meeting }
    // in C2M flow, withSelfPending = true, except accepting meeting { find confirmed meeting }
    if (withSelfPending) {
      commonConditions.push({ fairCode, fiscalYear, requesterSsoUid: selfSsoUid, status: MeetingStatus.PENDING });
      commonConditions.push({ fairCode, fiscalYear, requesterSsoUid: otherSsoUid, status: MeetingStatus.PENDING });
      self2ndSsoUid?.length && commonConditions.push({ fairCode, fiscalYear, requesterSsoUid: self2ndSsoUid, status: MeetingStatus.PENDING });
    }

    // Merge common conditions with start time + end time conditions
    // eslint-disable-next-line arrow-body-style
    const where: FindConditions<Meeting[]> = commonConditions.flatMap((commonCond: any) => {
      return startEndConditions.map((condition: any) => ({ ...commonCond, ...condition }));
    });

    this.logger.log(JSON.stringify({ section: 'meeting', action: 'findCollided', step: '1', detail: { condition: commonConditions } }));

    return this.meetingsRepository.find({
      where: where.length ? where : commonConditions,
    });
  }

  public async acceptMeeting(ssoUid: string, meeting: Meeting): Promise<{ status: number, message?: string, result?: Meeting }> {
    return this.meetingsRepository.save({
      ...meeting,
      status: MeetingStatus.ACCEPTED,
      responderResponseStatus: ResponseStatus.ACCEPTED,
      lastUpdatedBy: ssoUid,
      lastUpdatedAt: new Date(),
    })
    .then((result: Meeting) => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));
  }

  public async releasePendingMeeting(
    ssoUids: string[],
    fairCodes: string[],
    startTime: Date,
    endTime: Date,
    assignerId: string | null = null
  ): Promise<{ status: number, message?: string, result?: Meeting[] }> {
    const where = [
      { responderSsoUid: In(ssoUids), fairCode: In(fairCodes), startTime, endTime, status: MeetingStatus.PENDING },
      { requesterSsoUid: In(ssoUids), fairCode: In(fairCodes), startTime, endTime, status: MeetingStatus.PENDING },
    ];

    const releaseMeetings = await this.meetingsRepository.find({ where });

    let [lastUpdatedBy] = ssoUids;

    // replace it with assignerId if exist
    // release by admin
    lastUpdatedBy = assignerId || lastUpdatedBy;

    releaseMeetings.forEach((meeting: Meeting) => {
      meeting.status = MeetingStatus.RELEASED;
      meeting.lastUpdatedAt = new Date();
      meeting.lastUpdatedBy = lastUpdatedBy;
    });

    this.logger.log(JSON.stringify({ section: 'meeting', action: 'releasePendingMeeting', step: '1', detail: { releaseMeetings } }));
    return this.meetingsRepository.save(releaseMeetings)
    .then((result: Meeting[]) => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));
  }

  public async reverseReleasedMeeting(responderSsoUid: string, fairCodes: string[], startTime: Date, endTime: Date): Promise<{ status: number, message?: string, result?: Meeting[] }> {
    const reverseMeetings = await this.meetingsRepository.find({ responderSsoUid, fairCode: In(fairCodes), startTime, endTime, status: MeetingStatus.RELEASED });

    reverseMeetings.forEach((meeting: Meeting) => {
      meeting.status = MeetingStatus.PENDING;
      meeting.lastUpdatedAt = new Date();
      meeting.lastUpdatedBy = responderSsoUid;
    });

    this.logger.log(JSON.stringify({ section: 'meeting', action: 'reverseReleasedMeeting', step: '1', detail: { reverseMeetings } }));
    return this.meetingsRepository.save(reverseMeetings)
    .then((result: Meeting[]) => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error:any) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));
  }

  public async rejectMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): Promise<{ status: number, message?: string, result?: Meeting }> {
    let desiredReqResponseStatus: ResponseStatus = ResponseStatus.REJECTED;
    let desiredResResponseStatus: ResponseStatus = ResponseStatus.REJECTED;

    if (meeting.requesterSsoUid === ssoUid) {
      desiredReqResponseStatus = ResponseStatus.REQ_REJECT;
      desiredResResponseStatus = ResponseStatus.REJECTED;
    } else if (meeting.responderSsoUid === ssoUid) {
      desiredReqResponseStatus = ResponseStatus.REJECTED;
      desiredResResponseStatus = ResponseStatus.REQ_REJECT;
    }

    return this.meetingsRepository.save({
      ...meeting,
      ...fields,
      requesterResponseStatus: desiredReqResponseStatus,
      responderResponseStatus: desiredResResponseStatus,
      status: MeetingStatus.REJECTED,
      cancelledBy: ssoUid,
      lastUpdatedBy: ssoUid,
      lastUpdatedAt: new Date(),
    })
    .then((result: Meeting) => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async cancelMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): Promise<{ status: number, message?: string, result?: Meeting }> {
    // Ricky: for reference, swap requester, responder
    // Todo: swap requester
    // const isCallerRequester = meeting.requesterSsoUid === ssoUid;
    // const requesterRole = isCallerRequester ? meeting.requesterRole : meeting.responderRole;
    // const requesterSsoUid = isCallerRequester ? meeting.requesterSsoUid : meeting.responderSsoUid;
    // const requesterFirstName = isCallerRequester ? meeting.requesterFirstName : meeting.responderFirstName;
    // const requesterLastName = isCallerRequester ? meeting.requesterLastName : meeting.responderLastName;
    // const requesterCompanyName = isCallerRequester ? meeting.requesterCompanyName : meeting.responderCompanyName;
    // const responderFirstName = isCallerRequester ? meeting.responderFirstName : meeting.requesterFirstName;
    // const responderLastName = isCallerRequester ? meeting.responderLastName : meeting.requesterLastName;
    // const responderCompanyName = isCallerRequester ? meeting.responderCompanyName : meeting.requesterCompanyName;

    let desiredReqResponseStatus: ResponseStatus = ResponseStatus.CANCELLED;
    let desiredResResponseStatus: ResponseStatus = ResponseStatus.CANCELLED;

    if (fields.cancelledByRole === MeetingRole.ADMIN) {
      desiredReqResponseStatus = ResponseStatus.TDC_CANCEL;
      desiredResResponseStatus = ResponseStatus.TDC_CANCEL;
    } else if (fields.cancelledByRole === MeetingRole.SYSTEM) {
      desiredReqResponseStatus = ResponseStatus.SYS_CANCEL;
      desiredResResponseStatus = ResponseStatus.SYS_CANCEL;
    } else if (meeting.requesterSsoUid === ssoUid) {
      desiredReqResponseStatus = ResponseStatus.REQ_CANCEL;
      desiredResResponseStatus = ResponseStatus.CANCELLED;
    } else if (meeting.responderSsoUid === ssoUid) {
      desiredReqResponseStatus = ResponseStatus.CANCELLED;
      desiredResResponseStatus = ResponseStatus.REQ_CANCEL;
    }

    const { status: cancelMeetingStatus, message: cancellMeetingErrorMessage, result: cancelledMeeting } = await this.meetingsRepository.save({
      ...meeting,
      ...fields,
      status: MeetingStatus.CANCELLED,
      requesterResponseStatus: desiredReqResponseStatus,
      responderResponseStatus: desiredResResponseStatus,
      cancelledBy: ssoUid,
      lastUpdatedBy: ssoUid,
      lastUpdatedAt: new Date(),
      tdcCancelBy: fields?.tdcCancelBy ?? null//
    })
    .then((result: Meeting): { status: number, message?: string, result?: Meeting } => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error: any) : { status: number, message?: string, result?: Meeting } => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));

    if (cancelMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: cancellMeetingErrorMessage
      };
    }

    // Swap requester and responder info depends on trigger(user)
    if (cancelledMeeting!.cancelledByRole !== MeetingRole.ADMIN && cancelledMeeting!.assignerRole !== MeetingRole.ADMIN) {
      const isCallerRequesterPre = cancelledMeeting!.requesterSsoUid === ssoUid;
      cancelledMeeting!.requesterRole = isCallerRequesterPre ? meeting.requesterRole : meeting.responderRole;
      cancelledMeeting!.requesterSsoUid = isCallerRequesterPre ? meeting.requesterSsoUid : meeting.responderSsoUid;
      cancelledMeeting!.requesterFirstName = isCallerRequesterPre ? meeting.requesterFirstName : meeting.responderFirstName;
      cancelledMeeting!.requesterLastName = isCallerRequesterPre ? meeting.requesterLastName : meeting.responderLastName;
      cancelledMeeting!.requesterCompanyName = isCallerRequesterPre ? meeting.requesterCompanyName : meeting.responderCompanyName;
      cancelledMeeting!.fairCode = isCallerRequesterPre ? meeting.fairCode : meeting.responderFairCode;
      cancelledMeeting!.fiscalYear = isCallerRequesterPre ? meeting.fiscalYear : meeting.responderFiscalYear;

      cancelledMeeting!.responderSsoUid = isCallerRequesterPre ? meeting.responderSsoUid : meeting.requesterSsoUid;
      cancelledMeeting!.responderRole = isCallerRequesterPre ? meeting.responderRole : meeting.requesterRole;
      cancelledMeeting!.responderFirstName = isCallerRequesterPre ? meeting.responderFirstName : meeting.requesterFirstName;
      cancelledMeeting!.responderLastName = isCallerRequesterPre ? meeting.responderLastName : meeting.requesterLastName;
      cancelledMeeting!.responderCompanyName = isCallerRequesterPre ? meeting.responderCompanyName : meeting.requesterCompanyName;
      cancelledMeeting!.responderFairCode = isCallerRequesterPre ? meeting.responderFairCode : meeting.fairCode;
      cancelledMeeting!.responderFiscalYear = isCallerRequesterPre ? meeting.responderFiscalYear : meeting.fiscalYear;
    }

    const isCallerBuyer = meeting.requesterRole === MeetingRole.EXHIBITOR;
    const notiFairCode = isCallerBuyer ? meeting.responderFairCode : meeting.fairCode;

    // BM cancel C2M Meeting
    if (cancelledMeeting!.cancelledByRole === MeetingRole.ADMIN && cancelledMeeting!.assignerRole !== MeetingRole.ADMIN) {
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_REQUESTER,
        notificationType: NotificationType.CANCEL_C2M_MEETING_BY_BM,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: cancelledMeeting!.fairCode,
        isRequester: false,
        skipWebNotifiction: false
      });
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_C2M_MEETING_BY_BM_TO_RESPONDER,
        notificationType: NotificationType.CANCEL_C2M_MEETING_BY_BM,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: cancelledMeeting!.fairCode,
        isRequester: true,
        skipWebNotifiction: false
      });
      // BM cancel BM Meeting
    } else if (cancelledMeeting!.cancelledByRole === MeetingRole.ADMIN && cancelledMeeting!.assignerRole === MeetingRole.ADMIN) {
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_REQUESTER,
        notificationType: NotificationType.CANCEL_BM_MEETING_BY_BM,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: notiFairCode,
        isRequester: true,
        skipWebNotifiction: false
      });
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_BM_MEETING_BY_BM_TO_RESPONDER,
        notificationType: NotificationType.CANCEL_BM_MEETING_BY_BM,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: notiFairCode,
        isRequester: false,
        skipWebNotifiction: false
      });
      // User cancel BM Meeting
    } else if (cancelledMeeting!.cancelledByRole !== MeetingRole.ADMIN && cancelledMeeting!.assignerRole === MeetingRole.ADMIN) {
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
        notificationType: NotificationType.CANCEL_BM_MEETING_BY_BUYER_OR_EXHIBITOR,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: notiFairCode,
        isRequester: false,
        skipWebNotifiction: false
      });
      // User cancel C2M Meeting
    } else {
      await this.c2mService.handleNotification({
        templateId: NotificationTemplatesId.CANCEL_MEETING,
        notificationType: NotificationType.CANCEL_MEETING,
        meetingData: <Meeting>cancelledMeeting,
        fairCode: cancelledMeeting!.fairCode,
        isRequester: false,
        skipWebNotifiction: false
      });
    }

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      result: cancelledMeeting
    };
  }

  public async updateMeetingsToAutoCancelled(meetings: Meeting[], cancelledReason?: string): Promise<Meeting[]> {
    meetings.forEach((meeting: Meeting) => {
      meeting.status = MeetingStatus.AUTO_CANCELLED;
      meeting.cancelledBy = meeting.createdBy;
      meeting.lastUpdatedBy = meeting.createdBy;
      meeting.cancelledByRole = MeetingRole.SYSTEM;
      meeting.lastUpdatedAt = new Date();
      // removed as new logic in R3 - R009 - vt18565
      // meeting.requesterResponseStatus = ResponseStatus.SYS_CANCEL;
      meeting.responderResponseStatus = ResponseStatus.SYS_CANCEL;

      if (cancelledReason) {
        meeting.cancelledReason = cancelledReason;
      }
    });

    // Todo - add auto cancelled meeting
    return this.meetingsRepository.save(meetings);
  }

  public async updateZoomInfo(meeting: Meeting, id: Nullable<string>, startUrl: Nullable<string>, joinUrl: Nullable<string>): Promise<Meeting> {
    meeting.zoomId = id;
    meeting.zoomStartUrl = startUrl;
    meeting.zoomJoinUrl = joinUrl;

    this.logger.log(JSON.stringify({ section: 'meeting', action: 'updateZoomInfo', step: '1', detail: { meeting } }));
    return this.meetingsRepository.save(meeting);
  }

  public async extendMeeting(meetingId: string, durationInMinutes: number): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findOneOrFail({ where: { meetingId } });
    meeting.endTime = moment(meeting.endTime).add(durationInMinutes, 'm').toDate();
    meeting.isExtended = true;
    return this.meetingsRepository.save(meeting);
  }

  public async refuseExtendMeeting(meetingId: string): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findOneOrFail({ where: { meetingId } });
    meeting.isRefusedExtend = true;
    return this.meetingsRepository.save(meeting);
  }

  public async generateUniqueMeetingId(): Promise<any> {
    const newMeetingId = uuidv4();
    const meetingData = await this.meetingsRepository.find({ meetingId: newMeetingId });
    if (meetingData.length > 0) {
      await this.generateUniqueMeetingId();
    } else {
      return newMeetingId;
    }
  }

  public async createMeeting(assignerId: string, assignerRole: string, fields: Record<string, any>): Promise<{ status: number, message?: string, result?: Meeting }> {
    this.logger.log(`{route: createMeeting, step: 1, detail: ${JSON.stringify({ assignerId, assignerRole, fields })}}`);
    const meetingId = await this.generateUniqueMeetingId();
    const startTime = moment(fields.startTime).toDate();
    const endTime = moment(fields.endTime).toDate();

    const tempUserDetail = { ssoUid: '',
                  buyerFairCode: '',
                  buyerFiscalYear: '',
                  ccdId: '',
                  exhibitorFairCode: ''
                };

    if (fields.requesterRole.toLowerCase() === 'buyer') {
      tempUserDetail.ssoUid = fields.requesterSsoUid;
      tempUserDetail.buyerFairCode = fields.fairCode;
      tempUserDetail.buyerFiscalYear = fields.fiscalYear;
      tempUserDetail.ccdId = fields.responderSsoUid;
      tempUserDetail.exhibitorFairCode = fields.responderFairCode;
    } else {
      tempUserDetail.ssoUid = fields.responderSsoUid;
      tempUserDetail.buyerFairCode = fields.responderFairCode;
      tempUserDetail.buyerFiscalYear = fields.responderFiscalYear;
      tempUserDetail.ccdId = fields.requesterSsoUid;
      tempUserDetail.exhibitorFairCode = fields.fairCode;
    }

    let errorMessge = '';
    const [buyerResponse, exhibitorResponse] = await Promise.all([
      this.fairService.getFairParticipantProfile(tempUserDetail.ssoUid, tempUserDetail.buyerFairCode, tempUserDetail.buyerFiscalYear),
      this.exhibitorService.getExhibitorProfileFromES(tempUserDetail.ccdId, tempUserDetail.exhibitorFairCode, 'en') // eoa (exhibitor db) only saving english data
    ])
    .catch(([buyerResponseError, exhibitorResponseError]): any => {
      errorMessge = `Error message from buyer profile api: ${buyerResponseError?.message ?? JSON.stringify(buyerResponseError)}, error message from exhibitor profile api: ${exhibitorResponseError?.message ?? JSON.stringify(exhibitorResponseError)}`;
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: errorMessge
      };
    });

    if (buyerResponse?.data?.status === constant.GENERAL_STATUS.FAIL || exhibitorResponse?.data?.status === constant.GENERAL_STATUS.FAIL) {
      this.logger.log(`{route: createMeeting, step: error - 1, detail: ${errorMessge}}`);
      this.logger.log(`{route: createMeeting, step: error - 2, detail: buyerResponse: ${JSON.stringify(buyerResponse?.data)}}, exhibitorResponse: ${JSON.stringify(exhibitorResponse?.data)}`);
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: errorMessge
      };
    }

    this.logger.log(`{route: createMeeting - buyerResponse, step: 2, detail: buyer profile: ${JSON.stringify(buyerResponse?.data)}}`);

    this.logger.log(`{route: createMeeting - exhibitorResponse, step: 2.1, detail: exhibitor profile: ${JSON.stringify(exhibitorResponse?.data)}}`);
    const buyerProfile = {
      buyerFirstName: buyerResponse?.data?.data?.firstName,
      buyerLastName: buyerResponse?.data?.data?.lastName,
      buyerFiscalYear: buyerResponse?.data?.data?.fiscalYear,
      buyerCompanyName: buyerResponse?.data?.data?.companyName,
      buyerCountryCode: buyerResponse?.data?.data?.addressCountryCode
    };

    const exhibitorEsProfile = exhibitorResponse?.data?.data?.hits?.[0];
    const exhibitorMappedProfile = {
      exhibitorFirstName: exhibitorEsProfile?.exhibitorFirstName,
      exhibitorLastName: exhibitorEsProfile?.exhibitorLastName,
      exhibitorFiscalYear: exhibitorEsProfile?.fairFiscalYear,
      exhibitorCompanyName: exhibitorEsProfile?.exhibitorName,
      exhibitorCountryCode: exhibitorEsProfile?.countrySymbol,
      exhibitorBoothNumber: exhibitorEsProfile?.boothDetails?.[0]?.boothNumber,
      exhibitorSupplierUrn: exhibitorEsProfile?.supplierUrn,
      exhibitorCompanylogo: exhibitorEsProfile?.supplierLogo,
      exhibitorUrn: exhibitorEsProfile?.exhibitorUrn
    };

    const tempProfile = {
      requesterFirstName: '',
      requesterLastName: '',
      requesterCompanyName: '',
      requesterExhibitorUrn: '',
      requesterSupplierUrn: '',
      requesterCountryCode: '',
      requesterCompanyLogo: null,
      responderFirstName: '',
      responderLastName: '',
      responderCompanyName: '',
      responderExhibitorUrn: '',
      responderSupplierUrn: '',
      responderCountryCode: '',
      responderCompanyLogo: null
    };

    if (fields.requesterRole.toLowerCase() === 'buyer') {
      tempProfile.requesterFirstName = buyerProfile?.buyerFirstName;
      tempProfile.requesterLastName = buyerProfile?.buyerLastName;
      tempProfile.requesterCompanyName = buyerProfile?.buyerCompanyName;
      tempProfile.requesterCountryCode = buyerProfile?.buyerCountryCode;
      tempProfile.requesterExhibitorUrn = '';
      tempProfile.requesterSupplierUrn = '';
      tempProfile.responderFirstName = exhibitorMappedProfile?.exhibitorFirstName;
      tempProfile.responderLastName = exhibitorMappedProfile?.exhibitorLastName;
      tempProfile.responderCompanyName = exhibitorMappedProfile?.exhibitorCompanyName;
      tempProfile.responderCountryCode = exhibitorMappedProfile?.exhibitorCountryCode;
      tempProfile.responderExhibitorUrn = exhibitorMappedProfile?.exhibitorUrn;
      tempProfile.responderSupplierUrn = exhibitorMappedProfile?.exhibitorSupplierUrn;
      tempProfile.responderCompanyLogo = exhibitorEsProfile?.exhibitorCompanylogo;
    } else {
      tempProfile.requesterFirstName = exhibitorMappedProfile?.exhibitorFirstName;
      tempProfile.requesterLastName = exhibitorMappedProfile?.exhibitorLastName;
      tempProfile.requesterCompanyName = exhibitorMappedProfile?.exhibitorCompanyName;
      tempProfile.requesterCountryCode = exhibitorMappedProfile?.exhibitorCountryCode;
      tempProfile.requesterExhibitorUrn = exhibitorMappedProfile?.exhibitorUrn;
      tempProfile.requesterSupplierUrn = exhibitorMappedProfile?.exhibitorSupplierUrn;
      tempProfile.requesterCompanyLogo = exhibitorEsProfile?.exhibitorCompanylogo;
      tempProfile.responderFirstName = buyerProfile?.buyerFirstName;
      tempProfile.responderLastName = buyerProfile?.buyerLastName;
      tempProfile.responderCompanyName = buyerProfile?.buyerCompanyName;
      tempProfile.responderCountryCode = buyerProfile?.buyerCountryCode;
      tempProfile.responderExhibitorUrn = '';
      tempProfile.responderSupplierUrn = '';
    }

    this.logger.log(`{route: createMeeting, step: 3 - prepare temp profile, detail: ${JSON.stringify(tempProfile)}}`);

    const meetingAttributes: Record<string, any> = {
      meetingId,
      assignerId,
      assignerRole,
      requesterResponseStatus: ResponseStatus.ACCEPTED,
      responderResponseStatus: ResponseStatus.PENDING,
      ...fields,
      requesterFirstName: tempProfile.requesterFirstName,
      requesterLastName: tempProfile.requesterLastName,
      requesterCompanyName: tempProfile.requesterCompanyName,
      requesterCountryCode: tempProfile.requesterCountryCode,
      requesterExhibitorUrn: tempProfile.requesterExhibitorUrn,
      requesterSupplierUrn: tempProfile.requesterSupplierUrn,
      requesterCompanyLogo: tempProfile.requesterCompanyLogo,
      responderFirstName: tempProfile.responderFirstName,
      responderLastName: tempProfile.responderLastName,
      responderCompanyName: tempProfile.responderCompanyName,
      responderCountryCode: tempProfile.responderCountryCode,
      responderExhibitorUrn: tempProfile.responderExhibitorUrn,
      responderSupplierUrn: tempProfile.responderSupplierUrn,
      responderCompanyLogo: tempProfile.responderCompanyLogo,
      requesterEmailStatus: EmailDeliveryStatus.NONE,
      responderEmailStatus: EmailDeliveryStatus.PENDING,
      status: fields.adminDetail ? MeetingStatus.ACCEPTED : MeetingStatus.PENDING,
      startTime,
      endTime,
      createdBy: assignerId,
      creationTime: new Date(),
      lastUpdatedBy: fields.adminDetail ? fields.adminDetail.adminId : assignerId,
      lastUpdatedAt: new Date(),
    };

    this.logger.log(`{route: createMeeting, step: 4 - prepare meeting attributes, detail: ${JSON.stringify(meetingAttributes)}}`);
    // if this is assigned by CBM
    if (assignerRole === MeetingRole.ADMIN) {
      meetingAttributes.status = MeetingStatus.ACCEPTED;
      meetingAttributes.requesterEmailStatus = EmailDeliveryStatus.PENDING;
      meetingAttributes.responderEmailStatus = EmailDeliveryStatus.PENDING;
      meetingAttributes.requesterResponseStatus = ResponseStatus.ASSIGNED;
      meetingAttributes.responderResponseStatus = ResponseStatus.ASSIGNED;
      this.logger.log(`{route: createMeeting - prepare admin data, step: 4.1, detail: ${JSON.stringify(meetingAttributes)}}`);
    }

    let dataBuyer = null;
    let dataExhibitor = null;

    if (fields.requesterRole === 'BUYER') {
      dataBuyer = { ssoUid: fields.requesterSsoUid, fairCode: fields.fairCode };
      dataExhibitor = { ccdid: fields.responderSsoUid, fairCode: fields.responderFairCode };
    } else {
      dataBuyer = { ssoUid: fields.responderSsoUid, fairCode: fields.responderFairCode };
      dataExhibitor = { ccdid: fields.requesterSsoUid, fairCode: fields.fairCode };
    }

    const buyerStatus = await this.fairService.getFairParticipantStatus(dataBuyer.ssoUid, dataBuyer.fairCode);
    this.logger.log(`{route: createMeeting - getFairParticipantStatus, step: 5, detail: ${JSON.stringify(buyerStatus)}}`);

    if (buyerStatus?.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: buyerStatus?.message ?? JSON.stringify(buyerStatus)
      };
    }
    const exhibitorStatus = await this.exhibitorService.getExhibitorParticipantStatus(dataExhibitor.ccdid, dataExhibitor.fairCode);
    this.logger.log(`{route: createMeeting - getExhibitorParticipantStatus, step: 6, detail: ${JSON.stringify(exhibitorStatus)}}`);

    if (exhibitorStatus?.status === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: exhibitorStatus?.message ?? JSON.stringify(exhibitorStatus)
      };
    }

    // end of get userProfile

    const meeting: Meeting = this.meetingsRepository.create(meetingAttributes);

    return this.meetingsRepository.save(meeting, { reload: true })
    .then(async (result: Meeting) => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      if (!fields.recommendationItemId) {
        return {
          status: constant.GENERAL_STATUS.SUCCESS,
          result
        };
      }
      try {
        await this.recommendationItemRepository.update({ id: fields.recommendationItemId }, {
        meetingId: result.meetingId
      });
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
      } catch (err) {
        return {
          status: constant.GENERAL_STATUS.FAIL,
          message: 'save meeting Id into table fail'
        };
      }
    })
    .catch((error:any) => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async rescheduleMeeting(ssoUid: string, meeting: Meeting, fields: Record<string, any>): Promise<any> {
    const newMeetingName = fields.name || meeting.name;
    // to-do[uuid] - need update the msg below?
    const newMeetingMessage = fields.message || `New Meeting rescheduled from :${meeting.id}`;
    const newMeetingType = Number.isInteger(fields.type) ? fields.type : meeting.type;
    const newMeetingf2fLocation = fields.type === 0 ? null : (fields.f2fLocation || meeting.f2fLocation);

    const isCallerRequester = meeting.requesterSsoUid === ssoUid;
    let desiredReqResponseStatus: ResponseStatus = ResponseStatus.REQ_RESCHEDULE;
    let desiredResResponseStatus: ResponseStatus = ResponseStatus.REQ_RESCHEDULE;

    if (isCallerRequester) {
      desiredReqResponseStatus = ResponseStatus.REQ_RESCHEDULE;
      desiredResResponseStatus = fields.adminDetail ? ResponseStatus.ACCEPTED : ResponseStatus.PENDING;
    } else {
      desiredReqResponseStatus = fields.adminDetail ? ResponseStatus.ACCEPTED : ResponseStatus.PENDING;
      desiredResResponseStatus = ResponseStatus.REQ_RESCHEDULE;
    }

    let oldRequester = {
      firstName: meeting.requesterFirstName,
      lastName: meeting.requesterLastName,
      companyName: meeting.requesterCompanyName,
      companyLogo: meeting.requesterCompanyLogo,
      supplierUrn: meeting.requesterSupplierUrn,
      exhibitorUrn: meeting.requesterExhibitorUrn,
      country: meeting.requesterCountryCode,
      fairCode: meeting.fairCode,
      fiscalYear: meeting.fiscalYear,
      responseStatus: desiredReqResponseStatus,
    };

    let oldResponder = {
      firstName: meeting.responderFirstName,
      lastName: meeting.responderLastName,
      companyName: meeting.responderCompanyName,
      companyLogo: meeting.responderCompanyLogo,
      supplierUrn: meeting.responderSupplierUrn,
      exhibitorUrn: meeting.responderExhibitorUrn,
      country: meeting.responderCountryCode,
      fairCode: meeting.responderFairCode,
      fiscalYear: meeting.responderFiscalYear,
      responseStatus: desiredResResponseStatus,
    };

    let newRequester = isCallerRequester ? oldRequester : oldResponder;
    let newResponder = !isCallerRequester ? oldRequester : oldResponder;

    const requesterRole = meeting.requesterSsoUid === ssoUid ? meeting.requesterRole : meeting.responderRole;

    // added cbm flow, changed some role to admin
    const { status: createMeetingStatus, message: createMeetingErrorMessage, result: newMeeting } = await this.createMeeting(ssoUid, requesterRole, {
      meetingId: await this.generateUniqueMeetingId(),
      fairCode: newRequester.fairCode,
      fiscalYear: newRequester.fiscalYear,
      name: newMeetingName,

      assignerId: meeting.assignerId,
      assignerRole: meeting.assignerRole,
      adminDetail: fields?.adminDetail,

      requesterFirstName: newRequester.firstName,
      requesterLastName: newRequester.lastName,
      responderFirstName: newResponder.firstName,
      responderLastName: newResponder.lastName,

      message: newMeetingMessage,
      type: newMeetingType,
      f2fLocation: newMeetingf2fLocation,
      startTime: fields.startTime,
      endTime: fields.endTime,
      rescheduledTime: (meeting.rescheduledTime || 0) + 1,
      requesterRole,

      responderSsoUid: meeting.responderSsoUid === ssoUid ? meeting.requesterSsoUid : meeting.responderSsoUid,
      responderRole: meeting.responderSsoUid === ssoUid ? meeting.requesterRole : meeting.responderRole,

      requesterCompanyName: newRequester.companyName,
      requesterSupplierUrn: newRequester.supplierUrn,
      requesterExhibitorUrn: newRequester.exhibitorUrn,
      requesterCountryCode: newRequester.country,
      requesterCompanyLogo: newRequester.companyLogo,
      requesterResponseStatus: newRequester.responseStatus,

      responderCompanyName: newResponder.companyName,
      responderSupplierUrn: newResponder.supplierUrn,
      responderExhibitorUrn: newResponder.exhibitorUrn,
      responderCountryCode: newResponder.country,
      responderCompanyLogo: newResponder.companyLogo,
      responderFairCode: newResponder.fairCode,
      responderFiscalYear: newResponder.fiscalYear,
      responderResponseStatus: newResponder.responseStatus,

      requesterSsoUid: ssoUid,
    });

    if (createMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: createMeetingErrorMessage
      };
    }

    const { status: saveMeetingStatus, message: saveMeetingErrorMessage, result: oldMeeting } = await this.meetingsRepository.save({
      ...meeting,
      status: MeetingStatus.CANCELLED,
      cancelledBy: fields.adminDetail ? fields.adminDetail.adminId : ssoUid,
      // @ts-ignore
      cancelledReason: `Meeting is rescheduled from ${newMeeting?.name} on ${newMeeting?.startTime}`,
      lastUpdatedBy: fields.adminDetail ? fields.adminDetail.adminId : ssoUid,
      lastUpdatedAt: new Date(),
      // @ts-ignore
      rescheduledTo: newMeeting.id,
    })
    .then((result: Meeting): { status: number, message?: string, result?: Meeting } => {
      this.logger.log(`{route: createMeeting - end, step: 7, detail: ${JSON.stringify(result)}}`);
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        result
      };
    })
    .catch((error: any) : { status: number, message?: string, result?: Meeting } => ({
        status: constant.GENERAL_STATUS.FAIL,
        message: `errno: ${error?.errno}, sqlMessage: ${error?.sqlMessage}, sql: ${error?.sql}`
      }));

    if (saveMeetingStatus === constant.GENERAL_STATUS.FAIL) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: saveMeetingErrorMessage
      };
    }

    return {
      status: constant.GENERAL_STATUS.SUCCESS,
      oldMeeting,
      newMeeting
    };
  }

  public async findPendingMeetingOverHrs(): Promise<any> {
    const time48hrsAgo = moment.utc().subtract(72, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const time72hrsAgo = moment.utc().subtract(96, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const currentTime = moment().utc().format('YYYY-MM-DD HH:mm:ss');

    const conditions = [
      `(M1.creationTime < '${time72hrsAgo}' AND M1.endTime > '${currentTime}' AND M1.status = ${MeetingStatus.PENDING} AND M2.id IS NOT NULL)`,
      `(M1.creationTime < '${time48hrsAgo}' AND M1.endTime > '${currentTime}' AND M1.status = ${MeetingStatus.PENDING} AND M2.id IS NULL)`,
    ].join(' OR ');

    return this.meetingsRepository.createQueryBuilder('M1').leftJoinAndSelect(Meeting, 'M2', 'M2.rescheduledTo = M1.id').where(conditions).getMany();
  }

  public async updateMeetingByMeetingId(meetingId: string, ssoUid: string, status: JoinMeetingStatus): Promise<Meeting> {
    const meeting: Meeting = await this.meetingsRepository.findOneOrFail({ meetingId });
    const isRequesterJoined = (meeting.requesterSsoUid === ssoUid) ? status : meeting.isRequesterJoined;
    const isResponderJoined = (meeting.responderSsoUid === ssoUid) ? status : meeting.isResponderJoined;

    this.logger.log(JSON.stringify({ section: 'meeting', action: 'joinMeetingByMeetingId', step: '1', detail: { meeting, isRequesterJoined, isResponderJoined } }));
    return this.meetingsRepository.save({
      ...meeting,
      isRequesterJoined,
      isResponderJoined,
    });
  }

  private getWhereConditions(ssoUidArr: string[], dtoStatus: GetMeetingsDtoStatus, fields: Record<string, any>): Array<any> {
    const currentTime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
    const endTime = fields.endTime ? moment(fields.endTime).format('YYYY-MM-DD HH:mm:ss') : null;

    fields.status = In([MeetingStatus.PENDING, MeetingStatus.ACCEPTED, MeetingStatus.RELEASED]);
    fields.rescheduledTo = null;

    if (fields.startTime) {
      fields.startTime = MoreThanOrEqual(fields.startTime);
    }

    if ([GetMeetingsDtoStatus.UPCOMING, GetMeetingsDtoStatus.PENDING_SELF_RESPOND, GetMeetingsDtoStatus.PENDING_OTHER_RESPOND].includes(dtoStatus)) {
      fields.endTime = endTime ? Raw((alias: string) => `${alias} > '${currentTime}' AND ${alias} <= '${endTime}'`) : MoreThan(currentTime);
    } else if (dtoStatus === GetMeetingsDtoStatus.PAST) {
      fields.endTime = endTime ? Raw((alias: string) => `${alias} < '${currentTime}' AND ${alias} <= '${endTime}'`) : LessThan(currentTime);
    } else if (fields.endTime) {
      fields.endTime = LessThanOrEqual(fields.endTime);
    }

    // support multiple id
    if (dtoStatus === GetMeetingsDtoStatus.PENDING_SELF_RESPOND) {
      fields.status = In([MeetingStatus.PENDING, MeetingStatus.RELEASED]);
      return [{ ...fields, responderSsoUid: In(ssoUidArr) }];
    }

    // support multiple id
    if (dtoStatus === GetMeetingsDtoStatus.PENDING_OTHER_RESPOND) {
      fields.status = In([MeetingStatus.PENDING, MeetingStatus.RELEASED]);
      return [{ ...fields, requesterSsoUid: In(ssoUidArr) }];
    }

    if (dtoStatus === GetMeetingsDtoStatus.UPCOMING) {
      fields.status = MeetingStatus.ACCEPTED;
    }

    if (dtoStatus === GetMeetingsDtoStatus.PAST) {
      fields.status = In([MeetingStatus.ACCEPTED, MeetingStatus.PENDING, MeetingStatus.RELEASED]);
    }

    if (dtoStatus === GetMeetingsDtoStatus.CANCELLED) {
      fields.status = In([MeetingStatus.CANCELLED, MeetingStatus.REJECTED, MeetingStatus.AUTO_CANCELLED]);
    }

    // support multiple id
    return [
      { ...fields, requesterSsoUid: In(ssoUidArr) },
      { ...fields, responderSsoUid: In(ssoUidArr) },
    ];
  }

  public async setFeedback(
    answer:string,
    score: number,
    userType:string,
    meetingId:string
    ): Promise<any> {
   const query = getConnection()
    .createQueryBuilder()
    .update('vepC2MMeeting');

    if (userType.toUpperCase() === MeetingRole.BUYER) {
        query.set({
          scoreToExhibitor: score,
          scoreToExhibitorRefTxt: answer 
        });
    } else {
        query.set({         
          scoreToBuyer: score,
          scoreToBuyerRefTxt: answer
        });
    }
    return query.where({ meetingId })
    .execute()
    .then((result) => ({
        status: 200,
        data: result
      }))
    .catch((error) =>
      // this.logger.log(`Error trying to update feedback, ids: ${meetingId}, error: ${error}`);
       ({
        status: 400,
        message: error?.message ?? JSON.stringify(error)
      }));
    }

  private toSQLArraySting<T>(array: Array<T>): string {
    if (!array?.length) {
      return '';
    }
    return `'${array.join("','")}'`;
  }

  public async postMeetingFeedbackFormId(body:{ fairCode:string, year:string, feedbackFormId:string }): Promise<any> {
    const query = getConnection().createQueryBuilder().update('vepC2MMeeting').set({
      feedbackFormId: body.feedbackFormId
    });

    return query
      .where('fairCode = :fairCode', { fairCode: body.fairCode })
      .andWhere('fiscalYear = :year', { year: body.year })
      .execute()
      .then((result) => ({
        status: 200,
        data: result,
      }))
      .catch((error) =>
        // this.logger.log(`Error trying to update feedback, ids: ${meetingId}, error: ${error}`);
        ({
          status: 400,
          message: error?.message ?? JSON.stringify(error),
        }));
  }

  public async getUserConfirmAndPendingMeeting(ssoUid: string, fairCode: string, fiscalYear: string): Promise<any> {
    return this.meetingsRepository.createQueryBuilder('meeting')
      .where(`(meeting.requesterSsoUid = "${ssoUid}" and meeting.status = 1 and meeting.fairCode = "${fairCode}" and meeting.fiscalYear = "${fiscalYear}")`)
      .orWhere(`(meeting.requesterSsoUid = "${ssoUid}" and meeting.status = 0 and meeting.fairCode = "${fairCode}" and meeting.fiscalYear = "${fiscalYear}")`)
      .orWhere(`(meeting.responderSsoUid = "${ssoUid}" and meeting.status = 1 and meeting.responderFairCode = "${fairCode}" and meeting.responderFiscalYear = "${fiscalYear}")`)
      .getMany();
  }

  public async countMeetingBetweenTimeslot (timeRanges: {id: number, fairCode: string, fiscalYear: string, startTime: string, endTime: string}[]): Promise<any> {
    try {
      const timeRangesConditionArr = timeRanges.map((timeRange: {id: number, fairCode: string, fiscalYear: string, startTime: string, endTime: string}) => {
        return `(endTime > '${timeRange.startTime}' AND startTime < '${timeRange.endTime}' AND fairCode = '${timeRange.fairCode}' AND fiscalYear = '${timeRange.fiscalYear}')`
      })
      const timeRangesCondition = `WHERE (${timeRangesConditionArr.join(' OR ')})`
      const validationQ = `
        SELECT
          COUNT(*) as count
        FROM vep_c2m_service_db.vepC2MMeeting
        ${timeRangesCondition}
      `
      const validation = await getConnection().query(validationQ)
      return {
        status: constant.GENERAL_STATUS.SUCCESS,
        meetingCount: validation[0].count
      };
    } catch (err) {
      return {
        status: constant.GENERAL_STATUS.FAIL,
        message: 'count meeting between timeslot fail'
      };
    }

  }
}
