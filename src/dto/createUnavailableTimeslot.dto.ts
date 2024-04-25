import { Type } from 'class-transformer';
import { IsDefined, IsArray, ValidateNested, IsDate, IsBoolean } from 'class-validator';
import { DateAfter } from '../decorators/validatation/dateAfter.decorator';

export class CreateUnavailableTimeslot {
  @DateAfter()
  @IsDate()
  @Type(() => Date)
  public startTime!: string;

  @DateAfter('startTime')
  @IsDate()
  @Type(() => Date)
  public endTime!: string;
}

export class CreateCIPUnavailableTimeslot {
  @IsDate()
  @Type(() => Date)
  public startTime!: string;

  @IsDate()
  @Type(() => Date)
  public endTime!: string;
}

export class CreateCIPUnavailableTimeslots {
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCIPUnavailableTimeslot)
  public data!: CreateCIPUnavailableTimeslot[];
}


export class CreateUnavailableTimeslotDtoData {
  @IsDate()
  @Type(() => Date)
  public date!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnavailableTimeslot)
  public timeslots!: CreateUnavailableTimeslot[];
}

export class CreateUnavailableTimeslotDto {
  @IsBoolean()
  
  public isDelete: boolean = false;
  public applyToAllDates: boolean = false;
  public applyDate!: string;


  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnavailableTimeslotDtoData)
  public data!: CreateUnavailableTimeslotDtoData[];
} 