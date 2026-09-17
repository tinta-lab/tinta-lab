import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../entities/user.entity';

// User entity minus `password`. `password` is `select: false` at the DB
// level (TypeORM's plain `findOne`/`find` never load it), so this DTO isn't
// what's preventing a leak today — it's here so the *contract* says the
// same thing the runtime already guarantees, instead of the OpenAPI schema
// claiming `password` is a required response field (which it did, once the
// raw User entity started getting documented). Field set matches exactly
// what PATCH /auth/me already returns today — see usersService.findById().
export class UserSafeViewDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;
  isActive: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserSafeView(user: User): UserSafeViewDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    passwordChangedAt: user.passwordChangedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
