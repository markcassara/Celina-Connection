import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import SeoHead from './components/SeoHead';
import { api } from './lib/api';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    const path = location.pathname.replace('/', '');
    if (path.startsWith('business/')) return 'directory';
    if (path === 'owner-login' || path === 'admin-login') return path;
    return path || 'directory';
  });
  
  // Business slug from URL
  const businessSlug = location.pathname.startsWith('/business/') 
    ? location.pathname.replace('/business/', '')
    : null;
  
  // Sync URL when activeTab changes
  useEffect(() => {
    if (businessSlug) return;
    const path = activeTab === 'directory' ? '/' : `/${activeTab}`;
    if (location.pathname !== path) {
      navigate(path, { replace: true });
    }
  }, [activeTab, navigate, location.pathname, businessSlug]);
  
  // Handle business selection via URL
  useEffect(() => {
    if (businessSlug) {
      const business = businesses.find(b => b.slug === businessSlug || b.id === businessSlug);
      if (business) setSelectedBusinessId(business.id);
    }
  }, [businessSlug, businesses]);
  
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
    if (location.pathname.startsWith('/business/')) return false;
    if (location.pathname === '/owner-login' || location.pathname === '/admin-login') return false;
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
  const [dashboardPortalMode, setDashboardPortalMode] = useState<'owner' | 'admin'>(() => (
    location.pathname === '/admin-login' ? 'admin' : 'owner'
  ));
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: '',
    email: '',
    businessName: '',
    tier: 'basic',
    isLoggedIn: false,
  });

  const openOwnerLogin = () => {
    setIsGated(false);
    sessionStorage.setItem('celina_connection_gated_bypass', 'true');
    setDashboardPortalMode('owner');
    setActiveTab('owner-login');
  };

  const openAdminLogin = () => {
    setIsGated(false);
    sessionStorage.setItem('celina_connection_gated_bypass', 'true');
    setDashboardPortalMode('admin');
    setActiveTab('admin-login');
  };

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
    let isMounted = true;

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

    const load = async () => {
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
          const parsedUser = JSON.parse(cachedUser) as UserProfile;
          // SECURITY: localStorage is user-controlled. Never restore an admin
          // session from client storage; real admin auth must be server-issued.
          if (parsedUser.role === 'admin') {
            localStorage.removeItem('celina_current_user');
          } else {
            user = parsedUser;
            if (isMounted) setCurrentUser(user);
          }
        } catch {
          // ignore malformed cached user payload
        }
      }

      let currentBusinesses = INITIAL_BUSINESSES;
      let currentBugs = INITIAL_BUGS;

      try {
        const bootstrap = await api.bootstrap();
        currentBusinesses = bootstrap.businesses;
        currentBugs = bootstrap.reportedBugs;
      } catch {
        // fall back to bundled mock data when backend is unavailable
      }

      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment_status');
      const redirectTier = params.get('tier') as Tier | null;
      const redirectBusinessId = params.get('businessId');
      const redirectAddonQty = parseInt(params.get('addon_qty') || '0', 10);

      if (paymentStatus === 'success' && redirectTier) {
        const targetBusId = redirectBusinessId || user.businessId;
        currentBusinesses = await Promise.all(currentBusinesses.map(async (business) => {
          if (business.ownerId !== user.id && business.id !== targetBusId) {
            return business;
          }

          const payload: Partial<Business> = {
            tier: redirectTier,
            featured: redirectTier === 'premium',
            images: business.images && business.images.length > 0
              ? business.images
              : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'],
          };

          try {
            return await api.updateBusiness(business.id, payload);
          } catch {
            return { ...business, ...payload };
          }
        }));

        const updatedUser: UserProfile = {
          ...user,
          tier: redirectTier,
          addonSlots: redirectAddonQty,
        };

        if (isMounted) {
          setCurrentUser(updatedUser);
          setPaymentNotification({
            type: 'success',
            message: `Stripe Billing Activated! Welcome to ${redirectTier === 'premium' ? 'Premium Partner' : 'Pro Partner'} Membership. Your partner dashboard features are now active!${
              redirectAddonQty > 0 ? ` Included: ${redirectAddonQty} Additional Business Add-on listing slot(s).` : ''
            }`,
          });
        }
        localStorage.setItem('celina_current_user', JSON.stringify(updatedUser));

        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else if (paymentStatus === 'cancel' && isMounted) {
        setPaymentNotification({
          type: 'cancel',
          message: 'Stripe subscription setup was cancelled. No charges were made.',
        });
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }

      if (isMounted) {
        setBusinesses(currentBusinesses);
        setReportedBugs(currentBugs);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync user state changes
  useEffect(() => {
    localStorage.setItem('celina_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Review System Handler
  const handleAddReview = async (businessId: string, reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    const result = await api.addReview(businessId, reviewData);
    setBusinesses((prev) => prev.map((business) => (business.id === businessId ? result.business : business)));
  };

  // Directory Registration Handler
  const handleAddBusiness = async (
    busData: Partial<Business> & { name: string; category: string; description: string; phone: string; email: string; tier: Tier }
  ): Promise<string> => {
    const newBusiness = await api.createBusiness(busData);
    setBusinesses((prev) => [...prev, newBusiness]);
    return newBusiness.id;
  };

  // Directory Editor Handler
  const handleUpdateBusiness = async (
    businessIdOrIds: string | string[],
    updatedFields: Partial<Business> | ((b: Business) => Partial<Business>)
  ): Promise<void> => {
    const ids = Array.isArray(businessIdOrIds) ? businessIdOrIds : [businessIdOrIds];
    const snapshot = businesses;

    const updatedResults = await Promise.all(ids.map(async (id) => {
      const existing = snapshot.find((business) => business.id === id);
      if (!existing) return null;
      const fields = typeof updatedFields === 'function' ? updatedFields(existing) : updatedFields;
      return api.updateBusiness(id, fields);
    }));

    setBusinesses((prev) => prev.map((business) => {
      const updated = updatedResults.find((item) => item?.id === business.id);
      return updated || business;
    }));
  };

  // Directory Claim Handler
  const handleClaimBusiness = async (businessId: string, email: string) => {
    const targetBus = businesses.find((b) => b.id === businessId);
    if (!targetBus) return;

    const result = await api.claimBusiness(businessId, email);
    setBusinesses((prev) => prev.map((business) => (business.id === businessId ? result.business : business)));

    // Sync session login as owner
    setCurrentUser(result.currentUser);

    setSelectedBusinessId(null);
    setActiveTab('dashboard');

    setPaymentNotification({
      type: 'success',
      message: `Congratulations! Listing for "${targetBus.name}" has been successfully claimed. Welcome to your Owner Dashboard!`,
    });
  };

  // Directory Delete Handler (Admin Only)
  const handleDeleteBusiness = async (businessIdOrIds: string | string[]) => {
    const ids = Array.isArray(businessIdOrIds) ? businessIdOrIds : [businessIdOrIds];
    await Promise.all(ids.map((id) => api.deleteBusiness(id)));
    const updated = businesses.filter((b) => !ids.includes(b.id));
    setBusinesses(updated);
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
  const handleAddBug = async (bugData: Omit<ReportedBug, 'id' | 'createdAt' | 'status'>) => {
    const newBug = await api.createBug(bugData);
    setReportedBugs((prev) => [newBug, ...prev]);
    setPaymentNotification({
      type: 'success',
      message: 'Thank you! Your bug report has been submitted successfully and will be reviewed by the admin immediately.',
    });
  };

  const handleUpdateBugStatus = async (bugId: string, status: ReportedBug['status']) => {
    const updated = await api.updateBug(bugId, { status });
    setReportedBugs((prev) => prev.map((bug) => bug.id === bugId ? updated : bug));
  };

  const handleDeleteBugStatus = async (bugId: string) => {
    await api.deleteBug(bugId);
    setReportedBugs((prev) => prev.filter((bug) => bug.id !== bugId));
  };

  // Database Reset Handler (Admin Only)
  const handleResetDatabase = async () => {
    const resetState = await api.resetDatabase();
    setBusinesses(resetState.businesses);
    setReportedBugs(resetState.reportedBugs);
    setPaymentNotification({
      type: 'success',
      message: 'Database successfully reset to the seeded Celina Connection backend state.',
    });
  };

  // Checkout Upgrade Handler
  const handlePaymentSuccess = async (tier: Tier, addonQty: number = 0) => {
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

    const changedBusinesses = updated.filter((business, index) => {
      const original = businesses[index];
      return original && (original.tier !== business.tier || original.featured !== business.featured || original.images !== business.images);
    });

    const persisted = await Promise.all(changedBusinesses.map((business) =>
      api.updateBusiness(business.id, {
        tier: business.tier,
        featured: business.featured,
        images: business.images,
      })
    ));

    setBusinesses((prev) => prev.map((business) => persisted.find((item) => item.id === business.id) || business));

    // Upgrade active login session
    setCurrentUser((prev) => ({
      ...prev,
      tier: tier,
      addonSlots: addonQty,
    }));

    setTargetTier(null);
  };

  const handleOpenLoginPrompt = () => {
    openOwnerLogin();
  };

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId) || null;

  if (isGated) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white" id="celina-connect-gated-root">
        <SeoHead activeTab="launch" businessCount={businesses.length} />
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
                Limited Early Access
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
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
              <button onClick={openAdminLogin} className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold underline-offset-4 hover:underline">
                Admin Login
              </button>
              <p className="text-[11px] text-slate-400 font-medium">
                Made with ❤️ for Celina, Texas Community.
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans selection:bg-orange-500 selection:text-white" id="celina-connection-root">
      <SeoHead activeTab={activeTab} selectedBusiness={selectedBusiness} businessCount={businesses.length} />
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
              handleUpdateBusiness(b.id, { viewsCount: b.viewsCount + 1 });
              setSelectedBusinessId(b.id);
              navigate(`/business/${b.slug || b.id}`);
            }}
            onCloseDetail={() => {
              setSelectedBusinessId(null);
              navigate('/');
            }}
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

        {(activeTab === 'dashboard' || activeTab === 'owner-login' || activeTab === 'admin-login') && (
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
            defaultOwnerView={activeTab === 'owner-login' ? 'login' : 'register'}
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
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-600">
              <button onClick={() => setActiveTab('directory')} className="hover:text-slate-900">Browse Directory</button>
              <button onClick={() => setActiveTab('pricing')} className="hover:text-slate-900">Membership Plans</button>
              <button onClick={openOwnerLogin} className="hover:text-slate-900">Owner Login</button>
              <button onClick={openAdminLogin} className="hover:text-slate-900">Admin Login</button>
            </div>
          </div>

          <hr className="border-slate-150" />

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600">
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
