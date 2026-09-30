import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.REQUIRE_SPREAD_AUTH !== 'true') {
      return true;
    }
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    const request = context.switchToHttp().getRequest<{
      headers: { [key: string]: string | string[] | undefined };
    }>();
    const raw = request.headers['x-internal-token'];
    const got = Array.isArray(raw) ? raw[0] : raw;
    if (!expected || got !== expected) {
      throw new UnauthorizedException('internal token required');
    }
    return true;
  }
}
