import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeacherScopeService } from '../../common/scope/teacher-scope.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('students')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StudentsController {
  constructor(private studentsService: StudentsService,
    private scope: TeacherScopeService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: QueryStudentDto,
    @CurrentUser() user: any,
  ) {
    // Enseignant : uniquement les élèves de ses classes.
    const classFilter = await this.scope.classFilter(user, query.classId);
    return this.studentsService.findAll(tenantId, { ...query, classId: classFilter as any });
  }

  @Get('deleted')
  @Roles('ADMIN', 'SECRETARY')
  findDeleted(@CurrentUser('tenantId') tenantId: string) {
    return this.studentsService.findDeleted(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  async findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    await this.scope.assertStudent(user, id);
    return this.studentsService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SECRETARY')
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateStudentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studentsService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SECRETARY')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studentsService.update(id, tenantId, dto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARY')
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studentsService.remove(id, tenantId, userId);
  }

  @Post(':id/restore')
  @Roles('ADMIN', 'SECRETARY')
  restore(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studentsService.restore(id, tenantId, userId);
  }

  @Post(':id/photo')
  @Roles('ADMIN', 'SECRETARY')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.studentsService.uploadPhoto(id, tenantId, file);
  }

  @Delete(':id/photo')
  @Roles('ADMIN', 'SECRETARY')
  deletePhoto(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.studentsService.deletePhoto(id, tenantId);
  }
}