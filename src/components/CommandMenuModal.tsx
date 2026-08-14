import React, { useState, useEffect } from 'react';
import { Search, Building2, Calendar, Sparkles, FileText, X, ArrowRight, Shield, User, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Business, UserProfile } from '../types';
import { PUBLIC_MENU_ITEMS, OWNER_MENU_ITEMS, ADMIN_MENU_ITEMS } from '../config/menuItems';

interface CommandMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  currentUser: UserProfile;
  onNavigateTab: (tab: string, hash?: string) => void;
  onSelectBusiness?: (id: string) => void;
}

export default function CommandMenuModal({
  isOpen,
  onClose,
  businesses,
  currentUser,
  onNavigateTab,
  onSelectBusiness,
}: CommandMenuModalProps) {
  const [query, setQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Navigation options
  const allMenuItems = [
    ...PUBLIC_MENU_ITEMS,
    ...(currentUser.isLoggedIn ? OWNER_MENU_ITEMS : []),
    ...(currentUser.isLoggedIn && currentUser.role === 'admin' ? ADMIN_MENU_ITEMS : []),
  ];

  const filteredPages = allMenuItems.filter((item) =>
    item.label.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q))
  );

  const filteredBusinesses = q
    ? businesses.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const handleSelectPage = (targetTab: string, dashboardSection?: string) => {
    onClose();
    onNavigateTab(targetTab, dashboardSection ? `dashboard-${dashboardSection}` : undefined);
  };

  const handleSelectBiz = (id: string) => {
    onClose();
    onNavigateTab('directory');
    if (onSelectBusiness) onSelectBusiness(id);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[rgba(15,45,77,0.62)] backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Search Bar Input */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <Search className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search directory pages, businesses, categories (e.g. Dining, Events, Pricing)..."
              className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2.5 py-1 bg-slate-200/70 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
            >
              ESC
            </button>
          </div>

          {/* Results Area */}
          <div className="p-4 overflow-y-auto space-y-6 divide-y divide-slate-100">
            {/* Direct Pages & Views */}
            {filteredPages.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Navigation & Tools
                </span>
                <div className="space-y-1">
                  {filteredPages.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectPage(item.targetTab, item.dashboardSection)}
                      className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-orange-50/80 hover:border-orange-200 border border-transparent transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-orange-500 group-hover:text-white text-slate-600 transition-colors">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-800 group-hover:text-orange-950">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Businesses Match */}
            {filteredBusinesses.length > 0 && (
              <div className="pt-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Matching Celina Businesses
                </span>
                <div className="space-y-1">
                  {filteredBusinesses.map((biz) => (
                    <button
                      key={biz.id}
                      onClick={() => handleSelectBiz(biz.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200 transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-800 group-hover:text-amber-950">
                              {biz.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600">
                              {biz.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                            {biz.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredPages.length === 0 && filteredBusinesses.length === 0 && (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-bold">No results found for "{query}"</p>
                <p className="text-[11px] mt-1">Try searching for "Events", "Dining", or "Pricing".</p>
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium flex items-center justify-between px-6">
	            <span>Celina Connection Quick Menu</span>
	            <span className="text-[10px]">Press Esc to close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
