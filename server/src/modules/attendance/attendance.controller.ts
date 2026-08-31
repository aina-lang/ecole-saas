import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeacherScopeService } from '../../common/scope/teacher-scope.service';

@Controller('attendance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService,
    private scope: TeacherScopeService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (studentId) await this.scope.assertStudent(user, studentId);
    const classFilter = await this.scope.classFilter(user, classId);
    return this.attendanceService.findAll(tenantId, { studentId, classId: classFilter, date, status, startDate, endDate });
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.attendanceService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY')
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateAttendanceDto, @CurrentUser() user: any) {
    await this.scope.assertStudent(user, dto.studentId);
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
  async bulkCreate(@CurrentUser('tenantId') tenantId: string, @Body() dto: BulkAttendanceDto, @CurrentUser() user: any) {
    let teacherId: string | null = null;
    if (this.scope.isTeacher(user)) {
      const classIds = Array.from(new Set(dto.records.map((r) => r.classId).filter(Boolean))) as string[];
      for (const cid of classIds) await this.scope.assertClass(user, cid);
      for (const r of dto.records.filter((r) => !r.classId)) await this.scope.assertStudent(user, r.studentId);
      // Un enseignant ne fait l'appel que pendant son cours : créneau obligatoire.
      const slotIds = Array.from(new Set(dto.records.map((r) => r.timetableSlotId).filter(Boolean))) as string[];
      if (slotIds.length !== 1) throw new ForbiddenException("L'appel se fait depuis votre cours en cours (emploi du temps)");
      const slot = await this.scope.assertSlotNow(user, slotIds[0], classIds[0], dto.recordedAt);
      for (const r of dto.records) { if (!r.subjectId && slot?.subjectId) r.subjectId = slot.subjectId; }
      teacherId = (await this.scope.teacherOf(user))?.id ?? null;
    }
    return this.attendanceService.bulkCreate(tenantId, dto, user?.id, teacherId);
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
