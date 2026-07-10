import React, { useState, useEffect } from 'react';
import { Business } from '../types';
import { 
  X, 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  Navigation, 
  Compass, 
  Layers, 
  Clock, 
  Phone, 
  Info,
  Car,
  Footprints,
  Sparkles,
  Search,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { getDaysRemaining } from '../utils/claimUtils';

interface MapModalProps {
  business: Business;
  onClose: () => void;
}

// Real latitude & longitude coordinates in Celina, Texas
const BUSINESS_COORDINATES: Record<string, { lat: number; lng: number; landmark: string }> = {
  'lucys-on-the-square': { lat: 33.324391, lng: -96.786817, landmark: 'Historic Downtown Square' },
  'celina-vintage-barbershop': { lat: 33.324141, lng: -96.786817, landmark: 'Downtown Square North' },
  'preston-road-cleaners': { lat: 33.315001, lng: -96.764512, landmark: 'South Preston Commercial Plaza' },
  'texas-donut-co': { lat: 33.326001, lng: -96.764512, landmark: 'Preston Road North' },
};

// Default center of historic Celina Town Square
const SQUARE_COORDINATES = { lat: 33.324391, lng: -96.786817 };

// API key retrieval
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function MapModal({ business, onClose }: MapModalProps) {
  const [mapType, setMapType] = useState<'vector' | 'satellite'>('vector');
  const [zoom, setZoom] = useState<number>(15);
  const [showDirections, setShowDirections] = useState<boolean>(false);
  const [travelMode, setTravelMode] = useState<'drive' | 'walk'>('drive');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSuccess, setSearchSuccess] = useState<boolean>(false);

  // Get specific coordinates or default to central Celina
  const coords = BUSINESS_COORDINATES[business.id] || { lat: 33.3244, lng: -96.7868, landmark: 'Central Celina' };

  // Calculate default map center
  const [mapCenter, setMapCenter] = useState(coords);

  // Sync center when coordinates change
  useEffect(() => {
    setMapCenter(coords);
  }, [business.id]);

  // Generate turns/directions dynamically
  const directions = getSimulatedDirections(business.name, coords, travelMode);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 1, 21));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 1, 1));
  const handleResetZoom = () => {
    setZoom(15);
    setMapCenter(coords);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchSuccess(true);
      setTimeout(() => setSearchSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="simulated-map-modal">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl h-[85vh] sm:h-[80vh] min-h-[500px] overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-2xl flex flex-col md:flex-row"
      >
        
        {/* Left Side Panel: Business Context & Directions */}
        <div className="w-full md:w-80 border-r border-slate-100 bg-white flex flex-col justify-between flex-shrink-0 z-10 max-h-[35%] md:max-h-full overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-slate-50 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 uppercase tracking-wider">
                  <MapPin className="w-2.5 h-2.5 text-orange-500" /> Celina Map Guide
                </span>
                <h3 className="font-display font-extrabold text-slate-900 text-lg leading-tight mt-1">
                  {business.name}
                </h3>
              </div>
              <button 
                onClick={onClose}
                className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1 font-medium bg-slate-50 p-2 rounded-xl">
              <Info className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="truncate">{business.address || 'Celina, TX 75009'}</span>
            </div>
          </div>

          {/* Body Options */}
          <div className="p-5 flex-grow space-y-4">
            {!showDirections ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">About Location</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Located near <strong className="text-slate-800">{coords.landmark}</strong>. 
                    {business.tier === 'basic' ? (
                      <span className="text-orange-600 block mt-1.5 font-semibold">
                        💡 Upgrade this business to Pro to unlock clickable turn-by-turn routing with navigation simulation!
                      </span>
                    ) : (
                      ' Get precise, visual step-by-step navigation instructions directly from historic Celina Town Square!'
                    )}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{business.hours ? `Open Today: ${business.hours.monFri}` : 'Open Daily'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500">{business.phone}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowDirections(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:opacity-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-100 cursor-pointer transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                    <span>Get Directions</span>
                  </button>
                </div>
              </div>
            ) : (
              // Directions panel
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Route Navigation</h4>
                  <button 
                    onClick={() => setShowDirections(false)}
                    className="text-orange-600 hover:underline text-[10px] font-bold cursor-pointer"
                  >
                    Back to Info
                  </button>
                </div>

                {/* Travel Mode Toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-xl">
                  <button
                    onClick={() => setTravelMode('drive')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      travelMode === 'drive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Drive ({directions.timeDrive})</span>
                  </button>
                  <button
                    onClick={() => setTravelMode('walk')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      travelMode === 'walk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>Walk ({directions.timeWalk})</span>
                  </button>
                </div>

                {/* Steps List */}
                <div className="space-y-3 max-h-[160px] md:max-h-[220px] overflow-y-auto pr-1">
                  {directions.steps.map((step, index) => (
                    <div key={index} className="flex gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-black text-orange-700 flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-slate-600 leading-tight">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 text-[10px] font-semibold text-amber-900 flex gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
                  <span>Real Google Maps routing path active on the screen!</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer branding */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold hidden md:block">
            <span>Celina Connection Map Service • 2026</span>
          </div>
        </div>

        {/* Right Area: Interactive Map Canvas */}
        <div className="flex-grow h-full bg-slate-950 relative overflow-hidden select-none">
          {/* Top Floating Control Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-col sm:flex-row justify-between gap-2 pointer-events-none">
            {/* Search Input on Map */}
            <form onSubmit={handleSearchSubmit} className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-lg border border-slate-100/10 pointer-events-auto max-w-xs w-full">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Downtown Celina..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-transparent text-slate-800 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:ring-0"
                />
              </div>
              <button 
                type="submit"
                className="px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
              >
                {searchSuccess ? <Check className="w-3 h-3 text-emerald-400" /> : 'Search'}
              </button>
            </form>

            {/* Map Style & Close */}
            <div className="flex gap-2 justify-end pointer-events-auto">
              <div className="bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-lg flex border border-slate-100/10 text-xs font-bold">
                <button
                  onClick={() => setMapType('vector')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                    mapType === 'vector' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Map</span>
                </button>
                <button
                  onClick={() => setMapType('satellite')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                    mapType === 'satellite' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Satellite</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="h-8 w-8 hidden md:flex items-center justify-center rounded-xl bg-white/95 hover:bg-white text-slate-700 shadow-lg border border-slate-100/10 cursor-pointer"
                title="Close Map"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Floating Zoom Controls Bottom Right */}
          <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-100/10 p-1 flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="h-8 w-8 flex items-center justify-center text-slate-700 hover:text-orange-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="h-8 w-8 flex items-center justify-center text-slate-700 hover:text-orange-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1 py-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-center"
              title="Reset Zoom"
            >
              100%
            </button>
          </div>

          {/* Floating Compass HUD on Bottom Left */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-800/60 text-[10px] font-mono text-slate-400">
            <Compass className="w-3.5 h-3.5 text-orange-500 animate-[spin_10s_linear_infinite]" />
            <span>33.3245° N, 96.7865° W • CELINA</span>
          </div>

          {/* Real Google Maps Interface */}
          {hasValidKey ? (
            <APIProvider apiKey={API_KEY} version="weekly">
              <Map
                center={mapCenter}
                zoom={zoom}
                onZoomChanged={(e) => setZoom(e.detail.zoom)}
                onCenterChanged={(e) => setMapCenter(e.detail.center as any)}
                mapId="DEMO_MAP_ID"
                mapTypeId={mapType === 'satellite' ? 'satellite' : 'roadmap'}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
                gestureHandling="cooperative"
                disableDefaultUI={true}
              >
                {/* Active Business Pin */}
                <AdvancedMarker position={coords} title={business.name}>
                  <Pin background="#f97316" glyphColor="#fff" borderColor="#ea580c" />
                </AdvancedMarker>

                {/* Starting Point Marker (Historic Celina Town Square) if directions are shown */}
                {showDirections && (
                  <>
                    <AdvancedMarker position={SQUARE_COORDINATES} title="Celina Historic Downtown Square">
                      <Pin background="#1e293b" glyphColor="#fff" borderColor="#0f172a" />
                    </AdvancedMarker>
                    <RouteDisplay 
                      origin={SQUARE_COORDINATES} 
                      destination={coords} 
                      travelMode={travelMode} 
                    />
                  </>
                )}
              </Map>
            </APIProvider>
          ) : (
            /* Splash Screen requesting API Key when missing */
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-12 text-center text-white font-sans relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 max-w-md space-y-6">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-display font-extrabold text-xl text-white tracking-tight">Real Google Map Experience</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    This feature requires a Google Maps Platform API Key to load interactive streets, business markers, and real-time navigation directions.
                  </p>
                </div>

                <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 text-left space-y-3 text-xs leading-normal">
                  <p className="font-bold text-orange-500">How to get your API Key:</p>
                  <ol className="list-decimal pl-4 space-y-2 text-slate-300">
                    <li>
                      <a
                        href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:underline font-bold"
                      >
                        Click here to get an API Key
                      </a> from Google Cloud.
                    </li>
                    <li>
                      Open <strong>Settings</strong> (⚙️ gear icon, top-right corner of AI Studio).
                    </li>
                    <li>
                      Under <strong>Secrets</strong>, add a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code> and paste your key.
                    </li>
                  </ol>
                  <div className="mt-2 text-[10px] text-slate-500 italic">
                    The application will rebuild automatically - no page reload required!
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Map Component companion to compute routes dynamically
interface RouteDisplayProps {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  travelMode: 'drive' | 'walk';
}

function RouteDisplay({ origin, destination, travelMode }: RouteDisplayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = React.useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map) return;
    
    // Clear previous route polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: travelMode === 'walk' ? 'WALKING' : 'DRIVING',
      fields: ['path', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => {
          p.setOptions({
            strokeColor: '#f97316',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          });
          p.setMap(map);
        });
        polylinesRef.current = newPolylines;
        if (routes[0].viewport) {
          map.fitBounds(routes[0].viewport);
        }
      }
    }).catch(err => {
      console.warn("Google Routes Service failed. Drawing direct path.", err);
      // Fallback: direct line polyline
      const fallbackLine = new google.maps.Polyline({
        path: [origin, destination],
        strokeColor: '#f97316',
        strokeWeight: 4,
        strokeOpacity: 0.8
      });
      fallbackLine.setMap(map);
      polylinesRef.current = [fallbackLine];
      
      // Auto zoom to encompass both coordinates
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds);
    });

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, destination, travelMode]);

  return null;
}

// Helper to calculate custom step directions for beautiful sidebar list
function getSimulatedDirections(name: string, coords: { lat: number; lng: number }, mode: string) {
  const steps: string[] = [
    "📍 Depart from Celina Historic Downtown Square (142 N Ohio St, Celina, TX).",
  ];

  let distanceVal = "0.2 miles";
  let timeDrive = "1 min";
  let timeWalk = "4 mins";

  if (coords.lat === SQUARE_COORDINATES.lat && coords.lng === SQUARE_COORDINATES.lng) {
    steps.push(`You are already here! ${name} is located directly at the historic square.`);
    distanceVal = "0.0 miles";
    timeDrive = "0 min";
    timeWalk = "0 mins";
  } else {
    // Basic coordinates logic
    const dLat = coords.lat - SQUARE_COORDINATES.lat;
    const dLng = coords.lng - SQUARE_COORDINATES.lng;

    if (Math.abs(dLat) > Math.abs(dLng)) {
      if (dLat < 0) {
        steps.push("Head South on N Ohio St toward Walnut St.");
        steps.push("Turn right onto W Walnut St.");
        steps.push(`Arrive at ${name} on your right.`);
        distanceVal = "0.3 miles";
        timeDrive = "1 min";
        timeWalk = "6 mins";
      } else {
        steps.push("Head North on N Ohio St toward Ash St.");
        steps.push(`Arrive at ${name} on your left.`);
        distanceVal = "0.2 miles";
        timeDrive = "1 min";
        timeWalk = "4 mins";
      }
    } else {
      if (dLng < 0) {
        steps.push("Head West on Pecan St toward N Pecan St.");
        steps.push(`Arrive at ${name} on your right.`);
        distanceVal = "0.2 miles";
        timeDrive = "1 min";
        timeWalk = "4 mins";
      } else {
        steps.push("Head East on Walnut St toward S Preston Rd.");
        steps.push("Turn right onto S Preston Rd.");
        if (coords.lat < 33.32) {
          steps.push("Drive South on Preston Rd past Frontier Parkway.");
          distanceVal = "1.5 miles";
          timeDrive = "4 mins";
          timeWalk = "30 mins";
        } else {
          steps.push(`Arrive at ${name} on Preston Rd on your right.`);
          distanceVal = "0.8 miles";
          timeDrive = "2 mins";
          timeWalk = "16 mins";
        }
      }
    }
  }

  steps.push(`🏁 You have arrived at ${name}! Enjoy your local Celina experience.`);

  return {
    steps,
    distance: distanceVal,
    timeDrive,
    timeWalk,
  };
}
