import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { CouchDbService } from '../couchdb/couchdb.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sync')
@UseGuards(AuthGuard('jwt'))
export class SyncConfigController {
  constructor(
    private configService: ConfigService,
    private couchdb: CouchDbService,
  ) {}

  // Identifiants CouchDB scopés au tenant de l'utilisateur authentifié — jamais
  // le compte admin global. Chaque tenant ne peut atteindre que ses propres
  // bases (document _security), donc il est sûr de renvoyer ces identifiants
  // au client dans tous les environnements (l'ancien mécanisme les masquait en
  // production, ce qui cassait purement et simplement la synchronisation).
  @Get('couchdb-config')
  async getCouchDbConfig(@CurrentUser('tenantId') tenantId: string) {
    const url = this.configService.get<string>('couchdb.url') || 'http://localhost:5984';
    const { user, pass } = await this.couchdb.ensureTenantProvisioned(tenantId);
    return { url, user, pass };
  }
}
