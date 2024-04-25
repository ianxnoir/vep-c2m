import { IsNotEmpty } from 'class-validator';

export class TimeslotDto {
  @IsNotEmpty()
  public startTime!: Date;

  @IsNotEmpty()
  public endTime!: Date;

  @IsNotEmpty()
  public name?: string;

  @IsNotEmpty()
  public fairCode?: string;
}

export class GroupedTimeslotsDto {
  public date!: Date;

  public timeslots!: Array<any>;
}
