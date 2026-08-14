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
import LegacyHillsPetitionView from './components/LegacyHillsPetitionView';
import LegacyHillsPetitionSignaturesView from './components/LegacyHillsPetitionSignaturesView';
import PolicyView from './components/PolicyView';
import CheckoutModal from './components/CheckoutModal';
import BugReportForm from './components/BugReportForm';
import AiChatWidget from './components/AiChatWidget';
import SEOHead, { SchemaJson } from './components/SeoHead';
import { CELINA_EVENTS } from './data/mockEvents';
import { api } from './lib/api';
import { activeTabFromPath, isAdminDashboardHash, pathForActiveTab, resolveDashboardPortalMode } from './lib/navigation';
import { MapPin, Heart, ShieldAlert, Sparkles, Star, CheckCircle, Bug } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_BUGS: ReportedBug[] = [
  {
    id: 'bug-1',
    title: 'Mobile menu cut-off on iPhone SE screen sizes',
    description: 'When viewing the owner dashboard on a smaller screen (width around 320px), the top navigation bar menu is slightly cut off on the right-hand side.',
    category: 'visual',
    severity: 'low',
    email: 'test-user@celinaconnection.com',
    createdAt: '2026-07-01T10:00:00.000Z',
    status: 'open',
  },
  {
    id: 'bug-2',
    title: 'Checkout message could be clearer',
    description: 'When purchasing a premium membership, the checkout message could do a better job explaining what happens next.',
    category: 'functional',
    severity: 'medium',
    email: 'baker@celinapatisserie.com',
    createdAt: '2026-07-04T15:30:00.000Z',
    status: 'resolved',
  },
  {
    id: 'bug-3',
    title: 'Directory count needs a second look',
    description: 'The Dining category count may not match the number of visible Dining listings.',
    category: 'data',
    severity: 'high',
    email: 'admin@celinaconnect.com',
    createdAt: '2026-07-07T09:15:00.000Z',
    status: 'in-progress',
  }
];

const SITE_URL = 'https://www.celinaconnection.com';
const SITE_NAME = 'Celina Connection';
const BRAND_LOGO_PATH = '/images/celina-connection-logo.png';
const DEFAULT_OG_IMAGE = `${SITE_URL}${BRAND_LOGO_PATH}`;
const DEFAULT_DESCRIPTION = 'Find local restaurants, shops, services, events, and featured small businesses in Celina, Texas. Claim a free Celina business listing on Celina Connection.';

type PageSeoConfig = {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  noIndex?: boolean;
  schemaJson?: SchemaJson;
};

function businessSlug(business: Business) {
  return business.slug || business.id;
}

function cleanDescription(description: string) {
  return description.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function absoluteImage(image?: string) {
  if (!image || image.startsWith('data:')) return DEFAULT_OG_IMAGE;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`;
}

function buildOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: DEFAULT_OG_IMAGE,
    areaServed: {
      '@type': 'City',
      name: 'Celina',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'TX',
        addressCountry: 'US',
      },
    },
  };
}

function buildWebsiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/directory?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildDirectorySchema(businessCount: number) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebsiteSchema(),
      buildOrganizationSchema(),
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/directory#business-directory`,
        name: 'Celina TX Local Business Directory',
        description: `Browse ${businessCount || 'local'} Celina, Texas businesses by category, reviews, and location.`,
        numberOfItems: businessCount,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where can I find local businesses in Celina, Texas?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Celina Connection is a local business directory for Celina, TX with restaurants, shops, health and beauty providers, services, activities, and featured community businesses.',
            },
          },
          {
            '@type': 'Question',
            name: 'How can a Celina business claim a listing?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Celina business owners can claim a free listing on Celina Connection, add business details, and upgrade for premium placement, more photos, and enhanced directory features.',
            },
          },
        ],
      },
    ],
  };
}

