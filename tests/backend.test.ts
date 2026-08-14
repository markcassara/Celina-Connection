import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { AddressInfo, createServer } from 'node:net';
import Stripe from 'stripe';

import { createApp } from '../server/app.ts';
import { CATEGORIES } from '../src/data/mockBusinesses.ts';
import { buildOwnerProfilePatch } from '../src/lib/ownerProfilePatch.ts';
import { countOutsideUserClaimedListings, isNewListing } from '../src/lib/listingVisuals.ts';
import { resolveDashboardPortalMode } from '../src/lib/navigation.ts';

const ADMIN_TOKEN = 'test-admin-token';
const TEST_LOGO_URL = 'data:image/png;base64,test-profile-image';
const TEST_COVER_URL = 'data:image/jpeg;base64,test-cover-image';

test('public dashboard menu leaves admin-login mode and opens the owner join page', () => {
  assert.equal(resolveDashboardPortalMode({ activeTab: 'dashboard', currentMode: 'admin', isLoggedIn: false }), 'owner');
  assert.equal(resolveDashboardPortalMode({ activeTab: 'owner-login', currentMode: 'admin', isLoggedIn: false }), 'owner');
  assert.equal(resolveDashboardPortalMode({ activeTab: 'admin-login', currentMode: 'owner', isLoggedIn: false }), 'admin');
  assert.equal(resolveDashboardPortalMode({ activeTab: 'dashboard', currentMode: 'admin', isLoggedIn: true, role: 'admin' }), 'admin');
});

test('direct admin dashboard hash keeps unauthenticated users in admin login intent', () => {
  assert.equal(
    resolveDashboardPortalMode({
      activeTab: 'dashboard',
      currentMode: 'owner',
      isLoggedIn: false,
      locationHash: '#dashboard-admin-listings',
    }),
    'admin',
  );
  assert.equal(
    resolveDashboardPortalMode({
      activeTab: 'dashboard',
      currentMode: 'owner',
      isLoggedIn: false,
      locationHash: '#dashboard-admin-bugs',
    }),
    'admin',
  );
  assert.equal(
    resolveDashboardPortalMode({
      activeTab: 'dashboard',
      currentMode: 'owner',
      isLoggedIn: false,
      locationHash: '#dashboard-admin-petition',
    }),
    'admin',
  );
});

test('new listing badge helper only marks listings from the first 30 days', () => {
  const now = new Date('2026-08-04T12:00:00.000Z').getTime();
  assert.equal(isNewListing({ createdAt: '2026-07-06T12:00:00.000Z' }, now), true);
  assert.equal(isNewListing({ createdAt: '2026-07-05T11:59:59.000Z' }, now), false);
  assert.equal(isNewListing({ createdAt: 'bad-date' }, now), false);
});

test('new business category dropdown keeps expanded local business options', () => {
  const categoryLabels = [...CATEGORIES] as string[];
  assert.ok(categoryLabels.includes('All'));
  for (const category of [
    'Activities & Community',
    'Beauty & Personal Care',
    'Childcare & Education',
    'Estate Planning',
    'Events & Venues',
    'Financial Services',
    'Legal Services',
    'Medical & Dental',
    'Mortgage & Lending',
    'Nonprofits & Churches',
    'Pet Services',
    'Professional Services',
    'Real Estate',
    'Shopping & Retail',
    'Trades & Contractors',
  ]) {
    assert.ok(categoryLabels.includes(category), `${category} should be available to new listings`);
  }
});

test('1-click business setup drafts a profile from a public website', async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousGoogleGeminiKey = process.env.GOOGLE_GEMINI_API_KEY;
  const previousGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  const websiteServer = createHttpServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html>
      <html>
        <head>
          <title>The Well Marketing Solutions</title>
          <meta name="description" content="Helping small businesses grow with marketing strategy, websites, lead generation, and content." />
          <meta property="og:image" content="/banner.jpg" />
        </head>
        <body>
          <a href="tel:2144949952">2144949952</a>
          <a href="mailto:kimberly@thewellmarketingsolutions.com">Email Kimberly</a>
        </body>
      </html>`);
  });
  await new Promise<void>((resolve) => websiteServer.listen(0, '127.0.0.1', () => resolve()));
  const websitePort = (websiteServer.address() as AddressInfo).port;

  try {
    await withServer(makeDbPath('business-discovery'), async (baseUrl) => {
      const discoverRes = await fetch(`${baseUrl}/api/owner/discover-business`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessName: 'The Well Marketing Solutions',
          website: `http://127.0.0.1:${websitePort}`,
        }),
      });
      assert.equal(discoverRes.status, 200);
      const body = await discoverRes.json();
      assert.equal(body.draft.name, 'The Well Marketing Solutions');
      assert.equal(body.draft.website, `http://127.0.0.1:${websitePort}/`);
      assert.match(body.draft.description, /Helping small businesses grow/);
      assert.equal(body.draft.phone, '2144949952');
      assert.equal(body.draft.email, 'kimberly@thewellmarketingsolutions.com');
      assert.equal(body.draft.coverImageUrl, `http://127.0.0.1:${websitePort}/banner.jpg`);
      assert.ok(body.draft.confidenceNotes.length > 0);
    });
  } finally {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousGoogleGeminiKey === undefined) delete process.env.GOOGLE_GEMINI_API_KEY;
    else process.env.GOOGLE_GEMINI_API_KEY = previousGoogleGeminiKey;
    if (previousGoogleKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = previousGoogleKey;
    await new Promise<void>((resolve, reject) => websiteServer.close((err) => (err ? reject(err) : resolve())));
  }
});

async function withServer(dbPath: string, run: (baseUrl: string) => Promise<void>) {
  const app = createApp({ dbPath });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

function makeDbPath(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'celina-backend-test-'));
  return path.join(dir, `${name}.sqlite`);
}

