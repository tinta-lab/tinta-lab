import { UserRole } from '../users/entities/user.entity';

// Named role groups for NEW endpoints (Phase 0 onward). Existing @Roles(...)
// call sites elsewhere in the app (access/tickets/servers/clients/users/
// tinta-core/provisioning/hubs/auth) are intentionally left as raw enum
// lists — migrating them is out of scope for this pass and not required for
// new code to be written cleanly. New code should import from here instead
// of writing another raw list.
//
// If a granular permissions table replaces UserRole later, these exports are
// the only thing that needs to change — every @Roles(...GROUP) call site
// keeps compiling and keeps meaning the same thing without being touched.

export const TICKET_MANAGE_ROLES = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SUPPORT,
] as const;

// Attaching an anonymous /tickets/public lead to a Client/Server is a
// lead-qualification / CRM-ownership action, not ticket-workflow — SUPPORT
// is deliberately excluded. See PHASE0_PHASE1_SPEC.md "Anonymous Ticket
// Linkage" for the fixed product decision; do not add SUPPORT to this list.
export const TICKET_LINK_ROLES = [UserRole.ADMIN, UserRole.SALES] as const;

export const SECURITY_CENTER_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPPORT,
  UserRole.SALES,
] as const;

export const AUDIT_LEDGER_ADMIN_ROLES = [UserRole.ADMIN] as const;

export const DIAGNOSTICS_ROLES = [UserRole.ADMIN, UserRole.SUPPORT] as const;

export const CUSTOMER_360_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPPORT,
  UserRole.SALES,
] as const;
