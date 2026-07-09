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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('students')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Get()
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: QueryStudentDto,
  ) {
    return this.studentsService.findAll(tenantId, query);
  }

  @Get('deleted')
  @Roles('ADMIN', 'SECRETARY')
  findDeleted(@CurrentUser('tenantId') tenantId: string) {
    return this.studentsService.findDeleted(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
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
}