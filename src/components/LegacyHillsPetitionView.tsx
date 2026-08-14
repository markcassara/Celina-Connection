import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Home, MapPin, ShieldCheck, Users, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import PetitionActionEmail from './PetitionActionEmail';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  streetAddress: '',
  neighborhood: 'Legacy Hills',
  builder: '',
  comments: '',
  signatureDataUrl: '',
  eligibilityConfirmed: false,
  consent: false,
  company: '',
};

type PetitionForm = typeof INITIAL_FORM;

const PROMISED_AMENITIES = [
  'A neighborhood playground',
  'A community pool',
  'Additional recreational amenities',
  'A well-maintained, family-friendly environment',
];

const PETITION_CONCERNS = [
  {
    title: 'Completion of Promised Amenities',
    body: 'We request a clear, written timeline for the completion of all originally advertised community amenities, including any updates regarding changes to the original development plan.',
  },
  {
    title: 'Drainage Pond and Infrastructure',
    body: 'The neighborhood drainage basin has been a source of frustration since the beginning of the development. While we appreciate that work has recently begun to improve the area, we ask that the project be completed properly with long-term drainage solutions, appropriate grading, erosion control, landscaping, and an appearance that reflects the quality expected in our community.',
  },
  {
    title: 'Community Appearance During Construction',
    body: 'We recognize that active construction creates challenges. However, months and years of excessive mud, dirt-covered streets, overgrown grass, debris, and inconsistent maintenance create an unnecessary burden for current residents.',
  },
  {
    title: 'Communication and Transparency',
    body: 'Residents deserve consistent communication regarding project timelines, delays, and changes. We request periodic community updates so homeowners are informed rather than left to speculate about the future of our neighborhood.',
  },
];

const MAINTENANCE_REQUESTS = [
  'More frequent street cleaning',
  'Better mud control from construction traffic',
  'Regular mowing and landscaping of common areas and builder-owned lots',
  'Timely removal of construction debris',
  'Improved maintenance standards throughout the development',
];

const WHY_THIS_MATTERS = [
  'Strengthen property values',
  'Improve resident satisfaction',
  'Enhance safety and usability for families',
  'Build trust between homeowners, builders, developers, and community leadership',
  'Reflect positively on everyone involved in the development',
];

