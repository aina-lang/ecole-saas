import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mot de passe trop court' })
  password: string;

  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}
