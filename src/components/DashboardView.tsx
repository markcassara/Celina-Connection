import React, { useState } from 'react';
import { Business, Review, Tier, UserProfile, ReportedBug } from '../types';
import { CATEGORIES } from '../data/mockBusinesses';
import {
  Building2,
  Bug,
  Lock,
  Star,
  Zap,
  Sparkles,
  Award,
  Plus,
  Image as ImageIcon,
  MessageSquare,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Globe,
  Clock,
  MapPin,
  Phone,
  Mail,
  Receipt,
  Eye,
  CheckCircle,
  HelpCircle,
  Trash2,
  Edit,
  RefreshCw,
  LogOut,
  Filter,
  ShieldCheck,
  Upload
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { buildOwnerProfilePatch } from '../lib/ownerProfilePatch';

interface DashboardViewProps {
  currentUser: UserProfile;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  businesses: Business[];
  onAddBusiness: (business: any) => string | Promise<string>;
  onOwnerRegister: (payload: Partial<Business> & { name: string; category: string; description: string; phone: string; email: string; password: string; startedAt: number; company?: string }) => Promise<{ business: Business; currentUser?: UserProfile; requiresEmailVerification?: boolean; message?: string }>;
  onOwnerLogin: (email: string, password: string) => Promise<{ business: Business; currentUser: UserProfile }>;
  onOwnerUpdateBusiness: (businessId: string, updatedFields: Partial<Business>) => Promise<Business>;
  onUpdateBusiness: (
    businessIdOrIds: string | string[],
    updatedFields: Partial<Business> | ((b: Business) => Partial<Business>)
  ) => void | Promise<void>;
  onUpgradePrompt: (tier: Tier) => void;
  onDeleteBusiness?: (businessIdOrIds: string | string[]) => void | Promise<void>;
  onResetDatabase?: () => void | Promise<void>;
  reportedBugs?: ReportedBug[];
  onUpdateBugStatus?: (bugId: string, status: ReportedBug['status']) => void | Promise<void>;
  onDeleteBugStatus?: (bugId: string) => void | Promise<void>;
  portalMode: 'owner' | 'admin';
  setPortalMode: (mode: 'owner' | 'admin') => void;
  defaultOwnerView?: 'register' | 'login';
  locationHash?: string;
}

export type DashboardSubTab = 'profile' | 'media' | 'reviews' | 'billing' | 'metrics' | 'admin-listings' | 'admin-bugs';

export const dashboardSubTabs: DashboardSubTab[] = ['profile', 'media', 'reviews', 'billing', 'metrics', 'admin-listings', 'admin-bugs'];

export function getDashboardSectionFromHash(
  hash: string = typeof window === 'undefined' ? '' : window.location.hash,
  role?: UserProfile['role'],
): DashboardSubTab {
  const hashSection = hash.replace('#dashboard-', '') as DashboardSubTab;
  const isKnownSection = dashboardSubTabs.includes(hashSection);
  const fallbackSection: DashboardSubTab = role === 'admin' ? 'admin-listings' : 'profile';

  if (!isKnownSection) return fallbackSection;

  const isAdminOnlySection = hashSection === 'admin-listings' || hashSection === 'admin-bugs';
  if (isAdminOnlySection && role && role !== 'admin') return 'profile';

  return hashSection;
}

export type AdminActiveTab = 'listings' | 'bugs';

export function getAdminTabFromDashboardSection(sectionOrHash: DashboardSubTab | string): AdminActiveTab {
  return sectionOrHash === 'admin-bugs' || sectionOrHash === '#dashboard-admin-bugs' ? 'bugs' : 'listings';
}

export function shouldFocusAdminListings(hash: string, adminTab: AdminActiveTab) {
  return adminTab === 'listings' && hash === '#dashboard-admin-listings';
}

const ADMIN_HIDDEN_UNCLAIMED_LISTING_IDS = new Set(['lucys-on-the-square', 'annie-jack-boutique']);

export function isHiddenFromAdminListings(business: Pick<Business, 'id' | 'isUnclaimed'>) {
  return business.isUnclaimed && ADMIN_HIDDEN_UNCLAIMED_LISTING_IDS.has(business.id);
}

export default function DashboardView({
  currentUser,
  setCurrentUser,
  businesses,
  onAddBusiness,
  onOwnerRegister,
  onOwnerLogin,
  onOwnerUpdateBusiness,
  onUpdateBusiness,
  onUpgradePrompt,
  onDeleteBusiness,
  onResetDatabase,
  reportedBugs = [],
  onUpdateBugStatus,
  onDeleteBugStatus,
  portalMode,
  setPortalMode,
  defaultOwnerView = 'register',
  locationHash,
}: DashboardViewProps) {
  const [isSigningIn, setIsSigningIn] = useState(defaultOwnerView === 'login'); // Toggle Owner Register vs Owner Login

  // Owner Login State
  const [ownerLoginEmail, setOwnerLoginEmail] = useState('');
  const [ownerLoginPassword, setOwnerLoginPassword] = useState('');
  const [ownerLoginError, setOwnerLoginError] = useState('');

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // Admin Panel states
  const [adminSearch, setAdminSearch] = useState('');

  // Admin Create Listing Fields
  const [acName, setAcName] = useState('');
  const [acCategory, setAcCategory] = useState('Dining');
  const [acPhone, setAcPhone] = useState('');
  const [acEmail, setAcEmail] = useState('');
  const [acDesc, setAcDesc] = useState('');
  const [acIsUnclaimed, setAcIsUnclaimed] = useState(true);
  const [acTier, setAcTier] = useState<Tier>('basic');
  const [acAddress, setAcAddress] = useState('');
  const [acWebsite, setAcWebsite] = useState('');

  // Authentication Sub-state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regCategory, setRegCategory] = useState('Dining');
  const [regPhone, setRegPhone] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regFormStartedAt, setRegFormStartedAt] = useState(Date.now());
  
  const [activeSubTab, setActiveSubTab] = useState<DashboardSubTab>(() => getDashboardSectionFromHash(locationHash, currentUser.role));

  React.useEffect(() => {
    const syncDashboardHash = () => setActiveSubTab(getDashboardSectionFromHash(window.location.hash || locationHash || '', currentUser.role));
    window.addEventListener('hashchange', syncDashboardHash);
    syncDashboardHash();
    return () => window.removeEventListener('hashchange', syncDashboardHash);
  }, [locationHash, currentUser.role]);

  React.useEffect(() => {
    if (!currentUser.isLoggedIn && portalMode === 'owner') {
      setIsSigningIn(defaultOwnerView === 'login');
      setRegFormStartedAt(Date.now());
    }
  }, [defaultOwnerView, portalMode, currentUser.isLoggedIn]);

  // Multi-business list and active selection
  const adminOwnedBusinesses = businesses.filter((b) => b.ownerId === currentUser.id && !b.isUnclaimed);
  const myBusinesses = currentUser.role === 'admin'
    ? adminOwnedBusinesses
    : businesses.filter(
        (b) => b.ownerId === currentUser.id || (currentUser.email && b.email.toLowerCase() === currentUser.email.toLowerCase())
      );
  
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isAddingListing, setIsAddingListing] = useState(false);

  // States for adding an additional listing
  const [newBusName, setNewBusName] = useState('');
  const [newBusCategory, setNewBusCategory] = useState('Dining');
  const [newBusPhone, setNewBusPhone] = useState('');
  const [newBusEmail, setNewBusEmail] = useState(currentUser?.email || '');
  const [newBusDesc, setNewBusDesc] = useState('');

  // Active business being edited
  const myBusiness = myBusinesses.find((b) => b.id === selectedListingId) || myBusinesses[0] || null;
  const updateMyBusiness = (fields: Partial<Business>) => {
    if (!myBusiness) return Promise.resolve();
    return currentUser.role === 'owner'
      ? onOwnerUpdateBusiness(myBusiness.id, fields).then(() => undefined)
      : Promise.resolve(onUpdateBusiness(myBusiness.id, fields));
  };

  // Form field bindings (pre-filled inside useEffect or conditionally)
  const [editName, setEditName] = useState(myBusiness?.name || '');
  const [editDesc, setEditDesc] = useState(myBusiness?.description || '');
  const [editPhone, setEditPhone] = useState(myBusiness?.phone || '');
  const [editEmail, setEditEmail] = useState(myBusiness?.email || '');
  const [editCategory, setEditCategory] = useState(myBusiness?.category || 'Dining');
  
  // Address is included for Basic; website and hours remain paid-tier fields
  const [editWebsite, setEditWebsite] = useState(myBusiness?.website || '');
  const [editAddress, setEditAddress] = useState(myBusiness?.address || '');
  const [editMonFri, setEditMonFri] = useState(myBusiness?.hours?.monFri || '9:00 AM - 5:00 PM');
  const [editSat, setEditSat] = useState(myBusiness?.hours?.sat || '10:00 AM - 4:00 PM');
  const [editSun, setEditSun] = useState(myBusiness?.hours?.sun || 'Closed');
  
  // Premium only fields
  const [editCtaText, setEditCtaText] = useState(myBusiness?.ctaText || 'Learn More');
  const [editFacebook, setEditFacebook] = useState(myBusiness?.socialLinks?.facebook || '');
  const [editInstagram, setEditInstagram] = useState(myBusiness?.socialLinks?.instagram || '');
  const [editTwitter, setEditTwitter] = useState(myBusiness?.socialLinks?.twitter || '');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [replyInputs, setReplyInputs] = useState<{ [reviewId: string]: string }>({});

  // Sync edit fields if business changes or loads
  React.useEffect(() => {
    if (myBusiness) {
      setEditName(myBusiness.name);
      setEditDesc(myBusiness.description);
      setEditPhone(myBusiness.phone);
      setEditEmail(myBusiness.email);
      setEditCategory(myBusiness.category);
      setEditWebsite(myBusiness.website || '');
      setEditAddress(myBusiness.address || '');
      setEditMonFri(myBusiness.hours?.monFri || '9:00 AM - 5:00 PM');
      setEditSat(myBusiness.hours?.sat || '10:00 AM - 4:00 PM');
      setEditSun(myBusiness.hours?.sun || 'Closed');
      setEditCtaText(myBusiness.ctaText || 'Learn More');
      setEditFacebook(myBusiness.socialLinks?.facebook || '');
      setEditInstagram(myBusiness.socialLinks?.instagram || '');
      setEditTwitter(myBusiness.socialLinks?.twitter || '');
    }
  }, [myBusiness?.id, activeSubTab]);

  const handleOwnerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerLoginError('');
    if (!ownerLoginEmail || !ownerLoginEmail.trim() || !ownerLoginPassword) {
      setOwnerLoginError('Please enter your email and password.');
      return;
    }

    try {
      const result = await onOwnerLogin(ownerLoginEmail.trim(), ownerLoginPassword);
      setCurrentUser(result.currentUser);
      setSelectedListingId(result.business.id);
      setActiveSubTab('profile');
    } catch (error) {
      setOwnerLoginError(error instanceof Error ? error.message : 'Owner login failed.');
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    try {
      await api.adminLogin(adminPassword);
      setCurrentUser({
        id: 'admin',
        email: adminEmail || 'admin@celinaconnection.com',
        businessName: 'Celina Connection Admin',
        tier: 'premium',
        isLoggedIn: true,
        role: 'admin',
      });
      setActiveSubTab('admin-listings');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Admin login failed.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regBusinessName || !regPhone || !regDesc || !regPassword) {
      alert('Please fill out all onboarding fields, including your password.');
      return;
    }
    if (regPassword.length < 10) {
      alert('Please use a password of at least 10 characters.');
      return;
    }

    // Enforce 100 free listings competitive cap
    const claimedBasicCount = Math.min(100, 92 + businesses.filter(b => b.tier === 'free' && b.ownerId && !b.isUnclaimed).length);
    if (claimedBasicCount >= 100) {
      alert("⚠️ We've reached our competitive cap of 100 free listings! If you have an unclaimed listing on the front page, please claim it, or choose one of our Premium/Pro packages to activate a premium presence immediately.");
      return;
    }

    setIsRegistering(true);
    try {
      const result = await onOwnerRegister({
        name: regBusinessName,
        category: regCategory,
        description: regDesc,
        phone: regPhone,
        email: regEmail,
        password: regPassword,
        tier: 'free',
        startedAt: regFormStartedAt,
        company: regCompany,
      });

      if (result.requiresEmailVerification || !result.currentUser) {
        alert(result.message || 'Check your email to verify your listing before signing in.');
        setIsSigningIn(true);
        setOwnerLoginEmail(regEmail);
        setRegPassword('');
        return;
      }

      setCurrentUser(result.currentUser);
      setSelectedListingId(result.business.id);
      setActiveSubTab('profile');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Registration failed. Please try again.');
      setRegFormStartedAt(Date.now());
    } finally {
      setIsRegistering(false);
    }
  };

  const handleNewListingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Actions and modifications are disabled to preserve the demo environment.');
      return;
    }
    if (currentUser.tier === 'free' || currentUser.tier === 'basic') {
      alert('Adding an additional business listing is a Pro or Premium feature. Please upgrade your membership first!');
      return;
    }
    if (!newBusName || !newBusPhone || !newBusDesc) {
      alert('Please fill out all required listing details.');
      return;
    }

    const newBusId = await onAddBusiness({
      name: newBusName,
      category: newBusCategory,
      description: newBusDesc,
      phone: newBusPhone,
      email: newBusEmail || currentUser.email,
      tier: 'free', // Starts on the free launch tier
      ownerId: currentUser.id,
    });

    // Reset and select newly created business
    setNewBusName('');
    setNewBusPhone('');
    setNewBusDesc('');
    setSelectedListingId(newBusId);
    setIsAddingListing(false);
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBusiness) return;

    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Profile editing is disabled to preserve the demo environment.');
      return;
    }

    const patch = buildOwnerProfilePatch(myBusiness.tier, {
      name: editName,
      description: editDesc,
      phone: editPhone,
      email: editEmail,
      category: editCategory,
      address: editAddress,
      website: editWebsite,
      hours: {
        monFri: editMonFri,
        sat: editSat,
        sun: editSun,
      },
      ctaText: editCtaText,
      socialLinks: {
        facebook: editFacebook,
        instagram: editInstagram,
        twitter: editTwitter,
      },
    });

    if (currentUser.role === 'owner') {
      onOwnerUpdateBusiness(myBusiness.id, patch)
        .then(() => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        })
        .catch((error) => alert(error instanceof Error ? error.message : 'Unable to save profile changes.'));
      return;
    }

    updateMyBusiness(patch)
      .then(() => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      })
      .catch((error) => alert(error instanceof Error ? error.message : 'Unable to save profile changes.'));
  };

  const handleReplySubmit = (reviewId: string) => {
    if (!myBusiness) return;
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Review replies are disabled to preserve the demo environment.');
      return;
    }
    const replyText = replyInputs[reviewId];
    if (!replyText || !replyText.trim()) return;

    // Find and update review replies
    const updatedReviews = myBusiness.reviews.map((rev) => {
      if (rev.id === reviewId) {
        return { ...rev, ownerReply: replyText };
      }
      return rev;
    });

    updateMyBusiness({ reviews: updatedReviews });
    // Clear input
    setReplyInputs((prev) => ({ ...prev, [reviewId]: '' }));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.readAsDataURL(file);
    });

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!myBusiness) return;
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Uploading new images is disabled to preserve the demo environment.');
      event.target.value = '';
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const currentImages = myBusiness.images || [];
    const max = myBusiness.tier === 'free' || myBusiness.tier === 'basic' ? 1 : myBusiness.tier === 'pro' ? 5 : 10;
    const remainingSlots = max - currentImages.length;

    if (remainingSlots <= 0) {
      alert('Tier limit reached! Basic members get 1, Pro get 5, and Premium get 10. Upgrade to add more!');
      event.target.value = '';
      return;
    }

    const filesToUse = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      alert(`Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added on your current tier. Uploading the first ${filesToUse.length}.`);
    }

    try {
      const uploadedImages = await Promise.all(filesToUse.map(readFileAsDataUrl));
      await updateMyBusiness({
        images: [...currentImages, ...uploadedImages],
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to upload the selected images.');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (!myBusiness || !myBusiness.images) return;
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Modifying images is disabled to preserve the demo environment.');
      return;
    }
    const filtered = myBusiness.images.filter((_, idx) => idx !== index);
    updateMyBusiness({ images: filtered });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!myBusiness) return;
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Changing the business logo is disabled to preserve the demo environment.');
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const logoDataUrl = await readFileAsDataUrl(file);
      await updateMyBusiness({ logoUrl: logoDataUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to upload the selected logo.');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveLogo = () => {
    if (!myBusiness) return;
    if (currentUser.id === 'owner-lucy') {
      alert('This feature is available in preview mode. Changing the business logo is disabled to preserve the demo environment.');
      return;
    }

    updateMyBusiness({ logoUrl: '' });
  };

  // If NOT logged in, show onboarding portal
  if (!currentUser.isLoggedIn) {
    return (
      <div className="py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch" id="dashboard-login-portal">
        {/* Left Side: Welcoming intro */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 uppercase tracking-wider self-start">
            <Building2 className="w-3.5 h-3.5" /> Celina Owner Center
          </span>
          <h2 className="font-display text-3xl sm:text-4.5xl font-extrabold text-slate-950 tracking-tight leading-tight">
            Claim Your Spot on the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">
              Celina Directory Map
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Welcome, Celina business owners! Whether your business is on the historic Downtown Square, Preston Road, or serving our community home-to-home, register in seconds to make sure local families can find you. 
          </p>

        </div>

        {/* Right Side: Tabbed Login/Register/Admin Forms */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between animate-fade-in" id="portal-form-container">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500" />
          
          <div className="space-y-4">
            {/* Top portal mode selector tabs removed to prevent confusion. Admin entrance is placed in the footer. */}

            {/* Portal Heading descriptions */}
            <div>
              <h3 className="font-display text-xl font-extrabold text-slate-900">
                {portalMode === 'admin' 
                  ? 'Master Admin Dashboard' 
                  : isSigningIn 
                  ? 'Owner Sign-In' 
                  : 'Register Free Spot'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                {portalMode === 'admin' 
                  ? 'Enter administrative system credentials to access all local listings.' 
                  : isSigningIn 
                  ? 'Access your existing profile metrics, reviews, and media settings.' 
                  : 'List your Celina business. Strictly capped for the first 100 claimed profiles!'}
              </p>
            </div>

            {/* Owner Register / Owner Login Inner Tabs */}
            {portalMode === 'owner' && (
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSigningIn(false);
                    setRegFormStartedAt(Date.now());
                  }}
                  className={`text-[11px] font-bold pb-1 cursor-pointer transition-all ${
                    !isSigningIn ? 'text-orange-600 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Register Spot
                </button>
                <span className="text-slate-200 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setIsSigningIn(true)}
                  className={`text-[11px] font-bold pb-1 cursor-pointer transition-all ${
                    isSigningIn ? 'text-orange-600 border-b-2 border-orange-500' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Sign In with Email
                </button>
              </div>
            )}
          </div>

          {/* Render Active Form */}
          <div className="mt-5 flex-grow">
            {portalMode === 'admin' ? (
              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    System Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                {adminError && <p className="text-rose-600 text-[11px] font-semibold">{adminError}</p>}

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Sign In Securely
                </button>

                <button
                  type="button"
                  onClick={() => setPortalMode('owner')}
                  className="w-full py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer mt-1"
                >
                  ← Back to Owner Portal
                </button>
              </form>
            ) : isSigningIn ? (
              <form onSubmit={handleOwnerLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Your Registered Business Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="owner@yourcelinabusiness.com"
                    value={ownerLoginEmail}
                    onChange={(e) => setOwnerLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your owner password"
                    value={ownerLoginPassword}
                    onChange={(e) => setOwnerLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                {ownerLoginError && <p className="text-rose-600 text-[11px] font-semibold leading-normal">{ownerLoginError}</p>}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-xs rounded-xl hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-100 transition-all cursor-pointer"
                >
                  Sign In to Dashboard
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Owner Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="owner@yourcelinabusiness.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Celina Cafe / Plumbing Services"
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Business Category
                    </label>
                    <select
                      value={regCategory}
                      onChange={(e) => setRegCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900 cursor-pointer"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="(972) 555-0199"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Short Business Summary
                  </label>
                  <textarea
                    required
                    placeholder="Explain what you provide, and where you're located in Celina..."
                    value={regDesc}
                    onChange={(e) => setRegDesc(e.target.value)}
                    rows={2.5}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Create Owner Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    placeholder="At least 10 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">You’ll use this to return and manage your free listing.</p>
                </div>

                <div className="hidden" aria-hidden="true">
                  <label>Company website</label>
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-xs rounded-xl hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-100 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRegistering ? 'Creating Secure Listing…' : 'Register Free Listing'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Safe Guard: Ensure owner users have a business; admins can still access admin tools if no owned listing exists.
  if (!myBusiness && currentUser.role !== 'admin') {
    return (
      <div className="py-12 text-center max-w-md mx-auto space-y-4">
        <ShieldAlert className="w-12 h-12 text-orange-500 mx-auto" />
        <h3 className="font-display text-xl font-bold">Business Registry Out of Sync</h3>
        <p className="text-slate-500 text-xs">Could not locate an active directory entry tied to your owner ID.</p>
        <button
          onClick={() => setCurrentUser({ id: '', email: '', businessName: '', tier: 'basic', isLoggedIn: false })}
          className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg cursor-pointer"
        >
          Reset and Retry
        </button>
      </div>
    );
  }

  if (!myBusiness && currentUser.role === 'admin') {
    return (
      <AdminDashboardView
        activeDashboardSection={activeSubTab}
        businesses={businesses}
        onUpdateBusiness={onUpdateBusiness}
        onAddBusiness={onAddBusiness}
        onDeleteBusiness={onDeleteBusiness}
        onResetDatabase={onResetDatabase}
        setCurrentUser={setCurrentUser}
        reportedBugs={reportedBugs}
        onUpdateBugStatus={onUpdateBugStatus}
        onDeleteBugStatus={onDeleteBugStatus}
      />
    );
  }

  const isBasic = myBusiness.tier === 'free' || myBusiness.tier === 'basic';
  const isPro = myBusiness.tier === 'pro';
  const isPremium = myBusiness.tier === 'premium';

  return (
    <div className="py-4 space-y-6" id="owner-active-dashboard">
      {/* Dashboard Top Mini-Hero */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Managing Listing</span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900">
            {isAddingListing ? 'New Business Registry Onboarding' : myBusiness?.name || 'My Listing'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAddingListing ? (
              <span>Expanding your business footprint in Celina</span>
            ) : (
              <>
                Level:{' '}
                <span className="font-bold text-orange-600 uppercase tracking-wide">
                  {myBusiness?.tier} Membership
                </span>
              </>
            )}
          </p>
        </div>

        {/* Upgrade quick CTA */}
        <div className="flex gap-2">
          {!isAddingListing && myBusiness && myBusiness.tier !== 'premium' && (
            <button
              onClick={() => onUpgradePrompt(myBusiness.tier === 'free' ? 'basic' : myBusiness.tier === 'basic' ? 'pro' : 'premium')}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer shadow-sm animate-pulse"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Upgrade {myBusiness.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Tabs + Workspace Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Listing switch and workspace sidebar navigation */}
        <div className="lg:col-span-3 space-y-4">
          {/* My Listings Switcher Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              My Businesses ({myBusinesses.length})
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {myBusinesses.map((b) => {
                const isActive = b.id === myBusiness?.id && !isAddingListing;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedListingId(b.id);
                      setIsAddingListing(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/60'
                    }`}
                  >
                    <span className="truncate pr-2">{b.name}</span>
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      b.tier === 'premium' 
                        ? 'bg-amber-500 text-slate-950' 
                        : b.tier === 'pro' 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-slate-200 text-slate-600'
                    }`}>
                      {b.tier}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                if (currentUser.tier === 'free' || currentUser.tier === 'basic') {
                  alert("Adding an additional business listing is a Pro or Premium feature (requires a Pro or Premium plan plus add-on listings slot). Please upgrade your membership under the Billing tab first!");
                  setActiveSubTab('billing');
                  return;
                }
                setIsAddingListing(true);
              }}
              className={`w-full py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                isAddingListing
                  ? 'bg-orange-500 text-white border-orange-500'
                  : currentUser.tier === 'free' || currentUser.tier === 'basic'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/60'
                    : 'bg-orange-50/50 hover:bg-orange-100/50 text-orange-700 border-dashed border-orange-200'
              }`}
            >
              {currentUser.tier === 'free' || currentUser.tier === 'basic' ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Add Additional Business</span>
            </button>
          </div>

          {/* Sidebar Navigation */}
          {!isAddingListing && (
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 space-y-1" id="dash-sidebar">
              {[
                { id: 'profile', label: 'Business Profile', icon: <Building2 className="w-4 h-4" /> },
                { id: 'media', label: 'Gallery & Logo', icon: <ImageIcon className="w-4 h-4" /> },
                { id: 'reviews', label: 'Review Responder', icon: <MessageSquare className="w-4 h-4" /> },
                { id: 'metrics', label: 'Traffic Metrics', icon: <TrendingUp className="w-4 h-4" /> },
                { id: 'billing', label: 'Billing & Tiers', icon: <Receipt className="w-4 h-4" /> },
                ...(currentUser.role === 'admin'
                  ? [
                      { id: 'admin-listings', label: 'Manage Listings', icon: <ShieldAlert className="w-4 h-4" /> },
                      { id: 'admin-bugs', label: 'Bug Reports', icon: <Bug className="w-4 h-4" /> },
                    ]
                  : []),
              ].map((tab) => {
                const isSelected = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveSubTab(tab.id as DashboardSubTab);
                      if (tab.id === 'admin-listings' || tab.id === 'admin-bugs') {
                        window.location.hash = `dashboard-${tab.id}`;
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50 text-orange-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Main Form / Editor Pane */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8" id="dash-content-pane">
          {/* ADD NEW BUSINESS FORM OVERLAY */}
          {isAddingListing ? (
            <form onSubmit={handleNewListingSubmit} className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Add Additional Business Listing</h3>
                <p className="text-xs text-slate-500 mt-0.5">Register an additional business location or service line under your account.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Celina Boutique"
                      value={newBusName}
                      onChange={(e) => setNewBusName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category
                    </label>
                    <select
                      value={newBusCategory}
                      onChange={(e) => setNewBusCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Public Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="(972) 555-0100"
                      value={newBusPhone}
                      onChange={(e) => setNewBusPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="owner@yourcelinabusiness.com"
                      value={newBusEmail}
                      onChange={(e) => setNewBusEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Business Summary / Biography
                  </label>
                  <textarea
                    required
                    placeholder="Short summary describing your services..."
                    value={newBusDesc}
                    onChange={(e) => setNewBusDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Status info/notice */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-[11px] leading-normal font-medium flex gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-blue-900 mb-0.5">Listing Tier Notice:</span>
                  Additional businesses start on the Free Launch plan. You can upgrade any of your listings to Basic, Pro, or Premium from the Billing tab.
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingListing(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Create Listing
                </button>
              </div>
            </form>
          ) : (activeSubTab === 'admin-listings' || activeSubTab === 'admin-bugs') && currentUser.role === 'admin' ? (
            <AdminDashboardView
              activeDashboardSection={activeSubTab}
              businesses={businesses}
              onUpdateBusiness={onUpdateBusiness}
              onAddBusiness={onAddBusiness}
              onDeleteBusiness={onDeleteBusiness}
              onResetDatabase={onResetDatabase}
              setCurrentUser={setCurrentUser}
              reportedBugs={reportedBugs}
              onUpdateBugStatus={onUpdateBugStatus}
              onDeleteBugStatus={onDeleteBugStatus}
            />
          ) : !myBusiness ? (
            <div className="py-12 text-center max-w-sm mx-auto space-y-3">
              <ShieldAlert className="w-12 h-12 text-orange-500 mx-auto" />
              <h3 className="font-display text-lg font-bold">No Listing Selected</h3>
              <p className="text-slate-500 text-xs">Please select a business from the left side panel to continue editing.</p>
            </div>
          ) : (
            <>
              {/* PROFILE EDITOR SUBTAB */}
              {activeSubTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  {currentUser.role === 'admin' ? 'Listing Edit Page' : 'Business Profile Info'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Edit basic, pro, and premium fields regarding your Celina directory card.</p>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" /> Changes saved successfully! Updated listing immediately.
                </div>
              )}

              {/* Standard Fields (Always Unlocked) */}
              <div className="space-y-4">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Standard Fields</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Public Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Owner Contact Email
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Business Biography
                  </label>
                  <textarea
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Location Field (Available for Basic) */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Business Location</span>
                  {isBasic && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" /> Included with Basic
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Street Address (Celina, TX)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="127 N Ohio St, Celina, TX 75009"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>
                  {isBasic && (
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Your full address can show on your Local Pioneer listing so local customers can find you.
                    </p>
                  )}
                </div>
              </div>

              {/* Website & Hours Fields (Available for Basic) */}
              <div className="space-y-4 border-t border-slate-100 pt-5 relative">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Website & Hours</span>
                  {isBasic && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" /> Included with Basic
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Website URL
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="url"
                        placeholder="https://www.yourbusiness.com"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Hours Group */}
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Hours of Operation</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[9px] text-slate-400 font-semibold mb-0.5">Monday - Friday</span>
                      <input
                        type="text"
                        value={editMonFri}
                        onChange={(e) => setEditMonFri(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-semibold mb-0.5">Saturday</span>
                      <input
                        type="text"
                        value={editSat}
                        onChange={(e) => setEditSat(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-semibold mb-0.5">Sunday</span>
                      <input
                        type="text"
                        value={editSun}
                        onChange={(e) => setEditSun(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium Fields (Locked for Basic & Pro) */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Premium-Partner Fields</span>
                  {!isPremium && (
                    <span 
                      onClick={() => onUpgradePrompt('premium')} 
                      className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded cursor-pointer flex items-center gap-0.5"
                    >
                      <Lock className="w-2.5 h-2.5" /> Unlock with Premium ($10/m)
                    </span>
                  )}
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!isPremium ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Custom Call-To-Action Button Text
                    </label>
                    <input
                      type="text"
                      disabled={!isPremium}
                      placeholder="Book a Table / Check Workshop"
                      value={editCtaText}
                      onChange={(e) => setEditCtaText(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Facebook Fan Page Link
                    </label>
                    <input
                      type="url"
                      disabled={!isPremium}
                      placeholder="https://facebook.com/yourpage"
                      value={editFacebook}
                      onChange={(e) => setEditFacebook(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!isPremium ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Instagram Username URL
                    </label>
                    <input
                      type="url"
                      disabled={!isPremium}
                      placeholder="https://instagram.com/yourhandle"
                      value={editInstagram}
                      onChange={(e) => setEditInstagram(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Twitter / X Link
                    </label>
                    <input
                      type="url"
                      disabled={!isPremium}
                      placeholder="https://twitter.com/yourhandle"
                      value={editTwitter}
                      onChange={(e) => setEditTwitter(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-md hover:from-orange-600 hover:to-amber-600 transition-all cursor-pointer"
                >
                  Save Business Profile
                </button>
              </div>
            </form>
          )}

          {/* MEDIA / PHOTO GALLERY SUBTAB */}
          {activeSubTab === 'media' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Logo & Photo Gallery Manager</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your listing branding assets. Basic profiles support 1 image. Pro supports 5. Premium supports 10.
                </p>
              </div>

              {/* Logo Upload */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Business Round Logo</h4>
                  {myBusiness.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-200 border-2 border-orange-200 flex-shrink-0 flex items-center justify-center">
                    {myBusiness.logoUrl ? (
                      <img src={myBusiness.logoUrl} alt="Logo preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-grow space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-600 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400">Upload a square logo or profile image. PNG, JPG, WEBP, and GIF are supported.</p>
                  </div>
                </div>
              </div>

              {/* Current Photo Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Listing Photo Gallery</h4>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {myBusiness.images?.length || 0} / {isBasic ? 1 : isPro ? 5 : 10} Images
                  </span>
                </div>

                {(!myBusiness.images || myBusiness.images.length === 0) ? (
                  <p className="text-slate-400 text-xs italic text-center py-6 border border-dashed rounded-2xl">
                    No images added to gallery yet. Upload your own photos below.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {myBusiness.images.map((img, idx) => (
                      <div key={idx} className="relative h-24 rounded-xl overflow-hidden group bg-slate-100 border">
                        <img src={img} alt={`Gallery index ${idx}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center shadow-md cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          &times;
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 bg-slate-900/80 backdrop-blur-sm text-[8px] font-bold text-white px-1.5 py-0.5 rounded uppercase">
                            Cover Image
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real Uploads */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Upload Your Own Gallery Images</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Add photos from your device. The first gallery image will be used as your cover image.</p>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 rounded-2xl px-4 py-6 bg-white text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">Choose Gallery Images</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WEBP, or GIF. You can select multiple images up to your membership limit.</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    multiple
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* REVIEWS MANAGER SUBTAB */}
          {activeSubTab === 'reviews' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Review Responder Desk</h3>
                <p className="text-xs text-slate-500 mt-0.5">View feedback left by Celina local directory users, and reply to bolster your rating score.</p>
              </div>

              <div className="space-y-4">
                {myBusiness.reviews.length === 0 ? (
                  <p className="text-slate-400 text-xs italic text-center py-10 border border-dashed rounded-2xl">
                    No directory reviews recorded yet. Visitors will see your reviews listed here once posted.
                  </p>
                ) : (
                  myBusiness.reviews.map((rev) => (
                    <div key={rev.id} className="p-4.5 rounded-2xl border border-slate-150 space-y-3 shadow-sm bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">{rev.authorName}</span>
                        <div className="flex items-center gap-1">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-slate-600 text-xs italic leading-relaxed">
                        "{rev.text}"
                      </p>

                      {/* Reply field or lock */}
                      <div className="border-t border-slate-100 pt-3">
                        {isBasic ? (
                          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Basic owners cannot reply to customer reviews.
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpgradePrompt('pro')}
                              className="text-orange-600 font-bold hover:underline cursor-pointer"
                            >
                              Upgrade ($5/m)
                            </button>
                          </div>
                        ) : rev.ownerReply ? (
                          <div className="p-3 bg-orange-50/40 rounded-xl border-l-2 border-orange-400 text-xs space-y-1">
                            <p className="font-bold text-slate-800 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-orange-600" />
                              Active Owner Reply
                            </p>
                            <p className="text-slate-600">{rev.ownerReply}</p>
                            <button
                              onClick={() => {
                                setReplyInputs((prev) => ({ ...prev, [rev.id]: rev.ownerReply || '' }));
                                updateMyBusiness({
                                  reviews: myBusiness.reviews.map((r) => r.id === rev.id ? { ...r, ownerReply: undefined } : r)
                                });
                              }}
                              className="text-[9px] text-slate-400 hover:text-slate-600 font-semibold pt-1 block"
                            >
                              Edit Reply
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Write a sweet owner reply..."
                              value={replyInputs[rev.id] || ''}
                              onChange={(e) => setReplyInputs((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                              className="flex-grow px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <button
                              onClick={() => handleReplySubmit(rev.id)}
                              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* BILLING AND TIERS MANAGER */}
          {activeSubTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Billing, Invoices & Membership</h3>
                <p className="text-xs text-slate-500 mt-0.5">Control your business tier plan, manage pricing, and view invoice transactions.</p>
              </div>

              {/* Status block */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Active Subscription Status</span>
                  <h4 className="font-display text-2xl font-black mt-1 flex items-center gap-1.5">
                    {isPremium ? (
                      <>
                        <Sparkles className="w-6 h-6 text-amber-400" /> Premium Gold Partner
                      </>
                    ) : isPro ? (
                      <>
                        <Zap className="w-5 h-5 text-orange-400" /> Pro Directory Partner
                      </>
                    ) : (
                      <>
                        <Award className="w-5 h-5 text-slate-400" /> {myBusiness.tier === 'free' ? 'Free Launch Member' : 'Basic Member'}
                      </>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isPremium ? '$10.00 / month, billing active' : isPro ? '$5.00 / month, billing active' : 'No active recurring billing fees'}
                  </p>
                </div>

                {/* Billing Action buttons */}
                <div className="flex gap-2">
                  {!isPremium && (
                    <button
                      onClick={() => onUpgradePrompt('premium')}
                      className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-500 hover:to-amber-600 font-extrabold text-xs rounded-xl cursor-pointer shadow-md"
                    >
                      Go Premium Gold
                    </button>
                  )}
                  {!isPro && !isPremium && (
                    <button
                      onClick={() => onUpgradePrompt('pro')}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 font-bold text-xs rounded-xl cursor-pointer shadow-md"
                    >
                      Go Pro Standard
                    </button>
                  )}
                  {(isPro || isPremium) && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to cancel your paid plan and return to the Free Launch Tier? Your website, hours, extra photos, and social links will be hidden.')) {
                          onUpdateBusiness(myBusiness.id, { tier: 'free', featured: false });
                          setCurrentUser(prev => ({ ...prev, tier: 'free' }));
                        }
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel Plan
                    </button>
                  )}
                </div>
              </div>

              {/* Mock Invoice logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Receipt className="w-4 h-4" /> Transaction Invoice Ledger
                </h4>
                
                <div className="border border-slate-150 rounded-2xl divide-y divide-slate-150 text-xs">
                  {isBasic ? (
                    <p className="p-4 text-center text-slate-400 italic">No paid invoices recorded for free tier members.</p>
                  ) : (
                    <>
                      <div className="p-4 flex justify-between items-center bg-slate-50/50">
                        <div>
                          <p className="font-bold text-slate-800">Celina Connection Subscription Fee</p>
                          <p className="text-[10px] text-slate-400">Invoice #CC-004392 • Jul 2026</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{isPremium ? '$10.00' : '$5.00'}</p>
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Paid (Secure)
                          </span>
                        </div>
                      </div>
                      <div className="p-4 flex justify-between items-center opacity-70">
                        <div>
                          <p className="font-bold text-slate-800">Celina Connection Subscription Fee</p>
                          <p className="text-[10px] text-slate-400">Invoice #CC-002183 • Jun 2026</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{isPremium ? '$10.00' : '$5.00'}</p>
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Paid (Secure)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* METRICS AND TRAFFIC ANALYTICS */}
          {activeSubTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">Listing Metrics Analytics</h3>
                <p className="text-xs text-slate-500 mt-0.5">Track your business traffic, card views, and review counts from the Celina local population.</p>
              </div>

              {!isPremium ? (
                <div className="relative rounded-3xl border border-dashed border-amber-300 bg-amber-50/20 p-8 text-center space-y-4 shadow-sm" id="premium-gated-metrics-panel">
                  <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h4 className="font-display text-base font-bold text-slate-900">Preston Elite (Premium) Feature Gated</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Detailed monthly views, click conversion tracking, and traffic analytics are strictly reserved for <strong className="text-amber-700">Preston Elite (Premium)</strong> partners.
                    </p>
                  </div>
                  <button
                    onClick={() => onUpgradePrompt('premium')}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Unlock Premium Metrics
                  </button>
                </div>
              ) : (
                <>
                  {/* Bento-grid of scorecard metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4.5 bg-slate-50 border rounded-2xl text-slate-900 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Card Views</span>
                      <span className="font-display text-2.5xl font-extrabold block">
                        {myBusiness.viewsCount + 12}
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                        +15% from last week
                      </span>
                    </div>

                    <div className="p-4.5 bg-slate-50 border rounded-2xl text-slate-900 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Rating</span>
                      <span className="font-display text-2.5xl font-extrabold block text-amber-500 flex items-center gap-1">
                        {myBusiness.reviews.length
                          ? (myBusiness.reviews.reduce((s, r) => s + r.rating, 0) / myBusiness.reviews.length).toFixed(1)
                          : '5.0'}
                        <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium block">
                        Based on {myBusiness.reviews.length} reviews
                      </span>
                    </div>

                    <div className="p-4.5 bg-slate-50 border rounded-2xl text-slate-900 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Website Clicks</span>
                      <span className="font-display text-2.5xl font-extrabold block">
                        {isBasic ? '0' : Math.floor(myBusiness.viewsCount * 0.22)}
                      </span>
                      {isBasic ? (
                        <span onClick={() => onUpgradePrompt('pro')} className="text-[9px] text-orange-600 font-bold hover:underline cursor-pointer block">
                          Requires Pro tier
                        </span>
                      ) : (
                        <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                          22.4% conversion rate
                        </span>
                      )}
                    </div>

                    <div className="p-4.5 bg-slate-50 border rounded-2xl text-slate-900 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leads Generated</span>
                      <span className="font-display text-2.5xl font-extrabold block">
                        {isBasic ? '0' : Math.floor(myBusiness.viewsCount * 0.08)}
                      </span>
                      {isBasic ? (
                        <span onClick={() => onUpgradePrompt('pro')} className="text-[9px] text-orange-600 font-bold hover:underline cursor-pointer block">
                          Requires Pro tier
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-medium block">
                          Phone dials & map loads
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Beautiful SVG Views Line Chart */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Directory Traffic (Views over 7 Days)</h4>
                      <span className="text-[9px] text-slate-400 font-medium">Auto-updated hourly</span>
                    </div>

                    {/* SVG Visual graph */}
                    <div className="h-44 w-full relative pt-2">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* SVG Grid Lines */}
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#f1f5f9" strokeWidth="0.5" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="0.5" />
                        <line x1="0" y1="80" x2="100" y2="80" stroke="#f1f5f9" strokeWidth="0.5" />

                        {/* Chart Gradient Area */}
                        <defs>
                          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 90 L 0 75 Q 16 65 16 60 T 32 45 T 48 55 T 64 25 T 80 40 T 100 15 L 100 90 Z"
                          fill="url(#chartGlow)"
                        />

                        {/* Chart Polyline stroke */}
                        <path
                          d="M 0 75 Q 16 65 16 60 T 32 45 T 48 55 T 64 25 T 80 40 T 100 15"
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Interaction node indicators */}
                        <circle cx="16" cy="60" r="2.5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="48" cy="55" r="2.5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="64" cy="25" r="2.5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="100" cy="15" r="3" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                      </svg>

                      {/* Absolute Labels */}
                      <div className="absolute top-1 right-2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" /> Today Peak
                      </div>
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-400 font-semibold px-1 uppercase tracking-wider">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                      <span>Sun (Today)</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MASTER ADMINISTRATOR DASHBOARD VIEW
// ==========================================

interface AdminDashboardViewProps {
  activeDashboardSection: DashboardSubTab;
  businesses: Business[];
  onUpdateBusiness: (
    businessIdOrIds: string | string[],
    updatedFields: Partial<Business> | ((b: Business) => Partial<Business>)
  ) => void | Promise<void>;
  onAddBusiness: (business: any) => string | Promise<string>;
  onDeleteBusiness?: (businessIdOrIds: string | string[]) => void | Promise<void>;
  onResetDatabase?: () => void | Promise<void>;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  reportedBugs: ReportedBug[];
  onUpdateBugStatus?: (bugId: string, status: ReportedBug['status']) => void | Promise<void>;
  onDeleteBugStatus?: (bugId: string) => void | Promise<void>;
}

function AdminDashboardView({
  activeDashboardSection,
  businesses,
  onUpdateBusiness,
  onAddBusiness,
  onDeleteBusiness,
  onResetDatabase,
  setCurrentUser,
  reportedBugs = [],
  onUpdateBugStatus,
  onDeleteBugStatus,
}: AdminDashboardViewProps) {
  const getAdminTabFromHash = (): AdminActiveTab => {
    if (typeof window === 'undefined') return 'listings';
    return getAdminTabFromDashboardSection(window.location.hash);
  };
  const [adminActiveTab, setAdminActiveTab] = useState<AdminActiveTab>(() => getAdminTabFromDashboardSection(activeDashboardSection));

  const focusAdminListingsPanel = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      document.getElementById('admin-listings-section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, []);

  const syncAdminHash = React.useCallback(() => {
    const nextTab = getAdminTabFromHash();
    setAdminActiveTab(nextTab);
    if (shouldFocusAdminListings(window.location.hash, nextTab)) {
      focusAdminListingsPanel();
    }
  }, [focusAdminListingsPanel]);

  React.useEffect(() => {
    window.addEventListener('hashchange', syncAdminHash);
    syncAdminHash();
    return () => window.removeEventListener('hashchange', syncAdminHash);
  }, [syncAdminHash]);

  React.useEffect(() => {
    const nextTab = getAdminTabFromDashboardSection(activeDashboardSection);
    setAdminActiveTab(nextTab);
    if (typeof window !== 'undefined' && shouldFocusAdminListings(window.location.hash, nextTab)) {
      focusAdminListingsPanel();
    }
  }, [activeDashboardSection, focusAdminListingsPanel]);
  const setAdminTab = (tab: AdminActiveTab) => {
    window.location.hash = `dashboard-admin-${tab}`;
    setAdminActiveTab(tab);
    if (shouldFocusAdminListings(`#dashboard-admin-${tab}`, tab)) {
      focusAdminListingsPanel();
    }
  };
  const [bugSearch, setBugSearch] = useState('');
  const [bugCategoryFilter, setBugCategoryFilter] = useState<'all' | 'visual' | 'functional' | 'data' | 'other'>('all');
  const [bugSeverityFilter, setBugSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [bugStatusFilter, setBugStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'resolved'>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'premium' | 'pro' | 'basic' | 'unclaimed'>('all');
  const [selectedBusIds, setSelectedBusIds] = useState<string[]>([]);

  // CSV Importer States & Handlers
  const [csvInput, setCsvInput] = useState('');
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [showCsvImporter, setShowCsvImporter] = useState(false);

  const handleCsvImport = async (textToParse: string) => {
    if (!textToParse.trim()) {
      alert("Please paste some CSV data or select a valid file first.");
      return;
    }

    const lines = textToParse.split(/\r?\n/);
    if (lines.length < 1) {
      alert("No data found in the CSV input.");
      return;
    }

    const parseCsvLine = (line: string) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    let headerLine = lines[0];
    let headers = parseCsvLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const hasHeaders = headers.includes('name') || headers.includes('businessname') || headers.includes('title');
    let dataLines = lines;
    if (hasHeaders) {
      dataLines = lines.slice(1);
    } else {
      headers = ['name', 'category', 'description', 'phone', 'email', 'address', 'website'];
    }

    let importCount = 0;
    for (const line of dataLines) {
      if (!line.trim()) continue;
      const values = parseCsvLine(line);
      if (values.length === 0 || !values[0]) continue;

      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });

      const bName = record['name'] || record['businessname'] || record['title'] || values[0] || '';
      if (!bName) continue;

      const bCategory = record['category'] || record['type'] || values[1] || 'Dining';
      const bDesc = record['description'] || record['summary'] || record['desc'] || values[2] || 'Local business listing in Celina, Texas.';
      const bPhone = record['phone'] || record['tel'] || values[3] || '(972) 555-0100';
      const bEmail = record['email'] || record['mail'] || values[4] || `info@${bName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'local'}.com`;
      const bAddress = record['address'] || record['loc'] || values[5] || 'Celina, TX 75009';
      const bWebsite = record['website'] || record['url'] || record['web'] || values[6] || '';

      let matchedCategory = 'Dining';
      const lowerCategory = bCategory.toLowerCase();
      if (lowerCategory.includes('shop') || lowerCategory.includes('boutique') || lowerCategory.includes('retail') || lowerCategory.includes('store')) {
        matchedCategory = 'Shopping & Boutiques';
      } else if (lowerCategory.includes('health') || lowerCategory.includes('beauty') || lowerCategory.includes('spa') || lowerCategory.includes('hair') || lowerCategory.includes('barber') || lowerCategory.includes('salon') || lowerCategory.includes('dent')) {
        matchedCategory = 'Health & Beauty';
      } else if (lowerCategory.includes('auto') || lowerCategory.includes('car') || lowerCategory.includes('truck') || lowerCategory.includes('mechanic') || lowerCategory.includes('tire') || lowerCategory.includes('oil')) {
        matchedCategory = 'Automotive';
      } else if (lowerCategory.includes('insurance')) {
        matchedCategory = 'Insurance';
      } else if (lowerCategory.includes('estate planning') || lowerCategory.includes('trust') || lowerCategory.includes('will') || lowerCategory.includes('probate')) {
        matchedCategory = 'Estate Planning';
      } else if (lowerCategory.includes('mortgage') || lowerCategory.includes('lending') || lowerCategory.includes('loan')) {
        matchedCategory = 'Mortgage & Lending';
      } else if (lowerCategory.includes('financial') || lowerCategory.includes('finance') || lowerCategory.includes('wealth') || lowerCategory.includes('advisor')) {
        matchedCategory = 'Financial Services';
      } else if (lowerCategory.includes('legal') || lowerCategory.includes('law') || lowerCategory.includes('attorney')) {
        matchedCategory = 'Legal Services';
      } else if (lowerCategory.includes('real estate') || lowerCategory.includes('realtor') || lowerCategory.includes('realty') || lowerCategory.includes('property')) {
        matchedCategory = 'Real Estate';
      } else if (lowerCategory.includes('plumb') || lowerCategory.includes('lawn') || lowerCategory.includes('clean') || lowerCategory.includes('roof') || lowerCategory.includes('hvac') || lowerCategory.includes('electric')) {
        matchedCategory = 'Home Services';
      } else if (lowerCategory.includes('home') || lowerCategory.includes('service')) {
        matchedCategory = 'Professional Services';
      } else if (lowerCategory.includes('activit') || lowerCategory.includes('commun') || lowerCategory.includes('event') || lowerCategory.includes('art') || lowerCategory.includes('wood')) {
        matchedCategory = 'Activities & Community';
      } else if (lowerCategory.includes('dine') || lowerCategory.includes('food') || lowerCategory.includes('restaurant') || lowerCategory.includes('cafe') || lowerCategory.includes('baker') || lowerCategory.includes('donut')) {
        matchedCategory = 'Dining';
      } else {
        matchedCategory = 'Home & Professional Services';
      }

      await onAddBusiness({
        name: bName,
        category: matchedCategory,
        description: bDesc,
        phone: bPhone,
        email: bEmail,
        tier: 'basic',
        isUnclaimed: true,
        ownerId: '',
        address: bAddress,
        website: bWebsite,
      });
      importCount++;
    }

    setCsvInput('');
    setCsvImportSuccess(`Successfully imported ${importCount} unclaimed listings into the directory!`);
    setTimeout(() => setCsvImportSuccess(null), 8000);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleCsvImport(text);
      }
    };
    reader.readAsText(file);
  };

  // Modal Control
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Business Fields State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Dining');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTier, setNewTier] = useState<Tier>('basic');
  const [newIsUnclaimed, setNewIsUnclaimed] = useState(true);
  const [newAddress, setNewAddress] = useState('');
  const [newWebsite, setNewWebsite] = useState('');

  // Edit Business Fields State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Dining');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTier, setEditTier] = useState<Tier>('basic');
  const [editIsUnclaimed, setEditIsUnclaimed] = useState(true);
  const [editAddress, setEditAddress] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editOwnerPassword, setEditOwnerPassword] = useState('');

  // Handle opening the Edit modal
  const openEditModal = (bus: Business) => {
    setEditingBusiness(bus);
    setEditName(bus.name);
    setEditCategory(bus.category);
    setEditPhone(bus.phone);
    setEditEmail(bus.email);
    setEditDesc(bus.description);
    setEditTier(bus.tier);
    setEditIsUnclaimed(!!bus.isUnclaimed);
    setEditAddress(bus.address || '');
    setEditWebsite(bus.website || '');
    setEditLogoUrl(bus.logoUrl || '');
    setEditImages((bus.images || []).slice(0, maxImagesForTier(bus.tier)));
    setEditOwnerEmail(bus.email || '');
    setEditOwnerPassword('');
  };

  const readImageFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Image upload failed.'));
    reader.readAsDataURL(file);
  });

  const maxImagesForTier = (tier: Tier) => tier === 'free' || tier === 'basic' ? 1 : tier === 'pro' ? 5 : 10;

  const handleAdminLogoUpload = async (file?: File | null) => {
    if (!file) return;
    setEditLogoUrl(await readImageFileAsDataUrl(file));
  };

  const handleAdminGalleryUpload = async (files?: FileList | null) => {
    if (!files || !editingBusiness) return;
    const limit = maxImagesForTier(editTier || editingBusiness.tier);
    const remaining = Math.max(0, limit - editImages.length);
    if (remaining === 0) {
      alert(`This listing tier supports up to ${limit} gallery image${limit === 1 ? '' : 's'}.`);
      return;
    }
    const nextImages = await Promise.all(Array.from(files).slice(0, remaining).map(readImageFileAsDataUrl));
    setEditImages((current) => [...current, ...nextImages].slice(0, limit));
  };

  // Stats calculation
  const adminListings = businesses.filter((b) => !isHiddenFromAdminListings(b));
  const totalListings = adminListings.length;
  const claimedListingsCount = adminListings.filter((b) => !b.isUnclaimed && b.ownerId).length;
  const unclaimedListingsCount = adminListings.filter((b) => b.isUnclaimed).length;
  
  // Free spots calculation (starting at 92 to simulate high competitive demand)
  const freeClaimedBasicCount = Math.min(
    100,
    92 + adminListings.filter((b) => b.tier === 'free' && b.ownerId && !b.isUnclaimed).length
  );

  // Filter listings
  const filteredListings = adminListings.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTier =
      tierFilter === 'all' ||
      (tierFilter === 'unclaimed' ? b.isUnclaimed : b.tier === tierFilter && !b.isUnclaimed);

    return matchesSearch && matchesTier;
  });

  const filteredBugs = reportedBugs.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(bugSearch.toLowerCase()) ||
      b.description.toLowerCase().includes(bugSearch.toLowerCase()) ||
      b.email.toLowerCase().includes(bugSearch.toLowerCase());
    const matchesCategory = bugCategoryFilter === 'all' || b.category === bugCategoryFilter;
    const matchesSeverity = bugSeverityFilter === 'all' || b.severity === bugSeverityFilter;
    const matchesStatus = bugStatusFilter === 'all' || b.status === bugStatusFilter;
    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
  });

  // Bulk actions handlers
  const handleMassChangeTier = (nextTier: Tier) => {
    const count = selectedBusIds.length;
    onUpdateBusiness(selectedBusIds, { tier: nextTier });
    setSelectedBusIds([]);
    alert(`Successfully changed ${count} listings to ${nextTier.toUpperCase()} membership.`);
  };

  const handleMassChangeClaimStatus = (isUnclaimed: boolean) => {
    const count = selectedBusIds.length;
    onUpdateBusiness(selectedBusIds, (b) => {
      const ownerId = isUnclaimed ? '' : `owner-${Math.random().toString(36).substring(2, 7)}`;
      const email = isUnclaimed ? '' : `owner-${Math.random().toString(36).substring(2, 7)}@celinaconnection.com`;
      return {
        isUnclaimed,
        ownerId,
        email,
        createdAt: isUnclaimed ? new Date().toISOString() : b.createdAt
      };
    });
    setSelectedBusIds([]);
    alert(`Successfully updated claim status for ${count} listings.`);
  };

  const handleMassDelete = () => {
    const count = selectedBusIds.length;
    if (onDeleteBusiness && window.confirm(`Are you absolutely sure you want to permanently delete these ${count} selected listings? This action is irreversible.`)) {
      onDeleteBusiness(selectedBusIds);
      setSelectedBusIds([]);
    }
  };

  const handleMassResetViews = () => {
    const count = selectedBusIds.length;
    if (window.confirm(`Are you sure you want to reset the traffic views count to 0 for these ${count} selected listings?`)) {
      onUpdateBusiness(selectedBusIds, { viewsCount: 0 });
      setSelectedBusIds([]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newDesc.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    const ownerId = newIsUnclaimed ? '' : `owner-${Math.random().toString(36).substring(2, 7)}`;
    await onAddBusiness({
      name: newName,
      category: newCategory,
      description: newDesc,
      phone: newPhone,
      email: newEmail,
      tier: newTier,
      ownerId: ownerId,
      isUnclaimed: newIsUnclaimed,
      address: newAddress,
      website: newWebsite,
    });

    // Reset states
    setNewName('');
    setNewCategory('Dining');
    setNewPhone('');
    setNewEmail('');
    setNewDesc('');
    setNewTier('basic');
    setNewIsUnclaimed(true);
    setNewAddress('');
    setNewWebsite('');
    setShowCreateModal(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;

    try {
      if (!editIsUnclaimed && editOwnerPassword && editOwnerPassword.length < 10) {
        alert('Owner password must be at least 10 characters.');
        return;
      }

      await onUpdateBusiness(editingBusiness.id, {
        name: editName,
        category: editCategory,
        phone: editPhone,
        email: editEmail,
        description: editDesc,
        tier: editTier,
        isUnclaimed: editIsUnclaimed,
        address: editAddress,
        website: editWebsite,
        logoUrl: editLogoUrl,
        images: editImages.slice(0, maxImagesForTier(editTier)),
        ownerId: editIsUnclaimed ? '' : editingBusiness.ownerId || `owner-${Math.random().toString(36).substring(2, 7)}`,
        ownerEmail: editIsUnclaimed ? '' : editOwnerEmail,
        ...(editOwnerPassword ? { ownerPassword: editOwnerPassword } : {}),
      } as any);

      setEditingBusiness(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save listing changes.');
    }
  };

  const handleFastToggleClaim = (bus: Business) => {
    const nextUnclaimed = !bus.isUnclaimed;
    const ownerId = nextUnclaimed ? '' : bus.ownerId || `owner-${Math.random().toString(36).substring(2, 7)}`;
    const email = nextUnclaimed ? '' : bus.email || `owner-${Math.random().toString(36).substring(2, 7)}@celinaconnection.com`;
    
    onUpdateBusiness(bus.id, {
      isUnclaimed: nextUnclaimed,
      ownerId: ownerId,
      email: email
    });
  };

  const handleFastCycleTier = (bus: Business) => {
    const tiers: Tier[] = ['free', 'basic', 'pro', 'premium'];
    const currentIndex = tiers.indexOf(bus.tier);
    const nextTier = tiers[(currentIndex + 1) % tiers.length];
    onUpdateBusiness(bus.id, { tier: nextTier });
  };

  const handleDeleteClick = (busId: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete "${name}" from Celina Connection? This action is irreversible.`)) {
      if (onDeleteBusiness) {
        onDeleteBusiness(busId);
      }
    }
  };

  const handleLocalLogout = () => {
    setCurrentUser({
      id: '',
      email: '',
      businessName: '',
      tier: 'basic',
      isLoggedIn: false,
    });
  };

  return (
    <div className="py-6 space-y-8 animate-fade-in" id="admin-workspace-panel">
      {/* Admin Top Mini-Hero */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -z-10" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">🔑 Master System Administrator Workspace</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
            Celina Connection Control Panel
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4.5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New Profile
          </button>
          
          <button
            onClick={handleLocalLogout}
            className="px-4.5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout Admin
          </button>
        </div>
      </div>

      {/* Admin Segment Tabs Navigation */}
      <div className="flex border-b border-slate-200" id="admin-workspace-tabs">
        <button
          onClick={() => setAdminTab('listings')}
          className={`px-5 py-3.5 font-bold text-xs tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            adminActiveTab === 'listings'
              ? 'border-orange-500 text-orange-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Directory Listings ({adminListings.length})</span>
        </button>
        <button
          onClick={() => setAdminTab('bugs')}
          className={`px-5 py-3.5 font-bold text-xs tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 relative ${
            adminActiveTab === 'bugs'
              ? 'border-orange-500 text-orange-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bug className="w-4.5 h-4.5 text-rose-500" />
          <span>Reported Bug Tickets ({reportedBugs.length})</span>
          {reportedBugs.some(b => b.status === 'open') && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </div>

      {adminActiveTab === 'listings' ? (
        <>
          {/* Admin Dashboard Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Directory Listings</span>
          <span className="font-display text-3xl font-black text-slate-900 block">{totalListings}</span>
          <span className="text-[10px] text-slate-500 font-medium block">All local business database entries</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Claimed listings</span>
          <span className="font-display text-3xl font-black text-emerald-600 block">{claimedListingsCount}</span>
          <span className="text-[10px] text-slate-500 font-medium block">Assigned to active business owners</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unclaimed Listings</span>
          <span className="font-display text-3xl font-black text-rose-500 block">{unclaimedListingsCount}</span>
          <span className="text-[10px] text-slate-500 font-medium block">Profiles awaiting owner claiming actions</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Free Spot Cap Progress</span>
            <span className="font-display text-2xl font-black text-slate-900 block mt-0.5">{freeClaimedBasicCount} <span className="text-slate-400 text-sm">/ 100 claimed</span></span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 rounded-full" 
                style={{ width: `${freeClaimedBasicCount}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block text-right">{100 - freeClaimedBasicCount} slots remaining</span>
          </div>
        </div>
      </div>

      {/* CSV Mass Import Control Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              📂 Scraped Listings Mass Importer
            </h3>
            <p className="text-xs text-slate-500">
              Paste your scraped business lists in CSV format, or upload a <code>.csv</code> file to mass-add profiles to an unclaimed status.
            </p>
          </div>
          <button
            onClick={() => setShowCsvImporter(!showCsvImporter)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            {showCsvImporter ? "Hide CSV Panel" : "Open CSV Importer"}
          </button>
        </div>

        {csvImportSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold animate-fade-in flex items-center gap-2">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
            <span>{csvImportSuccess}</span>
          </div>
        )}

        {showCsvImporter && (
          <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Option A: Upload .csv File</span>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-orange-400 bg-white hover:bg-orange-50/5 p-6 rounded-xl cursor-pointer transition-all group">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-orange-500 mb-2 transition-colors" />
                  <span className="text-xs font-bold text-slate-700">Select CSV file</span>
                  <span className="text-[10px] text-slate-400 mt-1">Accepts comma-delimited tables</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Option B: Paste Raw CSV Text</span>
                <textarea
                  placeholder="name,category,description,phone,email,address,website&#10;Celina Patisserie,Dining,Handmade French pastries,(972) 382-8822,info@celinapatisserie.com,104 N Ohio St,https://patisserie.com"
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  className="w-full h-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-slate-800"
                />
                <button
                  onClick={() => handleCsvImport(csvInput)}
                  className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm hover:from-orange-600 hover:to-amber-600 cursor-pointer transition-all animate-pulse"
                >
                  🚀 Parse and Import Raw Text
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CSV Column Formatting Guide:</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                If your CSV includes a header line, we will auto-detect columns: <strong>name</strong>, <strong>category</strong>, <strong>description</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>, <strong>website</strong>. Otherwise, columns are parsed in that exact order. Categories are automatically normalized into existing directory categories, including Dining, Shopping, Health, Automotive, Real Estate, Insurance, Estate Planning, Financial Services, Legal Services, Mortgage & Lending, Home Services, Professional Services, and Community.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Directory Management Table Section */}
      <div id="admin-listings-section" className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <SearchQueryIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-800 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {(['all', 'free', 'basic', 'pro', 'premium', 'unclaimed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTierFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize cursor-pointer transition-all ${
                  tierFilter === mode
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {mode === 'unclaimed' ? '⚠️ Unclaimed' : mode === 'free' ? 'Free Launch' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {selectedBusIds.length > 0 && (
          <div className="p-4 bg-orange-500 text-slate-950 font-sans flex flex-col md:flex-row items-center justify-between gap-4 border-b border-orange-600 animate-fade-in relative" id="bulk-actions-panel">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-white text-[10px] font-black">
                {selectedBusIds.length}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-950">
                Listings Selected for Bulk Action
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Change Tier */}
              <div className="flex items-center gap-1 bg-white/20 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 text-slate-900">Tier:</span>
                <button
                  onClick={() => handleMassChangeTier('free')}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-[10px] font-bold rounded-lg shadow-sm text-emerald-700 cursor-pointer"
                >
                  Free
                </button>
                <button
                  onClick={() => handleMassChangeTier('basic')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[10px] font-bold rounded-lg shadow-sm text-slate-800 cursor-pointer"
                >
                  Basic
                </button>
                <button
                  onClick={() => handleMassChangeTier('pro')}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-[10px] font-bold rounded-lg shadow-sm text-indigo-700 cursor-pointer"
                >
                  Pro
                </button>
                <button
                  onClick={() => handleMassChangeTier('premium')}
                  className="px-2.5 py-1 bg-white hover:bg-amber-50 text-[10px] font-bold rounded-lg shadow-sm text-orange-700 cursor-pointer"
                >
                  Premium
                </button>
              </div>

              {/* Change Claim Status */}
              <div className="flex items-center gap-1 bg-white/20 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 text-slate-900">Claim:</span>
                <button
                  onClick={() => handleMassChangeClaimStatus(false)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-[10px] font-bold rounded-lg shadow-sm text-emerald-700 cursor-pointer"
                >
                  Claimed
                </button>
                <button
                  onClick={() => handleMassChangeClaimStatus(true)}
                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-[10px] font-bold rounded-lg shadow-sm text-rose-600 cursor-pointer"
                >
                  Unclaimed
                </button>
              </div>

              {/* Reset Traffic Views */}
              <button
                onClick={handleMassResetViews}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-[10px] rounded-xl shadow-md cursor-pointer flex items-center gap-1 transition-colors"
                title="Reset views count to 0"
              >
                <Eye className="w-3 h-3" />
                <span>Reset Views</span>
              </button>

              {/* Delete Selected */}
              <button
                onClick={handleMassDelete}
                className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-[10px] rounded-xl shadow-md cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Selected</span>
              </button>

              <span className="text-slate-950/40 text-xs">|</span>

              {/* Clear Selection */}
              <button
                onClick={() => setSelectedBusIds([])}
                className="px-3 py-2 bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 font-bold text-[10px] rounded-xl cursor-pointer"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        )}

        {/* Responsive Listing Management Grid */}
        <div className="p-4 sm:p-5 bg-white" id="admin-listing-directory-grid">
          {filteredListings.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 font-semibold italic border border-dashed border-slate-200 rounded-2xl bg-slate-50/70">
              No matching listings found in the directory database.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredListings.map((bus) => {
                const isSelected = selectedBusIds.includes(bus.id);
                const tierLabel = bus.tier === 'premium'
                  ? 'Premium Spotlight'
                  : bus.tier === 'pro'
                    ? 'Pro Partner'
                    : bus.tier === 'basic'
                      ? 'Basic Paid'
                      : 'Free Launch';

                return (
                  <article
                    key={bus.id}
                    className={`rounded-2xl border bg-white p-4 sm:p-5 shadow-sm transition-all ${
                      isSelected ? 'border-orange-300 ring-2 ring-orange-100 bg-orange-50/30' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`select-checkbox-${bus.id}`}
                          aria-label={`Select ${bus.name}`}
                          className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600 flex-shrink-0"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBusIds(prev => [...prev, bus.id]);
                            } else {
                              setSelectedBusIds(prev => prev.filter(id => id !== bus.id));
                            }
                          }}
                        />

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-display text-base font-black text-slate-950 leading-tight break-words">{bus.name}</h4>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-orange-600">{bus.category}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400 normal-case tracking-normal">ID: {bus.id}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleFastCycleTier(bus)}
                              title="Click to cycle membership tier"
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all border shadow-xs whitespace-nowrap self-start ${
                                bus.tier === 'premium'
                                  ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-orange-700 border-orange-300'
                                  : bus.tier === 'pro'
                                  ? 'bg-gradient-to-r from-indigo-500/10 to-blue-500/10 text-indigo-700 border-indigo-200'
                                  : bus.tier === 'basic'
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {tierLabel}
                              <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Cycle</span>
                            </button>
                          </div>

                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                            {bus.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 min-w-0">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Owner</span>
                          {bus.isUnclaimed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black bg-rose-50 border border-rose-200 text-rose-600">
                              ⚠️ Awaiting claim
                            </span>
                          ) : (
                            <>
                              <p className="font-bold text-slate-900 truncate">{bus.email || 'No email on file'}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider truncate">Owner ID: {bus.ownerId || 'unassigned'}</p>
                            </>
                          )}
                        </div>

                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 min-w-0">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Contact</span>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5 truncate"><Phone className="w-3 h-3 text-slate-400 flex-shrink-0" /> {bus.phone || 'No phone'}</p>
                          <p className="text-[9px] text-slate-400 font-semibold flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {bus.email || 'No public email'}</p>
                        </div>

                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 min-w-0">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Traffic</span>
                          <p className="font-display text-xl font-black text-slate-950 flex items-center gap-1.5"><Eye className="w-4 h-4 text-slate-400" /> {bus.viewsCount}</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Directory views</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => handleFastToggleClaim(bus)}
                          className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer text-[10px] font-black flex items-center justify-center gap-1.5 ${
                            bus.isUnclaimed 
                              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                              : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {bus.isUnclaimed ? 'Mark Claimed' : 'Move to Awaiting Claim'}
                        </button>

                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                          <button
                            onClick={() => openEditModal(bus)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer text-[10px] font-black flex items-center justify-center gap-1.5"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>

                          <button
                            onClick={() => handleDeleteClick(bus.id, bus.name)}
                            className="px-3.5 py-2 rounded-xl border border-rose-100 bg-white hover:bg-rose-50 text-rose-600 transition-all cursor-pointer text-[10px] font-black flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Database Restore Action Panel Footer */}
        {onResetDatabase && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-semibold">Database Management Controls</span>
            <button
              onClick={() => {
                if (window.confirm("Restore platform data? This will overwrite your active database with the original 9 Celina Connection mock profiles (including our 3 Unclaimed profiles) and reset all statistics.")) {
                  onResetDatabase();
                }
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Database to Original Defaults
            </button>
          </div>
        )}
      </div>
        </>
      ) : (
        /* Bug Tickets Section */
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm animate-fade-in" id="admin-bugs-card">
          {/* Controls Bar */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <SearchQueryIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search bugs by title, reporter..."
                value={bugSearch}
                onChange={(e) => setBugSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-800 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Severity:</span>
                <select
                  value={bugSeverityFilter}
                  onChange={(e) => setBugSeverityFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Category:</span>
                <select
                  value={bugCategoryFilter}
                  onChange={(e) => setBugCategoryFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="visual">🎨 Visual</option>
                  <option value="functional">⚙️ Functional</option>
                  <option value="data">📊 Data</option>
                  <option value="other">❓ Other</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Status:</span>
                <select
                  value={bugStatusFilter}
                  onChange={(e) => setBugStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">🟢 Open</option>
                  <option value="in-progress">🔄 In Progress</option>
                  <option value="resolved">✅ Resolved</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ticket List Table/Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-4 pl-6">Bug Ticket details</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Reporter</th>
                  <th className="p-4">Status / Action</th>
                  <th className="p-4 pr-6 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredBugs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                      No matching bug reports found in active registry database.
                    </td>
                  </tr>
                ) : (
                  filteredBugs.map((bug) => {
                    return (
                      <tr key={bug.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 max-w-sm">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 text-sm">{bug.title}</p>
                            <p className="text-slate-500 text-xs leading-relaxed font-normal whitespace-pre-wrap">{bug.description}</p>
                            <span className="text-[9px] text-slate-400 block font-semibold">Reported on: {new Date(bug.createdAt).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-50 border border-orange-100 text-orange-600">
                            {bug.category}
                          </span>
                        </td>
                        <td className="p-4">
                          {bug.severity === 'high' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black bg-rose-50 border border-rose-200 text-rose-600">
                              🔴 High Severity
                            </span>
                          ) : bug.severity === 'medium' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                              🟡 Medium
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-slate-50 border border-slate-200 text-slate-600">
                              ⚪ Low
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-900 block">{bug.email}</span>
                          <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-semibold">Reporter</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={bug.status}
                              onChange={(e) => onUpdateBugStatus && onUpdateBugStatus(bug.id, e.target.value as any)}
                              className={`px-2.5 py-1 bg-white border text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm ${
                                bug.status === 'resolved'
                                  ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  : bug.status === 'in-progress'
                                  ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                  : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <option value="open">🟢 Open</option>
                              <option value="in-progress">🔄 In Progress</option>
                              <option value="resolved">✅ Resolved</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to permanently delete this bug ticket?')) {
                                onDeleteBugStatus && onDeleteBugStatus(bug.id);
                              }
                            }}
                            className="p-1.5 rounded-xl border border-rose-100 bg-white hover:bg-rose-50 text-rose-500 transition-all cursor-pointer"
                            title="Delete bug ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE NEW LISTING OVERLAY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setShowCreateModal(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl max-w-lg w-full z-10 space-y-5">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
            >
              &times;
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-xl font-extrabold text-slate-900">Add New Directory Profile</h3>
              <p className="text-xs text-slate-500">Insert custom or unclaimed records directly into the Celina Connection registry.</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Celina Square Bookstore"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="(972) 555-0100"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Claim Status</label>
                  <select
                    value={newIsUnclaimed ? 'unclaimed' : 'claimed'}
                    onChange={(e) => setNewIsUnclaimed(e.target.value === 'unclaimed')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    <option value="unclaimed">⚠️ Unclaimed Profile</option>
                    <option value="claimed">✅ Claimed / Pre-Assigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Membership Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as Tier)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    <option value="free">Free Launch</option>
                    <option value="basic">Basic ($6/mo)</option>
                    <option value="pro">Pro Partner</option>
                    <option value="premium">Premium Spotlight</option>
                  </select>
                </div>
              </div>

              {!newIsUnclaimed && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Owner Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="owner@celinasquarebookstore.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Physical Address</label>
                <input
                  type="text"
                  placeholder="e.g. 104 N Ohio St, Celina, TX 75009"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://celinabookstore.com"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Business Description</label>
                <textarea
                  required
                  placeholder="Tell customers about your services and offerings..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2.5}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Save Profile Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE OVERLAY MODAL */}
      {editingBusiness && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setEditingBusiness(null)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl max-w-lg w-full z-10 space-y-5">
            <button
              onClick={() => setEditingBusiness(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
            >
              &times;
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-xl font-extrabold text-slate-900">Edit Listing Profile</h3>
              <p className="text-xs text-slate-500">Edit business details and membership permissions for active ID: {editingBusiness.id}</p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Business Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Claim Status</label>
                  <select
                    value={editIsUnclaimed ? 'unclaimed' : 'claimed'}
                    onChange={(e) => setEditIsUnclaimed(e.target.value === 'unclaimed')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    <option value="unclaimed">⚠️ Unclaimed Profile</option>
                    <option value="claimed">✅ Claimed Listing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Membership Tier</label>
                  <select
                    value={editTier}
                    onChange={(e) => {
                      const nextTier = e.target.value as Tier;
                      setEditTier(nextTier);
                      setEditImages((current) => current.slice(0, maxImagesForTier(nextTier)));
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 cursor-pointer"
                  >
                    <option value="free">Free Launch</option>
                    <option value="basic">Basic ($6/mo)</option>
                    <option value="pro">Pro Partner</option>
                    <option value="premium">Premium Spotlight</option>
                  </select>
                </div>
              </div>

              {!editIsUnclaimed && (
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Owner Assignment / CRM Access</h4>
                    <p className="text-[10px] font-semibold text-emerald-700/70">
                      Assign this listing to an owner account or reset the owner's login password. Leave password blank to keep the current password.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Owner Login Email</label>
                      <input
                        type="email"
                        required
                        placeholder="owner@email.com"
                        value={editOwnerEmail}
                        onChange={(e) => {
                          setEditOwnerEmail(e.target.value);
                          setEditEmail(e.target.value);
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-emerald-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Set / Change Password</label>
                      <input
                        type="password"
                        minLength={10}
                        placeholder="Optional new password"
                        value={editOwnerPassword}
                        onChange={(e) => setEditOwnerPassword(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-emerald-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Public Contact Email</label>
                    <input
                      type="email"
                      required
                      placeholder="public@email.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-emerald-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Physical Address</label>
                <input
                  type="text"
                  placeholder="Address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="Website Link"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Business Description</label>
                <textarea
                  required
                  placeholder="Description summary"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2.5}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Admin Listing Media</h4>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Upload a logo and gallery photos for this business. {maxImagesForTier(editTier)} gallery image{maxImagesForTier(editTier) === 1 ? '' : 's'} allowed on {editTier}.
                    </p>
                  </div>
                  {editLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditLogoUrl('')}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Remove logo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[90px_1fr] gap-4 items-center">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                    {editLogoUrl ? (
                      <img src={editLogoUrl} alt="Admin logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-orange-300 hover:text-orange-600 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAdminLogoUpload(e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="url"
                      placeholder="Or paste a hosted logo image URL"
                      value={editLogoUrl.startsWith('data:') ? '' : editLogoUrl}
                      onChange={(e) => setEditLogoUrl(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gallery Images ({editImages.length}/{maxImagesForTier(editTier)})</span>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:border-orange-300 hover:text-orange-600 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Upload Gallery Images</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleAdminGalleryUpload(e.target.files)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {editImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {editImages.map((image, index) => (
                        <div key={`${image}-${index}`} className="relative group aspect-square rounded-xl overflow-hidden bg-white border border-slate-200">
                          <img src={image} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditImages((current) => current.filter((_, idx) => idx !== index))}
                            className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remove gallery image"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-semibold text-slate-400">
                      No gallery images yet. Upload photos of the storefront, team, products, or services.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBusiness(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Save Profile Records
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchQueryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
