import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('sync')
export class SyncConfigController {
  constructor(private configService: ConfigService) {}

  @Get('couchdb-config')
  getCouchDbConfig() {
    return {
      url: this.configService.get<string>('couchdb.url') || 'http://localhost:5984',
      user: this.configService.get<string>('couchdb.user') || '',
      pass: this.configService.get<string>('couchdb.pass') || '',
    };
  }
}
