import { Controller, Get, UseGuards, ServiceUnavailableException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(SyncConfigController.name);

  @Get('couchdb-config')
  async getCouchDbConfig(@CurrentUser('tenantId') tenantId: string) {
    const url = this.configService.get<string>('couchdb.url') || 'http://localhost:5984';
    try {
      const { user, pass } = await this.couchdb.ensureTenantProvisioned(tenantId);
      // Trace volontaire : permet de vérifier qu'un poste a bien reçu ses
      // identifiants (sans eux, aucune réplication ne démarre côté client).
      this.logger.log(`couchdb-config servi au tenant ${tenantId} (${user})`);
      return { url, user, pass };
    } catch (err: any) {
      // Le seul échec bloquant ici est la création initiale de l'utilisateur
      // CouchDB (tenant jamais provisionné) alors que CouchDB est injoignable :
      // un 503 lisible plutôt qu'un 500 "fetch failed".
      this.logger.warn(`couchdb-config ${tenantId}: ${err.message}`);
      throw new ServiceUnavailableException(
        `Serveur de synchronisation (CouchDB) injoignable : ${url}. Réessayez plus tard.`,
      );
    }
  }
}
