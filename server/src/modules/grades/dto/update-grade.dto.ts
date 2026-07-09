import { IsString, IsNumber, IsOptional, IsIn, Min, Max, IsInt } from 'class-validator';

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  coefficient?: number;

  @IsOptional()
  @IsString()
  @IsIn(['EXAM', 'TEST', 'HOMEWORK', 'ORAL', 'PROJECT'])
  evaluationType?: string;

  @IsOptional()
  @IsString()
  evaluationLabel?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;

  @IsOptional()
  @IsString()
  periodId?: string;
}
