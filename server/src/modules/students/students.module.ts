import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, AuditService],
  exports: [StudentsService],
})
export class StudentsModule {}