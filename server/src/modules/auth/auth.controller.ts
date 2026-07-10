import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    console.log('[AUTH] login request', { email: dto.email, hasPassword: !!dto.password });
    try {
      const result = await this.authService.login(dto);
      console.log('[AUTH] login success', {
        userId: (result as any).user?.id,
        email: (result as any).user?.email
      });
      return result;
    } catch (err) {
      console.error('[AUTH] login failed', { email: dto.email, error: err?.message });
      throw err;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupTwoFactor(@CurrentUser('id') userId: string) {
    return this.authService.setupTwoFactor(userId);
  }

  @Post('2fa/verify')
  @UseGuards(AuthGuard('jwt'))
  async verifyTwoFactor(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
  ) {
    return this.authService.verifyTwoFactor(userId, token);
  }
}
