import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HiddenRecord } from '../../../entities/hiddenRecord.entity';
import { NotInterestedByFairListRequestDto } from '../../../dto/notInterestedByFairList.dto';
import { VepError } from '../../../core/exception/exception';
import { VepErrorMsg } from '../../../config/exception-constant';
import { ApiFairService } from '../../api/fair/fair.service';

@Injectable()
export class HiddenRecordService {
  constructor(
    @InjectRepository(HiddenRecord)
    private hiddenRecordRepository: Repository<HiddenRecord>,
    private apiFairService: ApiFairService
  ) {}

  public async find(fields: Record<string, any>): Promise<HiddenRecord[]> {
    return this.hiddenRecordRepository.find({ ...fields });
  }

  public async findOne(fields: Record<string, any>): Promise<HiddenRecord | undefined> {
    return this.hiddenRecordRepository.findOne({ ...fields });
  }

  public async create(fairCode: string, fairYear: string, ssoUid: string, hiddenTarget: string, hiddenType: number): Promise<HiddenRecord> {
    const record = this.hiddenRecordRepository.create({
      fairCode,
      fairYear,
      ssoUid,
      hiddenTarget,
      hiddenType,
      creationTime: new Date(),
    });

    return this.hiddenRecordRepository.save(record);
  }

  public async getNotInterestedByFairList(userId: string, query: NotInterestedByFairListRequestDto) {
    let searchObj: { fairCode: string, fiscalYear: string };

    try {
      searchObj = JSON.parse(Buffer.from(query.fairs, 'base64').toString())
    } catch {
      throw new VepError(VepErrorMsg.HiddenRecord_GetNotInterestedByFairList_FairsParse_Error, `Failed to retieve fairs from query, query.fairs: ${query.fairs}`)
    }

    let siblingFairCodes: string[] = []

    await this.apiFairService.getAdminCombinedFairSettings(searchObj.fairCode, searchObj.fiscalYear)
        .then(combineFairSettingResp => {
            siblingFairCodes = combineFairSettingResp.data.data
        }).catch((ex) => {
            console.log(ex)
            siblingFairCodes = [searchObj.fairCode]
        });

    const hiddenRecords: HiddenRecord[] = await this.hiddenRecordRepository.find({
      where: {
        ssoUid: userId,
        fairCode: In(siblingFairCodes),
        fairYear: searchObj.fiscalYear,
        hiddenType: (query.userType == "EXHIBITOR") ? 0 : 1
      }
    });

    let formattedData: { userIds: string[] } = {
      userIds: hiddenRecords.map((hiddenRecord: HiddenRecord) => {
        return hiddenRecord.hiddenTarget
      })
    }

    return formattedData;

  }
}
