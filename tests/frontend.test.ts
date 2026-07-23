import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { CATEGORIES } from '../src/data/mockBusinesses.ts';
import { getDesktopHeaderTabs, getMobileHeaderTabs, getHeaderTabHref, isHeaderTabActive } from '../src/components/Header.tsx';
import DashboardView, { getDashboardSectionFromHash, getAdminTabFromDashboardSection, shouldFocusAdminListings, isHiddenFromAdminListings } from '../src/components/DashboardView.tsx';
import DirectoryView from '../src/components/DirectoryView.tsx';

test('listing category choices include generic professional service categories', () => {
  for (const category of [
    'Real Estate',
    'Insurance',
    'Estate Planning',
    'Financial Services',
    'Legal Services',
    'Mortgage & Lending',
    'Home Services',
    'Professional Services',
  ]) {
    assert.ok(CATEGORIES.includes(category), `${category} should be a selectable listing category`);
  }
});

test('logged-in owners see an owner-focused desktop menu instead of the public menu', () => {
  assert.deepEqual(
    getDesktopHeaderTabs({ isLoggedIn: false, role: undefined }).map((tab) => tab.label),
    ['Explore Directory', 'Local Events', 'Membership Tiers'],
  );

  assert.deepEqual(
    getDesktopHeaderTabs({ isLoggedIn: true, role: 'owner' }).map((tab) => tab.label),
    ['Owner Dashboard', 'My Listing', 'Reviews', 'Upgrade Plan'],
  );
});

test('logged-in mobile users see owner-focused navigation instead of public navigation', () => {
  assert.deepEqual(
    getMobileHeaderTabs({ isLoggedIn: false, role: undefined }).map((tab) => tab.label),
    ['Explore', 'Events', 'Pricing'],
  );

  assert.deepEqual(
    getMobileHeaderTabs({ isLoggedIn: true, role: 'owner' }).map((tab) => tab.label),
    ['Dashboard', 'Listing', 'Reviews', 'Plan'],
  );
});

test('logged-in admins get admin-focused navigation without owner-only dead-end buttons', () => {
  const desktopTabs = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' });
  assert.deepEqual(
    desktopTabs.map((tab) => tab.label),
    ['Admin Dashboard', 'Manage Listings', 'Bug Reports', 'View Directory'],
  );
  assert.equal(desktopTabs.some((tab) => tab.label === 'Site Metrics'), false);
  assert.deepEqual(
    desktopTabs.map((tab) => tab.dashboardSection ?? null),
    [null, 'profile', 'admin-bugs', null],
  );

  const mobileTabs = getMobileHeaderTabs({ isLoggedIn: true, role: 'admin' });
  assert.deepEqual(
    mobileTabs.map((tab) => tab.label),
    ['Dashboard', 'Manage', 'Bugs', 'Directory'],
  );
  assert.equal(mobileTabs.some((tab) => tab.label === 'Metrics'), false);
});

test('dashboard navigation highlights only the selected dashboard section', () => {
  const adminTabs = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' });

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '')),
    [true, false, false, false],
  );

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '#dashboard-profile')),
    [false, true, false, false],
  );

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '#dashboard-reviews')),
    [false, false, false, false],
  );

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '#dashboard-admin-listings')),
    [false, false, false, false],
  );

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'directory', '#dashboard-admin-listings')),
    [false, false, false, true],
  );
});

test('dashboard hash parser recognizes header menu sections', () => {
  assert.equal(getDashboardSectionFromHash('#dashboard-profile'), 'profile');
  assert.equal(getDashboardSectionFromHash('#dashboard-reviews'), 'reviews');
  assert.equal(getDashboardSectionFromHash('#dashboard-billing'), 'billing');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-dashboard'), 'admin-dashboard');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-listings'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-bugs'), 'admin-bugs');
  assert.equal(getDashboardSectionFromHash(''), 'profile');
  assert.equal(getDashboardSectionFromHash('#unknown'), 'profile');
});

test('dashboard hash parser keeps admin and owner menus on populated sections', () => {
  assert.equal(getDashboardSectionFromHash('', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-profile', 'admin'), 'profile');
  assert.equal(getDashboardSectionFromHash('#dashboard-reviews', 'admin'), 'reviews');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-dashboard', 'admin'), 'admin-dashboard');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-listings', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-bugs', 'admin'), 'admin-bugs');

  assert.equal(getDashboardSectionFromHash('#dashboard-admin-dashboard', 'owner'), 'profile');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-listings', 'owner'), 'profile');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-bugs', 'owner'), 'profile');
  assert.equal(getDashboardSectionFromHash('#dashboard-reviews', 'owner'), 'reviews');
  assert.equal(getDashboardSectionFromHash('#dashboard-billing', 'owner'), 'billing');
});

