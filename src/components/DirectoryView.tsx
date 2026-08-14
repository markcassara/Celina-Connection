import React, { useEffect, useRef, useState } from 'react';
import { Business, Review, Tier } from '../types';
import { CATEGORIES } from '../data/mockBusinesses';
import FeaturedCarousel from './FeaturedCarousel';
import MapModal from './MapModal';
import { countOutsideUserClaimedListings, hasRequiredListingVisuals, isNewListing } from '../lib/listingVisuals';
import { api } from '../lib/api';
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
  Send,
  X,
  Award,
  SlidersHorizontal,
  Share2,
  ThumbsUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DirectoryViewProps {
  businesses: Business[];
  onAddReview: (businessId: string, review: Omit<Review, 'id' | 'createdAt'>) => void | Promise<void>;
  onLikeBusiness: (businessId: string, liked?: boolean) => void | Promise<void>;
  onSelectBusiness: (business: Business) => void;
  selectedBusiness: Business | null;
  onCloseDetail: () => void;
  onUpgradePrompt: (tier: Tier) => void;
  onClaimBusiness: (businessId: string, email: string, details: { requesterName: string; requesterPhone: string; role: string; notes?: string }) => void | Promise<void>;
  isAiEnabled: boolean;
  serverAiAvailable: boolean;
  setActiveTab?: (tab: string) => void;
  homeMode?: boolean;
}

const INLINE_AI_AUTO_COLLAPSE_MS = 30000;

