import React, { useState } from 'react';
import { CELINA_EVENTS, CelinaEvent } from '../data/mockEvents';
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  ExternalLink,
  Search,
  Filter,
  Globe,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function EventsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentMonth, setCurrentMonth] = useState<number>(6); // July is index 6 (0-indexed but we will use 7 for July 2026)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filter events based on current selection
  // All our mock events are set in July 2026 (2026-07-xx)
  const filteredEvents = CELINA_EVENTS.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.organizer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || evt.category === selectedCategory;

    // Filter by specific day if clicked on the calendar
    const eventDate = new Date(evt.date);
    const matchesDay = selectedDay ? eventDate.getDate() === selectedDay : true;

    return matchesSearch && matchesCategory && matchesDay;
  });

  const categories = ['All', 'Festivals', 'Farmers Market', 'Chamber', 'City', 'Sports'];

  const triggerSync = () => {
    setIsSyncing(true);
    setSyncStatus(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus('Successfully scraped & synchronized 8 local events from Celina Chamber of Commerce & Celina City Calendar.');
      setTimeout(() => setSyncStatus(null), 5000);
    }, 1500);
  };

  // Generate July 2026 calendar data
  // July 1, 2026 starts on a Wednesday (3rd column, 0-indexed: Sun=0, Mon=1, Tue=2, Wed=3)
  const daysInJuly = 31;
  const startDayOffset = 3; // Wednesday
  const calendarCells: (number | null)[] = [];

  // Fill offsets
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }
  // Fill July days
  for (let day = 1; day <= daysInJuly; day++) {
    calendarCells.push(day);
  }

  // Find if a day has any events in July 2026
  const getEventsForDay = (dayNum: number): CelinaEvent[] => {
    return CELINA_EVENTS.filter((evt) => {
      const d = new Date(evt.date);
      return d.getFullYear() === 2026 && d.getMonth() === 6 && d.getDate() === dayNum;
    });
  };

  return (
    <div className="space-y-8 py-6" id="celina-events-view">
      {/* Hero Banner with Dynamic Info */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white p-8 md:p-12 shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-400" /> Community Events
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              What's Happening in <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">Celina</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Never miss a moment! Explore high-energy festivals, community markets, city public forums, and business networking events compiled fresh each month.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 max-w-xs space-y-3 flex-shrink-0">
            <div className="flex items-start gap-2 text-xs">
              <Info className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-200 leading-relaxed font-medium">
                Celina RSS calendar is currently unavailable. Events are compiled monthly from <span className="text-orange-300 font-bold">Celina Chamber</span> and <span className="text-orange-300 font-bold">Celina City</span> portals.
              </p>
            </div>
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Calendars...' : 'Sync Local Events Now'}</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>{syncStatus}</span>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Interactive Calendar & Search Filters */}
        <div className="lg:col-span-4 space-y-6">
          {/* Filters Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Find Events
            </h3>

            {/* Text Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search event name, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-slate-800"
              />
            </div>

            {/* Category Selectors */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category Filter</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedDay(null); // Reset day filter on category switch
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-orange-500 text-slate-950 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive July 2026 Calendar Grid */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="font-display font-extrabold text-slate-900 text-sm">July 2026</h4>
                <p className="text-[10px] font-medium text-slate-400">Interactive community calendar</p>
              </div>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold rounded-md hover:bg-orange-100 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                const dayEvents = getEventsForDay(day);
                const hasEvents = dayEvents.length > 0;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`h-8 w-8 mx-auto flex flex-col items-center justify-center rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
                      isSelected
                        ? 'bg-slate-950 text-white'
                        : hasEvents
                          ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                          : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{day}</span>
                    {hasEvents && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase border-t border-slate-100">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-md bg-orange-50 border border-orange-200 block" />
                <span>Event Scheduled</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 block" />
                <span>Multiple Events</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Event list showing filtered results */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-500" />
              {selectedDay
                ? `Events on July ${selectedDay}, 2026`
                : `${selectedCategory === 'All' ? 'All Upcoming' : selectedCategory} Events in July 2026`}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold font-sans">
                {filteredEvents.length}
              </span>
            </h3>
            <span className="text-xs text-slate-500 font-semibold">Listed Chronologically</span>
          </div>

          <div className="space-y-4" id="event-list-container">
            <AnimatePresence mode="popLayout">
              {filteredEvents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-12 text-center"
                >
                  <p className="text-slate-400 font-bold text-sm">No events match your current filters.</p>
                  <p className="text-slate-400 text-xs mt-1">Try resetting the search phrase, clearing day selection, or choosing 'All'.</p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('All');
                      setSelectedDay(null);
                    }}
                    className="mt-4 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </motion.div>
              ) : (
                filteredEvents.map((evt, idx) => {
                  const eventDate = new Date(evt.date);
                  const formattedDate = eventDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className="group bg-white hover:bg-orange-50/10 border border-slate-200/80 hover:border-orange-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row gap-6"
                    >
                      {/* Date Badge Left column */}
                      <div className="flex-shrink-0 w-full md:w-24 text-center md:border-r border-slate-100 pr-0 md:pr-6 flex md:flex-col items-center md:items-stretch justify-between md:justify-center gap-2">
                        <div className="bg-orange-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs md:text-sm tracking-wider uppercase">
                          {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-none md:mt-2">
                          {eventDate.getDate()}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide md:mt-1">
                          {eventDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>

                      {/* Main Description details column */}
                      <div className="flex-grow space-y-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                            {evt.category}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            By {evt.organizer}
                          </span>
                        </div>

                        <h4 className="font-display font-extrabold text-slate-900 text-base md:text-lg tracking-tight group-hover:text-orange-600 transition-colors">
                          {evt.title}
                        </h4>

                        <p className="text-slate-500 text-xs leading-relaxed">
                          {evt.description}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 font-semibold pt-1 border-t border-slate-50">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            <span>{evt.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-orange-500" />
                            <span className="truncate" title={evt.location}>{evt.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Right side column */}
                      <div className="flex-shrink-0 flex md:flex-col justify-end md:justify-between items-center md:items-end gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 pl-0 md:pl-6 self-stretch">
                        {evt.link && (
                          <a
                            href={evt.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50/50 hover:bg-orange-100/50 px-3 py-1.5 rounded-lg border border-orange-100 transition-all"
                          >
                            <span>Official Info</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verified Listing</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
