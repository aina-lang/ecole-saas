import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TimetableService } from './timetable.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('timetable')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TimetableController {
  constructor(private timetableService: TimetableService) {}

  @Get()
  findByClass(@CurrentUser('tenantId') tenantId: string, @Query('classId') classId?: string) {
    if (!classId) return [];
    return this.timetableService.findByClass(classId, tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.timetableService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTimetableSlotDto, @CurrentUser() user: any) {
    return this.timetableService.create(tenantId, dto, user?.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateTimetableSlotDto, @CurrentUser() user: any) {
    return this.timetableService.update(id, tenantId, dto, user?.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.timetableService.remove(id, tenantId, user?.id);
  }
}
