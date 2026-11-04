import React, { useEffect, useRef, useState } from 'react';
import { Business, Review, Tier } from '../types';
import { CATEGORIES } from '../data/mockBusinesses';
import { CELINA_EVENTS } from '../data/mockEvents';
import MapModal from './MapModal';
import HeroPhotoBackdrop from './HeroPhotoBackdrop';
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
  ChevronDown,
  ShieldCheck,
  Check,
  ShieldAlert,
  Sparkles,
  Send,
  X,
  Award,
  SlidersHorizontal,
  Share2,
  ThumbsUp,
  Utensils,
  Wrench,
  ShoppingBag,
  CalendarDays,
  Stethoscope,
  BriefcaseBusiness,
  Home,
  Newspaper,
  UsersRound,
  HeartHandshake,
  Megaphone,
  BookOpen
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
const HERO_STATEMENTS = [
  'Find something local in Celina.',
  'Meet your next favorite place in Celina.',
  'See what is happening around Celina.',
];

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
  businesses = businesses.filter(business => business.tier !== 'pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window === 'undefined') return 'All';
    const pendingCategory = sessionStorage.getItem('celina_pending_directory_category') || '';
    if (CATEGORIES.includes(pendingCategory as any)) {
      sessionStorage.removeItem('celina_pending_directory_category');
      return pendingCategory;
    }
    const categoryParam = new URLSearchParams(window.location.search).get('category') || '';
    return CATEGORIES.includes(categoryParam as any) ? categoryParam : 'All';
  });
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
  const [heroStatementIndex, setHeroStatementIndex] = useState(0);
  const [typedHeroStatement, setTypedHeroStatement] = useState('');
  const [isDeletingHeroStatement, setIsDeletingHeroStatement] = useState(false);
  const [prefersReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('celina_liked_businesses') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const inlineAiEndRef = useRef<HTMLDivElement>(null);
  const publicBusinesses = businesses.filter((business) => business.isUnclaimed || hasRequiredListingVisuals(business));
  const activeHeroStatement = HERO_STATEMENTS[heroStatementIndex];

  useEffect(() => {
    if (!homeMode || prefersReducedMotion) {
      if (homeMode && prefersReducedMotion && typedHeroStatement !== activeHeroStatement) {
        setTypedHeroStatement(activeHeroStatement);
      }
      return;
    }

    const isComplete = typedHeroStatement === activeHeroStatement;
    const isEmpty = typedHeroStatement.length === 0;
    const delay = isDeletingHeroStatement ? 34 : isComplete ? 2300 : 62;
    const timer = window.setTimeout(() => {
      if (isComplete && !isDeletingHeroStatement) {
        setIsDeletingHeroStatement(true);
      } else if (isEmpty && isDeletingHeroStatement) {
        setIsDeletingHeroStatement(false);
        setHeroStatementIndex((current) => (current + 1) % HERO_STATEMENTS.length);
      } else if (isDeletingHeroStatement) {
        setTypedHeroStatement((current) => current.slice(0, -1));
      } else {
        setTypedHeroStatement(activeHeroStatement.slice(0, typedHeroStatement.length + 1));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeHeroStatement, homeMode, isDeletingHeroStatement, prefersReducedMotion, typedHeroStatement]);

  const primaryListingImage = (business: Business) => (
    business.images?.find((image) => image.trim()) || business.logoUrl || ''
  );
  const handleListingImageError = (event: React.SyntheticEvent<HTMLImageElement>, fallback = '/celina-water-tower-bg.jpg') => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === 'true') {
      image.style.display = 'none';
      return;
    }
    image.dataset.fallbackApplied = 'true';
    image.src = fallback;
  };
  const listingUrl = (business: Business) => `${window.location.origin}/business/${business.slug || business.id}?ref=${encodeURIComponent(business.id)}`;

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage]);

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
          nodes.push(<strong key={`strong-${match.index}`} className="font-black text-inherit">{renderInline(boldText)}</strong>);
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
                className="font-black text-inherit underline decoration-orange-300/70 underline-offset-2 hover:text-orange-600"
              >
                {linkText}
              </a>
            ) : (
              <strong key={`link-label-${match.index}`} className="font-black text-inherit">{linkText}</strong>
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
            return <p key={index} className="pt-1 text-[12px] font-black tracking-wide text-inherit">{renderInline(copy.replace(/:$/, ''))}</p>;
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

  const homeCategoryCards = [
    {
      title: 'Restaurants',
      category: 'Dining',
      icon: <Utensils className="h-5 w-5" />,
      prompt: 'Where neighbors meet for coffee, dinner, and weekend plans',
      count: publicBusinesses.filter(b => b.category === 'Dining').length,
    },
    {
      title: 'Home Services',
      category: 'Home Services',
      icon: <Wrench className="h-5 w-5" />,
      prompt: 'The crews residents call when home needs attention',
      count: publicBusinesses.filter(b => ['Home Services', 'Home & Garden', 'Trades & Contractors'].includes(b.category)).length,
    },
    {
      title: 'Shopping',
      category: 'Shopping & Retail',
      icon: <ShoppingBag className="h-5 w-5" />,
      prompt: 'Boutiques, gifts, and storefronts worth knowing',
      count: publicBusinesses.filter(b => ['Shopping & Retail', 'Retail'].includes(b.category)).length,
    },
    {
      title: 'Events',
      category: 'Events & Venues',
      icon: <CalendarDays className="h-5 w-5" />,
      prompt: 'Explore community gatherings, markets, and local events',
      count: CELINA_EVENTS.length,
    },
    {
      title: 'Health',
      category: 'Health & Wellness',
      icon: <Stethoscope className="h-5 w-5" />,
      prompt: 'Care, wellness, fitness, and family health close to home',
      count: publicBusinesses.filter(b => ['Health & Wellness', 'Medical & Dental', 'Fitness & Recreation'].includes(b.category)).length,
    },
    {
      title: 'Professional',
      category: 'Professional Services',
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      prompt: 'People who help Celina work, grow, and get things done',
      count: publicBusinesses.filter(b => ['Professional Services', 'Financial Services', 'Legal Services', 'Real Estate', 'Business Services'].includes(b.category)).length,
    },
  ];

  const homeFeaturedListings = [...publicBusinesses]
    .filter((business) => !business.isUnclaimed)
    .sort(compareDirectoryBusinesses)
    .slice(0, 6);

  const homeFreshListings = [...publicBusinesses]
    .filter((business) => isNewListing(business) || (!business.isUnclaimed && Boolean(business.ownerId)))
    .sort(compareDirectoryBusinesses)
    .slice(0, 4);

  const homeMagazineFeatures = homeFeaturedListings.slice(0, 3).map((business, index) => ({
    business,
    label: index === 0 ? 'Local spotlight' : index === 1 ? 'Worth a visit' : 'Neighbor note',
  }));

  const homeCommunityNotes = [
    {
      icon: <Newspaper className="h-5 w-5" />,
      title: 'Latest happenings',
      copy: 'Markets, grand openings, school fundraisers, city moments, and local updates worth knowing about.',
    },
    {
      icon: <UsersRound className="h-5 w-5" />,
      title: 'Networking close to home',
      copy: 'A simple way for business owners, residents, and local leaders to find one another and stay connected.',
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: 'Local stories worth sharing',
      copy: 'Discover seasonal guides, neighborhood features, local interviews, and stories from around Celina.',
    },
  ];

  const homeTickerItems = [
    'Bobcat football nights',
    'Friday Night Market',
    'Grand openings',
    'Local business spotlights',
    'School fundraisers',
    'Weekend family plans',
    'Downtown Square notes',
    'New neighbor recommendations',
  ];

  const handleHomeCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setSelectedTierFilter('all');
    setIsAiFilterActive(false);
    setAiSearchInsights(null);
    setAiMatchingIds(null);
    if (typeof window !== 'undefined') sessionStorage.setItem('celina_pending_directory_category', category);
    setActiveTab?.('directory');
  };

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
            Legacy Listing
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
    <div className={`${homeMode ? 'space-y-7 pt-0 pb-4 sm:pb-6' : 'space-y-8 py-6'}`}>
      {!homeMode && (
        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-bold">Put your business on the Celina map</h2><p>Paid listings start at $6/month or $60/year. Payment is required to activate a new listing.</p></div>
          <button onClick={() => setActiveTab?.('pricing')} className="rounded-xl bg-orange-500 px-5 py-3 font-bold">View paid plans</button>
        </div>
      )}

      {/* Search and Hero Area */}
      <div>
      <div className={`${isInlineAiExpanded ? 'min-h-[410px]' : ''} relative overflow-visible ${homeMode ? 'left-1/2 min-h-[560px] w-screen -translate-x-1/2 rounded-none border-y border-white/10 px-4 py-10 sm:min-h-[600px] sm:px-8 sm:py-16 lg:min-h-[640px] lg:px-12 lg:py-20' : 'rounded-3xl p-5 sm:p-7 md:p-9'} ${homeMode ? 'bg-[var(--cc-deep-navy)] text-white' : 'bg-gradient-to-br from-[var(--cc-deep-navy)] via-[#1b4a78] to-[#143a63] text-white'} shadow-md flex`} id={homeMode ? 'community-front-page-hero' : undefined}>
        {homeMode && <HeroPhotoBackdrop />}
        <div className={`absolute inset-0 pointer-events-none ${homeMode ? 'bg-[linear-gradient(90deg,rgba(4,22,42,0.80)_0%,rgba(7,36,65,0.62)_44%,rgba(7,36,65,0.38)_100%),radial-gradient(ellipse_at_82%_18%,rgba(249,115,22,0.18),transparent_34%)]' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent'}`} />
        <div className={`relative z-10 w-full ${homeMode ? 'mx-auto flex max-w-5xl flex-col items-center text-center' : 'flex flex-col space-y-4'}`}>
          <div className={`flex min-w-0 flex-col space-y-4 ${homeMode ? 'w-full items-center' : ''}`}>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${homeMode ? 'bg-white/80 text-orange-700 border border-orange-200 shadow-sm' : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'}`}>
              <MapPin className={`w-3.5 h-3.5 ${homeMode ? 'text-orange-600' : 'text-orange-400'}`} /> {homeMode ? 'Celina, Texas' : 'Celina, Texas'}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`font-display text-3xl font-extrabold tracking-tight leading-tight text-white sm:text-5xl ${homeMode ? 'min-h-[4em] max-w-4xl text-center sm:min-h-[1.35em]' : ''}`}
            aria-label={homeMode ? activeHeroStatement : undefined}
          >
            {homeMode ? (
              <>
                {typedHeroStatement.includes('Celina') ? (
                  <>{typedHeroStatement.split('Celina')[0]}<span className="text-orange-400">Celina</span>{typedHeroStatement.split('Celina').slice(1).join('Celina')}</>
                ) : typedHeroStatement}
                {!prefersReducedMotion && <span aria-hidden="true" className="ml-1 inline-block h-[0.9em] w-[0.08em] translate-y-[0.08em] animate-pulse bg-orange-400" />}
              </>
            ) : (
              <>Connect with the Best of <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">Celina</span></>
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base ${homeMode ? 'text-center' : ''}`}
          >
            {homeMode
              ? 'Search local businesses, events, places, and things to do around town.'
              : 'Explore our rich community directory, discover local treasures on the Square, or register your own business and grow your Celina reach today.'}
          </motion.p>

          {/* Hero credibility / browse paths */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="pt-1 text-sm font-semibold text-slate-200"
          >
            {homeMode ? (
              <span className="sr-only">{publicBusinesses.length} local businesses and fresh community events</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> {publicBusinesses.length} Local Listings
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-200">
                  <HeartHandshake className="h-3.5 w-3.5 text-emerald-500" /> Community Guide
                </div>
              </div>
            )}
          </motion.div>

          {/* Blended Search + AI Chat Bar */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`${isInlineAiExpanded ? 'h-[360px]' : 'flex-none'} w-full ${homeMode ? 'max-w-4xl' : 'max-w-none'} pt-2 sm:pt-3 flex transition-all duration-300`}
          >
            <div
              id="directory-inline-ai-chat"
              className={`w-full flex h-full flex-col overflow-hidden rounded-[1.65rem] ${homeMode ? 'bg-slate-100/95 text-slate-900 ring-2 ring-white/80 shadow-[0_24px_70px_rgba(2,20,40,0.34)]' : 'bg-white/10 text-white ring-1 ring-white/10'} backdrop-blur-md`}
            >
              {isAiEnabled && isInlineAiExpanded && (
                <div className={`relative h-[250px] flex-none overflow-hidden px-3 sm:px-5 py-3 ${homeMode ? 'bg-slate-100/95' : 'bg-[var(--cc-deep-navy)]/20'}`}>
                  <div className={`mb-1 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest ${homeMode ? 'text-[var(--cc-deep-navy)]' : 'text-orange-200/90'}`}>
                    <span>Celina AI</span>
                    <button
                      type="button"
                      onClick={() => setIsInlineAiExpanded(false)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${homeMode ? 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-orange-50 hover:text-orange-700' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'}`}
                      aria-label="Close Celina AI chat"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {inlineAiMessages.filter((msg) => msg.id !== 'welcome').slice(-4).map((msg, index, visibleMessages) => {
                    const isAi = msg.role === 'assistant';
                    const isWelcome = msg.id === 'welcome';

                    if (isWelcome) {
                      return (
                        <div key={msg.id} className={`flex items-center gap-2 px-1.5 py-0.5 text-[11px] font-medium leading-relaxed ${homeMode ? 'text-slate-700' : 'text-slate-300'}`}>
                          <Sparkles className="h-3.5 w-3.5 text-orange-300 flex-shrink-0" />
                          <span>{msg.text}</span>
                        </div>
                      );
                    }

                    const age = visibleMessages.length - index - 1;
                    return (
                      <div key={msg.id} className={`absolute inset-x-3 top-12 sm:inset-x-5 flex transition-all duration-700 ease-out ${isAi ? 'justify-start' : 'justify-end'} ${age === 0 ? 'z-30 translate-y-0 scale-100 opacity-100' : age === 1 ? 'z-20 -translate-y-3 scale-[0.985] opacity-35' : age === 2 ? 'z-10 -translate-y-6 scale-[0.97] opacity-15' : 'z-0 -translate-y-9 scale-[0.95] opacity-0'}`}>
                        <div className={`flex items-start gap-2 max-w-[92%] ${isAi ? '' : 'flex-row-reverse'}`}>
                          <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAi ? (homeMode ? 'bg-orange-100 text-orange-700' : 'bg-white/10 text-orange-200') : 'bg-orange-500 text-white'}`}>
                            {isAi ? <Sparkles className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          </div>
                          <div className={`rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed ${
                            isAi
                              ? homeMode ? 'bg-white text-slate-800 ring-1 ring-slate-200 rounded-tl-md shadow-sm' : 'bg-white/10 text-slate-100 rounded-tl-md'
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
                      <span className={homeMode ? 'text-slate-700' : ''}>Celina AI is checking local listings...</span>
                    </div>
                  )}
                  <div ref={inlineAiEndRef} />
                </div>
              )}

              <div className={`flex flex-col sm:flex-row items-stretch gap-2 p-2 border-t ${homeMode ? 'bg-white border-slate-200' : 'bg-white/10 border-white/10'}`}>
                <div className="relative flex-grow">
                  <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${homeMode ? 'text-orange-500' : 'text-orange-200'}`} />
                  <input
                    type="text"
                    id="search-input"
                    placeholder={homeMode ? "Search businesses, events, or categories..." : isAiEnabled ? "Ask about Celina happenings, people, places..." : "Search dining, boutique shops, home services..."}
                    value={searchTerm}
                    onFocus={() => setIsInlineAiExpanded(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (!e.target.value) {
                        setIsAiFilterActive(false);
                        setAiSearchInsights(null);
                        setAiMatchingIds(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (homeMode || isAiEnabled)) {
                        handleAiSearch();
                      }
                    }}
                    className="w-full pl-11 pr-4 py-3.5 bg-white text-[var(--cc-deep-navy)] rounded-[1.35rem] font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm border border-slate-200 shadow-sm"
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
                      className={`px-3 py-3.5 rounded-[1.35rem] cursor-pointer flex items-center gap-1 transition-all text-[10px] font-bold ${homeMode ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/15 hover:bg-white/25 text-white'}`}
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                  {(isAiEnabled || homeMode) && (
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
                      <span>{isAiSearching ? 'Searching...' : 'Ask Celina'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Trending Quick Search Chips */}
              <div className={`flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5 pt-1 text-[11px] border-t ${homeMode ? 'border-slate-200 bg-slate-50' : 'border-white/5'}`}>
                <span className={`${homeMode ? 'text-slate-600' : 'text-slate-300'} font-bold tracking-wide uppercase text-[9px] mr-1 flex items-center gap-1`}>
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" /> Trending:
                </span>
                {[
                  "This weekend",
                  "Grand openings",
                  "Coffee",
                  "Boutiques",
                  "Networking",
                  "Family plans"
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSearchTerm(chip);
                      setIsAiFilterActive(false);
                    }}
                    className={`px-2.5 py-1 rounded-full font-medium transition-all border cursor-pointer text-[10px] ${homeMode ? 'bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 border-orange-100' : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border-white/10'}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
          {homeMode && (
            <div className="w-full max-w-3xl pt-5 sm:pt-7">
              <p className="text-xs font-semibold text-white/75 sm:text-sm">Just looking around? Use quick search by category:</p>
              <nav aria-label="Browse local categories" className="mt-4 flex max-w-full items-start justify-center gap-6 overflow-x-auto px-1 pb-1 sm:gap-10">
                {[
                  { label: 'Restaurants', icon: <Utensils className="h-8 w-8" />, action: () => handleHomeCategoryClick('Dining') },
                  { label: 'Home services', icon: <Wrench className="h-8 w-8" />, action: () => handleHomeCategoryClick('Home Services') },
                  { label: 'Shopping', icon: <ShoppingBag className="h-8 w-8" />, action: () => handleHomeCategoryClick('Shopping') },
                  { label: 'Health', icon: <Stethoscope className="h-8 w-8" />, action: () => handleHomeCategoryClick('Health & Wellness') },
                  { label: 'Events', icon: <CalendarDays className="h-8 w-8" />, action: () => setActiveTab?.('events') },
                ].map((category) => (
                  <button key={category.label} type="button" onClick={category.action} aria-label={`Browse ${category.label}`} title={`Browse ${category.label}`} className="group inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white/80 transition hover:text-white">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/50 bg-sky-400/10 text-sky-300 transition group-hover:-translate-y-1 group-hover:border-orange-300 group-hover:bg-orange-400/15 group-hover:text-orange-200">
                      {category.icon}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}
          {homeMode && (
            <p className="pt-1 text-xs font-semibold text-white/70">Explore trusted local businesses, upcoming events, and community favorites.</p>
          )}
          </div>

          {homeMode && (
            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="hidden"
              id="home-local-imagery-hero"
            >
              <button
                type="button"
                onClick={() => homeFeaturedListings[0] ? onSelectBusiness(homeFeaturedListings[0]) : setActiveTab?.('events')}
                aria-label={homeFeaturedListings[0] ? `Open ${homeFeaturedListings[0].name} business listing` : 'Open local events'}
                className="group relative flex min-h-[360px] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/15 bg-white text-left shadow-2xl shadow-black/20"
              >
                <img loading="lazy" decoding="async"
                  onError={(event) => handleListingImageError(event)}
                  src={homeFeaturedListings[0] ? primaryListingImage(homeFeaturedListings[0]) : '/celina-water-tower-bg.jpg'}
                  alt={homeFeaturedListings[0] ? `${homeFeaturedListings[0].name} featured local business` : 'Celina Texas water tower overlooking town'}
                  className="relative h-48 w-full object-cover transition-transform duration-700 group-hover:scale-105 sm:h-56"
                />
                <div className="relative flex flex-1 flex-col justify-center bg-white p-5 sm:p-7">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                    <Star className="h-3.5 w-3.5 fill-orange-500 text-orange-500" /> Featured locally
                  </span>
                  <h3 className="mt-4 max-w-xl font-display text-2xl font-black leading-tight text-[var(--cc-deep-navy)] sm:text-3xl">
                    {homeFeaturedListings[0]?.name || 'Discover what makes Celina special.'}
                  </h3>
                  <p className="mt-2 line-clamp-3 max-w-xl text-sm font-medium leading-relaxed text-slate-600">
                    {homeFeaturedListings[0]?.description || 'Explore trusted businesses, upcoming events, and local favorites around town.'}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-orange-600 transition group-hover:text-orange-700">
                    View featured business <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {homeMode && (
        <section className="relative z-10 left-1/2 w-screen -translate-x-1/2 border-b border-orange-100/70 bg-[var(--cc-cream)] px-5 pb-9 pt-12 text-center sm:pb-11 sm:pt-14" aria-labelledby="home-discover-heading" id="home-discover-stripe">
          <button
            type="button"
            aria-label="Explore Celina categories"
            onClick={() => document.getElementById('home-category-shortcuts')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })}
            className="absolute -top-8 left-1/2 flex h-12 w-36 -translate-x-1/2 items-start justify-center pt-3 text-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600"
          >
            <svg aria-hidden="true" viewBox="0 0 144 32" className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full fill-[var(--cc-cream)]"><path d="M0 32 C30 32 36 0 72 0 C108 0 114 32 144 32 Z" /></svg>
            <ChevronDown className="relative h-4 w-4" aria-hidden="true" />
          </button>
          <div className="mx-auto max-w-3xl">
            <div className="relative isolate py-2">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center whitespace-nowrap font-display text-[clamp(2rem,6vw,4.5rem)] font-black leading-none tracking-tight text-[var(--cc-deep-navy)]/[0.045]">AROUND TOWN</span>
              <h2 id="home-discover-heading" className="font-display text-2xl font-black tracking-tight text-[var(--cc-deep-navy)] sm:text-3xl">Discover Celina</h2>
            </div>
            <div className="mx-auto mt-3 h-0.5 w-10 rounded-full bg-orange-500" />
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Local businesses, community events, and places worth getting to know.
            </p>
          </div>
        </section>
      )}
      </div>

      {homeMode && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="home-community-news-ticker">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cc-deep-navy)] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              <Megaphone className="h-3.5 w-3.5 text-orange-300" /> Community Wire
            </span>
            <span className="text-[11px] font-bold text-slate-500">Local updates, events, and business news from around Celina.</span>
          </div>
          <div className="relative flex overflow-hidden py-2.5">
            <div className="home-news-ticker-track flex min-w-full shrink-0 items-center gap-3 px-3">
              {[...homeTickerItems, ...homeTickerItems].map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-black text-[var(--cc-deep-navy)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!homeMode && searchTerm.trim() && (
        <div className="rounded-2xl bg-gradient-to-r from-[var(--cc-deep-navy)] via-[#1b4a78] to-[var(--cc-deep-navy)] border border-slate-700 p-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200" id="search-claim-assistant-banner">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Directory search</p>
              <p className="text-sm font-bold text-white">
                Searching for <span className="text-amber-300">"{searchTerm}"</span> in Celina Directory
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {filteredBusinesses.filter(b => b.isUnclaimed).length > 0
                  ? `${filteredBusinesses.filter(b => b.isUnclaimed).length} unclaimed listing(s) matched. Click "Claim Now" on any card to activate instant owner access.`
                  : filteredBusinesses.length > 0
                  ? 'Matching businesses found! Click "Claim Now" or create a new listing if yours is missing.'
                  : `We couldn't find an exact match for "${searchTerm}". If you own this business, you can add it to the directory.`}
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
            <span>Add "{searchTerm}" to the directory</span>
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
        <div className="space-y-4" id="home-category-shortcuts">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute -top-5 left-0 select-none font-display text-5xl font-black uppercase tracking-[0.12em] text-[var(--cc-deep-navy)]/[0.045] sm:text-7xl">LOCAL</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Around town</span>
              <h3 className="relative font-display text-xl sm:text-2xl font-black text-[var(--cc-deep-navy)] tracking-tight">Open the local sections</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab?.('directory')}
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer self-start sm:self-auto"
            >
              View all categories <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {homeCategoryCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => card.title === 'Events' ? setActiveTab?.('events') : handleHomeCategoryClick(card.category)}
                className="group min-h-[144px] rounded-xl bg-white border border-slate-200/80 p-3.5 text-left transition-all hover:border-orange-300 hover:shadow-sm cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700 group-hover:bg-orange-100">
                    {card.icon}
                  </div>
                  <div>
                    <h4 className="font-display font-black text-[var(--cc-deep-navy)] text-sm leading-tight group-hover:text-orange-600 transition-colors">
                      {card.title}
                    </h4>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{card.prompt}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <span>{card.count} {card.title === 'Events' ? (card.count === 1 ? 'event' : 'events') : (card.count === 1 ? 'listing' : 'listings')}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-orange-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {homeMode ? (
        <div id="home-community-front-page-content" className="space-y-8">
          <section className="grid md:grid-cols-3 gap-4" id="home-community-magazine-rails">
            {homeCommunityNotes.map((section) => (
              <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  {section.icon}
                </div>
                <h3 className="font-display text-base font-black text-[var(--cc-deep-navy)]">{section.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.copy}</p>
              </div>
            ))}
          </section>

          {homeMagazineFeatures.length > 0 && (
            <section className="space-y-4" id="home-featured-local-picks">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute -top-5 left-0 select-none font-display text-5xl font-black uppercase tracking-[0.12em] text-[var(--cc-deep-navy)]/[0.045] sm:text-7xl">SPOTLIGHTS</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">From the front page</span>
                  <h3 className="relative font-display text-xl sm:text-2xl font-black text-[var(--cc-deep-navy)] tracking-tight">Local spotlights, useful profiles, and places to know</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab?.('directory')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer self-start sm:self-auto"
                >
                  Browse more <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {homeMagazineFeatures.map(({ business, label }) => {
                  const image = primaryListingImage(business);
                  const avgRating = business.reviews.length
                    ? (business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length).toFixed(1)
                    : null;

                  return (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => onSelectBusiness(business)}
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                    >
                      <div className="h-32 bg-slate-100">
                        {image ? (
                          <img loading="lazy" decoding="async" src={image} alt={`${business.name} photo`} referrerPolicy="no-referrer" onError={(event) => handleListingImageError(event)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-orange-50 text-orange-700">
                            <Home className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2.5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wide text-orange-600">{label}</p>
                            <h4 className="mt-0.5 truncate font-display text-base font-black text-[var(--cc-deep-navy)] group-hover:text-orange-600">{business.name}</h4>
                          </div>
                          {business.tier === 'premium' ? (
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-900">Featured</span>
                          ) : getNewListingBadge(business)}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{business.description}</p>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {avgRating || 'New'} {avgRating ? `(${business.reviews.length})` : 'profile'}
                          </span>
                          <span className="text-orange-600">View profile</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-[1fr_0.72fr]" id="home-resident-owner-paths">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Neighbor notes</span>
                  <h3 className="font-display text-xl font-black tracking-tight text-[var(--cc-deep-navy)]">Recently claimed, updated, or ready to meet Celina</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                    New profiles, updated hours, photos, events, and owner notes keep this community guide useful and current.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab?.('directory')}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                >
                  Full directory <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {homeFreshListings.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => onSelectBusiness(business)}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition-colors hover:border-orange-200 hover:bg-white"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border border-slate-200">
                      {business.logoUrl ? (
                        <img loading="lazy" decoding="async" src={business.logoUrl} alt={`${business.name} logo`} referrerPolicy="no-referrer" onError={(event) => handleListingImageError(event, '/images/celina-connection-logo.png')} className="h-full w-full object-cover" />
                      ) : (
                        <MapPin className="h-5 w-5 text-orange-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[var(--cc-deep-navy)] group-hover:text-orange-600">{business.name}</p>
                      <p className="truncate text-[11px] font-semibold text-slate-500">{business.category}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-orange-500" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-5 sm:p-6 shadow-sm" id="home-owner-claim-card">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-700">Be part of the local story</span>
              <h3 className="mt-2 font-display text-xl font-black tracking-tight text-[var(--cc-deep-navy)]">Claim your place in Celina Connection.</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                A listing gives neighbors a clear way to find your business. From there, you can share updates, promote events, build trust, and be discovered by more local customers.
              </p>
              <div className="mt-4 space-y-2">
                {['Paid business profile', 'Community updates and networking', 'Events and local customer discovery'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Check className="h-4 w-4 flex-shrink-0 text-orange-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab?.('dashboard')}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cc-deep-navy)] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-orange-600"
              >
                Claim or add your profile <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4" id="home-info-sections">
            {[
              {
                icon: <HeartHandshake className="h-5 w-5" />,
                title: 'Find what feels close to home',
                copy: 'Start with useful local information, familiar places, and the people who make Celina feel welcoming.',
              },
              {
                icon: <CalendarDays className="h-5 w-5" />,
                title: 'Something new to discover',
                copy: 'Keep up with local happenings, seasonal guides, offers, and newly updated business profiles.',
              },
              {
                icon: <Megaphone className="h-5 w-5" />,
                title: 'A better way to support local',
                copy: 'Businesses can reach more neighbors through featured placement, promoted events, sponsorships, and local guides.',
              },
            ].map((section) => (
              <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  {section.icon}
                </div>
                <h3 className="font-display text-base font-black text-[var(--cc-deep-navy)]">{section.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.copy}</p>
              </div>
            ))}
          </section>
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
                                        <img loading="lazy" decoding="async"
                                          src={b.logoUrl}
                                          alt={`${b.name} logo`}
                                          referrerPolicy="no-referrer"
                                          onError={(event) => handleListingImageError(event, '/images/celina-connection-logo.png')}
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
                                      <img loading="lazy" decoding="async"
                                        src={bannerImage}
                                        alt={`${b.name} photo`}
                                        referrerPolicy="no-referrer"
                                        onError={(event) => handleListingImageError(event)}
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
                                        <img loading="lazy" decoding="async"
                                          src={b.logoUrl}
                                          alt={`${b.name} logo`}
                                          referrerPolicy="no-referrer"
                                          onError={(event) => handleListingImageError(event, '/images/celina-connection-logo.png')}
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
                                      <img loading="lazy" decoding="async"
                                        src={cardImage}
                                    alt={`${b.name} photo`}
                                    referrerPolicy="no-referrer"
                                    onError={(event) => handleListingImageError(event)}
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
                    <img loading="lazy" decoding="async"
                      src={primaryListingImage(selectedBusiness)}
                      alt={selectedBusiness.name}
                      referrerPolicy="no-referrer"
                      onError={(event) => handleListingImageError(event)}
                      onClick={() => setLightboxImage({ src: primaryListingImage(selectedBusiness), alt: selectedBusiness.name })}
                      className="w-full h-full cursor-zoom-in object-cover"
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
                          <button type="button" className="h-full w-full cursor-zoom-in" onClick={() => setLightboxImage({ src: selectedBusiness.logoUrl || '', alt: `${selectedBusiness.name} logo` })} aria-label={`View ${selectedBusiness.name} logo full size`}>
                          <img loading="lazy" decoding="async"
                            src={selectedBusiness.logoUrl}
                            alt={`${selectedBusiness.name} logo`}
                            referrerPolicy="no-referrer"
                            onError={(event) => handleListingImageError(event, '/images/celina-connection-logo.png')}
                            className="h-full w-full object-cover"
                          />
                          </button>
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
                                  <button type="button" className="h-full w-full cursor-zoom-in" onClick={() => setLightboxImage({ src: img, alt: `${selectedBusiness.name} gallery ${i + 1}` })} aria-label={`View ${selectedBusiness.name} gallery image full size`}>
                                  <img loading="lazy" decoding="async"
                                    src={img}
                                    alt={`${selectedBusiness.name} gallery photo ${i + 1}`}
                                    referrerPolicy="no-referrer"
                                    onError={(event) => handleListingImageError(event)}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                  />
                                  </button>
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

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded listing photo"
          >
            <button type="button" onClick={() => setLightboxImage(null)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25" aria-label="Close expanded photo">
              <X className="h-6 w-6" />
            </button>
            <motion.img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[92vh] max-w-[96vw] rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
