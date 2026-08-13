import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { HubsService } from './hubs.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('hubs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.hubsService.findAll(pagination.skip, pagination.take);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const hub = await this.hubsService.findOne(id);
    if (!hub) throw new NotFoundException('Hub not found');
    return hub;
  }
}