async function withFakeSmtp(run: (port: number, messages: string[]) => Promise<void>) {
  const messages: string[] = [];
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    let dataMode = false;
    let message = '';
    socket.write('220 fake-smtp.local ESMTP\r\n');
    socket.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (!line && !dataMode) continue;
        if (dataMode) {
          if (line === '.') {
            messages.push(message);
            message = '';
            dataMode = false;
            socket.write('250 Message accepted\r\n');
          } else {
            message += `${line}\n`;
          }
          continue;
        }
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) socket.write('250-fake-smtp.local\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (upper.startsWith('AUTH')) socket.write('235 Authentication successful\r\n');
        else if (upper.startsWith('MAIL FROM') || upper.startsWith('RCPT TO')) socket.write('250 OK\r\n');
        else if (upper.startsWith('DATA')) {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (upper.startsWith('QUIT')) {
          socket.write('221 Bye\r\n');
          socket.end();
        } else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    await run(port, messages);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function withHangingTcpServer(run: (port: number) => Promise<void>) {
  const sockets = new Set<any>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    await run(port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function withFakeGhl(run: (baseUrl: string, requests: Array<{ method: string; url: string; body: any; authorization?: string; version?: string }>) => Promise<void>) {
  const requests: Array<{ method: string; url: string; body: any; authorization?: string; version?: string }> = [];
  const server = createHttpServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push({
        method: req.method || 'GET',
        url: req.url || '',
        body,
        authorization: req.headers.authorization,
        version: req.headers.version as string | undefined,
      });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/contacts/upsert') {
        res.end(JSON.stringify({ contact: { id: 'contact-123' } }));
        return;
      }
      if (req.url === '/contacts/contact-123') {
        res.end(JSON.stringify({ contact: { id: 'contact-123' } }));
        return;
      }
      if (req.url === '/conversations/messages') {
        res.end(JSON.stringify({ messageId: 'message-123' }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`, requests);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('owner verification email can be delivered through GoHighLevel contact messaging', async () => {
  const dbPath = makeDbPath('ghl-verification');

  await withFakeGhl(async (ghlBaseUrl, requests) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;
    process.env.GHL_WELCOME_TAGS = 'celina-connection,owner-registration,welcome-email';
    process.env.GHL_PASSWORD_RESET_TAGS = 'celina-connection,password-reset';
    process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.BREVO_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/owner/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'GHL Mail Test',
            category: 'Home & Professional Services',
            description: 'A test listing for GHL delivery.',
            phone: '(972) 555-0196',
            email: 'owner-ghl@example.com',
            password: 'StrongPass123!',
            startedAt: Date.now() - 4000,
            company: '',
            logoUrl: TEST_LOGO_URL,
            images: [TEST_COVER_URL],
          }),
        });
        assert.equal(res.status, 201);
        assert.equal(requests.length, 4);
        assert.equal(requests[0].url, '/contacts/upsert');
        assert.equal(requests[0].authorization, 'Bearer test-ghl-key');
        assert.equal(requests[0].body.locationId, 'test-location-id');
        assert.equal(requests[0].body.email, 'owner-ghl@example.com');
        assert.deepEqual(requests[0].body.tags, ['celina-connection', 'owner-registration', 'welcome-email']);
        assert.equal(requests[1].url, '/conversations/messages');
        assert.equal(requests[1].body.type, 'Email');
        assert.equal(requests[1].body.contactId, 'contact-123');
        assert.equal(requests[1].body.emailTo, 'owner-ghl@example.com');
        assert.equal(requests[1].body.subject, 'Welcome to Celina Connection');
        assert.match(requests[1].body.html, /verify-email\?token=/);
        assert.match(requests[1].body.html, /Welcome to Celina Connection/);
        assert.match(requests[1].body.html, /Your submitted listing details/);
        assert.match(requests[1].body.html, /GHL Mail Test/);
        assert.match(requests[1].body.html, /Starting plan/);
        assert.match(requests[1].body.html, /Profile image/);
        assert.match(requests[1].body.html, /What happens next/);
        assert.equal(requests[2].url, '/contacts/upsert');
        assert.equal(requests[2].body.email, 'info@celinaconnection.com');
        assert.deepEqual(requests[2].body.tags, ['celina-connection', 'admin-notification', 'new-owner-registration']);
        assert.equal(requests[3].url, '/conversations/messages');
        assert.equal(requests[3].body.emailTo, 'info@celinaconnection.com');
        assert.equal(requests[3].body.subject, 'New Celina Connection user: GHL Mail Test');
        assert.match(requests[3].body.html, /owner-ghl@example\.com/);
        assert.match(requests[3].body.html, /Home &amp; Professional Services/);
        assert.match(requests[3].body.html, /Suggested review/);
        assert.match(requests[3].body.html, /Banner image/);
        assert.match(requests[3].body.html, /Open Celina Connection admin/);
      });
    } finally {
      for (const key of ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_API_BASE_URL', 'GHL_WELCOME_TAGS', 'CELINA_EXPOSE_VERIFICATION_LINK']) {
        delete process.env[key];
      }
    }
  });
});

test('owner forgot password sends reset through GoHighLevel and updates login password', async () => {
  const dbPath = makeDbPath('ghl-password-reset');

  await withFakeGhl(async (ghlBaseUrl, requests) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;
    process.env.GHL_WELCOME_TAGS = 'celina-connection,owner-registration,welcome-email';
    process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.BREVO_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const registerRes = await fetch(`${baseUrl}/api/owner/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Reset Link Books',
            category: 'Professional Services',
            description: 'Password reset test listing.',
            phone: '(972) 555-0147',
            email: 'reset-ghl@example.com',
            password: 'Original Strong Pass 42',
            startedAt: Date.now() - 4000,
            company: '',
            logoUrl: TEST_LOGO_URL,
            images: [TEST_COVER_URL],
          }),
        });
        assert.equal(registerRes.status, 201);
        const registered = await registerRes.json();
        const verificationToken = new URL(registered.verificationUrl).searchParams.get('token');
        assert.ok(verificationToken);
        assert.equal((await fetch(`${baseUrl}/api/owner/verify-email?token=${verificationToken}`)).status, 200);

        requests.length = 0;
        const forgotRes = await fetch(`${baseUrl}/api/owner/forgot-password`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'reset-ghl@example.com' }),
        });
        assert.equal(forgotRes.status, 200);
        assert.equal(requests.length, 2);
        assert.equal(requests[0].url, '/contacts/upsert');
        assert.equal(requests[0].body.email, 'reset-ghl@example.com');
        assert.deepEqual(requests[0].body.tags, ['celina-connection', 'password-reset']);
        assert.equal(requests[1].url, '/conversations/messages');
        assert.equal(requests[1].body.emailTo, 'reset-ghl@example.com');
        assert.match(requests[1].body.html, /reset-password\?token=/);

        const resetToken = new URL(requests[1].body.html.match(/https:\/\/www\.celinaconnection\.com\/reset-password\?token=[^"<>]+/)?.[0] || '').searchParams.get('token');
        assert.ok(resetToken);

        const resetRes = await fetch(`${baseUrl}/api/owner/reset-password`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password: 'Fresh Strong Pass 43' }),
        });
        assert.equal(resetRes.status, 200);
        const resetBody = await resetRes.json();
        assert.equal(resetBody.currentUser.email, 'reset-ghl@example.com');

        const oldLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'reset-ghl@example.com', password: 'Original Strong Pass 42' }),
        });
        assert.equal(oldLoginRes.status, 401);

        const newLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'reset-ghl@example.com', password: 'Fresh Strong Pass 43' }),
        });
        assert.equal(newLoginRes.status, 200);
      });
    } finally {
      for (const key of ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_API_BASE_URL', 'GHL_WELCOME_TAGS', 'GHL_PASSWORD_RESET_TAGS', 'CELINA_EXPOSE_VERIFICATION_LINK']) {
        delete process.env[key];
      }
    }
  });
});

test('admin can send future missing listing image reminders through GoHighLevel', async () => {
  const dbPath = makeDbPath('ghl-missing-visuals');

  await withFakeGhl(async (ghlBaseUrl, requests) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;
    process.env.GHL_MISSING_IMAGES_TAGS = 'celina-connection,missing-listing-images,72-hour-image-notice';
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const createRes = await fetch(`${baseUrl}/api/businesses`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-admin-token': ADMIN_TOKEN,
          },
          body: JSON.stringify({
            name: 'Missing Photo Market',
            category: 'Shopping & Retail',
            description: 'A listing that still needs its launch visuals.',
            phone: '(972) 555-0188',
            email: 'photos-needed@example.net',
            tier: 'free',
            ownerId: '',
            isUnclaimed: true,
          }),
        });
        assert.equal(createRes.status, 201);

        const notifyRes = await fetch(`${baseUrl}/api/admin/notifications/missing-visuals`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-admin-token': ADMIN_TOKEN,
          },
          body: JSON.stringify({ deadlineHours: 72, includeUnclaimed: true }),
        });
        assert.equal(notifyRes.status, 200);
        const payload = await notifyRes.json();
        assert.ok(payload.sent.some((item: any) => item.email === 'photos-needed@example.net'));

        const upsert = requests.find((request) => request.url === '/contacts/upsert' && request.body.email === 'photos-needed@example.net');
        assert.ok(upsert);
        assert.deepEqual(upsert.body.tags, ['celina-connection', 'missing-listing-images', '72-hour-image-notice']);
        const message = requests.find((request) => request.url === '/conversations/messages' && request.body.emailTo === 'photos-needed@example.net');
        assert.ok(message);
        assert.equal(message.body.subject, 'Action needed: add photos to keep your Celina Connection listing visible');
        assert.match(message.body.html, /profile image and banner image/);
        assert.match(message.body.html, /Update my listing/);
      });
    } finally {
      for (const key of ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_API_BASE_URL', 'GHL_MISSING_IMAGES_TAGS', 'ADMIN_API_TOKEN']) {
        delete process.env[key];
      }
    }
  });
});

test('legacy hills petition signature is captured as a tagged GoHighLevel contact', async () => {
  const dbPath = makeDbPath('legacy-hills-petition');

  await withFakeGhl(async (ghlBaseUrl, requests) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;
    process.env.GHL_LEGACY_HILLS_PETITION_TAGS = 'celina-connection,legacy-hills-petition,petition-signature';
    process.env.GHL_LEGACY_HILLS_NEIGHBORHOOD_FIELD_ID = 'field-neighborhood';
    process.env.GHL_LEGACY_HILLS_COMMENTS_FIELD_ID = 'field-comments';
    process.env.GHL_LEGACY_HILLS_SIGNATURE_FIELD_ID = 'field-signature';
    process.env.GHL_LEGACY_HILLS_SIGNED_AT_FIELD_ID = 'field-signed-at';

    try {
      await withServer(dbPath, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Jane',
            lastName: 'Neighbor',
            email: 'jane.neighbor@example.com',
            phone: '(972) 555-0112',
            streetAddress: '123 Legacy Hills Dr',
            neighborhood: 'Legacy Hills',
            comments: 'Please keep neighbors informed.',
            signatureDataUrl: 'data:image/png;base64,aGVsbG8=',
            eligibilityConfirmed: true,
            consent: true,
            company: '',
          }),
        });

        assert.equal(res.status, 201);
        const json = await res.json();
        assert.equal(json.ok, true);
        assert.equal(json.contactId, 'contact-123');
        assert.equal(requests.length, 2);
        assert.equal(requests[0].method, 'POST');
        assert.equal(requests[0].url, '/contacts/upsert');
        assert.equal(requests[0].authorization, 'Bearer test-ghl-key');
        assert.equal(requests[0].body.locationId, 'test-location-id');
        assert.equal(requests[0].body.firstName, 'Jane');
        assert.equal(requests[0].body.lastName, 'Neighbor');
        assert.equal(requests[0].body.email, 'jane.neighbor@example.com');
        assert.equal(requests[0].body.address1, '123 Legacy Hills Dr');
        assert.deepEqual(requests[0].body.tags, ['celina-connection', 'legacy-hills-petition', 'petition-signature']);
        assert.equal(requests[1].method, 'PUT');
        assert.equal(requests[1].url, '/contacts/contact-123');
        assert.deepEqual(requests[1].body.customFields.slice(0, 2), [
          { id: 'field-neighborhood', value: 'Legacy Hills' },
          { id: 'field-comments', value: 'Please keep neighbors informed.' },
        ]);
        assert.deepEqual(requests[1].body.customFields[2], { id: 'field-signature', value: 'data:image/png;base64,aGVsbG8=' });
        assert.equal(requests[1].body.customFields[3].id, 'field-signed-at');
      });
    } finally {
      for (const key of [
        'GHL_API_KEY',
        'GHL_LOCATION_ID',
        'GHL_API_BASE_URL',
        'GHL_LEGACY_HILLS_PETITION_TAGS',
        'GHL_LEGACY_HILLS_NEIGHBORHOOD_FIELD_ID',
        'GHL_LEGACY_HILLS_COMMENTS_FIELD_ID',
        'GHL_LEGACY_HILLS_SIGNATURE_FIELD_ID',
        'GHL_LEGACY_HILLS_SIGNED_AT_FIELD_ID',
      ]) {
        delete process.env[key];
      }
    }
  });
});


