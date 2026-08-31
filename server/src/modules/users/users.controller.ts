import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll(tenantId, {
      search,
      role,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findById(id, tenantId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: UpdateUserDto,
  ) {
    // Garde-fou serveur : on ne change pas son propre rôle (ni ne se désactive).
    if (id === currentUserId) {
      if (dto.role !== undefined) throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle');
      if (dto.isActive === false) throw new ForbiddenException('Vous ne pouvez pas désactiver votre propre compte');
      if (dto.password !== undefined) throw new ForbiddenException('Utilisez « Changer le mot de passe » (mot de passe actuel requis)');
    }
    return this.usersService.update(id, tenantId, dto);
  }

  /** Réinitialisation par l'administrateur : mot de passe temporaire généré,
   * envoyé par e-mail à l'utilisateur, à changer à la première connexion. */
  @Post(':id/reset-password')
  @Roles('ADMIN', 'SUPER_ADMIN')
  resetPassword(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @CurrentUser('id') currentUserId: string) {
    if (id === currentUserId) throw new ForbiddenException('Utilisez « Changer le mot de passe » pour votre propre compte');
    return this.usersService.resetPassword(id, tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }

  @Post(':id/photo')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(id, tenantId, file);
  }

  @Delete(':id/photo')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deletePhoto(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.deleteAvatar(id, tenantId);
  }
}
