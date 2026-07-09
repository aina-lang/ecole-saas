import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('attendance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.findAll(tenantId, { studentId, classId, date, status, startDate, endDate });
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.attendanceService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.create(tenantId, dto, user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY')
  update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.update(id, tenantId, dto, user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.attendanceService.remove(id, tenantId, user?.id);
  }

  @Post('bulk')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY')
  bulkCreate(@CurrentUser('tenantId') tenantId: string, @Body() dto: BulkAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.bulkCreate(tenantId, dto, user?.id);
  }

  @Get('stats')
  getStats(
    @CurrentUser('tenantId') tenantId: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getStatistics(tenantId, { classId, studentId, startDate, endDate });
  }

  @Get('alerts/:studentId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY', 'PARENT')
  getAlerts(@Param('studentId') studentId: string, @CurrentUser('tenantId') tenantId: string, @Query('consecutive') consecutive?: string) {
    return this.attendanceService.detectAbsenceAlerts(studentId, tenantId, consecutive ? parseInt(consecutive, 10) : 3);
  }
}