test('header tabs expose real hrefs including dashboard section links', () => {
  const adminTabs = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' });

  assert.deepEqual(
    adminTabs.map((tab) => getHeaderTabHref(tab)),
    [
      '/dashboard',
      '/dashboard#dashboard-profile',
      '/dashboard#dashboard-admin-bugs',
      '/',
    ],
  );
});

test('admin dashboard menu opens the admin workspace listings manager instead of the owner profile editor', () => {
  const adminDashboard = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' })[0];

  assert.equal(adminDashboard.id, 'admin-dashboard');
  assert.equal(adminDashboard.dashboardSection, undefined);
  assert.equal(getHeaderTabHref(adminDashboard), '/dashboard');
  assert.equal(getDashboardSectionFromHash('', 'admin'), 'admin-listings');
  assert.equal(getAdminTabFromDashboardSection(getDashboardSectionFromHash('', 'admin')), 'listings');
});

test('admin dashboard inner tab follows the selected dashboard hash section', () => {
  assert.equal(getAdminTabFromDashboardSection('admin-dashboard'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('#dashboard-admin-dashboard'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('admin-listings'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('#dashboard-admin-listings'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('admin-bugs'), 'bugs');
  assert.equal(getAdminTabFromDashboardSection('#dashboard-admin-bugs'), 'bugs');
  assert.equal(getAdminTabFromDashboardSection('reviews'), 'listings');
});

test('admin dashboard menu click focuses the listings manager instead of the generic admin top', () => {
  assert.equal(shouldFocusAdminListings('#dashboard-admin-listings', 'listings'), true);
  assert.equal(shouldFocusAdminListings('', 'listings'), false);
  assert.equal(shouldFocusAdminListings('#dashboard-admin-bugs', 'bugs'), false);
});

test('admin manage listings route renders the responsive listings manager, not the owner edit page', () => {
  const business = {
    id: 'admin-visible-1',
    name: 'Admin Visible Bakery',
    category: 'Dining',
    description: 'A local bakery listing.',
    phone: '(972) 555-0111',
    email: 'bakery@example.com',
    tier: 'basic',
    ownerId: 'owner-bakery',
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    reviews: [],
    viewsCount: 12,
    isUnclaimed: false,
  };

  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: 'admin',
        email: 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      },
      setCurrentUser: () => undefined,
      businesses: [business],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-admin-listings',
    } as any),
  );

  assert.match(html, /admin-listing-directory-grid/);
  assert.match(html, /Admin Visible Bakery/);
  assert.match(html, /Total Directory Listings/);
  assert.doesNotMatch(html, /Listing Edit Page/);
  assert.doesNotMatch(html, /No Listing Selected/);
});

test('direct admin listings URL asks for admin credentials instead of owner registration when session is missing', () => {
  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: '',
        email: '',
        businessName: '',
        tier: 'basic',
        isLoggedIn: false,
      },
      setCurrentUser: () => undefined,
      businesses: [],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-admin-listings',
    } as any),
  );

  assert.match(html, /Master Admin Dashboard/);
  assert.match(html, /Enter administrative system credentials/);
  assert.doesNotMatch(html, /Register Free Spot/);
  assert.doesNotMatch(html, /Claim Your Spot on the/);
});

test('admin manage menu opens the personally owned admin listing customization page', () => {
  const adminOwnedBusiness = {
    id: 'admin-owned-1',
    name: 'Admin Owned Consulting',
    category: 'Professional Services',
    description: 'A listing assigned to the admin account.',
    phone: '(972) 555-0188',
    email: 'admin-owned@example.com',
    tier: 'basic',
    ownerId: 'admin',
    createdAt: new Date('2026-01-02T00:00:00Z').toISOString(),
    reviews: [],
    viewsCount: 44,
    isUnclaimed: false,
  };

  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: 'admin',
        email: 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      },
      setCurrentUser: () => undefined,
      businesses: [adminOwnedBusiness],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-profile',
    } as any),
  );

  assert.match(html, /owner-active-dashboard/);
  assert.match(html, /Admin Owned Consulting/);
  assert.match(html, /Listing Edit Page/);
  assert.match(html, /Standard Fields/);
  assert.doesNotMatch(html, /admin-listing-directory-grid/);
  assert.doesNotMatch(html, /Total Directory Listings/);
});

