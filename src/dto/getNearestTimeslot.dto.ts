import { IsEnum, IsOptional } from 'class-validator';
import { MeetingType } from '../modules/c2m/meeting/meeting.type';

export class GetNearestTimeslotDto {
  @IsEnum(MeetingType)
  @IsOptional()
  public meetingType!: MeetingType;

  @IsOptional()
  public targetTime!: string;
}
