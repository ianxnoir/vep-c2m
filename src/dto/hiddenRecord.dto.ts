import { IsEnum, IsNotEmpty } from 'class-validator';
import { HiddenType } from '../modules/c2m/hiddenRecord/hiddenRecord.type';

class SetHiddenRecordDtoData {
  @IsNotEmpty()
  public hiddenTarget!: string;

  @IsNotEmpty()
  @IsEnum(HiddenType)
  public hiddenType!: HiddenType;

  @IsNotEmpty()
  public fairYear!: string;
}

export class SetHiddenRecordDto {
  public data!: SetHiddenRecordDtoData;
}
