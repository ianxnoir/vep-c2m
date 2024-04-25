import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface SendbirdLicenseOptionalInterface {
  referenceKey?: string;
  userId?: string;
}

export interface SendbirdLicenseMustInterface {
  meetingId: string;
}

export class SendbirdLicenseOptionalDto implements SendbirdLicenseOptionalInterface {
  @IsOptional()
  @IsString()
  public referenceKey!: string;
  @IsOptional()
  @IsString()
  public userId!: string;
}

export class SendbirdLicenseMustDto implements SendbirdLicenseMustInterface {
  @IsNotEmpty()
  @IsString()
  public meetingId!: string;
}
