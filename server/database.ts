import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { neon as importedNeon } from '@neondatabase/serverless';

let req: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  req = typeof require !== 'undefined' ? require : createRequire(import.meta.url || 'file:///' + process.cwd() + '/');
} catch {
  req = () => null;
}

let DatabaseSyncClass: any = null;
try {
  const sqliteModule = req('node:sqlite');
  DatabaseSyncClass = sqliteModule?.DatabaseSync || sqliteModule?.default?.DatabaseSync || null;
} catch {
  DatabaseSyncClass = null;
}

const neonFn: any = typeof importedNeon === 'function' ? importedNeon : null;

import { INITIAL_BUSINESSES } from '../src/data/mockBusinesses';
import type { Business, ClaimRequest, LegacyHillsPetitionSignature, ReportedBug, Review, Tier, UserProfile } from '../src/types';

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
  ownerEmail?: string;
  ownerPassword?: string;
  createdAt?: string;
  viewsCount?: number;
  votesCount?: number;
  growthCredits?: Business['growthCredits'];
  reviews?: Review[];
  isUnclaimed?: boolean;
  isRegistryOnly?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
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

export interface CreateLegacyHillsPetitionSignatureInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  neighborhood: string;
  phaseSection?: string;
  lotBlock?: string;
  builder?: string;
  comments?: string;
  signatureDataUrl: string;
  contactId?: string;
  editTokenHash?: string;
}

export type UpdateLegacyHillsPetitionSignatureInput = Partial<Pick<
  CreateLegacyHillsPetitionSignatureInput,
  'firstName' | 'lastName' | 'email' | 'phone' | 'streetAddress' | 'neighborhood' | 'phaseSection' | 'lotBlock' | 'builder' | 'comments' | 'signatureDataUrl'
>>;

export interface CreateClaimRequestInput {
  businessId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  role: string;
  proofUrl?: string;
  notes?: string;
}

export interface CelinaDataStore {
  listBusinesses(): Business[] | Promise<Business[]>;
  getBusiness(id: string): Business | null | Promise<Business | null>;
  createBusiness(input: CreateBusinessInput): Business | Promise<Business>;
  createOwnedBusiness(input: CreateBusinessInput, passwordHash: string, verification: { tokenHash: string; expiresAt: string }): Business | Promise<Business>;
  getOwnedBusinessByEmail(email: string): (Business & { ownerPasswordHash?: string }) | null | Promise<(Business & { ownerPasswordHash?: string }) | null>;
  getOwnedBusinessByOwnerId(ownerId: string): (Business & { ownerPasswordHash?: string }) | null | Promise<(Business & { ownerPasswordHash?: string }) | null>;
  verifyOwnerEmailByTokenHash(tokenHash: string): (Business & { ownerPasswordHash?: string }) | null | Promise<(Business & { ownerPasswordHash?: string }) | null>;
  refreshOwnerEmailVerification(email: string, verification: { tokenHash: string; expiresAt: string }): Business | null | Promise<Business | null>;
  createOwnerPasswordReset(email: string, reset: { tokenHash: string; expiresAt: string }): Business | null | Promise<Business | null>;
  resetOwnerPasswordByTokenHash(tokenHash: string, passwordHash: string): (Business & { ownerPasswordHash?: string }) | null | Promise<(Business & { ownerPasswordHash?: string }) | null>;
  updateBusiness(id: string, updates: Partial<Business>): Business | null | Promise<Business | null>;
  updateOwnerAccount(id: string, updates: { ownerId?: string; email?: string; passwordHash?: string; emailVerified?: boolean }): (Business & { ownerPasswordHash?: string }) | null | Promise<(Business & { ownerPasswordHash?: string }) | null>;
  deleteBusiness(id: string): boolean | Promise<boolean>;
  claimBusiness(id: string, email: string): { business: Business; currentUser: UserProfile } | null | Promise<{ business: Business; currentUser: UserProfile } | null>;
  addReview(id: string, input: Pick<Review, 'authorName' | 'rating' | 'text' | 'ownerReply'>): { business: Business; review: Review } | null | Promise<{ business: Business; review: Review } | null>;
  voteBusiness(id: string, delta: 1 | -1): Business | null | Promise<Business | null>;
  trackBusinessGrowthAction(id: string, action: 'shareClick' | 'referralVisit'): Business | null | Promise<Business | null>;
  listBugs(): ReportedBug[] | Promise<ReportedBug[]>;
  createBug(input: CreateBugInput): ReportedBug | Promise<ReportedBug>;
  updateBug(id: string, updates: Partial<ReportedBug>): ReportedBug | null | Promise<ReportedBug | null>;
  deleteBug(id: string): boolean | Promise<boolean>;
  createLegacyHillsPetitionSignature(input: CreateLegacyHillsPetitionSignatureInput): LegacyHillsPetitionSignature | Promise<LegacyHillsPetitionSignature>;
  listLegacyHillsPetitionSignatures(): LegacyHillsPetitionSignature[] | Promise<LegacyHillsPetitionSignature[]>;
  getLegacyHillsPetitionSignatureByContact(email: string, phone: string): LegacyHillsPetitionSignature | null | Promise<LegacyHillsPetitionSignature | null>;
  getLegacyHillsPetitionSignatureByEditTokenHash(tokenHash: string): LegacyHillsPetitionSignature | null | Promise<LegacyHillsPetitionSignature | null>;
  updateLegacyHillsPetitionSignature(id: string, updates: UpdateLegacyHillsPetitionSignatureInput): LegacyHillsPetitionSignature | null | Promise<LegacyHillsPetitionSignature | null>;
  createClaimRequest(input: CreateClaimRequestInput): ClaimRequest | null | Promise<ClaimRequest | null>;
  listClaimRequests(): ClaimRequest[] | Promise<ClaimRequest[]>;
  updateClaimRequest(id: string, updates: Partial<ClaimRequest>): ClaimRequest | null | Promise<ClaimRequest | null>;
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
    events: fromJson<Business['events']>(row.events_json, []),
    viewsCount: Number(row.views_count || 0),
    votesCount: Number(row.votes_count || 0),
    growthCredits: fromJson(row.growth_credits_json, { shareClicks: 0, referralVisits: 0 }),
    isUnclaimed: Boolean(row.is_unclaimed),
    isRegistryOnly: Boolean(row.is_registry_only),
    emailVerified: Boolean(row.email_verified),
    emailVerifiedAt: row.email_verified_at || '',
  };
}

