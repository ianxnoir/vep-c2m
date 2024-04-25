/* eslint-disable @typescript-eslint/member-ordering */
import { HttpStatus, Injectable } from '@nestjs/common';
import moment from 'moment-timezone';
import { getConnection, getManager } from 'typeorm';
import { Logger } from '../../../core/utils';
import { CBMFilterMeetingDtoData, PaginateOption } from '../../../dto/cbmFilterMeeting.dto';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { MeetingRole, MeetingStatus, OnlineMeetingStatus, ResponseStatus, TdcCancelByEnum } from '../../c2m/meeting/meeting.type';
import { MeetingFilter, SearchOption, SortingOption, SortingType } from '../cbm.type';

// Todo: group buyer/ exhibitor function into a service
@Injectable()
export class CBMMeetingService {
  constructor(
    private fairService: ApiFairService,
    private apiExhibitorService: ApiExhibitorService,
    private logger: Logger
  ) {}

  public async filterMeeting(
    fairCode: string,
    fairYear: string,
    timeZone: string,
    filters: CBMFilterMeetingDtoData,
    sortings: SortingOption,
    search: SearchOption = undefined,
    paginate: PaginateOption
  ): Promise<any> {
    let slaveRunner;
    try {
      const { pageNum = 0, rowsPerPage = 20 } = paginate;

      const offset = pageNum * rowsPerPage;

      // extract filter option here
      const {
        startTime,
        endTime,
        assignerRole,
        type,
        status,
        onlineMeetingStatus,
        buyerBranchOffice,
        buyerCountry,
        buyerAttendanceStatus,
        buyerResponseStatus,
        exhibitorCountry,
        exhibitorFairName,
        exhibitorAttendanceStatus,
        exhibitorResponseStatus,
        pavilion,
        ssoUid,
        agent
      } = filters;

      // get combine fair setting from eoa
      const eoaFairDict = await this.computeEoaFair(fairCode, fairYear);
      const fairCodes = Object.values(eoaFairDict).map((fair: any) => fair.fairCode);
      const fiscalYear = Object.values(eoaFairDict).map((fair: any) => fair.fiscalYear);
      fiscalYear;

      const exEoaFairDict = await this.computeEoaFair(fairCode, fairYear, exhibitorFairName);
      const exFairCodes = Object.values(exEoaFairDict).map((fair: any) => fair.fairCode);
      const exFiscalYear = Object.values(exEoaFairDict).map((fair: any) => fair.fiscalYear);
      exFiscalYear;

      const buyerQueryString = `
        SELECT
        *,
        CASE 
          WHEN type = 0 AND STATUS = 1 THEN 
            CASE 
              WHEN startTime >= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() THEN 'UPCOMING' 
              WHEN startTime <= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() AND (isRequesterJoined = 0 OR isResponderJoined = 0) THEN 'WAITING' 
              WHEN startTime <= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() AND (isRequesterJoined > 0 AND isResponderJoined > 0) THEN 'CHECKEDIN'
              WHEN endTime <= UTC_TIMESTAMP() THEN 'COMPLETED'
            END 
          WHEN type = 1 THEN 'NONE' 
        END AS onlineMeetingStatus 
        FROM (
          SELECT
            id as meetingId,

            meetingId as meetingUUID,
            type,
            f2fLocation,
            assignerId,
            assignerRole,
            isRequesterJoined,
            isResponderJoined,
            status,
            startTime,
            endTime,
            CASE
              WHEN requesterRole = 'BUYER' THEN requesterSsoUid
              ELSE responderSsoUid
            END AS buyerSsoUid,
            CASE
              WHEN requesterRole = 'BUYER' THEN requesterResponseStatus
              ELSE responderResponseStatus
            END AS buyerResponseStatus,
            CASE
              WHEN requesterRole = 'BUYER' THEN requesterRole
              ELSE responderRole
            END AS buyerRole,
            CASE
              WHEN requesterRole = 'BUYER' THEN isRequesterJoined
              ELSE isResponderJoined
            END AS isBuyerJoined,
            CASE
              WHEN requesterRole = 'BUYER' THEN fairCode
              ELSE responderFairCode
            END AS buyerFair,
            CASE
              WHEN requesterRole = 'BUYER' THEN fiscalYear
              ELSE responderFiscalYear
            END AS buyerFiscalYear
          FROM vep_c2m_service_db.vepC2MMeeting requesterBuyer
          WHERE (requesterRole = 'BUYER' OR responderRole = 'BUYER')
          AND
            CASE
              WHEN requesterRole = 'BUYER' THEN fairCode IN(${this.toSQLArraySting(fairCodes)})
              ELSE responderFairCode IN(${this.toSQLArraySting(fairCodes)})
            END
        ) buyerMeeting
        INNER JOIN vepFairDb.fairParticipant participant
        ON buyerMeeting.buyerSsoUid = participant.ssoUid
        INNER JOIN (
          SELECT
            id as registrationId,
            fairParticipantId,
            fairCode,
            fiscalYear,
            overseasBranchOffice as buyerBranchOffice,
            addressCountryCode as buyerCountryCode,
            companyName as buyerCompanyName,
            firstName as buyerFirstName,
            lastName as buyerLastName,
            displayName as buyerDisplayName,
            CONCAT(firstName, ' ', lastName) as buyerName,
            fairParticipantTypeId as buyerTypeId,
            c2mParticipantStatusId as buyerParticipantStatusId
          FROM vepFairDb.fairRegistration registration
          ${this.buildQueryString(null, {
            fairCode: fairCodes
            // fiscalYear
          })}
        ) registration
        ON registration.fairParticipantId = participant.id 
        AND buyerMeeting.buyerFiscalYear = registration.fiscalYear 
        AND buyerMeeting.buyerFair = registration.fairCode
        INNER JOIN (
          SELECT 
            id as typeId,
            fairParticipantTypeCode as buyerTypeCode
          FROM vepFairDb.fairParticipantType
        ) fairParticipantType
        ON fairParticipantType.typeId = registration.buyerTypeId
        ${this.buildQueryString(null, {
          buyerBranchOffice,
          buyerCountryCode: buyerCountry
        })}
        ${ssoUid?.length ? `WHERE participant.ssoUid IN (${this.toSQLArraySting(ssoUid)})` : ''}
      `;

      // to extract meeting role participant from meeting list
      const exhibitorQueryString = `
        SELECT  
          *
        FROM (
          SELECT
            id as meetingId,

            meetingId as meetingUUID,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterSsoUid
            ELSE responderSsoUid
            END AS exhibitorSsoUid,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterResponseStatus
            ELSE responderResponseStatus
            END AS exhibitorResponseStatus,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN requesterRole
            ELSE responderRole
            END AS exhibitorRole,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN isRequesterJoined
            ELSE isResponderJoined
            END AS isExhibitorJoined,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN fairCode
            ELSE responderFairCode
            END AS exhibitorFair,
            CASE
            WHEN requesterRole = 'EXHIBITOR' THEN fiscalYear
            ELSE responderFiscalYear
            END AS exhibitorFiscalYear
          FROM vep_c2m_service_db.vepC2MMeeting requesterEXHIBITOR
          WHERE (requesterRole = 'EXHIBITOR' OR responderRole = 'EXHIBITOR')
          AND
            CASE
              WHEN requesterRole = 'EXHIBITOR' THEN fairCode IN(${this.toSQLArraySting(exFairCodes)})
              ELSE responderFairCode IN(${this.toSQLArraySting(exFairCodes)})
            END
        ) AS exhibitorMeeting
        INNER JOIN vep_content.vep_fair_setting eoa 
        ON 
          eoa.meta_key = 'eoa_fair_id' 
          AND eoa.fairCode = exhibitorMeeting.exhibitorFair 
          AND eoa.fiscal_year = exhibitorMeeting.exhibitorFiscalYear
        INNER JOIN (
          SELECT 
            companyCcdId as exhibitorCompanyCcdId,
            boothNumber,
            eoaFairId as exhibitorEoaFairId,
            vepType as exhibitorType,
            companyName as exhibitorCompanyName,
            country as exhibitorCountry,
            contactName as exhibitorName,
            contactEmail as exhibitorEmail,
            exhibitDescription as exhibitorDescription,
            c2mParticipantStatusId as exhibitorParticipantStatus,
            userTimezone as exhibitorTimezone,
            pavilion,
            agentName as agent
          FROM vepExhibitorDb.vepExhibitor exhibitor
          ${pavilion?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
            SELECT pavilion.companyCcdId AS pavilionCcdId, pavilion.eoaFairId as pavilionEoaFairId, GROUP_CONCAT(DISTINCT pavilion.value) as pavilion
            FROM vepExhibitorDb.vepExhibitorAttributes pavilion
            WHERE pavilion.attribute = 'pavilion' AND pavilion.locale = 'en' AND pavilion.eoaFairId IN (${this.toSQLArraySting(Object.keys(exEoaFairDict))})
            GROUP BY pavilionCcdId, pavilionEoaFairId
            ${pavilion?.length ? `HAVING SUM( pavilion.value IN (${this.toSQLArraySting(pavilion || [])})) > 0` : ''}
          ) pavilion
          ON exhibitor.companyCcdId = pavilionCcdId AND exhibitor.eoaFairId = pavilionEoaFairId
          ${this.buildQueryString('exhibitor', {
            country: exhibitorCountry,
            eoaFairId: Object.keys(exEoaFairDict),
            active: [1]
          })}
        ) exhibitor
        ON exhibitorCompanyCcdId = exhibitorSsoUid AND exhibitorEoaFairId = eoa.meta_value
      `;

      let isExhibitorJoined;
      let isBuyerJoined;

      // 1 stay online, 2 checked but left, 0 no show
      if (exhibitorAttendanceStatus !== null && typeof exhibitorAttendanceStatus !== undefined && exhibitorAttendanceStatus?.length) {
        let tempExhibitorArr = <number[]>[];
        if (exhibitorAttendanceStatus.includes(true)) {
          tempExhibitorArr = tempExhibitorArr.concat([1, 2]);
        }
        if (exhibitorAttendanceStatus.includes(false)) {
          tempExhibitorArr = tempExhibitorArr.concat([0]);
        }
        isExhibitorJoined = tempExhibitorArr;
      }

      if (buyerAttendanceStatus !== null && typeof buyerAttendanceStatus !== undefined && buyerAttendanceStatus?.length) {
        let tempBuyerArr = <number[]>[];
        if (buyerAttendanceStatus.includes(true)) {
          tempBuyerArr = tempBuyerArr.concat([1, 2]);
        }
        if (buyerAttendanceStatus.includes(false)) {
          tempBuyerArr = tempBuyerArr.concat([0]);
        }
        isBuyerJoined = tempBuyerArr;
      }

      const {
        meetingTime: sortStartTime,
        meetingDate: sortStartDate,
        onlineMeetingStatus: sortOnlineMeetingStatus,
        meetingId,
        buyerCompany,
        exhibitorCompany,
        meetingType,
        appointmentStatus,
        exhibitorFairName: sortExhibitorFair,
        buyerResponseStatus: sortBuResStatus,
        exhibitorResponseStatus: sortExResStatus,
        arrangedByTdc,
        buyerName: sortBuyerName,
        buyerCountry: sortBuyerCountry,
        buyerBranchOffice: sortBuyerBranchOffice,
        buyerAttendanceStatus: sortBuyerAttendance,
        // exhibitorFairName: sortExhibitorFairName,
        exhibitorCountry: sortExhibitorCountry,
        exhibitorName: sortExhibitorName,
        exhibitorAttendanceStatus: sortExhibitorAttendance,
        pavilion: sortPavilion,
        agent: sortAgent,
        bmStaff: sortBmStaff
      } = sortings;

      let defaultSortOption: Record<string, any> = {
        startTime: SortingType.ASC,
        buyerCompanyName: SortingType.ASC,
        exhibitorCompanyName: SortingType.ASC
      };

      let targetSortOption: Record<string, any> = {
        startTime: sortStartDate || sortStartTime,
        'buyer.meetingId': meetingId,
        onlineMeetingStatus: sortOnlineMeetingStatus,
        isBuyerJoined: sortBuyerAttendance,
        exhibitorFair: sortExhibitorFair,
        isExhibitorJoined: sortExhibitorAttendance,
        assignerRole: arrangedByTdc,
        buyerCompanyName: buyerCompany,
        buyerResponseStatus: sortBuResStatus,
        buyerName: sortBuyerName,
        buyerCountryCode: sortBuyerCountry,
        buyerBranchOffice: sortBuyerBranchOffice,
        exhibitorCompanyName: exhibitorCompany,
        exhibitorName: sortExhibitorName,
        exhibitorCountry: sortExhibitorCountry,
        exhibitorResponseStatus: sortExResStatus,
        pavilion: sortPavilion,
        type: meetingType,
        status: appointmentStatus,
        agent: sortAgent,
        adminName: sortBmStaff
      };

      let meetingQueryString = `
        FROM (${buyerQueryString}) AS buyer
        INNER JOIN (${exhibitorQueryString}) exhibitor
        ON buyer.meetingId = exhibitor.meetingId
        LEFT JOIN (SELECT meetingId as mId, tdcCancelBy from vep_c2m_service_db.vepC2MMeeting) cancelRef
        ON cancelRef.mId = buyer.meetingUUID
        LEFT JOIN ( SELECT rItem.meetingId as rMid, adminUser.name as adminName from vep_c2m_service_db.vepC2MBMRecommendationItem rItem INNER JOIN 
        vep_admin.user adminUser on rItem.createdBy = adminUser.email ) adminTable
        ON adminTable.rMid = buyer.meetingUUID
        ${this.buildMeetingQueryString(
          null,
          {
            assignerRole,
            type,
            status,
            isExhibitorJoined,
            isBuyerJoined,
            buyerResponseStatus,
            exhibitorResponseStatus,
            onlineMeetingStatus,
            agent
          },
          {
            startTime,
            endTime,
          },
          {
            'buyer.meetingUUID': search,
            'exhibitor.exhibitorName': search,
            'exhibitor.exhibitorCompanyName': search,
            'buyer.buyerCompanyName': search,
            'buyer.buyerFirstName': search,
            'buyer.buyerLastName': search,
            'buyer.buyerDisplayName': search,
            'buyer.emailId': search,
            exhibitorEmail: search,
          }
        )}
        ${this.buildSortQueryString(
          null,
          Object.keys(targetSortOption).filter((key: string) => targetSortOption[key])?.length > 0 ? targetSortOption : defaultSortOption
        )}
      `;

      let meetingListQueryString = `
        SELECT *
        ${meetingQueryString}
        LIMIT ${rowsPerPage} OFFSET ${offset};
      `;

      let meetingCountQueryString = `
        SELECT COUNT(*) as count
        ${meetingQueryString}
      `;

      // format query
      meetingQueryString = meetingQueryString.split('\n').join('').replace(/  +/g, ' ');
      // return meetingQueryString;

      const connection = getConnection('c2mDatabase');
      slaveRunner = connection.createQueryRunner('slave');
      const meetings: any[] = await connection.query(meetingListQueryString, undefined, slaveRunner);
      const totalRecordNum: any = parseInt((await connection.query(meetingCountQueryString, undefined, slaveRunner))[0].count, 10);
      // return totalRecordNum;
      const totalPageNum: number = Math.ceil(totalRecordNum / rowsPerPage);
      const targetStartTime = moment().utc().add('minutes', 15);
      // const currentTime = moment().utc();

      const exhibitorCcdIds = meetings.flatMap((meeting: any) => meeting.exhibitorSsoUid);

      const esPromise = this.apiExhibitorService.filterExhibitorByES({
        fairCode,
        from: 0,
        size: exhibitorCcdIds.length,
        filterRecommendedCCDID: exhibitorCcdIds
      });

      let esDict: Record<string, any> = {};
      const { data: esRes } = await Promise.resolve(esPromise);
      const { hits: esResult } = esRes?.data;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      <Array<any>>esResult?.forEach((element: any) => {
        esDict[element?.ccdid] = {
          supplierUrn: element?.supplierUrn,
          exhibitorUrn: element?.exhibitorUrn,
          companyLogo: element?.supplierLogo,
          boothNumber: element?.boothNumbers[0]
        };
      });

      this.logger.log(JSON.stringify({
        action: 'fetch Meeting',
        section: 'CBM',
        step: '2',
        detail: { input: { fairCode, fairYear, filters }, output: meetings.slice(0, 100) }
      }));

      const records = meetings.map((meeting: any) => {
        const meetingDateTime = moment(meeting.startTime).tz(timeZone);
        const meetingEndDateTime = moment(meeting.endTime).tz(timeZone);
        return {
          id: meeting.meetingId,
          meetingId: meeting.meetingUUID,
          targetStartTime,
          currentTime: moment().tz('Asia/Hong_Kong').format(),
          meetingDateTime,
          meetingEndDateTime,
          meetingDate: moment(meetingDateTime).tz('Asia/Hong_Kong').format('DD/MM/YYYY') || '',
          meetingTime: moment(meetingDateTime).tz('Asia/Hong_Kong').format('HH:mm:ss') || '',
          meetingEndDate: moment(meetingEndDateTime).tz('Asia/Hong_Kong').format('DD/MM/YYYY') || '',
          meetingEndTime: moment(meetingEndDateTime).tz('Asia/Hong_Kong').format('HH:mm:ss') || '',
          appointmentStatus: MeetingStatus[meeting.status],
          onlineMeetingStatus: meeting.onlineMeetingStatus,
          meetingType: meeting.type,
          TdcCancelBy: meeting?.tdcCancelBy,

          buyerRegistrationId: parseInt(meeting.registrationId || '', 10),
          buyerCompany: meeting.buyerCompanyName || '',
          buyerFirstName: meeting.buyerFirstName || '',
          buyerLastName: meeting.buyerLastName || '',
          buyerName: `${meeting.buyerFirstName} ${meeting.buyerLastName}` || '',
          buyerSsoUid: meeting.buyerSsoUid || '',
          buyerCountry: meeting.buyerCountryCode || '',
          buyerBranchOffice: meeting.buyerBranchOffice || '',
          buyerResponseStatus: meeting.buyerResponseStatus,
          buyerAttendanceStatus: meeting.isBuyerJoined,
          buyerEmail: meeting.emailId,

          exhibitorCompanyCcdId: meeting.exhibitorSsoUid || '',
          exhibitorFairName: eoaFairDict[meeting.exhibitorEoaFairId]?.fairShortName || '',
          exhibitorName: meeting.exhibitorName || '',
          exhibitorCompany: meeting.exhibitorCompanyName || '',
          exhibitorCountry: meeting.exhibitorCountry || '',
          exhibitorUrn: esDict[meeting.exhibitorSsoUid]?.exhibitorUrn || '',
          exhibitorBoothNumber: meeting.boothNumber || '',
          companyLogo: esDict[meeting.exhibitorSsoUid]?.companyLogo || '',
          exhibitorResponseStatus: meeting.exhibitorResponseStatus,
          exhibitorAttendanceStatus: meeting.isExhibitorJoined,
          exhibitorEmail: meeting.exhibitorEmail,
          agent: meeting.agent,
          bmStaff: meeting.adminName,

          arrangedByTdc: meeting.assignerRole === MeetingRole.ADMIN,
          pavilion: meeting.pavilion
        };
      });

      return {
        recordNum: records.length,
        totalRecordNum,
        rowsPerPage,
        pageNum,
        totalPageNum,
        records
      };
    } catch (err: any) {
      this.logger.log(JSON.stringify({
        action: 'fetch Meeting',
        section: 'CBM',
        step: 'error',
        detail: { input: { fairCode, fairYear, filters }, output: err }
      }));
      return {
        recordNum: 0,
        totalRecordNum: 0,
        rowsPerPage: 0,
        pageNum: 0,
        totalPageNum: 0,
        records:[]
      }
    } finally {
      if (slaveRunner) {
        slaveRunner?.release();
      }
    }
  }

