import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MeetingRole } from '../modules/c2m/meeting/meeting.type';

export class getAndSetC2MLoginStatus {
  @IsOptional()
  @IsString()
  public userId!: string;

  @IsOptional()
  @IsString()
  public fairCode!: string;

  @IsOptional()
  @IsString()
  public fiscalYear!: string;

  @IsOptional()
  @IsString()
  public eoaFairId!: string;

  @IsNotEmpty()
  @IsEnum(MeetingRole)
  public role!: MeetingRole;
}
