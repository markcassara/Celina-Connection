import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, Mail, Send } from 'lucide-react';

/**
 * Take-action block for the Legacy Hills petition page.
 *
 * All addresses below are published, verified contacts:
 *  - City of Celina officials: decoded from the City's own staff directory
 *    at celina-tx.gov/directory.aspx (Cloudflare-obfuscated in the markup).
 *  - Pulte Homes + Centurion American: published on Centurion American's own
 *    Legacy Hills development page, which lists OSSDallas@pultegroup.com
 *    against the "Pinnacle" neighborhood specifically.
 *
 * Contact forms are kept as a secondary path in case a resident prefers them.
 * Nothing is transmitted or stored by this page.
 */

type Recipient = {
  name: string;
  role: string;
  email: string;
  group: 'developer' | 'city' | 'staff';
};

export const DEVELOPER_RECIPIENTS: Recipient[] = [
  { name: 'Pulte Homes', role: 'Builder — Pinnacle at Legacy Hills', email: 'OSSDallas@pultegroup.com', group: 'developer' },
  { name: 'Centurion American', role: 'Legacy Hills master developer', email: 'marketing@centurionamerican.com', group: 'developer' },
];

export const CITY_RECIPIENTS: Recipient[] = [
  { name: 'Ryan Tubbs', role: 'Mayor', email: 'rtubbs@celina-tx.gov', group: 'city' },
  { name: 'Philip Ferguson', role: 'Council, Place 1', email: 'pferguson@celina-tx.gov', group: 'city' },
  { name: 'Eddie Cawlfield', role: 'Council, Place 2', email: 'ecawlfield@celina-tx.gov', group: 'city' },
  { name: 'Andy Hopkins', role: 'Deputy Mayor Pro Tem, Place 3', email: 'ahopkins@celina-tx.gov', group: 'city' },
  { name: 'Shea Scott', role: 'Council, Place 4', email: 'sbscott@celina-tx.gov', group: 'city' },
  { name: 'Shane Lambert', role: 'Council, Place 5', email: 'rlambert@celina-tx.gov', group: 'city' },
  { name: 'Brandon Grumbles', role: 'Mayor Pro Tem, Place 6', email: 'bgrumbles@celina-tx.gov', group: 'city' },
];

// City staff who actually enforce drainage, grading, mud, and debris.
export const STAFF_RECIPIENTS: Recipient[] = [
  { name: 'Robert Ranc', role: 'City Manager', email: 'rranc@celina-tx.gov', group: 'staff' },
  { name: 'Dusty McAfee', role: 'Director of Development Services', email: 'dmcafee@celina-tx.gov', group: 'staff' },
  { name: 'William Janney', role: 'Director of Engineering', email: 'wjanney@celina-tx.gov', group: 'staff' },
  { name: 'Mike Green', role: 'Director of Code Services', email: 'mgreen@celina-tx.gov', group: 'staff' },
  { name: 'Andrew Figueroa', role: 'Director of Public Works', email: 'afigueroa@celina-tx.gov', group: 'staff' },
];

export const ALL_RECIPIENTS = [...DEVELOPER_RECIPIENTS, ...CITY_RECIPIENTS, ...STAFF_RECIPIENTS];

const CONTACT_FORMS = [
  { name: 'Pulte homeowner request form', url: 'https://www.pulte.com/warranty-request' },
  { name: 'Centurion American contact form', url: 'https://centurionamerican.com/contact/' },
];

const SUBJECT = 'Pinnacle at Legacy Hills — completion of promised amenities and community standards';

const buildBody = (name: string, street: string) => {
  const signOff = [name.trim(), street.trim()].filter(Boolean).join('\n');
  return `To Pulte Homes, Centurion American, and City of Celina leadership,

I am a homeowner or resident of Pinnacle at Legacy Hills in Celina, and I am asking for a clear, written response on the completion of our community.

Many of us purchased here based on what was represented during the sales process, including a neighborhood playground, a community pool, additional recreational amenities, and a well-maintained, family-friendly environment. Years later, several of those commitments remain incomplete, significantly delayed, or appear to be at risk.

I am specifically asking for:

1. Promised amenities. A written timeline for completing every originally advertised amenity, and disclosure of any change to the original development plan.

2. Drainage and infrastructure. That the neighborhood drainage basin work now underway be finished properly, with a long-term drainage solution, correct grading, erosion control, landscaping, and an appearance consistent with the quality this community was sold on.

3. Appearance during construction. Real maintenance standards while building continues: more frequent street cleaning, effective mud control from construction traffic, regular mowing of common areas and builder-owned lots, and timely removal of construction debris.

4. Communication and transparency. Periodic written updates to residents on timelines, delays, and changes, so homeowners are informed instead of left to speculate.

This is not criticism for its own sake. Our homes are the largest investment most of us will ever make, and finishing this community as promised protects property values, resident safety, and the reputation of everyone involved in the development.

Please provide a written response outlining the current status of each item above, the planned timeline, and the actions that will be taken.

Thank you for your time and consideration.

${signOff || '[Your name]\n[Your street, Pinnacle at Legacy Hills]'}`;
};

const encode = (value: string) => encodeURIComponent(value);

