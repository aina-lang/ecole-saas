import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Response } from 'express';

@Controller('upload')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'SECRETARY', 'TEACHER')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string,
    @Body('studentId') studentId: string,
    @Body('messageId') messageId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.uploadService.uploadFile(file, tenantId, {
      category,
      studentId,
      messageId,
      uploadedBy: userId,
    });
  }

  @Get('usage')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getUsage(@CurrentUser('tenantId') tenantId: string) {
    return this.uploadService.getStorageUsage(tenantId);
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, metadata } = await this.uploadService.getDocument(id, tenantId);
    res.set({
      'Content-Type': metadata.mimeType,
      'Content-Disposition': `inline; filename="${metadata.originalName}"`,
      'Content-Length': metadata.size,
    });
    return stream;
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.uploadService.deleteDocument(id, tenantId);
  }
}