test('admin can view and export locally captured Legacy Hills petition signatures', async () => {
  const dbPath = makeDbPath('legacy-hills-petition-admin-export');

  await withFakeGhl(async (ghlBaseUrl) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const submit = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            firstName: 'City',
            lastName: 'Packet',
            email: 'city.packet@example.com',
            phone: '(972) 555-0177',
            streetAddress: '789 Legacy Hills Dr',
            neighborhood: 'Legacy Hills',
            builder: 'Pulte Homes',
            comments: 'Please include me in the packet.',
            signatureDataUrl: 'data:image/png;base64,aGVsbG8=',
            eligibilityConfirmed: true,
            consent: true,
            company: '',
          }),
        });
        assert.equal(submit.status, 201);
        const submittedPayload = await submit.json();
        assert.equal(submittedPayload.editToken, undefined);

        const list = await fetch(`${baseUrl}/api/admin/petitions/legacy-hills/signatures`, {
          headers: { 'x-admin-token': ADMIN_TOKEN },
        });
        assert.equal(list.status, 200);
        const payload = await list.json();
        assert.equal(payload.signatures.length, 1);
        assert.equal(payload.signatures[0].firstName, 'City');
        assert.equal(payload.signatures[0].streetAddress, '789 Legacy Hills Dr');
        assert.equal(payload.signatures[0].builder, 'Pulte Homes');
        assert.equal(payload.signatures[0].signatureDataUrl, 'data:image/png;base64,aGVsbG8=');

        const access = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures/access`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'city.packet@example.com', phone: '(972) 555-0177' }),
        });
        assert.equal(access.status, 404);

        const selfEdit = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures/${payload.signatures[0].id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload.signatures[0],
            comments: 'Updated by signer.',
          }),
        });
        assert.equal(selfEdit.status, 404);

        const adminEdit = await fetch(`${baseUrl}/api/admin/petitions/legacy-hills/signatures/${payload.signatures[0].id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
          body: JSON.stringify({
            ...payload.signatures[0],
            comments: 'Updated by admin.',
            builder: 'Pulte / Legacy Hills Team',
          }),
        });
        assert.equal(adminEdit.status, 200);
        const adminEditPayload = await adminEdit.json();
        assert.equal(adminEditPayload.signature.builder, 'Pulte / Legacy Hills Team');
        assert.equal(adminEditPayload.signature.comments, 'Updated by admin.');

        const publicList = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures`);
        assert.equal(publicList.status, 200);
        const publicPayload = await publicList.json();
        assert.equal(publicPayload.total, 1);
        assert.equal(publicPayload.signatures[0].displayName, 'City P.');
        assert.equal(publicPayload.signatures[0].phaseSection, undefined);
        assert.equal(publicPayload.signatures[0].builder, 'Pulte / Legacy Hills Team');
        assert.equal(publicPayload.signatures[0].email, undefined);
        assert.equal(publicPayload.signatures[0].phone, undefined);
        assert.equal(publicPayload.signatures[0].streetAddress, undefined);
        assert.equal(publicPayload.signatures[0].signatureDataUrl, undefined);

        const csv = await fetch(`${baseUrl}/api/admin/petitions/legacy-hills/export.csv`, {
          headers: { 'x-admin-token': ADMIN_TOKEN },
        });
        assert.equal(csv.status, 200);
        assert.match(csv.headers.get('content-disposition') || '', /legacy-hills-petition-signatures\.csv/);
        const csvText = await csv.text();
        assert.match(csvText, /City","Packet/);
        assert.match(csvText, /Pulte \/ Legacy Hills Team/);
        assert.doesNotMatch(csvText, /Phase \/ Section/);
        assert.doesNotMatch(csvText, /Lot \/ Block/);

        const doc = await fetch(`${baseUrl}/api/admin/petitions/legacy-hills/export`, {
          headers: { 'x-admin-token': ADMIN_TOKEN },
        });
        assert.equal(doc.status, 200);
        const html = await doc.text();
        assert.match(html, /Pinnacle at Legacy Hills Petition Signature Packet/);
        assert.match(html, /Completion of Promised Amenities/);
        assert.match(html, /Print \/ Save as PDF/);
        assert.match(html, /data:image\/png;base64,aGVsbG8=/);
        assert.doesNotMatch(html, /Phase \/ Section/);
        assert.doesNotMatch(html, /Lot \/ Block/);
      });
    } finally {
      for (const key of ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_API_BASE_URL', 'ADMIN_API_TOKEN']) {
        delete process.env[key];
      }
    }
  });
});

test('legacy hills petition requires neighbor consent before GHL sync', async () => {
  const dbPath = makeDbPath('legacy-hills-petition-consent');

  await withFakeGhl(async (ghlBaseUrl, requests) => {
    process.env.GHL_API_KEY = 'test-ghl-key';
    process.env.GHL_LOCATION_ID = 'test-location-id';
    process.env.GHL_API_BASE_URL = ghlBaseUrl;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/petitions/legacy-hills/signatures`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            firstName: 'No',
            lastName: 'Consent',
            email: 'noconsent@example.com',
            phone: '(972) 555-0113',
            streetAddress: '456 Legacy Hills Dr',
            signatureDataUrl: 'data:image/png;base64,aGVsbG8=',
            eligibilityConfirmed: true,
            consent: false,
            company: '',
          }),
        });

        assert.equal(res.status, 400);
        assert.equal(requests.length, 0);
      });
    } finally {
      for (const key of ['GHL_API_KEY', 'GHL_LOCATION_ID', 'GHL_API_BASE_URL']) {
        delete process.env[key];
      }
    }
  });
});

test('owner verification email can be delivered through SMTP configuration', async () => {
  const dbPath = makeDbPath('smtp-verification');

  await withFakeSmtp(async (smtpPort, messages) => {
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(smtpPort);
    process.env.SMTP_USER = 'info@celinaconnection.com';
    process.env.SMTP_PASS = 'workspace-app-password';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_FROM = 'Celina Connection <info@celinaconnection.com>';
    process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
    delete process.env.RESEND_API_KEY;
    delete process.env.BREVO_API_KEY;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/owner/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Workspace Mail Test',
            category: 'Home & Professional Services',
            description: 'A test listing for SMTP delivery.',
            phone: '(972) 555-0199',
            email: 'owner@workspacemail.com',
            password: 'StrongPass123!',
            startedAt: Date.now() - 4000,
            company: '',
            logoUrl: TEST_LOGO_URL,
            images: [TEST_COVER_URL],
          }),
        });
        assert.equal(res.status, 201);
        assert.equal(messages.length, 1);
        assert.match(messages[0], /To: owner@workspacemail\.com/);
        assert.match(messages[0], /Welcome to Celina Connection/);
        assert.match(messages[0], /verify-email\?token=/);
      });
    } finally {
      for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM', 'CELINA_EXPOSE_VERIFICATION_LINK']) {
        delete process.env[key];
      }
    }
  });
});

test('owner verification falls back to SMTP when Brevo is configured but unavailable', async () => {
  const dbPath = makeDbPath('brevo-fallback-smtp');

  await withHangingTcpServer(async (brevoPort) => {
    await withFakeSmtp(async (smtpPort, messages) => {
      process.env.BREVO_API_KEY = 'test-brevo-key';
      process.env.BREVO_API_URL = `http://127.0.0.1:${brevoPort}/v3/smtp/email`;
      process.env.EMAIL_DELIVERY_TIMEOUT_MS = '500';
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = String(smtpPort);
      process.env.SMTP_USER = 'info@celinaconnection.com';
      process.env.SMTP_PASS = 'workspace-app-password';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_FROM = 'Celina Connection <info@celinaconnection.com>';
      process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
      delete process.env.RESEND_API_KEY;

      try {
        await withServer(dbPath, async (baseUrl) => {
          const res = await fetch(`${baseUrl}/api/owner/register`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: 'Fallback Mail Test',
              category: 'Home & Professional Services',
              description: 'A test listing for email provider fallback.',
              phone: '(972) 555-0197',
              email: 'owner-fallback@example.com',
              password: 'StrongPass123!',
              startedAt: Date.now() - 4000,
              company: '',
              logoUrl: TEST_LOGO_URL,
              images: [TEST_COVER_URL],
            }),
          });
          assert.equal(res.status, 201);
          assert.equal(messages.length, 1);
          assert.match(messages[0], /To: owner-fallback@example\.com/);
        });
      } finally {
        for (const key of ['BREVO_API_KEY', 'BREVO_API_URL', 'EMAIL_DELIVERY_TIMEOUT_MS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM', 'CELINA_EXPOSE_VERIFICATION_LINK']) {
          delete process.env[key];
        }
      }
    });
  });
});

