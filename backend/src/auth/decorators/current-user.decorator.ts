import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

// Replaces `@Request() req: any` + manual `req.user.id`/`req.user.role`
// reads — matches the shape JwtStrategy.validate() actually returns, so a
// typo like `req.user.rol` is a compile error instead of `undefined` at
// runtime silently skipping an ownership check.
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
