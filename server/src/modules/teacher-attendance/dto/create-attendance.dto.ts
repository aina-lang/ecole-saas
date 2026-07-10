import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum TeacherAttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export class CreateTeacherAttendanceDto {
  @IsString()
  teacherId: string;

  @IsDateString()
  date: string;

  @IsEnum(TeacherAttendanceStatus)
  status: TeacherAttendanceStatus;

  @IsOptional()
  @IsString()
  justification?: string;
}

export class BulkTeacherAttendanceDto {
  @IsDateString()
  date: string;

  records: { teacherId: string; status: TeacherAttendanceStatus; justification?: string }[];
}
