import { Controller, Get, Param, Query, UseGuards, Res, Header } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatisticsService } from './statistics.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';

@Controller('statistics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get('dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY')
  getDashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.statisticsService.getDashboard(tenantId);
  }

  @Get('attendance')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY')
  getAttendance(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
  ) {
    return this.statisticsService.getAttendanceStats(tenantId, period);
  }

  @Get('grades')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY', 'TEACHER')
  getGrades(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
  ) {
    return this.statisticsService.getGradeStats(tenantId, period);
  }

  @Get('financial')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getFinancial(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
  ) {
    return this.statisticsService.getFinancialStats(tenantId, period);
  }

  @Get('evolution')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getEvolution(
    @CurrentUser('tenantId') tenantId: string,
    @Query('years') years?: string,
  ) {
    return this.statisticsService.getStudentEvolution(tenantId, years ? parseInt(years, 10) : undefined);
  }

  @Get('export/:type')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Param('type') type: string,
    @CurrentUser('tenantId') tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.statisticsService.exportToExcel(tenantId, type);
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.csv"`);
    return csv;
  }
}
