import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { FinancesService } from './finances.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('finances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FinancesController {
  constructor(private financesService: FinancesService) {}

  @Get('export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="paiements.csv"')
  async exportCsv(@CurrentUser('tenantId') tenantId: string) {
    return this.financesService.exportCsv(tenantId);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.financesService.getDashboard(tenantId);
  }

  @Get('overdue')
  getOverduePayments(@CurrentUser('tenantId') tenantId: string) {
    return this.financesService.getOverduePayments(tenantId);
  }

  @Post('fees')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  createFeeStructure(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFeeStructureDto,
  ) {
    return this.financesService.createFeeStructure(tenantId, dto, userId);
  }

  @Get('fees')
  findAllFeeStructures(@CurrentUser('tenantId') tenantId: string) {
    return this.financesService.findAllFeeStructures(tenantId);
  }

  @Get('fees/:id')
  findFeeStructureById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.financesService.findFeeStructureById(id, tenantId);
  }

  @Patch('fees/:id')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  updateFeeStructure(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateFeeStructureDto>,
  ) {
    return this.financesService.updateFeeStructure(id, tenantId, dto, userId);
  }

  @Delete('fees/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteFeeStructure(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.financesService.deleteFeeStructure(id, tenantId, userId);
  }

  @Post('payments')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  createPayment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.financesService.createPayment(tenantId, dto, userId);
  }

  @Get('payments')
  findAllPayments(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financesService.findAllPayments(tenantId, page, limit);
  }

  @Get('payments/:id')
  findPaymentById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.financesService.findPaymentById(id, tenantId);
  }

  @Patch('payments/:id')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  updatePayment(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreatePaymentDto>,
  ) {
    return this.financesService.updatePayment(id, tenantId, dto, userId);
  }

  @Delete('payments/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deletePayment(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.financesService.deletePayment(id, tenantId, userId);
  }

  @Post('payments/:id/record-payment')
  @Roles('ADMIN', 'SECRETARY', 'SUPER_ADMIN')
  recordPayment(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body('paidAmount') paidAmount: number,
    @Body('paymentMethod') paymentMethod?: string,
    @Body('reference') reference?: string,
  ) {
    return this.financesService.recordPayment(id, tenantId, paidAmount, paymentMethod, reference, userId);
  }

  @Get('students/:studentId/balance')
  getStudentBalance(
    @Param('studentId') studentId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.financesService.getStudentBalance(studentId, tenantId);
  }
}