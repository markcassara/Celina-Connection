import React, { useState } from 'react';
import { Users, CheckCircle, Loader2, Store, Calendar, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES } from '../data/mockBusinesses';

const DIRECTORY_CATEGORIES = CATEGORIES.filter((category) => category !== 'All');

const INITIAL_FORM = {
  name: '',
  business: '',
  email: '',
  phone: '',
  category: '',
  website: '',
  description: '',
  eventUpdates: true,
  listInDirectory: true,
  company: '',
};

type RegistrationForm = typeof INITIAL_FORM;

export default function JoinView() {
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const updateField = (field: keyof RegistrationForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      await api.submitRegistration({
        name: form.name.trim(),
        business: form.business.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        category: form.category,
        website: form.website.trim(),
        description: form.description.trim(),
        eventUpdates: form.eventUpdates,
        listInDirectory: form.listInDirectory,
        company: form.company,
      });
      setStatus('success');
      setMessage("You're in! Thanks for joining Celina Connection. We'll send event updates to your email, and the team will review your business for the directory.");
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'We could not save your registration right now. Please try again.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="rounded-3xl border border-orange-900/20 bg-gradient-to-b from-[#1e2a4a] via-[#3a2b4d] to-[#7a3b1e] p-8 text-center text-white shadow-lg sm:p-10">
          <p className="text-xs font-bold tracking-[0.25em] text-amber-300 uppercase">Join Celina Connection</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Celina Connection</h1>
          <p className="mt-2 text-2xl font-bold tracking-wide text-amber-200">Join &amp; Get Listed</p>
          <div className="mx-auto mt-6 h-px w-24 bg-amber-300/70" />
          <p className="mt-6 text-base leading-relaxed text-white/90">
            One form, two things: join the community for event updates, and get your business listed in the Celina
            directory.
          </p>
          <p className="mt-6 text-sm font-semibold tracking-wide text-amber-200">Connect. Collaborate. Grow.</p>
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase">For Celina-area businesses</p>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Whether you run a shop on the square, a service business, or a side hustle from home — if you do
              business in Celina, you belong here.
            </p>
          </div>
          <div className="space-y-3 text-slate-800">
            <p className="flex items-start gap-3"><Calendar className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>Event updates</strong> — be first to hear about networking nights and community events.</span></p>
            <p className="flex items-start gap-3"><Store className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>Directory listing</strong> — your business in front of neighbors looking for exactly what you do.</span></p>
            <p className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span><strong>Community</strong> — meet other local owners, swap referrals, and grow together.</span></p>
            <p className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" /><span>Joining the email list for event updates is free. Directory listings start at $6/month or $60/year — the team reviews every listing before it goes live.</span></p>
          </div>
        </div>
      </div>

      <div id="join" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-extrabold text-slate-900">Join Celina Connection</h2>
        <p className="mt-1 text-sm text-slate-600">One form — join the community and get listed in the directory. Registrations go to the Celina Connection team at info@celinaconnection.com.</p>
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
              Phone (optional)
              <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="(972) 555-0100" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Business category *
              <select required value={form.category} onChange={(e) => updateField('category', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
                <option value="" disabled>Choose a category</option>
                {DIRECTORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Website (optional)
              <input type="text" value={form.website} onChange={(e) => updateField('website', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="yourbusiness.com" />
            </label>
            <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
              What do you do? (optional — 1–2 sentences for your directory listing)
              <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" placeholder="e.g. Family-owned bakery on the square — fresh sourdough, custom cakes, and coffee every morning." />
            </label>
            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={form.eventUpdates} onChange={(e) => updateField('eventUpdates', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900" />
                <span>Send me event updates <span className="font-normal text-slate-600">— networking nights and community events</span></span>
              </label>
              <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={form.listInDirectory} onChange={(e) => updateField('listInDirectory', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900" />
                <span>List my business in the directory <span className="font-normal text-slate-600">— reviewed by the team before it goes live</span></span>
              </label>
            </div>
            <input type="text" tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => updateField('company', e.target.value)} className="hidden" aria-hidden="true" />
            {status === 'error' && <p className="text-sm font-semibold text-red-700 sm:col-span-2">{message}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={status === 'submitting'} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60">
                {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'submitting' ? 'Saving your registration…' : 'Join Celina Connection'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