test('owner registration times out stalled email delivery and does not leave duplicate owner accounts', async () => {
  const dbPath = makeDbPath('email-timeout-registration');

  await withHangingTcpServer(async (emailPort) => {
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_API_URL = `http://127.0.0.1:${emailPort}/v3/smtp/email`;
    process.env.EMAIL_DELIVERY_TIMEOUT_MS = '500';
    delete process.env.SMTP_HOST;
    delete process.env.RESEND_API_KEY;

    try {
      await withServer(dbPath, async (baseUrl) => {
        const started = Date.now();
        const res = await fetch(`${baseUrl}/api/owner/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Timeout Mail Test',
            category: 'Home & Professional Services',
            description: 'A test listing for stalled email delivery.',
            phone: '(972) 555-0198',
            email: 'owner-timeout@example.com',
            password: 'StrongPass123!',
            startedAt: Date.now() - 4000,
            company: '',
            logoUrl: TEST_LOGO_URL,
            images: [TEST_COVER_URL],
          }),
        });
        assert.equal(res.status, 503);
        assert.ok(Date.now() - started < 3000, 'registration should fail fast instead of hanging indefinitely');
        const body = await res.json();
        assert.match(body.error, /couldn't send the verification email/i);
      });
    } finally {
      for (const key of ['BREVO_API_KEY', 'BREVO_API_URL', 'EMAIL_DELIVERY_TIMEOUT_MS']) {
        delete process.env[key];
      }
    }
  });

  process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
  try {
    await withServer(dbPath, async (baseUrl) => {
      const retryRes = await fetch(`${baseUrl}/api/owner/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Timeout Mail Test',
          category: 'Home & Professional Services',
          description: 'A retry after stalled email delivery.',
          phone: '(972) 555-0198',
          email: 'owner-timeout@example.com',
          password: 'StrongPass123!',
          startedAt: Date.now() - 4000,
          company: '',
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
      assert.equal(retryRes.status, 201);
    });
  } finally {
    delete process.env.CELINA_EXPOSE_VERIFICATION_LINK;
  }
});

test('GET /api/bootstrap seeds businesses and bug collection', async () => {
  const dbPath = makeDbPath('bootstrap');

  await withServer(dbPath, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/bootstrap`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.businesses));
    assert.ok(body.businesses.length >= 10);
    assert.ok(Array.isArray(body.reportedBugs));
    assert.equal(body.reportedBugs.length, 0);
    const lucys = body.businesses.find((business: any) => business.name === "Lucy's on the Square");
    assert.ok(lucys);
    assert.equal(lucys.featured, false);
    assert.equal(lucys.tier, 'basic');
  });
});

test('seed data includes demo featured listings for Celina Bistro and Celina Financial Planning', async () => {
  const dbPath = makeDbPath('featured-demo-listings');

  await withServer(dbPath, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/bootstrap`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const celinaBistro = body.businesses.find((business: any) => business.name === 'CELINA Bistro');
    assert.ok(celinaBistro);
    assert.equal(celinaBistro.featured, true);
    assert.equal(celinaBistro.tier, 'premium');
    assert.equal(celinaBistro.isUnclaimed, false);
    assert.equal(celinaBistro.ownerId, 'admin');
    assert.ok(celinaBistro.images[0].includes('photo-1514933651103'));

    const featuredNames = body.businesses
      .filter((business: any) => business.featured || business.tier === 'premium' || business.tier === 'pro')
      .map((business: any) => business.name);
    assert.ok(featuredNames.includes('CELINA Bistro'));
    assert.ok(!featuredNames.includes("Lucy's on the Square"));

    const celinaFinancial = body.businesses.find((business: any) => business.name === 'Celina Financial Planning Co.');
    assert.ok(celinaFinancial);
    assert.equal(celinaFinancial.featured, true);
    assert.equal(celinaFinancial.tier, 'premium');
    assert.equal(celinaFinancial.ownerId, 'admin');
    assert.equal(celinaFinancial.email, 'hello@celinafinancialplanning.com');
  });
});

test('existing databases promote demo placeholders and connect Celina financial plus Bistro to admin management', async () => {
  const dbPath = makeDbPath('existing-featured-placeholders');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      await fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          id: 'celina-financial-existing-owned',
          name: 'Celina Financial Planning Co.',
          category: 'Home & Professional Services',
          description: 'Existing owned profile',
          phone: '(972) 555-2222',
          email: 'hello@celinafinancialplanning.com',
          tier: 'basic',
          ownerId: 'owner-existing-admin',
          featured: false,
          isUnclaimed: false,
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }

  await withServer(dbPath, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/bootstrap`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const celinaFinancial = body.businesses.find((business: any) => business.id === 'celina-financial-existing-owned');

    assert.ok(celinaFinancial);
    assert.equal(celinaFinancial.featured, true);
    assert.equal(celinaFinancial.tier, 'premium');
    assert.equal(celinaFinancial.ownerId, 'admin');

    const celinaBistro = body.businesses.find((business: any) => business.name === 'CELINA Bistro');
    assert.ok(celinaBistro);
    assert.equal(celinaBistro.ownerId, 'admin');
  });
});

test('directory copy uses friendly claim and removal request wording', () => {
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(directorySource, /Claim this listing/);
  assert.match(directorySource, /Request to remove this listing/);
  assert.doesNotMatch(directorySource, /Secure Claim Review/);
});

test('directory cards and profile details show listing images for every visible tier', () => {
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(directorySource, /const primaryListingImage = \(business: Business\)/);
  assert.match(directorySource, /const cardImage = primaryListingImage\(b\)/);
  assert.match(directorySource, /alt=\{`\$\{b\.name\} banner image`\}/);
  assert.match(directorySource, /alt=\{`\$\{b\.name\} profile image`\}/);
  assert.match(directorySource, /src=\{primaryListingImage\(selectedBusiness\)\}/);
  assert.match(directorySource, /\{primaryListingImage\(selectedBusiness\) \? \(\s*<img/);
});

test('directory listings include share buttons with copy-link fallback', () => {
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(directorySource, /const handleShareListing = async \(business: Business/);
  assert.match(directorySource, /navigator\.share/);
  assert.match(directorySource, /navigator\.clipboard\.writeText\(url\)/);
  assert.match(directorySource, /share-listing-btn/);
  assert.match(directorySource, /Take a look at \$\{business\.name\} on Celina Connection/);
});

test('admin-created listings default to free and Growth Credits includes referral sharing instructions', () => {
  const dashboardSource = fs.readFileSync(path.join(process.cwd(), 'src/components/DashboardView.tsx'), 'utf8');
  const databaseSource = fs.readFileSync(path.join(process.cwd(), 'server/database.ts'), 'utf8');

  assert.match(dashboardSource, /const \[newTier, setNewTier\] = useState<Tier>\('free'\)/);
  assert.match(dashboardSource, /const \[acTier, setAcTier\] = useState<Tier>\('free'\)/);
  assert.match(dashboardSource, /tier: 'free',\n\s+isUnclaimed: true/);
  assert.match(dashboardSource, /setNewTier\('free'\)/);
  assert.match(databaseSource, /async createOwnedBusiness[\s\S]*tier: input\.tier \|\| 'free'/);
  assert.doesNotMatch(databaseSource, /async createOwnedBusiness[\s\S]*tier: 'basic'/);
  assert.match(dashboardSource, /const referralUrl = `\$\{typeof window/);
  assert.match(dashboardSource, /Share this link with customers/);
  assert.match(dashboardSource, /Copy Link/);
});

test('launch cap counts outside-user claimed listings and excludes demo or unclaimed records', () => {
  assert.equal(countOutsideUserClaimedListings([
    { tier: 'free', ownerId: 'owner-new', isUnclaimed: false, isRegistryOnly: false },
    { tier: 'free', ownerId: 'admin', isUnclaimed: false, isRegistryOnly: false },
    { tier: 'free', ownerId: '', isUnclaimed: true, isRegistryOnly: false },
    { tier: 'free', ownerId: 'owner-registry', isUnclaimed: false, isRegistryOnly: true },
    { tier: 'basic', ownerId: 'owner-paid', isUnclaimed: false, isRegistryOnly: false },
  ]), 2);
});

test('directory listings include real thumbs-up buttons and all unclaimed records stay in the unclaimed section', () => {
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(directorySource, /const handleLikeListing = async \(business: Business/);
  assert.match(directorySource, /const willLike = !likedIds\.has\(business\.id\)/);
  assert.match(directorySource, /onLikeBusiness\(business\.id, willLike\)/);
  assert.match(directorySource, /like-listing-btn/);
  assert.match(directorySource, /Remove your thumbs up/);
  assert.match(directorySource, /business\.isUnclaimed \|\| hasRequiredListingVisuals\(business\)/);
  assert.match(directorySource, /filteredUnclaimedBusinesses = orderedFilteredBusinesses\.filter\(\(business\) => business\.isUnclaimed && !isNewListing\(business\)\)/);
});

test('Claim Your Free Spot routes to registration instead of scrolling to the registry', () => {
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(directorySource, /Claim Your Free Spot/);
  assert.match(directorySource, /claimedBasicCount = countOutsideUserClaimedListings\(businesses\)/);
  assert.doesNotMatch(directorySource, /claimedBasicCount = countOutsideUserClaimedListings\(publicBusinesses\)/);
  assert.match(directorySource, /setActiveTab\?\.\('dashboard'\)/);
  assert.doesNotMatch(directorySource, /scrollIntoView\(\{ behavior: 'smooth' \}\)/);
});

test('pricing keeps paid Basic tier while adding separate free launch tier', () => {
  const pricingSource = fs.readFileSync(path.join(process.cwd(), 'src/components/PricingView.tsx'), 'utf8');
  const checkoutSource = fs.readFileSync(path.join(process.cwd(), 'src/components/CheckoutModal.tsx'), 'utf8');

  assert.match(pricingSource, /Free Launch Listing/);
  assert.match(pricingSource, /name: 'Local Pioneer \(Basic\)'/);
  assert.match(pricingSource, /price: billingCycle === 'year' \? '\$60' : '\$6'/);
  assert.match(checkoutSource, /case 'basic':/);
  assert.match(checkoutSource, /price: targetInterval === 'year' \? '\$60\.00' : '\$6\.00'/);
  assert.doesNotMatch(checkoutSource, /targetTier === 'basic'\) \{\n\s+onPaymentSuccess\('basic', 0\)/);
});

test('pricing and checkout copy keep free limited while Basic includes website and hours with no sandbox language', () => {
  const pricingSource = fs.readFileSync(path.join(process.cwd(), 'src/components/PricingView.tsx'), 'utf8');
  const checkoutSource = fs.readFileSync(path.join(process.cwd(), 'src/components/CheckoutModal.tsx'), 'utf8');
  const directorySource = fs.readFileSync(path.join(process.cwd(), 'src/components/DirectoryView.tsx'), 'utf8');

  assert.match(pricingSource, /notIncluded:[\s\S]*'Website link'[\s\S]*'Hours of operation'/);
  assert.match(pricingSource, /id: 'basic'[\s\S]*'Website link'[\s\S]*'Hours of operation'/);
  assert.match(pricingSource, /id: 'basic'[\s\S]*'Up to 5 image uploads'/);
  assert.match(pricingSource, /id: 'pro'[\s\S]*'Up to 10 image uploads \(Gallery\)'[\s\S]*'YouTube video section'/);
  assert.match(pricingSource, /id: 'premium'[\s\S]*'Up to 20 image uploads \(Full Gallery\)'[\s\S]*'YouTube video section'/);
  assert.doesNotMatch(pricingSource, /Comprehensive Feature Matrix/);
  assert.match(fs.readFileSync(path.join(process.cwd(), 'src/components/DashboardView.tsx'), 'utf8'), /tier === 'free' \? 1 : tier === 'basic' \? 5 : tier === 'pro' \? 10 : 20/);
  assert.match(checkoutSource, /Website link/);
  assert.match(checkoutSource, /Business hours/);
  assert.match(directorySource, /case 'free':[\s\S]*Free Listing/);
  assert.match(directorySource, /case 'basic':[\s\S]*Basic Partner/);
  assert.doesNotMatch(checkoutSource, /Or run in Simulated Sandbox Mode|Stripe Sandbox Active|Simulation Mode|simulated sandbox|test credit card/i);
});

test('pricing and navigation reflect post-launch tier and events changes', () => {
  const pricingSource = fs.readFileSync(path.join(process.cwd(), 'src/components/PricingView.tsx'), 'utf8');
  const headerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf8');
  const appSource = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const menuSource = fs.readFileSync(path.join(process.cwd(), 'src/config/menuItems.ts'), 'utf8');
  const eventsSource = fs.readFileSync(path.join(process.cwd(), 'src/components/EventsView.tsx'), 'utf8');
  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server/app.ts'), 'utf8');

  assert.match(pricingSource, /buttonText: 'Upgrade to Preston Elite'/);
  assert.doesNotMatch(pricingSource, /Preston Elite Launches July 12/);
  assert.match(pricingSource, /Local Events Promotion/);
  assert.match(pricingSource, /Business Boosts are on the way/);
  assert.doesNotMatch(pricingSource, /paid-tier add-on/);
  assert.match(headerSource, /label: 'Local Events'/);
  assert.doesNotMatch(headerSource, /Join as Business/);
  assert.match(appSource, /activeTab === 'events'/);
  assert.doesNotMatch(menuSource.match(/PUBLIC_MENU_ITEMS[\s\S]*?OWNER_MENU_ITEMS/)?.[0] || '', /legacyhillspetition|Legacy Hills Petition/);
  assert.match(menuSource.match(/ADMIN_MENU_ITEMS[\s\S]*?Helper/)?.[0] || '', /admin-petition/);
  assert.match(eventsSource, /selectedEvent/);
  assert.match(eventsSource, /Original Calendar/);
  assert.doesNotMatch(eventsSource, /Paid feature only/);
  assert.doesNotMatch(eventsSource, /Registered business owners only/);
  assert.doesNotMatch(eventsSource, /Sign In to Promote/);
  assert.match(appSource, /create-event-promotion-checkout-session/);
  assert.match(serverSource, /purchaseType: "event_promotion"/);
  assert.match(serverSource, /mode: "payment"/);
  assert.doesNotMatch(eventsSource, /Intro Offer: \$5 per event/);
  assert.doesNotMatch(eventsSource, /one checkout per event/);
});

test('global typography uses readable original Inter and Outfit font stack', () => {
  const cssSource = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

  assert.match(cssSource, /--font-sans: "Inter"/);
  assert.match(cssSource, /--font-display: "Outfit"/);
  assert.doesNotMatch(cssSource, /--font-brand|Cinzel|Montserrat/);
});

test('brand logo is used for favicon and default social preview metadata', () => {
  const indexSource = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const headerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Header.tsx'), 'utf8');
  const seoHeadSource = fs.readFileSync(path.join(process.cwd(), 'src/components/SeoHead.tsx'), 'utf8');
  const logoPath = '/images/celina-connection-logo.png';

  assert.ok(fs.existsSync(path.join(process.cwd(), 'public/images/celina-connection-logo.png')));
  assert.match(indexSource, new RegExp(`<link rel="icon" type="image/png" href="${logoPath}"`));
  assert.match(indexSource, new RegExp(`<link rel="apple-touch-icon" href="${logoPath}"`));
  assert.match(indexSource, /<meta property="og:image" content="https:\/\/www\.celinaconnection\.com\/images\/celina-connection-logo\.png" \/>/);
  assert.match(indexSource, /<meta name="twitter:image" content="https:\/\/www\.celinaconnection\.com\/images\/celina-connection-logo\.png" \/>/);
  assert.match(appSource, /const DEFAULT_OG_IMAGE = `\$\{SITE_URL\}\$\{BRAND_LOGO_PATH\}`/);
  assert.match(headerSource, /src=\{BRAND_LOGO_PATH\}/);
  assert.match(seoHeadSource, /https:\/\/www\.celinaconnection\.com\/images\/celina-connection-logo\.png/);
});

test('basic owner profile patches include address website and hours but keep premium fields locked', () => {
  const patch = buildOwnerProfilePatch('basic', {
    name: 'Celina Bakery',
    description: 'Fresh bread and pastries.',
    phone: '(972) 555-2222',
    email: 'owner@celinabakery.com',
    category: 'Dining',
    address: '127 N Ohio St, Celina, TX 75009',
    website: 'https://celinabakery.com',
    hours: {
      monFri: '7:00 AM - 4:00 PM',
      sat: '8:00 AM - 2:00 PM',
      sun: 'Closed',
    },
    ctaText: 'Order Now',
    socialLinks: {
      facebook: 'https://facebook.com/celinabakery',
    },
  });

  assert.equal(patch.address, '127 N Ohio St, Celina, TX 75009');
  assert.equal(patch.website, 'https://celinabakery.com');
  assert.deepEqual(patch.hours, {
    monFri: '7:00 AM - 4:00 PM',
    sat: '8:00 AM - 2:00 PM',
    sun: 'Closed',
  });
  assert.equal(patch.ctaText, undefined);
  assert.equal(patch.socialLinks, undefined);
});

test('free owner profile patches exclude website and hours while keeping public basics editable', () => {
  const patch = buildOwnerProfilePatch('free', {
    name: 'Free Celina Listing',
    description: 'Starter directory presence.',
    phone: '(972) 555-0101',
    email: 'free@celinalisting.com',
    category: 'Professional Services',
    address: 'Celina, TX',
    website: 'https://free-should-not-save.example',
    hours: {
      monFri: '9:00 AM - 5:00 PM',
      sat: 'Closed',
      sun: 'Closed',
    },
    ctaText: 'Book Now',
    socialLinks: {
      facebook: 'https://facebook.com/free',
    },
  });

  assert.equal(patch.address, 'Celina, TX');
  assert.equal(patch.website, undefined);
  assert.equal(patch.hours, undefined);
  assert.equal(patch.ctaText, undefined);
  assert.equal(patch.socialLinks, undefined);
});

test('pro owner profile patches include address website and hours but keep premium fields locked', () => {
  const patch = buildOwnerProfilePatch('pro', {
    name: 'Celina Bakery',
    description: 'Fresh bread and pastries.',
    phone: '(972) 555-2222',
    email: 'owner@celinabakery.com',
    category: 'Dining',
    address: '127 N Ohio St, Celina, TX 75009',
    website: 'https://celinabakery.com',
    hours: {
      monFri: '7:00 AM - 4:00 PM',
      sat: '8:00 AM - 2:00 PM',
      sun: 'Closed',
    },
    ctaText: 'Order Now',
    socialLinks: {
      facebook: 'https://facebook.com/celinabakery',
    },
  });

  assert.equal(patch.address, '127 N Ohio St, Celina, TX 75009');
  assert.equal(patch.website, 'https://celinabakery.com');
  assert.deepEqual(patch.hours, {
    monFri: '7:00 AM - 4:00 PM',
    sat: '8:00 AM - 2:00 PM',
    sun: 'Closed',
  });
  assert.equal(patch.ctaText, undefined);
  assert.equal(patch.socialLinks, undefined);
});

test('POST /api/businesses creates and persists a business', async () => {
  const dbPath = makeDbPath('create-business');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const createRes = await fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          name: 'Celina Planning Co.',
          category: 'Home & Professional Services',
          description: 'Estate planning and wealth guidance.',
          phone: '(972) 555-1000',
          email: 'hello@celinaplanning.com',
          tier: 'basic',
        }),
      });

      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      assert.equal(created.name, 'Celina Planning Co.');
      assert.ok(created.id);
      assert.equal(created.slug, 'celina-planning-co');

      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const body = await bootstrapRes.json();
      const found = body.businesses.find((business: any) => business.id === created.id);
      assert.ok(found);
      assert.equal(found.email, 'hello@celinaplanning.com');
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('self registration creates a free listing but requires email verification before login or public listing', async () => {
  const dbPath = makeDbPath('self-registration');
  process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
  process.env.PUBLIC_SITE_URL = 'https://www.celinaconnection.com';

  try {
    await withServer(dbPath, async (baseUrl) => {
      const registerRes = await fetch(`${baseUrl}/api/owner/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Self Serve Books',
          category: 'Shopping & Retail',
          description: 'Independent bookstore on the square.',
          phone: '(972) 555-7711',
          email: 'owner@selfservebooks.com',
          password: 'Correct Horse Battery 42',
          tier: 'premium',
          website: 'https://should-not-be-free.example',
          startedAt: Date.now() - 5000,
          company: '',
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });

      assert.equal(registerRes.status, 201);
      assert.equal(registerRes.headers.get('set-cookie'), null);
      const body = await registerRes.json();
      assert.equal(body.requiresEmailVerification, true);
      assert.equal(body.business.emailVerified, false);
      assert.equal(body.business.tier, 'free');
      assert.equal(body.business.website, 'https://should-not-be-free.example');
      assert.equal(body.business.isUnclaimed, false);
      assert.ok(body.business.ownerId);
      assert.match(body.verificationUrl, /^https:\/\/www\.celinaconnection\.com\/verify-email\?token=/);

      const hiddenBootstrap = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
      assert.equal(hiddenBootstrap.businesses.some((business: any) => business.id === body.business.id), false);

      const unverifiedLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@selfservebooks.com', password: 'Correct Horse Battery 42' }),
      });
      assert.equal(unverifiedLoginRes.status, 403);

      const token = new URL(body.verificationUrl).searchParams.get('token');
      assert.ok(token);
      const verifyRes = await fetch(`${baseUrl}/api/owner/verify-email?token=${token}`);
      assert.equal(verifyRes.status, 200);
      const cookie = verifyRes.headers.get('set-cookie') || '';
      assert.ok(cookie.includes('celina_owner_session='));
      assert.ok(cookie.includes('HttpOnly'));
      const verified = await verifyRes.json();
      assert.equal(verified.business.emailVerified, true);
      assert.equal(verified.currentUser.email, 'owner@selfservebooks.com');

      const visibleBootstrap = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
      assert.equal(visibleBootstrap.businesses.some((business: any) => business.id === body.business.id), true);

      const sessionRes = await fetch(`${baseUrl}/api/owner/session`, { headers: { cookie } });
      assert.equal(sessionRes.status, 200);
      const session = await sessionRes.json();
      assert.equal(session.currentUser.businessId, body.business.id);

      const replayRes = await fetch(`${baseUrl}/api/owner/verify-email?token=${token}`);
      assert.equal(replayRes.status, 400);
    });
  } finally {
    delete process.env.CELINA_EXPOSE_VERIFICATION_LINK;
    delete process.env.PUBLIC_SITE_URL;
  }
});

test('owner login supports password sign-in and owner-only safe profile updates', async () => {
  const dbPath = makeDbPath('owner-login-update');
  process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';

  try {
    await withServer(dbPath, async (baseUrl) => {
    const registerRes = await fetch(`${baseUrl}/api/owner/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Safe Update HVAC',
        category: 'Home & Professional Services',
        description: 'HVAC support in Celina.',
        phone: '(972) 555-8811',
        email: 'owner@safehvac.com',
        password: 'Correct Horse Battery 42',
        startedAt: Date.now() - 5000,
        company: '',
        logoUrl: TEST_LOGO_URL,
        images: [TEST_COVER_URL],
      }),
    });
    const registered = await registerRes.json();
    const verificationToken = new URL(registered.verificationUrl).searchParams.get('token');
    assert.ok(verificationToken);
    assert.equal((await fetch(`${baseUrl}/api/owner/verify-email?token=${verificationToken}`)).status, 200);

    const badLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@safehvac.com', password: 'wrong' }),
    });
    assert.equal(badLoginRes.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/owner/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@safehvac.com', password: 'Correct Horse Battery 42' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie') || '';

    const updateRes = await fetch(`${baseUrl}/api/owner/businesses/${registered.business.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'Safe Update HVAC & Plumbing',
        address: '123 Main St, Celina, TX 75009',
        website: 'https://locked-on-basic.example',
        tier: 'premium',
        featured: true,
        logoUrl: 'data:image/png;base64,logo',
        images: ['data:image/png;base64,one', 'data:image/png;base64,two'],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.name, 'Safe Update HVAC & Plumbing');
    assert.equal(updated.address, '123 Main St, Celina, TX 75009');
    assert.equal(updated.website, '');
    assert.equal(updated.tier, 'free');
    assert.equal(updated.featured, false);
    assert.equal(updated.logoUrl, 'data:image/png;base64,logo');
    assert.deepEqual(updated.images, ['data:image/png;base64,one']);

    const bootstrap = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
    const persisted = bootstrap.businesses.find((business: any) => business.id === registered.business.id);
    assert.equal(persisted.address, '123 Main St, Celina, TX 75009');
    assert.equal(persisted.logoUrl, 'data:image/png;base64,logo');
    assert.deepEqual(persisted.images, ['data:image/png;base64,one']);
    });
  } finally {
    delete process.env.CELINA_EXPOSE_VERIFICATION_LINK;
  }
});

test('paid basic owner can save website and hours after upgrading from free', async () => {
  const dbPath = makeDbPath('paid-basic-owner-update');
  process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const registerRes = await fetch(`${baseUrl}/api/owner/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Basic Hours Shop',
          category: 'Shopping & Retail',
          description: 'Retail shop with paid basic directory features.',
          phone: '(972) 555-3030',
          email: 'owner@basichoursshop.com',
          password: 'Correct Horse Battery 42',
          startedAt: Date.now() - 5000,
          company: '',
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
      assert.equal(registerRes.status, 201);
      const registered = await registerRes.json();
      assert.equal(registered.business.tier, 'free');
      const verificationToken = new URL(registered.verificationUrl).searchParams.get('token');
      assert.ok(verificationToken);
      assert.equal((await fetch(`${baseUrl}/api/owner/verify-email?token=${verificationToken}`)).status, 200);

      const upgradeRes = await fetch(`${baseUrl}/api/businesses/${registered.business.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ tier: 'basic' }),
      });
      assert.equal(upgradeRes.status, 200);

      const loginRes = await fetch(`${baseUrl}/api/owner/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@basichoursshop.com', password: 'Correct Horse Battery 42' }),
      });
      assert.equal(loginRes.status, 200);
      const cookie = loginRes.headers.get('set-cookie') || '';

      const updateRes = await fetch(`${baseUrl}/api/owner/businesses/${registered.business.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          website: 'https://basichoursshop.example',
          hours: {
            monFri: '8:00 AM - 6:00 PM',
            sat: '9:00 AM - 3:00 PM',
            sun: 'Closed',
          },
          socialLinks: { facebook: 'https://facebook.com/should-still-lock' },
        }),
      });
      assert.equal(updateRes.status, 200);
      const updated = await updateRes.json();
      assert.equal(updated.tier, 'basic');
      assert.equal(updated.website, 'https://basichoursshop.example');
      assert.deepEqual(updated.hours, {
        monFri: '8:00 AM - 6:00 PM',
        sat: '9:00 AM - 3:00 PM',
        sun: 'Closed',
      });
      assert.deepEqual(updated.socialLinks, {});
    });
  } finally {
    delete process.env.CELINA_EXPOSE_VERIFICATION_LINK;
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('admin listing edit modal exposes profile info plus logo and image management controls', () => {
  const dashboardSource = fs.readFileSync(path.join(process.cwd(), 'src/components/DashboardView.tsx'), 'utf8');

  assert.match(dashboardSource, /Listing Media/);
  assert.match(dashboardSource, /Upload Profile Image/);
  assert.match(dashboardSource, /Upload Banner Images/);
  assert.match(dashboardSource, /Business Description/);
  assert.match(dashboardSource, /Website URL/);
  assert.match(dashboardSource, /Owner Assignment \/ CRM Access/);
  assert.match(dashboardSource, /Owner Login Email/);
  assert.match(dashboardSource, /Set \/ Change Password/);
});

test('self registration rejects spam traps, too-fast submissions, duplicate emails, and weak passwords', async () => {
  const dbPath = makeDbPath('registration-spam');

  await withServer(dbPath, async (baseUrl) => {
    const submit = (overrides: Record<string, unknown>) => fetch(`${baseUrl}/api/owner/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Spam Guard Bakery',
        category: 'Dining',
        description: 'Fresh pastries and coffee in Celina.',
        phone: '(972) 555-9911',
        email: 'owner@spamguardbakery.com',
        password: 'Correct Horse Battery 42',
        startedAt: Date.now() - 5000,
        company: '',
        logoUrl: TEST_LOGO_URL,
        images: [TEST_COVER_URL],
        ...overrides,
      }),
    });

    assert.equal((await submit({ company: 'bot-filled' })).status, 400);
    assert.equal((await submit({ startedAt: Date.now() })).status, 429);
    assert.equal((await submit({ password: 'short' })).status, 400);
    assert.equal((await submit({})).status, 201);
    assert.equal((await submit({ name: 'Duplicate Email LLC' })).status, 409);
  });
});