function buildBusinessSchema(business: Business) {
  const ratingCount = business.reviews?.length || 0;
  const averageRating = ratingCount
    ? business.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / ratingCount
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/business/${businessSlug(business)}#localbusiness`,
    name: business.name,
    description: cleanDescription(business.description),
    url: `${SITE_URL}/business/${businessSlug(business)}`,
    telephone: business.phone,
    email: business.email,
    image: absoluteImage(business.images?.[0] || business.logoUrl),
    address: business.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: business.address.replace(', Celina, TX 75009', '').replace(', TX 75009', ''),
          addressLocality: 'Celina',
          addressRegion: 'TX',
          postalCode: '75009',
          addressCountry: 'US',
        }
      : {
          '@type': 'PostalAddress',
          addressLocality: 'Celina',
          addressRegion: 'TX',
          postalCode: '75009',
          addressCountry: 'US',
        },
    areaServed: 'Celina, Texas',
    priceRange: '$$',
    sameAs: [business.website, business.socialLinks?.facebook, business.socialLinks?.instagram, business.socialLinks?.twitter].filter(Boolean),
    aggregateRating: averageRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(averageRating.toFixed(1)),
          reviewCount: ratingCount,
        }
      : undefined,
  };
}

function buildEventsSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/events#local-events`,
    name: 'Celina Local Events',
    description: 'Upcoming local events, public meetings, family gatherings, and business events in Celina, Texas.',
    numberOfItems: CELINA_EVENTS.length,
    itemListElement: CELINA_EVENTS.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        startDate: event.date,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        image: absoluteImage(event.imageUrl),
        description: event.description,
        url: event.link || `${SITE_URL}/events`,
        location: {
          '@type': 'Place',
          name: event.location,
          address: event.address,
        },
        organizer: {
          '@type': 'Organization',
          name: event.organizer,
        },
      },
    })),
  };
}

