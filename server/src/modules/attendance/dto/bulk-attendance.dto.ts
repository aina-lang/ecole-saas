import { IsString, IsNotEmpty, IsDateString, IsArray, ValidateNested, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

class AttendanceRecord {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsIn(Object.values(AttendanceStatus))
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  /** Créneau d'emploi du temps pendant lequel l'appel est fait (mobile). */
  @IsOptional()
  @IsString()
  timetableSlotId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class BulkAttendanceDto {
  @IsDateString()
  date: string;

  /** Moment de la saisie (ISO) — un appel fait hors ligne pendant le cours et
   * envoyé plus tard est validé sur cet instant, pas sur l'heure de réception. */
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecord)
  records: AttendanceRecord[];
}
