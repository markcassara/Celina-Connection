import React from 'react';
import { UserProfile, Tier } from '../types';
import { MapPin, LogIn, LogOut, Award, Star, Sparkles, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNavigateTab?: (tab: string, hash?: string) => void;
  currentUser: UserProfile;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onOpenLogin: () => void;
  isAiEnabled: boolean;
  setIsAiEnabled: (val: boolean) => void;
  serverAiAvailable: boolean;
  onServerAiAvailabilityChange: (val: boolean) => void;
}

export interface HeaderTab {
  id: string;
  label: string;
  targetTab: string;
  dashboardSection?: 'profile' | 'reviews' | 'billing' | 'metrics' | 'media' | 'admin-dashboard' | 'admin-listings' | 'admin-bugs' | 'admin-petition';
}

export function getDesktopHeaderTabs(user: { isLoggedIn: boolean; role?: UserProfile['role'] }): HeaderTab[] {
  if (!user.isLoggedIn) {
    return [
      { id: 'home', label: 'Home', targetTab: 'home' },
      { id: 'directory', label: 'Directory', targetTab: 'directory' },
      { id: 'events', label: 'Local Events', targetTab: 'events' },
      { id: 'pricing', label: 'Pricing', targetTab: 'pricing' },
    ];
  }

  if (user.role === 'admin') {
    return [
      { id: 'admin-listings', label: 'Listings', targetTab: 'dashboard', dashboardSection: 'admin-listings' },
      { id: 'admin-petition', label: 'Petition', targetTab: 'dashboard', dashboardSection: 'admin-petition' },
      { id: 'admin-bugs', label: 'Bugs', targetTab: 'dashboard', dashboardSection: 'admin-bugs' },
      { id: 'public-directory', label: 'Directory', targetTab: 'directory' },
    ];
  }

  return [
    { id: 'owner-listing', label: 'My Listing', targetTab: 'dashboard', dashboardSection: 'profile' },
    { id: 'owner-reviews', label: 'Reviews', targetTab: 'dashboard', dashboardSection: 'reviews' },
    { id: 'owner-upgrade', label: 'Upgrade Plan', targetTab: 'dashboard', dashboardSection: 'billing' },
  ];
}

export function getMobileHeaderTabs(user: { isLoggedIn: boolean; role?: UserProfile['role'] }): HeaderTab[] {
  if (!user.isLoggedIn) {
    return [
      { id: 'home', label: 'Home', targetTab: 'home' },
      { id: 'directory', label: 'Explore', targetTab: 'directory' },
      { id: 'events', label: 'Events', targetTab: 'events' },
      { id: 'pricing', label: 'Pricing', targetTab: 'pricing' },
    ];
  }

  if (user.role === 'admin') {
    return [
      { id: 'admin-listings', label: 'Listings', targetTab: 'dashboard', dashboardSection: 'admin-listings' },
      { id: 'admin-petition', label: 'Petition', targetTab: 'dashboard', dashboardSection: 'admin-petition' },
      { id: 'admin-bugs', label: 'Bugs', targetTab: 'dashboard', dashboardSection: 'admin-bugs' },
      { id: 'public-directory', label: 'Directory', targetTab: 'directory' },
    ];
  }

  return [
    { id: 'owner-listing', label: 'Listing', targetTab: 'dashboard', dashboardSection: 'profile' },
    { id: 'owner-reviews', label: 'Reviews', targetTab: 'dashboard', dashboardSection: 'reviews' },
    { id: 'owner-upgrade', label: 'Plan', targetTab: 'dashboard', dashboardSection: 'billing' },
  ];
}

export function isHeaderTabActive(tab: HeaderTab, activeTab: string, locationHash: string = window.location.hash) {
  if (activeTab !== tab.targetTab) return false;

  if (tab.targetTab !== 'dashboard') return true;

  const activeDashboardSection = locationHash.startsWith('#dashboard-')
    ? locationHash.replace('#dashboard-', '')
    : undefined;

  if (tab.dashboardSection) {
    if (activeDashboardSection) return activeDashboardSection === tab.dashboardSection;
    return tab.dashboardSection === 'profile' || tab.dashboardSection === 'admin-listings';
  }

  return !activeDashboardSection;
}

