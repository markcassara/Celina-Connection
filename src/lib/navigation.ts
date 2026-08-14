export type DashboardPortalMode = 'owner' | 'admin';

export function isAdminDashboardHash(hash?: string) {
  return (
    hash === '#dashboard-admin-dashboard' ||
    hash === '#dashboard-admin-listings' ||
    hash === '#dashboard-admin-events' ||
    hash === '#dashboard-admin-bugs' ||
    hash === '#dashboard-admin-petition'
  );
}

export function activeTabFromPath(pathname: string) {
  const path = pathname.replace(/^\//, '');
  if (path.startsWith('business/')) return 'directory';
  if (path.startsWith('directory/')) return 'directory';
  if (path === 'legacyhillspetition') return 'legacyhillspetition-signatures';
  if (path === 'legacyhillspetition/signatures') return 'legacyhillspetition-signatures';
  if (path === 'legacyhillspetition/sign') return 'legacyhillspetition-sign';
  if (path === 'terms' || path === 'privacy' || path === 'refunds' || path === 'payments' || path === 'policies') return 'policies';
  if (path === 'owner-login' || path === 'admin-login' || path === 'reset-password') return path;
  return path || 'home';
}

export function pathForActiveTab(activeTab: string) {
  if (activeTab === 'home') return '/';
  if (activeTab === 'legacyhillspetition-signatures') return '/legacyhillspetition/signatures';
  if (activeTab === 'legacyhillspetition-sign') return '/legacyhillspetition/sign';
  if (activeTab === 'policies') return '/policies';
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
  if (activeTab === 'owner-login' || activeTab === 'reset-password') return 'owner';
  if (activeTab === 'dashboard') {
    if (isAdminDashboardHash(locationHash)) return 'admin';
    return isLoggedIn && role === 'admin' ? 'admin' : 'owner';
  }
  return currentMode;
}