export default function PetitionActionEmail() {
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [includeStaff, setIncludeStaff] = useState(true);
  const [copied, setCopied] = useState('');
  const [showContacts, setShowContacts] = useState(false);

  const body = useMemo(() => buildBody(name, street), [name, street]);

  const to = DEVELOPER_RECIPIENTS.map((person) => person.email);
  const cc = useMemo(
    () => [...CITY_RECIPIENTS, ...(includeStaff ? STAFF_RECIPIENTS : [])].map((person) => person.email),
    [includeStaff],
  );

  const copyMessage = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`Subject: ${SUBJECT}\n\n${body}`);
      setCopied(token);
      window.setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopied('');
    }
  };

  const query = `cc=${encode(cc.join(','))}&subject=${encode(SUBJECT)}&body=${encode(body)}`;
  const mailtoHref = `mailto:${to.join(',')}?${query}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encode(to.join(','))}&cc=${encode(cc.join(','))}&su=${encode(SUBJECT)}&body=${encode(body)}`;
  const outlookHref = `https://outlook.live.com/mail/0/deeplink/compose?to=${encode(to.join(','))}&cc=${encode(cc.join(','))}&subject=${encode(SUBJECT)}&body=${encode(body)}`;

  const totalRecipients = to.length + cc.length;

  return (
    <div
      id="take-action-email"
      className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-7"
    >
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Take action</p>
        <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
          Send the message in one click
        </h2>
        <p className="text-sm sm:text-base leading-7 text-slate-600">
          Signing adds your name to the list. This puts it in front of the people who can act on it —
          Pulte, Centurion American, and City of Celina leadership, all in a single email.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
          Your name (optional)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Signs the bottom of the message"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700 block">
          Your street (optional)
          <input
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            placeholder="Shows you actually live here"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
        <div className="space-y-2">
          <h3 className="font-display text-lg font-black text-slate-950">
            Goes to {totalRecipients} recipients
          </h3>
          <p className="text-sm leading-6 text-slate-600">
            <span className="font-bold text-slate-800">To:</span> Pulte Homes and Centurion American.{' '}
            <span className="font-bold text-slate-800">CC:</span> the Mayor and all six Council members
            {includeStaff ? ', plus the five City directors who oversee engineering, drainage, code, and public works' : ''}.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeStaff}
            onChange={(event) => setIncludeStaff(event.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-orange-600"
          />
          <span>
            <span className="block text-sm font-black text-slate-900">
              Also CC City department directors
            </span>
            <span className="block text-xs leading-5 text-slate-600">
              City Manager, Development Services, Engineering, Code Services, and Public Works. These
              are the people who actually enforce drainage, grading, mud, and debris standards.
            </span>
          </span>
        </label>

        <a
          href={mailtoHref}
          onClick={() => copyMessage('mail')}
          className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-slate-900/20 transition hover:bg-orange-600 flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          Open email with message
        </a>

        <p className="text-xs leading-5 text-slate-500">
          Opens your mail app with everything filled in. Read it, edit anything, then hit send. The
          message is also copied to your clipboard as a backup. Prefer webmail?{' '}
          <a href={gmailHref} target="_blank" rel="noreferrer" className="font-bold text-orange-700 underline">
            Open in Gmail
          </a>{' '}
          or{' '}
          <a href={outlookHref} target="_blank" rel="noreferrer" className="font-bold text-orange-700 underline">
            open in Outlook
          </a>
          .
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-black text-slate-950">The message</h3>
          <button
            type="button"
            onClick={() => copyMessage('manual')}
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-700 hover:text-orange-900"
          >
            {copied === 'manual' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'manual' ? 'Copied' : 'Copy message'}
          </button>
        </div>
        <p className="text-xs font-bold text-slate-500">Subject: {SUBJECT}</p>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6 text-slate-600">
          {body}
        </pre>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          onClick={() => setShowContacts((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block font-display text-lg font-black text-slate-950">
              Email one recipient instead
            </span>
            <span className="block text-sm leading-6 text-slate-600">
              {ALL_RECIPIENTS.length} published addresses, each with the message already filled in.
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 flex-shrink-0 text-slate-500 transition ${showContacts ? 'rotate-180' : ''}`}
          />
        </button>

        {showContacts && (
          <div className="mt-4 space-y-4">
            {[
              { label: 'Builder and developer', list: DEVELOPER_RECIPIENTS },
              { label: 'Mayor and City Council', list: CITY_RECIPIENTS },
              { label: 'City department directors', list: STAFF_RECIPIENTS },
            ].map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {section.label}
                </p>
                <ul className="space-y-2">
                  {section.list.map((person) => (
                    <li key={person.email}>
                      <a
                        href={`mailto:${person.email}?subject=${encode(SUBJECT)}&body=${encode(body)}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-orange-300 hover:bg-orange-50"
                      >
                        <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-slate-900">{person.name}</span>
                          <span className="block text-xs font-bold text-slate-500">{person.role}</span>
                          <span className="block truncate text-xs text-slate-500">{person.email}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Official contact forms
              </p>
              {CONTACT_FORMS.map((form) => (
                <a
                  key={form.url}
                  href={form.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => copyMessage(form.url)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-orange-300 hover:bg-orange-50"
                >
                  {copied === form.url ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-orange-600" />
                  )}
                  <span className="text-sm font-bold text-slate-800">
                    {copied === form.url ? 'Message copied — paste it into their form' : form.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Your words stay on your device. Celina Connection does not collect, transmit, or store the
        message you send from this page. City addresses come from the published City of Celina staff
        directory; builder and developer addresses are published on Centurion American's own Legacy
        Hills development page.
      </p>
    </div>
  );
}
