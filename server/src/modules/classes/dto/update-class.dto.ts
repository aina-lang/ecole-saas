import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  capacity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teacherIds?: string[];
}