function rowToOwnedBusiness(row: any): Business & { ownerPasswordHash?: string } {
  return {
    ...rowToBusiness(row),
    ownerPasswordHash: row.owner_password_hash || '',
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

function rowToLegacyHillsPetitionSignature(row: any): LegacyHillsPetitionSignature {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    streetAddress: row.street_address,
    neighborhood: row.neighborhood,
    phaseSection: row.phase_section || '',
    lotBlock: row.lot_block || '',
    builder: row.builder || '',
    comments: row.comments || '',
    signatureDataUrl: row.signature_data_url,
    contactId: row.contact_id || '',
    signedAt: row.signed_at,
    updatedAt: row.updated_at || '',
  };
}

function toLegacyHillsPetitionParams(signature: LegacyHillsPetitionSignature & { editTokenHash?: string }) {
  return {
    id: signature.id,
    first_name: signature.firstName,
    last_name: signature.lastName,
    email: signature.email,
    phone: signature.phone,
    street_address: signature.streetAddress,
    neighborhood: signature.neighborhood || 'Legacy Hills',
    phase_section: signature.phaseSection || '',
    lot_block: signature.lotBlock || '',
    builder: signature.builder || '',
    comments: signature.comments || '',
    signature_data_url: signature.signatureDataUrl,
    contact_id: signature.contactId || '',
    edit_token_hash: signature.editTokenHash || '',
    signed_at: signature.signedAt,
    updated_at: signature.updatedAt || '',
  };
}

function rowToClaimRequest(row: any): ClaimRequest {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    role: row.role,
    proofUrl: row.proof_url || '',
    notes: row.notes || '',
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || '',
  };
}

function toClaimParams(claim: ClaimRequest) {
  return {
    id: claim.id,
    business_id: claim.businessId,
    business_name: claim.businessName,
    requester_name: claim.requesterName,
    requester_email: claim.requesterEmail,
    requester_phone: claim.requesterPhone,
    role: claim.role,
    proof_url: claim.proofUrl || '',
    notes: claim.notes || '',
    status: claim.status,
    created_at: claim.createdAt,
    reviewed_at: claim.reviewedAt || '',
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
    viewsCount: input.viewsCount ?? 0,
    votesCount: input.votesCount ?? 0,
    growthCredits: input.growthCredits || { shareClicks: 0, referralVisits: 0 },
    isUnclaimed: input.isUnclaimed ?? false,
    isRegistryOnly: input.isRegistryOnly ?? false,
    emailVerified: input.emailVerified ?? true,
    emailVerifiedAt: input.emailVerifiedAt || '',
  };
}