test('listings require a profile image and banner image before owner approval', async () => {
  const dbPath = makeDbPath('listing-visuals-required');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const registerMissingVisualsRes = await fetch(`${baseUrl}/api/owner/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'No Photo Cafe',
          category: 'Dining',
          description: 'Coffee and breakfast near downtown Celina.',
          phone: '(972) 555-4040',
          email: 'owner@nophotocafe.com',
          password: 'Correct Horse Battery 42',
          startedAt: Date.now() - 5000,
          company: '',
        }),
      });
      assert.equal(registerMissingVisualsRes.status, 400);
      assert.match((await registerMissingVisualsRes.json()).error, /profile image and banner image/i);

      const createUnclaimedRes = await fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          name: 'Awaiting Photos Boutique',
          category: 'Shopping & Retail',
          description: 'A draft listing waiting on approved photos.',
          phone: '(972) 555-4141',
          email: 'hello@awaitingphotos.com',
          tier: 'basic',
          isUnclaimed: true,
        }),
      });
      assert.equal(createUnclaimedRes.status, 201);
      const draft = await createUnclaimedRes.json();

      const approveWithoutVisualsRes = await fetch(`${baseUrl}/api/businesses/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          isUnclaimed: false,
          ownerEmail: 'owner@awaitingphotos.com',
          ownerPassword: 'Correct Horse Battery 42',
        }),
      });
      assert.equal(approveWithoutVisualsRes.status, 400);
      assert.match((await approveWithoutVisualsRes.json()).error, /profile image and banner image/i);

      const approveWithVisualsRes = await fetch(`${baseUrl}/api/businesses/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          isUnclaimed: false,
          ownerEmail: 'owner@awaitingphotos.com',
          ownerPassword: 'Correct Horse Battery 42',
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
      assert.equal(approveWithVisualsRes.status, 200);
      const approved = await approveWithVisualsRes.json();
      assert.equal(approved.isUnclaimed, false);
      assert.equal(approved.logoUrl, TEST_LOGO_URL);
      assert.deepEqual(approved.images, [TEST_COVER_URL]);

      const removeVisualsRes = await fetch(`${baseUrl}/api/businesses/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ logoUrl: '', images: [] }),
      });
      assert.equal(removeVisualsRes.status, 400);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('admin login creates an http-only session that authorizes protected routes', async () => {
  const dbPath = makeDbPath('admin-session');
  process.env.ADMIN_PASSWORD = 'correct-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';

  try {
    await withServer(dbPath, async (baseUrl) => {
      const deniedRes = await fetch(`${baseUrl}/api/admin/session`);
      assert.equal(deniedRes.status, 401);

      const badLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      assert.equal(badLoginRes.status, 401);

      const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
      assert.equal(loginRes.status, 200);
      const cookie = loginRes.headers.get('set-cookie');
      assert.ok(cookie?.includes('celina_admin_session='));
      assert.ok(cookie?.includes('HttpOnly'));

      const sessionRes = await fetch(`${baseUrl}/api/admin/session`, {
        headers: { cookie: cookie || '' },
      });
      assert.equal(sessionRes.status, 200);

      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses[0];

      const updateRes = await fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: cookie || '' },
        body: JSON.stringify({ featured: true }),
      });
      assert.equal(updateRes.status, 200);
    });
  } finally {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  }
});

