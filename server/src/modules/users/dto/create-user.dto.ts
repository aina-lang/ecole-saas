import { IsEmail, IsString, IsEnum, MinLength, IsNotEmpty, IsOptional, IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
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

  @IsEnum(UserRole, { message: 'Rôle invalide' })
  role: UserRole;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 numéros autorisés' })
  @IsString({ each: true })
  phones?: string[];

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
