import { IsString, IsOptional, IsNumber, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la matière est requis' })
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  coefficient?: number = 1.0;

  @IsOptional()
  @IsString()
  classId?: string;
}