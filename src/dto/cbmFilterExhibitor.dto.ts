import { Type } from 'class-transformer';
import { IsDefined, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CBMPermission } from './cbmPermission.dto';

export class CBMSortingExhibitorDtoData {
  @IsOptional()
  @IsString()
  public field!: string;

  @IsOptional()
  @IsString()
  public sort!: string;
}

export class CBMPageExhibitorDtoData {
  @IsOptional()
  @IsNumber()
  public rowsPerPage!: number;

  @IsOptional()
  @IsNumber()
  public pageNum!: number;
}
export class CBMFilterExhibitorDtoData {
  @IsOptional()
  @IsString({ each: true })
  public companyCcdId!: string[]; // fair setting

  @IsOptional()
  @IsString({ each: true })
  public emailId!: string[]; // fair setting

  @IsOptional()
  @IsString({ each: true })
  public exhibitorParticipatingFair!: string[]; // fair setting

  @IsOptional()
  @IsString({ each: true })
  public exhibitorType!: string[]; // done

  @IsOptional()
  @IsString({ each: true })
  public pavilion!: string[]; // attribute

  @IsOptional()
  @IsString({ each: true })
  public zone!: string[]; // attribute

  @IsOptional()
  @IsString({ each: true })
  public country!: string[]; // done

  @IsOptional()
  @IsString({ each: true })
  public preferredMarket!: string[]; // question

  @IsOptional()
  @IsString({ each: true })
  public notPreferredMarket!: string[]; // question

  @IsOptional()
  @IsString({ each: true })
  public preferredNob!: string[]; // question
}

export class CBMBuyerDtoData {
  @IsOptional()
  @IsString()
  public ssoUid!: string;

  @IsOptional()
  @IsString()
  public fairCode!: string;

  @IsOptional()
  @IsString()
  public fiscalYear!: string;
}

export class CBMPaginateExhibitorDtoData {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMFilterExhibitorDtoData)
  public filterOption!: CBMFilterExhibitorDtoData;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMSortingExhibitorDtoData)
  public sortingOption!: CBMSortingExhibitorDtoData;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMPageExhibitorDtoData)
  public paginateOption!: CBMPageExhibitorDtoData;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMPageExhibitorDtoData)
  public buyerProfile!: CBMBuyerDtoData;
}

export class CBMPaginateExhibitorDto extends CBMPermission {
  @IsDefined()
  @ValidateNested()
  @Type(() => CBMPaginateExhibitorDtoData)
  public data!: CBMPaginateExhibitorDtoData;
}