test('admin login rejects default passwords and requires configured credentials', async () => {
  const dbPath = makeDbPath('admin-no-defaults');
  process.env.ADMIN_PASSWORD = 'correct-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';

  try {
    await withServer(dbPath, async (baseUrl) => {
      for (const password of ['admin', 'admin123', 'password', 'celina2026', 'CelinaAdmin']) {
        const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        assert.equal(loginRes.status, 401);
      }

      const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
      assert.equal(loginRes.status, 200);
    });
  } finally {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  }
});

test('admin session remains valid across refreshes for a few days but expires after a week', async () => {
  const dbPath = makeDbPath('admin-session-days');
  process.env.ADMIN_PASSWORD = 'correct-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';
  const realDateNow = Date.now;
  const issuedAt = realDateNow();

  try {
    Date.now = () => issuedAt;
    await withServer(dbPath, async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
      assert.equal(loginRes.status, 200);
      const cookie = loginRes.headers.get('set-cookie') || '';
      assert.match(cookie, /Max-Age=604800/);

      Date.now = () => issuedAt + 1000 * 60 * 60 * 24 * 3;
      const refreshedSessionRes = await fetch(`${baseUrl}/api/admin/session`, { headers: { cookie } });
      assert.equal(refreshedSessionRes.status, 200);

      Date.now = () => issuedAt + 1000 * 60 * 60 * 24 * 8;
      const expiredSessionRes = await fetch(`${baseUrl}/api/admin/session`, { headers: { cookie } });
      assert.equal(expiredSessionRes.status, 401);
    });
  } finally {
    Date.now = realDateNow;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  }
});

