import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('grades')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GradesController {
  constructor(private gradesService: GradesService) {}

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classId') classId?: string,
    @Query('semester') semester?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.gradesService.findAll(tenantId, {
      studentId,
      subjectId,
      classId,
      semester: semester ? parseInt(semester, 10) : undefined,
      periodId,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.gradesService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateGradeDto, @CurrentUser() user: any) {
    return this.gradesService.create(tenantId, dto, user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER')
  update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateGradeDto, @CurrentUser() user: any) {
    return this.gradesService.update(id, tenantId, dto, user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.gradesService.remove(id, tenantId, user?.id);
  }

  @Post('class/:classId/bulk')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER')
  bulkCreate(
    @Param('classId') classId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() grades: CreateGradeDto[],
    @CurrentUser() user: any,
  ) {
    return this.gradesService.bulkCreateForClass(tenantId, classId, grades, user?.id);
  }

  @Get('student/:studentId/report')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'SECRETARY', 'PARENT')
  getStudentReport(@Param('studentId') studentId: string, @CurrentUser('tenantId') tenantId: string) {
    return this.gradesService.getStudentReport(studentId, tenantId);
  }

  @Post(':id/publish')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER')
  publish(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.gradesService.publish(id, tenantId, user?.id);
  }

  @Post(':id/unpublish')
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER')
  unpublish(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.gradesService.unpublish(id, tenantId, user?.id);
  }
}
