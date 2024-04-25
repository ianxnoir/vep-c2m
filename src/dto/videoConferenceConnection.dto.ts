import { Optional } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

// Super Class
class ConnectionPayloadDto {}

// Sub Class
class ConnectionConfirmExtendMeetingDto extends ConnectionPayloadDto {
  @IsNotEmpty()
  public isSkipSeminarChecking!: boolean;
}

// Sub Class
class ConnectionTargetPayloadDto extends ConnectionPayloadDto {
  @IsNotEmpty()
  public targetConnectionId!: string;
}

// Sub Class
class ConnectionRenamePayloadDto extends ConnectionPayloadDto {
  @IsNotEmpty()
  public displayName!: string;
}

// Sub Class
class ConnectionSyncNetworkLevelPayloadDto extends ConnectionPayloadDto {
  @IsNotEmpty()
  public networkLevel!: string;
}

// Sub Class
class ConnectionSyncConnectionTestingPayloadDto extends ConnectionPayloadDto {
  @IsNotEmpty()
  public isTesting!: boolean;
}

export class ConnectionHandleDto {
  @IsNotEmpty()
  public connectionId!: string;

  @IsNotEmpty()
  public jwtToken!: string;

  @Optional()
  public connectionIdInCookies!: string;
}

export class DisconnectHandleDto {
  @IsNotEmpty()
  public connectionId!: string;
}

// Super Class
export class ConnectionActionDto {
  @IsOptional()
  public connectionId!: string;

  @IsNotEmpty()
  public jwtToken!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionPayloadDto)
  public payload!: ConnectionPayloadDto;
}

// Sub Class
export class ConnectionConfirmExtendMeetingActionDto extends ConnectionActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionConfirmExtendMeetingDto)
  public payload!: ConnectionConfirmExtendMeetingDto;
}

// Sub Class
export class ConnectionTargetActionDto extends ConnectionActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionTargetPayloadDto)
  public payload!: ConnectionTargetPayloadDto;
}

// Sub Class
export class ConnectionRenameActionDto extends ConnectionActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionRenamePayloadDto)
  public payload!: ConnectionRenamePayloadDto;
}

// Sub Class
export class ConnectionSyncNetworkLevelActionDto extends ConnectionActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionSyncNetworkLevelPayloadDto)
  public payload!: ConnectionSyncNetworkLevelPayloadDto;
}

// Sub Class
export class ConnectionSyncConnectionTestingActionDto extends ConnectionActionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionSyncConnectionTestingPayloadDto)
  public payload!: ConnectionSyncConnectionTestingPayloadDto;
}