test('owner session remains valid across refreshes for a few days but expires after a week', async () => {
  const dbPath = makeDbPath('owner-session-days');
  process.env.CELINA_EXPOSE_VERIFICATION_LINK = 'true';
  const realDateNow = Date.now;
  const issuedAt = realDateNow();

  try {
    Date.now = () => issuedAt;
    await withServer(dbPath, async (baseUrl) => {
      const registerRes = await fetch(`${baseUrl}/api/owner/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Refresh Session Flowers',
          category: 'Shopping & Retail',
          description: 'Florist serving Celina families.',
          phone: '(972) 555-4422',
          email: 'owner@refreshflowers.com',
          password: 'Correct Horse Battery 42',
          startedAt: issuedAt - 5000,
          company: '',
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
      assert.equal(registerRes.status, 201);
      const registered = await registerRes.json();
      const verificationToken = new URL(registered.verificationUrl).searchParams.get('token');
      assert.ok(verificationToken);

      const verifyRes = await fetch(`${baseUrl}/api/owner/verify-email?token=${verificationToken}`);
      assert.equal(verifyRes.status, 200);
      const cookie = verifyRes.headers.get('set-cookie') || '';
      assert.match(cookie, /Max-Age=604800/);

      Date.now = () => issuedAt + 1000 * 60 * 60 * 24 * 3;
      const refreshedSessionRes = await fetch(`${baseUrl}/api/owner/session`, { headers: { cookie } });
      assert.equal(refreshedSessionRes.status, 200);

      Date.now = () => issuedAt + 1000 * 60 * 60 * 24 * 8;
      const expiredSessionRes = await fetch(`${baseUrl}/api/owner/session`, { headers: { cookie } });
      assert.equal(expiredSessionRes.status, 401);
    });
  } finally {
    Date.now = realDateNow;
    delete process.env.CELINA_EXPOSE_VERIFICATION_LINK;
  }
});

test('public claim requests can be submitted and reviewed by admin session', async () => {
  const dbPath = makeDbPath('claim-requests');
  process.env.ADMIN_PASSWORD = 'correct-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';

  try {
    await withServer(dbPath, async (baseUrl) => {
      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses.find((business: any) => business.isUnclaimed);
      assert.ok(target);

      const createClaimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId: target.id,
          requesterName: 'Owner Person',
          requesterEmail: 'owner@example.com',
          requesterPhone: '(972) 555-4444',
          role: 'Owner',
          notes: 'I own this business.',
        }),
      });
      assert.equal(createClaimRes.status, 201);
      const claim = await createClaimRes.json();
      assert.equal(claim.status, 'pending');
      assert.equal(claim.businessId, target.id);

      const unauthorizedListRes = await fetch(`${baseUrl}/api/admin/claims`);
      assert.equal(unauthorizedListRes.status, 401);

      const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
      const cookie = loginRes.headers.get('set-cookie') || '';

      const listRes = await fetch(`${baseUrl}/api/admin/claims`, { headers: { cookie } });
      assert.equal(listRes.status, 200);
      const claims = await listRes.json();
      assert.equal(claims.length, 1);

      const approveRes = await fetch(`${baseUrl}/api/admin/claims/${claim.id}/approve`, {
        method: 'POST',
        headers: { cookie },
      });
      assert.equal(approveRes.status, 200);
      const approved = await approveRes.json();
      assert.equal(approved.claim.status, 'approved');
      assert.equal(approved.business.isUnclaimed, false);
      assert.equal(approved.business.email, 'owner@example.com');
    });
  } finally {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  }
});

test('POST /api/businesses/:id/claim requires admin auth and works with a server token', async () => {
  const dbPath = makeDbPath('claim-business');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses.find((business: any) => business.isUnclaimed);
      assert.ok(target);

      const unauthenticatedClaimRes = await fetch(`${baseUrl}/api/businesses/${target.id}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@example.com' }),
      });
      assert.equal(unauthenticatedClaimRes.status, 401);

      const claimRes = await fetch(`${baseUrl}/api/businesses/${target.id}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ email: 'owner@example.com' }),
      });

      assert.equal(claimRes.status, 200);
      const claimed = await claimRes.json();
      assert.equal(claimed.business.id, target.id);
      assert.equal(claimed.business.isUnclaimed, false);
      assert.equal(claimed.business.email, 'owner@example.com');
      assert.equal(claimed.currentUser.email, 'owner@example.com');
      assert.equal(claimed.currentUser.businessId, target.id);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('admin can assign listing owner access and reset owner passwords', async () => {
  const dbPath = makeDbPath('admin-owner-assignment');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses.find((business: any) => business.isUnclaimed);
      assert.ok(target);

      const weakPasswordRes = await fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ isUnclaimed: false, ownerEmail: 'assigned@example.com', ownerPassword: 'short' }),
      });
      assert.equal(weakPasswordRes.status, 400);

      const assignRes = await fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          isUnclaimed: false,
          ownerEmail: 'assigned@example.com',
          ownerPassword: 'Correct Horse Battery 42',
        }),
      });
      assert.equal(assignRes.status, 200);
      const assigned = await assignRes.json();
      assert.equal(assigned.isUnclaimed, false);
      assert.equal(assigned.email, 'assigned@example.com');
      assert.equal(assigned.ownerId, `owner-${target.id}`);
      assert.equal(assigned.emailVerified, true);
      assert.equal(assigned.ownerPasswordHash, undefined);

      const loginRes = await fetch(`${baseUrl}/api/owner/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'assigned@example.com', password: 'Correct Horse Battery 42' }),
      });
      assert.equal(loginRes.status, 200);
      const ownerLogin = await loginRes.json();
      assert.equal(ownerLogin.currentUser.businessId, target.id);

      const resetRes = await fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ ownerEmail: 'assigned@example.com', ownerPassword: 'New Correct Horse 43' }),
      });
      assert.equal(resetRes.status, 200);

      const oldLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'assigned@example.com', password: 'Correct Horse Battery 42' }),
      });
      assert.equal(oldLoginRes.status, 401);

      const newLoginRes = await fetch(`${baseUrl}/api/owner/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'assigned@example.com', password: 'New Correct Horse 43' }),
      });
      assert.equal(newLoginRes.status, 200);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('signed Stripe checkout webhook fulfills paid membership server-side', async () => {
  const dbPath = makeDbPath('stripe-webhook-fulfillment');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

  try {
    await withServer(dbPath, async (baseUrl) => {
      const createRes = await fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          name: 'Webhook Upgrade Books',
          category: 'Shopping & Retail',
          description: 'Book shop ready for paid membership.',
          phone: '(972) 555-6622',
          email: 'owner@webhookbooks.com',
          tier: 'free',
          ownerId: 'owner-webhook-books',
          isUnclaimed: false,
          logoUrl: TEST_LOGO_URL,
          images: [TEST_COVER_URL],
        }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();

      const payload = JSON.stringify({
        id: 'evt_checkout_completed',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_completed',
            object: 'checkout.session',
            mode: 'subscription',
            payment_status: 'paid',
            metadata: {
              tier: 'premium',
              businessId: created.id,
              userId: 'owner-webhook-books',
              addonQuantity: '0',
              interval: 'month',
            },
          },
        },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
      });

      const webhookRes = await fetch(`${baseUrl}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: payload,
      });
      assert.equal(webhookRes.status, 200);

      const bootstrap = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
      const upgraded = bootstrap.businesses.find((business: any) => business.id === created.id);
      assert.equal(upgraded.tier, 'premium');
      assert.equal(upgraded.featured, true);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('admin listing updates persist large uploaded logo and image data', async () => {
  const dbPath = makeDbPath('admin-large-upload-save');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses[0];
      assert.ok(target);

      const logoUrl = `data:image/png;base64,${'a'.repeat(120_000)}`;
      const imageUrl = `data:image/jpeg;base64,${'b'.repeat(180_000)}`;
      const updateRes = await fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          name: 'Large Upload Bakery',
          logoUrl,
          images: [imageUrl],
        }),
      });

      assert.equal(updateRes.status, 200);
      const updated = await updateRes.json();
      assert.equal(updated.name, 'Large Upload Bakery');
      assert.equal(updated.logoUrl, logoUrl);
      assert.deepEqual(updated.images, [imageUrl]);

      const afterRes = await fetch(`${baseUrl}/api/bootstrap`);
      const after = await afterRes.json();
      const persisted = after.businesses.find((business: any) => business.id === target.id);
      assert.equal(persisted.logoUrl, logoUrl);
      assert.deepEqual(persisted.images, [imageUrl]);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('destructive business and admin endpoints are disabled when admin auth is not configured', async () => {
  const dbPath = makeDbPath('admin-auth-disabled');
  delete process.env.ADMIN_API_TOKEN;

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses[0];

    const protectedCalls = [
      fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Tampered Business', category: 'Dining', description: 'Test', phone: '123', email: 'a@b.com', tier: 'basic' }),
      }),
      fetch(`${baseUrl}/api/businesses/${target.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Tampered Name' }),
      }),
      fetch(`${baseUrl}/api/businesses/${target.id}`, { method: 'DELETE' }),
      fetch(`${baseUrl}/api/businesses/${target.id}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@example.com' }),
      }),
      fetch(`${baseUrl}/api/admin/reset`, { method: 'POST' }),
    ];

    for (const res of await Promise.all(protectedCalls)) {
      assert.equal(res.status, 503);
    }
  });
});

