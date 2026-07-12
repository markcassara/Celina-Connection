import React, { useState } from 'react';
import { Tier, UserProfile } from '../types';
import { Check, Info, Lock, Star, Sparkles, Zap, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';

interface PricingViewProps {
  currentUser: UserProfile;
  onSelectTier: (tier: Tier, interval: 'month' | 'year') => void;
  onOpenLogin: () => void;
}

export default function PricingView({
  currentUser,
  onSelectTier,
  onOpenLogin,
}: PricingViewProps) {
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('year');

  const handleTierClick = (tier: Tier) => {
    if (!currentUser.isLoggedIn) {
      onOpenLogin();
    } else {
      onSelectTier(tier, billingCycle);
    }
  };

  const pricingCards = [
    {
      id: 'basic' as Tier,
      name: 'Local Pioneer (Basic)',
      price: billingCycle === 'year' ? '$60' : '$6',
      period: billingCycle === 'year' ? 'per year' : 'per month',
      description: 'Standard business card directory listing. Secure your local presence on the platform.',
      icon: <Info className="w-6 h-6 text-slate-500" />,
      features: [
        'Standard search placement',
        'Basic contact info (Phone, Email)',
        'Business description',
        '1 image upload',
        'Receive customer reviews',
      ],
      notIncluded: [
        'Hours of operation',
        'Full street address (City/State only)',
        'Website link',
        'Social media integration',
        'Manage & reply to reviews',
        'Front-page featured spot',
        'Max 1 photo upload (No galleries)',
      ],
      color: 'border-slate-200 hover:border-slate-300 bg-white text-slate-900',
      buttonStyle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      buttonText: 'Claim Basic Listing',
    },
    {
      id: 'pro' as Tier,
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
        'Up to 5 image uploads (Gallery)',
        'Review Management (Write replies!)',
        'Front-page featured placement (Secondary Spotlight)',
      ],
      notIncluded: [
        'Social media links',
        'Custom button labels',
        'Monthly view metrics analytics',
      ],
      color: 'border-orange-500 bg-orange-50/20 text-slate-900 shadow-md ring-1 ring-orange-400',
      buttonStyle: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-100',
      buttonText: 'Upgrade to Pro',
    },
    {
      id: 'premium' as Tier,
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
        'Up to 10 image uploads (Full Gallery)',
        'Review management & priority replies',
        'Social media integration links',
        'Detailed monthly view metrics & analytics',
        'Priority live support',
      ],
      notIncluded: [],
      isComingSoon: true,
      color: 'border-amber-400/40 bg-slate-950 text-white shadow-xl shadow-amber-500/5 relative overflow-hidden opacity-90',
      buttonStyle: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed',
      buttonText: 'Preston Elite Launches July 12',
    },
  ];

  return (
    <div className="space-y-12 py-6">
      {/* Visual Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 uppercase tracking-wider">
          <DollarSign className="w-3.5 h-3.5" /> Simple, Welcoming Membership Plans
        </span>
        <h2 className="font-display text-3xl sm:text-4.5xl font-extrabold text-slate-900 tracking-tight">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch" id="pricing-tiers-grid">
        {pricingCards.map((card) => {
          const isCurrentTier = currentUser.isLoggedIn && currentUser.tier === card.id;
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
                  onClick={() => !card.isComingSoon && handleTierClick(card.id)}
                  disabled={isCurrentTier || card.isComingSoon}
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

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
        <h3 className="font-display text-xl font-bold text-slate-900 text-center">
          Comprehensive Feature Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Directory Feature</th>
                <th className="py-3 px-4">Basic ({billingCycle === 'year' ? '$60/yr' : '$6/mo'})</th>
                <th className="py-3 px-4">Pro ({billingCycle === 'year' ? '$160/yr' : '$16/mo'})</th>
                <th className="py-3 px-4">Premium ({billingCycle === 'year' ? '$290/yr' : '$29/mo'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Celina Square Search Placement</td>
                <td className="py-3.5 px-4">Standard</td>
                <td className="py-3.5 px-4 font-medium text-orange-600">Standard + Badge</td>
                <td className="py-3.5 px-4 font-bold text-amber-600">Priority Spotlight</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Featured Front-Page Access</td>
                <td className="py-3.5 px-4 text-slate-400">No</td>
                <td className="py-3.5 px-4 text-orange-600 font-semibold">Yes (Secondary Spotlight)</td>
                <td className="py-3.5 px-4 text-emerald-600 font-bold">Yes (Top Slider Spotlight)</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Image Upload Limits</td>
                <td className="py-3.5 px-4">Max 1 Image</td>
                <td className="py-3.5 px-4 font-medium">Max 5 Images (Gallery)</td>
                <td className="py-3.5 px-4 font-bold">Max 10 Images (Full Gallery)</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Contact Info & Address</td>
                <td className="py-3.5 px-4 font-medium text-emerald-600">Full Address</td>
                <td className="py-3.5 px-4 font-medium text-emerald-600">Full Address</td>
                <td className="py-3.5 px-4 font-bold text-emerald-600">Full Address</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Website & Custom CTA Buttons</td>
                <td className="py-3.5 px-4 text-slate-400">No Link</td>
                <td className="py-3.5 px-4 font-medium text-emerald-600">Website Link</td>
                <td className="py-3.5 px-4 font-bold text-emerald-600">Custom Styled Button</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Hours of Operation</td>
                <td className="py-3.5 px-4 text-slate-400">Hidden</td>
                <td className="py-3.5 px-4 text-emerald-600">Visible</td>
                <td className="py-3.5 px-4 text-emerald-600 font-bold">Visible</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Review Responder Engine</td>
                <td className="py-3.5 px-4 text-slate-400">Read-Only</td>
                <td className="py-3.5 px-4 font-medium text-emerald-600">Write Replies</td>
                <td className="py-3.5 px-4 font-bold text-emerald-600">Write Replies</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Social Media Integrations</td>
                <td className="py-3.5 px-4 text-slate-400">None</td>
                <td className="py-3.5 px-4 text-slate-400">None</td>
                <td className="py-3.5 px-4 text-emerald-600 font-bold">Facebook, Insta, Twitter</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-semibold text-slate-950">Directory Metrics Analytics</td>
                <td className="py-3.5 px-4 text-slate-400">Basic Clicks</td>
                <td className="py-3.5 px-4 text-slate-400">No</td>
                <td className="py-3.5 px-4 font-bold text-emerald-600">Yes (Full Analytics Graph)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Future Expansion Add-ons Section */}
      <div className="space-y-6 pt-4">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
            Future Pipeline
          </span>
          <h3 className="font-display text-xl font-bold text-slate-900">
            Campaign Add-Ons Coming Soon
          </h3>
          <p className="text-slate-500 text-xs leading-relaxed">
            Boost your local campaigns with specialized add-on tools launching in future pipeline iterations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Weekly Featured SMS Blast', desc: 'Push local promotion highlights directly to verified Celina shoppers.' },
            { name: 'Targeted Email Blast Campaigns', desc: 'Engage local subscribers with beautifully curated newsletters.' },
            { name: 'Social Media Management Packages', desc: 'Fully managed social posting and syndication to boost your local exposure.' },
            { name: 'Custom Mobile App Placement', desc: 'Featured priority placement inside our future iOS & Android local guide apps.' },
            { name: 'Professional Photo Services', desc: 'On-site photography package for your store interiors, staff, and products.' },
            { name: 'Local Apparel & Merch Printing', desc: 'Custom branded hats, shirts, and aprons printed and delivered locally.' },
            { name: 'Premium Print & Signage Kits', desc: 'Business cards, QR window stickers, flyers, and direct mailers printed in town.' },
          ].map((addon, idx) => (
            <div key={idx} className="p-4 bg-white border border-slate-150 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-900">{addon.name}</p>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">{addon.desc}</p>
              </div>
              <div>
                <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  <Lock className="w-2 h-2" /> COMING SOON
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
