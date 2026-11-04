import React, { useState } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, Users, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

const INITIAL_FORM = {
  name: '',
  business: '',
  email: '',
  guests: '1',
  notes: '',
  company: '',
};

type RsvpForm = typeof INITIAL_FORM;

export default function NetworkingEventView() {
  const [form, setForm] = useState<RsvpForm>(INITIAL_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const updateField = (field: keyof RsvpForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      await api.submitNetworkingEventRsvp({
        name: form.name.trim(),
        business: form.business.trim(),
        email: form.email.trim(),
        guests: form.guests === '5+' ? 5 : Number(form.guests) || 1,
        notes: form.notes.trim(),
        company: form.company,
      });
      setStatus('success');
      setMessage("You're on the list! We will see you at Voodoo Brewing Company on Monday, November 23.");
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'We could not save your RSVP right now. Please try again.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="rounded-3xl border border-orange-900/20 bg-gradient-to-b from-[#1e2a4a] via-[#3a2b4d] to-[#7a3b1e] p-8 text-center text-white shadow-lg sm:p-10">
          <p className="text-xs font-bold tracking-[0.25em] text-amber-300 uppercase">First Event</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Celina Connection</h1>
          <p className="mt-2 text-2xl font-bold tracking-wide text-amber-200">Networking Event</p>
          <div className="mx-auto mt-6 h-px w-24 bg-amber-300/70" />
          <p className="mt-6 text-lg font-bold">Monday, November 23, 2026</p>
          <p className="mt-1 text-lg font-bold">5:30 – 7:30 PM</p>
          <p className="mt-4 text-base font-semibold">Voodoo Brewing Company</p>
          <p className="text-sm text-white/80">1440 W Frontier Pkwy, Prosper, TX</p>
          <p className="mt-6 text-sm font-semibold tracking-wide text-amber-200">Connect. Collaborate. Grow.</p>
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase">First Event · Celina, Texas</p>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Local business owners, meet your neighbors. Come connect, collaborate, and grow — no pitch, no pressure,
              just Celina people doing business together.
            </p>
          </div>
          <div className="space-y-3 text-slate-800">
            <p className="flex items-start gap-3"><CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>Monday, November 23, 2026</strong></span></p>
            <p className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>5:30 – 7:30 PM</strong></span></p>
            <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>Voodoo Brewing Company – Frontier</strong><br />1440 W Frontier Pkwy, Ste 116, Prosper, TX 75078<br />On the Prosper / Celina border</span></p>
            <p className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span>Open to Celina-area business owners. Just RSVP below so we know how many to expect.</span></p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="#rsvp" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700">RSVP Below</a>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Voodoo+Brewing+Company+Frontier+1440+W+Frontier+Pkwy+Prosper+TX+75078"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Get Directions <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div id="rsvp" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-extrabold text-slate-900">RSVP for November 23</h2>
        <p className="mt-1 text-sm text-slate-600">RSVPs go to the Celina Connection team at info@celinaconnection.com.</p>
        {status === 'success' ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold leading-relaxed">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Your name *
              <input required value={form.name} onChange={(e) => updateField('name', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Jane Smith" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Business *
              <input required value={form.business} onChange={(e) => updateField('business', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="Your business name" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Email *
              <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="you@yourbusiness.com" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              How many attending? *
              <select value={form.guests} onChange={(e) => updateField('guests', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
                {['1', '2', '3', '4', '5+'].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              Anything we should know? (optional)
              <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="e.g. Bringing a business partner, first networking event, etc." />
            </label>
            <input type="text" tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => updateField('company', e.target.value)} className="hidden" aria-hidden="true" />
            {status === 'error' && <p className="text-sm font-semibold text-red-700 sm:col-span-2">{message}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={status === 'submitting'} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60">
                {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'submitting' ? 'Saving your RSVP…' : 'RSVP — See You Nov 23'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
