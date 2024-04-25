import { IsNotEmpty, IsOptional } from 'class-validator';

export class seminarRegistrationDto {
  @IsNotEmpty()
  public userData!: UserData[];

  @IsNotEmpty()
  public eventId!: string;

  @IsNotEmpty()
  public systemCode!: string;

  @IsNotEmpty()
  public seminarReg!: SeminarAnswersWithSeminarId[]
}

export class SeminarAnswersWithSeminarId {
  @IsNotEmpty()
  public seminarId!: string;

  @IsOptional()
  public isCheckedOption1!: string;

  @IsOptional()
  public isCheckedOption2!: string;

  @IsOptional()
  public isCheckedOption3!: string;

  @IsOptional()
  public option1Ans!: string;

  @IsOptional()
  public option2Ans!: string;

  @IsOptional()
  public option3Ans!: string;

}

export class UserData {
  @IsNotEmpty()
  public fairCode!: string;

  @IsNotEmpty()
  public fiscalYear!:string

  @IsNotEmpty()
  public userId!: string

  @IsNotEmpty()
  public registrationNo!: string
}
