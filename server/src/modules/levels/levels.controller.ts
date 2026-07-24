import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LevelsService } from './levels.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('levels')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LevelsController {
  constructor(private levelsService: LevelsService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.levelsService.findAll(tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.levelsService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateLevelDto) {
    return this.levelsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateLevelDto) {
    return this.levelsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.levelsService.remove(id, tenantId);
  }
}
