import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncConfigController } from './sync-config.controller';
import { SyncService } from './sync.service';
import { SyncWorkerService } from './sync-worker.service';
import { SyncProcessor } from './sync.processor';
import { CouchDbModule } from '../couchdb/couchdb.module';

@Module({
  imports: [CouchDbModule],
  controllers: [SyncController, SyncConfigController],
  providers: [SyncService, SyncWorkerService, SyncProcessor],
  exports: [SyncService],
})
export class SyncModule {}
