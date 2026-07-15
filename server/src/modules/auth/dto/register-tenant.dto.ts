import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de l\'école est requis' })
  schoolName: string;

  @IsEmail({}, { message: 'Email invalide' })
  adminEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  adminFirstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  adminLastName: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  adminPassword: string;
}
