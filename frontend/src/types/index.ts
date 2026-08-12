export type UserRole = 'admin' | 'support' | 'sales' | 'client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Server {
  id: string;
  name: string;
  subdomain: string;
  publicUrl?: string | null;
  status: 'online' | 'offline' | 'unknown';
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  lastSeenAt: string | null;
  haVersion: string | null;
  localUrl: string | null;
  client?: Client;
}

export interface Client {
  id: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  isInstalled: boolean;
  user: User;
}

export interface AgentMetrics {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  deviceCount: number;
  automationCount: number;
  uptimeSeconds: number;
}

export interface AgentSession {
  id: string;
  clientId: string;
  status: 'connected' | 'disconnected';
  agentVersion: string | null;
  haVersion: string | null;
  appliedTemplates: string[];
  metrics: AgentMetrics | null;
  lastConnectedAt: string | null;
  lastHeartbeatAt: string | null;
  lastTokenMismatchAt: string | null;
  createdAt: string;
  client?: Client;
}

export interface GoldenTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  requiredEntities: string[];
  isActive: boolean;
}

export interface Ticket {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type: 'installation' | 'support' | 'sales' | 'other';
  status: 'new' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  assignedTo?: User;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}
