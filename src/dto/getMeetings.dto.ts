import { Type, Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsEnum, Min, Max, IsDate, IsBoolean } from 'class-validator';
import { DateAfter } from '../decorators/validatation/dateAfter.decorator';

export enum GetMeetingsDtoStatus {
  PENDING_SELF_RESPOND = 'pending_self_respond',
  PENDING_OTHER_RESPOND = 'pending_other_respond',
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled'
}

export class GetMeetingsDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  public startTime!: string;

  @IsOptional()
  @DateAfter('startTime')
  @IsDate()
  @Type(() => Date)
  public endTime!: string;

  @IsOptional()
  @IsNotEmpty()
  @IsEnum(GetMeetingsDtoStatus)
  public status!: GetMeetingsDtoStatus;

  @IsOptional()
  @Min(1)
  @Type(() => Number)
  public page!: number;

  @IsOptional()
  @Min(1)
  @Max(150)
  @Type(() => Number)
  public limit!: number;

  @IsOptional()
  @IsBoolean()
  @Transform((v: TransformFnParams) => ['true', '1'].includes(String(v.value).toLowerCase()))
  public withCombinedFairs!: boolean;

  @IsOptional()
  public filteredDate?: string[];

  @IsOptional()
  @Type(() => String)
  public filteredFairCodes?: string[];

  @IsOptional()
  @Type(() => String)
  public language?: string;
}
