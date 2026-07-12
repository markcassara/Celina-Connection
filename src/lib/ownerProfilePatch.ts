import type { Business, Tier } from '../types';

export interface OwnerProfileFormValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  category: string;
  address: string;
  website: string;
  hours: NonNullable<Business['hours']>;
  ctaText: string;
  socialLinks: NonNullable<Business['socialLinks']>;
}

export function buildOwnerProfilePatch(tier: Tier, values: OwnerProfileFormValues): Partial<Business> {
  const patch: Partial<Business> = {
    name: values.name,
    description: values.description,
    phone: values.phone,
    email: values.email,
    category: values.category,
    address: values.address,
  };

  if (tier === 'pro' || tier === 'premium') {
    patch.website = values.website;
    patch.hours = values.hours;
  }

  if (tier === 'premium') {
    patch.ctaText = values.ctaText;
    patch.socialLinks = values.socialLinks;
  }

  return patch;
}
