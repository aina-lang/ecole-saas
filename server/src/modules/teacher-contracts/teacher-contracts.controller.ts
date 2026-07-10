import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeacherContractsService } from './teacher-contracts.service';
import { CreateTeacherContractDto, UpdateTeacherContractDto } from './dto/create-contract.dto';

@Controller('teacher-contracts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeacherContractsController {
  constructor(private service: TeacherContractsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get('teacher/:teacherId')
  findByTeacher(@CurrentUser('tenantId') tenantId: string, @Param('teacherId') teacherId: string) {
    return this.service.findByTeacher(tenantId, teacherId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTeacherContractDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateTeacherContractDto,
  ) {
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
