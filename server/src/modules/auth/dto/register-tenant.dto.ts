import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de l\'école est requis' })
  schoolName: string;

  @IsEmail({}, { message: 'Email invalide' })
  adminEmail: string;

  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  adminLastName: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  adminPassword: string;

  /**
   * Empreinte SHA-256 (hex) de l'identifiant de la machine, calculée par
   * l'application desktop. Facultative ici pour que les anciennes versions
   * reçoivent un message clair (« mettez à jour ») plutôt qu'une erreur de
   * validation : c'est le service qui l'exige.
   */
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Identifiant d\'appareil invalide' })
  deviceId?: string;
}
