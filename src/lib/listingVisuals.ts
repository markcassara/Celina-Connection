import { Business } from '../types';

export function hasRequiredListingVisuals(business: Pick<Business, 'logoUrl' | 'images'>) {
  return Boolean(business.logoUrl?.trim()) && Boolean(business.images?.some((image) => image.trim()));
}

export function isNewListing(business: Pick<Business, 'createdAt'>, now = Date.now()) {
  const createdAt = new Date(business.createdAt).getTime();
  if (!Number.isFinite(createdAt) || createdAt > now) return false;
  return now - createdAt <= 30 * 24 * 60 * 60 * 1000;
}

export function isOutsideUserClaimedListing(
  business: Pick<Business, 'tier' | 'ownerId' | 'isUnclaimed' | 'isRegistryOnly'>,
) {
  return (
    Boolean(business.ownerId) &&
    business.ownerId !== 'admin' &&
    !business.isUnclaimed &&
    !business.isRegistryOnly
  );
}

export function countOutsideUserClaimedListings(
  businesses: Pick<Business, 'tier' | 'ownerId' | 'isUnclaimed' | 'isRegistryOnly'>[],
) {
  return Math.min(100, businesses.filter(isOutsideUserClaimedListing).length);
}
