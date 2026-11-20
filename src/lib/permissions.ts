import type { AdminProfile } from '@/types/identity';

/**
 * Permission strings the API reference names explicitly (booking activity filtering).
 * The server is always authoritative — these only decide which controls are shown.
 */
export const PERM = {
  documentsReview: 'documents:review',
  bookingsNotes: 'bookings:notes',
  bookingsLocations: 'bookings:locations',
  bookingsManage: 'bookings:manage',
} as const;

export const isOwner = (user?: AdminProfile | null) => user?.role?.toLowerCase() === 'owner';

/** Owners are treated as having every permission in the UI; everyone else needs it listed (or '*'). */
export function can(user: AdminProfile | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (isOwner(user)) return true;
  return user.permissions.includes(permission) || user.permissions.includes('*');
}
