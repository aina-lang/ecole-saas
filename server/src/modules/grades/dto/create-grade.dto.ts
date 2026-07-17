import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min, Max, IsInt } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxValue?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  coefficient?: number = 1;

  @IsOptional()
  @IsString()
  @IsIn(['EXAM', 'TEST', 'HOMEWORK', 'ORAL', 'PROJECT', 'CONTROLE', 'EXAMEN_BLANC'])
  evaluationType?: string = 'EXAM';

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
