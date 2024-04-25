import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { MeetingRole } from '../modules/c2m/meeting/meeting.type';
import { CBMPermission } from './cbmPermission.dto';
import { CommonCreateMeetingDtoData } from './commonCreateMeeting.dto';

export class CBMCreatingMeetingDtoData extends CommonCreateMeetingDtoData {
  @IsEnum(MeetingRole)
  @IsNotEmpty()
  public assignerRole!: MeetingRole;

  @IsNotEmpty()
  public requesterSsoUid!: string;
}

export class CBMCreatingMeetingDto extends CBMPermission {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMCreatingMeetingDtoData)
  public data!: CBMCreatingMeetingDtoData;
}
