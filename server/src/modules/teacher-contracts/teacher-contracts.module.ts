import { Module } from '@nestjs/common';
import { TeacherContractsController } from './teacher-contracts.controller';
import { TeacherContractsService } from './teacher-contracts.service';

@Module({
  controllers: [TeacherContractsController],
  providers: [TeacherContractsService],
  exports: [TeacherContractsService],
})
export class TeacherContractsModule {}
