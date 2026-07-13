import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BulletinsService } from './bulletins.service';

@Controller('bulletins')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BulletinsController {
  constructor(private bulletinsService: BulletinsService) {}

  @Post('class/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY')
  generateClassBulletins(
    @Param('id') classId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bulletinsService.generateClassBulletins(classId, tenantId, userId);
}


  @Post('student/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY', 'TEACHER')
  generateStudentBulletin(
    @Param('id') studentId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bulletinsService.generateStudentBulletin(studentId, tenantId, userId);
  }
}
