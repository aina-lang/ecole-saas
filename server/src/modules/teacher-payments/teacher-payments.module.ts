import { Module } from '@nestjs/common';
import { TeacherPaymentsController } from './teacher-payments.controller';
import { TeacherPaymentsService } from './teacher-payments.service';

@Module({
  controllers: [TeacherPaymentsController],
  providers: [TeacherPaymentsService],
  exports: [TeacherPaymentsService],
})
export class TeacherPaymentsModule {}
