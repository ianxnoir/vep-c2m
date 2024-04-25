import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MeetingRole, MeetingStatus, MeetingType, OnlineMeetingStatus, ResponseStatus } from '../modules/c2m/meeting/meeting.type';
import { SearchOption, SortingOption } from '../modules/cbm/cbm.type';
import { CBMPermission } from './cbmPermission.dto';

export class CBMFilterMeetingDtoData {
  // @IsOptional()
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => String)
  // public requesterSsoUid?: string[];

  // @IsOptional()
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => String)
  // public responderSsoUid?: string[];

  @IsString()
  @IsOptional()
  public startTime!: Date;

  @IsString()
  @IsOptional()
  public endTime!: Date;

  @IsOptional()
  @IsEnum(MeetingRole, { each: true })
  public assignerRole?: MeetingRole[];

  @IsOptional()
  @IsEnum(MeetingStatus, { each: true })
  public status?: MeetingStatus[];

  @IsOptional()
  @IsEnum(MeetingType, { each: true })
  public type?: MeetingType[];

  @IsOptional()
  @IsEnum(OnlineMeetingStatus, { each: true })
  public onlineMeetingStatus?: OnlineMeetingStatus[];

  @IsOptional()
  @IsBoolean({ each: true })
  public buyerAttendanceStatus?: boolean[];

  @IsOptional()
  @IsBoolean({ each: true })
  public exhibitorAttendanceStatus?: boolean[];

  @IsOptional()
  @IsEnum(ResponseStatus, { each: true })
  public buyerResponseStatus?: ResponseStatus[];

  @IsOptional()
  @IsEnum(ResponseStatus, { each: true })
  public exhibitorResponseStatus?: ResponseStatus[];

  @IsOptional()
  @IsString({ each: true })
  public buyerCountry?: string[];

  @IsOptional()
  @IsString({ each: true })
  public buyerBranchOffice?: string[];

  @IsOptional()
  @IsString({ each: true })
  public exhibitorFairName?: string[];

  @IsOptional()
  @IsString({ each: true })
  public exhibitorCountry?: string[];

  @IsOptional()
  @IsString({ each: true })
  public pavilion?: string[];

  @IsOptional()
  @IsString({ each: true })
  public ssoUid?: string[];

  @IsOptional()
  @IsString({ each: true })
  public agent?: string[];
}

export class PaginateOption {
  @IsNotEmpty()
  @IsNumber()
  public pageNum!: number;

  @IsNotEmpty()
  @IsNumber()
  public rowsPerPage!: number;
}

export class CBMPaginateMeetingDtoData {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMFilterMeetingDtoData)
  public filterOption!: CBMFilterMeetingDtoData;

  @IsOptional()
  public sortOption!: SortingOption;

  @IsOptional()
  public searchOption!: SearchOption;

  @IsOptional()
  public paginateOption!: PaginateOption;
}

export class CBMPaginateMeetingDto extends CBMPermission {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMPaginateMeetingDtoData)
  public data!: CBMPaginateMeetingDtoData;
}
