import React, { useState, useEffect } from 'react';
import { Business, Review, Tier, UserProfile, ReportedBug } from './types';
import { INITIAL_BUSINESSES } from './data/mockBusinesses';
import Header from './components/Header';
import DirectoryView from './components/DirectoryView';
import PricingView from './components/PricingView';
import LaunchView from './components/LaunchView';
import DashboardView from './components/DashboardView';
import EventsView from './components/EventsView';
import CheckoutModal from './components/CheckoutModal';
import BugReportForm from './components/BugReportForm';
import AiChatWidget from './components/AiChatWidget';
import { MapPin, Heart, ShieldAlert, Sparkles, Star, CheckCircle, Bug } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_BUGS: ReportedBug[] = [
  {
    id: 'bug-1',
    title: 'Mobile menu cut-off on iPhone SE screen sizes',
    description: 'When viewing the owner dashboard on a smaller screen (width around 320px), the top navigation bar menu is slightly cut off on the right-hand side.',
    category: 'visual',
    severity: 'low',
    email: 'test-user@legacywealthco.com',
    createdAt: '2026-07-01T10:00:00.000Z',
    status: 'open',
  },
  {
    id: 'bug-2',
    title: 'Payment checkout simulator loading delay',
    description: 'When purchasing a premium membership, the Stripe checkout modal simulated processing stays on spinner for 3 seconds, which is slightly long. A shorter loader or clearer status text would improve feedback.',
    category: 'functional',
    severity: 'medium',
    email: 'baker@celinapatisserie.com',
    createdAt: '2026-07-04T15:30:00.000Z',
    status: 'resolved',
  },
  {
    id: 'bug-3',
    title: 'Category count mismatches in Browse pills',
    description: 'The number of listings in the Dining category is showing 3 but there are actually 4 businesses registered under Dining in the mock data.',
    category: 'data',
    severity: 'high',
    email: 'admin@celinaconnect.com',
    createdAt: '2026-07-07T09:15:00.000Z',
    status: 'in-progress',
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('directory');
  
  // ==========================================
  // INDEX/SPLASH PAGE CONFIGURATION:
  // Set FORCE_SPLASH_LANDING to true to show the countdown splash page first.
  // Set FORCE_SPLASH_LANDING to false to bypass the splash page and land
  // directly on the main index/directory page.
  // ==========================================
  const FORCE_SPLASH_LANDING = true;

  // Launch campaign gating configuration (July 12, 2026 launch target)
  const launchCampaignTargetDate = new Date("2026-07-12T09:00:00-05:00").getTime();
  const [isGated, setIsGated] = useState<boolean>(() => {
    if (!FORCE_SPLASH_LANDING) return false;
    const now = new Date().getTime();
    if (now >= launchCampaignTargetDate) return false;
    const savedBypass = sessionStorage.getItem('celina_connection_gated_bypass');
    return savedBypass !== 'true';
  });

  const [reportedBugs, setReportedBugs] = useState<ReportedBug[]>([]);
  const [isBugModalOpen, setIsBugModalOpen] = useState<boolean>(false);
  
  // Primary States with LocalStorage Persistence
  const [isAiEnabled, setIsAiEnabled] = useState<boolean>(true);
  const [serverAiAvailable, setServerAiAvailable] = useState<boolean>(true);
  const [dashboardPortalMode, setDashboardPortalMode] = useState<'owner' | 'admin'>('owner');

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: '',
    email: '',
    businessName: '',
    tier: 'basic',
    isLoggedIn: false,
  });

  // UI state overlays
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [targetTier, setTargetTier] = useState<Tier | null>(null);
  const [targetInterval, setTargetInterval] = useState<'month' | 'year'>('year');
  const [paymentNotification, setPaymentNotification] = useState<{
    type: 'success' | 'cancel' | 'error';
    message: string;
  } | null>(null);

  // Initialize data on mount
  useEffect(() => {
    // Check AI server configuration status
    fetch('/api/ai-config')
      .then((res) => res.json())
      .then((data) => {
        setServerAiAvailable(!!data.aiEnabled);
        if (!data.aiEnabled) {
          setIsAiEnabled(false);
        } else {
          const cached = localStorage.getItem('celina_ai_enabled');
          if (cached !== null) {
            setIsAiEnabled(cached === 'true');
          } else {
            setIsAiEnabled(true);
          }
        }
      })
      .catch(() => {
        setServerAiAvailable(false);
        setIsAiEnabled(false);
      });

    let currentBusinesses = INITIAL_BUSINESSES;
    const cachedBusinesses = localStorage.getItem('celina_businesses_v3');
    if (cachedBusinesses) {
      try {
        const parsed = JSON.parse(cachedBusinesses);
        if (Array.isArray(parsed)) {
          currentBusinesses = parsed;
        } else {
          currentBusinesses = INITIAL_BUSINESSES;
          localStorage.setItem('celina_businesses_v3', JSON.stringify(INITIAL_BUSINESSES));
        }
        setBusinesses(currentBusinesses);
      } catch (e) {
        setBusinesses(INITIAL_BUSINESSES);
      }
    } else {
      setBusinesses(INITIAL_BUSINESSES);
      localStorage.setItem('celina_businesses_v2', JSON.stringify(INITIAL_BUSINESSES));
    }

    let user: UserProfile = {
      id: '',
      email: '',
      businessName: '',
      tier: 'basic',
      isLoggedIn: false,
    };
    const cachedUser = localStorage.getItem('celina_current_user');
    if (cachedUser) {
      try {
        user = JSON.parse(cachedUser);
        setCurrentUser(user);
      } catch (e) {
        // Fallback
      }
    }

    let currentBugs = INITIAL_BUGS;
    const cachedBugs = localStorage.getItem('celina_reported_bugs');
    if (cachedBugs) {
      try {
        currentBugs = JSON.parse(cachedBugs);
        setReportedBugs(currentBugs);
      } catch (e) {
        setReportedBugs(INITIAL_BUGS);
      }
    } else {
      setReportedBugs(INITIAL_BUGS);
      localStorage.setItem('celina_reported_bugs', JSON.stringify(INITIAL_BUGS));
    }

    // Process Stripe Redirect Parameters
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    const redirectTier = params.get('tier') as Tier | null;
    const redirectBusinessId = params.get('businessId');
    const redirectAddonQty = parseInt(params.get('addon_qty') || '0', 10);

    if (paymentStatus === 'success' && redirectTier) {
      const targetBusId = redirectBusinessId || user.businessId;
      const updatedBuses = currentBusinesses.map((b) => {
        if (b.ownerId === user.id || b.id === targetBusId) {
          return {
            ...b,
            tier: redirectTier,
            featured: redirectTier === 'premium',
            images: b.images && b.images.length > 0 
              ? b.images 
              : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'],
          };
        }
        return b;
      });

      const updatedUser: UserProfile = {
        ...user,
        tier: redirectTier,
        addonSlots: redirectAddonQty,
      };

      setBusinesses(updatedBuses);
      setCurrentUser(updatedUser);
      localStorage.setItem('celina_businesses_v3', JSON.stringify(updatedBuses));
      localStorage.setItem('celina_current_user', JSON.stringify(updatedUser));

      setPaymentNotification({
        type: 'success',
        message: `Stripe Billing Activated! Welcome to ${redirectTier === 'premium' ? 'Premium Partner' : 'Pro Partner'} Membership. Your partner dashboard features are now active!${
          redirectAddonQty > 0 ? ` Included: ${redirectAddonQty} Additional Business Add-on listing slot(s).` : ''
        }`,
      });

      // Clear query params to clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (paymentStatus === 'cancel') {
      setPaymentNotification({
        type: 'cancel',
        message: 'Stripe subscription setup was cancelled. No charges were made.',
      });
      // Clear URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Update storage on business modifications
  const updateBusinessesState = (updatedList: Business[]) => {
    setBusinesses(updatedList);
    localStorage.setItem('celina_businesses_v3', JSON.stringify(updatedList));
  };

  // Sync user state changes
  useEffect(() => {
    localStorage.setItem('celina_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Review System Handler
  const handleAddReview = (businessId: string, reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    const newReview: Review = {
      id: `rev-${Math.random().toString(36).substring(2, 7)}`,
      authorName: reviewData.authorName,
      rating: reviewData.rating,
      text: reviewData.text,
      createdAt: new Date().toISOString(),
    };

    const updated = businesses.map((b) => {
      if (b.id === businessId) {
        return {
          ...b,
          reviews: [newReview, ...b.reviews],
        };
      }
      return b;
    });

    updateBusinessesState(updated);
  };

  // Directory Registration Handler
  const handleAddBusiness = (
    busData: Partial<Business> & { name: string; category: string; description: string; phone: string; email: string; tier: Tier }
  ): string => {
    const randomIdSuffix = Math.random().toString(36).substring(2, 5);
    const safeId = busData.id || (busData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomIdSuffix);
    const newBus: Business = {
      id: safeId,
      name: busData.name,
      category: busData.category,
      description: busData.description,
      phone: busData.phone,
      email: busData.email,
      website: busData.website || '',
      address: busData.address || '',
      hours: busData.hours || { monFri: "9:00 AM - 5:00 PM", sat: "10:00 AM - 4:00 PM", sun: "Closed" },
      logoUrl: busData.logoUrl || '',
      images: busData.images || [],
      socialLinks: busData.socialLinks || {},
      featured: busData.featured || false,
      ctaText: busData.ctaText || 'Learn More',
      tier: busData.tier,
      ownerId: busData.ownerId || '',
      createdAt: busData.createdAt || new Date().toISOString(),
      viewsCount: busData.viewsCount || 12,
      reviews: busData.reviews || [],
      isUnclaimed: busData.isUnclaimed || false,
    };

    const updated = [...businesses, newBus];
    updateBusinessesState(updated);
    return safeId;
  };

  // Directory Editor Handler
  const handleUpdateBusiness = (
    businessIdOrIds: string | string[],
    updatedFields: Partial<Business> | ((b: Business) => Partial<Business>)
  ) => {
    const ids = Array.isArray(businessIdOrIds) ? businessIdOrIds : [businessIdOrIds];
    const updated = businesses.map((b) => {
      if (ids.includes(b.id)) {
        const fields = typeof updatedFields === 'function' ? updatedFields(b) : updatedFields;
        return {
          ...b,
          ...fields,
        };
      }
      return b;
    });
    updateBusinessesState(updated);
  };

  // Directory Claim Handler
  const handleClaimBusiness = (businessId: string, email: string) => {
    const newOwnerId = `owner-${Math.random().toString(36).substring(2, 7)}`;
    const targetBus = businesses.find((b) => b.id === businessId);
    if (!targetBus) return;

    const updated = businesses.map((b) => {
      if (b.id === businessId) {
        return {
          ...b,
          ownerId: newOwnerId,
          isUnclaimed: false,
          isRegistryOnly: false,
          email: email,
        };
      }
      return b;
    });
    updateBusinessesState(updated);

    // Sync session login as owner
    setCurrentUser({
      id: newOwnerId,
      email: email,
      businessName: targetBus.name,
      businessId: businessId,
      tier: targetBus.tier,
      isLoggedIn: true,
      addonSlots: 0,
      role: 'owner',
    });

    setSelectedBusinessId(null);
    setActiveTab('dashboard');

    setPaymentNotification({
      type: 'success',
      message: `Congratulations! Listing for "${targetBus.name}" has been successfully claimed. Welcome to your Owner Dashboard!`,
    });
  };

  // Directory Delete Handler (Admin Only)
  const handleDeleteBusiness = (businessIdOrIds: string | string[]) => {
    const ids = Array.isArray(businessIdOrIds) ? businessIdOrIds : [businessIdOrIds];
    const updated = businesses.filter((b) => !ids.includes(b.id));
    updateBusinessesState(updated);
    if (currentUser.businessId && ids.includes(currentUser.businessId)) {
      const nextBus = updated.find(b => b.ownerId === currentUser.id);
      setCurrentUser((prev) => ({
        ...prev,
        businessId: nextBus?.id || '',
        businessName: nextBus?.name || '',
      }));
    }
    setPaymentNotification({
      type: 'success',
      message: `${ids.length} business listing${ids.length > 1 ? 's' : ''} successfully deleted.`,
    });
  };

  // Bug Report Handlers
  const handleAddBug = (bugData: Omit<ReportedBug, 'id' | 'createdAt' | 'status'>) => {
    const newBug: ReportedBug = {
      ...bugData,
      id: `bug-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'open',
    };
    const updated = [newBug, ...reportedBugs];
    setReportedBugs(updated);
    localStorage.setItem('celina_reported_bugs', JSON.stringify(updated));
    setPaymentNotification({
      type: 'success',
      message: 'Thank you! Your bug report has been submitted successfully and will be reviewed by the admin immediately.',
    });
  };

  const handleUpdateBugStatus = (bugId: string, status: ReportedBug['status']) => {
    const updated = reportedBugs.map(b => b.id === bugId ? { ...b, status } : b);
    setReportedBugs(updated);
    localStorage.setItem('celina_reported_bugs', JSON.stringify(updated));
  };

  const handleDeleteBugStatus = (bugId: string) => {
    const updated = reportedBugs.filter(b => b.id !== bugId);
    setReportedBugs(updated);
    localStorage.setItem('celina_reported_bugs', JSON.stringify(updated));
  };

  // Database Reset Handler (Admin Only)
  const handleResetDatabase = () => {
    localStorage.removeItem('celina_businesses_v3');
    setBusinesses(INITIAL_BUSINESSES);
    localStorage.setItem('celina_businesses_v2', JSON.stringify(INITIAL_BUSINESSES));
    setPaymentNotification({
      type: 'success',
      message: 'Database successfully reset to initial Celina Connection mock businesses.',
    });
  };

  // Checkout Upgrade Handler
  const handlePaymentSuccess = (tier: Tier, addonQty: number = 0) => {
    // Find all businesses owned by this user
    const myBuses = businesses.filter(
      (b) => b.ownerId === currentUser.id || (currentUser.email && b.email.toLowerCase() === currentUser.email.toLowerCase())
    );

    // Sort so that the main business is first
    const sortedBuses = [...myBuses].sort((a, b) => {
      if (a.id === currentUser.businessId) return -1;
      if (b.id === currentUser.businessId) return 1;
      return 0;
    });

    // The user has selected a tier (e.g. 'pro' or 'premium').
    // The main business gets the tier.
    // Up to addonQty of other businesses also get upgraded.
    let upgradedAddonsCount = 0;
    const updated = businesses.map((b) => {
      const isOwned = b.ownerId === currentUser.id || (currentUser.email && b.email.toLowerCase() === currentUser.email.toLowerCase());
      if (!isOwned) return b;

      const isMain = b.id === currentUser.businessId || (sortedBuses[0] && b.id === sortedBuses[0].id);
      const shouldUpgrade = isMain || (upgradedAddonsCount < addonQty);
      
      if (!isMain && shouldUpgrade) {
        upgradedAddonsCount++;
      }

      if (shouldUpgrade) {
        return {
          ...b,
          tier: tier,
          featured: tier === 'premium',
          images: b.images && b.images.length > 0 
            ? b.images 
            : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'],
        };
      } else {
        // Return to basic if not upgraded
        return {
          ...b,
          tier: 'basic' as Tier,
          featured: false,
        };
      }
    });

    updateBusinessesState(updated);

    // Upgrade active login session
    setCurrentUser((prev) => ({
      ...prev,
      tier: tier,
      addonSlots: addonQty,
    }));

    setTargetTier(null);
  };

  const handleOpenLoginPrompt = () => {
    setActiveTab('dashboard');
  };

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId) || null;

  if (isGated) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white" id="celina-connect-gated-root">
        {/* Top Banner Accent */}
        <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

        {/* Simplified Header */}
        <header className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50 py-4 px-6 md:px-12 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-black font-display text-lg shadow-md shadow-orange-500/10">
                C
              </div>
              <div>
                <h1 className="font-display font-black text-base tracking-tight leading-none text-slate-900">
                  Celina <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Connection</span>
                </h1>
                <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-1">
                  Texas Business Hub
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                Gated Launch Campaign
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Pane Render */}
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 pt-6">
          <LaunchView
            businesses={businesses}
            setActiveTab={(tab) => {
              setIsGated(false);
              sessionStorage.setItem('celina_connection_gated_bypass', 'true');
              setActiveTab(tab);
            }}
            onUpgradePrompt={(tier) => {
              setIsGated(false);
              sessionStorage.setItem('celina_connection_gated_bypass', 'true');
              setTargetTier(tier);
              setActiveTab('pricing');
            }}
            isGated={true}
            onBypassGating={() => {
              setIsGated(false);
              sessionStorage.setItem('celina_connection_gated_bypass', 'true');
            }}
          />
        </main>

        {/* Simplified Footer */}
        <footer className="border-t border-slate-100 bg-white py-8 text-slate-400 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 font-medium">
              © {new Date().getFullYear()} Celina Connection. All Rights Reserved. Launching July 12, 2026.
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Made with ❤️ for Celina, Texas Community.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-orange-500 selection:text-white" id="celina-connection-root">
      {/* Top Banner Accent */}
      <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

      {/* Main Header navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        onOpenLogin={handleOpenLoginPrompt}
        isAiEnabled={isAiEnabled}
        setIsAiEnabled={setIsAiEnabled}
        serverAiAvailable={serverAiAvailable}
      />

      {/* Stripe Payment Notification Banner */}
      <AnimatePresence>
        {paymentNotification && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4"
          >
            <div className={`p-4 rounded-2xl border flex items-start justify-between gap-4 shadow-sm ${
              paymentNotification.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                : 'bg-amber-50 border-amber-100 text-amber-900'
            }`}>
              <div className="flex items-center gap-2.5">
                {paymentNotification.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                )}
                <p className="text-xs font-semibold leading-relaxed">
                  {paymentNotification.message}
                </p>
              </div>
              <button
                onClick={() => setPaymentNotification(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Tab Pane Render */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16">
        {activeTab === 'directory' && (
          <DirectoryView
            businesses={businesses}
            onAddReview={handleAddReview}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={(b) => {
              // Increment views on profile click!
              handleUpdateBusiness(b.id, { viewsCount: b.viewsCount + 1 });
              setSelectedBusinessId(b.id);
            }}
            onCloseDetail={() => setSelectedBusinessId(null)}
            onUpgradePrompt={(tier) => {
              setSelectedBusinessId(null);
              setTargetTier(tier);
            }}
            onClaimBusiness={handleClaimBusiness}
            isAiEnabled={isAiEnabled}
            serverAiAvailable={serverAiAvailable}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingView
            currentUser={currentUser}
            onSelectTier={(tier, interval) => {
              setTargetInterval(interval || 'year');
              setTargetTier(tier);
            }}
            onOpenLogin={handleOpenLoginPrompt}
          />
        )}

        {activeTab === 'launch' && (
          <LaunchView
            businesses={businesses}
            setActiveTab={setActiveTab}
            onUpgradePrompt={(tier) => setTargetTier(tier)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            businesses={businesses}
            onAddBusiness={handleAddBusiness}
            onUpdateBusiness={handleUpdateBusiness}
            onUpgradePrompt={(tier) => setTargetTier(tier)}
            onDeleteBusiness={handleDeleteBusiness}
            onResetDatabase={handleResetDatabase}
            reportedBugs={reportedBugs}
            onUpdateBugStatus={handleUpdateBugStatus}
            onDeleteBugStatus={handleDeleteBugStatus}
            portalMode={dashboardPortalMode}
            setPortalMode={setDashboardPortalMode}
          />
        )}
      </main>

      {/* Payment Gateway Checkout Modal Simulation */}
      <CheckoutModal
        targetTier={targetTier}
        targetInterval={targetInterval}
        onChangeInterval={setTargetInterval}
        onClose={() => setTargetTier(null)}
        onPaymentSuccess={handlePaymentSuccess}
        currentUser={currentUser}
        businesses={businesses}
      />

      {/* Bug Report Form Overlay Modal */}
      <BugReportForm
        isOpen={isBugModalOpen}
        onClose={() => setIsBugModalOpen(false)}
        onSubmit={handleAddBug}
        currentUserEmail={currentUser.email}
      />

      {/* Floating Bug Reporting Badge (Bottom-Left) */}
      <button
        onClick={() => setIsBugModalOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-rose-600 hover:bg-rose-700 text-white p-3 sm:px-4 sm:py-2.5 rounded-full shadow-lg hover:shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer font-sans font-bold text-xs border border-rose-500/10"
        title="Report a bug ASAP to admin"
      >
        <Bug className="w-4 h-4 text-white animate-pulse" />
        <span className="hidden sm:inline">Report a Bug</span>
      </button>

      {/* Celina Connection Welcoming Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left */}
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold font-display text-xs">
                C
              </div>
              <span className="font-display font-extrabold text-sm text-slate-900 tracking-tight">
                Celina Connection
              </span>
            </div>

            {/* Middle Nav Links */}
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-400">
              <button onClick={() => setActiveTab('directory')} className="hover:text-slate-600">Browse Directory</button>
              <button onClick={() => setActiveTab('pricing')} className="hover:text-slate-600">Membership Plans</button>
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-slate-600">Onboard Your Business</button>
            </div>
          </div>

          <hr className="border-slate-150" />

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <p className="flex items-center gap-1">
              Made with <Heart className="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> for the Celina, Texas Community.
            </p>
            <span>&copy; {new Date().getFullYear()} Celina Connection. All Rights Reserved.</span>
          </div>
        </div>
      </footer>

      {/* Floating AI Chat Assistant */}
      <AiChatWidget businesses={businesses} isAiEnabled={isAiEnabled} />
    </div>
  );
}
