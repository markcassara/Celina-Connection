import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';

import { createApp } from '../server/app.ts';

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

test('POST /api/businesses/:id/claim returns updated business and owner session payload', async () => {
  const dbPath = makeDbPath('claim-business');

  await withServer(dbPath, async (baseUrl) => {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap`);
    const bootstrap = await bootstrapRes.json();
    const target = bootstrap.businesses.find((business: any) => business.isUnclaimed);
    assert.ok(target);

    const claimRes = await fetch(`${baseUrl}/api/businesses/${target.id}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

test('bug endpoints create, update, delete, and reset', async () => {
  const dbPath = makeDbPath('bugs-and-reset');

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

    const updateBugRes = await fetch(`${baseUrl}/api/bugs/${createdBug.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert.equal(updateBugRes.status, 200);

    const bootstrapWithBugRes = await fetch(`${baseUrl}/api/bootstrap`);
    const withBug = await bootstrapWithBugRes.json();
    assert.equal(withBug.reportedBugs.length, 1);
    assert.equal(withBug.reportedBugs[0].status, 'resolved');

    const deleteBugRes = await fetch(`${baseUrl}/api/bugs/${createdBug.id}`, { method: 'DELETE' });
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

    const resetRes = await fetch(`${baseUrl}/api/admin/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetBody = await resetRes.json();
    assert.ok(Array.isArray(resetBody.businesses));
    assert.ok(Array.isArray(resetBody.reportedBugs));
    assert.equal(resetBody.reportedBugs.length, 0);
    assert.equal(resetBody.businesses.some((business: any) => business.name === 'Reset Target'), false);
  });
});
