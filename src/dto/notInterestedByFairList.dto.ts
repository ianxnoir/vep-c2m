import { IsIn, IsNotEmpty } from 'class-validator';

export class NotInterestedByFairListRequestDto {
    @IsIn(["BUYER", "EXHIBITOR"])
    userType: string = "";

    @IsNotEmpty()
    fairs: string = "";
}
