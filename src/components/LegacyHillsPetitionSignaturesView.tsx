import React, { useEffect, useState } from 'react';
import { ArrowRight, FileText, Loader2, Lock, ShieldCheck, Users } from 'lucide-react';
import { api } from '../lib/api';

type PublicSignature = {
  id: string;
  displayName: string;
  neighborhood: string;
  builder?: string;
  signedAt: string;
};

export default function LegacyHillsPetitionSignaturesView({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const [signatures, setSignatures] = useState<PublicSignature[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api.listPublicLegacyHillsPetitionSignatures()
      .then((payload) => {
        if (!isMounted) return;
        setSignatures(payload.signatures || []);
        setTotal(payload.total || 0);
        setError('');
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'We could not load signatures right now.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="py-10 sm:py-14" id="legacy-hills-petition-signatures-page">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-[2rem] bg-[var(--cc-deep-navy)] text-white p-7 sm:p-10 shadow-2xl shadow-[rgba(15,45,77,0.22)]">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-5 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-100">
                <Users className="h-4 w-4" />
                Current petition signatures
              </div>
              <div>
                <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                  Pinnacle at Legacy Hills Petition Support
                </h1>
                <p className="mt-4 text-base sm:text-lg leading-8 text-slate-200 font-medium">
                  View the current signature count and protected signer list for the community petition. Private details such as email, phone, street address, and drawn signatures are only visible to the admin team for packet preparation.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 min-w-[180px]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-100">Total signatures</p>
              <div className="mt-2 font-display text-5xl font-black">{total}</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-orange-600 mb-3" />
            <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Verified Context</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Signers confirm they are homeowners, residents, or property stakeholders.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Lock className="h-6 w-6 text-orange-600 mb-3" />
            <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Privacy Protected</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Contact details, street addresses, and signatures are kept off this status page.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <FileText className="h-6 w-6 text-orange-600 mb-3" />
            <h2 className="font-display font-black text-[var(--cc-deep-navy)]">Packet Ready</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">The admin packet keeps the full signed record for formal submission.</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-black text-[var(--cc-deep-navy)]">Protected Signer List</h2>
              <p className="mt-1 text-sm text-slate-500">Names are shortened to protect private household information.</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('legacyhillspetition-sign')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--cc-deep-navy)] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-orange-600"
            >
              Add Signature
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="p-10 flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading signatures...
            </div>
          ) : error ? (
            <div className="m-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
          ) : signatures.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-display text-xl font-black text-[var(--cc-deep-navy)]">No signatures posted yet.</p>
              <p className="mt-2 text-sm text-slate-500">Be the first household to add support to the petition record.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {signatures.map((signature) => (
                <div key={signature.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-lg font-black text-[var(--cc-deep-navy)]">{signature.displayName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {[signature.neighborhood, signature.builder].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {new Date(signature.signedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
