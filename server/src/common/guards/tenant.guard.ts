import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.params.tenantId || request.body?.tenantId || request.query?.tenantId;

    if (tenantId && user.tenantId !== tenantId && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Accès interdit à cet établissement');
    }
    return true;
  }
}
