import { IsString, IsNotEmpty, IsIn, IsOptional, IsDateString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

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
  @IsString()
  justification?: string;
}
