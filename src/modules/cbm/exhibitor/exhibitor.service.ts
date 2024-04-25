/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/member-ordering */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isArray } from 'class-validator';
import moment from 'moment-timezone';
import { getConnection, Repository } from 'typeorm';
import { constant } from '../../../config/constant';
import { ApiExhibitorService } from '../../api/exhibitor/exhibitor.service';
import { ApiFairService } from '../../api/fair/fair.service';
import { MeetingService } from '../../c2m/meeting/meeting.service';
import { MeetingStatus } from '../../c2m/meeting/meeting.type';
import { VepExhibitorAttributes as ExhibitorAttributes } from '../../content/exhibitor/entities/VepExhibitorAttributes';
import { SortingOption } from '../cbm.type';

@Injectable()
export class ExhibitorService {
  constructor(
    @InjectRepository(ExhibitorAttributes, 'exhibitorDatabase')
    private exhibitorAttrRepository: Repository<ExhibitorAttributes>,
    private fairService: ApiFairService,
    private meetingService: MeetingService,
    private apiExhibitorService: ApiExhibitorService
  ) {}

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private toSQLArraySting<T>(array: Array<T>): string {
    if (!array?.length) {
      return '';
    }
    return `'${array.join("','")}'`;
  }

  private formatSqlStringArray(array: any[]): string[] {
    return array?.map((word: string) => `'${word}'`) || [];
  }

  private buildQueryString(alias: string | null = null, fields: Record<string, Array<any>>): string {
    let first = true;
    let result = '';
    Object.keys(fields).forEach((key: string) => {
      if (fields[key]?.length) {
        if (first) {
          first = false;
          result += ` WHERE ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(fields[key])})`;
        } else {
          result += ` AND ${alias ? `${alias}.` : ''}${key} IN (${this.toSQLArraySting(fields[key])})`;
        }
      }
    });
    return result;
  }

