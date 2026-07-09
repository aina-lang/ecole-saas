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
}

export class BulkAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecord)
  records: AttendanceRecord[];
}
