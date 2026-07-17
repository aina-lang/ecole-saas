import { IsEmail, IsString, IsNotEmpty, IsOptional, IsArray, ArrayMaxSize, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  password?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 numéros autorisés' })
  @IsString({ each: true })
  phones?: string[];

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];
}
