import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { CommonCreateMeetingDtoData } from './commonCreateMeeting.dto';

class CreateMeetingDtoData extends CommonCreateMeetingDtoData {
  // please add field into CommonCreateMeetingDtoData
}

export class CreateMeetingDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateMeetingDtoData)
  public data!: CreateMeetingDtoData;
}
