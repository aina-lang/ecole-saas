import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, IsBoolean, Min } from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateTeacherContractDto {
  @IsString()
  teacherId: string;

  @IsEnum(ContractType)
  contractType: ContractType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeacherContractDto {
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