test('destructive business and admin endpoints reject missing or wrong admin token', async () => {
  const dbPath = makeDbPath('admin-auth-required');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
      const bootstrap = await bootstrapRes.json();
      const target = bootstrap.businesses[0];

      const protectedCalls = [
        fetch(`${baseUrl}/api/businesses`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-admin-token': 'wrong-token' },
          body: JSON.stringify({ name: 'Tampered Business', category: 'Dining', description: 'Test', phone: '123', email: 'a@b.com', tier: 'basic' }),
        }),
        fetch(`${baseUrl}/api/businesses/${target.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-admin-token': 'wrong-token' },
          body: JSON.stringify({ name: 'Tampered Name' }),
        }),
        fetch(`${baseUrl}/api/businesses/${target.id}`, { method: 'DELETE' }),
        fetch(`${baseUrl}/api/admin/reset`, { method: 'POST' }),
      ];

      for (const res of await Promise.all(protectedCalls)) {
        assert.equal(res.status, 401);
      }
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});

test('POST /api/businesses/:id/reviews appends a persisted review', async () => {
  const dbPath = makeDbPath('review-business');

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses[0];
    const initialReviewCount = target.reviews.length;

    const reviewRes = await fetch(`${baseUrl}/api/businesses/${target.id}/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        authorName: 'Test Reviewer',
        rating: 5,
        text: 'Backend persistence works.',
      }),
    });

    assert.equal(reviewRes.status, 201);
    const reviewPayload = await reviewRes.json();
    assert.equal(reviewPayload.review.authorName, 'Test Reviewer');

    const refreshedRes = await fetch(`${baseUrl}/api/bootstrap`);
    const refreshed = await refreshedRes.json();
    const updated = refreshed.businesses.find((business: any) => business.id === target.id);
    assert.equal(updated.reviews.length, initialReviewCount + 1);
    assert.equal(updated.reviews[0].text, 'Backend persistence works.');
  });
});

test('POST /api/businesses/:id/likes toggles and persists listing thumbs up count', async () => {
  const dbPath = makeDbPath('like-business');

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses[0];
    const initialVotes = Number(target.votesCount || 0);

    const likeRes = await fetch(`${baseUrl}/api/businesses/${target.id}/likes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true }),
    });

    assert.equal(likeRes.status, 200);
    const likePayload = await likeRes.json();
    assert.equal(likePayload.votesCount, initialVotes + 1);
    assert.equal(likePayload.business.votesCount, initialVotes + 1);

    const unlikeRes = await fetch(`${baseUrl}/api/businesses/${target.id}/likes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: false }),
    });
    assert.equal(unlikeRes.status, 200);
    const unlikePayload = await unlikeRes.json();
    assert.equal(unlikePayload.votesCount, initialVotes);
    assert.equal(unlikePayload.business.votesCount, initialVotes);

    const refreshedRes = await fetch(`${baseUrl}/api/bootstrap`);
    const refreshed = await refreshedRes.json();
    const updated = refreshed.businesses.find((business: any) => business.id === target.id);
    assert.equal(updated.votesCount, initialVotes);
  });
});

test('POST /api/businesses/:id/growth/:action tracks owner growth credits signals', async () => {
  const dbPath = makeDbPath('growth-credits');

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses[0];

    const shareRes = await fetch(`${baseUrl}/api/businesses/${target.id}/growth/share-click`, { method: 'POST' });
    assert.equal(shareRes.status, 200);
    const sharePayload = await shareRes.json();
    assert.equal(sharePayload.growthCredits.shareClicks, 1);

    const visitRes = await fetch(`${baseUrl}/api/businesses/${target.id}/growth/referral-visit`, { method: 'POST' });
    assert.equal(visitRes.status, 200);
    const visitPayload = await visitRes.json();
    assert.equal(visitPayload.growthCredits.referralVisits, 1);

    const refreshedRes = await fetch(`${baseUrl}/api/bootstrap`);
    const refreshed = await refreshedRes.json();
    const updated = refreshed.businesses.find((business: any) => business.id === target.id);
    assert.equal(updated.growthCredits.shareClicks, 1);
    assert.equal(updated.growthCredits.referralVisits, 1);
  });
});

test('bug endpoints create publicly, then update, delete, and reset with admin auth', async () => {
  const dbPath = makeDbPath('bugs-and-reset');
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

  try {
    await withServer(dbPath, async (baseUrl) => {
      const createBugRes = await fetch(`${baseUrl}/api/bugs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Broken logo upload',
          description: 'PNG upload fails in dashboard.',
          category: 'functional',
          severity: 'high',
          email: 'owner@example.com',
        }),
      });

      assert.equal(createBugRes.status, 201);
      const createdBug = await createBugRes.json();

      const unauthorizedUpdateBugRes = await fetch(`${baseUrl}/api/bugs/${createdBug.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      assert.equal(unauthorizedUpdateBugRes.status, 401);

      const updateBugRes = await fetch(`${baseUrl}/api/bugs/${createdBug.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ status: 'resolved' }),
      });
      assert.equal(updateBugRes.status, 200);

      const bootstrapWithBugRes = await fetch(`${baseUrl}/api/bootstrap`);
      const withBug = await bootstrapWithBugRes.json();
      assert.equal(withBug.reportedBugs.length, 1);
      assert.equal(withBug.reportedBugs[0].status, 'resolved');

      const deleteBugRes = await fetch(`${baseUrl}/api/bugs/${createdBug.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      assert.equal(deleteBugRes.status, 204);

      const createBusinessRes = await fetch(`${baseUrl}/api/businesses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({
          name: 'Reset Target',
          category: 'Dining',
          description: 'Will be removed by reset.',
          phone: '(972) 555-3333',
          email: 'reset@example.com',
          tier: 'basic',
        }),
      });
      assert.equal(createBusinessRes.status, 201);

      const resetRes = await fetch(`${baseUrl}/api/admin/reset`, {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      assert.equal(resetRes.status, 200);
      const resetBody = await resetRes.json();
      assert.ok(Array.isArray(resetBody.businesses));
      assert.ok(Array.isArray(resetBody.reportedBugs));
      assert.equal(resetBody.reportedBugs.length, 0);
      assert.equal(resetBody.businesses.some((business: any) => business.name === 'Reset Target'), false);
    });
  } finally {
    delete process.env.ADMIN_API_TOKEN;
  }
});
