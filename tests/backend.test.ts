import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';

import { createApp } from '../server/app.ts';

const ADMIN_TOKEN = 'test-admin-token';

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
    assert.equal(body.businesses[0].name, "Lucy's on the Square");
  });
});

test('POST /api/businesses creates and persists a business', async () => {
  const dbPath = makeDbPath('create-business');

  await withServer(dbPath, async (baseUrl) => {
    const createRes = await fetch(`${baseUrl}/api/businesses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Legacy Wealth Co.',
        category: 'Home & Professional Services',
        description: 'Estate planning and wealth guidance.',
        phone: '(972) 555-1000',
        email: 'mark@legacywealthco.com',
        tier: 'basic',
      }),
    });

    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.name, 'Legacy Wealth Co.');
    assert.ok(created.id);
    assert.equal(created.slug, 'legacy-wealth-co');

    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const body = await bootstrapRes.json();
    const found = body.businesses.find((business: any) => business.id === created.id);
    assert.ok(found);
    assert.equal(found.email, 'mark@legacywealthco.com');
  });
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

test('destructive business and admin endpoints are disabled when admin auth is not configured', async () => {
  const dbPath = makeDbPath('admin-auth-disabled');
  delete process.env.ADMIN_API_TOKEN;

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses[0];

    const protectedCalls = [
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
        headers: { 'content-type': 'application/json' },
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
