import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { ClassesModule } from './modules/classes/classes.module';
import { GradesModule } from './modules/grades/grades.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { FinancesModule } from './modules/finances/finances.module';
import { UploadModule } from './modules/upload/upload.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SyncModule } from './modules/sync/sync.module';
import { TeacherAttendanceModule } from './modules/teacher-attendance/teacher-attendance.module';
import { TeacherContractsModule } from './modules/teacher-contracts/teacher-contracts.module';
import { TeacherPaymentsModule } from './modules/teacher-payments/teacher-payments.module';
import envConfig from './config/env.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    GradesModule,
    AttendanceModule,
    CommunicationsModule,
    FinancesModule,
    UploadModule,
    StatisticsModule,
    TimetableModule,
    SyncModule,
    TeacherAttendanceModule,
    TeacherContractsModule,
    TeacherPaymentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
