import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Tier, Business } from '../types';
import {
  MapPin,
  Building2,
  LogIn,
  LogOut,
  Award,
  Star,
  Sparkles,
  Menu,
  X,
  ChevronDown,
  MoreHorizontal,
  Search,
  Home,
  Calendar,
  Zap,
  ShieldCheck,
  Bug,
  FileCheck2,
  Globe,
  Store,
  LayoutDashboard,
  Utensils,
  Briefcase,
  Flower2,
  HeartPulse,
  CheckCircle2,
  Sliders,
  BarChart3,
  Image,
  Eye,
  ListFilter,
  UserCheck,
  FileText,
  Shield,
  Command,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem, PUBLIC_MENU_ITEMS, OWNER_MENU_ITEMS, ADMIN_MENU_ITEMS } from '../config/menuItems';
import CommandMenuModal from './CommandMenuModal';

const BRAND_LOGO_PATH = '/images/celina-connection-logo.png';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNavigateTab?: (tab: string, hash?: string) => void;
  currentUser: UserProfile;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onOpenLogin: () => void;
  onOpenAdminLogin: () => void;
  isAiEnabled: boolean;
  setIsAiEnabled: (val: boolean) => void;
  serverAiAvailable: boolean;
  onServerAiAvailabilityChange: (val: boolean) => void;
  businesses?: Business[];
  onSelectBusiness?: (id: string) => void;
}

// Icon mapper for dynamic string icon keys
const iconMap: Record<string, React.ElementType> = {
  Home,
  Search,
  Calendar,
  Sparkles,
  FileText,
  LayoutDashboard,
  Store,
  Star,
  Zap,
  Sliders,
  ShieldCheck,
  Building2,
  Bug,
  FileCheck2,
  Globe,
  Utensils,
  Briefcase,
  Flower2,
  HeartPulse,
  CheckCircle2,
  BarChart3,
  Image,
  Eye,
  ListFilter,
  UserCheck,
};

