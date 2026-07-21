import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES } from '../src/data/mockBusinesses.ts';
import { getDesktopHeaderTabs, getMobileHeaderTabs } from '../src/components/Header.tsx';

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

test('logged-in admins get working admin navigation without site metrics', () => {
  const desktopTabs = getDesktopHeaderTabs({ isLoggedIn: true, role: 'admin' });
  assert.deepEqual(
    desktopTabs.map((tab) => tab.label),
    ['Admin Dashboard', 'Manage Listings', 'Bug Reports', 'View Directory'],
  );
  assert.equal(desktopTabs.some((tab) => tab.label === 'Site Metrics'), false);
  assert.deepEqual(
    desktopTabs.map((tab) => tab.dashboardSection ?? null),
    ['admin-listings', 'admin-listings', 'admin-bugs', null],
  );

  const mobileTabs = getMobileHeaderTabs({ isLoggedIn: true, role: 'admin' });
  assert.deepEqual(
    mobileTabs.map((tab) => tab.label),
    ['Admin', 'Listings', 'Bugs', 'Directory'],
  );
  assert.equal(mobileTabs.some((tab) => tab.label === 'Metrics'), false);
});
