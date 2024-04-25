import { Type } from 'class-transformer';
import { IsDefined, IsArray, ValidateNested } from 'class-validator';
import { CreateUnavailableTimeslotDtoData } from './createUnavailableTimeslot.dto';

export class UpcomingMeetingCollideDto {
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnavailableTimeslotDtoData)
  public data!: CreateUnavailableTimeslotDtoData[];
}
