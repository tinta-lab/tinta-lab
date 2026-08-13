import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TicketStatus } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // 3 tickets per hour per IP — prevents contact form spam
  @Post('public')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  createPublic(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)
  findAll(@Query('status') status: TicketStatus | undefined, @Query() pagination: PaginationDto) {
    return this.ticketsService.findAll(status, pagination.skip, pagination.take);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)
  findOne(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketsService.updateStatus(
      id,
      dto.status,
      dto.assignedToId,
      dto.internalNotes,
    );
  }
}