  public async autoRefreshfilterMeeting(
      timeZone: string,
      meetingIds: string[]
    ): Promise<any> {
      const TimeZoneHk = 'Asia/Hong_Kong';
      const targetStartTime = moment().utc().add('minutes', 15);
      const queryString = `
      SELECT
      meetingId,
      status,
      CASE
        WHEN requesterRole = 'BUYER' THEN isRequesterJoined
        ELSE isResponderJoined
      END AS isBuyerJoined,
      CASE
        WHEN requesterRole = 'BUYER' THEN requesterResponseStatus
        ELSE responderResponseStatus
      END AS buyerResponseStatus,
      CASE
        WHEN requesterRole = 'EXHIBITOR' THEN isRequesterJoined
        ELSE isResponderJoined
      END AS isExhibitorJoined,
      CASE
        WHEN requesterRole = 'EXHIBITOR' THEN requesterResponseStatus
        ELSE responderResponseStatus
      END AS exhibitorResponseStatus,
      CASE 
        WHEN type = 0 AND STATUS = 1 THEN 
          CASE 
            WHEN startTime >= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() THEN 'UPCOMING' 
            WHEN startTime <= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() AND (isRequesterJoined = 0 OR isResponderJoined = 0) THEN 'WAITING' 
            WHEN startTime <= UTC_TIMESTAMP() + interval 15 MINUTE AND endTime > UTC_TIMESTAMP() AND (isRequesterJoined > 0 AND isResponderJoined > 0) THEN 'CHECKEDIN'
            WHEN endTime <= UTC_TIMESTAMP() THEN 'COMPLETED'
          END 
        WHEN type = 1 THEN 'NONE' 
      END AS onlineMeetingStatus
      FROM vep_c2m_service_db.vepC2MMeeting
      WHERE meetingId In (${this.toSQLArraySting(meetingIds)})
      `;
      try {
        const meetings = <Record<string, any>[]> await getManager().query(queryString);
        const res = meetings?.map((meeting:Record<string, any>) => {
            const meetingDateTime = moment(meeting.startTime).tz(timeZone);
            const meetingEndDateTime = moment(meeting.endTime).tz(timeZone);
          return {
            meetingId: meeting.meetingId,
            currentTime: moment().tz(TimeZoneHk).format(),
            appointmentStatus: MeetingStatus[meeting.status],
            buyerAttendanceStatus: meeting?.isBuyerJoined,
            buyerResponseStatus: meeting?.buyerResponseStatus,
            exhibitorAttendanceStatus: meeting?.isExhibitorJoined,
            exhibitorResponseStatus: meeting?.exhibitorResponseStatus,
            meetingDateTime,
            meetingEndDateTime,
            meetingDate: moment(meetingDateTime).tz(TimeZoneHk).format('DD/MM/YYYY') || '',
            meetingTime: moment(meetingDateTime).tz(TimeZoneHk).format('HH:mm:ss') || '',
            meetingEndDate: moment(meetingEndDateTime).tz(TimeZoneHk).format('DD/MM/YYYY') || '',
            meetingEndTime: moment(meetingEndDateTime).tz(TimeZoneHk).format('HH:mm:ss') || '',
            onlineMeetingStatus: meeting?.onlineMeetingStatus,
            targetStartTime,
          };
        });
        return {
          status: HttpStatus.OK,
          data: res
        };
      } catch (error) {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: JSON.stringify(error)
        };
      }
    }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private toSQLArraySting<T>(array: Array<T>): string {
    if (!array?.length) {
      return '';
    }
    return `'${array.join("','")}'`;
  }

  // private formatSqlStringArray(array: any[]): string[] {
  //   return array?.map((word: string) => `'${word}'`) || [];
  // }

  private buildSortQueryString(alias: string | null = null, sort: SortingOption): string {
    let result = '';
    if (Object.keys(sort).filter((key: string) => sort[key])?.length) {
      result += 'ORDER BY ';
    }

    Object.keys(sort)
      .filter((key: string) => sort[key])
      .forEach((key: string, index: number, array: string[]) => {
        result += `${key} ${sort[key]}`;
        if (index !== array.length - 1) {
          result += ',';
        }
      });

    return result;
  }

  private buildMeetingQueryString(
    alias: string | null = null,
    filter: Record<string, Array<any> | undefined>,
    extraFilter: MeetingFilter = {
      startTime: null,
      endTime: null,
      onlineMeetingStatus: null
    },
    search: Record<string, string | undefined> = {}
  ): string {
    const { startTime, endTime, onlineMeetingStatus } = extraFilter;

    let first = true;
    let result = '';
    const tdcCancelByTempArr:string[] = [];

    if (filter?.buyerResponseStatus?.length) {
      if (filter?.buyerResponseStatus?.filter((resStatus:string) => resStatus.includes('TDC_CANCEL_')).length) {
        filter.buyerResponseStatus.push(ResponseStatus.TDC_CANCEL);
        if (filter?.buyerResponseStatus?.find((resStatus:string) => resStatus === ResponseStatus.TDC_CANCEL_BUYER)) {
          tdcCancelByTempArr?.push(TdcCancelByEnum.BUYER);
        }
        if (filter?.buyerResponseStatus?.find((resStatus:string) => resStatus === ResponseStatus.TDC_CANCEL_OTHERS)) {
          tdcCancelByTempArr?.push(TdcCancelByEnum.OTHERS);
        }
        filter.buyerResponseStatus = [...filter.buyerResponseStatus].filter((e:string) => !e.includes('TDC_CANCEL_'));
      }
    }

    if (filter?.exhibitorResponseStatus?.length) {
      if (filter?.exhibitorResponseStatus?.filter((resStatus:string) => resStatus.includes('TDC_CANCEL_')).length) {
        filter.exhibitorResponseStatus.push(ResponseStatus.TDC_CANCEL);
        if (filter?.exhibitorResponseStatus?.find((resStatus:string) => resStatus === ResponseStatus.TDC_CANCEL_EXHIBITOR)) {
          tdcCancelByTempArr.push(TdcCancelByEnum.EXHIBITOR);
        }
        if (filter?.exhibitorResponseStatus?.find((resStatus:string) => resStatus === ResponseStatus.TDC_CANCEL_OTHERS && !tdcCancelByTempArr.includes(TdcCancelByEnum.OTHERS))) {
          tdcCancelByTempArr.push(TdcCancelByEnum.OTHERS);
        }
        filter.exhibitorResponseStatus = [...filter.exhibitorResponseStatus].filter((e:string) => !e.includes('TDC_CANCEL_'));
      }
    }

    if (filter && tdcCancelByTempArr.length) {
      filter.tdcCancelBy = tdcCancelByTempArr;
    }

    Object.keys(filter).forEach((key: string) => {
      if (filter[key]?.length) {
        if (first) {
          first = false;
          result += ` WHERE ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(filter[key] || [])})`;
        } else {
          result += ` AND ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(filter[key] || [])})`;
        }
      }
    });

    if (startTime) {
      const startDate = moment(startTime).format('YYYY-MM-DD HH:mm:ss');
      result += ` ${first ? 'WHERE' : 'AND'} startTime >= "${startDate}"`;
      first = false;
    }

    if (endTime) {
      const endDate = moment(endTime).format('YYYY-MM-DD HH:mm:ss');
      result += ` ${first ? 'WHERE' : 'AND'} endTime <= "${endDate}"`;
      first = false;
    }

    if (onlineMeetingStatus?.length) {
      let tempQuery = '';
      let isFirstQuery = first;
      let firstloop = true;

      onlineMeetingStatus.forEach((onlineStatus: OnlineMeetingStatus) => {
        tempQuery += ` ${first ? 'WHERE' : ''} ${firstloop ? '' : 'OR'} (${this.buildOnlineMeetingQuery(onlineStatus)})`;
        first = false;
        firstloop = false;
      });

      result += `${isFirstQuery ? tempQuery : ` AND (${tempQuery})`}`;
    }

    let isglobalFirstQuery = first;
    let searchQuery = '';
    const searchObject = Object.keys(search);
    searchObject?.length && searchObject.forEach((key: string, index: number) => {
      const keyword = search[key]?.replace(/'/g, "\\'");
      if (keyword?.length) {
        let column = key;
        if (alias) {
          column = `${alias}.${key}`;
        }

        if (first) {
          first = false;
          searchQuery += ' WHERE ';
        }
        if (index > 0) {
          searchQuery += ' OR ';
        }

        // containing chinese word
        if (!/^[\u0000-\u007f]*$/.test(keyword)) {
          searchQuery += ` ${column} like '${keyword}%' `;
        } else if (key === 'exhibitor.exhibitorName' || key === 'exhibitor.exhibitorCompanyName'
          || key === 'buyer.buyerCompanyName' || key === 'buyer.buyerLastName' || key === 'buyer.buyerFirstName' || key === 'buyer.buyerDisplayName') {
          searchQuery += ` match( ${column} ) AGAINST ( '${keyword}' ${keyword.indexOf('*') > -1 ? 'IN BOOLEAN MODE' : ''}) `;
        } else {
          searchQuery += ` ${column} = '${keyword}' `;
        }
      }
    });

    if (searchQuery?.length > 1) {
      result += `${isglobalFirstQuery ? searchQuery : ` AND (${searchQuery})`}`;
    }

    return result;
  }

  private buildOnlineMeetingQuery(onlineStatus: OnlineMeetingStatus): string {
    let result = '';
    const targetStartDate = moment().utc().add('minutes', 15).format('YYYY-MM-DD HH:mm:ss');
    const currentDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    switch (onlineStatus) {
      case OnlineMeetingStatus.UPCOMING:
        // is online
        // before startTime
        result = ` startTime >= '${targetStartDate}' AND endTime > '${currentDate}' AND type = 0 AND status = 1`;
        break;
      case OnlineMeetingStatus.WAITING:
        // is online
        // within startTime and endTime
        // is accepted
        // one of them has not join yet
        result = ` startTime <= '${targetStartDate}' AND endTime > '${currentDate}' AND type = 0 AND (isBuyerJoined = 0 OR isExhibitorJoined = 0) AND status = 1`;
        break;
      case OnlineMeetingStatus.CHECKEDIN:
        // is online
        // within startTime and endTime
        // is accepted
        // both joined
        result = ` startTime <= '${targetStartDate}' AND endTime > '${currentDate}' AND type = 0 AND (isBuyerJoined != 0 AND isExhibitorJoined != 0) AND status = 1`;
        break;
      case OnlineMeetingStatus.COMPLETED:
        // is online
        // is after endTime
        result = ` endTime <= '${currentDate}' AND type = 0  AND status = 1`;
        break;
      case OnlineMeetingStatus.NONE:
        // is physical
        result = ' type = 1';
        break;
      default:
        break;
    }
    return result;
  }

  private buildQueryString(
    alias: string | null = null,
    filter: Record<string, Array<any> | undefined>,
    search: Record<string, string | undefined> = {}
  ): string {
    let globalFirstQuery = true;
    let result = '';
    Object.keys(filter).forEach((key: string) => {
      if (filter[key]?.length) {
        if (globalFirstQuery) {
          globalFirstQuery = false;
          result += ` WHERE ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(filter[key] || [])})`;
        } else {
          result += ` AND ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(filter[key] || [])})`;
        }
      }
    });

    let isglobalFirstQuery = globalFirstQuery;
    let subFirstQuery = true;
    let tempResult = '';
    Object.keys(search).forEach((key: string) => {
      if (search[key]) {
        if (globalFirstQuery) {
          globalFirstQuery = false;
          tempResult += ` WHERE ${alias ? `${alias}.` : ''}${key} = '${search[key]?.replace(/'/g, "\\'")}'`;
        } else {
          tempResult += ` ${subFirstQuery ? ' ' : 'OR '}${alias ? `${alias}.` : ''}${key} = '${search[key]?.replace(/'/g, "\\'")}'`;
        }
        subFirstQuery = false;
      }
    });

    if (tempResult) {
      result += `${isglobalFirstQuery ? tempResult : ` AND (${tempResult})`}`;
    }
    return result;
  }

  private async computeEoaFair(fairCode: string, fairYear: string, exhibitorParticipatingFair: Array<string> | null = null): Promise<Record<string, any>> {
    let eoaFairDict: Record<string, any> = {};
    try {
      let { data }: { data: any[] } = await this.fairService.getWordpressFairSetting(fairCode);

      if (!data?.length) {
        // if fairCode is not a combined fair
        const fairSettingResult = await this.fairService.getFairSetting(fairCode);
        data = [fairSettingResult?.data?.data ?? {}];
      }
      // return data;
      // data = data.filter((fairSetting: any) => fairSetting.vms_project_year === fairYear);
      if (exhibitorParticipatingFair?.length) {
        data = data.filter((fairSetting: any) => exhibitorParticipatingFair?.includes(fairSetting?.fair_code));
      }
      data.forEach((element: any) => {
        eoaFairDict[element.eoa_fair_id] = {
          fairCode: element.fair_code,
          fiscalYear: element.fiscal_year,
          fairYear: element.vms_project_year,
          fairShortName: element.fair_short_name?.en
        };
      });

      this.logger.log(JSON.stringify({
        action: 'fetching fair code',
        section: 'CBM',
        step: 'error',
        detail: { input: { fairCode, fairYear, exhibitorParticipatingFair }, output: eoaFairDict }
      }));
    } catch (e) {
      this.logger.log(JSON.stringify({
        action: 'fetching fair code',
        section: 'CBM',
        step: 'error',
        detail: { input: { fairCode, fairYear, exhibitorParticipatingFair }, output: e }
      }));
    }
    return eoaFairDict;
  }

  // private computeOnlineMeetingStatus(meeting: any, current: Moment, targetStartTime: Moment): OnlineMeetingStatus | null {
  //   let status: OnlineMeetingStatus | null = null;
  //   const meetingStartTime = moment(meeting.startTime).utc();
  //   const meetingEndTime = moment(meeting.endTime).utc();
  //   const { isBuyerJoined, isExhibitorJoined } = meeting;
  //   if (meeting.type === 0 && meeting.status === MeetingStatus.ACCEPTED) {
  //     if (meetingStartTime >= targetStartTime && meetingEndTime > current) {
  //       status = OnlineMeetingStatus.UPCOMING;
  //     }

  //     if (meetingStartTime <= targetStartTime && meetingEndTime > current && (isBuyerJoined === 0 || isExhibitorJoined === 0)) {
  //       status = OnlineMeetingStatus.WAITING;
  //     }

  //     if (meetingStartTime <= targetStartTime && meetingEndTime > current && isBuyerJoined !== 0 && isExhibitorJoined !== 0) {
  //       status = OnlineMeetingStatus.CHECKEDIN;
  //     }

  //     if (meetingEndTime <= current) {
  //       status = OnlineMeetingStatus.COMPLETED;
  //     }
  //   } else if (meeting.type === 1) {
  //     status = OnlineMeetingStatus.NONE;
  //   }
  //   return status;
  // }
}
