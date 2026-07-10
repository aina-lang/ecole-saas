import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class BulkRecordDto {
  @IsString()
  teacherId: string;

  @IsEnum(TeacherAttendanceStatus)
  status: TeacherAttendanceStatus;

  @IsOptional()
  @IsString()
  justification?: string;
}

export class BulkTeacherAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRecordDto)
  records: BulkRecordDto[];
}
