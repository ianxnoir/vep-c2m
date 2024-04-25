import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface ZOOMLicenseOptionalInterface {
  accountEmail: string;
}

export interface ZOOMLicenseMustInterface {
  meetingId: string;
}

export class ZOOMLicenseOptionalDto implements ZOOMLicenseOptionalInterface {
  @IsOptional()
  @IsString()
  public accountEmail!: string;
}

export class ZOOMLicenseMustDto implements ZOOMLicenseMustInterface {
  @IsNotEmpty()
  @IsString()
  public meetingId!: string;
}