function makeLegacyHillsPetitionSignature(input: CreateLegacyHillsPetitionSignatureInput): LegacyHillsPetitionSignature {
  return {
    id: randomId('petition'),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    streetAddress: input.streetAddress,
    neighborhood: input.neighborhood || 'Legacy Hills',
    phaseSection: input.phaseSection || '',
    lotBlock: input.lotBlock || '',
    builder: input.builder || '',
    comments: input.comments || '',
    signatureDataUrl: input.signatureDataUrl,
    contactId: input.contactId || '',
    ...((input.editTokenHash ? { editTokenHash: input.editTokenHash } : {}) as any),
    signedAt: new Date().toISOString(),
    updatedAt: '',
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

function getInitialBusinessByName(name: string) {
  return INITIAL_BUSINESSES.find((business) => business.name === name) as CreateBusinessInput | undefined;
}

function makeFeaturedPlaceholderBusiness(name: string) {
  const business = getInitialBusinessByName(name);
  if (!business) throw new Error(`Missing initial featured placeholder business: ${name}`);
  return makeBusiness(business);
}

export class CelinaRepository implements CelinaDataStore {
  private db: any = null;
  private businessesMap: Map<string, Business & { ownerPasswordHash?: string }> = new Map();
  private bugsMap: Map<string, ReportedBug> = new Map();
  private claimsMap: Map<string, ClaimRequest> = new Map();
  private petitionsMap: Map<string, LegacyHillsPetitionSignature> = new Map();

  constructor(dbPath?: string) {
    if (DatabaseSyncClass) {
      let resolvedDbPath = dbPath;
      if (!resolvedDbPath) {
        const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_BUILDER);
        if (isVercel) {
          resolvedDbPath = path.join(os.tmpdir(), 'celina.sqlite');
        } else {
          resolvedDbPath = path.join(process.cwd(), 'data', 'celina.sqlite');
        }
      }

      try {
        if (resolvedDbPath !== ':memory:') {
          fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
        }
        this.db = new DatabaseSyncClass(resolvedDbPath);
      } catch (err) {
        console.warn(`Failed to initialize database at ${resolvedDbPath}, falling back to tmpdir/memory:`, err);
        try {
          const fallbackPath = path.join(os.tmpdir(), 'celina.sqlite');
          fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
          this.db = new DatabaseSyncClass(fallbackPath);
        } catch {
          try {
            this.db = new DatabaseSyncClass(':memory:');
          } catch {
            this.db = null;
          }
        }
      }
    }

    if (this.db) {
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
          events_json TEXT NOT NULL DEFAULT '[]',
          views_count INTEGER NOT NULL DEFAULT 0,
          votes_count INTEGER NOT NULL DEFAULT 0,
          growth_credits_json TEXT NOT NULL DEFAULT '{"shareClicks":0,"referralVisits":0}',
          is_unclaimed INTEGER NOT NULL DEFAULT 0,
          is_registry_only INTEGER NOT NULL DEFAULT 0,
          owner_password_hash TEXT,
          email_verified INTEGER NOT NULL DEFAULT 1,
          email_verified_at TEXT,
          email_verification_token_hash TEXT,
          email_verification_expires_at TEXT,
          password_reset_token_hash TEXT,
          password_reset_expires_at TEXT
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

        CREATE TABLE IF NOT EXISTS claim_requests (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          business_name TEXT NOT NULL,
          requester_name TEXT NOT NULL,
          requester_email TEXT NOT NULL,
          requester_phone TEXT NOT NULL,
          role TEXT NOT NULL,
          proof_url TEXT,
          notes TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          reviewed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS legacy_hills_petition_signatures (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          street_address TEXT NOT NULL,
          neighborhood TEXT NOT NULL,
          phase_section TEXT,
          lot_block TEXT,
          builder TEXT,
          comments TEXT,
          signature_data_url TEXT NOT NULL,
          contact_id TEXT,
          edit_token_hash TEXT,
          signed_at TEXT NOT NULL,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      for (const statement of [
        'ALTER TABLE businesses ADD COLUMN owner_password_hash TEXT',
        'ALTER TABLE businesses ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1',
        'ALTER TABLE businesses ADD COLUMN email_verified_at TEXT',
        'ALTER TABLE businesses ADD COLUMN email_verification_token_hash TEXT',
        'ALTER TABLE businesses ADD COLUMN email_verification_expires_at TEXT',
        'ALTER TABLE businesses ADD COLUMN password_reset_token_hash TEXT',
        'ALTER TABLE businesses ADD COLUMN password_reset_expires_at TEXT',
        'ALTER TABLE businesses ADD COLUMN events_json TEXT NOT NULL DEFAULT \'[]\'',
        'ALTER TABLE businesses ADD COLUMN votes_count INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE businesses ADD COLUMN growth_credits_json TEXT NOT NULL DEFAULT \'{"shareClicks":0,"referralVisits":0}\'',
        'ALTER TABLE legacy_hills_petition_signatures ADD COLUMN phase_section TEXT',
        'ALTER TABLE legacy_hills_petition_signatures ADD COLUMN lot_block TEXT',
        'ALTER TABLE legacy_hills_petition_signatures ADD COLUMN builder TEXT',
        'ALTER TABLE legacy_hills_petition_signatures ADD COLUMN edit_token_hash TEXT',
        'ALTER TABLE legacy_hills_petition_signatures ADD COLUMN updated_at TEXT',
      ]) {
        try {
          this.db.exec(statement);
        } catch {
          // Column already exists on databases created before owner email verification support.
        }
      }

      const businessCount = Number((this.db.prepare('SELECT COUNT(*) as count FROM businesses').get() as any).count || 0);
      if (businessCount === 0) {
        this.seedInitialData();
      }
      this.ensureFeaturedPlaceholderBusinesses();
      this.resetLaunchCountersOnce();
    } else {
      this.seedInitialData();
    }
  }

  seedInitialData() {
    if (this.db) {
      this.db.exec('DELETE FROM businesses; DELETE FROM reported_bugs; DELETE FROM claim_requests; DELETE FROM legacy_hills_petition_signatures;');
      for (const business of INITIAL_BUSINESSES) {
        this.upsertBusiness(makeBusiness(business as CreateBusinessInput));
      }
    } else {
      this.businessesMap.clear();
      for (const business of INITIAL_BUSINESSES) {
        const busObj = makeBusiness(business as CreateBusinessInput);
        this.businessesMap.set(busObj.id, busObj);
      }
    }
  }

  ensureFeaturedPlaceholderBusinesses() {
    if (!this.db) return;
    for (const initBiz of INITIAL_BUSINESSES) {
      const existing = this.db.prepare("SELECT id FROM businesses WHERE id = ? OR lower(name) = lower(?)").get(initBiz.id, initBiz.name);
      if (!existing) {
        this.upsertBusiness(makeBusiness(initBiz as CreateBusinessInput));
      }
    }

    const lucys = makeFeaturedPlaceholderBusiness("Lucy's on the Square");
    this.db.prepare(`
      UPDATE businesses
      SET featured = 0, tier = 'basic'
      WHERE id = ? OR lower(name) = lower(?)
    `).run(lucys.id, lucys.name);

    const celinaBistro = makeFeaturedPlaceholderBusiness('CELINA Bistro');
    const existingBistro = this.db.prepare("SELECT id FROM businesses WHERE lower(name) LIKE 'celina bistro%' OR id = 'celina-bistro-demo' ORDER BY created_at DESC LIMIT 1").get() as { id?: string } | undefined;
    if (existingBistro?.id) {
      this.db.prepare(`
        UPDATE businesses
        SET name = ?, slug = ?, featured = 1, tier = ?, is_unclaimed = 0, email_verified = 1,
            owner_id = ?, logo_url = ?, images_json = ?, cta_text = ?
        WHERE id = ?
      `).run(celinaBistro.name, celinaBistro.slug, celinaBistro.tier, celinaBistro.ownerId || 'admin', celinaBistro.logoUrl, JSON.stringify(celinaBistro.images || []), celinaBistro.ctaText || 'View Demo', existingBistro.id);
    } else {
      this.upsertBusiness(celinaBistro);
    }

    const celinaFinancial = makeFeaturedPlaceholderBusiness('Celina Financial Planning Co.');
    const existingCelinaFinancialRows = this.db.prepare("SELECT id FROM businesses WHERE lower(name) = lower(?) OR lower(email) = lower(?)").all(celinaFinancial.name, celinaFinancial.email) as { id: string }[];
    if (existingCelinaFinancialRows.length) {
      this.db.prepare(`
        UPDATE businesses
        SET featured = 1, tier = ?, is_unclaimed = 0, email_verified = 1,
            owner_id = ?
        WHERE lower(name) = lower(?) OR lower(email) = lower(?)
      `).run(celinaFinancial.tier, celinaFinancial.ownerId || 'admin', celinaFinancial.name, celinaFinancial.email);
    } else {
      this.upsertBusiness(celinaFinancial);
    }
  }

  resetLaunchCountersOnce() {
    if (!this.db) return;
    const flag = this.db.prepare("SELECT value FROM app_settings WHERE key = 'launch_counters_reset_2026_08'").get() as { value?: string } | undefined;
    if (flag?.value === 'true') return;
    this.db.exec('UPDATE businesses SET views_count = 0;');
    this.db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('launch_counters_reset_2026_08', 'true')").run();
  }

  listBusinesses() {
    if (!this.db) return Array.from(this.businessesMap.values()).filter(b => b.emailVerified !== false);
    return this.db.prepare('SELECT * FROM businesses WHERE email_verified = 1 ORDER BY featured DESC, views_count DESC, name ASC').all().map(rowToBusiness);
  }

  getBusiness(id: string) {
    if (!this.db) return this.businessesMap.get(id) || null;
    const row = this.db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    return row ? rowToBusiness(row) : null;
  }

  createBusiness(input: CreateBusinessInput) {
    const business = makeBusiness(input);
    this.upsertBusiness(business);
    return business;
  }

  createOwnedBusiness(input: CreateBusinessInput, passwordHash: string, verification: { tokenHash: string; expiresAt: string }) {
    const business = makeBusiness({
      ...input,
      tier: input.tier || 'free',
      ownerId: input.ownerId || randomId('owner'),
      featured: false,
      website: input.website || '',
      hours: undefined,
      socialLinks: {},
      ctaText: 'Learn More',
      isUnclaimed: false,
      emailVerified: false,
      emailVerifiedAt: '',
    });
    this.upsertBusiness({ ...business, ownerPasswordHash: passwordHash } as any);
    if (this.db) {
      this.db.prepare('UPDATE businesses SET owner_password_hash = ?, email_verified = 0, email_verified_at = ?, email_verification_token_hash = ?, email_verification_expires_at = ? WHERE id = ?')
        .run(passwordHash, '', verification.tokenHash, verification.expiresAt, business.id);
    }
    return business;
  }

  getOwnedBusinessByEmail(email: string) {
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find(b => b.email.toLowerCase() === email.toLowerCase());
      return found || null;
    }
    const row = this.db.prepare('SELECT * FROM businesses WHERE lower(email) = lower(?) AND owner_password_hash IS NOT NULL AND owner_password_hash != ? ORDER BY created_at DESC LIMIT 1').get(email, '');
    return row ? rowToOwnedBusiness(row) : null;
  }

  getOwnedBusinessByOwnerId(ownerId: string) {
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find(b => b.ownerId === ownerId);
      return found || null;
    }
    const row = this.db.prepare('SELECT * FROM businesses WHERE owner_id = ? AND owner_password_hash IS NOT NULL AND owner_password_hash != ? ORDER BY created_at DESC LIMIT 1').get(ownerId, '');
    return row ? rowToOwnedBusiness(row) : null;
  }

  verifyOwnerEmailByTokenHash(tokenHash: string) {
    if (!this.db) return null;
    const row = this.db.prepare('SELECT * FROM businesses WHERE email_verification_token_hash = ? AND email_verification_expires_at > ? LIMIT 1').get(tokenHash, new Date().toISOString());
    if (!row) return null;
    const verifiedAt = new Date().toISOString();
    this.db.prepare('UPDATE businesses SET email_verified = 1, email_verified_at = ?, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ?')
      .run(verifiedAt, (row as any).id);
    return this.getOwnedBusinessByOwnerId((row as any).owner_id);
  }

  refreshOwnerEmailVerification(email: string, verification: { tokenHash: string; expiresAt: string }) {
    if (!this.db) return null;
    const existing = this.getOwnedBusinessByEmail(email);
    if (!existing || existing.emailVerified) return null;
    this.db.prepare('UPDATE businesses SET email_verification_token_hash = ?, email_verification_expires_at = ? WHERE id = ?')
      .run(verification.tokenHash, verification.expiresAt, existing.id);
    return this.getBusiness(existing.id);
  }

  createOwnerPasswordReset(email: string, reset: { tokenHash: string; expiresAt: string }) {
    const existing = this.getOwnedBusinessByEmail(email);
    if (!existing) return null;
    if (!this.db) {
      this.businessesMap.set(existing.id, {
        ...existing,
        passwordResetTokenHash: reset.tokenHash,
        passwordResetExpiresAt: reset.expiresAt,
      } as any);
      return existing;
    }
    this.db.prepare('UPDATE businesses SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?')
      .run(reset.tokenHash, reset.expiresAt, existing.id);
    return this.getBusiness(existing.id);
  }

  resetOwnerPasswordByTokenHash(tokenHash: string, passwordHash: string) {
    const verifiedAt = new Date().toISOString();
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find((business: any) =>
        business.passwordResetTokenHash === tokenHash &&
        business.passwordResetExpiresAt &&
        business.passwordResetExpiresAt > verifiedAt
      );
      if (!found) return null;
      const updated = {
        ...found,
        ownerPasswordHash: passwordHash,
        emailVerified: true,
        emailVerifiedAt: found.emailVerifiedAt || verifiedAt,
        passwordResetTokenHash: '',
        passwordResetExpiresAt: '',
      } as any;
      this.businessesMap.set(found.id, updated);
      return updated;
    }
    const row = this.db.prepare('SELECT * FROM businesses WHERE password_reset_token_hash = ? AND password_reset_expires_at > ? LIMIT 1').get(tokenHash, verifiedAt);
    if (!row) return null;
    this.db.prepare('UPDATE businesses SET owner_password_hash = ?, email_verified = 1, email_verified_at = COALESCE(NULLIF(email_verified_at, ?), ?), password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ?')
      .run(passwordHash, '', verifiedAt, (row as any).id);
    return this.getOwnedBusinessByOwnerId((row as any).owner_id);
  }

  upsertBusiness(input: CreateBusinessInput | Business) {
    const business = makeBusiness(input);
    if (!this.db) {
      this.businessesMap.set(business.id, business as any);
      return business;
    }
    this.db.prepare(`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, events_json, views_count, votes_count, growth_credits_json, is_unclaimed, is_registry_only,
        email_verified, email_verified_at
      ) VALUES (
        @id, @slug, @name, @category, @description, @phone, @email, @website, @address,
        @hours_json, @logo_url, @images_json, @social_links_json, @featured, @cta_text,
        @tier, @owner_id, @created_at, @reviews_json, @events_json, @views_count, @votes_count, @growth_credits_json, @is_unclaimed, @is_registry_only,
        @email_verified, @email_verified_at
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
        events_json = excluded.events_json,
        views_count = excluded.views_count,
        votes_count = excluded.votes_count,
        growth_credits_json = excluded.growth_credits_json,
        is_unclaimed = excluded.is_unclaimed,
        is_registry_only = excluded.is_registry_only,
        email_verified = excluded.email_verified,
        email_verified_at = excluded.email_verified_at
    `).run(toBusinessParams(business));
  }

  updateBusiness(id: string, updates: Partial<Business>) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const updated: Business = { ...current, ...updates, id };
    this.upsertBusiness(updated);
    return updated;
  }

  updateOwnerAccount(id: string, updates: { ownerId?: string; email?: string; passwordHash?: string; emailVerified?: boolean }) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const ownerId = updates.ownerId ?? current.ownerId;
    const email = updates.email ?? current.email;
    const emailVerified = updates.emailVerified ?? current.emailVerified ?? true;
    const emailVerifiedAt = emailVerified ? (current.emailVerifiedAt || new Date().toISOString()) : '';
    const updated: Business = {
      ...current,
      ownerId,
      email,
      isUnclaimed: !ownerId,
      emailVerified,
      emailVerifiedAt,
    };
    this.upsertBusiness(updated);
    if (this.db) {
      const passwordClause = updates.passwordHash ? ', owner_password_hash = ?' : '';
      const params = updates.passwordHash
        ? [emailVerified ? 1 : 0, emailVerifiedAt, '', null, updates.passwordHash, id]
        : [emailVerified ? 1 : 0, emailVerifiedAt, '', null, id];
      this.db.prepare(`UPDATE businesses SET email_verified = ?, email_verified_at = ?, email_verification_token_hash = ?, email_verification_expires_at = ?${passwordClause} WHERE id = ?`)
        .run(...params);
    }
    return this.getOwnedBusinessByOwnerId(ownerId) || rowToOwnedBusiness({ ...toBusinessParams(updated), owner_password_hash: updates.passwordHash || '' });
  }

  deleteBusiness(id: string) {
    if (!this.db) {
      return this.businessesMap.delete(id);
    }
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

  voteBusiness(id: string, delta: 1 | -1) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const business: Business = { ...current, votesCount: Math.max(0, Number(current.votesCount || 0) + delta) };
    this.upsertBusiness(business);
    return business;
  }

  trackBusinessGrowthAction(id: string, action: 'shareClick' | 'referralVisit') {
    const current = this.getBusiness(id);
    if (!current) return null;
    const growth = {
      shareClicks: Number(current.growthCredits?.shareClicks || 0),
      referralVisits: Number(current.growthCredits?.referralVisits || 0),
      updatedAt: new Date().toISOString(),
    };
    if (action === 'shareClick') growth.shareClicks += 1;
    if (action === 'referralVisit') growth.referralVisits += 1;
    const business: Business = { ...current, growthCredits: growth };
    this.upsertBusiness(business);
    return business;
  }

  listBugs() {
    if (!this.db) {
      return Array.from(this.bugsMap.values());
    }
    return this.db.prepare('SELECT * FROM reported_bugs ORDER BY created_at DESC').all().map(rowToBug);
  }

  createLegacyHillsPetitionSignature(input: CreateLegacyHillsPetitionSignatureInput) {
    const signature = makeLegacyHillsPetitionSignature(input);
    if (!this.db) {
      this.petitionsMap.set(signature.id, signature);
      return signature;
    }
    const values = toLegacyHillsPetitionParams(signature);
    this.db.prepare(`
      INSERT INTO legacy_hills_petition_signatures (
        id, first_name, last_name, email, phone, street_address, neighborhood, phase_section, lot_block, builder, comments, signature_data_url, contact_id, edit_token_hash, signed_at, updated_at
      ) VALUES (
        @id, @first_name, @last_name, @email, @phone, @street_address, @neighborhood, @phase_section, @lot_block, @builder, @comments, @signature_data_url, @contact_id, @edit_token_hash, @signed_at, @updated_at
      )
    `).run(values);
    return signature;
  }

  listLegacyHillsPetitionSignatures() {
    if (!this.db) {
      return Array.from(this.petitionsMap.values());
    }
    return this.db.prepare('SELECT * FROM legacy_hills_petition_signatures ORDER BY signed_at DESC').all().map(rowToLegacyHillsPetitionSignature);
  }

  getLegacyHillsPetitionSignatureByContact(email: string, phone: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, '');
    const matchesContact = (signature: LegacyHillsPetitionSignature) =>
      signature.email.trim().toLowerCase() === normalizedEmail &&
      signature.phone.replace(/\D/g, '') === normalizedPhone;
    if (!this.db) {
      return Array.from(this.petitionsMap.values()).find(matchesContact) || null;
    }
    const signatures = this.db.prepare('SELECT * FROM legacy_hills_petition_signatures WHERE lower(email) = ? ORDER BY signed_at DESC').all(normalizedEmail).map(rowToLegacyHillsPetitionSignature);
    return signatures.find(matchesContact) || null;
  }

  getLegacyHillsPetitionSignatureByEditTokenHash(tokenHash: string) {
    if (!this.db) {
      return Array.from(this.petitionsMap.values()).find((signature: any) => signature.editTokenHash === tokenHash) || null;
    }
    const row = this.db.prepare('SELECT * FROM legacy_hills_petition_signatures WHERE edit_token_hash = ?').get(tokenHash);
    return row ? rowToLegacyHillsPetitionSignature(row) : null;
  }

  updateLegacyHillsPetitionSignature(id: string, updates: UpdateLegacyHillsPetitionSignatureInput) {
    const existing = !this.db
      ? this.petitionsMap.get(id)
      : this.db.prepare('SELECT * FROM legacy_hills_petition_signatures WHERE id = ?').get(id);
    if (!existing) return null;
    const current = this.db ? rowToLegacyHillsPetitionSignature(existing) : existing;
    const next = {
      ...(current as any),
      ...updates,
      email: updates.email ? updates.email.trim().toLowerCase() : current.email,
      updatedAt: new Date().toISOString(),
    } as LegacyHillsPetitionSignature & { editTokenHash?: string };
    if (!this.db) {
      this.petitionsMap.set(id, next);
      return next;
    }
    const values = toLegacyHillsPetitionParams(next);
    this.db.prepare(`
      UPDATE legacy_hills_petition_signatures SET
        first_name = @first_name,
        last_name = @last_name,
        email = @email,
        phone = @phone,
        street_address = @street_address,
        neighborhood = @neighborhood,
        phase_section = @phase_section,
        lot_block = @lot_block,
        builder = @builder,
        comments = @comments,
        signature_data_url = @signature_data_url,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: values.id,
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone,
      street_address: values.street_address,
      neighborhood: values.neighborhood,
      phase_section: values.phase_section,
      lot_block: values.lot_block,
      builder: values.builder,
      comments: values.comments,
      signature_data_url: values.signature_data_url,
      updated_at: values.updated_at,
    });
    return rowToLegacyHillsPetitionSignature(this.db.prepare('SELECT * FROM legacy_hills_petition_signatures WHERE id = ?').get(id));
  }

  createBug(input: CreateBugInput) {
    const bug: ReportedBug = { id: randomId('bug'), ...input, createdAt: new Date().toISOString(), status: 'open' };
    if (!this.db) {
      this.bugsMap.set(bug.id, bug);
      return bug;
    }
    this.db.prepare(`
      INSERT INTO reported_bugs (id, title, description, category, severity, email, created_at, status)
      VALUES (@id, @title, @description, @category, @severity, @email, @created_at, @status)
    `).run(toBugParams(bug));
    return bug;
  }

  updateBug(id: string, updates: Partial<ReportedBug>) {
    if (!this.db) {
      const existing = this.bugsMap.get(id);
      if (!existing) return null;
      const bug: ReportedBug = { ...existing, ...updates, id };
      this.bugsMap.set(id, bug);
      return bug;
    }
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
    if (!this.db) {
      return this.bugsMap.delete(id);
    }
    const result = this.db.prepare('DELETE FROM reported_bugs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  createClaimRequest(input: CreateClaimRequestInput) {
    const business = this.getBusiness(input.businessId);
    if (!business) return null;
    const claim: ClaimRequest = {
      id: randomId('claim'),
      businessId: business.id,
      businessName: business.name,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      role: input.role,
      proofUrl: input.proofUrl || '',
      notes: input.notes || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: '',
    };
    if (!this.db) {
      this.claimsMap.set(claim.id, claim);
      return claim;
    }
    this.db.prepare(`
      INSERT INTO claim_requests (id, business_id, business_name, requester_name, requester_email, requester_phone, role, proof_url, notes, status, created_at, reviewed_at)
      VALUES (@id, @business_id, @business_name, @requester_name, @requester_email, @requester_phone, @role, @proof_url, @notes, @status, @created_at, @reviewed_at)
    `).run(toClaimParams(claim));
    return claim;
  }

  listClaimRequests() {
    if (!this.db) {
      return Array.from(this.claimsMap.values());
    }
    return this.db.prepare('SELECT * FROM claim_requests ORDER BY created_at DESC').all().map(rowToClaimRequest);
  }

  updateClaimRequest(id: string, updates: Partial<ClaimRequest>) {
    const current = this.db.prepare('SELECT * FROM claim_requests WHERE id = ?').get(id);
    if (!current) return null;
    const claim: ClaimRequest = { ...rowToClaimRequest(current), ...updates, id };
    this.db.prepare(`
      UPDATE claim_requests
      SET business_id = @business_id, business_name = @business_name, requester_name = @requester_name,
          requester_email = @requester_email, requester_phone = @requester_phone, role = @role,
          proof_url = @proof_url, notes = @notes, status = @status, created_at = @created_at, reviewed_at = @reviewed_at
      WHERE id = @id
    `).run(toClaimParams(claim));
    return claim;
  }

  reset() {
    this.seedInitialData();
    return { businesses: this.listBusinesses(), reportedBugs: this.listBugs() };
  }
}

class PostgresRepository implements CelinaDataStore {
  private sql: any = null;
  private initialized?: Promise<void>;
  private fallbackRepo: CelinaRepository;

  constructor(databaseUrl: string) {
    this.fallbackRepo = new CelinaRepository(':memory:');
    if (neonFn) {
      try {
        const sql = neonFn(databaseUrl);
        this.sql = typeof sql === 'function' ? sql : null;
        if (!this.sql) {
          console.warn("Neon client did not return a callable SQL function; using in-memory fallback.");
        }
      } catch (err) {
        console.warn("Failed to initialize neon client:", err);
        this.sql = null;
      }
    }
  }

  private async ensureInitialized() {
    if (!this.sql) return;
    if (!this.initialized) {
      this.initialized = this.initialize().catch((err) => {
        console.warn("Postgres initialization failed, using in-memory fallback:", err);
        this.sql = null;
      });
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
        events_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        views_count INTEGER NOT NULL DEFAULT 0,
        votes_count INTEGER NOT NULL DEFAULT 0,
        growth_credits_json JSONB NOT NULL DEFAULT '{"shareClicks":0,"referralVisits":0}'::jsonb,
        is_unclaimed BOOLEAN NOT NULL DEFAULT FALSE,
        is_registry_only BOOLEAN NOT NULL DEFAULT FALSE,
        owner_password_hash TEXT,
        email_verified BOOLEAN NOT NULL DEFAULT TRUE,
        email_verified_at TEXT,
        email_verification_token_hash TEXT,
        email_verification_expires_at TEXT,
        password_reset_token_hash TEXT,
        password_reset_expires_at TEXT
      )
    `;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_password_hash TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_verified_at TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email_verification_expires_at TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS password_reset_expires_at TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS events_json JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS votes_count INTEGER NOT NULL DEFAULT 0`;
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
    await this.sql`
      CREATE TABLE IF NOT EXISTS claim_requests (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        business_name TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        requester_email TEXT NOT NULL,
        requester_phone TEXT NOT NULL,
        role TEXT NOT NULL,
        proof_url TEXT,
        notes TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reviewed_at TEXT
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS legacy_hills_petition_signatures (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        street_address TEXT NOT NULL,
        neighborhood TEXT NOT NULL,
        phase_section TEXT,
        lot_block TEXT,
        builder TEXT,
        comments TEXT,
        signature_data_url TEXT NOT NULL,
        contact_id TEXT,
        edit_token_hash TEXT,
        signed_at TEXT NOT NULL,
        updated_at TEXT
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await this.sql`ALTER TABLE legacy_hills_petition_signatures ADD COLUMN IF NOT EXISTS phase_section TEXT`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS growth_credits_json JSONB NOT NULL DEFAULT '{"shareClicks":0,"referralVisits":0}'::jsonb`;
    await this.sql`ALTER TABLE legacy_hills_petition_signatures ADD COLUMN IF NOT EXISTS lot_block TEXT`;
    await this.sql`ALTER TABLE legacy_hills_petition_signatures ADD COLUMN IF NOT EXISTS builder TEXT`;
    await this.sql`ALTER TABLE legacy_hills_petition_signatures ADD COLUMN IF NOT EXISTS edit_token_hash TEXT`;
    await this.sql`ALTER TABLE legacy_hills_petition_signatures ADD COLUMN IF NOT EXISTS updated_at TEXT`;
    const rows = await this.sql`SELECT COUNT(*)::int AS count FROM businesses` as any[];
    if (Number(rows[0]?.count || 0) === 0) {
      await this.seedInitialData();
    }
    await this.ensureFeaturedPlaceholderBusinesses();
    await this.resetLaunchCountersOnce();
  }

  private async seedInitialData() {
    await this.sql`DELETE FROM businesses`;
    await this.sql`DELETE FROM reported_bugs`;
    await this.sql`DELETE FROM claim_requests`;
    await this.sql`DELETE FROM legacy_hills_petition_signatures`;
    for (const business of INITIAL_BUSINESSES) {
      await this.upsertBusiness(makeBusiness(business as CreateBusinessInput), false);
    }
  }

  private async ensureFeaturedPlaceholderBusinesses() {
    const lucys = makeFeaturedPlaceholderBusiness("Lucy's on the Square");
    await this.sql`
      UPDATE businesses
      SET featured = FALSE, tier = 'basic'
      WHERE id = ${lucys.id} OR lower(name) = lower(${lucys.name})
    `;

    const celinaBistro = makeFeaturedPlaceholderBusiness('CELINA Bistro');
    const existingBistro = await this.sql`
      SELECT id FROM businesses WHERE lower(name) LIKE 'celina bistro%' OR id = 'celina-bistro-demo' ORDER BY created_at DESC LIMIT 1
    ` as any[];
    if (existingBistro[0]?.id) {
      await this.sql`
        UPDATE businesses
        SET name = ${celinaBistro.name}, slug = ${celinaBistro.slug}, featured = TRUE, tier = ${celinaBistro.tier}, is_unclaimed = FALSE, email_verified = TRUE,
            owner_id = ${celinaBistro.ownerId || 'admin'}, logo_url = ${celinaBistro.logoUrl}, images_json = ${JSON.stringify(celinaBistro.images || [])}, cta_text = ${celinaBistro.ctaText || 'View Demo'}
        WHERE id = ${existingBistro[0].id}
      `;
    } else {
      await this.upsertBusiness(celinaBistro, false);
    }

    const celinaFinancial = makeFeaturedPlaceholderBusiness('Celina Financial Planning Co.');
    const existingCelinaFinancialRows = await this.sql`
      SELECT id FROM businesses WHERE lower(name) = lower(${celinaFinancial.name}) OR lower(email) = lower(${celinaFinancial.email})
    ` as any[];
    if (existingCelinaFinancialRows.length) {
      await this.sql`
        UPDATE businesses
        SET featured = TRUE, tier = ${celinaFinancial.tier}, is_unclaimed = FALSE, email_verified = TRUE,
            owner_id = ${celinaFinancial.ownerId || 'admin'}
        WHERE lower(name) = lower(${celinaFinancial.name}) OR lower(email) = lower(${celinaFinancial.email})
      `;
    } else {
      await this.upsertBusiness(celinaFinancial, false);
    }
  }

  private async resetLaunchCountersOnce() {
    const rows = await this.sql`SELECT value FROM app_settings WHERE key = 'launch_counters_reset_2026_08'` as any[];
    if (rows[0]?.value === 'true') return;
    await this.sql`UPDATE businesses SET views_count = 0`;
    await this.sql`INSERT INTO app_settings (key, value) VALUES ('launch_counters_reset_2026_08', 'true') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }

  async listBusinesses() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE email_verified = TRUE ORDER BY featured DESC, views_count DESC, name ASC` as any[];
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

  async createOwnedBusiness(input: CreateBusinessInput, passwordHash: string, verification: { tokenHash: string; expiresAt: string }) {
    await this.ensureInitialized();
    const business = makeBusiness({
      ...input,
      tier: input.tier || 'free',
      ownerId: input.ownerId || randomId('owner'),
      featured: false,
      website: '',
      hours: undefined,
      socialLinks: {},
      ctaText: 'Learn More',
      isUnclaimed: false,
      emailVerified: false,
      emailVerifiedAt: '',
    });
    await this.upsertBusiness(business, false);
    await this.sql`UPDATE businesses SET owner_password_hash = ${passwordHash}, email_verified = FALSE, email_verified_at = '', email_verification_token_hash = ${verification.tokenHash}, email_verification_expires_at = ${verification.expiresAt} WHERE id = ${business.id}`;
    return business;
  }

  async getOwnedBusinessByEmail(email: string) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.getOwnedBusinessByEmail(email);
    const rows = await this.sql`SELECT * FROM businesses WHERE lower(email) = lower(${email}) AND owner_password_hash IS NOT NULL AND owner_password_hash != '' ORDER BY created_at DESC LIMIT 1` as any[];
    return rows[0] ? rowToOwnedBusiness(rows[0]) : null;
  }

  async getOwnedBusinessByOwnerId(ownerId: string) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.getOwnedBusinessByOwnerId(ownerId);
    const rows = await this.sql`SELECT * FROM businesses WHERE owner_id = ${ownerId} AND owner_password_hash IS NOT NULL AND owner_password_hash != '' ORDER BY created_at DESC LIMIT 1` as any[];
    return rows[0] ? rowToOwnedBusiness(rows[0]) : null;
  }

  async verifyOwnerEmailByTokenHash(tokenHash: string) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE email_verification_token_hash = ${tokenHash} AND email_verification_expires_at > ${new Date().toISOString()} LIMIT 1` as any[];
    if (!rows[0]) return null;
    const verifiedAt = new Date().toISOString();
    await this.sql`UPDATE businesses SET email_verified = TRUE, email_verified_at = ${verifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${rows[0].id}`;
    return this.getOwnedBusinessByOwnerId(rows[0].owner_id);
  }

  async refreshOwnerEmailVerification(email: string, verification: { tokenHash: string; expiresAt: string }) {
    const existing = await this.getOwnedBusinessByEmail(email);
    if (!existing || existing.emailVerified) return null;
    await this.sql`UPDATE businesses SET email_verification_token_hash = ${verification.tokenHash}, email_verification_expires_at = ${verification.expiresAt} WHERE id = ${existing.id}`;
    return this.getBusiness(existing.id);
  }

  async createOwnerPasswordReset(email: string, reset: { tokenHash: string; expiresAt: string }) {
    const existing = await this.getOwnedBusinessByEmail(email);
    if (!existing) return null;
    if (!this.sql) return this.fallbackRepo.createOwnerPasswordReset(email, reset);
    await this.sql`UPDATE businesses SET password_reset_token_hash = ${reset.tokenHash}, password_reset_expires_at = ${reset.expiresAt} WHERE id = ${existing.id}`;
    return this.getBusiness(existing.id);
  }

  async resetOwnerPasswordByTokenHash(tokenHash: string, passwordHash: string) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.resetOwnerPasswordByTokenHash(tokenHash, passwordHash);
    const now = new Date().toISOString();
    const rows = await this.sql`SELECT * FROM businesses WHERE password_reset_token_hash = ${tokenHash} AND password_reset_expires_at > ${now} LIMIT 1` as any[];
    if (!rows[0]) return null;
    const verifiedAt = rows[0].email_verified_at || now;
    await this.sql`UPDATE businesses SET owner_password_hash = ${passwordHash}, email_verified = TRUE, email_verified_at = ${verifiedAt}, password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ${rows[0].id}`;
    return this.getOwnedBusinessByOwnerId(rows[0].owner_id);
  }

  private async upsertBusiness(business: Business, initialize = true) {
    if (initialize) await this.ensureInitialized();
    const values = toBusinessParams(business);
    await this.sql`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, events_json, views_count, votes_count, growth_credits_json, is_unclaimed, is_registry_only,
        email_verified, email_verified_at
      ) VALUES (
        ${values.id}, ${values.slug}, ${values.name}, ${values.category}, ${values.description}, ${values.phone}, ${values.email}, ${values.website}, ${values.address},
        ${values.hours_json}, ${values.logo_url}, ${values.images_json}, ${values.social_links_json}, ${Boolean(values.featured)}, ${values.cta_text},
        ${values.tier}, ${values.owner_id}, ${values.created_at}, ${values.reviews_json}, ${values.events_json}, ${values.views_count}, ${values.votes_count}, ${values.growth_credits_json}, ${Boolean(values.is_unclaimed)}, ${Boolean(values.is_registry_only)},
        ${Boolean(values.email_verified)}, ${values.email_verified_at}
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
        events_json = EXCLUDED.events_json,
        views_count = EXCLUDED.views_count,
        votes_count = EXCLUDED.votes_count,
        growth_credits_json = EXCLUDED.growth_credits_json,
        is_unclaimed = EXCLUDED.is_unclaimed,
        is_registry_only = EXCLUDED.is_registry_only,
        email_verified = EXCLUDED.email_verified,
        email_verified_at = EXCLUDED.email_verified_at
    `;
  }

  async updateBusiness(id: string, updates: Partial<Business>) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const updated: Business = { ...current, ...updates, id };
    await this.upsertBusiness(updated);
    return updated;
  }

  async updateOwnerAccount(id: string, updates: { ownerId?: string; email?: string; passwordHash?: string; emailVerified?: boolean }) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const ownerId = updates.ownerId ?? current.ownerId;
    const email = updates.email ?? current.email;
    const emailVerified = updates.emailVerified ?? current.emailVerified ?? true;
    const emailVerifiedAt = emailVerified ? (current.emailVerifiedAt || new Date().toISOString()) : '';
    const updated: Business = {
      ...current,
      ownerId,
      email,
      isUnclaimed: !ownerId,
      emailVerified,
      emailVerifiedAt,
    };
    await this.upsertBusiness(updated);
    if (updates.passwordHash) {
      await this.sql`UPDATE businesses SET owner_password_hash = ${updates.passwordHash}, email_verified = ${emailVerified}, email_verified_at = ${emailVerifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${id}`;
    } else {
      await this.sql`UPDATE businesses SET email_verified = ${emailVerified}, email_verified_at = ${emailVerifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${id}`;
    }
    const owned = await this.getOwnedBusinessByOwnerId(ownerId);
    return owned || { ...updated, ownerPasswordHash: updates.passwordHash || '' };
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

  async voteBusiness(id: string, delta: 1 | -1) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const business: Business = { ...current, votesCount: Math.max(0, Number(current.votesCount || 0) + delta) };
    await this.upsertBusiness(business);
    return business;
  }

  async trackBusinessGrowthAction(id: string, action: 'shareClick' | 'referralVisit') {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const growth = {
      shareClicks: Number(current.growthCredits?.shareClicks || 0),
      referralVisits: Number(current.growthCredits?.referralVisits || 0),
      updatedAt: new Date().toISOString(),
    };
    if (action === 'shareClick') growth.shareClicks += 1;
    if (action === 'referralVisit') growth.referralVisits += 1;
    const business: Business = { ...current, growthCredits: growth };
    await this.upsertBusiness(business);
    return business;
  }

  async listBugs() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM reported_bugs ORDER BY created_at DESC` as any[];
    return rows.map(rowToBug);
  }

  async createLegacyHillsPetitionSignature(input: CreateLegacyHillsPetitionSignatureInput) {
    await this.ensureInitialized();
    const signature = makeLegacyHillsPetitionSignature(input);
    await this.sql`
      INSERT INTO legacy_hills_petition_signatures (
        id, first_name, last_name, email, phone, street_address, neighborhood, phase_section, lot_block, builder, comments, signature_data_url, contact_id, edit_token_hash, signed_at, updated_at
      ) VALUES (
        ${signature.id}, ${signature.firstName}, ${signature.lastName}, ${signature.email}, ${signature.phone}, ${signature.streetAddress}, ${signature.neighborhood}, ${signature.phaseSection || ''}, ${signature.lotBlock || ''}, ${signature.builder || ''}, ${signature.comments || ''}, ${signature.signatureDataUrl}, ${signature.contactId || ''}, ${(signature as any).editTokenHash || ''}, ${signature.signedAt}, ${signature.updatedAt || ''}
      )
    `;
    return signature;
  }

  async listLegacyHillsPetitionSignatures() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures ORDER BY signed_at DESC` as any[];
    return rows.map(rowToLegacyHillsPetitionSignature);
  }

  async getLegacyHillsPetitionSignatureByContact(email: string, phone: string) {
    await this.ensureInitialized();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, '');
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE lower(email) = ${normalizedEmail} ORDER BY signed_at DESC` as any[];
    return rows.map(rowToLegacyHillsPetitionSignature).find((signature) => signature.phone.replace(/\D/g, '') === normalizedPhone) || null;
  }

  async getLegacyHillsPetitionSignatureByEditTokenHash(tokenHash: string) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE edit_token_hash = ${tokenHash} LIMIT 1` as any[];
    return rows[0] ? rowToLegacyHillsPetitionSignature(rows[0]) : null;
  }

  async updateLegacyHillsPetitionSignature(id: string, updates: UpdateLegacyHillsPetitionSignatureInput) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE id = ${id} LIMIT 1` as any[];
    if (!rows[0]) return null;
    const current = rowToLegacyHillsPetitionSignature(rows[0]);
    const next = {
      ...current,
      ...updates,
      email: updates.email ? updates.email.trim().toLowerCase() : current.email,
      updatedAt: new Date().toISOString(),
    };
    await this.sql`
      UPDATE legacy_hills_petition_signatures SET
        first_name = ${next.firstName},
        last_name = ${next.lastName},
        email = ${next.email},
        phone = ${next.phone},
        street_address = ${next.streetAddress},
        neighborhood = ${next.neighborhood || 'Legacy Hills'},
        phase_section = ${next.phaseSection || ''},
        lot_block = ${next.lotBlock || ''},
        builder = ${next.builder || ''},
        comments = ${next.comments || ''},
        signature_data_url = ${next.signatureDataUrl},
        updated_at = ${next.updatedAt || ''}
      WHERE id = ${id}
    `;
    const refreshed = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE id = ${id} LIMIT 1` as any[];
    return refreshed[0] ? rowToLegacyHillsPetitionSignature(refreshed[0]) : null;
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

  async createClaimRequest(input: CreateClaimRequestInput) {
    const business = await this.getBusiness(input.businessId);
    if (!business) return null;
    const claim: ClaimRequest = {
      id: randomId('claim'),
      businessId: business.id,
      businessName: business.name,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      role: input.role,
      proofUrl: input.proofUrl || '',
      notes: input.notes || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: '',
    };
    const values = toClaimParams(claim);
    await this.sql`
      INSERT INTO claim_requests (id, business_id, business_name, requester_name, requester_email, requester_phone, role, proof_url, notes, status, created_at, reviewed_at)
      VALUES (${values.id}, ${values.business_id}, ${values.business_name}, ${values.requester_name}, ${values.requester_email}, ${values.requester_phone}, ${values.role}, ${values.proof_url}, ${values.notes}, ${values.status}, ${values.created_at}, ${values.reviewed_at})
    `;
    return claim;
  }

  async listClaimRequests() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM claim_requests ORDER BY created_at DESC` as any[];
    return rows.map(rowToClaimRequest);
  }

  async updateClaimRequest(id: string, updates: Partial<ClaimRequest>) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM claim_requests WHERE id = ${id}` as any[];
    if (!rows[0]) return null;
    const claim: ClaimRequest = { ...rowToClaimRequest(rows[0]), ...updates, id };
    const values = toClaimParams(claim);
    await this.sql`
      UPDATE claim_requests
      SET business_id = ${values.business_id}, business_name = ${values.business_name}, requester_name = ${values.requester_name},
          requester_email = ${values.requester_email}, requester_phone = ${values.requester_phone}, role = ${values.role},
          proof_url = ${values.proof_url}, notes = ${values.notes}, status = ${values.status}, created_at = ${values.created_at}, reviewed_at = ${values.reviewed_at}
      WHERE id = ${values.id}
    `;
    return claim;
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
    events_json: toJson(business.events ?? []),
    views_count: business.viewsCount || 0,
    votes_count: business.votesCount || 0,
    growth_credits_json: toJson(business.growthCredits ?? { shareClicks: 0, referralVisits: 0 }),
    is_unclaimed: business.isUnclaimed ? 1 : 0,
    is_registry_only: business.isRegistryOnly ? 1 : 0,
    email_verified: business.emailVerified === false ? 0 : 1,
    email_verified_at: business.emailVerifiedAt || '',
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
