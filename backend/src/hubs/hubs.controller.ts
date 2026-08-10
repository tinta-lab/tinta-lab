import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { HubsService } from './hubs.service';

@Controller('hubs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Get()
  findAll() {
    return this.hubsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const hub = await this.hubsService.findOne(id);
    if (!hub) throw new NotFoundException('Hub not found');
    return hub;
  }
}
