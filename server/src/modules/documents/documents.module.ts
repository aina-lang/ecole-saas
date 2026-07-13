import { Module } from '@nestjs/common';
import { BulletinsService } from './bulletins.service';
import { BulletinsController } from './bulletins.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GradesModule } from '../grades/grades.module';

@Module({
  imports: [PrismaModule, GradesModule],
  controllers: [BulletinsController],
  providers: [BulletinsService],
  exports: [BulletinsService],
})
export class DocumentsModule {}
