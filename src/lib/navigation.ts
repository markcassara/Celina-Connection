export type DashboardPortalMode = 'owner' | 'admin';

export function activeTabFromPath(pathname: string) {
  const path = pathname.replace(/^\//, '');
  if (path.startsWith('business/')) return 'directory';
  if (path === 'owner-login' || path === 'admin-login') return path;
  return path || 'directory';
}

export function pathForActiveTab(activeTab: string) {
  return activeTab === 'directory' ? '/' : `/${activeTab}`;
}

export function resolveDashboardPortalMode({
  activeTab,
  currentMode,
  isLoggedIn,
  role,
}: {
  activeTab: string;
  currentMode: DashboardPortalMode;
  isLoggedIn: boolean;
  role?: string;
}): DashboardPortalMode {
  if (activeTab === 'admin-login') return 'admin';
  if (activeTab === 'owner-login') return 'owner';
  if (activeTab === 'dashboard') {
    return isLoggedIn && role === 'admin' ? 'admin' : 'owner';
  }
  return currentMode;
}
