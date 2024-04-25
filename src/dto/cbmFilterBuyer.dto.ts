import { Type } from 'class-transformer';
import { IsDefined, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CBMPermission } from './cbmPermission.dto';

export class CBMSortingBuyerDtoData {}
export class CBMFilterBuyerDtoData {
  @IsOptional()
  @IsString({ each: true })
  public buyerType!: string;

  @IsOptional()
  @IsString({ each: true })
  public country!: string;

  @IsOptional()
  @IsString({ each: true })
  public branchOffice!: string;

  @IsOptional()
  @IsString({ each: true })
  public ssoUid!: string;

  @IsOptional()
  @IsString({ each: true })
  public emailId!: string;
}

export class CBMPageBuyerDtoData {
  @IsOptional()
  @IsNumber()
  public rowsPerPage!: number;

  @IsOptional()
  @IsNumber()
  public pageNum!: number;
}

export class CBMPaginateBuyerDtoData {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMFilterBuyerDtoData)
  public filterOption!: CBMFilterBuyerDtoData;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMSortingBuyerDtoData)
  public sortingOption!: CBMSortingBuyerDtoData;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMSortingBuyerDtoData)
  public paginateOption!: CBMPageBuyerDtoData;
}

export class CBMPaginateBuyerDto extends CBMPermission {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMPaginateBuyerDtoData)
  public data!: CBMPaginateBuyerDtoData;
}
