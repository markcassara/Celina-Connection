import { Business } from '../types';

/**
 * Checks if an unclaimed listing has been in the system for more than 7 days.
 * If true, it is considered "expired" and thus "inactive".
 */
export function isClaimExpired(bus: Business): boolean {
  if (!bus.isUnclaimed) return false;
  const createdDate = new Date(bus.createdAt);
  const now = new Date();
  const diffTime = now.getTime() - createdDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

/**
 * Gets the remaining days to claim an unclaimed listing before it becomes inactive.
 */
export function getDaysRemaining(bus: Business): number {
  if (!bus.isUnclaimed) return 0;
  const createdDate = new Date(bus.createdAt);
  const expiryDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
