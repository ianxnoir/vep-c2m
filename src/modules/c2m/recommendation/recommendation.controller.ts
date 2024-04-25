import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseInterceptors } from '@nestjs/common';
import { AdminUserDto } from '../../../core/adminUtil/jwt.util';
import { AdminJwtInterceptor } from '../../../core/interceptors/adminJwt.interceptor';
import { Logger } from '../../../core/utils/logger.service';
import { AdminUserDecorator } from '../../../decorators/adminUser.decorator';
import { Auth } from '../../../decorators/auth.decorator';
import {
  CheckDuplicateExhibitorsMustInterface,
  CreateRecommendationRecordDto,
  CreateRecommendationRecordMustInterface,
  GetBMListManagementRecordMustInterface
} from '../../../dto/createRecommendationRecord.dto';
import { UpdateRecommendationRecordDto } from '../../../dto/updateRecommendationRecord.dto';
import { UpdateRecommendedByTDCMustDto } from '../../../dto/updateRecommendedByTDC.dto';
import { ApiFairService } from '../../api/fair/fair.service';
import { ExhibitorService } from '../../cbm/exhibitor/exhibitor.service';
import { esDataRestructurer } from './helper';
import { RecommendationService } from './recommendation.service';

@Controller(['c2m/fairs/:fairCode/recommendations', 'admin/v1/c2m/fairs/:fairCode/recommendations'])
export class RecommendationController {
  constructor(
    private logger: Logger,
    private apiFairService: ApiFairService,
    private exhibitorService: ExhibitorService,
    private recommendationService: RecommendationService
  ) {}

  @Put('/:id')
  public async updateRecommendationRecord(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('id') id: number,
    @Body() dto: UpdateRecommendationRecordDto
  ): Promise<Record<string, any>> {
    const { fairYear } = dto.data;
    const record = await this.recommendationService.findOne({ id, ssoUid, fairCode, fairYear });
    const data = await this.recommendationService.updateRecord(ssoUid, record, dto);

    return { data };
  }

  @Get()
  public async getRecommendationRecords(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Query() q: Record<string, any>
  ): Promise<Record<string, any>> {
    const { fairYear, targetType } = q;
    const data = await this.recommendationService.find({
      ssoUid,
      fairCode,
      fairYear,
      targetType,
    });

    return { data };
  }

  @Post()
  public async createRecommendationRecord(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Body() createRecommendationRecordDto: CreateRecommendationRecordDto
  ): Promise<Record<string, any>> {
    const data = await this.recommendationService.createRecord(ssoUid, fairCode, createRecommendationRecordDto);

    return { data };
  }

  @Get('/fiscalYear/:fiscalYear/exhibitors/:companyCcdId')
  public async findRecommendedBuyer(
    @Auth('COMPANY_CCDIDS') companyCcdIds: string[],
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string,
    @Param('companyCcdId') companyCcdId: string
  ): Promise<Record<string, any>> {
    let data = {};
    if (companyCcdIds.includes(companyCcdId)) {
      data = await this.recommendationService.findRecommendedBuyer(companyCcdId, fairCode, fiscalYear);
    }

    return { data };
  }

  @Get('/fiscalYear/:fiscalYear/buyers')
  public async findRecommendedExhibitor(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string
  ): Promise<Record<string, any>> {
    let data = {};
    if (ssoUid) {
      data = await this.recommendationService.findRecommendedExhibitor(ssoUid, fairCode, fiscalYear);
    }

    return { data };
  }

  // ------------------------------------------------ Recommend AI Admin ------------------------------------------------

