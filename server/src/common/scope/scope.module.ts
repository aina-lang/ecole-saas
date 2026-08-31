import { Global, Module } from '@nestjs/common';
import { TeacherScopeService } from './teacher-scope.service';

@Global()
@Module({ providers: [TeacherScopeService], exports: [TeacherScopeService] })
export class ScopeModule {}
