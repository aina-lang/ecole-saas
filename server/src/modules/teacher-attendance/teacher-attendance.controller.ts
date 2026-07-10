import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeacherAttendanceService } from './teacher-attendance.service';
import { CreateTeacherAttendanceDto, BulkTeacherAttendanceDto } from './dto/create-attendance.dto';

@Controller('teacher-attendance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeacherAttendanceController {
  constructor(private service: TeacherAttendanceService) {}

  @Get()
  findByDate(
    @CurrentUser('tenantId') tenantId: string,
    @Query('date') date: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (startDate && endDate) return this.service.findByPeriod(tenantId, startDate, endDate);
    return this.service.findByDate(tenantId, date || new Date().toISOString().split('T')[0]);
  }

  @Get('teacher/:teacherId')
  findByTeacher(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teacherId') teacherId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findByTeacher(tenantId, teacherId, startDate, endDate);
  }

  @Get('stats/:teacherId')
  getStats(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teacherId') teacherId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getStats(tenantId, teacherId, startDate, endDate);
  }

  @Post()
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  upsert(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTeacherAttendanceDto) {
    return this.service.upsert(tenantId, dto);
  }

  @Post('bulk')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  bulkUpsert(@CurrentUser('tenantId') tenantId: string, @Body() dto: BulkTeacherAttendanceDto) {
    return this.service.bulkUpsert(tenantId, dto);
  }
}
