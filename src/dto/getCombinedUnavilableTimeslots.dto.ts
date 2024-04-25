import { IsNotEmpty, IsOptional } from 'class-validator';

export class GetCombinedUnavailableTimeslotsDto {
  @IsOptional()
  public requesterSsoUid!: string;

  @IsNotEmpty()
  public responderSsoUid!: string;
}
