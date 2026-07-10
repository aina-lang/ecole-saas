import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('subjects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SubjectsController {
  constructor(private subjectsService: SubjectsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string, @Query('classId') classId?: string) {
    if (classId) {
      return this.subjectsService.findByClass(classId, tenantId);
    }
    return this.subjectsService.findAll(tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.subjectsService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateSubjectDto, @CurrentUser() user: any) {
    return this.subjectsService.create(tenantId, dto, user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.subjectsService.update(id, tenantId, dto, user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.subjectsService.remove(id, tenantId, user?.id);
  }
}
