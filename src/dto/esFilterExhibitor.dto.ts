import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ExhibitorQueryDto {
    @IsOptional()
    public fairCodes?: string[];

    @IsString()
    public fairCode!: string;

    @IsString()
    public lang?: string = 'EN';

    @IsString()
    public browserCountry?: string;

    @IsNumber()
    @Type(() => Number)
    public from: number = 0;

    @IsNumber()
    @Type(() => Number)
    public size: number = 10;

    @IsString()
    public keyword?: string;

    // Search Filter
    @IsOptional()
    @IsArray()
    public filterCountry?: string[];

    @IsOptional()
    @IsArray()
    public filterExhibitorType?: string[];

    @IsOptional()
    @IsArray()
    public filterZone?: string[];

    @IsOptional()
    @IsArray()
    public filterPavilion?: string[];

    @IsOptional()
    @IsArray()
    public filterNob?: string[];

    @IsOptional()
    @IsArray()
    public filterProductStrategy?: string[];

    @IsOptional()
    @IsArray()
    public filterCertification?: string[];

    @IsOptional()
    @IsArray()
    public filterFactoryLocation?: string[];

    @IsOptional()
    @IsArray()
    public filterWineProducingRegion?: string[];

    @IsOptional()
    public filterExhibitorNameStartWith?: string;

    @IsOptional()
    @IsArray()
    public filterExcludedCCDID?: string[];

    @IsOptional()
    @IsArray()
    public filterRecommendedCCDID?: string[];
}
