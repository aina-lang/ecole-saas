import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MinLength } from 'class-validator';
import { LicenseService } from './license.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SkipSubscriptionCheck } from '../../common/decorators/skip-subscription-check.decorator';

class ActivateLicenseDto {
  @IsString()
  @MinLength(16)
  code!: string;
}

// Un tenant en lecture seule (essai ou licence expirée) doit pouvoir consulter
// son statut et saisir une clé — sinon il n'a aucun moyen d'en sortir.
@Controller('license')
@UseGuards(AuthGuard('jwt'))
@SkipSubscriptionCheck()
export class LicenseController {
  constructor(private license: LicenseService) {}

  @Get('status')
  getStatus(@CurrentUser('tenantId') tenantId: string) {
    return this.license.getStatus(tenantId);
  }

  @Post('activate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  activate(@CurrentUser('tenantId') tenantId: string, @Body() dto: ActivateLicenseDto) {
    return this.license.activate(tenantId, dto.code);
  }
}
