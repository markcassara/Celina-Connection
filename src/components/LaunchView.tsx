import React from 'react';
import type { Business } from '../types';
interface LaunchViewProps {
  setActiveTab: (tab: string) => void;
  onUpgradePrompt: (tier: 'basic' | 'pro' | 'premium') => void;
  isGated?: boolean;
  onBypassGating?: () => void;
  businesses?: Business[];
}
export default function LaunchView({ setActiveTab }: LaunchViewProps) {
  return <section className="mx-auto max-w-4xl px-5 py-16 text-center">
    <p className="font-bold uppercase tracking-wider text-orange-600">Celina Connection business memberships</p>
    <h1 className="mt-5 text-4xl font-extrabold">Give your business a place in Celina.</h1>
    <p className="mt-5 text-lg">Choose a paid Basic, Pro, or Premium listing. Plans start at $6 per month or $60 per year.</p>
    <p className="mt-3 text-slate-600">Register, verify your email, and complete secure Stripe checkout. Your listing is published after payment is confirmed.</p>
    <button onClick={() => setActiveTab('pricing')} className="mt-7 rounded-xl bg-orange-500 px-7 py-4 font-bold">Compare paid plans</button>
  </section>;
}
