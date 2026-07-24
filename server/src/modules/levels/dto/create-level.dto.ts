import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLevelDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du niveau est requis' })
  name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}
