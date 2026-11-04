import React, { useEffect, useState } from 'react';
import type { Tier, UserProfile, Business } from '../types';

interface CheckoutModalProps {
  targetTier: Tier | null;
  targetInterval: 'month' | 'year';
  onChangeInterval: (interval: 'month' | 'year') => void;
  onClose: () => void;
  currentUser?: UserProfile;
  businesses?: Business[];
}

export default function CheckoutModal({ targetTier, targetInterval, onChangeInterval, onClose, currentUser }: CheckoutModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addonQuantity, setAddonQuantity] = useState(0);
  useEffect(() => { setError(''); setAddonQuantity(0); setBusy(false); }, [targetTier]);
  if (!targetTier) return null;
  const plans = {
    basic: { name: 'Local Pioneer (Basic)', month: 6, year: 60 },
    pro: { name: 'Celina Champion (Pro)', month: 16, year: 160 },
    premium: { name: 'Preston Elite (Premium)', month: 29, year: 290 },
  };
  const plan = plans[targetTier as keyof typeof plans];
  const checkout = async () => {
    if (!plan || !currentUser?.isLoggedIn) { setError('Sign in and choose a paid plan to continue.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier, businessId: currentUser.businessId, interval: targetInterval, addonQuantity }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable. Please try again.');
      const destination = new URL(data.url);
      if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout destination.');
      window.location.assign(destination.href);
    } catch (err) { setError(err instanceof Error ? err.message : 'Checkout is unavailable.'); setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><h2 id="checkout-title" className="text-2xl font-bold">Activate your paid listing</h2><button aria-label="Close checkout" onClick={onClose} disabled={busy}>✕</button></div>
      {!plan ? <p className="mt-4">This plan is no longer offered. Choose Basic, Pro, or Premium.</p> : <>
        <h3 className="mt-5 text-xl font-bold">{plan.name}</h3>
        <label className="mt-4 block">Billing cycle<select value={targetInterval} onChange={e => onChangeInterval(e.target.value as 'month' | 'year')} disabled={busy} className="mt-1 block w-full rounded-xl border p-3"><option value="month">Monthly</option><option value="year">Annually</option></select></label>
        <p className="mt-4 text-3xl font-bold">${plan[targetInterval]}<span className="text-base font-normal">/{targetInterval === 'year' ? 'year' : 'month'}</span></p>
        <label className="mt-4 block">Additional listings (${targetInterval === 'year' ? '36/year' : '4/month'} each)<input type="number" min="0" max="20" step="1" value={addonQuantity} disabled={busy} onChange={e => setAddonQuantity(Number(e.target.value))} className="mt-1 block w-full rounded-xl border p-3" /></label>
        <p className="mt-4 font-bold">Total: ${plan[targetInterval] + addonQuantity * (targetInterval === 'year' ? 36 : 4)} per {targetInterval === 'year' ? 'year' : 'month'}, before applicable taxes.</p>
        <p className="mt-3 text-sm text-slate-600">Recurring billing. Complete payment securely with Stripe. New listings are published only after email verification and confirmed payment.</p>
        <button onClick={checkout} disabled={busy || !currentUser?.isLoggedIn} className="mt-5 w-full rounded-xl bg-orange-500 px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Opening Stripe…' : 'Continue to paid checkout'}</button>
      </>}
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    </section>
  </div>;
}
