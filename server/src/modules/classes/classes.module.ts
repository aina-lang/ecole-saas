import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { SubjectsService } from './subjects.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ClassesController],
  providers: [ClassesService, SubjectsService],
  exports: [ClassesService, SubjectsService],
})
export class ClassesModule {}