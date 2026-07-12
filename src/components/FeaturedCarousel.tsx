import React, { useState } from 'react';
import { Business } from '../types';
import { Star, Phone, MapPin, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeaturedCarouselProps {
  businesses: Business[];
  onSelectBusiness: (business: Business) => void;
}

export default function FeaturedCarousel({
  businesses,
  onSelectBusiness,
}: FeaturedCarouselProps) {
  const featuredList = businesses.filter((b) => b.tier === 'premium' || b.tier === 'pro' || b.featured);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (featuredList.length === 0) {
    return null;
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredList.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length);
  };

  const currentBusiness = featuredList[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl" id="featured-spotlight-carousel">
      {/* Absolute Decorative Glow Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent mix-blend-screen pointer-events-none" />

      {/* Slide Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBusiness.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="relative grid grid-cols-1 lg:grid-cols-12 min-h-[380px]"
        >
          {/* Info Side */}
          <div className="p-8 sm:p-10 lg:col-span-7 flex flex-col justify-between relative z-10">
            <div>
              {/* Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-md uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-slate-950" /> Featured Spotlight
                </span>
                <span className="text-xs text-orange-200 font-medium">
                  {currentBusiness.tier === 'premium' ? 'Preston Elite Premium' : currentBusiness.tier === 'pro' ? 'Celina Champion Pro' : 'Featured Partner'}
                </span>
              </div>

              {/* Title & Category */}
              <h3 className="font-display text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight mb-2 leading-tight">
                {currentBusiness.name}
              </h3>
              <p className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white/10 text-orange-200 mb-4 border border-white/5">
                {currentBusiness.category}
              </p>

              {/* Description */}
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mb-6">
                {currentBusiness.description}
              </p>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300 mb-6">
                {currentBusiness.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span className="truncate">{currentBusiness.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span>{currentBusiness.phone}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectBusiness(currentBusiness)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02] transition-all cursor-pointer"
              >
                <span>View Full Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {currentBusiness.website && (
                <a
                  href={currentBusiness.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 text-white border border-white/10 font-semibold text-sm hover:bg-white/20 transition-all"
                >
                  <span>{currentBusiness.ctaText || 'Visit Website'}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Image Side */}
          <div className="relative min-h-[220px] lg:col-span-5 w-full h-full">
            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent z-10" />
            <img
              src={
                currentBusiness.images && currentBusiness.images.length > 0
                  ? currentBusiness.images[0]
                  : 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'
              }
              alt={currentBusiness.name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Pagination Controls */}
            {featuredList.length > 1 && (
              <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                <button
                  onClick={prevSlide}
                  className="p-2 rounded-lg bg-slate-900/80 backdrop-blur border border-white/10 hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Previous Featured Spot"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={nextSlide}
                  className="p-2 rounded-lg bg-slate-900/80 backdrop-blur border border-white/10 hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Next Featured Spot"
                >
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Progress Bars */}
      {featuredList.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex h-1 bg-white/10">
          {featuredList.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-full cursor-pointer transition-all duration-300 ${
                idx === currentIndex ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-transparent'
              }`}
              style={{ width: `${100 / featuredList.length}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
