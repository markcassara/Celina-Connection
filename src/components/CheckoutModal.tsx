import React, { useState, useEffect } from 'react';
import { Tier, UserProfile, Business } from '../types';
import { CreditCard, Shield, Lock, CheckCircle, Loader2, Sparkles, AlertCircle, ExternalLink, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CheckoutModalProps {
  targetTier: Tier | null;
  targetInterval: 'month' | 'year';
  onChangeInterval: (interval: 'month' | 'year') => void;
  onClose: () => void;
  onPaymentSuccess: (tier: Tier, addonQty?: number) => void;
  currentUser?: UserProfile;
  businesses?: Business[];
}

export default function CheckoutModal({
  targetTier,
  targetInterval,
  onChangeInterval,
  onClose,
  onPaymentSuccess,
  currentUser,
  businesses = [],
}: CheckoutModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Payment flow states
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [useManualEntryMode, setUseManualEntryMode] = useState(false);

  // Multi-listing billing add-on state
  const [addonQuantity, setAddonQuantity] = useState(0);

  // Count how many additional businesses are owned by this user
  const userOwnedCount = businesses && currentUser?.isLoggedIn
    ? businesses.filter(b => b.ownerId === currentUser.id || (currentUser.email && b.email.toLowerCase() === currentUser.email.toLowerCase())).length
    : 0;
  const defaultAddonQty = Math.max(0, userOwnedCount - 1);

  useEffect(() => {
    if (targetTier && targetTier !== 'free' && currentUser?.isLoggedIn && businesses.length > 0) {
      setAddonQuantity(defaultAddonQty);
    } else {
      setAddonQuantity(0);
    }
  }, [targetTier, currentUser?.id, businesses.length]);

  // Check config on load
  useEffect(() => {
    if (targetTier && targetTier !== 'free') {
      setIsLoadingConfig(true);
      fetch('/api/payment-config')
        .then((res) => res.json())
        .then((data) => {
          setStripeEnabled(!!data.stripeEnabled);
          setIsLoadingConfig(false);
        })
        .catch(() => {
          setStripeEnabled(false);
          setIsLoadingConfig(false);
        });
    } else {
      setIsLoadingConfig(false);
    }
  }, [targetTier]);

  if (!targetTier) return null;

  const getTierDetails = (tier: Tier | null) => {
    if (!tier) return { name: '', price: '', frequency: '', accent: '', benefits: [] };
    switch (tier) {
      case 'premium':
        return {
          name: 'Premium Partner',
          price: targetInterval === 'year' ? '$290.00' : '$29.00',
          frequency: targetInterval === 'year' ? 'billed annually' : 'billed monthly',
          accent: 'from-amber-400 to-amber-500 text-slate-950',
          benefits: [
            'Featured placement in homepage carousel',
            'Priority directory search sorting',
            'Full photo & portfolio gallery',
            'Customer reviews direct replies',
            'Verified Partner gold badge',
          ],
        };
      case 'pro':
        return {
          name: 'Pro Partner',
          price: targetInterval === 'year' ? '$160.00' : '$16.00',
          frequency: targetInterval === 'year' ? 'billed annually' : 'billed monthly',
          accent: 'from-orange-500 to-orange-600 text-white',
          benefits: [
            'Standard active profile listing',
            'Verified Business silver badge',
            'Reviews & ratings integration',
            'Basic monthly page views counter',
          ],
        };
      case 'basic':
        return {
          name: 'Basic Listing',
          price: targetInterval === 'year' ? '$60.00' : '$6.00',
          frequency: targetInterval === 'year' ? 'billed annually' : 'billed monthly',
          accent: 'from-slate-500 to-slate-600 text-white',
          benefits: ['Standard paid directory listing', 'Website link', 'Business hours', 'Basic monthly page views counter'],
        };
      default:
        return {
          name: 'Free Launch Listing',
          price: '$0.00',
          frequency: 'free for first 100 listings',
          accent: 'from-emerald-500 to-emerald-600 text-white',
          benefits: ['Standard search directory listing'],
        };
    }
  };

  const details = getTierDetails(targetTier);
  const planPriceAmount = targetTier === 'premium' 
    ? (targetInterval === 'year' ? 290 : 29) 
    : targetTier === 'pro'
      ? (targetInterval === 'year' ? 160 : 16)
      : targetTier === 'basic'
        ? (targetInterval === 'year' ? 60 : 6)
        : 0;

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      setCardExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
    } else {
      setCardExpiry(val);
    }
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCardCvc(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetTier === 'free') {
      onPaymentSuccess('free', 0);
      return;
    }

    if (!cardName.trim() || cardNumber.length < 19 || cardExpiry.length < 5 || cardCvc.length < 3) {
      setError('Please provide valid card information.');
      return;
    }

    setError('');
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        onPaymentSuccess(targetTier, addonQuantity);
      }, 1500);
    }, 2000);
  };

  const handleStripeCheckout = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: targetTier,
          userId: currentUser?.id,
          businessId: currentUser?.businessId,
          addonQuantity: addonQuantity,
          interval: targetInterval,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during Stripe redirect.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="checkout-modal-container">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />

      {/* Modal Alignment */}
      <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
        >
          {/* Header */}
          <div className="p-6 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              <h3 className="font-display font-extrabold text-slate-950 text-sm">Secure Celina Checkout</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer disabled:opacity-40"
            >
              &times;
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isLoadingConfig ? (
              <div className="p-12 text-center space-y-3 flex flex-col items-center justify-center min-h-[340px]" key="loading">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Loading checkout options...</p>
              </div>
            ) : isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[340px]"
                key="success-screen"
              >
                <CheckCircle className="w-16 h-16 text-emerald-500 animate-bounce" />
                <h4 className="font-display text-xl font-extrabold text-slate-900">Payment Approved!</h4>
                <p className="text-slate-500 text-xs leading-relaxed max-w-xs">
                  Your Celina Connection account has been upgraded to <span className="font-bold text-orange-600">{details.name}</span>. Updating directory data...
                </p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Shield className="w-3.5 h-3.5" /> Secure token recorded.
                </div>
              </motion.div>
            ) : stripeEnabled && !useManualEntryMode ? (
              /* REAL STRIPE CHECKOUT SCREEN */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-5"
                key="stripe-screen"
              >
                {/* Billing Interval Toggle */}
                {targetTier !== 'free' && (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                    <span className="text-xs font-bold text-slate-800">Billing Interval</span>
                    <div className="flex bg-slate-200 p-0.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => onChangeInterval('month')}
                        className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          targetInterval === 'month'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeInterval('year')}
                        className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          targetInterval === 'year'
                            ? 'bg-orange-500 text-white shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Annual
                        <span className="bg-orange-100 text-orange-900 text-[9px] px-1 rounded">Save</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Upgrade details summary banner */}
                <div className={`p-4.5 rounded-2xl bg-gradient-to-r ${details.accent} shadow-md flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 block">Total Subscription Billing</span>
                    <span className="font-display font-black text-base">{details.name} {addonQuantity > 0 ? `+ ${addonQuantity} Add-on${addonQuantity > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-xl block">${(planPriceAmount + addonQuantity * (targetInterval === 'year' ? 36 : 3)).toFixed(2)}</span>
                    <span className="text-[10px] opacity-85 block">{targetInterval === 'year' ? 'billed annually' : 'billed monthly'}</span>
                  </div>
                </div>

                {/* Additional Business Add-on Selector */}
                <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        Additional Business Add-on
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        List multiple businesses under your account for {targetInterval === 'year' ? '$36.00/yr' : '$3.00/mo'} each
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-xl">
                      +{targetInterval === 'year' ? '$36.00/yr' : '$3.00/mo'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-medium text-slate-600">
                      Additional Listings to Upgrade:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddonQuantity(q => Math.max(0, q - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900">
                        {addonQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAddonQuantity(q => q + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {defaultAddonQty > 0 && addonQuantity < defaultAddonQty && (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-100 text-[10px] text-amber-800 leading-normal font-medium flex items-start gap-1.5 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        We noticed you have {userOwnedCount} registered listings under this account. We recommend choosing at least {defaultAddonQty} add-on slots to cover them all!
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    Stripe Secure Processing Active
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-normal">
                    This directory is configured with real payment integrations. You will be redirected to Stripe's bank-grade secure checkout.
                  </p>
                </div>

                {/* Benefits List */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What's included:</h4>
                  <ul className="space-y-1.5">
                    {details.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                {error && (
                  <p className="text-red-600 text-xs flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </p>
                )}

                {/* Checkout Button */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <button
                    onClick={handleStripeCheckout}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-900 transition-all cursor-pointer shadow-md disabled:opacity-55"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Redirecting to Stripe...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Stripe Checkout</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <div className="flex justify-end items-center text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> PCI Compliant</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Card entry screen */
              <motion.form
                onSubmit={handleSubmit}
                className="p-6 space-y-5"
                key="form-screen"
              >
                {/* Billing Interval Toggle */}
                {targetTier !== 'free' && (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
                    <span className="text-xs font-bold text-slate-800">Billing Interval</span>
                    <div className="flex bg-slate-200 p-0.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => onChangeInterval('month')}
                        className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          targetInterval === 'month'
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeInterval('year')}
                        className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          targetInterval === 'year'
                            ? 'bg-orange-500 text-white shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Annual
                        <span className="bg-orange-100 text-orange-900 text-[9px] px-1 rounded">Save</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Upgrade details summary banner */}
                <div className={`p-4.5 rounded-2xl bg-gradient-to-r ${details.accent} shadow-md flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-85 block">Total Subscription Billing</span>
                    <span className="font-display font-black text-base">{details.name} {addonQuantity > 0 ? `+ ${addonQuantity} Add-on${addonQuantity > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-black text-xl block">${(planPriceAmount + addonQuantity * (targetInterval === 'year' ? 36 : 3)).toFixed(2)}</span>
                    <span className="text-[10px] opacity-85 block">{targetInterval === 'year' ? 'billed annually' : 'billed monthly'}</span>
                  </div>
                </div>

                {/* Additional Business Add-on Selector */}
                <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        Additional Business Add-on
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        List multiple businesses under your account for {targetInterval === 'year' ? '$36.00/yr' : '$3.00/mo'} each
                      </p>
                    </div>
                    <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-xl">
                      +{targetInterval === 'year' ? '$36.00/yr' : '$3.00/mo'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-medium text-slate-600">
                      Additional Listings to Upgrade:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddonQuantity(q => Math.max(0, q - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900">
                        {addonQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAddonQuantity(q => q + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {defaultAddonQty > 0 && addonQuantity < defaultAddonQty && (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-100 text-[10px] text-amber-800 leading-normal font-medium flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        We noticed you have {userOwnedCount} registered listings. We recommend choosing at least {defaultAddonQty} add-on slot(s) to cover all your businesses!
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment setup notice */}
                {!stripeEnabled ? (
                  <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-orange-50 text-slate-700 text-xs border border-orange-100">
                    <div className="flex items-center gap-1.5 text-orange-700 font-bold">
                      <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      Card Checkout Setup Required
                    </div>
                    <p className="leading-relaxed text-slate-600 text-[11px]">
                      Card checkout is being finalized. Please contact support if you need this upgrade activated right away.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50 text-slate-700 text-xs border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <Sparkles className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      Secure Card Entry
                    </div>
                    <p className="leading-relaxed text-slate-500 text-[11px]">
                      Prefer Stripe Checkout?{' '}
                      <button type="button" onClick={() => setUseManualEntryMode(false)} className="text-orange-600 underline font-bold hover:text-orange-700 cursor-pointer">
                        Return to Stripe Checkout
                      </button>
                    </p>
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      disabled={isProcessing}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Card Number
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        disabled={isProcessing}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        disabled={isProcessing}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        CVC / CVV
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="123"
                        value={cardCvc}
                        onChange={handleCvcChange}
                        disabled={isProcessing}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-red-600 text-xs flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </p>
                )}

                {/* Submit button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-grow inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-900 transition-all cursor-pointer shadow-md disabled:opacity-55"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Card...</span>
                      </>
                    ) : (
                      <>
                        <span>Simulate {details.price} Payment</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
