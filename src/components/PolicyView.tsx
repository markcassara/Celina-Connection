import React from 'react';
import { CreditCard, FileText, Lock, RefreshCw, ShieldCheck } from 'lucide-react';

const updatedDate = 'August 4, 2026';
const supportEmail = 'info@celinaconnection.com';

const sections = [
  {
    id: 'terms',
    title: 'Terms of Use',
    icon: <FileText className="w-5 h-5" />,
    points: [
      'Celina Connection is an independent local business directory for Celina, Texas businesses, events, and community information.',
      'Business owners are responsible for keeping their listing information accurate, lawful, and appropriate for public display.',
      'We may edit, reject, hide, or remove listings, photos, reviews, events, or account access that appear misleading, inappropriate, spam-like, unsafe, or unrelated to Celina-area business activity.',
      'Unclaimed listings may be created from public information or user submissions. A listing does not imply endorsement, partnership, or official affiliation.',
      'You may not use the site to post false information, impersonate another business, upload content you do not have rights to use, or interfere with the site experience for other users.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    icon: <Lock className="w-5 h-5" />,
    points: [
      'We collect information users provide, including business details, owner account email addresses, claim requests, event submissions, petition submissions, feedback messages, and payment-related account actions.',
      'Public business information may appear in the directory, search results, listing pages, featured sections, and local event areas.',
      'Private owner account details, password reset links, payment credentials, petition contact details, and admin records are not intentionally displayed to the public.',
      'Payments are handled through Stripe. Celina Connection does not store full card numbers.',
      'We may use trusted service providers such as Stripe, Vercel, GoHighLevel, email providers, hosting services, and database providers to operate the site and communicate with users.',
      'Users may request listing updates, ownership review, or listing removal by contacting us.',
    ],
  },
  {
    id: 'payments',
    title: 'Payments and Memberships',
    icon: <CreditCard className="w-5 h-5" />,
    points: [
      'Paid memberships unlock directory features based on the selected tier. Feature availability may change as Celina Connection improves the platform.',
      'Recurring memberships renew automatically unless canceled before the next billing date.',
      'Event promotion purchases are one-time payments for review and placement consideration of one eligible event.',
      'Event promotions may only be purchased for events scheduled within the next 30 days. Event listings expire after the event date.',
      'Premium featured placement depends on available inventory, listing eligibility, account status, and site layout.',
    ],
  },
  {
    id: 'refunds',
    title: 'Refunds and Cancellations',
    icon: <RefreshCw className="w-5 h-5" />,
    points: [
      'Memberships may be canceled at any time. Cancellation stops future renewals but does not automatically refund past billing periods.',
      'Because directory placement, listing tools, and event promotion review can begin shortly after purchase, payments are generally non-refundable once access or review has started.',
      'If you believe a charge was made in error, contact us within 7 days and we will review the situation in good faith.',
      'If Celina Connection cannot provide a purchased feature because of a platform issue, duplicate charge, or account setup problem, we may offer a refund, credit, or manual correction at our discretion.',
      'Approved refunds are returned through the original payment method when possible and may take several business days to appear depending on the payment provider and bank.',
    ],
  },
  {
    id: 'standards',
    title: 'Community Standards',
    icon: <ShieldCheck className="w-5 h-5" />,
    points: [
      'Celina Connection is designed to feel helpful, welcoming, and useful for local residents and business owners.',
      'We may remove content that includes harassment, adult content, hateful content, illegal activity, scams, deceptive claims, irrelevant promotions, or content that creates safety or trust concerns.',
      'Reviews and feedback may be moderated for abuse, spam, personal attacks, or unverifiable claims.',
      'Petition and community forms may collect private contact details for organization, verification, and follow-up. Public petition views should protect private personal information.',
    ],
  },
];

export default function PolicyView() {
  return (
    <div className="py-8 sm:py-12 space-y-8 animate-fade-in" id="policy-page">
      <section className="rounded-3xl bg-[var(--cc-deep-navy)] text-white overflow-hidden border border-[rgba(212,185,94,0.25)]">
        <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-300 border border-orange-400/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Celina Connection Policies
          </span>
          <div className="max-w-3xl space-y-3">
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Terms, Privacy, Payments, and Refunds</h2>
            <p className="text-sm sm:text-base leading-7 text-slate-300">
              These policies explain how Celina Connection handles listings, owner accounts, payments, event promotions, privacy, and community standards.
            </p>
            <p className="text-xs font-semibold text-slate-400">Last updated: {updatedDate}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">On this page</p>
          <div className="space-y-1">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-orange-50 hover:text-orange-700">
                {section.icon}
                {section.title}
              </a>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          {sections.map((section) => (
            <article key={section.id} id={section.id} className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  {section.icon}
                </div>
                <h3 className="font-display text-xl font-black text-[var(--cc-deep-navy)]">{section.title}</h3>
              </div>
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <article className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-7">
            <h3 className="font-display text-xl font-black text-[var(--cc-deep-navy)]">Questions or Requests</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              For billing questions, refund review, listing removal, privacy requests, or policy questions, contact the Celina Connection team at{' '}
              <a href={`mailto:${supportEmail}`} className="font-black text-orange-700 hover:text-orange-800 underline underline-offset-4">
                {supportEmail}
              </a>
              .
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              This page is provided as practical launch policy language for Celina Connection and is not legal advice. Policies may be updated as the platform grows.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
