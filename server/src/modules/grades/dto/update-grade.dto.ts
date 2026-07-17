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
  @IsIn(['EXAM', 'TEST', 'HOMEWORK', 'ORAL', 'PROJECT', 'CONTROLE', 'EXAMEN_BLANC'])
  evaluationType?: string;

  @IsOptional()
  @IsString()
  evaluationLabel?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;
}
