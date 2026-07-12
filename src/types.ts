export type Tier = 'basic' | 'pro' | 'premium';

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  ownerReply?: string;
}

export interface Business {
  id: string;
  slug?: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  // Pro/Premium unlocked fields
  website?: string;
  address?: string;
  hours?: {
    monFri: string;
    sat: string;
    sun: string;
  };
  logoUrl?: string;
  images?: string[]; // Max 1 for Basic, 5 for Pro, unlimited/10 for Premium
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  // Premium unlocked fields
  featured?: boolean;
  ctaText?: string; // Custom button text for premium
  // System fields
  tier: Tier;
  ownerId: string;
  createdAt: string;
  reviews: Review[];
  viewsCount: number;
  isUnclaimed?: boolean;
  isRegistryOnly?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  businessName: string;
  businessId?: string;
  tier: Tier;
  isLoggedIn: boolean;
  addonSlots?: number;
  role?: 'admin' | 'owner';
}

export interface ReportedBug {
  id: string;
  title: string;
  description: string;
  category: 'visual' | 'functional' | 'data' | 'other';
  severity: 'low' | 'medium' | 'high';
  email: string;
  createdAt: string;
  status: 'open' | 'in-progress' | 'resolved';
}

export interface ClaimRequest {
  id: string;
  businessId: string;
  businessName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  role: string;
  proofUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
}
