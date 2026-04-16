import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  create(@Body() body: any) {
    return this.clientsService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)
  findAll() {
    return this.clientsService.findAll();
  }

  @Get('me')
  @Roles(UserRole.CLIENT)
  getMyProfile(@Request() req: any) {
    return this.clientsService.findByUserId(req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)
  findOne(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.clientsService.update(id, body);
  }
}
