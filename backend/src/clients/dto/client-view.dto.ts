import { ApiProperty } from '@nestjs/swagger';
import { Client } from '../entities/client.entity';
import { UserRole } from '../../users/entities/user.entity';

// Response shape for every ClientsController endpoint — NOT the raw Client
// entity. Client.user is a full User relation (loaded via `relations:
// ['user']` everywhere in ClientsService), and this codebase has no
// ClassSerializerInterceptor to strip it before res.json() — so returning
// the entity directly would put the nested user's full row (isActive,
// passwordChangedAt, timestamps — password itself stays out via `select:
// false`) into every clients response. This didn't exist as a named view
// before this pass; ClientsController simply returned entities.
export class ClientUserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;
}

export class ClientViewDto {
  id: string;
  phone: string;
  address: string | null;
  city: string | null;
  country: string;
  isInstalled: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: ClientUserSummaryDto;
}

export function toClientView(client: Client): ClientViewDto {
  return {
    id: client.id,
    phone: client.phone,
    address: client.address,
    city: client.city,
    country: client.country,
    isInstalled: client.isInstalled,
    notes: client.notes,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    user: {
      id: client.user.id,
      email: client.user.email,
      firstName: client.user.firstName,
      lastName: client.user.lastName,
      role: client.user.role,
    },
  };
}
