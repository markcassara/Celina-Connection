import React, { useState } from 'react';
import { Business, Review, Tier } from '../types';
import { CATEGORIES } from '../data/mockBusinesses';
import FeaturedCarousel from './FeaturedCarousel';
import MapModal from './MapModal';
import {
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Globe,
  Clock,
  ExternalLink,
  Lock,
  Star,
  Plus,
  MessageSquare,
  Facebook,
  Instagram,
  Twitter,
  ChevronRight,
  ShieldCheck,
  Check,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DirectoryViewProps {
  businesses: Business[];
  onAddReview: (businessId: string, review: Omit<Review, 'id' | 'createdAt'>) => void | Promise<void>;
  onSelectBusiness: (business: Business) => void;
  selectedBusiness: Business | null;
  onCloseDetail: () => void;
  onUpgradePrompt: (tier: Tier) => void;
  onClaimBusiness: (businessId: string, email: string) => void | Promise<void>;
  isAiEnabled: boolean;
  serverAiAvailable: boolean;
  setActiveTab?: (tab: string) => void;
}

export default function DirectoryView({
  businesses,
  onAddReview,
  selectedBusiness,
  onSelectBusiness,
  onCloseDetail,
  onUpgradePrompt,
  onClaimBusiness,
  isAiEnabled,
  serverAiAvailable,
  setActiveTab,
}: DirectoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | 'premium' | 'pro'>('all');
  const [selectedMapBusiness, setSelectedMapBusiness] = useState<Business | null>(null);

  // AI Search states
  const [aiSearchInsights, setAiSearchInsights] = useState<string | null>(null);
  const [aiMatchingIds, setAiMatchingIds] = useState<string[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [isAiFilterActive, setIsAiFilterActive] = useState(false);

  // Claim Listing states
  const [claimTarget, setClaimTarget] = useState<Business | null>(null);
  const [claimEmail, setClaimEmail] = useState('');

  // Calculate claimed basic count dynamically (starting at 92 to simulate high demand)
  const claimedBasicCount = Math.min(100, 92 + businesses.filter(b => b.tier === 'basic' && b.ownerId && !b.isUnclaimed).length);

  // Review Form state
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const handleAiSearch = async () => {
    if (!searchTerm.trim()) {
      alert("Please enter a search phrase to get AI search insights.");
      return;
    }
    setIsAiSearching(true);
    setAiSearchError(null);
    setAiSearchInsights(null);
    setAiMatchingIds(null);

    try {
      const minimizedBusinesses = businesses.map(b => ({
        id: b.id,
        name: b.name,
        category: b.category,
        description: b.description,
        address: b.address,
        tier: b.tier,
      }));

      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchTerm,
          businesses: minimizedBusinesses
        })
      });

      if (!res.ok) {
        throw new Error("Failed to retrieve AI search insights");
      }

      const data = await res.json();
      setAiSearchInsights(data.insights || "No detailed insights found for this search.");
      setAiMatchingIds(data.matchingIds || []);
      setIsAiFilterActive(true);
    } catch (err: any) {
      console.error(err);
      setAiSearchError("Unable to fetch AI search insights. Standard text search remains active.");
    } finally {
      setIsAiSearching(false);
    }
  };

  // Filter businesses
  let unclaimedCount = 0;
  const filteredBusinesses = businesses.filter((b) => {
    if (isAiFilterActive && aiMatchingIds) {
      if (!aiMatchingIds.includes(b.id)) return false;
    } else {
      const matchesSearch =
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.category.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
    }
    
    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
    
    const matchesTier =
      selectedTierFilter === 'all' ||
      (selectedTierFilter === 'premium' && b.tier === 'premium') ||
      (selectedTierFilter === 'pro' && b.tier === 'pro');

    const matchesFilters = matchesCategory && matchesTier;
    if (!matchesFilters) return false;

    // Limit unclaimed businesses on the front page directory grid to 10
    if (b.isUnclaimed) {
      if (unclaimedCount >= 10) return false;
      unclaimedCount++;
    }

    return true;
  });

  const getTierBadge = (tier: Tier) => {
    switch (tier) {
      case 'premium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-slate-950 shadow-sm uppercase tracking-wide border border-amber-400">
            <Star className="w-2.5 h-2.5 fill-slate-950" /> Premium Partner
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wide border border-orange-200">
            Pro Partner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">
            Basic
          </span>
        );
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewText.trim()) {
      setReviewError('Please fill out both your name and review comment.');
      return;
    }
    if (!selectedBusiness) return;

    await onAddReview(selectedBusiness.id, {
      authorName: reviewAuthor,
      rating: reviewRating,
      text: reviewText,
    });

    setReviewAuthor('');
    setReviewRating(5);
    setReviewText('');
    setReviewError('');
    setReviewSuccess(true);
    setTimeout(() => setReviewSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 py-6">
      {/* Competitive Free Claim Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-orange-200/60 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-800 shadow-sm" id="competitive-launch-banner">
        <div className="flex items-start gap-3">
          <span className="flex h-3 w-3 relative mt-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <div>
            <p className="font-display font-extrabold text-slate-900 text-sm">🔥 Celina Connection Competitive Launch</p>
            <p className="text-slate-500 font-medium text-[11px] mt-0.5 leading-relaxed">
              FREE listing slots are strictly capped for the first 100 businesses. Claim your local business profile today to secure a lifetime free listing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start flex-shrink-0">
          <div className="bg-white border border-orange-200/80 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <span className="text-orange-700 font-black text-sm tracking-tight">{claimedBasicCount}/100</span>
            <span className="text-slate-600 font-semibold text-[9px] uppercase tracking-wider">Slots Claimed</span>
          </div>
          {claimedBasicCount >= 100 ? (
            <span className="text-red-600 text-xs font-bold bg-red-50 border border-red-200 px-3 py-2 rounded-xl">ALL FREE SLOTS CLAIMEED</span>
          ) : (
            <button
              onClick={() => {
                const el = document.getElementById('unclaimed-listings-registry');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else if (setActiveTab) {
                  setActiveTab('dashboard');
                }
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer shadow-sm shadow-orange-100"
            >
              Claim Your Free Spot
            </button>
          )}
        </div>
      </div>

      {/* Featured Businesses Spotlight */}
      {businesses.some((b) => b.tier === 'premium' || b.tier === 'pro' || b.featured) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Featured Partners Spotlight
            </h2>
          </div>
          <FeaturedCarousel businesses={businesses} onSelectBusiness={onSelectBusiness} />
        </div>
      )}

      {/* Search and Hero Area */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white p-8 md:p-12 shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-orange-400" /> Celina, Texas
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            Connect with the Best of <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">Celina</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl"
          >
            Explore our rich community directory, discover local treasures on the Square, or register your own business and grow your Celina reach today.
          </motion.p>

          {/* Inline Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-stretch gap-2 pt-4"
          >
            <div className="relative flex-grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                id="search-input"
                placeholder={isAiEnabled ? "Describe what you want (e.g. cozy spot for date, top comfort food)..." : "Search dining, boutique shops, home services..."}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!e.target.value) {
                    setIsAiFilterActive(false);
                    setAiSearchInsights(null);
                    setAiMatchingIds(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isAiEnabled) {
                    handleAiSearch();
                  }
                }}
                className="w-full pl-11 pr-4 py-3.5 bg-white text-slate-900 rounded-xl font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-inner text-sm"
              />
            </div>
            <div className="flex gap-2">
              {isAiEnabled && (
                <button
                  type="button"
                  id="ai-search-insights-btn"
                  onClick={handleAiSearch}
                  disabled={isAiSearching || !searchTerm.trim()}
                  className={`px-4 py-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer flex-shrink-0 ${
                    searchTerm.trim()
                      ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-slate-950 hover:opacity-90 shadow-orange-100/30'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                  title="Generate custom AI recommendations and filter listings"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiSearching ? 'animate-spin' : 'animate-pulse'}`} />
                  <span>{isAiSearching ? 'AI Searching...' : 'Ask AI Insights'}</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* AI Search Insights Box (Now placed directly under the search bar area for better visibility) */}
      <AnimatePresence>
        {isAiFilterActive && aiSearchInsights && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-orange-50/70 to-amber-50/40 border border-orange-100 text-slate-800 shadow-sm relative overflow-hidden"
            id="ai-search-insights-panel"
          >
            <div className="absolute top-0 right-0 p-3 flex gap-2">
              <button
                onClick={() => {
                  setIsAiFilterActive(false);
                  setAiSearchInsights(null);
                  setAiMatchingIds(null);
                }}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200/80 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 transition-all"
              >
                <X className="w-3 h-3 text-slate-500" />
                <span>Clear AI Filter</span>
              </button>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-100/30">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="space-y-2 pr-24">
                <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1">
                  Celina AI Search Insights
                </h4>
                <p className="text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-line">
                  {aiSearchInsights.split('**').map((part, index) => 
                    index % 2 === 1 ? <strong key={index} className="font-bold text-slate-950">{part}</strong> : part
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Searching Loading Indicator (Now placed directly under the search bar area) */}
      {isAiSearching && (
        <div className="p-8 rounded-2xl border border-dashed border-orange-200 bg-orange-50/10 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 bg-orange-500 rounded-full animate-bounce" />
          </div>
          <p className="text-xs font-bold text-slate-500 animate-pulse uppercase tracking-wider">
            Gemini AI is analyzing business profiles for custom recommendations...
          </p>
        </div>
      )}

      {aiSearchError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{aiSearchError}</span>
        </div>
      )}



      {/* Category Selection Filter Pills */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Browse by Category</h3>
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1" id="category-filter-pills">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-100'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Directory List Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <p className="text-sm font-medium text-slate-500">
            Showing <span className="font-bold text-slate-900">{filteredBusinesses.length}</span>{' '}
            {filteredBusinesses.length === 1 ? 'business' : 'businesses'} in Celina
          </p>
        </div>

        {/* Results indicator and listing info */}

        {filteredBusinesses.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8">
            <p className="text-slate-500 text-base mb-2">No matching businesses found.</p>
            <p className="text-slate-400 text-xs">Try searching for different terms or selecting "All" categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="directory-grid">
            {filteredBusinesses.map((b) => {
              const isPremium = b.tier === 'premium';
              const isPro = b.tier === 'pro';
              const ratingSum = b.reviews.reduce((sum, r) => sum + r.rating, 0);
              const avgRating = b.reviews.length ? (ratingSum / b.reviews.length).toFixed(1) : null;

              return (
                <motion.div
                  key={b.id}
                  layout
                  onClick={() => onSelectBusiness(b)}
                  id={`business-card-${b.id}`}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border cursor-pointer hover:shadow-xl transition-all duration-300 ${
                    isPremium
                      ? 'ring-2 ring-amber-400 shadow-md shadow-amber-50/50 border-amber-300'
                      : isPro
                      ? 'border-orange-200 shadow-sm'
                      : 'border-slate-150'
                  }`}
                  whileHover={{ y: -4 }}
                >
                  {/* Card Premium Shimmer Top Overlay */}
                  {isPremium && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                  )}

                  {/* Body Content */}
                  <div className="p-5 space-y-4">
                    {/* Header line: Category & Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md">
                        {b.category}
                      </span>
                      {b.isUnclaimed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-900 text-white uppercase tracking-wide shadow-sm border border-rose-950">
                          ⚠️ Unclaimed Listing
                        </span>
                      ) : (
                        getTierBadge(b.tier)
                      )}
                    </div>

                    {/* Business Name & rating */}
                    <div>
                      <h4 className="font-display font-bold text-slate-900 group-hover:text-orange-600 transition-colors text-lg leading-snug truncate">
                        {b.name}
                      </h4>
                      {avgRating && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < Math.floor(Number(avgRating))
                                    ? 'fill-amber-400'
                                    : 'text-slate-200'
                                  }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{avgRating}</span>
                          <span className="text-[10px] text-slate-600">({b.reviews.length})</span>
                        </div>
                      )}
                    </div>

                    {/* Image / Banner - Only if Pro/Premium, else we show a clean card placeholder */}
                    {(isPro || isPremium) && b.images && b.images.length > 0 ? (
                      <div className="h-32 w-full rounded-xl overflow-hidden relative">
                        <img
                          src={b.images[0]}
                          alt={b.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="h-1 bg-slate-50 rounded-xl" /> // Small visual spacing
                    )}

                    {/* Description */}
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
                      {b.description}
                    </p>

                    {/* Active claim notice banner inside card body if unclaimed */}
                    {b.isUnclaimed && (
                      <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl flex items-start gap-1.5 text-[10px] leading-relaxed text-rose-900">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <p className="font-extrabold text-rose-800">⚠️ Unclaimed Profile</p>
                          <p className="text-rose-700 font-medium">Claim this listing to verify ownership, update details, and unlock traffic analytics!</p>
                        </div>
                      </div>
                    )}

                    {/* Meta details */}
                    <div className="space-y-1.5 text-slate-500 text-xs pt-2">
                      {b.address && (isPro || isPremium) ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{b.address}</span>
                        </div>
                      ) : b.address ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                          <span className="italic flex items-center gap-1">
                            Celina, TX <Lock className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{b.phone}</span>
                      </div>

                      {/* Display locked indicator on basic tier for Web and Hours */}
                      {!isPremium && !isPro && (
                        <div className="flex items-center gap-1.5 text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>Unlock address & website with Pro</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
                    {b.isUnclaimed ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClaimTarget(b);
                        }}
                        className="text-rose-700 hover:text-rose-800 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        Claim This Listing Now <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-orange-600 group-hover:underline flex items-center gap-0.5">
                        View Profile <ChevronRight className="w-3 h-3" />
                      </span>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        id={`show-map-btn-${b.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMapBusiness(b);
                        }}
                        className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                        title="Show location on map"
                      >
                        <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        <span>Show on Map</span>
                      </button>

                      {(isPro || isPremium) && b.website && !b.isUnclaimed && (
                        <span className="text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                          <Globe className="w-3.5 h-3.5" /> Website
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Community Registry Entries (Unclaimed Profiles) */}
      {businesses.some((b) => b.isUnclaimed) && (
        <div id="unclaimed-listings-registry" className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-sm mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                Celina Local Business Registry
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Active community profile placeholders awaiting owner verification. Claim yours to instantly manage and upgrade.
              </p>
            </div>
          </div>
 
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {businesses
              .filter((b) => b.isUnclaimed)
              .map((b) => (
                <div
                  key={b.id}
                  onClick={() => onSelectBusiness(b)}
                  className="group flex items-center justify-between p-3 bg-white border border-slate-150 hover:border-orange-300 rounded-xl transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm"
                >
                  <span className="font-bold text-slate-800 text-xs truncate pr-2 group-hover:text-orange-600 transition-colors">
                    {b.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setClaimTarget(b);
                    }}
                    className="flex-shrink-0 px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 hover:text-rose-950 font-bold text-[10px] rounded-lg border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer"
                  >
                    Claim Now
                  </button>
                </div>
              ))}
          </div>

          <div className="flex justify-center pt-4 border-t border-slate-200/60">
            <button
              onClick={() => setActiveTab && setActiveTab('dashboard')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-orange-400" />
              <span>Don't see your business, create a free listing now</span>
            </button>
          </div>
        </div>
      )}

      {/* Detailed Profile Drawer/Modal */}
      <AnimatePresence>
        {selectedBusiness && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="business-detail-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseDetail}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body Container */}
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
              >
                {/* Header Banner Image (Only Pro/Premium) */}
                <div className="relative h-44 sm:h-56 bg-slate-100 flex-shrink-0">
                  <button
                    onClick={onCloseDetail}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/40 hover:bg-slate-950/60 text-white backdrop-blur-sm transition-colors cursor-pointer"
                  >
                    &times;
                  </button>

                  {(selectedBusiness.tier === 'pro' || selectedBusiness.tier === 'premium') &&
                  selectedBusiness.images &&
                  selectedBusiness.images.length > 0 ? (
                    <img
                      src={selectedBusiness.images[0]}
                      alt={selectedBusiness.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                      <div className="text-center text-white p-6">
                        <h3 className="font-display text-2xl font-black">
                          {selectedBusiness.name}
                        </h3>
                        <p className="text-xs uppercase tracking-wider font-semibold opacity-90 mt-1">
                          {selectedBusiness.category}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Absolute Badge Overlay */}
                  <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                    {getTierBadge(selectedBusiness.tier)}
                  </div>
                </div>

                {/* Main Content Area (Scrollable) */}
                <div className="flex-grow overflow-y-auto p-6 sm:p-8 space-y-6">
                  {selectedBusiness.isUnclaimed && (
                    <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-sm mb-2 bg-rose-50 border border-rose-100 text-rose-900 animate-pulse" id="unclaimed-detail-warning">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <p className="font-extrabold">⚠️ Unclaimed Business Profile</p>
                          <p className="font-medium mt-1 leading-relaxed text-rose-700">
                            This business listing is unclaimed. To verify ownership, customize details, upload photos, reply to reviews, and unlock business analytics, please claim this profile.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setClaimTarget(selectedBusiness)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer self-start sm:self-center flex-shrink-0"
                      >
                        Claim This Listing
                      </button>
                    </div>
                  )}

                  {/* Identity Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {selectedBusiness.name}
                      </h3>
                      <p className="text-sm font-semibold text-orange-600 mt-1">
                        {selectedBusiness.category}
                      </p>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap gap-2.5">
                      {selectedBusiness.tier === 'premium' && selectedBusiness.website && (
                        <a
                          href={selectedBusiness.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 text-sm font-bold shadow-md shadow-orange-100 cursor-pointer"
                        >
                          <span>{selectedBusiness.ctaText || 'Visit Business'}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {selectedBusiness.website && selectedBusiness.tier !== 'basic' ? (
                        <a
                          href={selectedBusiness.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
                        >
                          <Globe className="w-4 h-4 text-slate-500" />
                          <span>Website</span>
                        </a>
                      ) : (
                        selectedBusiness.tier === 'basic' && (
                          <button
                            onClick={() => onUpgradePrompt('pro')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm font-semibold cursor-pointer"
                            title="Locked website feature"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="line-through text-xs">Website Lock</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Grid layout for description & contact details */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left Column: Description & Gallery */}
                    <div className="md:col-span-7 space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          About the Business
                        </h4>
                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                          {selectedBusiness.description}
                        </p>
                      </div>

                      {/* Image Gallery (Pro: up to 5, Premium: up to 10) */}
                      {selectedBusiness.tier !== 'basic' &&
                        selectedBusiness.images &&
                        selectedBusiness.images.length > 1 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Photo Gallery
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedBusiness.images.slice(1).map((img, i) => (
                                <div key={i} className="h-20 rounded-xl overflow-hidden bg-slate-100">
                                  <img
                                    src={img}
                                    alt={`${selectedBusiness.name} gallery ${i}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Right Column: Contact, Hours, Socials */}
                    <div className="md:col-span-5 bg-slate-50 rounded-2xl p-5 space-y-5 border border-slate-100">
                      {/* Contacts */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Contact Info
                        </h4>
                        <div className="space-y-2 text-slate-700 text-xs font-medium">
                          {selectedBusiness.address && selectedBusiness.tier !== 'basic' ? (
                            <div className="flex items-start gap-2.5">
                              <MapPin className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span>{selectedBusiness.address}</span>
                                <button
                                  id="detail-view-map-btn"
                                  onClick={() => setSelectedMapBusiness(selectedBusiness)}
                                  className="text-[10px] text-orange-600 hover:underline font-bold mt-1 text-left flex items-center gap-1 cursor-pointer"
                                >
                                  <span>View Location on Map</span>
                                  <ChevronRight className="w-3 h-3 text-orange-500" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2.5 text-slate-400">
                              <MapPin className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span>Celina, TX (Downtown Square)</span>
                                <span className="text-[10px] text-orange-600 mt-0.5 flex items-center gap-0.5 font-bold">
                                  <Lock className="w-2.5 h-2.5" /> Full Address requires Pro
                                </span>
                                <button
                                  id="detail-view-approx-map-btn"
                                  onClick={() => setSelectedMapBusiness(selectedBusiness)}
                                  className="text-[10px] text-orange-600 hover:underline font-bold mt-1 text-left flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Show Approximate Map Location</span>
                                  <ChevronRight className="w-3 h-3 text-orange-500" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <span>{selectedBusiness.phone}</span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <Mail className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <span className="truncate">{selectedBusiness.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hours of Operation (Pro/Premium only) */}
                      <div className="space-y-2.5 border-t border-slate-200/60 pt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Hours
                          </h4>
                          {selectedBusiness.tier === 'basic' && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Pro Feature
                            </span>
                          )}
                        </div>

                        {selectedBusiness.tier !== 'basic' && selectedBusiness.hours ? (
                          <div className="space-y-1 text-slate-700 text-xs font-medium">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Mon - Fri:</span>
                              <span>{selectedBusiness.hours.monFri}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Saturday:</span>
                              <span>{selectedBusiness.hours.sat}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sunday:</span>
                              <span>{selectedBusiness.hours.sun}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-100 rounded-xl text-center text-[11px] text-slate-400 italic">
                            Hours are hidden for basic listings.
                            <button
                              onClick={() => onUpgradePrompt('pro')}
                              className="block mx-auto text-orange-600 font-bold hover:underline mt-1 cursor-pointer"
                            >
                              Upgrade to Unlock
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Social Links (Premium only) */}
                      {selectedBusiness.tier === 'premium' && selectedBusiness.socialLinks && (
                        <div className="space-y-2 border-t border-slate-200/60 pt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Social Media
                          </h4>
                          <div className="flex gap-2">
                            {selectedBusiness.socialLinks.facebook && (
                              <a
                                href={selectedBusiness.socialLinks.facebook}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-white rounded-xl border border-slate-200 hover:text-orange-600 hover:border-orange-200 text-slate-500 transition-colors"
                              >
                                <Facebook className="w-4 h-4" />
                              </a>
                            )}
                            {selectedBusiness.socialLinks.instagram && (
                              <a
                                href={selectedBusiness.socialLinks.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-white rounded-xl border border-slate-200 hover:text-orange-600 hover:border-orange-200 text-slate-500 transition-colors"
                              >
                                <Instagram className="w-4 h-4" />
                              </a>
                            )}
                            {selectedBusiness.socialLinks.twitter && (
                              <a
                                href={selectedBusiness.socialLinks.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-white rounded-xl border border-slate-200 hover:text-orange-600 hover:border-orange-200 text-slate-500 transition-colors"
                              >
                                <Twitter className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Reviews Section */}
                  <div className="border-t border-slate-100 pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <MessageSquare className="w-5 h-5 text-orange-600" />
                        Customer Reviews ({selectedBusiness.reviews.length})
                      </h4>
                      {selectedBusiness.tier === 'basic' && (
                        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Owner replies require Pro
                        </span>
                      )}
                    </div>

                    {/* Review Form - Free for everyone to write */}
                    <form onSubmit={handleReviewSubmit} className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-4">
                      <span className="block text-xs font-bold text-slate-800">Leave a Review for {selectedBusiness.name}</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                        <div className="sm:col-span-8">
                          <input
                            type="text"
                            placeholder="Your Name"
                            value={reviewAuthor}
                            onChange={(e) => setReviewAuthor(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 font-medium"
                          />
                        </div>
                        <div className="sm:col-span-4 flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">Rating:</span>
                          <div className="flex text-amber-400">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className="focus:outline-none cursor-pointer"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <textarea
                          placeholder="Share your experience..."
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 font-medium"
                        />
                      </div>

                      {reviewError && <p className="text-red-600 text-xs">{reviewError}</p>}
                      {reviewSuccess && (
                        <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                          <Check className="w-4 h-4" /> Thank you! Your review has been added successfully.
                        </p>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Submit Review
                        </button>
                      </div>
                    </form>

                    {/* Reviews List */}
                    <div className="space-y-4">
                      {selectedBusiness.reviews.length === 0 ? (
                        <p className="text-slate-400 text-xs italic text-center py-4">
                          No reviews yet. Be the first to write one!
                        </p>
                      ) : (
                        selectedBusiness.reviews.map((rev) => (
                          <div key={rev.id} className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm space-y-2">
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
                            <p className="text-slate-600 text-xs leading-relaxed">{rev.text}</p>

                            {/* Owner Reply */}
                            {rev.ownerReply && (
                              <div className="mt-3 p-3 bg-orange-50/50 rounded-xl border-l-2 border-orange-400 text-xs">
                                <p className="font-bold text-slate-800 flex items-center gap-1 mb-0.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                                  Owner Reply
                                </p>
                                <p className="text-slate-600 leading-relaxed">{rev.ownerReply}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
                  <span className="text-[10px] font-medium text-slate-400">
                    Business ID: {selectedBusiness.id}
                  </span>
                  <button
                    onClick={onCloseDetail}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Claim Listing Verification Modal Overlay */}
      <AnimatePresence>
        {claimTarget && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4" id="claim-listing-overlay-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClaimTarget(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-2xl max-w-md w-full z-10 space-y-5"
            >
              <button
                onClick={() => setClaimTarget(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
              
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl font-extrabold text-slate-900">
                  Claim "{claimTarget.name}"
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Verify ownership of this local business. Enter your contact email address below to instantly claim this listing, assign it to your email, and launch your private Owner Dashboard.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!claimEmail || !claimEmail.trim()) return;
                  await onClaimBusiness(claimTarget.id, claimEmail);
                  setClaimTarget(null);
                  setClaimEmail('');
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Your Owner Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="owner@yourcelinabusiness.com"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
                  />
                </div>

                <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1">
                  <span className="font-bold text-slate-700 block">💡 Competitive Launch Note:</span>
                  <p>
                    Claiming this listing as a <strong>Basic Member</strong> is 100% free and counts towards Celina Connection's competitive cap of <strong>the first 100 listings</strong>. Secure your lifetime free presence before spots fill!
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-orange-100 transition-all cursor-pointer"
                >
                  Verify Ownership & Claim Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {selectedMapBusiness && (
          <MapModal
            business={selectedMapBusiness}
            onClose={() => setSelectedMapBusiness(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
