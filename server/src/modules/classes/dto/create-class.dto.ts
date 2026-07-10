import { IsString, IsOptional, IsInt, Min, IsNotEmpty, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la classe est requis' })
  name: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number = 30;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teacherIds?: string[];
}