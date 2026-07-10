import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeacherPaymentsService } from './teacher-payments.service';
import { CreateTeacherPaymentDto, CalculateTeacherPaymentDto } from './dto/create-payment.dto';

@Controller('teacher-payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeacherPaymentsController {
  constructor(private service: TeacherPaymentsService) {}

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.service.findAll(tenantId, teacherId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTeacherPaymentDto) {
    return this.service.create(tenantId, dto);
  }

  @Post('calculate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  calculate(@CurrentUser('tenantId') tenantId: string, @Body() dto: CalculateTeacherPaymentDto) {
    return this.service.calculate(tenantId, dto);
  }

  @Post(':id/mark-paid')
  @Roles('ADMIN', 'SUPER_ADMIN')
  markAsPaid(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.markAsPaid(id, tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
