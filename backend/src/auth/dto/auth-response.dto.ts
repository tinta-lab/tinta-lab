import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

// The `user` field AuthService.login() actually builds — narrower than
// UserSafeViewDto (no isActive/passwordChangedAt/timestamps): kept as its
// own shape rather than reused, since unifying them would either add fields
// to the login response that aren't there today or remove fields PATCH
// /auth/me callers currently get back — either way a runtime behavior
// change this pass isn't meant to make.
export class AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;
}

// Response shape for POST /auth/login. access_token is also set as an
// httpOnly cookie by the controller — see auth.controller.ts's comment on
// why it's additionally returned in the body (non-browser callers).
export class AuthResponseDto {
  access_token: string;
  user: AuthUserDto;
}
