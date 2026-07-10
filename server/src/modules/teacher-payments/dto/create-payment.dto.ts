import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateTeacherPaymentDto {
  @IsString()
  teacherId: string;

  @IsString()
  periodLabel: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CalculateTeacherPaymentDto {
  @IsString()
  teacherId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;
}
