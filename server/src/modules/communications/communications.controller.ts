import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommunicationsService } from './communications.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('communications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CommunicationsController {
  constructor(private communicationsService: CommunicationsService) {}

  @Post('send')
  send(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.communicationsService.send(dto, userId, tenantId);
  }

  @Get('inbox')
  getInbox(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.communicationsService.getInbox(userId, tenantId, page, limit);
  }

  @Get('sent')
  getSent(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.communicationsService.getSent(userId, tenantId, page, limit);
  }

  @Get('conversation/:otherUserId')
  getConversation(
    @Param('otherUserId') otherUserId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communicationsService.getConversation(userId, otherUserId, tenantId);
  }

  @Post('broadcast/:classId')
  @Roles('ADMIN', 'TEACHER', 'SECRETARY', 'SUPER_ADMIN')
  broadcastToClass(
    @Param('classId') classId: string,
    @Body('subject') subject: string,
    @Body('body') body: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communicationsService.broadcastToClass(classId, subject, body, userId, tenantId);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communicationsService.findById(id, userId, tenantId);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communicationsService.markAsRead(id, userId, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communicationsService.remove(id, userId, tenantId);
  }
}