test('admin profile manage listings includes Legacy Wealth Academy and demo Celina Bistro when both are assigned to admin', () => {
  const legacyWealthAcademy = {
    id: 'legacy-wealth-academy-llc',
    name: 'Legacy Wealth Academy LLC',
    category: 'Home & Professional Services',
    description: 'Financial education and legacy planning resources.',
    phone: '(972) 555-1000',
    email: 'mark@legacywealthco.com',
    tier: 'premium',
    ownerId: 'admin',
    createdAt: new Date('2026-07-01T11:00:00Z').toISOString(),
    reviews: [],
    viewsCount: 305,
    isUnclaimed: false,
  };

  const demoCelinaBistro = {
    id: 'celina-bistro-demo',
    name: 'CELINA Bistro',
    category: 'Dining',
    description: 'A polished demo restaurant profile.',
    phone: '(972) 555-0200',
    email: 'demo@celinaconnection.com',
    tier: 'premium',
    ownerId: 'admin',
    createdAt: new Date('2026-07-01T10:00:00Z').toISOString(),
    reviews: [],
    viewsCount: 310,
    isUnclaimed: false,
  };

  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: 'admin',
        email: 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      },
      setCurrentUser: () => undefined,
      businesses: [legacyWealthAcademy, demoCelinaBistro],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-profile',
    } as any),
  );

  assert.match(html, /owner-active-dashboard/);
  assert.match(html, /Legacy Wealth Academy LLC/);
  assert.match(html, /CELINA Bistro/);
  assert.match(html, /Listing Edit Page/);
  assert.doesNotMatch(html, /No Listing Selected/);
});

test('admin bug reports route stays in the full admin bug manager even if admin owns listings', () => {
  const adminOwnedBusiness = {
    id: 'admin-owned-2',
    name: 'Admin Owned Finance',
    category: 'Financial Services',
    description: 'A listing assigned to the admin account.',
    phone: '(972) 555-0199',
    email: 'admin-finance@example.com',
    tier: 'premium',
    ownerId: 'admin',
    createdAt: new Date('2026-01-03T00:00:00Z').toISOString(),
    reviews: [],
    viewsCount: 55,
    isUnclaimed: false,
  };

  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: 'admin',
        email: 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      },
      setCurrentUser: () => undefined,
      businesses: [adminOwnedBusiness],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [{
        id: 'bug-owned-admin-route',
        title: 'Broken menu route',
        description: 'Manage listings should not open owner editor.',
        category: 'functional',
        severity: 'high',
        email: 'mark@example.com',
        createdAt: new Date('2026-01-04T00:00:00Z').toISOString(),
        status: 'open',
      }],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-admin-bugs',
    } as any),
  );

  assert.match(html, /Broken menu route/);
  assert.match(html, /admin-bugs-card/);
  assert.match(html, /Reported Bug Tickets/);
  assert.doesNotMatch(html, /owner-active-dashboard/);
  assert.doesNotMatch(html, /Listing Edit Page/);
});

test('admin dashboard profile hash does not crash when admin has no owned listing', () => {
  const html = renderToString(
    React.createElement(DashboardView, {
      currentUser: {
        id: 'admin',
        email: 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      },
      setCurrentUser: () => undefined,
      businesses: [],
      onAddBusiness: () => 'new-business-id',
      onOwnerRegister: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerLogin: async () => ({ currentUser: {} as any, business: {} as any }),
      onOwnerUpdateBusiness: async () => undefined,
      onUpdateBusiness: () => undefined,
      onUpgradePrompt: () => undefined,
      reportedBugs: [],
      portalMode: 'admin',
      setPortalMode: () => undefined,
      locationHash: '#dashboard-profile',
    } as any),
  );

  assert.match(html, /No Listing Selected/);
  assert.match(html, /Manage Listings/);
  assert.doesNotMatch(html, /Claim Your Spot on the/);
});

test('Lucys and Annie Jack stay public but are hidden from the admin listing manager', () => {
  assert.equal(isHiddenFromAdminListings({ id: 'lucys-on-the-square', isUnclaimed: true }), true);
  assert.equal(isHiddenFromAdminListings({ id: 'annie-jack-boutique', isUnclaimed: true }), true);
  assert.equal(isHiddenFromAdminListings({ id: 'little-wooden-penguin', isUnclaimed: true }), false);
  assert.equal(isHiddenFromAdminListings({ id: 'lucys-on-the-square', isUnclaimed: false }), false);
});

test('directory search renders a blended on-page AI chat box instead of a separate floating-only experience', () => {
  const html = renderToString(
    React.createElement(DirectoryView, {
      businesses: [],
      onAddReview: () => undefined,
      selectedBusiness: null,
      onSelectBusiness: () => undefined,
      onCloseDetail: () => undefined,
      onUpgradePrompt: () => undefined,
      onClaimBusiness: () => undefined,
      isAiEnabled: true,
      serverAiAvailable: true,
      setActiveTab: () => undefined,
    }),
  );

  assert.match(html, /directory-inline-ai-chat/);
  assert.match(html, /Ask Celina AI or search the directory/);
  assert.match(html, /Ask Celina AI like a local concierge/);
  assert.doesNotMatch(html, /ai-chat-fab/);
});
