import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)
  findAll(@Query() pagination: PaginationDto) {
    return this.clientsService.findAll(pagination.skip, pagination.take);
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
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }
}
