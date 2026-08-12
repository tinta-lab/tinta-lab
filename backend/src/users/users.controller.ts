import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PresenceService } from '../presence/presence.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceService,
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      dto.role,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { deleted: true };
  }

  @Patch(':id/reset-password')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    // Clients own their credentials — admin can deactivate/delete an
    // account, but silently taking over a client's login by setting their
    // password is off the table. Staff (support/sales/admin) accounts are
    // ours to manage, so those are unaffected.
    const target = await this.usersService.findById(id);
    if (target.role === UserRole.CLIENT) {
      throw new ForbiddenException(
        'Cannot reset a client\'s password — clients manage their own credentials',
      );
    }
    return this.usersService.resetPassword(id, dto.password);
  }

  @Get('staff-activity')
  staffActivity() {
    return this.usersService.findStaffActivity(
      this.presence.getConnectedUserIds(),
    );
  }
}