export default function Header({
  activeTab,
  setActiveTab,
  onNavigateTab,
  currentUser,
  setCurrentUser,
  onOpenLogin,
  onOpenAdminLogin,
  isAiEnabled,
  setIsAiEnabled,
  serverAiAvailable,
  onServerAiAvailabilityChange,
  businesses = [],
  onSelectBusiness,
}: HeaderProps) {
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isCheckingAiConfig, setIsCheckingAiConfig] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const adminNavRef = useRef<HTMLDivElement>(null);

  // Sync window hash changes
  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, []);

  // Listen for Cmd+K / Ctrl+K keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        navRef.current && !navRef.current.contains(e.target as Node) &&
        adminNavRef.current && !adminNavRef.current.contains(e.target as Node)
      ) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-[var(--cc-deep-navy)] shadow-xs border border-amber-400">
            <Star className="w-2.5 h-2.5 fill-[var(--cc-deep-navy)]" /> Premium Partner
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200">
            <Award className="w-2.5 h-2.5" /> Pro Partner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
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
      tier: 'free',
      isLoggedIn: false,
    });
    setIsMobileMenuOpen(false);
    if (activeTab === 'dashboard') {
      setActiveTab('home');
    }
  };

  const isItemActive = (item: MenuItem) => {
    if (activeTab !== item.targetTab) return false;
    if (item.targetTab !== 'dashboard') return true;

    const activeSection = currentHash.startsWith('#dashboard-')
      ? currentHash.replace('#dashboard-', '')
      : undefined;

    if (item.dashboardSection) {
      return activeSection ? activeSection === item.dashboardSection : item.id.includes('profile') || item.id.includes('dashboard');
    }

    return !activeSection;
  };

  const getItemHref = (item: MenuItem) => {
    const path = item.targetTab === 'home' ? '/' : `/${item.targetTab}`;
    return item.dashboardSection ? `${path}#dashboard-${item.dashboardSection}` : path;
  };

  const handleMenuClick = (targetTab: string, dashboardSection?: string) => {
    const hash = dashboardSection ? `dashboard-${dashboardSection}` : undefined;
    setCurrentHash(hash ? `#${hash}` : '');
    setIsMobileMenuOpen(false);
    setActiveDropdownId(null);

    if (onNavigateTab) {
      onNavigateTab(targetTab, hash);
      return;
    }
    if (hash) window.location.hash = hash;
    setActiveTab(targetTab);
  };

  const renderIcon = (iconName?: string, className: string = 'w-4 h-4') => {
    if (!iconName) return null;
    const Component = iconMap[iconName] || Building2;
    return <Component className={className} />;
  };

  const isAdmin = currentUser.isLoggedIn && currentUser.role === 'admin';
  const isOwner = currentUser.isLoggedIn && currentUser.role === 'owner';

  return (
    <>
      {/* TIER 1: PRIMARY HEADER BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[rgba(15,45,77,0.12)] bg-[rgba(255,255,246,0.96)] backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
          
          {/* Brand Logo */}
          <div
            onClick={() => {
              setActiveTab('home');
              setIsMobileMenuOpen(false);
            }}
            className="flex cursor-pointer items-center gap-2.5 group flex-shrink-0"
            id="brand-logo"
          >
            <img
              src={BRAND_LOGO_PATH}
              alt="Celina Connection logo"
              className="h-9 w-9 rounded-xl object-contain shadow-md shadow-[rgba(15,45,77,0.12)] transition-transform group-hover:scale-105"
            />
            <div>
              <div className="font-display text-base font-extrabold tracking-tight text-[var(--cc-deep-navy)] flex items-center gap-1 leading-none">
                Celina <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--cc-copper)] to-[var(--cc-harvest-gold)]">Connection</span>
              </div>
              <p className="text-[9px] font-bold tracking-wider text-[var(--cc-charcoal)] uppercase mt-0.5 flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5 text-[var(--cc-copper)]" /> Texas Directory
              </p>
            </div>
          </div>

          {/* PUBLIC NAVIGATION ITEMS (Clean, minimal, uncluttered) */}
          <nav ref={navRef} className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
            {PUBLIC_MENU_ITEMS.map((item) => {
              const active = activeTab === item.targetTab;
              const hasSub = item.subItems && item.subItems.length > 0;
              const isDropdownOpen = activeDropdownId === item.id;

              return (
                <div key={item.id} className="relative">
                  <a
                    id={`nav-btn-${item.id}`}
                    href={getItemHref(item)}
                    onClick={(e) => {
                      e.preventDefault();
                      if (hasSub) {
                        setActiveDropdownId(isDropdownOpen ? null : item.id);
                      } else {
                        handleMenuClick(item.targetTab, item.dashboardSection);
                      }
                    }}
                    onMouseEnter={() => {
                      if (hasSub) setActiveDropdownId(item.id);
                    }}
                    className={`relative inline-flex items-center gap-1.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      active ? 'text-[var(--cc-copper)] font-bold' : 'text-[var(--cc-charcoal)] hover:text-[var(--cc-deep-navy)]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {hasSub && (
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-[var(--cc-copper)]' : ''}`} />
                    )}
                    {active && (
                      <motion.div
                        layoutId="active-public-indicator"
                        className="absolute -bottom-5 left-0 right-0 h-0.5 rounded-full bg-[var(--cc-copper)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </a>

                  {/* FLYOUT DROPDOWN */}
                  <AnimatePresence>
                    {hasSub && isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        onMouseLeave={() => setActiveDropdownId(null)}
                        className="absolute left-0 mt-3 w-64 rounded-2xl bg-white p-2 shadow-2xl border border-slate-200/90 z-50 divide-y divide-slate-100"
                      >
                        <div className="space-y-1">
                          {item.subItems!.map((sub) => {
                            const isClaimItem = sub.id === 'dir-claim';

                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleMenuClick(sub.targetTab, sub.dashboardSection)}
                                className={`w-full flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-all group cursor-pointer ${
                                  isClaimItem
                                    ? 'bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-300/80 shadow-2xs'
                                    : 'hover:bg-orange-50/70'
                                }`}
                              >
                                <div
                                  className={`mt-0.5 p-1.5 rounded-lg transition-colors ${
                                    isClaimItem
                                      ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xs'
                                      : 'bg-slate-100 group-hover:bg-orange-500 group-hover:text-white text-slate-600'
                                  }`}
                                >
                                  {renderIcon(sub.icon, 'w-3.5 h-3.5')}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`text-xs ${
                                        isClaimItem ? 'font-extrabold text-orange-950' : 'font-bold text-slate-800 group-hover:text-orange-950'
                                      }`}
                                    >
                                      {sub.label}
                                    </span>
                                    {sub.badge && (
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                          isClaimItem
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-2xs'
                                            : 'bg-orange-100 text-orange-800'
                                        }`}
                                      >
                                        {sub.badge}
                                      </span>
                                    )}
                                  </div>
                                  {sub.description && (
                                    <p
                                      className={`text-[10px] font-medium line-clamp-1 mt-0.5 ${
                                        isClaimItem ? 'text-orange-900/80 font-semibold' : 'text-slate-500'
                                      }`}
                                    >
                                      {sub.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* RIGHT ACTION CONTROLS */}
          <div className="flex items-center gap-3">
            
            {/* USER LOGIN STATE / ACCOUNT MENU */}
            {currentUser.isLoggedIn ? (
              <div className="flex items-center gap-2.5" id="user-profile-menu">
                {isAdmin ? (
                  <button
                    id="btn-signout"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
                    title="Sign out of the team dashboard"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="hidden xl:flex flex-col items-end text-right">
                      <span className="text-xs font-bold text-[var(--cc-deep-navy)] truncate max-w-[130px]">
                        {currentUser.businessName || 'My Business'}
                      </span>
                      {getTierBadge(currentUser.tier)}
                    </div>
                    <button
                      id="btn-signout"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-600 hover:text-[var(--cc-deep-navy)] hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Sign out of dashboard"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <a
                  href="/admin-login"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onOpenAdminLogin();
                  }}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--cc-slate-gray)] hover:text-[var(--cc-deep-navy)] hover:bg-[rgba(202,227,227,0.35)] transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Team Login</span>
                </a>
                <button
                  id="btn-signin-nav"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--cc-deep-navy)] text-white hover:bg-[var(--cc-copper)] transition-all shadow-xs cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Owners Sign In</span>
                </button>
              </>
            )}

            {/* MOBILE HAMBURGER TOGGLE BUTTON */}
            <button
              id="mobile-menu-toggle"
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(15,45,77,0.14)] bg-[var(--cc-warm-white)] text-[var(--cc-charcoal)] shadow-xs transition-colors hover:bg-[rgba(202,227,227,0.35)] hover:text-[var(--cc-copper)] md:hidden cursor-pointer"
              aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* TIER 2: EXECUTIVE ADMIN TOOLBAR SUB-BAR (Underneath Primary Header) */}
      {isAdmin && (
        <div className="sticky top-16 z-39 w-full bg-[var(--cc-deep-navy)] text-slate-100 border-b border-[rgba(212,185,94,0.25)] shadow-md">
          <div className="mx-auto flex h-11 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4 overflow-x-auto no-scrollbar">
            
            {/* Nav Items */}
            <nav ref={adminNavRef} className="flex items-center gap-1.5 flex-shrink-0">
              {ADMIN_MENU_ITEMS.map((item) => {
                const active = isItemActive(item);
                const hasSub = item.subItems && item.subItems.length > 0;
                const isDropdownOpen = activeDropdownId === item.id;

                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => {
                        if (item.id === 'admin-petition') {
                          handleMenuClick(item.targetTab, item.dashboardSection);
                        } else if (hasSub) {
                          setActiveDropdownId(isDropdownOpen ? null : item.id);
                        } else {
                          handleMenuClick(item.targetTab, item.dashboardSection);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-2xs'
                          : 'text-slate-300 hover:text-white hover:bg-[#143a63] font-medium'
                      }`}
                    >
                      {renderIcon(item.icon, `w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-slate-400'}`)}
                      <span>{item.label}</span>
                      {hasSub && (
                        <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180 text-amber-400' : 'text-slate-500'}`} />
                      )}
                    </button>

                    {/* ADMIN SUBMENU FLYOUT */}
                    <AnimatePresence>
                      {hasSub && isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          onMouseLeave={() => setActiveDropdownId(null)}
                          className="absolute left-0 mt-2 w-64 rounded-xl bg-[var(--cc-deep-navy)] p-1.5 shadow-2xl border border-[rgba(212,185,94,0.25)] z-50 space-y-0.5 text-slate-100"
                        >
                          {item.subItems!.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleMenuClick(sub.targetTab, sub.dashboardSection)}
                              className="w-full flex items-center gap-2 rounded-lg p-2 text-left hover:bg-[#143a63] text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              {renderIcon(sub.icon, 'w-3.5 h-3.5 text-amber-400')}
                              <div className="flex-1">
                                <p className="font-bold">{sub.label}</p>
                                {sub.description && (
                                  <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{sub.description}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--cc-deep-navy)] border border-[rgba(212,185,94,0.25)] text-slate-300">
                <Sparkles className={`w-3.5 h-3.5 ${isAiEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-[11px] font-semibold">AI Assistant</span>
                <button
                  id="ai-toggle-btn"
                  onClick={async () => {
                    setIsCheckingAiConfig(true);
                    try {
                      const available = serverAiAvailable || (await refreshAiAvailability());
                      if (!available) {
	                        alert('Celina AI is taking a short break. Please try again soon.');
                        return;
                      }
                      const newVal = !isAiEnabled;
                      setIsAiEnabled(newVal);
                      localStorage.setItem('celina_ai_enabled', String(newVal));
                    } catch {
	                      alert('We could not turn on Celina AI right now. Please try again soon.');
                    } finally {
                      setIsCheckingAiConfig(false);
                    }
                  }}
                  disabled={isCheckingAiConfig}
                  className={`relative inline-flex h-4 w-7.5 cursor-pointer rounded-full transition-colors ${
                    isAiEnabled ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform ${
                      isAiEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIER 2 FOR OWNER DASHBOARD (Underneath Primary Header) */}
      {isOwner && (
        <div className="sticky top-16 z-39 w-full bg-[var(--cc-deep-navy)] text-slate-100 border-b border-[rgba(212,185,94,0.25)] shadow-xs">
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Store className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-bold text-slate-200">
                Owner Portal: <span className="text-orange-400">{currentUser.businessName}</span>
              </span>
            </div>
            <nav className="flex items-center gap-2 flex-shrink-0">
              {OWNER_MENU_ITEMS.map((item) => {
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.targetTab, item.dashboardSection)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active ? 'bg-orange-500 text-white shadow-2xs' : 'text-slate-300 hover:text-white hover:bg-[#143a63]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getTierBadge(currentUser.tier)}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE SLIDE-DOWN NAVIGATION SHEET */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-200/80 bg-white px-4 py-5 shadow-2xl overflow-hidden z-50"
          >
            <div className="space-y-4">
              {/* Mobile Admin Navigation Header if Admin */}
              {isAdmin && (
                <div className="p-3 rounded-xl bg-[var(--cc-deep-navy)] text-white space-y-2 border border-[rgba(212,185,94,0.25)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
	                      <ShieldCheck className="w-4 h-4" /> Celina Team Tools
                    </span>
                    <button onClick={handleSignOut} className="text-xs text-red-400 font-bold hover:underline">
                      Sign Out
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {ADMIN_MENU_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleMenuClick(item.targetTab, item.dashboardSection)}
                        className={`p-2 rounded-lg text-left text-xs font-bold transition-colors ${
                          isItemActive(item) ? 'bg-amber-500 text-[var(--cc-deep-navy)]' : 'bg-[var(--cc-deep-navy)] text-slate-200 hover:bg-[#143a63]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mobile Public Navigation List */}
              <nav className="space-y-1" aria-label="Mobile Navigation">
                {PUBLIC_MENU_ITEMS.map((item) => {
                  const active = activeTab === item.targetTab;
                  return (
                    <div key={item.id} className="space-y-1">
                      <a
                        href={getItemHref(item)}
                        onClick={(e) => {
                          e.preventDefault();
                          handleMenuClick(item.targetTab, item.dashboardSection);
                        }}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
                          active
                            ? 'bg-orange-50 text-orange-800 shadow-xs ring-1 ring-orange-200'
                            : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-xl ${active ? 'bg-orange-500 text-white' : 'bg-slate-200/60 text-slate-600'}`}>
                            {renderIcon(item.icon, 'w-4 h-4')}
                          </div>
                          <span>{item.label}</span>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </nav>

              {!currentUser.isLoggedIn && (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--cc-deep-navy)] text-white rounded-2xl text-xs font-bold shadow-md cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Owners Sign In</span>
                  </button>
                  <a
                    href="/admin-login"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMobileMenuOpen(false);
                      onOpenAdminLogin();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold shadow-xs cursor-pointer hover:bg-slate-50"
                  >
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    <span>Team Login</span>
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMMAND PALETTE POPUP */}
      <CommandMenuModal
        isOpen={isCommandMenuOpen}
        onClose={() => setIsCommandMenuOpen(false)}
        businesses={businesses}
        currentUser={currentUser}
        onNavigateTab={(tab, hash) => {
          if (onNavigateTab) onNavigateTab(tab, hash);
          else setActiveTab(tab);
        }}
        onSelectBusiness={onSelectBusiness}
      />
    </>
  );
}

// label: 'Local Events'
