import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES } from '../src/data/mockBusinesses.ts';
import { getDesktopHeaderTabs, getMobileHeaderTabs, getHeaderTabHref, isHeaderTabActive } from '../src/components/Header.tsx';
import { getDashboardSectionFromHash, getAdminTabFromDashboardSection } from '../src/components/DashboardView.tsx';

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
    [null, 'admin-listings', 'admin-bugs', null],
  );

  const mobileTabs = getMobileHeaderTabs({ isLoggedIn: true, role: 'admin' });
  assert.deepEqual(
    mobileTabs.map((tab) => tab.label),
    ['Dashboard', 'Listings', 'Bugs', 'Directory'],
  );
  assert.equal(mobileTabs.some((tab) => tab.label === 'Metrics'), false);
});

test('dashboard navigation highlights only the selected dashboard section', () => {
  const adminTabs = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' });

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '#dashboard-admin-listings')),
    [false, true, false, false],
  );

  assert.deepEqual(
    adminTabs.map((tab) => isHeaderTabActive(tab, 'dashboard', '#dashboard-reviews')),
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
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-listings'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-bugs'), 'admin-bugs');
  assert.equal(getDashboardSectionFromHash(''), 'profile');
  assert.equal(getDashboardSectionFromHash('#unknown'), 'profile');
});

test('dashboard hash parser keeps admin and owner menus on populated sections', () => {
  assert.equal(getDashboardSectionFromHash('', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-profile', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-reviews', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-listings', 'admin'), 'admin-listings');
  assert.equal(getDashboardSectionFromHash('#dashboard-admin-bugs', 'admin'), 'admin-bugs');

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
      '/dashboard#dashboard-admin-listings',
      '/dashboard#dashboard-admin-bugs',
      '/',
    ],
  );
});

test('admin dashboard inner tab follows the selected dashboard hash section', () => {
  assert.equal(getAdminTabFromDashboardSection('admin-listings'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('#dashboard-admin-listings'), 'listings');
  assert.equal(getAdminTabFromDashboardSection('admin-bugs'), 'bugs');
  assert.equal(getAdminTabFromDashboardSection('#dashboard-admin-bugs'), 'bugs');
  assert.equal(getAdminTabFromDashboardSection('reviews'), 'listings');
});
