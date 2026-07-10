import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trophy, Flame, ShieldCheck, Zap, ArrowRight, Star, Heart, CheckCircle2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Business } from '../types';

interface LaunchViewProps {
  setActiveTab: (tab: string) => void;
  onUpgradePrompt: (tier: 'basic' | 'pro' | 'premium') => void;
  isGated?: boolean;
  onBypassGating?: () => void;
  businesses?: Business[];
}

export default function LaunchView({ setActiveTab, onUpgradePrompt, isGated = false, onBypassGating, businesses = [] }: LaunchViewProps) {
  // Countdown Timer target: July 12, 2026 09:00:00 (Celina local time)
  const targetDate = new Date("2026-07-12T09:00:00-05:00").getTime();
  
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Derive real live data from database!
  const claimedBusinesses = (businesses || []).filter(b => !b.isUnclaimed && !b.isRegistryOnly);
  
  // Sort claims in ascending order by their creation date so Slot #1 is the oldest claim
  const sortedClaims = [...claimedBusinesses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Map to beautiful feed items, newest first
  const displayClaims = sortedClaims.map((b, index) => {
    const dateObj = new Date(b.createdAt);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      id: b.id,
      business: b.name,
      slot: `#${index + 1}`,
      time: `Claimed ${formattedDate}`,
      note: b.tier === 'premium' ? '🏆 PREMIUM PARTNER' : b.tier === 'pro' ? '⚡ PRO PARTNER' : '🤠 BASIC LISTING'
    };
  }).reverse();

  // Dynamic slots available calculation
  const spotsAvailable = Math.max(0, 100 - claimedBusinesses.length);
  const percentageClaimed = Math.min(100, Math.round((claimedBusinesses.length / 100) * 100));

  // Trigger brief alert notification when a new business is added
  useEffect(() => {
    if (claimedBusinesses.length > 0) {
      const newestClaim = [...claimedBusinesses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      // Only show toast if it was created in the last 60 seconds (so it doesn't fire on initial load)
      const claimAgeMs = Date.now() - new Date(newestClaim.createdAt).getTime();
      if (claimAgeMs < 60000) {
        setShowNotification(`🔥 ${newestClaim.name} just secured slot #${claimedBusinesses.length}! Only ${spotsAvailable} free slots left!`);
        const timer = setTimeout(() => setShowNotification(null), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [claimedBusinesses.length]);

  // Countdown effect
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="space-y-10 py-6" id="launch-countdown-view">
      {/* Toast Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-amber-500 text-amber-400 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold whitespace-nowrap"
          >
            <Flame className="w-4 h-4 text-orange-500 animate-bounce" />
            <span>{showNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-slate-200 bg-white/85 backdrop-blur-md p-6 sm:p-12 md:p-16 shadow-xl flex flex-col items-center justify-between text-center space-y-10 min-h-[750px]" id="launch-container">
        
        {/* Faded Background Image of the Famous Celina Water Tower */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none select-none opacity-[0.09]" id="water-tower-background">
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-white/90 z-10" />
          <img
            src="https://images.squarespace-cdn.com/content/v1/5c1a708212fcfe9a5c8df59f/1547493721345-IIGUFTZFF9R3C579K4X6/Celina-Water-Tower-Square-Center.jpg"
            alt="Celina Water Tower Backdrop"
            className="w-full h-full object-cover object-center scale-110 saturate-75 contrast-125"
            referrerPolicy="no-referrer"
          />
          {/* Subtle stylized vector illustration elements matching the actual Celina Water Tower wheat emblem */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center opacity-30 select-none">
            <span className="text-sm font-black tracking-widest text-slate-800 uppercase">CELINA</span>
            <div className="flex gap-1 my-0.5 text-amber-500 text-xs">🌾🌾🌾</div>
            <span className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">TEXAS</span>
          </div>
        </div>

        {/* Top: Welcome Badge & Header */}
        <div className="space-y-4 max-w-2xl mx-auto z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-xs">
            <Flame className="w-3.5 h-3.5 animate-pulse text-orange-500" />
            Official Pre-Launch Portal
          </div>
          
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">
            Welcome to Celina Connection
          </p>

          <h1 className="font-display text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-none">
            The Premier <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-500 to-amber-600">Business Registry</span> Hub
          </h1>
          
          <p className="text-slate-500 font-medium text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            The countdown is ON for Celina's ultimate virtual commerce platform and business ecosystem. 
            We are partnering with local entrepreneurs to showcase the absolute best of North Texas commerce.
          </p>
        </div>

        {/* Middle: Premium Countdown Clock Panel */}
        <div className="w-full max-w-xl mx-auto space-y-4 z-10">
          <div className="grid grid-cols-4 gap-2 sm:gap-4" id="countdown-timer-panel">
            {[
              { label: 'Days', value: timeLeft.days },
              { label: 'Hours', value: timeLeft.hours },
              { label: 'Mins', value: timeLeft.minutes },
              { label: 'Secs', value: timeLeft.seconds }
            ].map((unit, index) => (
              <div key={index} className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center relative overflow-hidden group shadow-xs backdrop-blur-xs">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                <span className="font-display text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-600 to-amber-500 tracking-tight leading-none">
                  {timeLeft.isExpired ? '00' : String(unit.value).padStart(2, '0')}
                </span>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1.5">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-orange-600 animate-pulse tracking-wide uppercase">
            <Clock className="w-3.5 h-3.5" />
            {timeLeft.isExpired ? "🎉 WE ARE LIVE! EXPLORE THE PLATFORM!" : "⏳ Launching Sunday, July 12, 2026 at 9:00 AM CST"}
          </div>
        </div>

        {/* Bottom: Limited Spots Remaining Card & CTA */}
        <div className="w-full max-w-lg mx-auto bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm z-10 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <div className="text-left space-y-0.5">
              <h3 className="font-display text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
                Lifetime Free Spots Left
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Capped at exactly 100 listings to incentivize early momentum!
              </p>
            </div>
            <span className="text-[10px] font-extrabold text-orange-600 bg-orange-100/60 border border-orange-200 px-2.5 py-1 rounded-lg">
              {percentageClaimed}% CLAIMED
            </span>
          </div>

          {/* Progress Visualizer */}
          <div className="space-y-2">
            <div className="h-3.5 bg-slate-200/60 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${percentageClaimed}%` }}
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600"
              />
            </div>
            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
              <span>{claimedBusinesses.length} Secured Spots</span>
              <span className="text-orange-600 font-black">{spotsAvailable} slots available</span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className="w-full py-3.5 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white hover:from-orange-700 hover:to-amber-600 font-black text-xs uppercase tracking-widest rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.01] hover:shadow-lg active:scale-95"
          >
            <span>Claim Your Free Listing Now</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
          
          <p className="text-[9px] text-slate-400 font-medium">
            No credit card required. Claiming takes less than 2 minutes. Secure your digital storefront today!
          </p>
        </div>

        {/* Administration Bypass Portal */}
        {isGated && onBypassGating && (
          <div className="w-full max-w-xs mx-auto pt-6 border-t border-slate-100 z-10" id="bypass-portal-container">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (passcode === 'Alpha@2026!') {
                  setPasscodeError(false);
                  onBypassGating();
                } else {
                  setPasscodeError(true);
                }
              }}
              className="space-y-2.5"
            >
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-500" /> Administration Bypass Portal
              </p>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  placeholder="Enter Passcode"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (passcodeError) setPasscodeError(false);
                  }}
                  className={`flex-grow px-3 py-1.5 bg-slate-50 border text-slate-900 rounded-lg text-[10px] font-semibold placeholder-slate-400 focus:outline-none transition-all ${
                    passcodeError ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-amber-500'
                  }`}
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1 flex-shrink-0"
                >
                  <span>Enter</span>
                  <ArrowRight className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
              {passcodeError && (
                <p className="text-[9px] text-rose-500 font-bold text-center">
                  ❌ Invalid passcode. Access denied.
                </p>
              )}
              <p className="text-[8px] text-slate-400 text-center leading-relaxed">
                Alpha testing bypass only. Private system.
              </p>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
