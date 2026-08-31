import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tenants')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // Déclaré avant @Get(':id') : le tenant vient du jeton, jamais de l'URL, et
  // aucun @Roles n'est posé — tous les rôles y ont accès (voir le service).
  @Get('me/setup-state')
  getSetupState(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getSetupState(tenantId);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  findById(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Get(':id/stats')
  @Roles('SUPER_ADMIN', 'ADMIN')
  getStats(@Param('id') id: string) {
    return this.tenantsService.getStats(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Post(':id/academic-years')
  @Roles('SUPER_ADMIN', 'ADMIN')
  createAcademicYear(
    @Param('id') id: string,
    @Body() body: { label: string }
  ) {
    return this.tenantsService.createAcademicYear(id, body.label);
  }

  @Post(':id/suspend')
  @Roles('SUPER_ADMIN')
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id);
  }

  @Post(':id/activate')
  @Roles('SUPER_ADMIN')
  activate(@Param('id') id: string) {
    return this.tenantsService.activate(id);
  }
}
