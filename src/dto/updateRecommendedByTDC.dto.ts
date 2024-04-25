import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { InterestedStatus } from '../modules/c2m/recommendation/recommendation.type';

export interface RecommendedByTDCMustInterface {
  fairYear: string;
  ccdId: string;
  itemId: number;
  interestedStatus: InterestedStatus;
}

export class UpdateRecommendedByTDCMustDto implements RecommendedByTDCMustInterface {
  @IsNotEmpty()
  @IsString()
  public fairYear!: string;
  @IsNotEmpty()
  @IsString()
  public ccdId!: string;
  @IsNotEmpty()
  @IsNumber()
  public itemId!: number;
  @IsNotEmpty()
  @IsEnum(InterestedStatus)
  public interestedStatus!: InterestedStatus;
}
