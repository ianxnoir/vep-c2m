import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsEnum, ValidateIf, IsDate, IsBoolean } from 'class-validator';
import { DateAfter } from '../decorators/validatation/dateAfter.decorator';
import { MeetingType, MeetingRole } from '../modules/c2m/meeting/meeting.type';

export class CommonCreateMeetingDtoData {
  @IsOptional()
  public name!: string;

  @IsOptional()
  @IsNotEmpty()
  public message!: string;

  @IsEnum(MeetingType) 
  public type!: MeetingType;

  @ValidateIf((data: CommonCreateMeetingDtoData) => data.type === MeetingType.F2F)
  @IsNotEmpty()
  public f2fLocation!: MeetingType;

  @IsOptional()
  public requesterFirstName!: string;

  @IsOptional()
  public requesterLastName!: string;

  @IsEnum(MeetingRole)
  @IsNotEmpty()
  public requesterRole!: MeetingRole;

  @IsOptional()
  public responderFirstName!: string;

  @IsOptional()
  public responderLastName!: string;

  @IsNotEmpty()
  public responderSsoUid!: string;

  @IsEnum(MeetingRole)
  @IsNotEmpty()
  public responderRole!: MeetingRole;

  @IsOptional()
  public requesterCompanyName!: string;

  @IsOptional()
  public requesterSupplierUrn!: string;

  @IsOptional()
  public requesterExhibitorUrn!: string;

  @IsOptional()
  public requesterCountryCode!: string;

  @IsOptional()
  public requesterCompanyLogo!: string;

  @IsOptional()
  public responderCompanyName!: string;

  @IsOptional()
  public responderSupplierUrn!: string;

  @IsOptional()
  public responderExhibitorUrn!: string;

  @IsOptional()
  public responderCountryCode!: string;

  @IsOptional()
  public responderCompanyLogo!: string;

  @IsNotEmpty()
  public responderFairCode!: string;

  @IsNotEmpty()
  public responderFiscalYear!: string;

  // @DateAfter()
  @IsDate()
  @Type(() => Date)
  public startTime!: string;

  @DateAfter('startTime')
  @IsDate()
  @Type(() => Date)
  public endTime!: string;

  @IsBoolean()
  public isSkipSeminarChecking!: boolean;
}