export default function LegacyHillsPetitionView() {
  const navigate = useNavigate();
  const [form, setForm] = useState<PetitionForm>(INITIAL_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const updateField = (field: keyof PetitionForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const prepareSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 160;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.strokeStyle = '#0f2d4d';
  };

  useEffect(() => {
    prepareSignatureCanvas();
    window.addEventListener('resize', prepareSignatureCanvas);
    return () => window.removeEventListener('resize', prepareSignatureCanvas);
  }, []);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    updateField('signatureDataUrl', canvas.toDataURL('image/png'));
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    const context = canvas?.getContext('2d');
    if (!canvas || !point || !context) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getCanvasPoint(event);
    const context = canvasRef.current?.getContext('2d');
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopSignature = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    saveSignature();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    updateField('signatureDataUrl', '');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    if (!form.signatureDataUrl) {
      setStatus('error');
      setMessage('Please draw your signature before submitting.');
      return;
    }

    try {
      await api.signLegacyHillsPetition(form);
      setStatus('success');
      setMessage('Your signature has been recorded. Thank you for standing with your neighbors.');
      setForm(INITIAL_FORM);
      clearSignature();
      window.setTimeout(() => navigate('/legacyhillspetition/signatures'), 900);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="py-10 sm:py-14" id="legacy-hills-petition-page">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-start">
        <div className="space-y-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-[var(--cc-deep-navy)] text-white p-7 sm:p-10 shadow-2xl shadow-[rgba(15,45,77,0.22)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.32),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.18),transparent_34%)]" />
            <div className="relative z-10 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-100">
                <Users className="h-4 w-4" />
                Private community petition
              </div>

              <div className="space-y-5">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95]">
                  Community Petition for the Completion of Promised Amenities and Improved Community Standards
                </h1>
                <p className="max-w-2xl text-base sm:text-lg leading-8 text-slate-200 font-medium">
                  For homeowners and residents of Pinnacle at Legacy Hills who want clear timelines, stronger communication, and completion of the community standards and amenities represented during the home-buying process.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  ['1', 'Sign with your household info'],
                  ['2', 'Your signature is recorded privately'],
                  ['3', 'Residents can share one organized voice'],
                ].map(([number, label]) => (
                  <div key={number} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black mb-3">{number}</div>
                    <p className="text-xs font-bold leading-5 text-slate-100">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Home className="h-6 w-6 text-orange-600 mb-3" />
              <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Neighbor-led</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Built for residents to quickly show support and stay informed.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <ShieldCheck className="h-6 w-6 text-orange-600 mb-3" />
              <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Easy follow-up</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">We keep signer information organized so neighbors can stay informed.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <MapPin className="h-6 w-6 text-orange-600 mb-3" />
              <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Pinnacle focused</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Address and neighborhood fields help keep the signature list connected to the community.</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-7">
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Petition statement</p>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[var(--cc-deep-navy)]">
                To Pulte Homes, the Pinnacle at Legacy Hills Development Team, HOA Leadership, City Officials, and all responsible parties
              </h2>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                We, the undersigned homeowners and residents of Pinnacle at Legacy Hills, respectfully submit this petition to express our growing concern regarding the continued delays in completing the community as it was represented to us during the home-buying process.
              </p>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                Many of us chose to invest in this neighborhood based on representations made during the sales process, including the promise of community amenities such as:
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {PROMISED_AMENITIES.map((item) => (
                <div key={item} className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-slate-800">
                  {item}
                </div>
              ))}
            </div>

            <p className="text-sm sm:text-base leading-7 text-slate-600">
              These amenities were presented as an important part of the vision for our community and played a meaningful role in many homeowners' decisions to purchase their homes. Years later, many of these commitments remain incomplete, significantly delayed, or have at times appeared to be at risk of being eliminated altogether.
            </p>

            <p className="text-sm sm:text-base leading-7 text-slate-600">
              In addition to the unfinished amenities, residents continue to experience several ongoing concerns that affect both quality of life and property values.
            </p>

            <div className="space-y-4">
              <h3 className="font-display text-xl font-black text-[var(--cc-deep-navy)]">Areas of Concern</h3>
              {PETITION_CONCERNS.map((concern, index) => (
                <div key={concern.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">Concern {index + 1}</p>
                  <h4 className="mt-1 font-display text-lg font-black text-[var(--cc-deep-navy)]">{concern.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{concern.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-lg font-black text-[var(--cc-deep-navy)]">Requested maintenance standards during construction</h3>
              <ul className="mt-4 grid sm:grid-cols-2 gap-3">
                {MAINTENANCE_REQUESTS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle className="mt-1 h-4 w-4 flex-shrink-0 text-orange-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-display text-xl font-black text-[var(--cc-deep-navy)]">Why This Matters</h3>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                Our homes represent one of the largest investments many of us will ever make. We are proud to live in Pinnacle at Legacy Hills and want to see it become the community that was envisioned and promoted.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {WHY_THIS_MATTERS.map((item) => (
                  <div key={item} className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-bold text-slate-800">
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                This petition is not intended to criticize for the sake of criticism. Rather, it is a respectful request for accountability, transparency, and partnership. We believe these issues can be addressed through open communication and a shared commitment to building a neighborhood that lives up to the expectations established when many of us chose to call Pinnacle at Legacy Hills home.
              </p>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                We respectfully request a written response outlining the status of these concerns, planned timelines, and any actions that will be taken to address them.
              </p>
              <p className="text-sm sm:text-base leading-7 text-slate-600">
                Thank you for your time and consideration.
              </p>
            </div>
          </div>

          <PetitionActionEmail />
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-[rgba(15,45,77,0.12)] sticky top-24">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Add your signature</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-[var(--cc-deep-navy)]">Pinnacle at Legacy Hills Petition</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Please use your real contact details so the signature list can be organized and residents can receive petition updates.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              aria-hidden="true"
              autoComplete="off"
              className="hidden"
              name="company"
              tabIndex={-1}
              value={form.company}
              onChange={(event) => updateField('company', event.target.value)}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                First name
                <input required value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
              </label>
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                Last name
                <input required value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
              </label>
            </div>

            <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
              Email
              <input required type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
            </label>

            <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
              Phone
              <input required type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
            </label>

            <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
              Street address
              <input required value={form.streetAddress} onChange={(event) => updateField('streetAddress', event.target.value)} placeholder="Street address in Legacy Hills" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
            </label>

            <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
              Neighborhood / section
              <input value={form.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                Builder
                <input value={form.builder} onChange={(event) => updateField('builder', event.target.value)} placeholder="Optional" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" />
              </label>
            </div>

            <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
              Notes or concern to include with your signature
              <textarea value={form.comments} onChange={(event) => updateField('comments', event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder="Optional: share why this matters to your household." />
            </label>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="legacy-hills-signature" className="text-sm font-bold text-slate-700">Draw your signature</label>
                <button type="button" onClick={clearSignature} className="text-xs font-black uppercase tracking-wider text-orange-700 hover:text-orange-900">Clear</button>
              </div>
              <canvas
                ref={canvasRef}
                id="legacy-hills-signature"
                aria-label="Draw your petition signature"
                className="h-36 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white"
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={stopSignature}
                onPointerCancel={stopSignature}
                onPointerLeave={stopSignature}
              />
              <p className="text-xs leading-5 text-slate-500">Use your mouse, trackpad, finger, or stylus.</p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input required type="checkbox" checked={form.eligibilityConfirmed} onChange={(event) => updateField('eligibilityConfirmed', event.target.checked)} className="mt-1 h-4 w-4 accent-orange-600" />
              <span>I confirm I am a homeowner, resident, or property stakeholder in Pinnacle at Legacy Hills.</span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input required type="checkbox" checked={form.consent} onChange={(event) => updateField('consent', event.target.checked)} className="mt-1 h-4 w-4 accent-orange-600" />
              <span>I authorize Celina Connection to record my signature and contact me about this petition.</span>
            </label>

            {message && (
              <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-2xl bg-[var(--cc-deep-navy)] px-5 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-[rgba(15,45,77,0.22)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {status === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {status === 'submitting' ? 'Recording signature...' : 'Sign the petition'}
              {status !== 'submitting' && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
