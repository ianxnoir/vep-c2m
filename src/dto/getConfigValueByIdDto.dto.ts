import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { CONFIG } from "../modules/cbm/cbm.type";

export class GetConfigValueByIdDto {
  @ApiProperty({
    required: true,
    description: `the config id <br/> ${Object.entries(CONFIG).map(([index, value]: any) => {
      return `${value.id} = ${index} <br/>`
    }).toString().replace(/,/g, '')}`,
    example: 1,
    type: "int",
  })
  @IsNotEmpty()
  public id!: number;
}
