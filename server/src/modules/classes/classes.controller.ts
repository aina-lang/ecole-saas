import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClassesService } from './classes.service';
import { SubjectsService } from './subjects.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('classes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClassesController {
  constructor(
    private classesService: ClassesService,
    private subjectsService: SubjectsService,
  ) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.classesService.findAll(tenantId);
  }

  @Get('teachers')
  getAvailableTeachers(@CurrentUser('tenantId') tenantId: string) {
    return this.classesService.getAvailableTeachers(tenantId);
  }

  @Get('timetable-structure')
  getTimetableStructure(@CurrentUser('tenantId') tenantId: string) {
    return this.classesService.getTimetableStructure(tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.classesService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateClassDto,
  ) {
    return this.classesService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(id, tenantId, dto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classesService.remove(id, tenantId, userId);
  }

  @Post(':id/teachers/:teacherId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  assignTeacher(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classesService.assignTeacher(id, teacherId, tenantId, userId);
  }

  @Delete(':id/teachers/:teacherId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  removeTeacher(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classesService.removeTeacher(id, teacherId, tenantId, userId);
  }

  @Post(':id/subjects/:subjectId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  assignSubject(
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classesService.assignSubject(id, subjectId, tenantId, userId);
  }

  @Delete(':id/subjects/:subjectId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  removeSubject(
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.classesService.removeSubject(id, subjectId, tenantId, userId);
  }

  @Get(':id/subjects')
  findSubjectsByClass(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.subjectsService.findByClass(id, tenantId);
  }
}