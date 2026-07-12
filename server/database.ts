import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { INITIAL_BUSINESSES } from '../src/data/mockBusinesses.js';
import type { Business, ReportedBug, Review, Tier, UserProfile } from '../src/types.js';

export interface CreateBusinessInput {
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  tier: Tier;
  website?: string;
  address?: string;
  hours?: Business['hours'];
  logoUrl?: string;
  images?: string[];
  socialLinks?: Business['socialLinks'];
  featured?: boolean;
  ctaText?: string;
  ownerId?: string;
  createdAt?: string;
  viewsCount?: number;
  reviews?: Review[];
  isUnclaimed?: boolean;
  isRegistryOnly?: boolean;
  slug?: string;
  id?: string;
}

export interface CreateBugInput {
  title: string;
  description: string;
  category: ReportedBug['category'];
  severity: ReportedBug['severity'];
  email: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `business-${Date.now()}`;
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function fromJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToBusiness(row: any): Business {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website || '',
    address: row.address || '',
    hours: fromJson(row.hours_json, undefined as Business['hours']),
    logoUrl: row.logo_url || '',
    images: fromJson<string[]>(row.images_json, []),
    socialLinks: fromJson(row.social_links_json, {}),
    featured: Boolean(row.featured),
    ctaText: row.cta_text || '',
    tier: row.tier as Tier,
    ownerId: row.owner_id || '',
    createdAt: row.created_at,
    reviews: fromJson<Review[]>(row.reviews_json, []),
    viewsCount: row.views_count || 0,
    isUnclaimed: Boolean(row.is_unclaimed),
    isRegistryOnly: Boolean(row.is_registry_only),
  };
}

function rowToBug(row: any): ReportedBug {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    email: row.email,
    createdAt: row.created_at,
    status: row.status,
  };
}

export class CelinaRepository {
  private db: DatabaseSync;

  constructor(dbPath = process.env.VERCEL ? path.join('/tmp', 'celina.sqlite') : path.join(process.cwd(), 'data', 'celina.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        website TEXT,
        address TEXT,
        hours_json TEXT,
        logo_url TEXT,
        images_json TEXT NOT NULL,
        social_links_json TEXT NOT NULL,
        featured INTEGER NOT NULL DEFAULT 0,
        cta_text TEXT,
        tier TEXT NOT NULL,
        owner_id TEXT,
        created_at TEXT NOT NULL,
        reviews_json TEXT NOT NULL,
        views_count INTEGER NOT NULL DEFAULT 0,
        is_unclaimed INTEGER NOT NULL DEFAULT 0,
        is_registry_only INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reported_bugs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);

    const businessCount = Number(this.db.prepare('SELECT COUNT(*) as count FROM businesses').get().count || 0);
    if (businessCount === 0) {
      this.seedInitialData();
    }
  }

  seedInitialData() {
    this.db.exec('DELETE FROM businesses; DELETE FROM reported_bugs;');
    const insert = this.db.prepare(`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, views_count, is_unclaimed, is_registry_only
      ) VALUES (
        @id, @slug, @name, @category, @description, @phone, @email, @website, @address,
        @hours_json, @logo_url, @images_json, @social_links_json, @featured, @cta_text,
        @tier, @owner_id, @created_at, @reviews_json, @views_count, @is_unclaimed, @is_registry_only
      )
    `);

    for (const business of INITIAL_BUSINESSES) {
      insert.run({
        id: business.id,
        slug: business.slug || slugify(business.name),
        name: business.name,
        category: business.category,
        description: business.description,
        phone: business.phone,
        email: business.email,
        website: business.website || '',
        address: business.address || '',
        hours_json: toJson(business.hours ?? null),
        logo_url: business.logoUrl || '',
        images_json: toJson(business.images ?? []),
        social_links_json: toJson(business.socialLinks ?? {}),
        featured: business.featured ? 1 : 0,
        cta_text: business.ctaText || '',
        tier: business.tier,
        owner_id: business.ownerId || '',
        created_at: business.createdAt,
        reviews_json: toJson(business.reviews ?? []),
        views_count: business.viewsCount || 0,
        is_unclaimed: business.isUnclaimed ? 1 : 0,
        is_registry_only: business.isRegistryOnly ? 1 : 0,
      });
    }
  }

  listBusinesses() {
    return this.db.prepare('SELECT * FROM businesses ORDER BY featured DESC, views_count DESC, name ASC').all().map(rowToBusiness);
  }

  getBusiness(id: string) {
    const row = this.db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    return row ? rowToBusiness(row) : null;
  }

  createBusiness(input: CreateBusinessInput) {
    const id = input.id || `${slugify(input.name)}-${Math.random().toString(36).slice(2, 5)}`;
    const business: Business = {
      id,
      slug: input.slug || slugify(input.name),
      name: input.name,
      category: input.category,
      description: input.description,
      phone: input.phone,
      email: input.email,
      website: input.website || '',
      address: input.address || '',
      hours: input.hours || { monFri: '9:00 AM - 5:00 PM', sat: '10:00 AM - 4:00 PM', sun: 'Closed' },
      logoUrl: input.logoUrl || '',
      images: input.images || [],
      socialLinks: input.socialLinks || {},
      featured: input.featured || false,
      ctaText: input.ctaText || 'Learn More',
      tier: input.tier,
      ownerId: input.ownerId || '',
      createdAt: input.createdAt || new Date().toISOString(),
      reviews: input.reviews || [],
      viewsCount: input.viewsCount ?? 12,
      isUnclaimed: input.isUnclaimed ?? false,
      isRegistryOnly: input.isRegistryOnly ?? false,
    };

    this.upsertBusiness(business);
    return business;
  }

