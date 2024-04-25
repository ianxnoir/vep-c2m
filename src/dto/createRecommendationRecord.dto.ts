import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, IsObject } from 'class-validator';
import { PublishType, TargetType } from '../modules/c2m/recommendation/recommendation.type';

class CreateRecommendationRecordDtoData {
  @IsNotEmpty()
  public fairYear!: string;

  @IsNotEmpty()
  public ssoUid!: string;

  @IsNotEmpty()
  public targetId!: string;

  @IsNotEmpty()
  @IsEnum(TargetType)
  public targetType!: TargetType ;
}

export class CreateRecommendationRecordDto {
  public data!: CreateRecommendationRecordDtoData;
}


// ------------------------------------------------ BM List ------------------------------------------------
export interface CreateRecommendationRecordMustInterface {
  ssoUid: string;
  publishType: PublishType;
  fairYear: string;
  bmMessage?: string;
  targetList: TargetExhibitorPayload[];
}

export class CreateRecommendationRecordMustDto implements CreateRecommendationRecordMustInterface {
  @IsNotEmpty()
  @IsString()
  public ssoUid!: string;
  @IsNotEmpty()
  @IsString()
  public publishType!: PublishType;
  @IsNotEmpty()
  @IsString()
  public fairYear!: string;
  @IsOptional()
  @IsString()
  public bmMessage?: string;
  @IsNotEmpty()
  @IsArray()
  public targetList!: TargetExhibitorPayload[];
}

export interface TargetExhibitorPayload {
  ccdId: string;
  fairCode: string;
  fiscalYear: string;
}

export interface CheckDuplicateExhibitorsMustInterface {
  ssoUid: string;
  fairYear: string;
  targetList: TargetExhibitorPayload[];
}

export class CheckDuplicateExhibitorsMustDto implements CheckDuplicateExhibitorsMustInterface {
  @IsNotEmpty()
  @IsString()
  public ssoUid!: string;
  @IsNotEmpty()
  @IsString()
  public fairYear!: string;
  @IsNotEmpty()
  @IsArray()
  public targetList!: TargetExhibitorPayload[];
}
  // --------------------------------------------- end of BM List ---------------------------------------------

  // ----------------------------------- Admin Portal - BM List Management -----------------------------------
  export interface GetBMListManagementRecordMustInterface {
    pageNum: string,
    pageSize: string,
    orderBy: string,
    sortOrder: string,
    filterOption: GetBMListManagementRecorFilter,
  }

  export interface GetBMListManagementRecorFilter {
    arrangedOrPlanted?: string;
    bmResponse?: string;
    buyerBranchOffice?: string;
    buyerCompany?: string;
    buyerCountry?: string;
    buyerFairCode?: string;
    buyerFiscalyear?: string;
    buyerName?: string;
    buyerType?: string;
    eAvoidMarket?: string;
    exhibitorCompany?: string;
    exhibitorCountry?: string;
    exhibitorFairCode?: string;
    exhibitorName?: string;
    pavilion?: string;
    publish?: string;
    defaultBuyerSsoUid?: string;
    defaultFairCode?: string;
    defaultFiscalYear?: string;
  }

  export class GetBMListManagementRecordMustDto implements GetBMListManagementRecordMustInterface {
    @IsNotEmpty()
    @IsString()
    public pageNum!: string;
    @IsNotEmpty()
    @IsString()
    public pageSize!: string;
    @IsNotEmpty()
    @IsString()
    public orderBy!: string;
    @IsNotEmpty()
    @IsString()
    public sortOrder!: string;
    @IsNotEmpty()
    @IsObject()
    public filterOption!: GetBMListManagementRecorFilter;
  }
  // -------------------------------- end of Admin Portal - BM List Management --------------------------------