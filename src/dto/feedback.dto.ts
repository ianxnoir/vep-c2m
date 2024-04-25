import { IsEnum, IsNotEmpty } from 'class-validator';
import {  MeetingRole } from '../modules/c2m/meeting/meeting.type';

export class setFeedbackDtoData {
  @IsNotEmpty()
  public answer!:string;

  @IsNotEmpty()
  public score!: number;

  @IsNotEmpty()
  @IsEnum(MeetingRole)
  public userType!: MeetingRole;

  @IsNotEmpty()
  public meetingId!: string;

}
