import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsDefined, IsEnum, IsNotEmpty, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { DateAfter } from '../decorators/validatation/dateAfter.decorator';
import { MeetingType } from '../modules/c2m/meeting/meeting.type';

export enum UpdateMeetingDtoAction {
  ACCEPT = 'ACCEPT',
  CANCEL = 'CANCEL',
  REJECT = 'REJECT',
  RESCHEDULE = 'RESCHEDULE'
}

class UpdateMeetingDtoData {
  // @DateAfter()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  public startTime!: string;

  @DateAfter('startTime')
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  public endTime!: string;

  @IsOptional()
  public name!: string;

  @IsOptional()
  public message!: string;

  @IsOptional()
  public cancelledReason!: string;

  @IsEnum(MeetingType)
  @IsOptional()
  public type!: MeetingType;

  @ValidateIf((data: UpdateMeetingDtoData) => data.type === MeetingType.F2F)
  @IsNotEmpty()
  public f2fLocation!: MeetingType;

  @IsBoolean()
  public isSkipSeminarChecking!: boolean;
}
export class UpdateMeetingDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateMeetingDtoData)
  public data!: UpdateMeetingDtoData;

  @IsDefined()
  @IsEnum(UpdateMeetingDtoAction)
  public action!: UpdateMeetingDtoAction;
}
