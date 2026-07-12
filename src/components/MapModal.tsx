import React, { useMemo, useState } from 'react';
import { Business } from '../types';
import {
  X,
  MapPin,
  Navigation,
  Clock,
  Phone,
  Info,
  Car,
  Footprints,
  Search,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';

interface MapModalProps {
  business: Business;
  onClose: () => void;
}

const BUSINESS_COORDINATES: Record<string, { lat: number; lng: number; landmark: string }> = {
  'lucys-on-the-square': { lat: 33.324391, lng: -96.786817, landmark: 'Historic Downtown Square' },
  'celina-vintage-barbershop': { lat: 33.324141, lng: -96.786817, landmark: 'Downtown Square North' },
  'preston-road-cleaners': { lat: 33.315001, lng: -96.764512, landmark: 'South Preston Commercial Plaza' },
  'texas-donut-co': { lat: 33.326001, lng: -96.764512, landmark: 'Preston Road North' },
};

function getDirectionsForBusiness(name: string, landmark: string, travelMode: 'drive' | 'walk') {
  const intro = travelMode === 'drive' ? 'Head out from Celina Town Square.' : 'Start at Celina Town Square and walk toward the destination.';
  const movement = travelMode === 'drive' ? 'Continue along the main route toward the business area.' : 'Follow the most direct pedestrian route toward the business area.';
  const arrival = `Arrive at ${name}, located near ${landmark}.`;

  return {
    eta: travelMode === 'drive' ? '4 min' : '11 min',
    steps: [intro, movement, 'Look for nearby parking or the storefront signage as you approach.', arrival],
  };
}

export default function MapModal({ business, onClose }: MapModalProps) {
  const [showDirections, setShowDirections] = useState(false);
  const [travelMode, setTravelMode] = useState<'drive' | 'walk'>('drive');
  const [searchQuery, setSearchQuery] = useState('');

  const coords = BUSINESS_COORDINATES[business.id] || {
    lat: 33.3244,
    lng: -96.7868,
    landmark: 'Central Celina',
  };

  const destinationQuery = useMemo(() => {
    if (searchQuery.trim()) return `${searchQuery.trim()}, Celina, TX`;
    if (business.address?.trim()) return business.address.trim();
    return `${business.name}, Celina, TX`;
  }, [business.address, business.name, searchQuery]);

  const directions = useMemo(
    () => getDirectionsForBusiness(business.name, coords.landmark, travelMode),
    [business.name, coords.landmark, travelMode],
  );

  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(destinationQuery)}&z=15&output=embed`;
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationQuery)}`;
  const externalDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=${travelMode === 'drive' ? 'driving' : 'walking'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="simulated-map-modal">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl h-[85vh] sm:h-[80vh] min-h-[500px] overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-2xl flex flex-col md:flex-row"
      >
        <div className="w-full md:w-80 border-r border-slate-100 bg-white flex flex-col justify-between flex-shrink-0 z-10 max-h-[35%] md:max-h-full overflow-y-auto">
          <div className="p-5 border-b border-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wider">
                  <MapPin className="w-2.5 h-2.5 text-orange-700" /> Celina Map Guide
                </span>
                <h2 className="font-display font-extrabold text-slate-900 text-lg leading-tight mt-1">
                  {business.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close map"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-700 flex items-center gap-1 font-medium bg-slate-50 p-2 rounded-xl">
              <Info className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
              <span className="truncate">{business.address || 'Celina, TX 75009'}</span>
            </div>
          </div>

          <div className="p-5 flex-grow space-y-4">
            {!showDirections ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">About Location</h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Located near <strong className="text-slate-900">{coords.landmark}</strong>. The in-listing map now uses a
                    reliable Google Maps embed so visitors can open the location immediately.
                  </p>
                </div>

                <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>{business.hours ? `Open Today: ${business.hours.monFri}` : 'Open Daily'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-700">{business.phone}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setShowDirections(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:opacity-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-100 cursor-pointer transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5 text-slate-950" />
                    <span>Get Directions</span>
                  </button>
                  <a
                    href={externalMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Route Navigation</h3>
                  <button
                    onClick={() => setShowDirections(false)}
                    className="text-orange-700 hover:underline text-[10px] font-bold cursor-pointer"
                  >
                    Back to Info
                  </button>
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-xl">
                  <button
                    onClick={() => setTravelMode('drive')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      travelMode === 'drive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Drive ({directions.eta})</span>
                  </button>
                  <button
                    onClick={() => setTravelMode('walk')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      travelMode === 'walk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>Walk ({directions.eta})</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[160px] md:max-h-[220px] overflow-y-auto pr-1">
                  {directions.steps.map((step, index) => (
                    <div key={index} className="flex gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-black text-orange-800 flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-slate-700 leading-tight">{step}</p>
                    </div>
                  ))}
                </div>

                <a
                  href={externalDirectionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch Turn-by-Turn in Google Maps</span>
                </a>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-600 font-semibold hidden md:block">
            <span>Celina Connection Map Service • 2026</span>
          </div>
        </div>

        <div className="flex-grow h-full bg-slate-100 relative overflow-hidden">
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-col sm:flex-row justify-between gap-2 pointer-events-none">
            <form onSubmit={(e) => e.preventDefault()} className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-lg border border-slate-200 pointer-events-auto max-w-sm w-full">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nearby or change destination"
                  className="w-full pl-8 pr-2 py-2 text-xs text-slate-800 bg-transparent outline-none placeholder:text-slate-500"
                  aria-label="Search map destination"
                />
              </div>
            </form>

            <div className="flex items-center gap-2 pointer-events-auto self-end sm:self-auto">
              <a
                href={showDirections ? externalDirectionsUrl : externalMapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{showDirections ? 'Open Route' : 'Open Map'}</span>
              </a>
              <button
                onClick={onClose}
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/95 text-slate-700 hover:text-slate-900 shadow-lg border border-slate-200 transition-colors"
                aria-label="Close map"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <iframe
            key={`${destinationQuery}-${travelMode}-${showDirections ? 'dir' : 'map'}`}
            title={`Map for ${business.name}`}
            src={showDirections ? `https://www.google.com/maps?q=${encodeURIComponent(destinationQuery)}&z=15&output=embed` : embedSrc}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </motion.div>
    </div>
  );
}
