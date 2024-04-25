import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Auth } from '../../../decorators/auth.decorator';
import { SetHiddenRecordDto } from '../../../dto/hiddenRecord.dto';
import { HiddenRecordService } from './hiddenRecord.service';
import { NotInterestedByFairListRequestDto } from '../../../dto/notInterestedByFairList.dto';

@Controller(['c2m/fairs/:fairCode/hidden-records', 'internal/c2m/participants'])
export class HiddenRecordController {
  constructor(private hiddenRecordService: HiddenRecordService) {}

  @Get()
  public async getHiddenRecords(@Auth('SSOUID') id: string, @Auth('COMPANY_CCDIDS') companyCcdIds: string, @Param('fairCode') fairCode: string, @Query() q: Record<string, any>): Promise<Record<string, any>> {
    const { fairYear, hiddenType } = q;

    // Default, as buyer, get hidden record
    let ssoUid: string = id;

    try {
      if (hiddenType == 0 && companyCcdIds && companyCcdIds.length > 0) {
        // as exhibitor, get hidden record
        ssoUid = companyCcdIds;
      }
    } catch (ex) {

    }

    return { data: await this.hiddenRecordService.find({ ssoUid, fairCode, fairYear, hiddenType }) };
  }

  @Post()
  @HttpCode(201)
  public async setHiddenRecord(@Auth('SSOUID') ssoUid: string, @Param('fairCode') fairCode: string, @Body() dto: SetHiddenRecordDto): Promise<Record<string, any>> {
    const { hiddenTarget, fairYear, hiddenType } = dto.data;

    let data = await this.hiddenRecordService.findOne({ ssoUid, fairCode, fairYear, hiddenTarget, hiddenType });
    if (!data) {
      data = await this.hiddenRecordService.create(fairCode, fairYear, ssoUid, hiddenTarget, hiddenType);
    }

    return { data };
  }

  // BMAI API - Not Interested Buyer or Exhibitor
  @Get("/:userId/not-interested")
  public async getNotInterestedByFairList(@Param('userId') userId: string, @Query() notInterestedByFairListRequest: NotInterestedByFairListRequestDto) {
    return this.hiddenRecordService.getNotInterestedByFairList(userId, notInterestedByFairListRequest);
  }
}
