import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min, IsEnum } from 'class-validator';

export enum FeeTypeDto {
  TUITION = 'TUITION',
  ANNUAL = 'ANNUAL',
  OTHER = 'OTHER',
}

export class CreateFeeStructureDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  dueDay?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  levelId?: string;

  @IsOptional()
  @IsEnum(FeeTypeDto)
  feeType?: FeeTypeDto;
}
