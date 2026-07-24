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

  @IsOptional()
  @IsString()
  cnapsNumber?: string;

  @IsOptional()
  @IsString()
  ostieNumber?: string;

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
  @IsString()
  cnapsNumber?: string;

  @IsOptional()
  @IsString()
  ostieNumber?: string;

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
