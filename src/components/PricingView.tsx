import React, { useState } from 'react';
import { Tier, UserProfile } from '../types';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  DollarSign,
  Info,
  Lock,
  Mail,
  MessageSquareText,
  Printer,
  Share2,
  Shirt,
  Smartphone,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';

interface PricingViewProps {
  currentUser: UserProfile;
  onSelectTier: (tier: Tier, interval: 'month' | 'year') => void;
  onOpenLogin: () => void;
}

type PricingCardId = Tier | 'free';

export default function PricingView({
  currentUser,
  onSelectTier,
  onOpenLogin,
}: PricingViewProps) {
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('year');

  const handleTierClick = (tier: PricingCardId) => {
    if (tier === 'free') {
      onOpenLogin();
      return;
    }

    if (!currentUser.isLoggedIn) {
      onOpenLogin();
    } else {
      onSelectTier(tier, billingCycle);
    }
  };

  const pricingCards = [
    {
      id: 'free' as PricingCardId,
      name: 'Free Launch Listing',
      price: 'Free',
      period: 'first 100 listings',
      description: 'A no-card-required starter listing for launch. Perfect for claiming a spot before choosing a paid visibility plan.',
      icon: <Star className="w-6 h-6 text-emerald-500" />,
      features: [
        'Standard search placement',
        'Basic contact info (Phone, Email)',
        'Business description',
        'Full street address with Map view',
        '1 image upload',
      ],
      notIncluded: [
        'Website link',
        'Hours of operation',
        'Review replies',
        'Featured front-page placement',
        'Gallery upgrades',
      ],
      color: 'border-emerald-200 hover:border-emerald-300 bg-emerald-50/30 text-[var(--cc-deep-navy)]',
      buttonStyle: 'bg-emerald-600 text-white hover:bg-emerald-700',
      buttonText: 'Claim Free Listing',
    },
    {
      id: 'basic' as PricingCardId,
      name: 'Local Pioneer (Basic)',
      price: billingCycle === 'year' ? '$60' : '$6',
      period: billingCycle === 'year' ? 'per year' : 'per month',
      description: 'Standard paid directory listing. Keep the affordable $6/month entry tier available for businesses that want a paid presence.',
      icon: <Info className="w-6 h-6 text-slate-500" />,
      features: [
        'Standard search placement',
        'Basic contact info (Phone, Email)',
        'Website link',
        'Business description',
        'Full street address with Map view',
        'Hours of operation',
        'Up to 5 image uploads',
        'Receive customer reviews',
      ],
      notIncluded: [
        'Social media integration',
        'Manage & reply to reviews',
        'Front-page featured spot',
        'YouTube video feature',
      ],
      color: 'border-slate-200 hover:border-slate-300 bg-white text-[var(--cc-deep-navy)]',
      buttonStyle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      buttonText: 'Claim Basic Listing',
    },
    {
      id: 'pro' as PricingCardId,
      name: 'Celina Champion (Pro)',
      price: billingCycle === 'year' ? '$160' : '$16',
      period: billingCycle === 'year' ? 'per year' : 'per month',
      description: 'Our most popular choice! Unlock vital custom info, social hubs, and front-page featured placement.',
      icon: <Zap className="w-6 h-6 text-orange-500" />,
      popular: true,
      features: [
        'Standard search placement with Pro Badge',
        'Full business address with Map view',
        'Website link & Call to Action',
        'Hours of operation details',
        'Up to 10 image uploads (Gallery)',
        'YouTube video section',
        'Review Management (Write replies!)',
        'Front-page featured placement (Secondary Spotlight)',
      ],
      notIncluded: [
        'Social media links',
        'Custom button labels',
      ],
      color: 'border-orange-500 bg-orange-50/20 text-[var(--cc-deep-navy)] shadow-md ring-1 ring-orange-400',
      buttonStyle: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-100',
      buttonText: 'Upgrade to Pro',
    },
    {
      id: 'premium' as PricingCardId,
      name: 'Preston Elite (Premium)',
      price: billingCycle === 'year' ? '$290' : '$29',
      period: billingCycle === 'year' ? 'per year' : 'per month',
      description: 'Ultimate local exposure. Top featured spots, visual home slider, and AI focus priority.',
      icon: <Sparkles className="w-6 h-6 text-amber-500" />,
      features: [
        'Priority search placement with Gold Border',
        'Front-page Featured Spotlight Access',
        'Full physical address & contact cards',
        'Website & Custom Button labels (CTA)',
        'Up to 20 image uploads (Full Gallery)',
        'Review management & priority replies',
        'Social media integration links',
        'YouTube video section',
        'Priority live support',
      ],
      notIncluded: [],
      color: 'border-amber-400 bg-[var(--cc-deep-navy)] text-white shadow-xl shadow-amber-500/10 relative overflow-hidden',
      buttonStyle: 'bg-gradient-to-r from-amber-400 to-amber-500 text-[var(--cc-deep-navy)] hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/10',
      buttonText: 'Upgrade to Preston Elite',
    },
  ];

  const paidAddOns = [
    {
      name: 'Local Events Promotion',
      desc: 'Give your grand opening, sale, workshop, or community event a brighter spot in the Local Events calendar.',
      detail: 'Best requested while your event is still within its 30-day promotion window.',
      note: 'Intro offer planned',
      icon: CalendarDays,
      featured: true,
    },
    {
      name: 'Weekly Featured SMS Blast',
      desc: 'Share a timely local promotion with Celina neighbors who have asked to hear from local businesses.',
      detail: 'Limited weekly placement keeps each message easier to notice.',
      note: 'Flash offers',
      icon: MessageSquareText,
    },
    {
      name: 'Targeted Email Blast Campaigns',
      desc: 'Send a polished local announcement, seasonal offer, or business update through a curated Celina newsletter.',
      detail: 'Best for offers that need room for details, links, and visuals.',
      note: 'Newsletters',
      icon: Mail,
    },
    {
      name: 'Social Media Management Packages',
      desc: 'Get help turning updates, offers, and local stories into consistent posts for your business channels.',
      detail: 'Built for owners who need steady presence without another weekly task.',
      note: 'Managed help',
      icon: Share2,
    },
    {
      name: 'Custom Mobile App Placement',
      desc: 'Reserve priority placement inside the upcoming Celina Connection mobile guide experience.',
      detail: 'Early interest helps shape which categories receive placement first.',
      note: 'Mobile guide',
      icon: Smartphone,
    },
    {
      name: 'Professional Photo Services',
      desc: 'Refresh your listing with friendly, useful photos of your storefront, team, products, or service work.',
      detail: 'A better image set can make your listing feel more trustworthy at a glance.',
      note: 'Local shoots',
      icon: Camera,
    },
    {
      name: 'Local Apparel & Merch Printing',
      desc: 'Create branded hats, shirts, aprons, or simple merch for events, staff, and loyal customers.',
      detail: 'Helpful for pop-ups, grand openings, and community sponsorships.',
      note: 'Small batches',
      icon: Shirt,
    },
    {
      name: 'Premium Print & Signage Kits',
      desc: 'Order business cards, QR window stickers, flyers, menus, and direct-mail pieces with a local-first look.',
      detail: 'A practical add-on when your online listing needs matching in-person materials.',
      note: 'Print support',
      icon: Printer,
    },
  ];

  return (
    <div className="space-y-12 py-6">
      {/* Visual Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 uppercase tracking-wider">
          <DollarSign className="w-3.5 h-3.5" /> Simple, Welcoming Membership Plans
        </span>
        <h2 className="font-display text-3xl sm:text-4.5xl font-extrabold text-[var(--cc-deep-navy)] tracking-tight">
          Help Celina Grow while{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">
            Unlocking Growth
          </span>
        </h2>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
          Select a budget-friendly directory plan designed to list your business, attract customers, and display your brand perfectly. Upgrade or downgrade anytime.
        </p>

        {/* Dynamic Billing Switch */}
        <div className="flex justify-center items-center gap-3 pt-4">
          <button
            onClick={() => setBillingCycle('month')}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
              billingCycle === 'month'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Billed Monthly
          </button>
          <button
            onClick={() => setBillingCycle('year')}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              billingCycle === 'year'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Billed Annually
            <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-1.5 py-0.5 rounded-md">
              Save up to 17%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 items-stretch" id="pricing-tiers-grid">
        {pricingCards.map((card) => {
          const isCurrentTier = currentUser.isLoggedIn && card.id !== 'free' && currentUser.tier === card.id;
          return (
            <motion.div
              key={card.id}
              whileHover={{ y: -5 }}
              id={`pricing-card-${card.id}`}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between transition-all duration-300 h-full ${card.color}`}
            >
              {/* Popular Ribbon */}
              {card.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-500 text-white shadow-sm">
                  Most Popular
                </span>
              )}

              {/* Card Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                    {card.name}
                  </span>
                  {card.icon}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl sm:text-5xl font-black tracking-tight">
                    {card.price}
                  </span>
                  <span className="text-xs font-medium opacity-70">/{card.period}</span>
                </div>

                <p className="text-xs leading-relaxed opacity-80 min-h-[40px]">
                  {card.description}
                </p>

                <hr className="opacity-10" />

                {/* Features List */}
                <ul className="space-y-3 pt-2 text-xs">
                  {card.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="font-medium opacity-95">{feat}</span>
                    </li>
                  ))}

                  {card.notIncluded.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 opacity-40">
                      <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="line-through">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tier Action button */}
              <div className="pt-8">
                <button
                  id={`btn-subscribe-${card.id}`}
                  onClick={() => handleTierClick(card.id)}
                  disabled={isCurrentTier}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isCurrentTier
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed font-semibold'
                      : card.buttonStyle
                  }`}
                >
                  {isCurrentTier ? (
                    <>
                      <Check className="w-4 h-4" /> Your Current Plan
                    </>
                  ) : (
                    <>
                      {card.buttonText}
                    </>
                  )}
                </button>
                {!currentUser.isLoggedIn && (
                  <p className="text-[10px] text-center mt-2 text-slate-400">
                    Account registration is free and fast.
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-[11px] leading-5 text-slate-400">
        Paid memberships and event promotions are subject to Celina Connection's{' '}
        <a href="/policies#payments" className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
          payment
        </a>
        ,{' '}
        <a href="/policies#refunds" className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
          refund
        </a>
        , and{' '}
        <a href="/policies#terms" className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
          terms
        </a>{' '}
        policies.
      </p>

      {/* Business Boosts Section */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--cc-wheat-gold)]/45 bg-[var(--cc-warm-white)] shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="bg-[var(--cc-deep-navy)] p-6 sm:p-8 text-white">
            <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">
              <Sparkles className="h-3 w-3" />
              Coming Soon for Paid Members
            </span>
            <h3 className="mt-4 font-display text-2xl sm:text-3xl font-black tracking-tight">
              Business Boosts are on the way
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Optional add-ons are being shaped for local businesses that want extra visibility around events, offers, launches, photos, print, and community campaigns.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="font-black text-orange-100">Local-first</p>
                <p className="mt-1 text-slate-200 font-medium leading-relaxed">Built around Celina launches, offers, events, and neighborhood moments.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="font-black text-orange-100">Thoughtful placement</p>
                <p className="mt-1 text-slate-200 font-medium leading-relaxed">Designed to stay useful and noticeable without crowding the directory.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 p-4 sm:p-5 gap-4">
            {paidAddOns.map((addon) => {
              const AddonIcon = addon.icon;

              return (
                <div
                  key={addon.name}
                  className={`group relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    addon.featured
                      ? 'md:col-span-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 text-[var(--cc-deep-navy)]'
                      : 'border-slate-200 bg-white text-[var(--cc-deep-navy)] hover:border-orange-200'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          addon.featured
                            ? 'bg-orange-500 text-white'
                            : 'bg-orange-50 text-orange-600'
                        }`}
                      >
                        <AddonIcon className="h-5 w-5" />
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-orange-700">
                          Coming Soon
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700">
                          {addon.note}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-display text-base font-black leading-tight">{addon.name}</h4>
                      <p className="text-xs font-semibold leading-relaxed text-slate-600">
                        {addon.desc}
                      </p>
                      <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                        {addon.detail}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-black uppercase tracking-wider text-orange-600">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Paid member preview
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