export function getHeaderTabHref(tab: HeaderTab) {
  const path = tab.targetTab === 'home' ? '/' : `/${tab.targetTab}`;
  return tab.dashboardSection ? `${path}#dashboard-${tab.dashboardSection}` : path;
}

export default function Header({
  activeTab,
  setActiveTab,
  onNavigateTab,
  currentUser,
  setCurrentUser,
  onOpenLogin,
  isAiEnabled,
  setIsAiEnabled,
  serverAiAvailable,
  onServerAiAvailabilityChange,
}: HeaderProps) {
  const [isCheckingAiConfig, setIsCheckingAiConfig] = React.useState(false);
  const [currentHash, setCurrentHash] = React.useState(() => window.location.hash);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, []);

  const refreshAiAvailability = async () => {
    const response = await fetch('/api/ai-config', { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    const available = !!data.aiEnabled;
    onServerAiAvailabilityChange(available);
    return available;
  };

  const getTierBadge = (tier: Tier) => {
    switch (tier) {
      case 'premium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f2c35d] text-[#173542] shadow-sm border border-[#d28f33]/40">
            <Star className="w-3 h-3 fill-[#173542]" /> Premium Partner
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f7ead4] text-[#173542] border border-[#d28f33]/30">
            <Award className="w-3 h-3" /> Pro Partner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e4eee9] text-[#66716d] border border-[rgba(23,53,66,0.12)]">
            Basic Member
          </span>
        );
    }
  };

  const handleSignOut = () => {
    setCurrentUser({
      id: '',
      email: '',
      businessName: '',
      tier: 'basic',
      isLoggedIn: false,
    });
    setIsMobileMenuOpen(false);
    // If we're on the dashboard, switch to directory
    if (activeTab === 'dashboard') {
      setActiveTab('home');
    }
  };

  const handleTabClick = (tab: HeaderTab) => {
    const hash = tab.dashboardSection ? `dashboard-${tab.dashboardSection}` : undefined;
    setCurrentHash(hash ? `#${hash}` : '');
    setIsMobileMenuOpen(false);
    if (onNavigateTab) {
      onNavigateTab(tab.targetTab, hash);
      return;
    }
    if (hash) window.location.hash = hash;
    setActiveTab(tab.targetTab);
  };

  const desktopTabs = getDesktopHeaderTabs(currentUser);
  const mobileTabs = getMobileHeaderTabs(currentUser);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[rgba(23,53,66,0.16)] bg-white/85 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div 
          onClick={() => {
            setActiveTab('home');
            setIsMobileMenuOpen(false);
          }} 
          className="flex min-w-0 cursor-pointer items-center gap-2.5 group"
          id="brand-logo"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-md shadow-[#173542]/15 ring-1 ring-[rgba(23,53,66,0.12)] group-hover:scale-105 transition-transform overflow-hidden">
            <img
              src="/assets/brand/cc-logo.png"
              alt="Celina Connection"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-[#173542] flex items-center gap-1 whitespace-nowrap">
              Celina <span className="text-[#1f6473]">Connection</span>
            </p>
            <p className="hidden sm:flex text-[10px] font-bold tracking-wide text-[#66716d] uppercase -mt-0.5 items-center gap-0.5 whitespace-nowrap">
              <MapPin className="w-2.5 h-2.5 text-[#d28f33]" /> Local businesses, neighbor first
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden xl:flex items-center gap-0.5 rounded-lg bg-[#e4eee9]/75 p-1 ring-1 ring-[rgba(23,53,66,0.16)]" aria-label="Primary navigation">
          {desktopTabs.map((tab) => {
            const isActive = isHeaderTabActive(tab, activeTab, currentHash);
            return (
              <a
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                href={getHeaderTabHref(tab)}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  handleTabClick(tab);
                }}
                className={`relative rounded-lg px-3.5 py-2 text-[12px] font-bold tracking-tight transition-colors ${
                  isActive 
                    ? 'bg-white text-[#1f6473] shadow-sm ring-1 ring-[rgba(23,53,66,0.12)]' 
                    : 'text-[#66716d] hover:bg-white/80 hover:text-[#173542]'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-[#1f6473] to-[#d28f33]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right side authentication or profile summary */}
        <div className="flex items-center gap-3">
          {/* AI Toggle Switch */}
          {currentUser.isLoggedIn && currentUser.role === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#e4eee9]/70 border border-[rgba(23,53,66,0.12)] hover:bg-[#e4eee9] transition-colors mr-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className={`w-3.5 h-3.5 transition-all duration-500 ${isAiEnabled ? 'text-[#d28f33] animate-pulse scale-110' : 'text-[#66716d]'}`} />
                <span className="text-[11px] font-bold text-[#66716d] hidden sm:inline">Celina AI</span>
              </div>
              <button
                id="ai-toggle-btn"
                onClick={async () => {
                  setIsCheckingAiConfig(true);
                  try {
                    const available = serverAiAvailable || await refreshAiAvailability();
                    if (!available) {
                      alert("Celina AI is not available yet. The server is not reporting a configured Gemini key.");
                      return;
                    }
                    const newVal = !isAiEnabled;
                    setIsAiEnabled(newVal);
                    localStorage.setItem('celina_ai_enabled', String(newVal));
                  } catch {
                    alert("Celina AI could not verify the server configuration. Please refresh and try again.");
                  } finally {
                    setIsCheckingAiConfig(false);
                  }
                }}
                disabled={isCheckingAiConfig}
                className={`relative inline-flex h-4.5 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiEnabled ? 'bg-gradient-to-r from-[#1f6473] to-[#d28f33]' : 'bg-slate-200'
                }`}
                title={serverAiAvailable ? "Toggle Celina Connection AI Assistant" : "AI is offline (needs GEMINI_API_KEY)"}
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAiEnabled ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {currentUser.isLoggedIn ? (
            <div className="flex items-center gap-3" id="user-profile-menu">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-[#173542] truncate max-w-[150px]">
                  {currentUser.businessName || 'My Business'}
                </span>
                <span className="mt-0.5">
                  {getTierBadge(currentUser.tier)}
                </span>
              </div>
              <button
                id="btn-signout"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(23,53,66,0.16)] text-xs font-medium text-[#66716d] hover:text-[#173542] hover:bg-[#e4eee9] transition-colors cursor-pointer"
                title="Sign out of Dashboard"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              id="btn-signin-nav"
              onClick={onOpenLogin}
              className="hidden xl:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-extrabold bg-[#173542] text-white hover:bg-[#1f6473] transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Owners Login</span>
            </button>
          )}

          <button
            id="mobile-menu-toggle"
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(23,53,66,0.16)] bg-white text-[#173542] shadow-sm transition-colors hover:bg-[#e4eee9] hover:text-[#1f6473] xl:hidden"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile hamburger navigation menu */}
      {isMobileMenuOpen && (
        <div id="mobile-navigation-menu" className="xl:hidden border-t border-[rgba(23,53,66,0.12)] bg-white px-4 py-4 shadow-lg">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {mobileTabs.map((tab) => {
              const isActive = isHeaderTabActive(tab, activeTab, currentHash);
              return (
                <a
                  key={tab.id}
                  href={getHeaderTabHref(tab)}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    handleTabClick(tab);
                  }}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                    isActive ? 'bg-[#e4eee9] text-[#1f6473] shadow-sm ring-1 ring-[rgba(23,53,66,0.12)]' : 'bg-slate-50 text-[#66716d] hover:bg-[#e4eee9] hover:text-[#173542]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-[#d28f33]" aria-hidden="true" />}
                </a>
              );
            })}
            {!currentUser.isLoggedIn && (
              <button
                id="btn-signin-mobile-menu"
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#173542] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-[#1f6473] hover:shadow-md"
              >
                <LogIn className="h-4 w-4" />
                <span>Owners Login</span>
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