  public async getPavilion(): Promise<any> {
    return this.exhibitorAttrRepository
      .createQueryBuilder('attribute')
      .andWhere('attribute.locale = :locale', { locale: 'en' })
      .andWhere('attribute.attribute = :attribute', { attribute: 'pavilion' })
      .groupBy('value')
      .getMany();
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async filterExhibitor(fairCode: string, fairYear: string, filters: Record<string, any>, sortings: Record<string, SortingOption> = {}): Promise<any> {
    const { exhibitorType, country, preferredMarket, notPreferredMarket, preferredNob, exhibitorParticipatingFair, pavilion, zone, companyCcdId, emailId } = filters;
    // get combined fair
    // To-do: fair Year not working
    const eoaFairDict = await this.computeExhibitorEoaFair(fairCode, exhibitorParticipatingFair);
    const eoaFairIds = Object.keys(eoaFairDict);
    // return eoaFairDict;
    if (!eoaFairIds.length) {
      throw Error(`Invalid Fair Code: ${fairCode}`);
    }
    const queryPrefix = 'SELECT * FROM vepExhibitorDb.vepExhibitor exhibitor';

    // for each filter, subquery to group by fair & companyCcdId and filter option
    const productListString = `LEFT JOIN (
      SELECT product.companyCcdId AS productCcdId, product.eoaFairId as productEoaFairId, GROUP_CONCAT(DISTINCT product.value) as productRange
      FROM vepExhibitorDb.vepExhibitorAttributes product
      WHERE product.attribute = 'productOrServiceRanges' AND product.locale = 'en' AND product.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY productCcdId, productEoaFairId
    ) product ON exhibitor.companyCcdId = productCcdId AND exhibitor.eoaFairId = productEoaFairId`;

    const nobString = `LEFT JOIN (
      SELECT nob.companyCcdId AS nobCcdId, nob.eoaFairId as nobEoaFairId, GROUP_CONCAT(DISTINCT nob.value) as nobRange
      FROM vepExhibitorDb.vepExhibitorAttributes nob
      WHERE nob.attribute = 'nob' AND nob.locale = 'en' AND nob.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY nobCcdId, nobEoaFairId
    ) nob ON exhibitor.companyCcdId = nobCcdId AND exhibitor.eoaFairId = nobEoaFairId`;

    const pavilionString = `${pavilion?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT pavilion.companyCcdId AS pavilionCcdId, pavilion.eoaFairId as pavilionEoaFairId, GROUP_CONCAT(DISTINCT pavilion.value) as pavilion
      FROM vepExhibitorDb.vepExhibitorAttributes pavilion
      WHERE pavilion.attribute = 'pavilion' AND pavilion.locale = 'en' AND pavilion.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY pavilionCcdId, pavilionEoaFairId
      ${pavilion?.length ? `HAVING SUM( pavilion.value IN (${this.toSQLArraySting(pavilion)})) > 0` : ''}
    ) pavilion ON exhibitor.companyCcdId = pavilionCcdId AND exhibitor.eoaFairId = pavilionEoaFairId`;

    const zoneString = `${zone?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT zone.companyCcdId AS zoneCcdId, zone.eoaFairId as zoneEoaFairId, GROUP_CONCAT(DISTINCT zone.value) as zone
      FROM vepExhibitorDb.vepExhibitorAttributes zone
      WHERE zone.attribute = 'productZone' AND zone.locale = 'en' AND zone.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY zoneCcdId, zoneEoaFairId
      ${zone?.length ? `HAVING SUM( zone.value IN (${this.toSQLArraySting(zone)})) > 0` : ''}
    ) zone ON exhibitor.companyCcdId = zoneCcdId AND exhibitor.eoaFairId = zoneEoaFairId`;

    const preferredMarketString = `${preferredMarket?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT pmaCode, pmaAnswer, pmq.companyCcdId AS pmqCcdId, pmq.eoaFairId as pmqEoaFairId, GROUP_CONCAT(DISTINCT pmaAnswer) as preferredMarket
      FROM vepExhibitorDb.vepExhibitorC2mQuestions pmq
      INNER JOIN (
        SELECT pma.vepExhibitorQuestionId AS pmaQid, pma.code AS pmaCode, pma.answer AS pmaAnswer
        FROM vepExhibitorDb.vepExhibitorC2mAnswers pma
      ) pma ON pmq.id = pmaQid
      WHERE pmq.locale = 'en' AND pmq.type = 'targetMarkets' AND pmq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY pmqCcdId, pmqEoaFairId
      ${preferredMarket?.length ? `HAVING SUM( pmaAnswer IN (${this.toSQLArraySting(preferredMarket)})) > 0` : ''}
    ) pmq ON exhibitor.companyCcdId = pmqCcdId AND exhibitor.eoaFairId = pmqEoaFairId`;

    const notPreferredMarketString = `${notPreferredMarket?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT npmaCode, npmaAnswer, npmq.companyCcdId AS npmqCcdId, npmq.eoaFairId AS npmqEoaFairId, GROUP_CONCAT(DISTINCT npmaAnswer) as notPreferredMarket
      FROM vepExhibitorDb.vepExhibitorC2mQuestions npmq
      INNER JOIN (
        SELECT npma.vepExhibitorQuestionId AS npmaQid, npma.code AS npmaCode, npma.answer AS npmaAnswer
        FROM vepExhibitorDb.vepExhibitorC2mAnswers npma
      ) npma ON npmq.id = npmaQid
      WHERE npmq.locale = 'en' AND npmq.type = 'nonTargetMarkets' AND npmq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY npmqCcdId, npmqEoaFairId
      ${notPreferredMarket?.length ? `HAVING SUM( npmaAnswer IN (${this.toSQLArraySting(notPreferredMarket)})) > 0` : ''}
    ) npmq ON exhibitor.companyCcdId = npmqCcdId AND exhibitor.eoaFairId = npmqEoaFairId`;

    const preferredNobString = `${preferredNob?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT pnaCode, pnaAnswer, pnq.companyCcdId AS pnqCcdId, pnq.eoaFairId AS pnqEoaFairId, GROUP_CONCAT(DISTINCT pnaAnswer) as preferredNob
      FROM vepExhibitorDb.vepExhibitorC2mQuestions pnq
      INNER JOIN (
        SELECT pna.vepExhibitorQuestionId AS pnaQid, pna.code AS pnaCode, pna.answer AS pnaAnswer
        FROM vepExhibitorDb.vepExhibitorC2mAnswers pna
      ) pna ON pnq.id = pnaQid
      WHERE pnq.locale = 'en' AND pnq.type = 'preferredNOB' AND pnq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY pnqCcdId, pnqEoaFairId
      ${preferredNob?.length ? `HAVING SUM(pnaAnswer IN (${this.toSQLArraySting(preferredNob)})) > 0` : ''}
    ) pnq ON exhibitor.companyCcdId = pnqCcdId AND exhibitor.eoaFairId = pnqEoaFairId`;

    const groupByString = 'GROUP BY exhibitor.companyCcdId, exhibitor.eoaFairId';

    let exhibitorString = this.buildQueryString('exhibitor', {
      companyCcdId,
      contactEmail: emailId,
      country,
      eoaFairId: eoaFairIds,
      vepType: exhibitorType,
      active: ['1'],
      c2mParticipantStatusId: ['1', '2', '3'],
    });

    let query = `${queryPrefix}
    ${pavilionString}
    ${zoneString}
    ${preferredMarketString}
    ${notPreferredMarketString}
    ${preferredNobString}
    ${productListString}
    ${nobString}
    ${exhibitorString}
    ${groupByString}`;

    query = query.split('\n').join('').replace(/  +/g, ' ');
    // return query;
    const connection = await getConnection('exhibitorDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let result: any;
    try {
      result = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in filterExhibitor api", error);
    } finally {
      slaveRunner.release();
    }

    // return result;
    const exhibitorIds: any[] = result.map((row: any) => row.companyCcdId);
    const esPromise = this.apiExhibitorService.filterExhibitorByES({
      fairCode,
      from: 0,
      size: exhibitorIds.length,
      filterRecommendedCCDID: exhibitorIds,
    });

    let acceptedMeetingByIds: Record<string, any> = {};
    if (exhibitorIds?.length) {
      acceptedMeetingByIds = await this.meetingService.countAcceptedMeetingByIds(this.formatSqlStringArray(exhibitorIds));
      acceptedMeetingByIds.forEach((row: any) => {
        acceptedMeetingByIds[row.id] = row.count;
      });
    }

    let esDict: Record<string, any> = {};
    const { data: esRes } = await Promise.resolve(esPromise);
    const { hits: esResult } = esRes?.data;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    <Array<any>>esResult?.forEach((element: any) => {
      esDict[element?.ccdid] = {
        supplierUrn: element?.supplierUrn,
        exhibitorUrn: element?.exhibitorUrn,
        companyLogo: element?.supplierLogo,
        boothNumber: element?.boothNumbers[0],
      };
    });

    return result.map((row: any) => ({
      companyCcdId: row.companyCcdId,
      companyName: row.companyName,
      country: row.country,
      exhibitorType: row.vepType,
      salutation: row.salutation,
      fullName: row.contactName,
      firstName: row.contactName?.split(' ')[0] || '',
      lastName: row.contactName?.split(' ')[1] || '',
      acceptedMeeting: acceptedMeetingByIds[row.companyCcdId] || 0,
      productList: row.productRange?.split(',') || null, // empty at the moment
      description: row.exhibitDescription,
      preferredMarket: row.preferredMarket?.split(',') || null,
      notPreferredMarket: row.notPreferredMarket?.split(',') || null,
      preferredNob: row.preferredNob?.split(',') || null,
      nob: row.nobRange?.split(',') || null,
      exhibitorFairCode: eoaFairDict[row.eoaFairId]?.fairCode || '',
      exhibitorFair: eoaFairDict[row.eoaFairId]?.fairShortName || '',
      supplierUrn: esDict[row.companyCcdId]?.supplierUrn || null,
      exhibitorUrn: esDict[row.companyCcdId]?.exhibitorUrn || null,
      companyLogo: esDict[row.companyCcdId]?.companyLogo || null,
      boothNumber: esDict[row.companyCcdId]?.boothNumber || null,
      pavilion: row.pavilion?.split(',') || null,
      zone: row.zone?.split(',') || null,
    }));
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async filterExhibitorWithPagination(
    fairCode: string,
    filters: Record<string, any>,
    sortings: { field: string; sort: string },
    paginate: Record<string, number>,
    buyerProfile: { ssoUid: string, fairCode: string, fiscalYear: string }
  ): Promise<any> {
    const {
      exhibitorParticipatingFair,
      exhibitorType,
      pavilion,
      country,
      zone,
      eTargetMarket,
      ePreferredNob,
      eCurrentExportMarket,
      eAvoidMarket,
      nob,
      productStrategy,
      factoryLocation,
      companyCcdId, // extra
      emailId, // extra
    } = filters;
    const { field, sort } = sortings;
    const { rowsPerPage, pageNum } = paginate;
    const keywords = filters?.keyword;
    const currentTime = moment().format();

    const eoaFairDict = await this.computeExhibitorEoaFair(fairCode, exhibitorParticipatingFair);
    const eoaFairIds = Object.keys(eoaFairDict);
    // return eoaFairDict;
    if (!eoaFairIds.length) {
      throw Error(`Invalid Fair Code: ${fairCode}`);
    }

    const keywordString = this.checkInputIsAllEnglish(keywords) ? this.fullTextSearchStringGenerator(keywords) : this.likeTextSearchStringGenerator(keywords);

    const getSortString = (): string => {
      // default DESC, sort need = capital ASC or DESC
      // may need sortField map with column name
      const fieldNameswitcher = (): string => {
        switch (field) {
          case 'exhibitorCompanyName':
            return 'companyName';
          case 'exhibitorType':
            return 'veptype';
          case 'numsOfAcceptedMeeting':
            return 'acceptedMeeting';
          case 'productList':
            return 'productRange';
          case 'description':
            return 'exhibitDescription';
          case 'nob':
            return 'nobRange';
          case 'eTargetMarket':
            return 'preferredMarket';
          case 'ePreferredNob':
            return 'preferredNob';
          case 'eAvoidMarket':
            return 'notPreferredMarket';
          case 'exhibitorFair':
            return 'eoaFairId';
          case 'brand':
            return 'brandName';
          case 'productStrategy':
            return 'strategy';
          case 'exhibitorName':
            return 'contactName';
          case 'exhRegDate':
            return 'creationTime';
          case 'bmStatus':
            return 'bmResponse';
          case 'duplicate':
            return 'bmResponse';
          case field:
            return field;
          default:
            return '';
        }
      };

      const order = sort ?? 'DESC';
      const pickedField = field ? `${fieldNameswitcher()} ${order}` : "date_format(exhibitor.creationTime, '%Y-%m-%d') desc, exhibitor.companyName asc";
      return `ORDER BY ${pickedField}`;
    };

    const getPageSize = (): string => `LIMIT ${rowsPerPage} OFFSET ${(pageNum - 1) * rowsPerPage}`;
    const queryPrefix = 'SELECT * FROM vepExhibitorDb.vepExhibitor exhibitor';
    const countPrefix = 'SELECT COUNT(*) over () as count FROM vepExhibitorDb.vepExhibitor exhibitor';

    // for each filter, subquery to group by fair & companyCcdId and filter option
    const brandNameString = `LEFT JOIN (
      SELECT brandNameT.companyCcdId AS brandNameTCcdId, brandNameT.eoaFairId as brandNameTEoaFairId, GROUP_CONCAT(DISTINCT brandNameT.value ORDER BY brandNameT.value ASC) as brandName
      FROM vepExhibitorDb.vepExhibitorAttributes brandNameT
      WHERE brandNameT.attribute = 'brandName' AND brandNameT.locale = 'global' AND brandNameT.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY brandNameTCcdId, brandNameTEoaFairId
    ) brandNameT ON exhibitor.companyCcdId = brandNameTCcdId AND exhibitor.eoaFairId = brandNameTEoaFairId`;

    const productListString = `LEFT JOIN (
      SELECT product.companyCcdId AS productCcdId, product.eoaFairId as productEoaFairId, GROUP_CONCAT(DISTINCT product.value ORDER BY product.value ASC) as productRange
      FROM vepExhibitorDb.vepExhibitorAttributes product
      WHERE product.attribute = 'productOrServiceRanges' AND product.locale = 'en' AND product.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY productCcdId, productEoaFairId
    ) product ON exhibitor.companyCcdId = productCcdId AND exhibitor.eoaFairId = productEoaFairId`;

    const nobString = `${nob?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT nob.companyCcdId AS nobCcdId, nob.eoaFairId as nobEoaFairId, GROUP_CONCAT(DISTINCT nob.value ORDER BY nob.value ASC) as nobRange
      FROM vepExhibitorDb.vepExhibitorAttributes nob
      WHERE nob.attribute = 'nob' AND nob.locale = 'en' AND nob.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY nobCcdId, nobEoaFairId
      ${nob?.length ? `HAVING SUM( nob.value IN (${this.toSQLArraySting(nob.split(','))})) > 0` : ''}
    ) nob ON exhibitor.companyCcdId = nobCcdId AND exhibitor.eoaFairId = nobEoaFairId`;

    const pavilionString = `${pavilion?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT pavilion.companyCcdId AS pavilionCcdId, pavilion.eoaFairId as pavilionEoaFairId, GROUP_CONCAT(DISTINCT pavilion.value ORDER BY pavilion.value ASC) as pavilion
      FROM vepExhibitorDb.vepExhibitorAttributes pavilion
      WHERE pavilion.attribute = 'pavilion' AND pavilion.locale = 'en' AND pavilion.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)}) 
      GROUP BY pavilionCcdId, pavilionEoaFairId
      ${pavilion?.length ? `HAVING SUM( pavilion.value IN (${this.toSQLArraySting(pavilion.split(','))})) > 0` : ''}
    ) pavilion ON exhibitor.companyCcdId = pavilionCcdId AND exhibitor.eoaFairId = pavilionEoaFairId`;

    const zoneString = `${zone?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT zone.companyCcdId AS zoneCcdId, zone.eoaFairId as zoneEoaFairId, GROUP_CONCAT(DISTINCT zone.value ORDER BY zone.value ASC) as zone
      FROM vepExhibitorDb.vepExhibitorAttributes zone
      WHERE zone.attribute = 'productZone' AND zone.locale = 'en' AND zone.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY zoneCcdId, zoneEoaFairId
      ${zone?.length ? `HAVING SUM( zone.value IN (${this.toSQLArraySting(zone.split(','))})) > 0` : ''}
    ) zone ON exhibitor.companyCcdId = zoneCcdId AND exhibitor.eoaFairId = zoneEoaFairId`;

    const exhibitorMarketPreferenceString = `
    LEFT JOIN (
      SELECT 
        eQueCcdId AS empvCcdId,
        eQueEoaFairId AS empvEoaFairId,
        eCurrentExportMarkets,
        eTargetMarkets AS preferredMarket,
        eAvoidMarkets AS notPreferredMarket,
        eNob AS preferredNob
      FROM vepExhibitorDb.exhibitorMarketPreference_view empv
      WHERE empv.eQueEoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
    ) empv ON exhibitor.companyCcdId = empvCcdId AND exhibitor.eoaFairId = empvEoaFairId`;  

    // const preferredMarketString = `${eTargetMarket?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
    //   SELECT pmaCode, pmaAnswer, pmq.companyCcdId AS pmqCcdId, pmq.eoaFairId as pmqEoaFairId, GROUP_CONCAT(DISTINCT pmaAnswer ORDER BY pmaAnswer ASC) as preferredMarket
    //   FROM vepExhibitorDb.vepExhibitorC2mQuestions pmq
    //   INNER JOIN (
    //     SELECT pma.vepExhibitorQuestionId AS pmaQid, pma.code AS pmaCode, pma.answer AS pmaAnswer
    //     FROM vepExhibitorDb.vepExhibitorC2mAnswers pma
    //   ) pma ON pmq.id = pmaQid
    //   WHERE pmq.locale = 'en' AND pmq.type = 'targetMarkets' AND pmq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
    //   GROUP BY pmqCcdId, pmqEoaFairId
    //   ${eTargetMarket?.length ? `HAVING SUM( pmaAnswer IN (${this.toSQLArraySting(eTargetMarket.split(','))})) > 0` : ''}
    // ) pmq ON exhibitor.companyCcdId = pmqCcdId AND exhibitor.eoaFairId = pmqEoaFairId`;

    // const notPreferredMarketString = `${eAvoidMarket?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
    //   SELECT npmaCode, npmaAnswer, npmq.companyCcdId AS npmqCcdId, npmq.eoaFairId AS npmqEoaFairId, GROUP_CONCAT(DISTINCT npmaAnswer ORDER BY npmaAnswer ASC) as notPreferredMarket
    //   FROM vepExhibitorDb.vepExhibitorC2mQuestions npmq
    //   INNER JOIN (
    //     SELECT npma.vepExhibitorQuestionId AS npmaQid, npma.code AS npmaCode, npma.answer AS npmaAnswer
    //     FROM vepExhibitorDb.vepExhibitorC2mAnswers npma
    //   ) npma ON npmq.id = npmaQid
    //   WHERE npmq.locale = 'en' AND npmq.type = 'nonTargetMarkets' AND npmq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
    //   GROUP BY npmqCcdId, npmqEoaFairId
    //   ${eAvoidMarket?.length ? `HAVING SUM( npmaAnswer IN (${this.toSQLArraySting(eAvoidMarket.split(','))})) > 0` : ''}
    // ) npmq ON exhibitor.companyCcdId = npmqCcdId AND exhibitor.eoaFairId = npmqEoaFairId`;

    // const preferredNobString = `${ePreferredNob?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
    //   SELECT pnaCode, pnaAnswer, pnq.companyCcdId AS pnqCcdId, pnq.eoaFairId AS pnqEoaFairId, GROUP_CONCAT(DISTINCT pnaAnswer ORDER BY pnaAnswer ASC) as preferredNob
    //   FROM vepExhibitorDb.vepExhibitorC2mQuestions pnq
    //   INNER JOIN (
    //     SELECT pna.vepExhibitorQuestionId AS pnaQid, pna.code AS pnaCode, pna.answer AS pnaAnswer
    //     FROM vepExhibitorDb.vepExhibitorC2mAnswers pna
    //   ) pna ON pnq.id = pnaQid
    //   WHERE pnq.locale = 'en' AND pnq.type = 'preferredNOB' AND pnq.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
    //   GROUP BY pnqCcdId, pnqEoaFairId
    //   ${ePreferredNob?.length ? `HAVING SUM(pnaAnswer IN (${this.toSQLArraySting(ePreferredNob.split(','))})) > 0` : ''}
    // ) pnq ON exhibitor.companyCcdId = pnqCcdId AND exhibitor.eoaFairId = pnqEoaFairId`;

    const productStrategyString = `${productStrategy?.length ? 'INNER JOIN' : 'LEFT JOIN'} (
      SELECT productStrategy.companyCcdId AS productStrategyCcdId, productStrategy.eoaFairId as productStrategyEoaFairId, GROUP_CONCAT(DISTINCT productStrategy.value ORDER BY productStrategy.value ASC) as strategy
      FROM vepExhibitorDb.vepExhibitorAttributes productStrategy
      WHERE productStrategy.attribute = 'strategy' AND productStrategy.locale = 'en' AND productStrategy.eoaFairId IN (${this.toSQLArraySting(eoaFairIds)})
      GROUP BY productStrategyCcdId, productStrategyEoaFairId
      ${productStrategy?.length ? `HAVING SUM( productStrategy.value IN (${this.toSQLArraySting(productStrategy.split(','))})) > 0` : ''}
    ) productStrategy ON exhibitor.companyCcdId = productStrategyCcdId AND exhibitor.eoaFairId = productStrategyEoaFairId`;

    // const currentExportMarketsString = `LEFT JOIN (
    //   SELECT currentExportMarkets.id AS cemQid, currentExportMarkets.companyCcdId AS cemQCcdId, currentExportMarkets.eoaFairId AS cemQEoaFairId, eCurrentExportMarkets
    //   FROM vepExhibitorDb.vepExhibitorC2mQuestions AS currentExportMarkets
    //   LEFT JOIN (
    //     SELECT eCEMAns.id as cemAid, eCEMAns.vepExhibitorQuestionId as cemAnsQuestId, eCEMAns.answer as cemAns, eCEMAns.code as cemAnsCode, GROUP_CONCAT(DISTINCT eCEMAns.answer ORDER BY eCEMAns.code ) as eCurrentExportMarkets
    //     FROM vepExhibitorDb.vepExhibitorC2mAnswers AS eCEMAns
    //     GROUP BY cemAnsQuestId
    //   ) eCEMAns ON cemAnsQuestId = currentExportMarkets.id 
    //   WHERE currentExportMarkets.locale = 'en' AND currentExportMarkets.type = 'currentExportMarkets' AND cemAns IS NOT NULL
    // ) currentExportMarkets ON exhibitor.companyCcdId = cemQCcdId AND exhibitor.eoaFairId = cemQEoaFairId`;

    const fairCodeString = `LEFT JOIN (
      SELECT eoa.fairCode, eoa.meta_value as eoaFairIdValue
      FROM vep_content.vep_fair_setting AS eoa
      WHERE meta_key = 'eoa_fair_id'
    ) eoa ON exhibitor.eoaFairId = eoaFairIdValue`;

    const countAcceptedMeetingString = `LEFT JOIN (
      SELECT ccdId, COUNT(ccdId) AS acceptedMeeting
      FROM (
        SELECT requesterSsoUid AS ccdId, status, endTime
        FROM vep_c2m_service_db.vepC2MMeeting AS meeting 
        UNION ALL SELECT responderSsoUid AS ccdId, status, endTime
        FROM vep_c2m_service_db.vepC2MMeeting AS meeting
      ) AS unionMeeting
      WHERE ((unionMeeting.status = ${MeetingStatus.ACCEPTED}) AND (endTime > '${currentTime}'))
      GROUP BY ccdId
      ) unionMeeting ON companyCcdId = unionMeeting.ccdId`;

    const bmResponseString = (buyerProfile.ssoUid && buyerProfile.fairCode && buyerProfile.fiscalYear) ? `LEFT JOIN (
      SELECT
        recommendationItem.targetId as rItemCcdId,
        recommendationItem.fairCode as rItemFairCode, 
        recommendationItem.fiscalYear as rItemFiscalYear,
        CASE 
			    WHEN recommendationItem.interestedStatus = 0 AND publishType = 'external' THEN 0 
			    WHEN recommendationItem.interestedStatus = 1 AND publishType = 'external' THEN 1 
			    WHEN recommendationItem.interestedStatus = 2 AND publishType = 'external' THEN 2 
          WHEN recommendationItem.interestedStatus = 1 AND publishType = 'internal' THEN 3 END as bmResponse
      FROM vep_c2m_service_db.vepC2MBMRecommendationItem AS recommendationItem
      LEFT JOIN vep_c2m_service_db.vepC2MBMRecommendationItem latestItem ON (
		  recommendationItem.targetId = latestItem.targetId AND 
		  recommendationItem.fairCode = latestItem.fairCode AND 
		  recommendationItem.fiscalYear = latestItem.fiscalYear AND 
		  recommendationItem.id < latestItem.id
      )
      RIGHT JOIN (
        SELECT
          id as recId,
          ssoUid as buyerSsoUid,
          publishType
        FROM vep_c2m_service_db.vepC2MBMRecommendation AS recommendation
        WHERE recommendation.ssouid = '${buyerProfile?.ssoUid}' AND recommendation.fairCode = '${buyerProfile?.fairCode}' AND recommendation.fairYear = '${buyerProfile?.fiscalYear}'
      ) recommendation ON recId = recommendationItem.recommendationId
      WHERE latestItem.id IS NULL
      GROUP BY recommendationItem.targetId, recommendationItem.fairCode, recommendationItem.fiscalYear
    ) recommendationItem ON exhibitor.companyCcdId = rItemCcdId AND eoa.fairCode = rItemFairCode` : '';

    const eCurrentExportMarketFilterArr: string[] = [];
    let eCurrentExportMarketFilterString = '';
    const eTargetMarketFilterArr: string[] = [];
    let eTargetMarketFilterString = '';
    const ePreferredNobFilterArr: string[] = [];
    let ePreferredNobFilterString = '';
    const eAvoidMarketFilterArr: string[] = [];
    let eAvoidMarketFilterString = '';

    if (eCurrentExportMarket) {
      if (isArray(eCurrentExportMarket)) {
        eCurrentExportMarket.map((market: string) => {
          if (market !== '') {
            eCurrentExportMarketFilterArr.push(`( empv.eCurrentExportMarkets LIKE '%${market}%' )`);
          }
        });
      } else if (typeof eCurrentExportMarket === 'string') {
        eCurrentExportMarket.split(',').map((market: string) => {
          if (market !== '') {
            eCurrentExportMarketFilterArr.push(`( empv.eCurrentExportMarkets LIKE '%${market}%' )`);
          }
        });
      }

      if (eCurrentExportMarketFilterArr.length) {
        eCurrentExportMarketFilterString = `AND ( ${eCurrentExportMarketFilterArr.join(' OR ')} )`;
      }
      // console.log(eCurrentExportMarketFilterString);
    }

    if (eTargetMarket) {
      if (isArray(eTargetMarket)) {
        eTargetMarket.map((market: string) => {
          if (market !== '') {
            eTargetMarketFilterArr.push(`( empv.preferredMarket LIKE '%${market}%' )`);
          }
        });
      } else if (typeof eTargetMarket === 'string') {
        eTargetMarket.split(',').map((market: string) => {
          if (market !== '') {
            eTargetMarketFilterArr.push(`( empv.preferredMarket LIKE '%${market}%' )`);
          }
        });
      }

      if (eTargetMarketFilterArr.length) {
        eTargetMarketFilterString = `AND ( ${eTargetMarketFilterArr.join(' OR ')} )`;
      }
    }

    if (ePreferredNob) {
      if (isArray(ePreferredNob)) {
        ePreferredNob.map((market: string) => {
          if (market !== '') {
            ePreferredNobFilterArr.push(`( empv.preferredNob LIKE '%${market}%' )`);
          }
        });
      } else if (typeof ePreferredNob === 'string') {
        ePreferredNob.split(',').map((market: string) => {
          if (market !== '') {
            ePreferredNobFilterArr.push(`( empv.preferredNob LIKE '%${market}%' )`);
          }
        });
      }

      if (ePreferredNobFilterArr.length) {
        ePreferredNobFilterString = `AND ( ${ePreferredNobFilterArr.join(' OR ')} )`;
      }
    }

    if (eAvoidMarket) {
      if (isArray(eAvoidMarket)) {
        eAvoidMarket.map((market: string) => {
          if (market !== '') {
            eAvoidMarketFilterArr.push(`( empv.notPreferredMarket LIKE '%${market}%' )`);
          }
        });
      } else if (typeof eAvoidMarket === 'string') {
        eAvoidMarket.split(',').map((market: string) => {
          if (market !== '') {
            eAvoidMarketFilterArr.push(`( empv.notPreferredMarket LIKE '%${market}%' )`);
          }
        });
      }

      if (eAvoidMarketFilterArr.length) {
        eAvoidMarketFilterString = `AND ( ${eAvoidMarketFilterArr.join(' OR ')} )`;
      }
    }

    const groupByString = filters?.cbmAITable ? 'GROUP BY exhibitor.companyCcdId' : 'GROUP BY exhibitor.companyCcdId, exhibitor.eoaFairId';

    let exhibitorString = this.buildQueryString('exhibitor', {
      companyCcdId,
      contactEmail: emailId,
      country: country?.length ? country.split(',') : [], // DONE
      factoryLocation: factoryLocation?.length ? factoryLocation.split(',') : [], // DONE
      eoaFairId: eoaFairIds, // e-part fair
      vepType: exhibitorType?.length ? exhibitorType.split(',') : [], // DONE
      active: ['1'],
      c2mParticipantStatusId: ['1', '2', '3'],
    });

    let query = (type: 'count' | 'data'): string => `
    ${type === 'count' ? countPrefix : queryPrefix}
    ${brandNameString}
    ${pavilionString}
    ${zoneString}
    ${exhibitorMarketPreferenceString}
    ${productListString}
    ${nobString}
    ${productStrategyString}
    ${fairCodeString}
    ${countAcceptedMeetingString}
    ${bmResponseString}
    ${exhibitorString}
    ${eCurrentExportMarketFilterString}
    ${eTargetMarketFilterString}
    ${ePreferredNobFilterString}
    ${eAvoidMarketFilterString}
    ${keywords ? keywordString : ''}
    ${type === 'count' ? 'GROUP BY id LIMIT 1' : groupByString}
    ${type === 'count' ? '' : getSortString()}
    ${type === 'count' ? '' : getPageSize()}
    `;

    const dataQuery = query('data').split('\n').join('').replace(/  +/g, ' ').replace(/\t/g, '');
    console.log('dataQ', dataQuery);
    const countQuery = query('count').split('\n').join('').replace(/  +/g, ' ').replace(/\t/g, '');

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let dataResult: any[] = [];
    let countResult: any[] = [];
    try {
      dataResult = await connection.query(dataQuery, undefined, slaveRunner);
      countResult = await connection.query(countQuery, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in filterExhibitorWithPagination api", error)
    } finally {
      slaveRunner.release();
    }

    // return result;
    const exhibitorIds: any[] = dataResult.map((row: any) => row.companyCcdId);
    const esPromise = this.apiExhibitorService.filterExhibitorByES({
      fairCode,
      from: 0,
      size: exhibitorIds.length,
      filterRecommendedCCDID: exhibitorIds,
    });

    // let acceptedMeetingByIds: Record<string, any> = {};
    // if (exhibitorIds?.length) {
    //   acceptedMeetingByIds = await this.meetingService.countAcceptedMeetingByIds(this.formatSqlStringArray(exhibitorIds));
    //   acceptedMeetingByIds.forEach((row: any) => {
    //     acceptedMeetingByIds[row.id] = row.count;
    //   });
    // }

    let esDict: Record<string, any> = {};
    const { data: esRes } = await Promise.resolve(esPromise);
    const { hits: esResult } = esRes?.data;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    // eslint-disable-next-line sonarjs/no-identical-functions
    <Array<any>>esResult?.forEach((element: any) => {
      esDict[element?.ccdid] = {
        supplierUrn: element?.supplierUrn,
        exhibitorUrn: element?.exhibitorUrn,
        companyLogo: element?.supplierLogo,
        boothNumber: element?.boothNumbers[0],
      };
    });

    const bmResponseTranslate = (bmResponse: number | null): string => {
      if (bmResponse != null) {
        switch (bmResponse) {
          case 0:
            return 'No response';
          case 1:
            return 'Interest (ext)';
          case 2:
            return 'No interest';
          case 3:
            return 'Interest (int)';
          default:
            return ' - ';
        }
      } else {
        return ' - ';
      }
    };

    const records = dataResult.map((row: any, index: number) => ({
      id: index + 1 + rowsPerPage * (pageNum - 1),
      fiscalYear: eoaFairDict[row.eoaFairId]?.fiscalYear,
      companyCcdId: row.companyCcdId,
      companyName: row.companyName,
      country: row.country,
      productStrategy: row.strategy?.split(',') || null,
      factoryLocation: row.factoryLocation,
      exhibitorType: row.vepType,
      salutation: row.salutation,
      fullName: row.contactName,
      firstName: row.contactName?.split(' ')[0] || '',
      lastName: row.contactName?.split(' ')[1] || '',
      acceptedMeeting: parseInt(row.acceptedMeeting) || 0,
      productList: row.productRange?.split(',') || null, // empty at the moment
      description: row.exhibitDescription,
      preferredMarket: row.preferredMarket?.split(',') || null,
      notPreferredMarket: row.notPreferredMarket?.split(',') || null,
      preferredNob: row.preferredNob?.split(',') || null,
      nob: row.nobRange?.split(',') || null,
      exhibitorFairCode: eoaFairDict[row.eoaFairId]?.fairCode || '',
      exhibitorFair: eoaFairDict[row.eoaFairId]?.fairShortName || '',
      supplierUrn: esDict[row.companyCcdId]?.supplierUrn || null,
      exhibitorUrn: esDict[row.companyCcdId]?.exhibitorUrn || null,
      companyLogo: esDict[row.companyCcdId]?.companyLogo || null,
      boothNumber: row.boothNumber || null,
      pavilion: row.pavilion?.split(',') || null,
      zone: row.zone?.split(',') || null,
      brandName: row.brandName?.split(',') || null,
      exhRegDate: moment(row.creationTime).tz('UTC', true),
      eCurrentExportMarkets: row?.eCurrentExportMarkets || null,
      bmStatus: bmResponseTranslate(row?.bmResponse),
      duplicate: bmResponseTranslate(row?.bmResponse) === ' - ' ? 'N' : 'Y'
    }));

    const returnZeroWhenEmptyArray = (result:any[]):number => {
      if (!result.length) return 0;
      return parseInt(countResult[0]?.count, 10);
    };

    return {
      totalRecordNum: filters?.cbmAITable && returnZeroWhenEmptyArray(countResult) > 40 ? 40 : returnZeroWhenEmptyArray(countResult),
      totalPageNum: filters?.cbmAITable && returnZeroWhenEmptyArray(countResult) > 40 ? Math.ceil(40 / rowsPerPage) : (Math.ceil(returnZeroWhenEmptyArray(countResult) / rowsPerPage)),
      rowsPerPage,
      pageNum,
      records,
    };
  }

  public async getSearchExhibitorOptionsList(): Promise<Record<string, any>> {
    const exhibitorDbStringA = 'SELECT DISTINCT country from vepExhibitorDb.vepExhibitor exhibitor where country IS NOT NULL';
    // const exhibitorDbStringB = 'SELECT DISTINCT factoryLocation from vepExhibitorDb.vepExhibitor exhibitor where factoryLocation IS NOT NULL';
    const exhibitorDbStringB = `SELECT DISTINCT factoryLocation as code, CONCAT(factoryLocation, ' - ', english_description) as label
    FROM vepExhibitorDb.vepExhibitor exhibitor LEFT JOIN (SELECT * FROM vep_content.vep_council_global_country AS countryList) countryList ON countryList.code = factoryLocation
    WHERE code IS NOT NULL AND english_description IS NOT NULL`;
    const c2mqDbString = `select Distinct c2mQ.type, c2mA.answer from  vepExhibitorDb.vepExhibitorC2mQuestions c2mQ Inner Join vepExhibitorDb.vepExhibitorC2mAnswers c2mA ON c2mQ.id = c2mA.vepExhibitorQuestionId 
    where (c2mQ.type = "preferredNOB" OR c2mQ.type = "targetMarkets" OR c2mQ.type = "nonTargetMarkets") AND c2mQ.locale = "en"`;

    const removeSpace = (str: string): string => str.split('\n').join('').replace(/  +/g, ' ');
    const attributeDbString = `select Distinct value, attribute, value as display from vepExhibitorDb.vepExhibitorAttributes where attribute = "pavilion" and locale = "en" union all 
      select Distinct value, attribute, value as display from vepExhibitorDb.vepExhibitorAttributes where attribute = "productZone" and locale = "en" union all 
      select Distinct value, attribute, value as display from vepExhibitorDb.vepExhibitorAttributes where attribute = "nob" and locale = "en" union all 
      select Distinct value, attribute, case when english_description is null then value else english_description end as display from vepExhibitorDb.vepExhibitorAttributes left join ( select * from vep_content.vep_council_global_product_strategy as productStrategyList ) product_strategy ON product_strategy.code = value where attribute = "strategy" and locale = "en"
    `;
    // preferredNOB, targetMarkets, nonTargetMarkets

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let exhibitorDbResultA: any[] = [];
    let exhibitorDbResultB: any[] = [];
    let c2mqDbStringResult: any[] = [];
    let attributeDbResult: any[] = [];
    try {
      exhibitorDbResultA = await connection.query(removeSpace(exhibitorDbStringA), undefined, slaveRunner);
      exhibitorDbResultB = await connection.query(removeSpace(exhibitorDbStringB), undefined, slaveRunner);
      c2mqDbStringResult = await connection.query(removeSpace(c2mqDbString), undefined, slaveRunner);
      attributeDbResult = await connection.query(removeSpace(attributeDbString), undefined, slaveRunner);
    } catch (error) {
      console.log("Error in getSearchExhibitorOptionsList api", error);
    } finally {
      slaveRunner.release();
    }

    const c2mpr = this.attributeGrouper(c2mqDbStringResult, 'type', 'answer');
    const pr = this.attributeGrouper(attributeDbResult, 'attribute', 'value');
    return {
      status: 200,
      data: {
        country: exhibitorDbResultA
          .flatMap((obj: Record<string, any>) => obj.country)
          .filter((str: string) => str !== '')
          .sort((a: string, b: string) => a.localeCompare(b)),
        factoryLocation: exhibitorDbResultB.sort((a: any, b: any) => a.code.localeCompare(b.code)),
        pavilion: pr.find((e: Record<string, any>) => e.attribute === 'pavilion').value,
        productZone: pr.find((e: Record<string, any>) => e.attribute === 'productZone').value,
        nob: pr.find((e: Record<string, any>) => e.attribute === 'nob').value,
        strategy: attributeDbResult.filter((data: any) => data.attribute === 'strategy'), //
        targetMarkets: c2mpr.find((e: Record<string, any>) => e.type === 'targetMarkets').answer,
        preferredNOB: c2mpr.find((e: Record<string, any>) => e.type === 'preferredNOB').answer,
        nonTargetMarkets: c2mpr.find((e: Record<string, any>) => e.type === 'nonTargetMarkets').answer,
      },
    };
  }

  public async searchExhibitorPavilionListByFaircode(fairCodeList: string[]): Promise<Record<string, any>> {

    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    try {
      if (!fairCodeList.length) {
        return await Promise.reject({
          meta: {
            status: constant.GENERAL_STATUS.FAIL,
          },
          message: 'missing fair code',
        });
      }

      const conditionStrArr = fairCodeList.map((fairCode: string) => `faircode = "${fairCode}"`);
      const conditionStr = conditionStrArr.join(' OR ');

      const pavilionListQuery = `
        SELECT * FROM vep_content.vep_fair_setting 
          LEFT JOIN (
            SELECT DISTINCT(a.value) AS pavilion , e.eoaFairId
            FROM vepExhibitorDb.vepExhibitor e 
            INNER JOIN vepExhibitorDb.vepExhibitorAttributes a 
            ON e.companyCcdId = a.companyCcdId AND e.eoaFairId = a.eoaFairId AND a.attribute = 'pavilion' AND a.locale = 'en' 
          ) e ON e.eoaFairId = meta_value
        WHERE meta_key = "eoa_fair_id" AND ( ${conditionStr} )
        GROUP BY e.pavilion
        ORDER BY e.pavilion ASC
      `.split('\n').join('').replace(/  +/g, ' ');

      const pavilionListResult = await connection.query(pavilionListQuery, undefined, slaveRunner);
      const pavilionList: string[] = pavilionListResult.map((res: any) => res.pavilion);

      // get Zone List by faircode
      const zoneListQuery = `
        SELECT eoaFairId, faircode, attribute, value AS zone
        FROM vepExhibitorDb.vepExhibitorAttributes AS attr
        LEFT JOIN (
          SELECT faircode, meta_value
          FROM vep_content.vep_fair_setting
          WHERE meta_key = 'eoa_fair_id'
        ) setting ON setting.meta_value = attr.eoaFairId
        WHERE attribute = 'productZone' AND locale = 'en' AND ( ${conditionStr} )
        GROUP BY zone
        ORDER BY zone ASC
      `.split('\n').join('').replace(/  +/g, ' ');


      const zoneListResult = await connection.query(zoneListQuery, undefined, slaveRunner);
      const zoneList: string[] = zoneListResult.map((res: any) => res.zone);

      return Promise.resolve({
        status: constant.GENERAL_STATUS.SUCCESS,
        data: {
          pavilionList,
          zoneList
        }
      });
    } catch (error: any) {
      return Promise.reject({
        meta: {
          status: constant.GENERAL_STATUS.FAIL,
        },
        message: error?.message ?? JSON.stringify(error),
      });
    } finally {
      slaveRunner.release();
    }
  }

  public async getAgentSrc(eoaFairId:string): Promise<Record<string, any>> {
    const query = `SELECT DISTINCT(e.agentName) AS value FROM vepExhibitorDb.vepExhibitor e WHERE e.eoaFairId = ${eoaFairId} ORDER BY e.agentName;`;
    
    const connection = await getConnection('contentDatabase');
    const slaveRunner = connection.createQueryRunner('slave');
    let res: any[] = [];
    try {
      res = await connection.query(query, undefined, slaveRunner);
    } catch (error) {
      console.log("Error in getAgentSrc api", error);
    } finally {
      slaveRunner.release();
    }
    return res?.filter((obj:{ value:string }) => obj.value).map((obj:{ value:string }) => obj.value);
  }

  private async computeExhibitorEoaFair(fairCode: string, exhibitorParticipatingFair: Array<string> | null = null): Promise<Record<string, any>> {
    let { data }: { data: any[] } = await this.fairService.getWordpressFairSetting(fairCode);
    // return data;
    if (exhibitorParticipatingFair?.length) {
      data = data.filter((fairSetting: any) => exhibitorParticipatingFair?.includes(fairSetting.fair_code));
    }
    let eoaFairDict: Record<string, any> = {};
    data.forEach((element: any) => {
      eoaFairDict[element.eoa_fair_id] = {
        fairCode: element.fair_code,
        fiscalYear: element.fiscal_year,
        fairYear: element.vms_project_year,
        fairShortName: element.fair_short_name?.en,
      };
    });

    return eoaFairDict;
  }

  private attributeGrouper(arr: any[], att: string, value: any): any[] {
    // expect result = [{ att: att1, value: [value1,value2,...] },{ att: att2, value: [value3,value2,...] }]
    return arr.reduce((agg: any[], curr: Record<string, any>) => {
      let found = agg.find((x: any) => x[att] === curr[att]);
      if (found) {
        found[value].push(curr[value]);
      } else {
          agg.push({
            [att]: curr[att],
            [value]: [curr[value]],
          });
      }
      return agg;
    }, []);
  }

  private checkInputIsAllEnglish(str: string): boolean {
    // eslint-disable-next-line no-control-regex
    if (/^[\u0000-\u007f]*$/.test(str)) return true;
    return false;
  }

  private fullTextSearchStringGenerator(keywords: string): string {
    return `AND ( MATCH (exhibitor.contactName) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (exhibitor.companyName) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (exhibitor.country) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (exhibitor.boothNumber) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (exhibitor.exhibitDescription) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (zone) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (productRange) AGAINST ('${keywords}' IN BOOLEAN MODE) OR
      MATCH (brandName) AGAINST ('${keywords}' IN BOOLEAN MODE) )
      `;

    /* See the system variable ft_min_word_len,
      which specifies the minimum length of words to be indexed by full-text searching.
      It defaults to 4, so 3-letter words won't be found by full-text searching.
      More information about parameters of full-text searching can be found at 12.9.6. Fine-Tuning MySQL Full-Text Search.
      */
  }

  private likeTextSearchStringGenerator(keywords: string): string {
    return `AND exhibitor.contactName LIKE "${keywords}%" OR
       exhibitor.companyName LIKE "${keywords}%" OR
       exhibitor.country LIKE "${keywords}%" OR
       exhibitor.boothNumber LIKE "${keywords}%" OR
       exhibitor.exhibitDescription LIKE "${keywords}%" OR
       zone LIKE "${keywords}%" OR
       productRange LIKE "${keywords}%" OR
       brandName LIKE "${keywords}%"
     `;
  }
}
