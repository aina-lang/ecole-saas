import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateTimetableSlotDto {
  @IsString()
  classId: string;

  @IsString()
  subjectId: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;
}
