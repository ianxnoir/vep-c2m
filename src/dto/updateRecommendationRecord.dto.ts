import { IsEnum, IsNotEmpty } from 'class-validator';
import { InterestedStatus } from '../modules/c2m/recommendation/recommendation.type';

class UpdateRecommendationRecordDtoData {
  @IsNotEmpty()
  @IsEnum(InterestedStatus)
  public interestedStatus!: InterestedStatus;

  @IsNotEmpty()
  public fairYear!: string;
}

export class UpdateRecommendationRecordDto {
  public data!: UpdateRecommendationRecordDtoData;
}
