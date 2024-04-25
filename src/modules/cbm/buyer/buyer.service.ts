import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
import moment from 'moment';
import { getConnection } from 'typeorm';
import { ContentApiService } from '../../api/content/content.service';
import { ApiFairService } from '../../api/fair/fair.service';
// import { VepBuyer as Buyer } from '../../content/buyer/entities/VepBuyer';
// import { ApiFairService } from '../../api/fair/fair.service';
// import { FairParticipant } from '../../content/fair/entities/FairParticipant';
// import { FairRegistration } from '../../content/fair/entities/FairRegistration';
import { SortingOption } from '../cbm.type';
// import { FairService } from '../fair/fair.service';

@Injectable()
export class BuyerService {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    private fairService: ApiFairService,
    private contentService: ContentApiService
  ) {
  }

  public async filterBuyer(
    fairCode: string,
    fairYear: string,
    timeZone: string,
    filters: Record<string, any>,
    sortings: Record<string, SortingOption> = {}
  ): Promise<any> {
    const { buyerType, country, branchOffice } = filters;

    const fairCodesArray = await this.fairService.getCombinedFairCodes(fairCode);

    // if the fairCode not exists, return an empty array , representing no buyer in that not exist meetings
    if (!fairCodesArray || fairCodesArray?.status === 400 || fairCodesArray.fairCodes!.length === 0) {
      return [];
    }

    const registrationFilterString = this.buildQueryString('registration', {
      fairCode: fairCodesArray.fairCodes,
      addressCountryCode: country,
      overseasBranchOffice: branchOffice,
      projectYear: [fairYear],
    });

    const fairRegistrationStatusFilterString = this.buildQueryString('fairRegistrationStatus', {
      fairRegistrationStatusCode: ['CONFIRMED'],
    });

    const fairParticipantTypeFilterString = this.buildQueryString('fairParticipantType', {
      fairParticipantTypeCode: buyerType
    });

    let query = `
        SELECT
          participant.emailId as emailId,
          registration.id as registrationId,
          participant.ssoUid, 
          registration.fairCode,
          registration.firstName, 
          registration.lastName,
          registration.companyName,
          registration.fairParticipantTypeId,
          registration.addressCountryCode,
          registration.overseasBranchOffice,
          registration.overseasBranchOfficer,
          registration.creationTime as fairRegistrationDateTime,
          registration.cbmRemark
        FROM
        (
          SELECT *
          FROM vepFairDb.fairParticipant AS participant
          WHERE participant.ssoUid is not NULL
        ) AS participant
        INNER JOIN
        (
          SELECT *
          FROM vepFairDb.fairRegistration AS registration
          LEFT JOIN (
            SELECT
              id as frsid,
              fairRegistrationStatusCode
            FROM vepFairDb.fairRegistrationStatus AS fairRegistrationStatus
            ${fairRegistrationStatusFilterString}
          ) fairRegistrationStatus
          ON registration.fairRegistrationStatusId = frsid
            INNER JOIN (
            SELECT 
              id as fptid,
              fairParticipantTypeCode
            FROM vepFairDb.fairParticipantType AS fairParticipantType
            ${fairParticipantTypeFilterString}
          ) fairParticipantType
          ON registration.fairParticipantTypeId = fptid
          ${registrationFilterString}
        ) AS registration
        ON participant.id = registration.fairParticipantId
        ORDER BY fairRegistrationDateTime DESC
    `;

    query = query.split('\n').join('').replace(/  +/g, ' ');
    // return query;
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let result: any[] = [];
    try {
      result = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in filterBuyer api", error)
    } finally {
      slaveRunner.release();
    }

    return this.buyerDataTranslate(result, timeZone);
  }

    public async filterBuyerWithPagination(
      fairCode: string,
      fairYear: string,
      timeZone: string,
      filters: Record<string, string>,
      sortings: Record<string, string> = {},
      paginate: Record<string, number>
    ): Promise<any> {
      const { buyerType, country, branchOffice,
        bmStaff, buyerRegFair: oribuyerRegFair, needBmList
      } = filters;

      const keywords = filters?.keywords;
      const { field, sort } = sortings;
      const { rowsPerPage, pageNum } = paginate;
      let buyerRegFair = oribuyerRegFair;

      const fairCodesArray = await this.fairService.getCombinedFairCodes(fairCode);

      // if the fairCode not exists, return an empty array , representing no buyer in that not exist meetings
      if (!fairCodesArray || fairCodesArray?.status === 400 || fairCodesArray?.fairCodes?.length === 0) {
        return {
          totalRecordNum: 0,
          totalPageNum: 0,
          rowsPerPage,
          pageNum,
          records: []
        };
      }

      // filter out those provided(buyerRegFair) by not in the same combination set of fairs(fairCodesArray)
      buyerRegFair = oribuyerRegFair?.split(',').filter((e:string) => fairCodesArray?.fairCodes?.indexOf(e) !== -1).toString();

      const registrationFilterString = this.buildQueryString('registration', {
        fairCode: buyerRegFair ? buyerRegFair.split(',') : fairCodesArray.fairCodes,
        addressCountryCode: country ? country.split(',') : undefined,
        overseasBranchOffice: branchOffice ? branchOffice.split(',') : undefined,
        projectYear: [fairYear],
      });

      const fairRegistrationStatusFilterString = this.buildQueryString('fairRegistrationStatus', {
        fairRegistrationStatusCode: ['CONFIRMED'],
      });

      const fairParticipantTypeFilterString = this.buildQueryString('fairParticipantType', {
        fairParticipantTypeCode: buyerType ? buyerType.split(',') : undefined
      });

      const bmStaffFilterString = (bmStaffEmailString: string): string => {
        const emailArr = bmStaffEmailString.split(',');
        const emailArrWithQuote = emailArr.map((str: string) => `"${str}"`);
        return ` AND latest.createdBy IN (${emailArrWithQuote}) `;
      };

      const needBmListFilterString = (needBmListWord: string):string => {
        // filter return 1.none 2. Y 3. N, 9Aug:agree to 1. apply trim on Y and N, 2. Y/N only filter Y/N, no others filter, return its origin value;
        if (needBmListWord === 'Y') {
          return ` WHERE formFieldId = 'br_bm_pre_screening' 
          AND TRIM(needBm.value) = 'Y' `;
        }
        if (needBmListWord === 'N') {
          return ` WHERE formFieldId = 'br_bm_pre_screening' 
          AND TRIM(needBm.value) = 'N' `;
        }
          return 'WHERE formFieldId = "br_bm_pre_screening"';
      };

      const getSortString = ():string => {
        // default DESC, sort need = capital ASC or DESC
        // may need sortField map with column name
        // Buyer name/ Buyer type/ Country/ Branch Office  //updateInSourcingInterest //intPublishCompany//bmStaff//overseasOfficer//fairRegDate
        const fieldNameswitcher = (): string => {
          switch (field) {
            case 'buyerName':
              return 'registration.firstName';
            case 'buyerType':
              return 'fairParticipantTypeId';
            case 'country':
              return 'addressCountryCode';
            case 'branchOffice':
              return 'overseasBranchOffice';
            case 'fairVisit':
              return 'trim(buyerFairVisit)';
            case 'needBmList':
              return 'trim(needBmList)';
            case 'lastBmListSent':
              return 'latestSentTime';
            // case 'updateInSourcingInterest':
            //   return ''; external API not support
            case 'intPublishCompany':
              return 'intPublishCount';
            case 'bmStaff':
              return 'adminName';
            case 'overseasOfficer':
              return 'registration.overseasBranchOfficer';
            case 'fairRegDate':
              return 'fairRegistrationDateTime';
            case field:
              return field;
            default:
              return '';
          }
        };
        const order = sort ?? 'DESC';
        const pickedField = field ? fieldNameswitcher() : 'fairRegistrationDateTime';
        return `ORDER BY ${pickedField} ${order}`;
      };

      const getPageSize = ():string => `LIMIT ${rowsPerPage} OFFSET ${(pageNum - 1) * rowsPerPage}`;

      // keywords: buyer name, buyer company, only for keyword is fully english(vt-4029)
      const keywordString = this.checkInputIsAllEnglish(keywords) ? this.fullTextSearchStringGenerator(
        ['registration.firstName', 'registration.lastName', 'registration.displayName', 'registration.companyName'], keywords
        ) : this.likeTextSearchStringGenerator(['registration.firstName', 'registration.lastName', 'registration.displayName', 'registration.companyName', 'emailId'], keywords);

      const columnString = `
      participant.emailId as emailId,
      registration.id as registrationId,
      participant.ssoUid, 
      registration.fiscalYear as fiscalYear,
      registration.fairCode,
      registration.firstName, 
      registration.lastName,
      registration.companyName,
      registration.fairParticipantTypeId,
      registration.addressCountryCode,
      registration.overseasBranchOffice,
      registration.overseasBranchOfficer,
      registration.creationTime as fairRegistrationDateTime,
      registration.cbmRemark,
      recommendItem.totalCompaniesCount,
      recommendItem.totalInterestCompaniesCount,
      recommendItem.intCompaniesCount,
      recommendItem.extCompaniesCount,
      recommendItem.intPublishCount,
      recommendItem.extPublishCount,
      recommendItem.extPendingCount,
      recommendItem.extInterestCount,
      recommendItem.extRejectCount,
      recommendItem.arrangedMeetingCount,
      recommendItem.plantedMeetingCount,
      recommendItem.toAddMeetingCount,
      latest.latestSentTime,
      latest.latestCreatedBy,
      adminName,
      buyerFairVisit,
      needBmList
      `;

      const countString = 'COUNT(*) as count';

      let query = (type: 'count' | 'data'):string => `
          SELECT
            ${type === 'count' ? countString : columnString}
          FROM
          (
            SELECT *
            FROM vepFairDb.fairParticipant AS participant
            WHERE participant.ssoUid is not NULL
          ) AS participant
          INNER JOIN
          (
            SELECT *
            FROM vepFairDb.fairRegistration AS registration
            LEFT JOIN (
              SELECT
                id as frsid,
                fairRegistrationStatusCode
              FROM vepFairDb.fairRegistrationStatus AS fairRegistrationStatus
              ${fairRegistrationStatusFilterString}
            ) fairRegistrationStatus
            ON registration.fairRegistrationStatusId = frsid
              INNER JOIN (
              SELECT 
                id as fptid,
                fairParticipantTypeCode
              FROM vepFairDb.fairParticipantType AS fairParticipantType
              ${fairParticipantTypeFilterString}
            ) fairParticipantType
            ON registration.fairParticipantTypeId = fptid
            ${registrationFilterString}
          ) AS registration
          ON participant.id = registration.fairParticipantId
          LEFT JOIN (
            SELECT
              recommendSsoUid,
              recommendFairCode, 
              recommendFairYear,
              recommendPublishType,
              COUNT(DISTINCT targetId) as totalCompaniesCount,
              COUNT(DISTINCT (CASE WHEN interestedStatus = 1 THEN targetId END)) as totalInterestCompaniesCount,
              COUNT(DISTINCT (CASE WHEN recommendPublishType = 'internal' AND interestedStatus = 1 THEN targetId END)) as intCompaniesCount,
              COUNT(DISTINCT (CASE WHEN recommendPublishType = 'external' AND interestedStatus = 1 THEN targetId END)) as extCompaniesCount,
              COUNT(CASE WHEN recommendPublishType = 'internal' THEN 1 ELSE null END) as intPublishCount,
              COUNT(CASE WHEN recommendPublishType = 'external' THEN 1 ELSE null END) as extPublishCount,
              COUNT(CASE WHEN recommendPublishType = 'external' AND interestedStatus = 0 THEN 1 ELSE null END) as extPendingCount,
              COUNT(CASE WHEN recommendPublishType = 'external' AND interestedStatus = 1 THEN 1 ELSE null END) as extInterestCount,
              COUNT(CASE WHEN recommendPublishType = 'external' AND interestedStatus = 2 THEN 1 ELSE null END) as extRejectCount,
              COUNT(CASE WHEN recommendPublishType = 'external' AND recommendItem.meetingId IS NOT NULL THEN 1 ELSE null END) as arrangedMeetingCount,
              COUNT(CASE WHEN recommendPublishType = 'internal' AND recommendItem.meetingId IS NOT NULL THEN 1 ELSE null END) as plantedMeetingCount,
              COUNT(CASE WHEN interestedStatus = 1 AND recommendItem.meetingId IS NULL THEN 1 ELSE null END) as toAddMeetingCount
            FROM
            vep_c2m_service_db.vepC2MBMRecommendationItem AS recommendItem
            LEFT JOIN (
              SELECT
                id as recommendId,
                ssoUid as recommendSsoUid,
                fairCode as recommendFairCode, 
                fairYear as recommendFairYear,
                publishType as recommendPublishType
              FROM
                vep_c2m_service_db.vepC2MBMRecommendation AS recommend
            ) recommend ON recommendId = recommendItem.recommendationId
            WHERE recommendSsoUid IS NOT NULL
            GROUP BY recommendSsoUid, recommendFairCode, recommendFairYear
          ) recommendItem ON recommendSsoUid = participant.ssoUid AND recommendFairCode = registration.fairCode AND recommendFairYear = registration.fiscalYear
          ${bmStaff ? 'INNER JOIN' : 'LEFT JOIN'} (
            SELECT
              latest.ssouid as latestSsoUid, 
              latest.fairCode as latestFairCode, 
              latest.fairYear as latestFairYear, 
              latest.sentTime as latestSentTime, 
              latest.createdBy as latestCreatedBy,
              adminUser.name as adminName
            FROM
              vep_c2m_service_db.vepC2MBMRecommendation latest
              LEFT JOIN vep_c2m_service_db.vepC2MBMRecommendation latest2 ON (
                (
                  latest.ssouid = latest2.ssouid AND 
                  latest.fairCode = latest2.fairCode AND 
                  latest.fairYear = latest2.fairYear AND 
                  latest.sentTime < latest2.sentTime
                )
              )
            LEFT JOIN vep_admin.user adminUser on adminUser.email = latest.createdBy
            WHERE latest2.id IS NULL ${bmStaff ? bmStaffFilterString(bmStaff) : ' '}
            GROUP BY latest.ssouid , latest.fairCode , latest.fairYear
          ) latest ON latestSsoUid = participant.ssoUid AND latestFairCode = registration.fairCode AND latestFairYear = registration.fiscalYear
          LEFT JOIN (
            SELECT
            fairRegistrationId as fairVisitRegId,
            trim(value) as buyerFairVisit
            FROM
            vepFairDb.fairRegistrationDynamicBM as fairVisit
            WHERE
            formFieldId = 'br_bm_fair_visit'
            )  fairVisit ON fairVisitRegId = registration.id
          ${needBmList === 'none' ? 'LEFT JOIN' : 'INNER JOIN'} (
            SELECT
            fairRegistrationId as needBmRegId,
            trim(value) as needBmList
            FROM
            vepFairDb.fairRegistrationDynamicBM as needBm
            ${needBmListFilterString(needBmList)}
            )  needBm ON needBmRegId = registration.id
          ${keywords ? keywordString : ''}
          ${type === 'count' ? '' : getSortString()}
          ${type === 'count' ? '' : getPageSize()}
      `;

      const dataQuery = query('data').split('\n').join('').replace(/  +/g, ' ');
      const countQuery = query('count').split('\n').join('').replace(/  +/g, ' ');
            console.log('qq', dataQuery);

      const connection = await getConnection('contentDatabase');
      const slaveRunner = connection.createQueryRunner('slave');
      let dataResult: any[] = [];
      let countResult: any[] = [];
      try {
        dataResult = await connection.query(dataQuery, undefined, slaveRunner);
        countResult = await connection.query(countQuery, undefined, slaveRunner);
      } catch (error) {
        console.log("Error in filterBuyerWithPagination api", error)
      } finally {
        slaveRunner.release();
      }

      return {
        totalRecordNum: parseInt(countResult[0].count, 10),
        totalPageNum: Math.ceil(parseInt(countResult[0].count, 10) / rowsPerPage),
        rowsPerPage,
        pageNum,
        records: await this.buyerDataTranslate(dataResult, timeZone),
    };
    }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private toSQLArraySting<T>(array: Array<T>): string {
    if (!array?.length) {
      return '';
    }
    return `'${array.join("','")}'`;
  }

  private buildQueryString(alias: string | null = null, fields: Record<string, Array<any> | undefined>): string {
    let first = true;
    let result = '';
    Object.keys(fields).forEach((key: string) => {
      if (fields[key]?.length) {
        if (first) {
          first = false;
          result += ` WHERE ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(fields[key] || [])})`;
        } else {
          result += ` AND ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(fields[key] || [])})`;
        }
      }
    });
    return result;
  }

  private async buyerDataTranslate(buyerArray: any[], timeZone: string): Promise<any[]> {
    return Promise.all(buyerArray.flatMap(async (buyer: any) => ({
      registrationId: parseInt(buyer.registrationId || '', 10),
      fiscalYear: buyer.fiscalYear,
      ssoUid: buyer.ssoUid,
      emailId: buyer.emailId,
      fairCode: buyer.fairCode,
      companyName: buyer.companyName,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      buyerType: buyer.fairParticipantTypeId,
      country: buyer.addressCountryCode,
      branchOffice: buyer.overseasBranchOffice,
      fairVisit2: this.spaceTrim(buyer.buyerFairVisit),
      fairVisit: buyer.buyerFairVisit,
      /// /
      needBmList2: this.spaceTrim(buyer.needBmList), // asking man to answer, fairRegBmDynamic
      needBmList: buyer.needBmList,
      lastBmListSent: buyer.latestSentTime,
      updateInSourcingInterest: await this.contentService.getProductInterestHistory(buyer.ssoUid, buyer.fairCode, buyer.fiscalYear),
      toAddMeeting: buyer.toAddMeetingCount ?? 0,
      arrangedMeeting: buyer.arrangedMeetingCount ?? 0,
      plantedMeeting: buyer.plantedMeetingCount ?? 0,
      intPublishCompany: buyer.intPublishCount ?? 0,
      extrecommendCompany: buyer.extPublishCount ?? 0,
      interestReplyExt: buyer.extInterestCount ?? 0,
      noInterestExt: buyer.extRejectCount ?? 0,
      noResponseExt: buyer.extPendingCount ?? 0,
      bmStaff: buyer.adminName,
      overseasOfficer: buyer.overseasBranchOfficer,
      remarks: buyer.cbmRemark,
      fairRegDate: moment(buyer.fairRegistrationDateTime).tz(timeZone),
    })));
  }

  private spaceTrim(str: string | undefined | null): string {
    if (typeof str === 'string') {
      return str.trim();
    }
      return 'N';
  }

  private checkInputIsAllEnglish(str:string): boolean {
    // eslint-disable-next-line no-control-regex
    if (/^[\u0000-\u007f]*$/.test(str)) {
      if (/^(([^<>()\[\]\\.,;:\s@\"]+(\.[^<>()\[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(str)) {
        return (false);
      }
      return true;
    }
    return false;
  }

  private fullTextSearchStringGenerator(strArr: string[], keywords:string): string {
    let resQuery = <string>'WHERE ';
    for (let i = 0; i < strArr.length; i++) {
          resQuery += `MATCH (
            ${strArr[i]}
          ) AGAINST ('${keywords}' IN BOOLEAN MODE) ${i === strArr.length - 1 ? '' : 'OR '}`;
    }
     return resQuery;
  }

  private likeTextSearchStringGenerator(strArr: string[], keywords:string): string {
    let resQuery = <string>'WHERE ';
    for (let i = 0; i < strArr.length; i++) {
          resQuery += `${strArr[i]} LIKE "${keywords}%" ${i === strArr.length - 1 ? '' : 'OR '}`;
    }
     return resQuery;
  }
}
