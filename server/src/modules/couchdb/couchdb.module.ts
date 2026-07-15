import { Module, Global } from '@nestjs/common';
import { CouchDbService } from './couchdb.service';

@Global()
@Module({
  providers: [CouchDbService],
  exports: [CouchDbService],
})
export class CouchDbModule {}
