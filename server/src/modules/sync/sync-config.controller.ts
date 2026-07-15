import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('sync')
@UseGuards(AuthGuard('jwt'))
export class SyncConfigController {
  constructor(private configService: ConfigService) {}

  @Get('couchdb-config')
  getCouchDbConfig() {
    const url = this.configService.get<string>('couchdb.url') || 'http://localhost:5984';
    const user = this.configService.get<string>('couchdb.user') || '';
    const pass = this.configService.get<string>('couchdb.pass') || '';

    // En production, ne jamais exposer les credentials globaux CouchDB au client.
    // Le frontend devrait s'authentifier via un proxy ou des credentials par tenant.
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      url,
      user: isProduction ? '' : user,
      pass: isProduction ? '' : pass,
    };
  }
}