export default function DirectoryView({
  businesses,
  onAddReview,
  onLikeBusiness,
  selectedBusiness,
  onSelectBusiness,
  onCloseDetail,
  onUpgradePrompt,
  onClaimBusiness,
  isAiEnabled,
  serverAiAvailable,
  setActiveTab,
  homeMode = false,
}: DirectoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | 'new' | 'claimed' | 'unclaimed' | 'premium' | 'pro'>('all');
  const [selectedMapBusiness, setSelectedMapBusiness] = useState<Business | null>(null);

  // AI Search states
  const [aiSearchInsights, setAiSearchInsights] = useState<string | null>(null);
  const [aiMatchingIds, setAiMatchingIds] = useState<string[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [isAiFilterActive, setIsAiFilterActive] = useState(false);
  const [inlineAiMessages, setInlineAiMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; text: string }>>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask Celina AI for local recommendations, or search the directory.',
    },
  ]);
  const [isInlineAiExpanded, setIsInlineAiExpanded] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('celina_liked_businesses') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const inlineAiEndRef = useRef<HTMLDivElement>(null);
  const publicBusinesses = businesses.filter((business) => business.isUnclaimed || hasRequiredListingVisuals(business));

  const primaryListingImage = (business: Business) => (
    business.images?.find((image) => image.trim()) || business.logoUrl || ''
  );
  const listingUrl = (business: Business) => `${window.location.origin}/business/${business.slug || business.id}?ref=${encodeURIComponent(business.id)}`;

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `celina_referral_visit_${ref}_${today}`;
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, '1');
    api.trackGrowthAction(ref, 'referral-visit').catch(() => undefined);
  }, []);

  const handleShareListing = async (business: Business, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const url = listingUrl(business);
    api.trackGrowthAction(business.id, 'share-click').catch(() => undefined);
    const shareData = {
      title: `${business.name} on Celina Connection`,
      text: `Take a look at ${business.name} on Celina Connection.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiedShareId(business.id);
      window.setTimeout(() => setCopiedShareId((current) => (current === business.id ? null : current)), 2200);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedShareId(business.id);
        window.setTimeout(() => setCopiedShareId((current) => (current === business.id ? null : current)), 2200);
      } catch {
        window.prompt('Share this listing link:', url);
      }
    }
  };

  const handleLikeListing = async (business: Business, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (likingIds.has(business.id)) return;

    setLikingIds((prev) => new Set(prev).add(business.id));
    const willLike = !likedIds.has(business.id);
    try {
      await onLikeBusiness(business.id, willLike);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (willLike) {
          next.add(business.id);
        } else {
          next.delete(business.id);
        }
        try {
          localStorage.setItem('celina_liked_businesses', JSON.stringify(Array.from(next)));
        } catch {
          // ignore storage limits
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      alert('We could not update that thumbs up right now. Please try again.');
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(business.id);
        return next;
      });
    }
  };

  const renderLikeButton = (business: Business, compact = false) => {
    const liked = likedIds.has(business.id);
    const isSaving = likingIds.has(business.id);
    const count = Math.max(0, Number(business.votesCount || 0));
    return (
      <button
        id={`like-listing-btn-${business.id}`}
        onClick={(event) => handleLikeListing(business, event)}
        disabled={isSaving}
        className={`inline-flex items-center gap-1 rounded-lg border font-bold transition-colors ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-sm'
        } ${
          liked
            ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-white cursor-pointer'
            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 cursor-pointer'
        }`}
        title={liked ? 'Remove your thumbs up' : 'Give this listing a thumbs up'}
      >
        <ThumbsUp className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${liked ? 'fill-orange-500 text-orange-500' : 'text-orange-500'}`} />
        <span>{liked ? 'Liked' : 'Like'}</span>
        <span className="font-black">{count}</span>
      </button>
    );
  };

  useEffect(() => {
    if (!isInlineAiExpanded || isAiSearching) return;

    const timer = window.setTimeout(() => {
      setIsInlineAiExpanded(false);
    }, INLINE_AI_AUTO_COLLAPSE_MS);

    return () => window.clearTimeout(timer);
  }, [isInlineAiExpanded, isAiSearching, inlineAiMessages.length]);

  useEffect(() => {
    if (!isInlineAiExpanded) return;
    inlineAiEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isInlineAiExpanded, inlineAiMessages, isAiSearching]);

  const renderFormattedAiText = (text: string) => {
    const renderInline = (value: string): React.ReactNode[] => {
      const cleaned = value
        .replace(/`/g, '')
        .replace(/\[([^\]]+)\]\{([^}]+)\}/g, '[$1]($2)');
      const nodes: React.ReactNode[] = [];
      const tokenPattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = tokenPattern.exec(cleaned))) {
        if (match.index > lastIndex) nodes.push(cleaned.slice(lastIndex, match.index));

        const boldText = match[2];
        const linkText = match[3];
        const href = match[4];

        if (boldText) {
          nodes.push(<strong key={`strong-${match.index}`} className="font-black text-white">{renderInline(boldText)}</strong>);
        } else if (linkText) {
          const safeHref = href?.trim();
          const isRealLink = /^https?:\/\/\S+\.\S+$/i.test(safeHref || '');
          nodes.push(
            isRealLink ? (
              <a
                key={`link-${match.index}`}
                href={safeHref}
                target="_blank"
                rel="noreferrer"
                className="font-black text-white underline decoration-orange-300/70 underline-offset-2 hover:text-orange-100"
              >
                {linkText}
              </a>
            ) : (
              <strong key={`link-label-${match.index}`} className="font-black text-white">{linkText}</strong>
            )
          );
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < cleaned.length) nodes.push(cleaned.slice(lastIndex));
      return nodes;
    };

    const lines = text
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return <p>{renderInline(lines[0] || text)}</p>;
    }

    return (
      <div className="space-y-2.5 leading-relaxed">
        {lines.map((line, index) => {
          const heading = line.match(/^#{1,6}\s+(.+)/);
          const bullet = line.match(/^[-*•]\s+(.+)/);
          const numbered = line.match(/^(\d+)[.)]\s+(.+)/);
          const copy = heading?.[1] || bullet?.[1] || numbered?.[2] || line;
          const isIntroBullet = index === 0 && Boolean(bullet) && /^(howdy|hi|hey|hello|sure|absolutely)\b/i.test(copy);

          if (heading || (!bullet && !numbered && copy.endsWith(':') && copy.length < 90)) {
            return <p key={index} className="pt-1 text-[12px] font-black tracking-wide text-white">{renderInline(copy.replace(/:$/, ''))}</p>;
          }

          if (numbered && !isIntroBullet) {
            return (
              <div key={index} className="flex gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-400 text-[11px] font-black text-[var(--cc-deep-navy)] shadow-sm shadow-orange-950/20">
                  {numbered[1]}
                </span>
                <p className="min-w-0">{renderInline(copy)}</p>
              </div>
            );
          }

          if (bullet && !isIntroBullet) {
            return (
              <p key={index} className="flex gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-300 flex-shrink-0" />
                <span>{renderInline(copy)}</span>
              </p>
            );
          }

          return <p key={index}>{renderInline(copy)}</p>;
        })}
      </div>
    );
  };

  // Claim Listing states
  const [claimTarget, setClaimTarget] = useState<Business | null>(null);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimRole, setClaimRole] = useState('Owner');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const claimedListingCount = publicBusinesses.filter(b => b.ownerId && !b.isUnclaimed).length;
  const newListingCount = publicBusinesses.filter((b) => isNewListing(b)).length;
  const claimedBasicCount = countOutsideUserClaimedListings(businesses);

  // Review Form state
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const handleAiSearch = async () => {
    const query = searchTerm.trim();
    if (!query || isAiSearching) {
      if (!query) alert("Please enter a search phrase to get AI search insights.");
      return;
    }

    const userMessage = { id: `user-${Date.now()}`, role: 'user' as const, text: query };
    const chatMessages = [...inlineAiMessages, userMessage].slice(-8);
    setIsInlineAiExpanded(true);
    setInlineAiMessages((prev) => [...prev, userMessage]);
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
        hours: b.hours,
        phone: b.phone,
        website: b.website,
        tier: b.tier,
        rating: b.reviews.length
          ? (b.reviews.reduce((acc, r) => acc + r.rating, 0) / b.reviews.length).toFixed(1)
          : "No reviews yet",
      }));

      const [searchRes, chatRes] = await Promise.all([
        fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, businesses: minimizedBusinesses })
        }),
        fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatMessages.map((msg) => ({ role: msg.role, text: msg.text })),
            businesses: minimizedBusinesses,
          })
        })
      ]);

      if (!searchRes.ok || !chatRes.ok) {
        throw new Error("Celina AI could not find recommendations right now.");
      }

      const searchData = await searchRes.json();
      const chatData = await chatRes.json();
      const responseText = chatData.text || searchData.insights || "I found matching Celina listings, but couldn't generate a detailed response.";

      setAiSearchInsights(responseText);
      setAiMatchingIds(searchData.matchingIds || []);
      setIsAiFilterActive(true);
      setInlineAiMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: responseText },
      ]);
    } catch (err: any) {
      console.error(err);
      setAiSearchError("Celina AI is taking a short break. Regular directory search is still ready.");
      setInlineAiMessages((prev) => [
        ...prev,
        { id: `assistant-error-${Date.now()}`, role: 'assistant', text: "I couldn't reach Celina AI just now. You can still use the regular directory search while we retry." },
      ]);
    } finally {
      setIsAiSearching(false);
    }
  };

  const createdAtTime = (business: Business) => {
    const timestamp = new Date(business.createdAt || '').getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const reviewScore = (business: Business) => {
    const avgRating = business.reviews.length
      ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length
      : 0;
    return avgRating * 10 + business.reviews.length * 3;
  };

  const tierWeight = (business: Business) => {
    if (business.tier === 'premium') return 3;
    if (business.tier === 'pro') return 2;
    if (business.tier === 'basic') return 1;
    return 0;
  };

  const compareDirectoryBusinesses = (a: Business, b: Business) => {
    const aIsNew = isNewListing(a);
    const bIsNew = isNewListing(b);
    if (aIsNew !== bIsNew) return aIsNew ? -1 : 1; // NEW listings are promoted to the top first
    if (a.isUnclaimed !== b.isUnclaimed) return a.isUnclaimed ? 1 : -1; // then unclaimed profiles sink to the bottom
    const tierDifference = tierWeight(b) - tierWeight(a);
    if (tierDifference !== 0) return tierDifference;
    const dateDifference = createdAtTime(b) - createdAtTime(a);
    if (dateDifference !== 0) return dateDifference;
    const scoreDifference = reviewScore(b) - reviewScore(a);
    if (scoreDifference !== 0) return scoreDifference;
    return a.name.localeCompare(b.name);
  };

  const quickFilters: Array<{ id: typeof selectedTierFilter; label: string; count: number }> = [
    { id: 'all', label: 'All listings', count: publicBusinesses.length },
    { id: 'new', label: 'New verified', count: newListingCount },
    { id: 'claimed', label: 'Claimed', count: claimedListingCount },
    { id: 'premium', label: 'Premium', count: publicBusinesses.filter((b) => b.tier === 'premium' && !b.isUnclaimed).length },
    { id: 'pro', label: 'Pro', count: publicBusinesses.filter((b) => b.tier === 'pro' && !b.isUnclaimed).length },
    { id: 'unclaimed', label: 'Unclaimed', count: publicBusinesses.filter((b) => b.isUnclaimed).length },
  ];

  // Filter businesses
  const filteredBusinesses = publicBusinesses.filter((b) => {
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
      (selectedTierFilter === 'new' && isNewListing(b)) ||
      (selectedTierFilter === 'claimed' && !b.isUnclaimed && Boolean(b.ownerId)) ||
      (selectedTierFilter === 'unclaimed' && b.isUnclaimed) ||
      (selectedTierFilter === 'premium' && b.tier === 'premium' && !b.isUnclaimed) ||
      (selectedTierFilter === 'pro' && b.tier === 'pro' && !b.isUnclaimed);

    const matchesFilters = matchesCategory && matchesTier;
    if (!matchesFilters) return false;

    return true;
  });
  const orderedFilteredBusinesses = [...filteredBusinesses].sort(compareDirectoryBusinesses);
  // New listings (claimed OR unclaimed) are promoted into the main directory grid and sorted to the
  // top by compareDirectoryBusinesses. Only non-new unclaimed profiles remain in the bottom registry.
  const filteredClaimedBusinesses = orderedFilteredBusinesses.filter((business) => !business.isUnclaimed || isNewListing(business));
  const filteredUnclaimedBusinesses = orderedFilteredBusinesses.filter((business) => business.isUnclaimed && !isNewListing(business));

  const getTierBadge = (tier: Tier) => {
    switch (tier) {
      case 'premium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-[var(--cc-deep-navy)] shadow-sm uppercase tracking-wide border border-amber-400">
            <Star className="w-2.5 h-2.5 fill-[var(--cc-deep-navy)]" /> Premium Partner
          </span>
        );
      case 'pro':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wide border border-orange-200">
            Pro Partner
          </span>
        );
      case 'basic':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">
            Basic Partner
          </span>
      );
      case 'free':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide border border-emerald-200">
            Free Listing
          </span>
      );
    }
  };

  const getNewListingBadge = (business: Business) => (
    isNewListing(business) ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-orange-500 text-white uppercase tracking-wide shadow-sm">
        <Sparkles className="w-2.5 h-2.5" /> New
      </span>
    ) : null
  );

  const removalRequestMailto = (business: Business) => {
    const subject = `Request to remove listing: ${business.name}`;
    const body = [
      `Please review this request to remove ${business.name} from Celina Connection.`,
      '',
      `Listing email: ${business.email}`,
      `Listing phone: ${business.phone}`,
      '',
      'Business owner/authorized contact name:',
      'Reason for removal:',
    ].join('\n');

    return `mailto:info@celinaconnection.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
            <p className="font-display font-extrabold text-[var(--cc-deep-navy)] text-sm">🔥 Celina Connection Competitive Launch</p>
            <p className="text-slate-500 font-medium text-[11px] mt-0.5 leading-relaxed">
              FREE listing slots are strictly capped for the first 100 businesses. Claim your local business profile today to secure a lifetime free listing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start flex-shrink-0">
          <div className="bg-white border border-orange-200/80 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <span className="text-orange-700 font-black text-sm tracking-tight">{claimedBasicCount}/100</span>
            <span className="text-slate-600 font-semibold text-[9px] uppercase tracking-wider">Listings Claimed</span>
          </div>
          {claimedBasicCount >= 100 ? (
            <span className="text-red-600 text-xs font-bold bg-red-50 border border-red-200 px-3 py-2 rounded-xl">ALL FREE SLOTS CLAIMED</span>
          ) : (
            <button
              onClick={() => setActiveTab?.('dashboard')}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-[var(--cc-deep-navy)] font-bold text-xs rounded-xl hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer shadow-sm shadow-orange-100"
            >
              Claim Your Free Spot
            </button>
          )}
        </div>
      </div>

      {/* Featured Businesses Spotlight (Home Page Only) */}
      {homeMode && publicBusinesses.some((b) => b.tier === 'premium') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[var(--cc-deep-navy)] flex items-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Featured Partners Spotlight
            </h2>
          </div>
          <FeaturedCarousel businesses={publicBusinesses} onSelectBusiness={onSelectBusiness} />
        </div>
      )}

      {/* Search and Hero Area */}
      <div className={`${isInlineAiExpanded ? 'min-h-[410px]' : ''} relative rounded-3xl overflow-hidden bg-gradient-to-br from-[var(--cc-deep-navy)] via-[#1b4a78] to-[#143a63] text-white p-5 sm:p-7 md:p-9 shadow-md flex`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 w-full flex flex-col space-y-4">
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

          {/* Hero Quick Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold text-slate-300"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-amber-300 text-[11px] font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> 15+ Verified Businesses
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-200 text-[11px] font-bold">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> 100% Celina Local
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-orange-200 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-orange-300" /> AI Powered Search
            </div>
          </motion.div>

          {/* Blended Search + AI Chat Bar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`${isInlineAiExpanded ? 'min-h-[220px] flex-1' : 'flex-none'} w-full pt-2 sm:pt-3 flex transition-all duration-300`}
          >
            <div
              id="directory-inline-ai-chat"
              className={`${isInlineAiExpanded ? 'min-h-full' : ''} w-full flex flex-col overflow-hidden rounded-[1.65rem] bg-white/10 text-white ring-1 ring-white/10 backdrop-blur-md`}
            >
              {isAiEnabled && isInlineAiExpanded && (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 space-y-2 bg-transparent">
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-orange-200/90">
                    <span>Celina AI</span>
                    <button
                      type="button"
                      onClick={() => setIsInlineAiExpanded(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                      aria-label="Close Celina AI chat"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {inlineAiMessages.map((msg) => {
                    const isAi = msg.role === 'assistant';
                    const isWelcome = msg.id === 'welcome';

                    if (isWelcome) {
                      return (
                        <div key={msg.id} className="flex items-center gap-2 px-1.5 py-0.5 text-[11px] font-medium leading-relaxed text-slate-300">
                          <Sparkles className="h-3.5 w-3.5 text-orange-300 flex-shrink-0" />
                          <span>{msg.text}</span>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                        <div className={`flex items-start gap-2 max-w-[92%] ${isAi ? '' : 'flex-row-reverse'}`}>
                          <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAi ? 'bg-white/10 text-orange-200' : 'bg-orange-500 text-white'}`}>
                            {isAi ? <Sparkles className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          </div>
                          <div className={`rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed ${
                            isAi
                              ? 'bg-white/10 text-slate-100 rounded-tl-md'
                              : 'bg-orange-500 text-white rounded-tr-md shadow-sm shadow-orange-950/20'
                          }`}>
                            {isAi ? renderFormattedAiText(msg.text) : <p>{msg.text}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isAiSearching && (
                    <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold text-orange-200">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-bounce" />
                      </div>
                      Celina AI is checking local listings...
                    </div>
                  )}
                  <div ref={inlineAiEndRef} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white/10 border-t border-white/10">
                <div className="relative flex-grow">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-200" />
                  <input
                    type="text"
                    id="search-input"
                    placeholder={isAiEnabled ? "Ask Celina AI or search the directory..." : "Search dining, boutique shops, home services..."}
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
                    className="w-full pl-11 pr-4 py-3.5 bg-white/90 text-[var(--cc-deep-navy)] rounded-[1.35rem] font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm border border-white/20"
                  />
                </div>
                <div className="flex gap-2">
                  {isAiFilterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAiFilterActive(false);
                        setAiSearchInsights(null);
                        setAiMatchingIds(null);
                      }}
                      className="px-3 py-3.5 bg-white/15 hover:bg-white/25 text-[10px] font-bold text-white rounded-[1.35rem] cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                  {isAiEnabled && (
                    <button
                      type="button"
                      id="ai-search-insights-btn"
                      onClick={handleAiSearch}
                      disabled={isAiSearching || !searchTerm.trim()}
                      className={`px-4 py-3.5 rounded-[1.35rem] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ${
                        searchTerm.trim() && !isAiSearching
                          ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-sm shadow-orange-950/20'
                          : 'bg-white/15 text-slate-300 cursor-not-allowed shadow-none'
                      }`}
                      title="Ask Celina AI and filter matching listings"
                    >
                      <Send className={`w-3.5 h-3.5 ${isAiSearching ? 'animate-pulse' : ''}`} />
                      <span>{isAiSearching ? 'Thinking...' : 'Ask'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Trending Quick Search Chips */}
              <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5 pt-1 text-[11px] border-t border-white/5">
                <span className="text-slate-300 font-bold tracking-wide uppercase text-[9px] mr-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" /> Trending:
                </span>
                {[
                  "Lucy's Steak",
                  "Celina Bistro",
                  "Chiropractor",
                  "Boutiques",
                  "Lawn Care",
                  "Coffee"
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSearchTerm(chip);
                      setIsAiFilterActive(false);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-medium transition-all border border-white/10 cursor-pointer text-[10px]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {searchTerm.trim() && (
        <div className="rounded-2xl bg-gradient-to-r from-[var(--cc-deep-navy)] via-[#1b4a78] to-[var(--cc-deep-navy)] border border-slate-700 p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200" id="search-claim-assistant-banner">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Search & Claim Assistant</p>
              <p className="text-sm font-bold text-white">
                Searching for <span className="text-amber-300">"{searchTerm}"</span> in Celina Directory
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {filteredBusinesses.filter(b => b.isUnclaimed).length > 0
                  ? `${filteredBusinesses.filter(b => b.isUnclaimed).length} unclaimed listing(s) matched. Click "Claim Now" on any card to activate instant owner access.`
                  : filteredBusinesses.length > 0
                  ? 'Matching businesses found! Click "Claim Now" or create a new listing if yours is missing.'
                  : `No exact match found for "${searchTerm}". You can create your instant business listing in under 30 seconds!`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (setActiveTab) setActiveTab('dashboard');
              else window.location.hash = 'dashboard-profile';
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[var(--cc-deep-navy)] font-black text-xs shadow-md hover:from-amber-300 hover:to-orange-400 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Listing for "{searchTerm}"</span>
          </button>
        </div>
      )}

      {/* Directory Filters or Home Page Community Sectors */}
      {!homeMode ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-4 shadow-sm" id="directory-filters">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="hidden sm:flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm font-black text-[var(--cc-deep-navy)]">Filter directory</h3>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                aria-label="Filter by category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition-colors focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 sm:w-64"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat === 'All' ? 'All categories' : cat}</option>
                ))}
              </select>

              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0" aria-label="Filter by listing status">
                {quickFilters.map((filter) => {
                  const isSelected = selectedTierFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSelectedTierFilter(filter.id)}
                      className={`inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--cc-deep-navy)] text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-orange-200 hover:text-orange-700'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${isSelected ? 'bg-white/15 text-orange-200' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(selectedCategory !== 'All' || selectedTierFilter !== 'all' || isAiFilterActive) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedTierFilter('all');
                    setIsAiFilterActive(false);
                    setAiSearchInsights(null);
                    setAiMatchingIds(null);
                  }}
                  className="h-10 flex-shrink-0 rounded-xl bg-white border border-slate-200 px-3 text-xs font-black text-slate-700 hover:border-orange-200 hover:text-orange-700 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            {selectedCategory === 'All' ? 'All categories' : selectedCategory}
            {selectedTierFilter !== 'all' ? ` · ${quickFilters.find((filter) => filter.id === selectedTierFilter)?.label}` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-4" id="home-community-sectors">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Celina Community Hub</span>
              <h3 className="font-display text-xl sm:text-2xl font-black text-[var(--cc-deep-navy)] tracking-tight">Browse by Category & Local Sectors</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab?.('directory')}
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              View Full Directory <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Historic Square & Dining',
                category: 'Dining',
                icon: '🍽️',
                tag: 'Popular',
                desc: 'Comfort dining, artisan cafes, craft taprooms, and local shops on Celina Square.',
                count: publicBusinesses.filter(b => b.category === 'Dining').length,
              },
              {
                title: 'Professional & Financial',
                category: 'Professional Services',
                icon: '💼',
                tag: 'Essential',
                desc: 'Legal advisors, wealth planning, real estate brokers, and insurance specialists.',
                count: publicBusinesses.filter(b => b.category === 'Professional Services' || b.category === 'Financial Services' || b.category === 'Real Estate').length,
              },
              {
                title: 'Health & Family Care',
                category: 'Health & Wellness',
                icon: '🩺',
                tag: 'Wellness',
                desc: 'Family practice, dental care, fitness centers, and neighborhood wellness.',
                count: publicBusinesses.filter(b => b.category === 'Health & Wellness').length,
              },
              {
                title: 'Home & Property Trades',
                category: 'Home Services',
                icon: '🏡',
                tag: 'Trusted',
                desc: 'Lawn maintenance, HVAC contractors, roofing, remodeling, and electrical.',
                count: publicBusinesses.filter(b => b.category === 'Home Services' || b.category === 'Home & Garden').length,
              },
            ].map((sector) => (
              <button
                key={sector.title}
                type="button"
                onClick={() => {
                  setSelectedCategory(sector.category);
                  if (setActiveTab) setActiveTab('directory');
                }}
                className="group relative rounded-2xl bg-white border border-slate-200/80 p-5 text-left transition-all hover:border-orange-300 hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{sector.icon}</span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                      {sector.tag}
                    </span>
                  </div>
                  <h4 className="font-display font-black text-[var(--cc-deep-navy)] text-sm group-hover:text-orange-600 transition-colors">
                    {sector.title}
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {sector.desc}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-bold">
                  <span>{sector.count} Local Listings</span>
                  <ChevronRight className="w-4 h-4 text-orange-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {homeMode ? (
        <div id="home-platform-story" className="space-y-8">
          <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-0">
              <div className="p-6 sm:p-8 lg:p-10 space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cc-deep-navy)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">
                  <Sparkles className="h-3.5 w-3.5" /> Local discovery, cleaned up
                </span>
                <div className="space-y-3">
                  <h3 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-[var(--cc-deep-navy)] leading-tight">
                    A more useful front door for Celina than another endless list.
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-600 max-w-2xl">
                    Celina Connection helps residents find trusted local spots quickly, while giving business owners a polished profile they can actually use to get discovered.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 pt-2">
                  {[
                    ['Discover', 'Restaurants, shops, services, and local favorites.'],
                    ['Compare', 'Reviews, hours, photos, locations, and contact details.'],
                    ['Support', 'Keep local dollars moving through Celina businesses.'],
                  ].map(([title, copy]) => (
                    <div key={title} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <p className="text-xs font-black uppercase tracking-wider text-orange-700">{title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{copy}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab?.('directory')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--cc-deep-navy)] px-5 py-3 text-sm font-black text-white shadow-md transition-colors hover:bg-orange-600"
                  >
                    Browse the full directory <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab?.('dashboard')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition-colors hover:border-orange-200 hover:bg-orange-50"
                  >
                    Claim your listing
                  </button>
                </div>
              </div>
              <div className="bg-gradient-to-br from-[var(--cc-deep-navy)] via-[#143a63] to-[#143a63] p-6 sm:p-8 lg:p-10 text-white flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-200">For business owners</p>
                  <h4 className="font-display text-2xl font-black tracking-tight">Your listing should work harder than a Facebook post.</h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Claim the profile, keep the details current, add trust signals, and upgrade visibility when you want more placement.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    'Lifetime free launch listing while early slots remain',
                    'Premium placement paths for serious local visibility',
                    'AI-powered search that recommends businesses by intent',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-300" />
                      <span className="text-xs font-semibold leading-relaxed text-slate-100">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4" id="home-info-sections">
            {[
              {
                icon: <MapPin className="h-5 w-5" />,
                title: 'Find what is nearby',
                copy: 'Use category browsing, AI search, and maps to move from “what should we do?” to a local answer fast.',
              },
              {
                icon: <ShieldCheck className="h-5 w-5" />,
                title: 'Built for trust',
                copy: 'Verified owner access, claim requests, reviews, and clean profiles make the directory feel curated instead of random.',
              },
              {
                icon: <Star className="h-5 w-5" />,
                title: 'Made for visibility',
                copy: 'Featured partners and upgraded profiles create a monetization path without cluttering the front page with every listing.',
              },
            ].map((section) => (
              <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                  {section.icon}
                </div>
                <h3 className="font-display text-lg font-black text-[var(--cc-deep-navy)]">{section.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{section.copy}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Primary Directory List Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <p className="text-sm font-medium text-slate-500">
                Showing <span className="font-bold text-[var(--cc-deep-navy)]">{filteredBusinesses.length}</span>{' '}
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
              (() => {
                const top3Premium = filteredClaimedBusinesses.filter((b) => b.tier === 'premium').slice(0, 3);
                const top3Ids = new Set(top3Premium.map((b) => b.id));
                const sortedRemaining = filteredClaimedBusinesses.filter((b) => !top3Ids.has(b.id));

                return (
                  <div className="space-y-8">
                    {/* Top 3 Premium Map Pack Spotlight */}
                    {top3Premium.length > 0 && (
                      <div className="space-y-3" id="top-3-premium-pack">
                        <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-[var(--cc-deep-navy)] uppercase tracking-wider shadow-sm">
                              <Star className="w-3 h-3 fill-[var(--cc-deep-navy)]" /> Top 3 Premium Spotlight
                            </span>
                            <h3 className="font-display text-base font-black text-[var(--cc-deep-navy)]">Featured Premium Partners</h3>
                          </div>
                          <span className="text-xs text-slate-500 font-medium hidden sm:inline">Reserved for Premium accounts</span>
                        </div>

                        <div className={`grid grid-cols-1 gap-4 ${
                          top3Premium.length === 1 ? 'md:grid-cols-1' : top3Premium.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
                        }`}>
                          {top3Premium.map((b) => {
                            const ratingSum = b.reviews.reduce((sum, r) => sum + r.rating, 0);
                            const avgRating = b.reviews.length ? (ratingSum / b.reviews.length).toFixed(1) : null;
                            const bannerImage = primaryListingImage(b);

                            return (
                              <motion.div
                                key={b.id}
                                layout
                                onClick={() => onSelectBusiness(b)}
                                id={`business-card-${b.id}`}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border-2 border-amber-300 ring-2 ring-amber-400/30 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer p-4 space-y-3"
                                whileHover={{ y: -3 }}
                              >
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                                      {b.category}
                                    </span>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                      {getNewListingBadge(b)}
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-400 text-[var(--cc-deep-navy)] uppercase tracking-wide">
                                        <Star className="w-2.5 h-2.5 fill-[var(--cc-deep-navy)]" /> PREMIUM
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-3">
                                    {b.logoUrl && (
                                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                                        <img
                                          src={b.logoUrl}
                                          alt={`${b.name} profile image`}
                                          referrerPolicy="no-referrer"
                                          className="h-full w-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <h4 className="font-display font-black text-[var(--cc-deep-navy)] text-base group-hover:text-orange-600 transition-colors leading-snug truncate">
                                        {b.name}
                                      </h4>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <div className="flex text-amber-400">
                                          {[...Array(5)].map((_, i) => (
                                            <Star
                                              key={i}
                                              className={`w-3 h-3 ${
                                                avgRating && i < Math.floor(Number(avgRating))
                                                  ? 'fill-amber-400'
                                                  : 'text-slate-200'
                                              }`}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-xs font-bold text-slate-800">{avgRating || '5.0'}</span>
                                        <span className="text-[10px] text-slate-500">({b.reviews.length} reviews)</span>
                                      </div>
                                    </div>
                                  </div>

                                  {bannerImage && (
                                    <div className="h-28 w-full rounded-xl overflow-hidden relative">
                                      <img
                                        src={bannerImage}
                                        alt={`${b.name} banner image`}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      />
                                    </div>
                                  )}

                                  <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">
                                    {b.description}
                                  </p>

                                  <div className="space-y-1 text-slate-500 text-xs pt-1">
                                    {b.address && (
                                      <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                        <span className="truncate">{b.address}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span>{b.phone}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                                  <span className="text-orange-600 group-hover:underline flex items-center gap-0.5">
                                    View Profile <ChevronRight className="w-3 h-3" />
                                  </span>
                                  <div className="flex items-center gap-3">
                                    {renderLikeButton(b, true)}
                                    <button
                                      id={`share-listing-btn-${b.id}`}
                                      onClick={(e) => handleShareListing(b, e)}
                                      className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                                      title="Share this listing"
                                    >
                                      <Share2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                      <span>{copiedShareId === b.id ? 'Copied' : 'Share'}</span>
                                    </button>
                                    <button
                                      id={`show-map-btn-${b.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMapBusiness(b);
                                      }}
                                      className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                      <span>Show on Map</span>
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Under the Top 3: Claimed Listings with New Listings First */}
                    {sortedRemaining.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div>
                            <h3 className="font-display font-black text-[var(--cc-deep-navy)] text-sm sm:text-base flex items-center gap-2">
                              <Award className="w-4 h-4 text-orange-500" />
                              Celina Community Listings
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{sortedRemaining.length} listings</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5" id="directory-grid">
                          {sortedRemaining.map((b) => {
                            const isPremium = b.tier === 'premium';
                            const isPro = b.tier === 'pro';
                            const isBasic = b.tier === 'basic';
                            const canShowWebsiteHours = isBasic || isPro || isPremium;
                            const ratingSum = b.reviews.reduce((sum, r) => sum + r.rating, 0);
                            const avgRating = b.reviews.length ? (ratingSum / b.reviews.length).toFixed(1) : null;
                            const cardImage = primaryListingImage(b);

                            return (
                              <motion.div
                                key={b.id}
                                layout
                                onClick={() => onSelectBusiness(b)}
                                id={`business-card-${b.id}`}
                                className={`group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white border border-slate-200/90 ${isNewListing(b) ? 'ring-2 ring-orange-200' : ''} hover:border-orange-300 hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 space-y-2.5`}
                                whileHover={{ y: -2 }}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      {b.category}
                                    </span>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                      {getNewListingBadge(b)}
                                      {b.isUnclaimed ? (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black bg-rose-900 text-white uppercase tracking-wide">
                                          ⚠️ Unclaimed
                                        </span>
                                      ) : (
                                        getTierBadge(b.tier)
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2.5">
                                    {b.logoUrl && (
                                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <img
                                          src={b.logoUrl}
                                          alt={`${b.name} profile image`}
                                          referrerPolicy="no-referrer"
                                          className="h-full w-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <h4 className="font-display font-bold text-[var(--cc-deep-navy)] group-hover:text-orange-600 transition-colors text-sm leading-snug truncate">
                                        {b.name}
                                      </h4>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {avgRating ? (
                                          <>
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
                                            <span className="text-xs font-extrabold text-slate-800">{avgRating}</span>
                                            <span className="text-[10px] text-slate-500 font-medium">({b.reviews.length} {b.reviews.length === 1 ? 'review' : 'reviews'})</span>
                                          </>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                            <Star className="w-3 h-3 text-slate-300" /> No reviews yet
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {cardImage && (
                                    <div className="h-24 w-full overflow-hidden rounded-lg bg-slate-100 border border-slate-100">
                                      <img
                                        src={cardImage}
                                        alt={`${b.name} banner image`}
                                        referrerPolicy="no-referrer"
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      />
                                    </div>
                                  )}

                                  <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">
                                    {b.description}
                                  </p>

                                  <div className="space-y-1 text-slate-500 text-[11px]">
                                    {b.address && (
                                      <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="truncate">{b.address}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <span>{b.phone}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                                  <div className="flex items-center justify-between gap-2">
                                    {b.isUnclaimed ? (
                                      <button
                                        id={`claim-now-btn-${b.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setClaimTarget(b);
                                        }}
                                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[var(--cc-deep-navy)] font-black text-xs shadow-sm hover:from-amber-300 hover:to-orange-400 transition-all cursor-pointer flex items-center gap-1"
                                      >
                                        <Sparkles className="w-3 h-3 fill-[var(--cc-deep-navy)]" />
                                        <span>Claim Now</span>
                                      </button>
                                    ) : (
                                      <span className="text-orange-600 group-hover:underline text-[11px]">
                                        View Profile &gt;
                                      </span>
                                    )}

                                    <div className="flex items-center gap-2.5">
                                      {renderLikeButton(b, true)}
                                      <button
                                        id={`share-listing-btn-${b.id}`}
                                        onClick={(e) => handleShareListing(b, e)}
                                        className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer text-[11px] font-bold"
                                        title="Share this listing"
                                      >
                                        <Share2 className="w-3 h-3 text-orange-500 flex-shrink-0" />
                                        <span>{copiedShareId === b.id ? 'Copied' : 'Share'}</span>
                                      </button>
                                      <button
                                        id={`show-map-btn-${b.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedMapBusiness(b);
                                        }}
                                        className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer text-[11px] font-bold"
                                        title="Show location on map"
                                      >
                                        <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                                        <span>Map</span>
                                      </button>
                                    </div>
                                  </div>

                                  {b.isUnclaimed && (
                                    <div className="pt-1 border-t border-slate-100/70 flex items-center justify-between">
                                      <a
                                        href={removalRequestMailto(b)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline font-semibold flex items-center gap-1"
                                      >
                                        <Mail className="w-3 h-3" /> Request to remove this listing
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>

          {/* Community Registry Entries (Unclaimed Profiles) */}
          {filteredUnclaimedBusinesses.length > 0 && (
            <div id="unclaimed-listings-registry" className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-sm mt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-display text-base font-extrabold text-[var(--cc-deep-navy)] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                    Unclaimed Community Listings
                  </h3>
                </div>
                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">
                  {filteredUnclaimedBusinesses.length} unclaimed
                </span>
              </div>
    
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredUnclaimedBusinesses
                  .map((b) => (
                    <div
                      key={b.id}
                      onClick={() => onSelectBusiness(b)}
                      className="group flex flex-col gap-3 p-3 bg-white/80 border border-slate-200 hover:border-orange-300 rounded-xl transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 text-xs truncate pr-2 group-hover:text-orange-600 transition-colors">
                          {b.name}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black bg-slate-50 px-1.5 py-0.5 rounded">
                          {b.category}
                        </span>
                      </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {b.description}
                        </p>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClaimTarget(b);
                          }}
                          className="text-orange-600 font-black hover:underline"
                        >
                          Claim this listing
                        </button>
                        <button
                          onClick={(e) => handleShareListing(b, e)}
                          className="text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                          title="Share this listing"
                        >
                          <Share2 className="w-3 h-3 text-orange-500" />
                          <span>{copiedShareId === b.id ? 'Copied' : 'Share'}</span>
                        </button>
                        {renderLikeButton(b, true)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Independent Disclaimer */}
      {!homeMode && (
        <div className="mt-10 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 leading-relaxed">
          <strong>Disclaimer:</strong> Celina Connection is an independent local business directory compiled from public community records and user submissions. Business names, logos, and trademarks belong to their respective owners. Unclaimed listings do not imply endorsement or official affiliation. Business owners may claim or request removal of their listing at any time.
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
              className="fixed inset-0 bg-[rgba(15,45,77,0.62)] backdrop-blur-sm"
            />

            {/* Modal Body Container */}
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
              >
                {/* Header Banner Image */}
                <div className="relative h-44 sm:h-56 bg-slate-100 flex-shrink-0">
                  <button
                    onClick={onCloseDetail}
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(15,45,77,0.42)] hover:bg-[rgba(15,45,77,0.62)] text-white backdrop-blur-sm transition-colors cursor-pointer"
                  >
                    &times;
                  </button>

                  {primaryListingImage(selectedBusiness) ? (
                    <img
                      src={primaryListingImage(selectedBusiness)}
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
                    {getNewListingBadge(selectedBusiness)}
                  </div>
                </div>

                {/* Main Content Area (Scrollable) */}
                <div className="flex-grow overflow-y-auto p-6 sm:p-8 space-y-6">
                  {selectedBusiness.isUnclaimed && (
                    <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-sm mb-2 bg-rose-50 border border-rose-100 text-rose-900 animate-pulse" id="unclaimed-detail-warning">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                        <div>
	                          <p className="font-extrabold">Unclaimed Business Listing</p>
	                          <p className="font-medium mt-1 leading-relaxed text-rose-700">
	                            Own or manage this business? Claim the listing to update details, add photos, reply to reviews, and see helpful performance insights.
	                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 self-start sm:self-center flex-shrink-0">
                        <button
                          onClick={() => setClaimTarget(selectedBusiness)}
                          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-[var(--cc-deep-navy)] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:from-orange-600 hover:to-amber-600 transition-colors cursor-pointer"
                        >
                          Claim this listing
                        </button>
                        <a
                          href={removalRequestMailto(selectedBusiness)}
                          className="text-[10px] text-rose-700 hover:text-rose-900 hover:underline font-bold flex items-center gap-1 justify-center"
                        >
                          <Mail className="w-3 h-3" /> Request to remove this listing
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Identity Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-start gap-3">
                      {selectedBusiness.logoUrl && (
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <img
                            src={selectedBusiness.logoUrl}
                            alt={`${selectedBusiness.name} profile image`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--cc-deep-navy)] tracking-tight">
                          {selectedBusiness.name}
                        </h3>
                        <p className="text-sm font-semibold text-orange-600 mt-1">
                          {selectedBusiness.category}
                        </p>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {renderLikeButton(selectedBusiness)}
                      <button
                        onClick={(event) => handleShareListing(selectedBusiness, event)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-bold"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{copiedShareId === selectedBusiness.id ? 'Copied' : 'Share'}</span>
                      </button>
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
                      {(selectedBusiness.tier === 'basic' || selectedBusiness.tier === 'pro' || selectedBusiness.tier === 'premium') && selectedBusiness.website ? (
                        <a
                          href={selectedBusiness.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold"
                        >
                          <Globe className="w-4 h-4 text-slate-500" />
                          <span>Website</span>
                        </a>
                      ) : null}
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
                          {selectedBusiness.address ? (
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
                                <span>Celina, TX</span>
                                <span className="text-[10px] text-slate-500 mt-0.5">
                                  No street address added yet
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

                      {/* Hours of Operation */}
                      <div className="space-y-2.5 border-t border-slate-200/60 pt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Hours
                          </h4>

                        </div>

                        {(selectedBusiness.tier === 'basic' || selectedBusiness.tier === 'pro' || selectedBusiness.tier === 'premium') && selectedBusiness.hours ? (
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
                            Hours have not been added yet.
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
                      <h4 className="text-sm font-bold text-[var(--cc-deep-navy)] flex items-center gap-1.5">
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
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-[var(--cc-deep-navy)] font-medium"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-[var(--cc-deep-navy)] font-medium"
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
                          className="px-4 py-2 bg-[var(--cc-deep-navy)] hover:bg-[#143a63] text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
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
	                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center flex-shrink-0">
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
              className="fixed inset-0 bg-[rgba(15,45,77,0.62)] backdrop-blur-sm"
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
                <h3 className="font-display text-xl font-extrabold text-[var(--cc-deep-navy)]">
                  Claim "{claimTarget.name}"
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
	                  Tell us a little about your connection to this business. Our team will review it and help you get access.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!claimTarget) return;
                  if (!claimName || !claimEmail || !claimPhone || !claimRole) {
                    setClaimError('Please fill out name, email, phone, and role.');
                    return;
                  }
                  setClaimSubmitting(true);
                  setClaimError('');
                  try {
                    await onClaimBusiness(claimTarget.id, claimEmail, {
                      requesterName: claimName,
                      requesterPhone: claimPhone,
                      role: claimRole,
                      notes: claimNotes,
                    });
                    setClaimTarget(null);
                    setClaimEmail('');
                    setClaimName('');
                    setClaimPhone('');
                    setClaimRole('Owner');
                    setClaimNotes('');
                  } catch (error) {
                    setClaimError(error instanceof Error ? error.message : 'We could not send your claim request right now. Please try again.');
                  } finally {
                    setClaimSubmitting(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Owner"
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[var(--cc-deep-navy)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Role</label>
                    <input
                      type="text"
                      required
                      placeholder="Owner / Manager"
                      value={claimRole}
                      onChange={(e) => setClaimRole(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[var(--cc-deep-navy)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Business Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="owner@yourcelinabusiness.com"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[var(--cc-deep-navy)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="(972) 555-1234"
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[var(--cc-deep-navy)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</label>
                  <textarea
                    placeholder="Anything that helps verify ownership"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[var(--cc-deep-navy)] min-h-20"
                  />
                </div>

                {claimError && <p className="text-rose-600 text-[11px] font-bold">{claimError}</p>}

                <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1">
	                  <span className="font-bold text-slate-700 block">What happens next:</span>
	                  <p>We will review your request and follow up before making changes to the listing.</p>
                </div>

                <button
                  type="submit"
                  disabled={claimSubmitting}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-[var(--cc-deep-navy)] font-bold text-xs rounded-xl disabled:opacity-60"
                >
                  {claimSubmitting ? 'Submitting...' : 'Submit Claim Request'}
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
