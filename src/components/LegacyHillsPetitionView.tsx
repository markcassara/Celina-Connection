import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, Home, MapPin, ShieldCheck, Users, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  streetAddress: '',
  neighborhood: 'Legacy Hills',
  comments: '',
  signatureDataUrl: '',
  consent: false,
  company: '',
};

type PetitionForm = typeof INITIAL_FORM;

export default function LegacyHillsPetitionView() {
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
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.strokeStyle = '#0f172a';
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
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section className="py-10 sm:py-14" id="legacy-hills-petition-page">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-start">
        <div className="space-y-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-7 sm:p-10 shadow-2xl shadow-slate-900/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.32),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.18),transparent_34%)]" />
            <div className="relative z-10 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-100">
                <Users className="h-4 w-4" />
                Legacy Hills neighbor petition
              </div>

              <div className="space-y-5">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95]">
                  Protect the Legacy Hills neighborhood voice.
                </h1>
                <p className="max-w-2xl text-base sm:text-lg leading-8 text-slate-200 font-medium">
                  Celina Connection is collecting neighbor signatures so Legacy Hills residents can be counted together and contacted with petition updates.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  ['1', 'Sign with your household info'],
                  ['2', 'Your contact is saved in GHL'],
                  ['3', 'Neighbors get organized updates'],
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
              <h2 className="font-display font-black text-slate-900">Neighbor-led</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Built for residents to quickly show support and stay informed.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <ShieldCheck className="h-6 w-6 text-orange-600 mb-3" />
              <h2 className="font-display font-black text-slate-900">Verified contact capture</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Submissions are pushed into GoHighLevel with petition tags.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <MapPin className="h-6 w-6 text-orange-600 mb-3" />
              <h2 className="font-display font-black text-slate-900">Legacy Hills focused</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Address and neighborhood fields help keep the signature list local.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/10 sticky top-24">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Add your signature</p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-slate-950">Legacy Hills Petition</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Please use your real contact details so the signature list can be organized and followed up through GHL.
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
              <p className="text-xs leading-5 text-slate-500">Use your mouse, trackpad, finger, or stylus. This signature is saved with your GHL petition contact record.</p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input required type="checkbox" checked={form.consent} onChange={(event) => updateField('consent', event.target.checked)} className="mt-1 h-4 w-4 accent-orange-600" />
              <span>I confirm I am a Legacy Hills neighbor or stakeholder and authorize Celina Connection to record my signature and contact me about this petition.</span>
            </label>

            {message && (
              <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-slate-900/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
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
