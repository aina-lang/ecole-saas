import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('teachers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.teachersService.findAll(tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.teachersService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateTeacherDto,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.create(tenantId, dto, user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.update(id, tenantId, dto, user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.remove(id, tenantId, user?.id);
  }
}
