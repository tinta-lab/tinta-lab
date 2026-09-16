import { UserRole } from '@/types';

// Mirrors backend/src/auth/role-groups.ts — same rationale (named groups for
// new UI; existing inline `user?.role === 'admin' || ...` checks elsewhere
// are left as-is for this pass).

export const canManageTickets = (role?: UserRole) =>
  role === 'admin' || role === 'sales' || role === 'support';

// Attaching an anonymous lead to a Client/Server is deliberately not
// available to SUPPORT — see PHASE0_PHASE1_SPEC.md "Anonymous Ticket
// Linkage". Do not add 'support' here.
export const canLinkTickets = (role?: UserRole) =>
  role === 'admin' || role === 'sales';

export const canViewSecurityCenter = (role?: UserRole) =>
  role === 'admin' || role === 'support' || role === 'sales';

export const canViewDiagnostics = (role?: UserRole) =>
  role === 'admin' || role === 'support';

export const canViewCustomer360 = (role?: UserRole) =>
  role === 'admin' || role === 'support' || role === 'sales';
