import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() body: { email: string; password: string; firstName: string; lastName: string; role?: UserRole }) {
    return this.usersService.create(body.email, body.password, body.firstName, body.lastName, body.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; role?: UserRole; isActive?: boolean },
  ) {
    return this.usersService.update(id, body);
  }

  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.usersService.resetPassword(id, body.password);
  }
}