function buildPageSeoConfig(activeTab: string, selectedBusiness: Business | null, businessCount: number): PageSeoConfig {
  if (selectedBusiness) {
    const canonical = `${SITE_URL}/business/${businessSlug(selectedBusiness)}`;
    const description = `${cleanDescription(selectedBusiness.description)} View phone, address, reviews, and details for ${selectedBusiness.name} in Celina, Texas.`;
    return {
      title: `${selectedBusiness.name} | Celina TX ${selectedBusiness.category} | Celina Connection`,
      description,
      canonical,
      ogImage: absoluteImage(selectedBusiness.images?.[0] || selectedBusiness.logoUrl),
      schemaJson: buildBusinessSchema(selectedBusiness),
    };
  }

  switch (activeTab) {
    case 'home':
      return {
        title: 'Celina Connection | Celina TX Local Business Directory',
        description: DEFAULT_DESCRIPTION,
        canonical: `${SITE_URL}/`,
        ogImage: DEFAULT_OG_IMAGE,
        schemaJson: buildDirectorySchema(businessCount),
      };
    case 'directory':
      return {
        title: 'Explore Celina TX Businesses | Celina Connection',
        description: 'Browse Celina restaurants, shops, service providers, health and wellness businesses, and featured local favorites in one friendly directory.',
        canonical: `${SITE_URL}/directory`,
        ogImage: DEFAULT_OG_IMAGE,
        schemaJson: buildDirectorySchema(businessCount),
      };
    case 'events':
      return {
        title: "What's Happening in Celina | Celina Connection Events",
        description: 'Explore Celina festivals, public meetings, family gatherings, city events, and business networking opportunities compiled for the local community.',
        canonical: `${SITE_URL}/events`,
        ogImage: absoluteImage(CELINA_EVENTS[0]?.imageUrl),
        schemaJson: buildEventsSchema(),
      };
    case 'pricing':
      return {
        title: 'Membership Tiers for Celina Businesses | Celina Connection',
        description: 'Compare free, paid, pro, and premium Celina Connection listing options for local businesses that want more visibility in Celina, Texas.',
        canonical: `${SITE_URL}/pricing`,
        ogImage: DEFAULT_OG_IMAGE,
      };
    case 'policies':
      return {
        title: 'Terms, Privacy, Payments, and Refunds | Celina Connection',
        description: 'Review Celina Connection terms of use, privacy practices, payment terms, refund policy, event promotion rules, and community standards.',
        canonical: `${SITE_URL}/policies`,
        ogImage: DEFAULT_OG_IMAGE,
      };
    case 'legacyhillspetition-sign':
      return {
        title: 'Legacy Hills Community Petition | Celina Connection',
        description: 'For homeowners and residents across Legacy Hills communities who want clear timelines, stronger communication, and completion of promised community amenities.',
        canonical: `${SITE_URL}/legacyhillspetition/sign`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
    case 'legacyhillspetition-signatures':
      return {
        title: 'Legacy Hills Petition Support | Celina Connection',
        description: 'View the current signature count and protected signer list for the Legacy Hills community petition.',
        canonical: `${SITE_URL}/legacyhillspetition/signatures`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
    case 'launch':
      return {
        title: "Celina's Local Business Hub | Celina Connection",
        description: 'Find local favorites, support Celina businesses, and claim an early local business listing on Celina Connection.',
        canonical: `${SITE_URL}/launch`,
        ogImage: DEFAULT_OG_IMAGE,
        schemaJson: buildDirectorySchema(businessCount),
      };
    case 'owner-login':
      return {
        title: 'Owner Login | Celina Connection',
        description: 'Sign in to manage your Celina Connection business listing, photos, billing, reviews, and event submissions.',
        canonical: `${SITE_URL}/owner-login`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
    case 'admin-login':
      return {
        title: 'Team Login | Celina Connection',
        description: 'Celina Connection team access for reviewing listings, events, feedback, claims, and petition records.',
        canonical: `${SITE_URL}/admin-login`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
    case 'reset-password':
      return {
        title: 'Reset Password | Celina Connection',
        description: 'Reset access to your Celina Connection business owner account.',
        canonical: `${SITE_URL}/reset-password`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
    case 'dashboard':
    default:
      return {
        title: 'Add or Claim a Celina Business Listing | Celina Connection',
        description: 'Claim a free Celina Connection listing, update business details, and help local customers find your Celina, TX business.',
        canonical: `${SITE_URL}/dashboard`,
        ogImage: DEFAULT_OG_IMAGE,
        noIndex: true,
      };
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  
  const [activeTab, setActiveTab] = useState<string>(() => activeTabFromPath(location.pathname));
  
  // Business slug from URL
  const businessSlug = location.pathname.startsWith('/business/') 
    ? location.pathname.replace('/business/', '')
    : null;
  
  // Sync URL when activeTab changes
  useEffect(() => {
    if (businessSlug) return;
    const path = pathForActiveTab(activeTab);
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
  const FORCE_SPLASH_LANDING = false;

  // Launch campaign gating configuration (July 12, 2026 launch target)
  const launchCampaignTargetDate = new Date("2026-07-12T09:00:00-05:00").getTime();
  const [isGated, setIsGated] = useState<boolean>(() => {
    if (!FORCE_SPLASH_LANDING) return false;
    if (location.pathname.startsWith('/business/')) return false;
    if (location.pathname.startsWith('/legacyhillspetition')) return false;
    if (location.pathname === '/owner-login' || location.pathname === '/admin-login' || location.pathname === '/reset-password') return false;
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
    location.pathname === '/admin-login' || (location.pathname === '/dashboard' && isAdminDashboardHash(location.hash)) ? 'admin' : 'owner'
  ));
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: '',
    email: '',
    businessName: '',
    tier: 'free',
    isLoggedIn: false,
  });

  // Keep dashboard/login route intent in sync with the visible portal.
  // Without this, clicking "Join as Business" after visiting Admin Login
  // leaves the dashboard form stuck in admin mode.
  useEffect(() => {
    const nextMode = resolveDashboardPortalMode({
      activeTab,
      currentMode: dashboardPortalMode,
      isLoggedIn: currentUser.isLoggedIn,
      role: currentUser.role,
      locationHash: location.hash,
    });
    if (nextMode !== dashboardPortalMode) {
      setDashboardPortalMode(nextMode);
    }
  }, [activeTab, currentUser.isLoggedIn, currentUser.role, dashboardPortalMode, location.hash]);

  // Auto transition from login view to active dashboard view once logged in
  useEffect(() => {
    if (currentUser.isLoggedIn && (activeTab === 'owner-login' || activeTab === 'admin-login' || activeTab === 'reset-password')) {
      setActiveTab('dashboard');
      const hash = currentUser.role === 'admin' ? '#dashboard-admin-listings' : '#dashboard-profile';
      navigate(`/dashboard${hash}`, { replace: true });
    }
  }, [currentUser.isLoggedIn, currentUser.role, activeTab, navigate]);

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
    navigate({ pathname: '/admin-login', hash: '' });
    setActiveTab('admin-login');
  };

  const handleHeaderNavigate = (tab: string, hash?: string) => {
    setIsGated(false);
    sessionStorage.setItem('celina_connection_gated_bypass', 'true');
    const pathname = tab === 'home' ? '/' : `/${tab}`;
    navigate({ pathname, hash: hash ? `#${hash}` : '' });
    setActiveTab(tab);
  };

  // UI state overlays
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [targetTier, setTargetTier] = useState<Tier | null>(null);
  const [targetInterval, setTargetInterval] = useState<'month' | 'year'>('year');
  const [paymentNotification, setPaymentNotification] = useState<{
    type: 'success' | 'cancel' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!paymentNotification) return undefined;
    const timer = window.setTimeout(() => setPaymentNotification(null), 30000);
    return () => window.clearTimeout(timer);
  }, [paymentNotification]);

  // Initialize data on mount
  useEffect(() => {
    let isMounted = true;

    // Check AI server configuration status
    fetch('/api/ai-config', { cache: 'no-store' })
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
        tier: 'free',
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

      try {
        const ownerSession = await api.ownerSession();
        if (ownerSession?.authenticated && ownerSession.currentUser) {
          user = ownerSession.currentUser;
          currentBusinesses = currentBusinesses.map((business) =>
            business.id === ownerSession.business.id ? ownerSession.business : business
          );
          if (!currentBusinesses.some((business) => business.id === ownerSession.business.id)) {
            currentBusinesses = [...currentBusinesses, ownerSession.business];
          }
          if (isMounted) setCurrentUser(user);
        }
      } catch {
        // no active owner cookie
      }

      if (!user.isLoggedIn) {
        try {
          const adminSession = await api.adminSession();
          if (adminSession?.authenticated) {
            user = {
              id: 'admin',
              email: 'admin@celinaconnection.com',
              businessName: 'Celina Connection Admin',
              tier: 'premium',
              isLoggedIn: true,
              role: 'admin',
            };
            if (isMounted) {
              setDashboardPortalMode('admin');
              setCurrentUser(user);
            }
          }
        } catch {
          // no active admin cookie
        }
      }

      const params = new URLSearchParams(window.location.search);
      const emailVerificationToken = params.get('token');
      if (location.pathname === '/verify-email' && emailVerificationToken) {
        try {
          const verified = await api.ownerVerifyEmail(emailVerificationToken);
          user = verified.currentUser;
          currentBusinesses = currentBusinesses.filter((business) => business.id !== verified.business.id);
          currentBusinesses = [...currentBusinesses, verified.business];
          if (isMounted) {
            setCurrentUser(user);
            localStorage.setItem('celina_current_user', JSON.stringify(user));
            setPaymentNotification({
              type: 'success',
              message: 'Email verified — your owner dashboard is active.',
            });
            setActiveTab('dashboard');
            navigate('/dashboard?verified=1', { replace: true });
          }
        } catch (error) {
          if (isMounted) {
            setPaymentNotification({
              type: 'error',
              message: error instanceof Error ? error.message : 'That verification link is no longer working. Please request a fresh link and we will help you get signed in.',
            });
            setActiveTab('owner-login');
          }
        }
      }
      const paymentStatus = params.get('payment_status');
      const redirectTier = params.get('tier') as Tier | null;
      const redirectBusinessId = params.get('businessId');
      const redirectAddonQty = parseInt(params.get('addon_qty') || '0', 10);

      if (paymentStatus === 'success' && redirectTier) {
        const targetBusId = redirectBusinessId || user.businessId;
        currentBusinesses = currentBusinesses.map((business) => {
          if (business.ownerId !== user.id && business.id !== targetBusId) {
            return business;
          }

          return {
            ...business,
            tier: redirectTier,
            featured: redirectTier === 'premium',
            images: business.images && business.images.length > 0
              ? business.images
              : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'],
          };
        });

        const updatedUser: UserProfile = {
          ...user,
          tier: redirectTier,
          addonSlots: redirectAddonQty,
        };

        if (isMounted) {
          setCurrentUser(updatedUser);
          setPaymentNotification({
            type: 'success',
              message: `Welcome to ${redirectTier === 'premium' ? 'Premium Partner' : 'Pro Partner'} Membership. Your new listing features are almost ready.${
                redirectAddonQty > 0 ? ` Included: ${redirectAddonQty} additional business listing${redirectAddonQty > 1 ? 's' : ''}.` : ''
              }`,
          });
        }
        localStorage.setItem('celina_current_user', JSON.stringify(updatedUser));

        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else if (paymentStatus === 'event_success' && isMounted) {
        setPaymentNotification({
          type: 'success',
          message: 'Your event promotion payment is complete. The Celina Connection team will follow up to confirm the event details before publishing.',
        });
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else if (paymentStatus === 'cancel' && isMounted) {
        setPaymentNotification({
          type: 'cancel',
          message: 'Checkout was canceled. No charges were made.',
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

  const handleLikeBusiness = async (businessId: string, liked = true) => {
    const result = await api.likeBusiness(businessId, liked);
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

  const handleOwnerRegister = async (
    payload: Partial<Business> & { name: string; category: string; description: string; phone: string; email: string; password: string; startedAt: number; company?: string }
  ) => {
    const result = await api.ownerRegister(payload);
    if (!result.requiresEmailVerification) {
      setBusinesses((prev) => [...prev.filter((business) => business.id !== result.business.id), result.business]);
    }
    if (result.currentUser) {
      setCurrentUser(result.currentUser);
    }
    return result;
  };

  const handleOwnerLogin = async (email: string, password: string) => {
    const result = await api.ownerLogin(email, password);
    setBusinesses((prev) => [...prev.filter((business) => business.id !== result.business.id), result.business]);
    setCurrentUser(result.currentUser);
    return result;
  };

  const handleOwnerUpdateBusiness = async (id: string, fields: Partial<Business>) => {
    const updated = await api.updateOwnBusiness(id, fields);
    setBusinesses((prev) => prev.map((business) => business.id === updated.id ? updated : business));
    return updated;
  };

  // Directory Update Handler
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
  const handleClaimBusiness = async (
    businessId: string,
    email: string,
    details: { requesterName: string; requesterPhone: string; role: string; notes?: string }
  ) => {
    const targetBus = businesses.find((b) => b.id === businessId);
    if (!targetBus) return;

    await api.createClaimRequest({
      businessId,
      requesterEmail: email,
      requesterName: details.requesterName,
      requesterPhone: details.requesterPhone,
      role: details.role,
      notes: details.notes,
    });

    setSelectedBusinessId(null);
    setPaymentNotification({
      type: 'success',
      message: `Thanks for claiming "${targetBus.name}". Our team will review your request and follow up soon.`,
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
      message: 'Thank you for the heads-up. Our team will take a look and follow up if we need more details.',
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
      message: 'Celina Connection has been refreshed with the starter listings.',
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
        // Return to free if not covered by add-on slots
        return {
          ...b,
          tier: 'free' as Tier,
          featured: false,
        };
      }
    });

    setBusinesses(updated);

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

  const handleEventPromotionCheckout = async (eventId?: string) => {
    if (!currentUser.isLoggedIn || currentUser.role === 'admin') {
      openOwnerLogin();
      return;
    }

    const response = await fetch('/api/create-event-promotion-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        businessId: currentUser.businessId || '',
        businessName: currentUser.businessName,
        email: currentUser.email,
        eventId: eventId || '',
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data.error || 'We could not open event promotion checkout right now. Please try again.');
    }
    window.location.href = data.url;
  };

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId) || null;
  const seoConfig = buildPageSeoConfig(activeTab, selectedBusiness, businesses.length);

  if (isGated) {
    const gatedSeoConfig = buildPageSeoConfig('launch', null, businesses.length);

    return (
      <div className="min-h-screen bg-[var(--cc-cream)] text-[var(--cc-soft-black)] flex flex-col font-sans selection:bg-[var(--cc-harvest-gold)] selection:text-[var(--cc-deep-navy)]" id="celina-connect-gated-root">
        <SEOHead {...gatedSeoConfig} />
        {/* Top Banner Accent */}
        <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

        {/* Simplified Header */}
        <header className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50 py-4 px-6 md:px-12 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO_PATH}
                alt="Celina Connection logo"
                className="h-9 w-9 rounded-xl object-contain shadow-md shadow-[rgba(15,45,77,0.12)]"
              />
              <div>
                <div className="font-display font-black text-base tracking-tight leading-none text-[var(--cc-deep-navy)]">
                  Celina <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Connection</span>
                </div>
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
              <button
                onClick={() => {
                  setIsGated(false);
                  sessionStorage.setItem('celina_connection_gated_bypass', 'true');
                  setActiveTab('policies');
                }}
                className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold underline-offset-4 hover:underline"
              >
                Policies
              </button>
              <button onClick={openAdminLogin} className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold underline-offset-4 hover:underline">
                Team Login
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
    <div className="min-h-screen bg-[var(--cc-cream)] flex flex-col font-sans selection:bg-[var(--cc-harvest-gold)] selection:text-[var(--cc-deep-navy)]" id="celina-connection-root">
      <SEOHead {...seoConfig} />
      {/* Top Banner Accent */}
      <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

      {/* Main Header navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNavigateTab={handleHeaderNavigate}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        onOpenLogin={handleOpenLoginPrompt}
        onOpenAdminLogin={openAdminLogin}
        isAiEnabled={isAiEnabled}
        setIsAiEnabled={setIsAiEnabled}
        serverAiAvailable={serverAiAvailable}
        onServerAiAvailabilityChange={setServerAiAvailable}
        businesses={businesses}
        onSelectBusiness={(id) => setSelectedBusinessId(id)}
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
        {activeTab === 'home' && (
          <DirectoryView
            businesses={businesses}
            onAddReview={handleAddReview}
            onLikeBusiness={handleLikeBusiness}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={(b) => {
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
            homeMode={true}
          />
        )}

        {activeTab === 'directory' && (
          <DirectoryView
            businesses={businesses}
            onAddReview={handleAddReview}
            onLikeBusiness={handleLikeBusiness}
            selectedBusiness={selectedBusiness}
            onSelectBusiness={(b) => {
              setSelectedBusinessId(b.id);
              navigate(`/business/${b.slug || b.id}`);
            }}
            onCloseDetail={() => {
              setSelectedBusinessId(null);
              navigate('/directory');
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

        {activeTab === 'events' && (
          <EventsView
            currentUser={currentUser}
            onOpenLogin={handleOpenLoginPrompt}
            onOpenEventWorkspace={() => {
              setDashboardPortalMode('owner');
              navigate({ pathname: '/dashboard', hash: '#dashboard-events' });
              setActiveTab('dashboard');
            }}
            onPromoteEvent={handleEventPromotionCheckout}
          />
        )}

        {activeTab === 'legacyhillspetition-signatures' && (
          <LegacyHillsPetitionSignaturesView setActiveTab={setActiveTab} />
        )}

        {activeTab === 'legacyhillspetition-sign' && (
          <LegacyHillsPetitionView />
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

        {activeTab === 'policies' && (
          <PolicyView />
        )}

        {activeTab === 'launch' && (
          <LaunchView
            businesses={businesses}
            setActiveTab={setActiveTab}
            onUpgradePrompt={(tier) => setTargetTier(tier)}
          />
        )}

        {(activeTab === 'dashboard' || activeTab === 'owner-login' || activeTab === 'admin-login' || activeTab === 'reset-password') && (
          <DashboardView
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            businesses={businesses}
            onAddBusiness={handleAddBusiness}
            onOwnerRegister={handleOwnerRegister}
            onOwnerLogin={handleOwnerLogin}
            onOwnerUpdateBusiness={handleOwnerUpdateBusiness}
            onUpdateBusiness={handleUpdateBusiness}
            onUpgradePrompt={(tier) => setTargetTier(tier)}
            onPromoteEvent={handleEventPromotionCheckout}
            onDeleteBusiness={handleDeleteBusiness}
            onResetDatabase={handleResetDatabase}
            reportedBugs={reportedBugs}
            onUpdateBugStatus={handleUpdateBugStatus}
            onDeleteBugStatus={handleDeleteBugStatus}
            portalMode={dashboardPortalMode}
            setPortalMode={setDashboardPortalMode}
            defaultOwnerView={activeTab === 'reset-password' ? 'reset' : activeTab === 'owner-login' ? 'login' : 'register'}
            passwordResetToken={new URLSearchParams(location.search).get('token') || ''}
            locationHash={location.hash}
          />
        )}
      </main>

      {/* Payment Gateway Checkout Modal */}
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
        title="Share feedback with the Celina Connection team"
      >
        <Bug className="w-4 h-4 text-white animate-pulse" />
        <span className="hidden sm:inline">Share Feedback</span>
      </button>

      {/* Celina Connection Welcoming Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left */}
            <div className="flex items-center gap-2">
              <img
                src={BRAND_LOGO_PATH}
                alt=""
                className="h-6 w-6 rounded object-contain"
              />
              <span className="font-display font-extrabold text-sm text-[var(--cc-deep-navy)] tracking-tight">
                Celina Connection
              </span>
            </div>

            {/* Middle Nav Links */}
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-600">
              <button onClick={() => setActiveTab('directory')} className="hover:text-[var(--cc-deep-navy)]">Browse Directory</button>
              <button onClick={() => setActiveTab('events')} className="hover:text-[var(--cc-deep-navy)]">Local Events</button>
              <button onClick={() => setActiveTab('pricing')} className="hover:text-[var(--cc-deep-navy)]">Membership Plans</button>
              <button onClick={() => setActiveTab('policies')} className="hover:text-[var(--cc-deep-navy)]">Policies</button>
              <button onClick={openOwnerLogin} className="hover:text-[var(--cc-deep-navy)]">Owner Login</button>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600 border-t border-slate-100 pt-4">
            <p className="flex items-center gap-1">
              Made with <Heart className="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> for the Celina, Texas Community.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button onClick={openAdminLogin} className="text-slate-400 hover:text-slate-700 underline-offset-4 hover:underline">
                Team Login
              </button>
              <span>&copy; {new Date().getFullYear()} Celina Connection. All Rights Reserved.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating AI Chat Assistant: directory has a blended on-page chat/search box. */}
      {activeTab !== 'directory' && <AiChatWidget businesses={businesses} isAiEnabled={isAiEnabled} />}
    </div>
  );
}
