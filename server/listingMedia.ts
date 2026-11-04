import crypto from 'node:crypto';
import type { Business } from '../src/types';

const inlineImage = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;
const digestMarker = /^inline:([a-f0-9]{32})$/;

export function listingImageVersion(image: string): string | null {
  const marker = image.match(digestMarker);
  if (marker) return marker[1];
  return inlineImage.test(image) ? crypto.createHash('md5').update(image).digest('hex') : null;
}

export function listingImageUrl(id: string, slot: string, image: string): string {
  const version = listingImageVersion(image);
  return version ? `/api/listing-images/${encodeURIComponent(id)}/${slot}/${version}.webp` : image;
}

export function publicListingMedia(business: Business): Business {
  return {
    ...business,
    logoUrl: listingImageUrl(business.id, 'logo', business.logoUrl || ''),
    images: (business.images || []).map((image, index) => listingImageUrl(business.id, String(index), image)),
  };
}

// Admin forms may submit the public URLs from bootstrap. Preserve the originals
// instead of replacing stored image bytes with a reference to themselves.
export function restoreListingMedia(current: Business, updates: Partial<Business>): Partial<Business> {
  const originals = new Map<string, string>();
  if (current.logoUrl) originals.set(listingImageUrl(current.id, 'logo', current.logoUrl), current.logoUrl);
  (current.images || []).forEach((image, index) => originals.set(listingImageUrl(current.id, String(index), image), image));
  const restore = (value: string) => {
    if (value.startsWith('/api/listing-images/')) {
      const original = originals.get(value);
      if (original === undefined) throw new Error('This photo changed. Refresh the listing before saving.');
      return original;
    }
    return value;
  };
  return {
    ...updates,
    ...(typeof updates.logoUrl === 'string' ? { logoUrl: restore(updates.logoUrl) } : {}),
    ...(Array.isArray(updates.images) ? { images: updates.images.map(restore) } : {}),
  };
}
