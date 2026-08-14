import React from 'react';
import { UserProfile } from '../types';

export interface MenuItem {
  id: string;
  label: string;
  targetTab: string;
  dashboardSection?: 'profile' | 'reviews' | 'billing' | 'media' | 'admin-dashboard' | 'admin-listings' | 'admin-events' | 'admin-bugs' | 'admin-petition' | 'claims';
  icon?: string;
  badge?: string;
  badgeColor?: 'orange' | 'amber' | 'emerald' | 'purple' | 'slate';
  description?: string;
  isPrimary?: boolean;
  subItems?: MenuItemSubItem[];
  role?: 'public' | 'owner' | 'admin';
}

export interface MenuItemSubItem {
  id: string;
  label: string;
  targetTab: string;
  dashboardSection?: string;
  filterCategory?: string;
  description?: string;
  icon?: string;
  badge?: string;
  isExternal?: boolean;
  url?: string;
}

// 1. PUBLIC FRONT-FACING MENU ITEMS
export const PUBLIC_MENU_ITEMS: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    targetTab: 'home',
    icon: 'Home',
    isPrimary: true,
  },
  {
    id: 'directory',
    label: 'Explore Directory',
    targetTab: 'directory',
    icon: 'Search',
    isPrimary: true,
    subItems: [
      {
        id: 'dir-all',
        label: 'All Businesses',
        targetTab: 'directory',
        description: 'Browse complete catalog of Celina, TX businesses',
        icon: 'Building2',
      },
      {
        id: 'dir-claim',
        label: 'Claim Your Listing',
        targetTab: 'directory',
        dashboardSection: 'unclaimed',
        description: 'Verify your Celina business for free',
        icon: 'CheckCircle2',
        badge: 'FREE',
      },
    ],
  },
  {
    id: 'events',
    label: 'Local Events',
    targetTab: 'events',
    icon: 'Calendar',
    badge: 'July 2026',
    isPrimary: true,
  },
  {
    id: 'pricing',
    label: 'Membership Tiers',
    targetTab: 'pricing',
    icon: 'Sparkles',
    isPrimary: true,
  },
];

// 2. REGISTERED BUSINESS OWNER MENU ITEMS
export const OWNER_MENU_ITEMS: MenuItem[] = [
  {
    id: 'owner-dashboard',
    label: 'Dashboard',
    targetTab: 'dashboard',
    icon: 'LayoutDashboard',
    isPrimary: true,
  },
  {
    id: 'owner-listing',
    label: 'My Listing Profile',
    targetTab: 'dashboard',
    dashboardSection: 'profile',
    icon: 'Store',
    isPrimary: true,
    description: 'Edit business details, photos, hours, and contacts',
  },
  {
    id: 'owner-reviews',
    label: 'Customer Reviews',
    targetTab: 'dashboard',
    dashboardSection: 'reviews',
    icon: 'Star',
    isPrimary: true,
    description: 'View customer reviews & write owner replies',
  },
  {
    id: 'owner-upgrade',
    label: 'Upgrade & Billing',
    targetTab: 'dashboard',
    dashboardSection: 'billing',
    icon: 'Zap',
    badge: 'PRO',
    badgeColor: 'orange',
    isPrimary: true,
    description: 'Manage subscription tier, features & add-on slots',
  },
  {
    id: 'owner-more',
    label: 'Business Tools',
    targetTab: 'dashboard',
    icon: 'Sliders',
    isPrimary: false,
    subItems: [
      {
        id: 'owner-sub-media',
        label: 'Photo & Media Gallery',
        targetTab: 'dashboard',
        dashboardSection: 'media',
        description: 'Upload high-resolution business photos',
        icon: 'Image',
      },
      {
        id: 'owner-sub-public',
        label: 'View Live Directory',
        targetTab: 'directory',
        description: 'See how your business appears to local customers',
        icon: 'Eye',
      },
    ],
  },
];

// 3. ADMIN MENU ITEMS
export const ADMIN_MENU_ITEMS: MenuItem[] = [
  {
    id: 'admin-listings',
    label: 'Directory Manager',
    targetTab: 'dashboard',
    dashboardSection: 'admin-listings',
    icon: 'Building2',
    isPrimary: true,
  },
  {
    id: 'admin-profile',
    label: 'Personal Listing',
    targetTab: 'dashboard',
    dashboardSection: 'profile',
    icon: 'Store',
    isPrimary: true,
    description: 'Edit personal listing details, photos, reviews, and billing',
  },
  {
    id: 'admin-bugs',
    label: 'Feedback',
    targetTab: 'dashboard',
    dashboardSection: 'admin-bugs',
    icon: 'Bug',
    isPrimary: true,
  },
  {
    id: 'admin-events',
    label: 'Events',
    targetTab: 'dashboard',
    dashboardSection: 'admin-events',
    icon: 'Calendar',
    isPrimary: true,
  },
  {
    id: 'admin-petition',
    label: 'Petition',
    targetTab: 'dashboard',
    dashboardSection: 'admin-petition',
    icon: 'FileCheck2',
    isPrimary: true,
  },
  {
    id: 'admin-view-public',
    label: 'Public Site',
    targetTab: 'directory',
    icon: 'Globe',
    isPrimary: true,
    description: 'Switch to live public directory view',
  },
];

// Helper to retrieve correct menu items based on role or mode override
export function getMenuItemsForRole(
  user: { isLoggedIn: boolean; role?: UserProfile['role'] },
  overrideRole?: 'public' | 'owner' | 'admin'
): MenuItem[] {
  const activeRole = overrideRole || (user.isLoggedIn ? (user.role === 'admin' ? 'admin' : 'owner') : 'public');

  switch (activeRole) {
    case 'admin':
      return ADMIN_MENU_ITEMS;
    case 'owner':
      return OWNER_MENU_ITEMS;
    case 'public':
    default:
      return PUBLIC_MENU_ITEMS;
  }
}
