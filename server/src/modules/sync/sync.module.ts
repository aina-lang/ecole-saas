import { Module, OnModuleInit } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncConfigController } from './sync-config.controller';
import { SyncService } from './sync.service';
import { SyncWorkerService } from './sync-worker.service';
import { SyncProcessor } from './sync.processor';
import { CouchDbModule } from '../couchdb/couchdb.module';
import { CouchDbService } from '../couchdb/couchdb.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [CouchDbModule],
  controllers: [SyncController, SyncConfigController],
  providers: [SyncService, SyncWorkerService, SyncProcessor],
  exports: [SyncService],
})
export class SyncModule implements OnModuleInit {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly couchDbService: CouchDbService,
  ) {}

  /**
   * Une fois tous les providers initialisés, on branche CouchDbService
   * comme writer du middleware Prisma (rupture #5 fix).
   * Approche setter pour éviter la dépendance circulaire PrismaModule↔CouchDbModule.
   */
  onModuleInit() {
    this.prismaService.setCouchDbWriter(this.couchDbService);
  }
}
