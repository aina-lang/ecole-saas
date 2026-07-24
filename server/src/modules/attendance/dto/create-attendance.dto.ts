import { IsString, IsNotEmpty, IsIn, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { AttendanceStatus, HalfDay } from '@prisma/client';

export class CreateAttendanceDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsIn(Object.values(AttendanceStatus))
  status: AttendanceStatus;

  @IsOptional()
  @IsEnum(HalfDay)
  halfDay?: HalfDay;

  @IsOptional()
  @IsString()
  timetableSlotId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}
