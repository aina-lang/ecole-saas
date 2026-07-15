import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';
import { ResolveConflictDto } from './dto/sync-batch.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sync')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('device')
  registerDevice(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Body('deviceId') deviceId: string,
    @Body('deviceName') deviceName: string,
  ) {
    return this.syncService.registerDevice(tenantId, deviceId, deviceName, user?.id);
  }

  @Post('conflicts/:id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  resolveConflict(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.syncService.resolveConflict(tenantId, id, dto, user?.id);
  }

  @Get('conflicts')
  listConflicts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.syncService.listConflicts(tenantId, page || 1, limit || 50);
  }

  @Get('status')
  getSyncStatus(@CurrentUser('tenantId') tenantId: string) {
    return this.syncService.getSyncStatus(tenantId);
  }
}