  upsertBusiness(business: Business) {
    this.db.prepare(`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, views_count, is_unclaimed, is_registry_only
      ) VALUES (
        @id, @slug, @name, @category, @description, @phone, @email, @website, @address,
        @hours_json, @logo_url, @images_json, @social_links_json, @featured, @cta_text,
        @tier, @owner_id, @created_at, @reviews_json, @views_count, @is_unclaimed, @is_registry_only
      )
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        address = excluded.address,
        hours_json = excluded.hours_json,
        logo_url = excluded.logo_url,
        images_json = excluded.images_json,
        social_links_json = excluded.social_links_json,
        featured = excluded.featured,
        cta_text = excluded.cta_text,
        tier = excluded.tier,
        owner_id = excluded.owner_id,
        created_at = excluded.created_at,
        reviews_json = excluded.reviews_json,
        views_count = excluded.views_count,
        is_unclaimed = excluded.is_unclaimed,
        is_registry_only = excluded.is_registry_only
    `).run({
      id: business.id,
      slug: business.slug,
      name: business.name,
      category: business.category,
      description: business.description,
      phone: business.phone,
      email: business.email,
      website: business.website || '',
      address: business.address || '',
      hours_json: toJson(business.hours ?? null),
      logo_url: business.logoUrl || '',
      images_json: toJson(business.images ?? []),
      social_links_json: toJson(business.socialLinks ?? {}),
      featured: business.featured ? 1 : 0,
      cta_text: business.ctaText || '',
      tier: business.tier,
      owner_id: business.ownerId || '',
      created_at: business.createdAt,
      reviews_json: toJson(business.reviews ?? []),
      views_count: business.viewsCount || 0,
      is_unclaimed: business.isUnclaimed ? 1 : 0,
      is_registry_only: business.isRegistryOnly ? 1 : 0,
    });
  }

  updateBusiness(id: string, patch: Partial<Business>) {
    const existing = this.getBusiness(id);
    if (!existing) return null;
    const merged: Business = {
      ...existing,
      ...patch,
      id: existing.id,
      slug: patch.slug || existing.slug || slugify(patch.name || existing.name),
    };
    this.upsertBusiness(merged);
    return merged;
  }

  deleteBusiness(id: string) {
    const result = this.db.prepare('DELETE FROM businesses WHERE id = ?').run(id);
    return result.changes > 0;
  }

  claimBusiness(id: string, email: string) {
    const existing = this.getBusiness(id);
    if (!existing) return null;
    const ownerId = existing.ownerId || randomId('owner');
    const updated = this.updateBusiness(id, {
      ownerId,
      isUnclaimed: false,
      isRegistryOnly: false,
      email,
    });
    if (!updated) return null;
    const currentUser: UserProfile = {
      id: ownerId,
      email,
      businessName: updated.name,
      businessId: updated.id,
      tier: updated.tier,
      isLoggedIn: true,
      addonSlots: 0,
      role: 'owner',
    };
    return { business: updated, currentUser };
  }

  addReview(id: string, input: Omit<Review, 'id' | 'createdAt'>) {
    const existing = this.getBusiness(id);
    if (!existing) return null;
    const review: Review = {
      id: randomId('rev'),
      authorName: input.authorName,
      rating: input.rating,
      text: input.text,
      createdAt: new Date().toISOString(),
      ownerReply: input.ownerReply,
    };
    const updated = this.updateBusiness(id, { reviews: [review, ...existing.reviews] });
    return updated ? { business: updated, review } : null;
  }

  listBugs() {
    return this.db.prepare('SELECT * FROM reported_bugs ORDER BY created_at DESC').all().map(rowToBug);
  }

  createBug(input: CreateBugInput) {
    const bug: ReportedBug = {
      id: randomId('bug'),
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      email: input.email,
      createdAt: new Date().toISOString(),
      status: 'open',
    };
    this.db.prepare(`
      INSERT INTO reported_bugs (id, title, description, category, severity, email, created_at, status)
      VALUES (@id, @title, @description, @category, @severity, @email, @created_at, @status)
    `).run({
      id: bug.id,
      title: bug.title,
      description: bug.description,
      category: bug.category,
      severity: bug.severity,
      email: bug.email,
      created_at: bug.createdAt,
      status: bug.status,
    });
    return bug;
  }

  updateBug(id: string, patch: Partial<ReportedBug>) {
    const row = this.db.prepare('SELECT * FROM reported_bugs WHERE id = ?').get(id);
    if (!row) return null;
    const bug = { ...rowToBug(row), ...patch, id };
    this.db.prepare(`
      UPDATE reported_bugs
      SET title = @title,
          description = @description,
          category = @category,
          severity = @severity,
          email = @email,
          created_at = @created_at,
          status = @status
      WHERE id = @id
    `).run({
      id: bug.id,
      title: bug.title,
      description: bug.description,
      category: bug.category,
      severity: bug.severity,
      email: bug.email,
      created_at: bug.createdAt,
      status: bug.status,
    });
    return bug;
  }

  deleteBug(id: string) {
    const result = this.db.prepare('DELETE FROM reported_bugs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  reset() {
    this.seedInitialData();
    return {
      businesses: this.listBusinesses(),
      reportedBugs: this.listBugs(),
    };
  }
}
