import React from 'react';
import { UserProfile, Tier } from '../types';
import { MapPin, Building2, Shield, LogIn, LogOut, Award, Star, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onOpenLogin: () => void;
  isAiEnabled: boolean;
  setIsAiEnabled: (val: boolean) => void;
  serverAiAvailable: boolean;
}

export default function Header({
  activeTab,
  setActiveTab,
  currentUser,
  setCurrentUser,
  onOpenLogin,
  isAiEnabled,
  setIsAiEnabled,
  serverAiAvailable,
}: HeaderProps) {
  const getTierBadge = (tier: Tier) => {
    switch (tier) {
      case 'premium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-sm border border-amber-400">
            <Star className="w-3 h-3 fill-slate-950" /> Premium Partner
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <Award className="w-3 h-3" /> Pro Partner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
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
    // If we're on the dashboard, switch to directory
    if (activeTab === 'dashboard') {
      setActiveTab('directory');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div 
          onClick={() => setActiveTab('directory')} 
          className="flex cursor-pointer items-center gap-2.5 group"
          id="brand-logo"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-100 group-hover:scale-105 transition-transform">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1">
              Celina <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Connection</span>
            </h1>
            <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase -mt-0.5 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5 text-orange-500" /> Texas Business Directory
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden lg:flex space-x-1" aria-label="Tabs">
          {[
            { id: 'directory', label: 'Explore Directory' },
            { id: 'pricing', label: 'Membership Tiers' },
            { id: 'dashboard', label: currentUser.isLoggedIn ? 'Owner Dashboard' : 'Join as Business' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? 'text-orange-600 font-semibold' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side authentication or profile summary */}
        <div className="flex items-center gap-3">
          {/* AI Toggle Switch */}
          {currentUser.isLoggedIn && currentUser.role === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors mr-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className={`w-3.5 h-3.5 transition-all duration-500 ${isAiEnabled ? 'text-orange-500 animate-pulse scale-110' : 'text-slate-400'}`} />
                <span className="text-[11px] font-bold text-slate-600 hidden sm:inline">Celina AI</span>
              </div>
              <button
                id="ai-toggle-btn"
                onClick={() => {
                  if (!serverAiAvailable) {
                    alert("Celina AI features require a GEMINI_API_KEY. Set it up in Settings > Secrets to unlock!");
                    return;
                  }
                  const newVal = !isAiEnabled;
                  setIsAiEnabled(newVal);
                  localStorage.setItem('celina_ai_enabled', String(newVal));
                }}
                className={`relative inline-flex h-4.5 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiEnabled ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-slate-200'
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
                <span className="text-xs font-semibold text-slate-950 truncate max-w-[150px]">
                  {currentUser.businessName || 'My Business'}
                </span>
                <span className="mt-0.5">
                  {getTierBadge(currentUser.tier)}
                </span>
              </div>
              <button
                id="btn-signout"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-orange-600 hover:to-amber-500 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Owner Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="lg:hidden flex border-t border-slate-100 bg-white justify-around py-2">
        {[
          { id: 'directory', label: 'Explore' },
          { id: 'pricing', label: 'Pricing' },
          { id: 'dashboard', label: currentUser.isLoggedIn ? 'Dashboard' : 'Join' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-medium py-1 px-3 rounded-md transition-colors ${
                isActive ? 'text-orange-600 bg-orange-50/50 font-semibold' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
