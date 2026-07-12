import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { neon } from '@neondatabase/serverless';

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

export interface CelinaDataStore {
  listBusinesses(): Business[] | Promise<Business[]>;
  getBusiness(id: string): Business | null | Promise<Business | null>;
  createBusiness(input: CreateBusinessInput): Business | Promise<Business>;
  updateBusiness(id: string, updates: Partial<Business>): Business | null | Promise<Business | null>;
  deleteBusiness(id: string): boolean | Promise<boolean>;
  claimBusiness(id: string, email: string): { business: Business; currentUser: UserProfile } | null | Promise<{ business: Business; currentUser: UserProfile } | null>;
  addReview(id: string, input: Pick<Review, 'authorName' | 'rating' | 'text' | 'ownerReply'>): { business: Business; review: Review } | null | Promise<{ business: Business; review: Review } | null>;
  listBugs(): ReportedBug[] | Promise<ReportedBug[]>;
  createBug(input: CreateBugInput): ReportedBug | Promise<ReportedBug>;
  updateBug(id: string, updates: Partial<ReportedBug>): ReportedBug | null | Promise<ReportedBug | null>;
  deleteBug(id: string): boolean | Promise<boolean>;
  reset(): { businesses: Business[]; reportedBugs: ReportedBug[] } | Promise<{ businesses: Business[]; reportedBugs: ReportedBug[] }>;
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

function fromJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
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
    viewsCount: Number(row.views_count || 0),
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

function makeBusiness(input: CreateBusinessInput): Business {
  const id = input.id || `${slugify(input.name)}-${Math.random().toString(36).slice(2, 5)}`;
  return {
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
}

function makeClaimPayload(business: Business, email: string) {
  const currentUser: UserProfile = {
    id: `owner-${business.id}`,
    email,
    businessName: business.name,
    businessId: business.id,
    tier: business.tier,
    isLoggedIn: true,
    role: 'owner',
  };
  return { business, currentUser };
}

export class CelinaRepository implements CelinaDataStore {
  private db: DatabaseSync;

  constructor(dbPath = path.join(process.cwd(), 'data', 'celina.sqlite')) {
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

    const businessCount = Number((this.db.prepare('SELECT COUNT(*) as count FROM businesses').get() as any).count || 0);
    if (businessCount === 0) {
      this.seedInitialData();
    }
  }

  seedInitialData() {
    this.db.exec('DELETE FROM businesses; DELETE FROM reported_bugs;');
    for (const business of INITIAL_BUSINESSES) {
      this.upsertBusiness(makeBusiness(business as CreateBusinessInput));
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
    const business = makeBusiness(input);
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
    `).run(toBusinessParams(business));
  }

  updateBusiness(id: string, updates: Partial<Business>) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const updated: Business = { ...current, ...updates, id };
    this.upsertBusiness(updated);
    return updated;
  }

  deleteBusiness(id: string) {
    const result = this.db.prepare('DELETE FROM businesses WHERE id = ?').run(id);
    return result.changes > 0;
  }

  claimBusiness(id: string, email: string) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const business: Business = { ...current, email, isUnclaimed: false, ownerId: `owner-${id}` };
    this.upsertBusiness(business);
    return makeClaimPayload(business, email);
  }

  addReview(id: string, input: Pick<Review, 'authorName' | 'rating' | 'text' | 'ownerReply'>) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const review: Review = { id: randomId('review'), authorName: input.authorName, rating: input.rating, text: input.text, createdAt: new Date().toISOString(), ownerReply: input.ownerReply };
    const business: Business = { ...current, reviews: [review, ...(current.reviews || [])] };
    this.upsertBusiness(business);
    return { business, review };
  }

  listBugs() {
    return this.db.prepare('SELECT * FROM reported_bugs ORDER BY created_at DESC').all().map(rowToBug);
  }

  createBug(input: CreateBugInput) {
    const bug: ReportedBug = { id: randomId('bug'), ...input, createdAt: new Date().toISOString(), status: 'open' };
    this.db.prepare(`
      INSERT INTO reported_bugs (id, title, description, category, severity, email, created_at, status)
      VALUES (@id, @title, @description, @category, @severity, @email, @created_at, @status)
    `).run(toBugParams(bug));
    return bug;
  }

  updateBug(id: string, updates: Partial<ReportedBug>) {
    const current = this.db.prepare('SELECT * FROM reported_bugs WHERE id = ?').get(id);
    if (!current) return null;
    const bug: ReportedBug = { ...rowToBug(current), ...updates, id };
    this.db.prepare(`
      UPDATE reported_bugs
      SET title = @title, description = @description, category = @category, severity = @severity, email = @email, created_at = @created_at, status = @status
      WHERE id = @id
    `).run(toBugParams(bug));
    return bug;
  }

  deleteBug(id: string) {
    const result = this.db.prepare('DELETE FROM reported_bugs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  reset() {
    this.seedInitialData();
    return { businesses: this.listBusinesses(), reportedBugs: this.listBugs() };
  }
}

class PostgresRepository implements CelinaDataStore {
  private sql: ReturnType<typeof neon>;
  private initialized?: Promise<void>;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      this.initialized = this.initialize();
    }
    await this.initialized;
  }

  private async initialize() {
    await this.sql`
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
        hours_json JSONB,
        logo_url TEXT,
        images_json JSONB NOT NULL,
        social_links_json JSONB NOT NULL,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        cta_text TEXT,
        tier TEXT NOT NULL,
        owner_id TEXT,
        created_at TEXT NOT NULL,
        reviews_json JSONB NOT NULL,
        views_count INTEGER NOT NULL DEFAULT 0,
        is_unclaimed BOOLEAN NOT NULL DEFAULT FALSE,
        is_registry_only BOOLEAN NOT NULL DEFAULT FALSE
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS reported_bugs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      )
    `;
    const rows = await this.sql`SELECT COUNT(*)::int AS count FROM businesses` as any[];
    if (Number(rows[0]?.count || 0) === 0) {
      await this.seedInitialData();
    }
  }

  private async seedInitialData() {
    await this.sql`DELETE FROM businesses`;
    await this.sql`DELETE FROM reported_bugs`;
    for (const business of INITIAL_BUSINESSES) {
      await this.upsertBusiness(makeBusiness(business as CreateBusinessInput), false);
    }
  }

  async listBusinesses() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses ORDER BY featured DESC, views_count DESC, name ASC` as any[];
    return rows.map(rowToBusiness);
  }

  async getBusiness(id: string) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE id = ${id}` as any[];
    return rows[0] ? rowToBusiness(rows[0]) : null;
  }

  async createBusiness(input: CreateBusinessInput) {
    await this.ensureInitialized();
    const business = makeBusiness(input);
    await this.upsertBusiness(business, false);
    return business;
  }

  private async upsertBusiness(business: Business, initialize = true) {
    if (initialize) await this.ensureInitialized();
    const values = toBusinessParams(business);
    await this.sql`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, views_count, is_unclaimed, is_registry_only
      ) VALUES (
        ${values.id}, ${values.slug}, ${values.name}, ${values.category}, ${values.description}, ${values.phone}, ${values.email}, ${values.website}, ${values.address},
        ${values.hours_json}, ${values.logo_url}, ${values.images_json}, ${values.social_links_json}, ${Boolean(values.featured)}, ${values.cta_text},
        ${values.tier}, ${values.owner_id}, ${values.created_at}, ${values.reviews_json}, ${values.views_count}, ${Boolean(values.is_unclaimed)}, ${Boolean(values.is_registry_only)}
      )
      ON CONFLICT(id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        address = EXCLUDED.address,
        hours_json = EXCLUDED.hours_json,
        logo_url = EXCLUDED.logo_url,
        images_json = EXCLUDED.images_json,
        social_links_json = EXCLUDED.social_links_json,
        featured = EXCLUDED.featured,
        cta_text = EXCLUDED.cta_text,
        tier = EXCLUDED.tier,
        owner_id = EXCLUDED.owner_id,
        created_at = EXCLUDED.created_at,
        reviews_json = EXCLUDED.reviews_json,
        views_count = EXCLUDED.views_count,
        is_unclaimed = EXCLUDED.is_unclaimed,
        is_registry_only = EXCLUDED.is_registry_only
    `;
  }

  async updateBusiness(id: string, updates: Partial<Business>) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const updated: Business = { ...current, ...updates, id };
    await this.upsertBusiness(updated);
    return updated;
  }

  async deleteBusiness(id: string) {
    await this.ensureInitialized();
    const rows = await this.sql`DELETE FROM businesses WHERE id = ${id} RETURNING id` as any[];
    return rows.length > 0;
  }

  async claimBusiness(id: string, email: string) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const business: Business = { ...current, email, isUnclaimed: false, ownerId: `owner-${id}` };
    await this.upsertBusiness(business);
    return makeClaimPayload(business, email);
  }

  async addReview(id: string, input: Pick<Review, 'authorName' | 'rating' | 'text' | 'ownerReply'>) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const review: Review = { id: randomId('review'), authorName: input.authorName, rating: input.rating, text: input.text, createdAt: new Date().toISOString(), ownerReply: input.ownerReply };
    const business: Business = { ...current, reviews: [review, ...(current.reviews || [])] };
    await this.upsertBusiness(business);
    return { business, review };
  }

  async listBugs() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM reported_bugs ORDER BY created_at DESC` as any[];
    return rows.map(rowToBug);
  }

  async createBug(input: CreateBugInput) {
    await this.ensureInitialized();
    const bug: ReportedBug = { id: randomId('bug'), ...input, createdAt: new Date().toISOString(), status: 'open' };
    const values = toBugParams(bug);
    await this.sql`
      INSERT INTO reported_bugs (id, title, description, category, severity, email, created_at, status)
      VALUES (${values.id}, ${values.title}, ${values.description}, ${values.category}, ${values.severity}, ${values.email}, ${values.created_at}, ${values.status})
    `;
    return bug;
  }

  async updateBug(id: string, updates: Partial<ReportedBug>) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM reported_bugs WHERE id = ${id}` as any[];
    if (!rows[0]) return null;
    const bug: ReportedBug = { ...rowToBug(rows[0]), ...updates, id };
    const values = toBugParams(bug);
    await this.sql`
      UPDATE reported_bugs
      SET title = ${values.title}, description = ${values.description}, category = ${values.category}, severity = ${values.severity}, email = ${values.email}, created_at = ${values.created_at}, status = ${values.status}
      WHERE id = ${values.id}
    `;
    return bug;
  }

  async deleteBug(id: string) {
    await this.ensureInitialized();
    const rows = await this.sql`DELETE FROM reported_bugs WHERE id = ${id} RETURNING id` as any[];
    return rows.length > 0;
  }

  async reset() {
    await this.ensureInitialized();
    await this.seedInitialData();
    return { businesses: await this.listBusinesses(), reportedBugs: await this.listBugs() };
  }
}

function toBusinessParams(business: Business) {
  return {
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
  };
}

function toBugParams(bug: ReportedBug) {
  return {
    id: bug.id,
    title: bug.title,
    description: bug.description,
    category: bug.category,
    severity: bug.severity,
    email: bug.email,
    created_at: bug.createdAt,
    status: bug.status,
  };
}

export function createRepository(options: { dbPath?: string } = {}): CelinaDataStore {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!options.dbPath && databaseUrl) {
    return new PostgresRepository(databaseUrl);
  }
  return new CelinaRepository(options.dbPath);
}