  @Post('admin/fiscalYear/:fiscalYear/buyers')
  public async findRecommendedExhibitorToAdmin(
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string,
    @Body() body: any
  ): Promise<Record<string, any>> {
    const { ssoUid, paginateOption } = body;

    const sortingOption = {
      ...body.sortingOption,
    };
    if (!paginateOption?.pageNum || !paginateOption?.rowsPerPage) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'paginateOption is missing',
      };
    }
    if (ssoUid) {
      return this.apiFairService
        .getMultipleFairDatas([fairCode])
        .then((result: any) => {
          if (!result?.data?.length) {
            return Promise.reject('fairCode not found');
          }
          return result?.data?.[0].combinationName;
        })
        .then(async (combinationName: any) => {
          const fairName = combinationName || fairCode;
          const data = await this.recommendationService.findRecommendedExhibitor(ssoUid, fairName, fiscalYear);
          return data?.exhibitors?.map((exhibitor: any) => exhibitor.ccdId);
        })
        .then(async (ccdIdArr: any) => {
          if (ccdIdArr?.length) {
            ccdIdArr = ccdIdArr.slice(0, 40);
            const eoaData = await this.exhibitorService.filterExhibitorWithPagination(fairCode, { companyCcdId: ccdIdArr, cbmAITable: true }, sortingOption, paginateOption, { ssoUid, fairCode, fiscalYear });
            return {
              // totalSize: esData?.total_size,
              // rows: esDataRestructurer(esData?.data?.hits)
              status: HttpStatus.OK,
              data: eoaData,
            };
          } else {
            return {
              status: HttpStatus.OK,
              data: {
                pageNum: paginateOption.pageNum,
                records: [],
                rowsPerPage: paginateOption.rowsPerPage,
                totalPageNum: 0,
                totalRecordNum: 0
              }
            }
          }
        })
        .catch((err: any) => ({
          status: HttpStatus.BAD_REQUEST,
          message: err ?? JSON.stringify(err),
        }));
    }
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'SSOUID not found',
    };
  }

  @Get('es2')
  public async searchExhibitorAdmin(
    @Param('fairCode') fairCode: string
    // @Param('fiscalYear') fiscalYear: string,
    // @Body() body:any
  ): Promise<Record<string, any>> {
    const res = await this.recommendationService.getExhibitorProfileFromES([], fairCode, 'en');
    return {
      totalSize: res?.total_size,
      rows: esDataRestructurer(res?.data?.hits),
    };
  }

  // ------------------------------------------------ end of AI Admin ---------------------------------------------------

  // ------------------------------------------------ Recommend by tdc ------------------------------------------------

  @Get('/:fairYear/showIfBuyerHasBMList')
  public async showIfBuyerHasBMList(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
  ){
    this.logger.log(
      JSON.stringify({ action: 'showIfBuyerHasBMList - GET - /showIfBuyerHasBMList', section: 'c2m - recommendation', detail: { fairCode } })
    );

    return this.recommendationService.showIfBuyerHasBMList(ssoUid, fairCode, fairYear)
  
  }

  @Get('/:fairYear/recommendedByTDC')
  public async findRecommendedByTDCRecord(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Query('language') language: string,
    @Query('pageNum') pageNum: string,
    @Query('pageSize') pageSize: string
  ) {
    this.logger.log(
      JSON.stringify({ action: 'findRecommendedByTDCRecord - GET - /recommendedByTDC', section: 'c2m - recommendation', step: 'ready', detail: { fairCode } })
    );
    let data = {};

    if (ssoUid) {
      data = await this.recommendationService.findRecommendedByTDCRecord(ssoUid, fairCode, fairYear, language, pageNum, pageSize);
    }

    return data;
  }

  @Post('/updateRecommendedByTDCStatus')
  public async updateRecommendedByTDCRecordStatus(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Body() body: UpdateRecommendedByTDCMustDto
  ) {
    const { fairYear, ccdId, itemId, interestedStatus } = body;
    this.logger.log(
      JSON.stringify({
        action: 'updateRecommendedByTDCRecordStatus - POST - /updateRecommendedByTDCStatus',
        section: 'c2m - recommendation',
        step: 'ready',
        detail: { fairCode, body },
      })
    );
    let data = {};

    if (ssoUid) {
      data = await this.recommendationService.updateRecommendedByTDCRecordStatus(ssoUid, fairCode, fairYear, ccdId, itemId, interestedStatus);
    }

    return data;
  }

  @Get('/:fairYear/pendingRecommendation')
  public async findpendingRecommendationRecord(
    @Auth('SSOUID') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fairYear') fairYear: string,
    @Query('language') language: string
  ) {
    this.logger.log(
      JSON.stringify({ action: 'findRecommendedByTDCRecord - GET - /recommendedByTDC', section: 'c2m - recommendation', step: 'ready', detail: { fairCode } })
    );
    return this.recommendationService.findpendingRecommendationRecord(ssoUid, fairCode, fairYear, language);
  }

  @Get('/:fairYear/totalNumOfTDCRecommend')
  public async getTotalNumOfTDCRecommend(@Auth('SSOUID') ssoUid: string, @Param('fairCode') fairCode: string, @Param('fairYear') fairYear: string) {
    this.logger.log(
      JSON.stringify({ action: 'totalNumOfTDCRecommend - GET - /recommendedByTDC', section: 'c2m - recommendation', step: 'ready', detail: { fairCode } })
    );
    return this.recommendationService.getTotalNumOfTDCRecommend(ssoUid, fairCode, fairYear);
  }

  // --------------------------------------------- end of Recommend by tdc ---------------------------------------------

  // ------------------------------------------------ BM List ------------------------------------------------
  @Post('/createRecommendBMList')
  @UseInterceptors(AdminJwtInterceptor)
  public async createRecommendBMList(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('fairCode') fairCode: string,
    @Body() body: CreateRecommendationRecordMustInterface
  ) {
    const emailId = currentUser.emailAddress;

    return this.recommendationService.createRecommendBMListRecord(body, fairCode, emailId);
  }

  @Post('/checkDuplicateExhibitors')
  @UseInterceptors(AdminJwtInterceptor)
  public async checkDuplicateExhibitors(
    @AdminUserDecorator() currentUser: AdminUserDto,
    @Param('fairCode') fairCode: string,
    @Body() body: CheckDuplicateExhibitorsMustInterface
  ) {
    return this.recommendationService.checkDuplicateExhibitors(body, fairCode);
  }
  // --------------------------------------------- end of BM List ---------------------------------------------

  // ----------------------------------- Admin Portal - BM List Management -----------------------------------
  @Post('/getBMListManagement')
  @UseInterceptors(AdminJwtInterceptor)
  public async getBMListManagementRecord(@AdminUserDecorator() currentUser: AdminUserDto, @Body() body: GetBMListManagementRecordMustInterface) {
    const { pageNum, pageSize, orderBy, sortOrder, filterOption } = body;
    if (currentUser.branchOfficeUser) {
      filterOption.buyerBranchOffice = currentUser.branchOffice;
    }
    return this.recommendationService.getBMListManagementRecord(pageNum, pageSize, orderBy, sortOrder, filterOption);
  }
  // -------------------------------- end of Admin Portal - BM List Management --------------------------------
  @Get('/fiscalYear/:fiscalYear/ssoUid/:ssoUid/noti')
  public async findRecommendedExhibitorForNoti(
    @Param('ssoUid') ssoUid: string,
    @Param('fairCode') fairCode: string,
    @Param('fiscalYear') fiscalYear: string,
    @Param('c2mParticipantStatusId') c2mParticipantStatusId: string,
  ): Promise<Record<string, any>> {
    let data = {};
    if (ssoUid) {
      data = await this.recommendationService.findRecommendedExhibitorForNoti(fairCode, fiscalYear, ssoUid, c2mParticipantStatusId);
    }

    return { data };
  }
}
