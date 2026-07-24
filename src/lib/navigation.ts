export type DashboardPortalMode = 'owner' | 'admin';

export function isAdminDashboardHash(hash?: string) {
  return hash === '#dashboard-admin-listings' || hash === '#dashboard-admin-bugs' || hash === '#dashboard-admin-petition';
}

export function activeTabFromPath(pathname: string) {
  const path = pathname.replace(/^\//, '');
  if (path.startsWith('business/')) return 'directory';
  if (path === 'owner-login' || path === 'admin-login') return path;
  return path || 'home';
}

export function pathForActiveTab(activeTab: string) {
  if (activeTab === 'home') return '/';
  return `/${activeTab}`;
}

export function resolveDashboardPortalMode({
  activeTab,
  currentMode,
  isLoggedIn,
  role,
  locationHash,
}: {
  activeTab: string;
  currentMode: DashboardPortalMode;
  isLoggedIn: boolean;
  role?: string;
  locationHash?: string;
}): DashboardPortalMode {
  if (activeTab === 'admin-login') return 'admin';
  if (activeTab === 'owner-login') return 'owner';
  if (activeTab === 'dashboard') {
    if (isAdminDashboardHash(locationHash)) return 'admin';
    return isLoggedIn && role === 'admin' ? 'admin' : 'owner';
  }
  return currentMode;
}
