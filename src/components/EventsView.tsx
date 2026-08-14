import React, { useState } from 'react';
import { CELINA_EVENTS, CelinaEvent } from '../data/mockEvents';
import { UserProfile } from '../types';
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  ExternalLink,
  Search,
  Sparkles,
  X,
  Megaphone,
  ShieldCheck,
  ArrowRight,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EventsViewProps {
  currentUser?: UserProfile;
  onOpenLogin?: () => void;
  onOpenEventWorkspace?: () => void;
  onPromoteEvent?: () => Promise<void> | void;
}

export default function EventsView({
  currentUser,
  onOpenLogin,
  onOpenEventWorkspace,
  onPromoteEvent,
}: EventsViewProps = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CelinaEvent | null>(null);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const isOwner = Boolean(currentUser?.isLoggedIn && currentUser.role !== 'admin');

  const handlePromoCheckout = async () => {
    if (!isOwner) {
      onOpenLogin?.();
      return;
    }
    if (!onPromoteEvent) {
      onOpenEventWorkspace?.();
      return;
    }
    setPromoMessage('');
    setIsOpeningCheckout(true);
    try {
      await onPromoteEvent();
    } catch (error) {
      setPromoMessage(error instanceof Error ? error.message : 'We could not open event promotion checkout right now.');
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  // Filter events based on current selection
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
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const categories = ['All', ...Array.from(new Set(CELINA_EVENTS.map((event) => event.category)))];

  const calendarYear = 2026;
  const calendarMonth = 7;
  const monthLabel = 'August 2026';
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const startDayOffset = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarCells: (number | null)[] = [];

  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  const getEventsForDay = (dayNum: number): CelinaEvent[] => {
    return CELINA_EVENTS.filter((evt) => {
      const d = new Date(evt.date);
      return d.getFullYear() === calendarYear && d.getMonth() === calendarMonth && d.getDate() === dayNum;
    });
  };

  return (
    <div className="space-y-8 py-6" id="celina-events-view">
      {/* Hero Banner with Dynamic Info */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[var(--cc-deep-navy)] via-[#1b4a78] to-[#143a63] text-white p-8 md:p-12 shadow-md">
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Interactive Calendar & Search Filters */}
        <div className="lg:col-span-4 space-y-6">
          {/* Filters Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="font-display text-sm font-bold text-[var(--cc-deep-navy)] uppercase tracking-wider border-b border-slate-100 pb-2">
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
                        ? 'bg-orange-500 text-[var(--cc-deep-navy)] shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Monthly Calendar Grid */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="font-display font-extrabold text-[var(--cc-deep-navy)] text-sm">{monthLabel}</h4>
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
                        ? 'bg-[var(--cc-deep-navy)] text-white'
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-[var(--cc-deep-navy)] flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-500" />
              {selectedDay
                ? `Events on August ${selectedDay}, 2026`
                : `${selectedCategory === 'All' ? 'All Upcoming' : selectedCategory} Events in August 2026`}
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
                      onClick={() => setSelectedEvent(evt)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedEvent(evt);
                        }
                      }}
                      className="group bg-white hover:bg-orange-50/10 border border-slate-200/80 hover:border-orange-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row gap-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {/* Date Badge Left column */}
                      <div className="flex-shrink-0 w-full md:w-24 text-center md:border-r border-slate-100 pr-0 md:pr-6 flex md:flex-col items-center md:items-stretch justify-between md:justify-center gap-2">
                        <div className="bg-orange-500 text-[var(--cc-deep-navy)] font-black px-3 py-1.5 rounded-xl text-xs md:text-sm tracking-wider uppercase">
                          {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-3xl md:text-4xl font-extrabold text-[var(--cc-deep-navy)] tracking-tight leading-none md:mt-2">
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

                        <h4 className="font-display font-extrabold text-[var(--cc-deep-navy)] text-base md:text-lg tracking-tight group-hover:text-orange-600 transition-colors">
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
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50/50 hover:bg-orange-100/50 px-3 py-1.5 rounded-lg border border-orange-100 transition-all"
                          >
                            <span>{evt.sourceLabel || 'Original Calendar'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedEvent(evt);
                          }}
                          className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--cc-deep-navy)]"
                        >
                          View Details
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-md" id="event-promotion-banner">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative bg-[var(--cc-deep-navy)] p-6 text-white sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-amber-400/10 pointer-events-none" />
            <div className="relative space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--cc-deep-navy)]">
                <Megaphone className="h-3.5 w-3.5" /> Intro rate: $5 per event
              </span>
              <div>
                <h3 className="font-display text-2xl font-black leading-tight sm:text-3xl">
                  Want Celina to see your next event?
                </h3>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-300">
                  Promote a grand opening, workshop, sale, fundraiser, networking meetup, or special local gathering in the Celina events guide.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 text-xs font-bold text-slate-200 sm:grid-cols-3">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-orange-400" /> Registered owners only
                </span>
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-orange-400" /> Within 30 days
                </span>
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-400" /> Reviewed before publishing
                </span>
              </div>
              {promoMessage && (
                <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-semibold text-amber-100">
                  {promoMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 bg-orange-50 p-6 sm:p-8">
            <div className="rounded-2xl border border-orange-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-700">How it works</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                Save your event from your owner dashboard, purchase the $5 promotion, and the Celina Connection team will confirm the details before it appears publicly.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={isOwner ? onOpenEventWorkspace : onOpenLogin}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--cc-deep-navy)] shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-100"
              >
                {isOwner ? 'Create Event' : 'Owner Sign In'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handlePromoCheckout}
                disabled={isOpeningCheckout}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--cc-deep-navy)] shadow-sm transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-70"
              >
                {isOpeningCheckout ? 'Opening Checkout...' : isOwner ? 'Promote Event - $5' : 'Owner Access'}
                {isOwner ? <Megaphone className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,45,77,0.62)] p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-[rgba(15,45,77,0.82)] p-2 text-white shadow-sm transition hover:bg-[var(--cc-deep-navy)]"
                aria-label="Close event details"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative h-56 overflow-hidden bg-slate-100 sm:h-72">
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.title}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--cc-deep-navy)]/70 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-16">
                  <span className="inline-flex rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--cc-deep-navy)]">
                    {selectedEvent.category}
                  </span>
                  <h3 className="mt-2 font-display text-2xl font-black leading-tight text-white sm:text-3xl">
                    {selectedEvent.title}
                  </h3>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-7">
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-orange-500" />
                    <span>{new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span>{selectedEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-500" />
                    <span>{selectedEvent.location}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hosted by</p>
                  <p className="mt-1 font-bold text-[var(--cc-deep-navy)]">{selectedEvent.organizer}</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Details</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{selectedEvent.description}</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Address</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{selectedEvent.address}</p>
                </div>

                {selectedEvent.link && (
                  <a
                    href={selectedEvent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--cc-deep-navy)] shadow-sm transition hover:bg-amber-400 sm:w-auto"
                  >
                    Open {selectedEvent.sourceLabel || 'Original Calendar'}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
