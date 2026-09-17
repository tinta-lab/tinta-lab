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
import { ClientViewDto, toClientView } from './dto/client-view.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  async create(@Body() dto: CreateClientDto): Promise<ClientViewDto> {
    return toClientView(await this.clientsService.create(dto));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)
  async findAll(@Query() pagination: PaginationDto): Promise<ClientViewDto[]> {
    const clients = await this.clientsService.findAll(pagination.skip, pagination.take);
    return clients.map(toClientView);
  }

  @Get('me')
  @Roles(UserRole.CLIENT)
  async getMyProfile(@Request() req: any): Promise<ClientViewDto> {
    return toClientView(await this.clientsService.findByUserId(req.user.id));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)
  async findOne(@Param('id') id: string): Promise<ClientViewDto> {
    return toClientView(await this.clientsService.findById(id));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateClientDto): Promise<ClientViewDto> {
    return toClientView(await this.clientsService.update(id, dto));
  }
}
