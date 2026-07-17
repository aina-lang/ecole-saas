import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsNotEmpty,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StudentParentLinkDto {
  @IsString()
  parentId: string;

  @IsOptional()
  @IsIn(['PARENT', 'TUTEUR'], { message: 'Relation invalide (PARENT ou TUTEUR)' })
  relation?: 'PARENT' | 'TUTEUR';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentParentLinkDto)
  parents?: StudentParentLinkDto[];

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}