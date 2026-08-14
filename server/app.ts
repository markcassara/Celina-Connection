import crypto from "node:crypto";
import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";
import { createRepository, type CelinaDataStore, CelinaRepository } from "./database";
import { CATEGORIES, INITIAL_BUSINESSES } from "../src/data/mockBusinesses";
import { CATEGORY_LANDING_PAGES, categoryLandingForSlug } from "../src/lib/categoryRoutes";
import {
  BRAND_LOGO_IMAGE,
  DEFAULT_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE,
  DIRECTORY_FAQ,
  PRICING_FAQ,
  PUBLIC_PAGE_META,
  SITE_URL,
  isPublicPageKey,
  publicPagePath,
} from "../src/lib/seoMetadata";


dotenv.config({ path: [".env.local", ".env"] });

// Lazy-loaded Stripe instance to prevent crashes when STRIPE_SECRET_KEY is missing
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required for real payments.");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as any,
    });
  }
  return stripeClient;
}

const geminiApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const geminiChatModel = () => process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite";
const geminiSearchModel = () => process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite";
const googlePlacesApiKey = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const publicBusinessCategories = CATEGORIES.filter((category) => category !== "All");

// Lazy-loaded Gemini AI client instance to prevent crashes when Gemini is missing
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = geminiApiKey();
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI features.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to perform generateContent with automatic model fallback (lite -> flash)
async function generateContentWithFallback(ai: GoogleGenAI, params: {
  model: string;
  contents: any;
  config: any;
}) {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    console.warn(`Primary model ${params.model} invocation failed. Attempting fallback... Error:`, error.message || error);

    const errMsg = String(error.message || error || "");
    const isSearchError = errMsg.includes("googleSearch") || errMsg.includes("grounding");
    const isOverloadOrQuota =
      error.status === 503 ||
      error.status === 429 ||
      errMsg.includes("quota") ||
      errMsg.includes("demand") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("limit") ||
      errMsg.includes("exhausted");

    if (isSearchError || isOverloadOrQuota || params.model !== "gemini-3.5-flash") {
      const fallbackModel = "gemini-3.5-flash";
      console.log(`Falling back to model "${fallbackModel}" and removing search grounding if any...`);

      const fallbackConfig = { ...params.config };
      if (fallbackConfig.tools) {
        delete fallbackConfig.tools;
      }

      try {
        return await ai.models.generateContent({
          model: fallbackModel,
          contents: params.contents,
          config: fallbackConfig,
        });
      } catch (fallbackErr: any) {
        console.error("Fallback model failed as well:", fallbackErr.message || fallbackErr);
        throw fallbackErr;
      }
    }

    throw error;
  }
}

const normalizeWebsiteUrl = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const decodeHtmlEntities = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, " ");

const cleanPageText = (value: string, maxLength = 6000) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

const htmlAttribute = (html: string, pattern: RegExp) => {
  const match = html.match(pattern);
  return decodeHtmlEntities(match?.[1] || "").trim();
};

const extractWebsiteSignals = (html: string, websiteUrl: string) => {
  const title = htmlAttribute(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = htmlAttribute(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || htmlAttribute(html, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i);
  const ogImage = htmlAttribute(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || htmlAttribute(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  const phone = htmlAttribute(html, /href=["']tel:([^"']+)["']/i)
    || htmlAttribute(cleanPageText(html), /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  const email = htmlAttribute(html, /href=["']mailto:([^"'?]+)[^"']*["']/i)
    || htmlAttribute(cleanPageText(html), /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  let resolvedImage = "";
  if (ogImage) {
    try {
      resolvedImage = new URL(ogImage, websiteUrl).toString();
    } catch {
      resolvedImage = ogImage;
    }
  }
  return {
    title,
    description,
    phone,
    email,
    imageUrl: resolvedImage,
    pageText: cleanPageText(html),
  };
};

const categoryFromPlaceTypes = (types: string[] = []) => {
  const joined = types.join(" ");
  if (/restaurant|cafe|bakery|bar|food/i.test(joined)) return "Dining";
  if (/real_estate/i.test(joined)) return "Real Estate";
  if (/dentist|doctor|hospital|health/i.test(joined)) return "Medical & Dental";
  if (/beauty|hair|spa/i.test(joined)) return "Beauty & Personal Care";
  if (/lawyer|legal/i.test(joined)) return "Legal Services";
  if (/gym|fitness/i.test(joined)) return "Fitness & Recreation";
  if (/school|child_care|education/i.test(joined)) return "Childcare & Education";
  if (/plumber|electrician|roofing|contractor|hvac/i.test(joined)) return "Trades & Contractors";
  if (/store|shop|retail/i.test(joined)) return "Shopping & Retail";
  return "Services";
};

const fetchGooglePlaceSignals = async (businessName: string) => {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.types,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: `${businessName} Celina TX`,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: 33.3246, longitude: -96.7844 },
          radius: 20000,
        },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Places lookup failed: ${response.status} ${body}`.trim());
  }
  const json: any = await response.json().catch(() => ({}));
  const place = json?.places?.[0];
  if (!place) return null;
  return {
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    category: categoryFromPlaceTypes([place.primaryType, ...(place.types || [])].filter(Boolean)),
    rating: place.rating,
    reviewCount: place.userRatingCount,
    types: [place.primaryType, ...(place.types || [])].filter(Boolean),
  };
};

export function createApp(options: { dbPath?: string } = {}) {
  const app = express();
  let repository: CelinaDataStore;
  try {
    repository = createRepository(options);
  } catch (err) {
    console.error("Repository initialization failed, falling back to memory repository:", err);
    repository = new CelinaRepository(':memory:');
  }

  const applyPaidMembership = async ({
    tier,
    businessId,
    ownerId,
    addonQuantity = 0,
  }: {
    tier: string;
    businessId?: string;
    ownerId?: string;
    addonQuantity?: number;
  }) => {
    if (tier !== "basic" && tier !== "pro" && tier !== "premium") {
      throw new Error("Unsupported paid membership tier.");
    }

    const businesses = await repository.listBusinesses();
    const ownedBusinesses = businesses.filter((business) =>
      (businessId && business.id === businessId) ||
      (ownerId && business.ownerId === ownerId)
    );
    if (ownedBusinesses.length === 0) {
      throw new Error("No matching business found for paid membership fulfillment.");
    }

    const targetBusiness = ownedBusinesses.find((business) => business.id === businessId) || ownedBusinesses[0];
    const additionalBusinesses = ownedBusinesses
      .filter((business) => business.id !== targetBusiness.id)
      .slice(0, Math.max(0, addonQuantity));
    const coveredIds = new Set([targetBusiness.id, ...additionalBusinesses.map((business) => business.id)]);
    const updated = await Promise.all(ownedBusinesses.map((business) =>
      repository.updateBusiness(business.id, coveredIds.has(business.id)
        ? { tier: tier as any, featured: tier === "premium" }
        : { tier: "free" as any, featured: false })
    ));

    return updated.filter(Boolean);
  };

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: "Stripe webhook handling is not configured." });
    }

    const signature = req.header("stripe-signature");
    if (!signature) {
      return res.status(400).json({ error: "Stripe signature is required." });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      console.error("Stripe webhook signature verification failed.");
      return res.status(400).json({ error: "Invalid Stripe webhook signature." });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.payment_status === "paid") {
          const metadata = session.metadata || {};
          await applyPaidMembership({
            tier: metadata.tier || "",
            businessId: metadata.businessId || undefined,
            ownerId: metadata.userId || undefined,
            addonQuantity: Number(metadata.addonQuantity || 0),
          });
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          const metadata = session.metadata || {};
          if (metadata.purchaseType === "event_promotion" && metadata.businessId && metadata.eventId) {
            const business = await repository.getBusiness(metadata.businessId);
            if (business) {
              const now = new Date().toISOString();
              const nextEvents = (business.events || []).map((listingEvent) => {
                if (listingEvent.id !== metadata.eventId) return listingEvent;
                if (eventHasExpired(listingEvent) || eventDateIsTooFarAway(String(listingEvent.eventDate || ""))) {
                  return { ...listingEvent, status: 'expired' as const, updatedAt: now };
                }
                return { ...listingEvent, promotionPaid: true, paidAt: listingEvent.paidAt || now, status: 'active' as const, expiresAt: listingEvent.eventDate ? eventDateEndIso(listingEvent.eventDate) : listingEvent.expiresAt, updatedAt: now };
              });
              await repository.updateBusiness(business.id, { events: nextEvents });
              const promotedEvent = nextEvents.find((listingEvent: any) => listingEvent.id === metadata.eventId && listingEvent.promotionPaid);
              const ownerEmail = String(metadata.email || business.email || "").trim();
              if (promotedEvent && isDeliverableOwnerEmail(ownerEmail)) {
                sendEventPromotionNotifications(business, promotedEvent, ownerEmail).catch((notificationError) => {
                  console.error("Event promotion notification failed:", notificationError instanceof Error ? notificationError.message : String(notificationError));
                });
              }
            }
          }
        }
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook fulfillment error.");
      return res.status(500).json({ error: "Stripe webhook fulfillment failed." });
    }
  });

  app.use(express.json({ limit: "10mb" }));

  const adminCookieName = "celina_admin_session";
  const ownerCookieName = "celina_owner_session";
  const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
  const sessionMaxAgeMs = sessionMaxAgeSeconds * 1000;
  const getCookie = (req: express.Request, name: string) => {
    const cookies = req.header("cookie") || "";
    const pair = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
  };
  const adminSessionSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "celina-admin-session-secret-fallback";
  const makeAdminSession = () => {
    const secret = adminSessionSecret();
    const issuedAt = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `${issuedAt}.${nonce}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return `${payload}.${signature}`;
  };
  const isValidAdminSession = (req: express.Request) => {
    try {
      const secret = adminSessionSecret();
      const session = getCookie(req, adminCookieName);
      if (!session) return false;
      const parts = session.split(".");
      if (parts.length !== 3) return false;
      const [issuedAt, nonce, signature] = parts;
      if (!issuedAt || !nonce || !signature) return false;
      const ageMs = Date.now() - Number(issuedAt);
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > sessionMaxAgeMs) return false;
      const expected = crypto.createHmac("sha256", secret).update(`${issuedAt}.${nonce}`).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  };

  const ownerSessionSecret = () => process.env.OWNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "celina-owner-dev-session-secret";
  const hashPassword = (password: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  };
  const verifyPassword = (password: string, stored = "") => {
    try {
      if (!stored) return false;
      const [salt, hash] = stored.split(":");
      if (!salt || !hash) return false;
      const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
      const hashBuf = Buffer.from(hash);
      const candBuf = Buffer.from(candidate);
      return hashBuf.length === candBuf.length && crypto.timingSafeEqual(hashBuf, candBuf);
    } catch {
      return false;
    }
  };
  const createEmailVerification = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
      token,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    };
  };
  const createPasswordReset = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
      token,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    };
  };
  const verificationUrlFor = (token: string) => `${(process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  const passwordResetUrlFor = (token: string) => `${(process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const publicSiteUrl = () => (process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "");
  type TransactionalEmailMessage = { subject: string; html: string; text: string };
  const emailHtmlEscape = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const ownerVerificationEmail = (business: any, verificationUrl: string): TransactionalEmailMessage => {
    const details = [
      ["Business", business.name],
      ["Category", business.category],
      ["Phone", business.phone],
      ["Address", business.address || "Not provided yet"],
      ["Starting plan", business.tier || "free"],
      ["Profile image", business.logoUrl ? "Received" : "Needed"],
      ["Banner image", Array.isArray(business.images) && business.images.length > 0 ? "Received" : "Needed"],
    ];
    const rows = details.map(([label, value]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;">${emailHtmlEscape(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${emailHtmlEscape(value)}</td></tr>`).join("");
    const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");

    return {
      subject: "Welcome to Celina Connection",
      html: `<p>Welcome to Celina Connection, and thank you for adding ${emailHtmlEscape(business.name)} to the local directory.</p><p>Please verify your email to activate your owner login. This keeps listings safer for local business owners and Celina neighbors.</p><p><a href=\"${emailHtmlEscape(verificationUrl)}\">Verify my email</a></p><p>This link expires in 24 hours.</p><p><strong>Your submitted listing details:</strong></p><table style="border-collapse:collapse;width:100%;max-width:680px;">${rows}</table><p><strong>What happens next:</strong><br />After verification, you can sign in to update your profile, manage photos, add events, and choose a paid plan when you are ready for more visibility.</p><p>If anything looks off, reply to this email and the Celina Connection team will help.</p>`,
      text: `Welcome to Celina Connection, and thank you for adding ${business.name} to the local directory.\n\nPlease verify your email to activate your owner login: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nYour submitted listing details:\n${textDetails}\n\nWhat happens next:\nAfter verification, you can sign in to update your profile, manage photos, add events, and choose a paid plan when you are ready for more visibility.\n\nIf anything looks off, reply to this email and the Celina Connection team will help.`,
    };
  };
  const newOwnerAdminNotificationEmail = (business: any): TransactionalEmailMessage => {
    const submittedAt = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    const adminUrl = `${publicSiteUrl()}/admin-login`;
    const details = [
      ["Business", business.name],
      ["Category", business.category],
      ["Owner email", business.email],
      ["Phone", business.phone],
      ["Address", business.address || "Not provided"],
      ["Website", business.website || "Not provided"],
      ["Starting tier", business.tier || "free"],
      ["Listing ID", business.id],
      ["Submitted", submittedAt],
      ["Profile image", business.logoUrl ? "Provided" : "Missing"],
      ["Banner image", Array.isArray(business.images) && business.images.length > 0 ? "Provided" : "Missing"],
    ];
    const rows = details.map(([label, value]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;">${emailHtmlEscape(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${emailHtmlEscape(value)}</td></tr>`).join("");
    const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
    return {
      subject: `New Celina Connection user: ${business.name}`,
      html: `<p>A new business owner registered on Celina Connection and is waiting on email verification.</p><table style="border-collapse:collapse;width:100%;max-width:680px;">${rows}</table><p><strong>Description:</strong><br />${emailHtmlEscape(business.description || "Not provided")}</p><p><strong>Suggested review:</strong><br />Confirm the business is Celina-area relevant, review the submitted profile and banner images, check the category, then approve or follow up from the admin dashboard.</p><p><a href="${emailHtmlEscape(adminUrl)}">Open Celina Connection admin</a></p>`,
      text: `A new business owner registered on Celina Connection and is waiting on email verification.\n\n${textDetails}\n\nDescription: ${business.description || "Not provided"}\n\nSuggested review: Confirm the business is Celina-area relevant, review the submitted profile and banner images, check the category, then approve or follow up from the admin dashboard.\n\nOpen admin: ${adminUrl}`,
    };
  };
  const ownerPasswordResetEmail = (businessName: string, resetUrl: string): TransactionalEmailMessage => ({
    subject: "Reset your Celina Connection password",
    html: `<p>We received a password reset request for ${businessName}.</p><p>Click below to choose a new owner password:</p><p><a href=\"${resetUrl}\">Reset my password</a></p><p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
    text: `We received a password reset request for ${businessName}.\n\nChoose a new owner password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request it, you can ignore this email.`,
  });
  const emailDeliveryTimeoutMs = () => Math.max(500, Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS || 8000));
  const fetchWithEmailTimeout = (url: string, init: RequestInit) => fetch(url, {
    ...init,
    signal: AbortSignal.timeout(emailDeliveryTimeoutMs()),
  });
  const parseGhlTags = () => (process.env.GHL_WELCOME_TAGS || "celina-connection,owner-registration")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlAdminNotificationTags = () => (process.env.GHL_ADMIN_NOTIFICATION_TAGS || "celina-connection,admin-notification,new-owner-registration")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlPasswordResetTags = () => (process.env.GHL_PASSWORD_RESET_TAGS || "celina-connection,password-reset")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlMissingImagesTags = () => (process.env.GHL_MISSING_IMAGES_TAGS || "celina-connection,missing-listing-images,72-hour-image-notice")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlClaimRequestTags = () => (process.env.GHL_CLAIM_REQUEST_TAGS || "celina-connection,admin-notification,claim-request")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlPetitionNotificationTags = () => (process.env.GHL_PETITION_NOTIFICATION_TAGS || "celina-connection,admin-notification,petition-signature")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const parseGhlEventPromotionTags = () => (process.env.GHL_EVENT_PROMOTION_TAGS || "celina-connection,event-promotion,payment-received")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const isDeliverableOwnerEmail = (email: unknown) => {
    const value = String(email || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith("@example.com");
  };
  const adminNotificationEmail = () => String(process.env.CELINA_ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || "info@celinaconnection.com").trim();
  const missingListingVisualsEmail = (business: any, deadline: Date): TransactionalEmailMessage => {
    const deadlineLabel = deadline.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const dashboardUrl = `${publicSiteUrl()}/dashboard`;
    const missingItems = [
      !String(business.logoUrl || "").trim() ? "profile image" : "",
      !Array.isArray(business.images) || !business.images.some((image: string) => String(image || "").trim()) ? "banner image" : "",
    ].filter(Boolean);
    const missingText = missingItems.length ? missingItems.join(" and ") : "required listing images";
    return {
      subject: "Action needed: add photos to keep your Celina Connection listing visible",
      html: `<p>Hi ${emailHtmlEscape(business.name || "there")},</p><p>We are getting Celina Connection ready for local launch, and every active listing needs both a profile image and a banner image so neighbors can recognize the business at a glance.</p><p>Your listing is currently missing: <strong>${emailHtmlEscape(missingText)}</strong>.</p><p>Please sign in and add the missing image${missingItems.length === 1 ? "" : "s"} by <strong>${emailHtmlEscape(deadlineLabel)}</strong>. Listings without the required visuals may be hidden until the photos are added.</p><p><a href="${emailHtmlEscape(dashboardUrl)}">Update my listing</a></p><p>Need help choosing a photo? Reply to this email and the Celina Connection team can point you in the right direction.</p>`,
      text: `Hi ${business.name || "there"},\n\nWe are getting Celina Connection ready for local launch, and every active listing needs both a profile image and a banner image so neighbors can recognize the business at a glance.\n\nYour listing is currently missing: ${missingText}.\n\nPlease sign in and add the missing image${missingItems.length === 1 ? "" : "s"} by ${deadlineLabel}. Listings without the required visuals may be hidden until the photos are added.\n\nUpdate your listing: ${dashboardUrl}\n\nNeed help choosing a photo? Reply to this email and the Celina Connection team can point you in the right direction.`,
    };
  };
  const sendEmailViaGhl = async (email: string, businessName: string, message: TransactionalEmailMessage, tags = parseGhlTags()) => {
    const apiKey = process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID;
    if (!apiKey || !locationId) return false;

    const baseUrl = (process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com").replace(/\/$/, "");
    const headers = {
      authorization: `Bearer ${apiKey}`,
      version: process.env.GHL_API_VERSION || "2021-07-28",
      "content-type": "application/json",
      accept: "application/json",
    };
    const upsertResponse = await fetchWithEmailTimeout(`${baseUrl}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        email,
        name: businessName,
        tags,
        source: "Celina Connection",
      }),
    });
    if (!upsertResponse.ok) {
      const body = await upsertResponse.text().catch(() => "");
      throw new Error(`contact upsert failed: ${upsertResponse.status} ${body}`.trim());
    }
    const upsertJson: any = await upsertResponse.json().catch(() => ({}));
    const contactId = upsertJson?.contact?.id || upsertJson?.id || upsertJson?.contactId;
    if (!contactId) {
      throw new Error("contact upsert did not return a contact id");
    }

    const sendResponse = await fetchWithEmailTimeout(`${baseUrl}/conversations/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "Email",
        contactId,
        emailTo: email,
        subject: message.subject,
        html: message.html,
        message: message.text,
      }),
    });
    if (!sendResponse.ok) {
      const body = await sendResponse.text().catch(() => "");
      throw new Error(`email send failed: ${sendResponse.status} ${body}`.trim());
    }
    return true;
  };
  const sendOwnerEmailMessage = async (email: string, businessName: string, message: TransactionalEmailMessage, logLabel: string, fallbackUrl: string, ghlTags = parseGhlTags()) => {
    const deliveryErrors: string[] = [];
    let hasConfiguredProvider = false;

    const hasGhlConfig = !!(
      (process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY) &&
      (process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID)
    );
    if (hasGhlConfig) {
      hasConfiguredProvider = true;
      try {
        if (await sendEmailViaGhl(email, businessName, message, ghlTags)) return;
      } catch (error) {
        deliveryErrors.push(`GHL: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || "info@celinaconnection.com";
    const brevoSenderName = process.env.BREVO_SENDER_NAME || "Celina Connection";
    if (brevoApiKey) {
      hasConfiguredProvider = true;
      try {
        const response = await fetchWithEmailTimeout(process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: brevoSenderName, email: brevoSenderEmail },
            to: [{ email }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
          }),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`${response.status} ${body}`.trim());
        }
        return;
      } catch (error) {
        deliveryErrors.push(`Brevo: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || "Celina Connection <info@celinaconnection.com>";
    if (smtpHost && smtpUser && smtpPass) {
      hasConfiguredProvider = true;
      try {
        const port = Number(process.env.SMTP_PORT || 587);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: emailDeliveryTimeoutMs(),
          socketTimeout: emailDeliveryTimeoutMs(),
          greetingTimeout: emailDeliveryTimeoutMs(),
        });
        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          ...message,
        });
        return;
      } catch (error) {
        deliveryErrors.push(`SMTP: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Celina Connection <info@celinaconnection.com>";
    if (apiKey) {
      hasConfiguredProvider = true;
      try {
        const response = await fetchWithEmailTimeout(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [email],
            ...message,
          }),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`${response.status} ${body}`.trim());
        }
        return;
      } catch (error) {
        deliveryErrors.push(`Resend: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (hasConfiguredProvider) {
      throw new Error(`Unable to send ${logLabel} email. ${deliveryErrors.join(" | ")}`.trim());
    }

    console.info(`[${logLabel}] ${email} (${businessName}): ${fallbackUrl}`);
  };
  const sendOwnerVerificationEmail = async (email: string, business: any, verificationUrl: string) => {
    await sendOwnerEmailMessage(email, String(business.name || "New listing"), ownerVerificationEmail(business, verificationUrl), "email-verification", verificationUrl);
  };
  const sendOwnerPasswordResetEmail = async (email: string, businessName: string, resetUrl: string) => {
    await sendOwnerEmailMessage(email, businessName, ownerPasswordResetEmail(businessName, resetUrl), "password-reset", resetUrl, parseGhlPasswordResetTags());
  };
  const sendAdminNewOwnerNotification = async (business: any) => {
    const hasGhlConfig = !!(
      (process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY) &&
      (process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID)
    );
    const adminEmail = String(process.env.CELINA_ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || (hasGhlConfig ? "info@celinaconnection.com" : "")).trim();
    if (!adminEmail) {
      console.info(`[new-owner-admin-notification] Admin notification email is not configured. Review ${business?.name || "new listing"} in admin.`);
      return;
    }
    await sendOwnerEmailMessage(
      adminEmail,
      "Celina Connection Admin",
      newOwnerAdminNotificationEmail(business),
      "new-owner-admin-notification",
      `${publicSiteUrl()}/admin-login`,
      parseGhlAdminNotificationTags(),
    );
  };
  const sendMissingListingVisualsNotification = async (business: any, deadline: Date) => {
    await sendEmailViaGhl(String(business.email), String(business.name || "Celina business"), missingListingVisualsEmail(business, deadline), parseGhlMissingImagesTags());
  };
  const sendAdminClaimRequestNotification = async (claim: any, business?: any) => {
    const adminEmail = adminNotificationEmail();
    if (!adminEmail) return;
    const adminUrl = `${publicSiteUrl()}/admin-login`;
    const businessName = business?.name || claim.businessId || "Unknown listing";
    const message: TransactionalEmailMessage = {
      subject: `New listing claim request: ${businessName}`,
      html: `<p>A business owner requested access to a Celina Connection listing.</p><p><strong>Business:</strong> ${emailHtmlEscape(businessName)}<br /><strong>Requester:</strong> ${emailHtmlEscape(claim.requesterName)}<br /><strong>Email:</strong> ${emailHtmlEscape(claim.requesterEmail)}<br /><strong>Phone:</strong> ${emailHtmlEscape(claim.requesterPhone)}<br /><strong>Role:</strong> ${emailHtmlEscape(claim.role)}</p><p><strong>Notes:</strong><br />${emailHtmlEscape(claim.notes || "No notes provided.")}</p><p><a href="${emailHtmlEscape(adminUrl)}">Review this claim in admin</a></p>`,
      text: `A business owner requested access to a Celina Connection listing.\n\nBusiness: ${businessName}\nRequester: ${claim.requesterName}\nEmail: ${claim.requesterEmail}\nPhone: ${claim.requesterPhone}\nRole: ${claim.role}\n\nNotes: ${claim.notes || "No notes provided."}\n\nReview this claim in admin: ${adminUrl}`,
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", message, parseGhlClaimRequestTags());
  };
  const sendAdminPetitionSignatureNotification = async (signature: any) => {
    const adminEmail = adminNotificationEmail();
    if (!adminEmail) return;
    const adminUrl = `${publicSiteUrl()}/admin-login`;
    const message: TransactionalEmailMessage = {
      subject: `New Legacy Hills petition signature: ${signature.firstName} ${signature.lastName}`,
      html: `<p>A new Legacy Hills petition signature was submitted through Celina Connection.</p><p><strong>Name:</strong> ${emailHtmlEscape(`${signature.firstName} ${signature.lastName}`)}<br /><strong>Email:</strong> ${emailHtmlEscape(signature.email)}<br /><strong>Phone:</strong> ${emailHtmlEscape(signature.phone)}<br /><strong>Address:</strong> ${emailHtmlEscape(signature.streetAddress)}<br /><strong>Neighborhood:</strong> ${emailHtmlEscape(signature.neighborhood || "Legacy Hills")}</p><p><strong>Comments:</strong><br />${emailHtmlEscape(signature.comments || "No comments provided.")}</p><p><a href="${emailHtmlEscape(adminUrl)}">Open petition signatures</a></p>`,
      text: `A new Legacy Hills petition signature was submitted through Celina Connection.\n\nName: ${signature.firstName} ${signature.lastName}\nEmail: ${signature.email}\nPhone: ${signature.phone}\nAddress: ${signature.streetAddress}\nNeighborhood: ${signature.neighborhood || "Legacy Hills"}\n\nComments: ${signature.comments || "No comments provided."}\n\nOpen petition signatures: ${adminUrl}`,
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", message, parseGhlPetitionNotificationTags());
  };
  const sendEventPromotionNotifications = async (business: any, event: any, ownerEmail: string) => {
    const adminEmail = adminNotificationEmail();
    const eventName = event?.title || event?.name || "Local event";
    const eventDate = event?.eventDate || event?.date || "Date not provided";
    const ownerMessage: TransactionalEmailMessage = {
      subject: `Event promotion received: ${eventName}`,
      html: `<p>We received your Celina Connection event promotion for <strong>${emailHtmlEscape(eventName)}</strong>.</p><p>The team will review the event details before it appears publicly. Event promotions expire after the event date.</p><p><strong>Business:</strong> ${emailHtmlEscape(business?.name || "Your business")}<br /><strong>Event date:</strong> ${emailHtmlEscape(eventDate)}</p>`,
      text: `We received your Celina Connection event promotion for ${eventName}.\n\nThe team will review the event details before it appears publicly. Event promotions expire after the event date.\n\nBusiness: ${business?.name || "Your business"}\nEvent date: ${eventDate}`,
    };
    await sendEmailViaGhl(ownerEmail, String(business?.name || "Celina business"), ownerMessage, parseGhlEventPromotionTags());
    if (!adminEmail) return;
    const adminMessage: TransactionalEmailMessage = {
      subject: `Event promotion purchase: ${eventName}`,
      html: `<p>A paid event promotion was received on Celina Connection.</p><p><strong>Business:</strong> ${emailHtmlEscape(business?.name || "Unknown business")}<br /><strong>Owner email:</strong> ${emailHtmlEscape(ownerEmail)}<br /><strong>Event:</strong> ${emailHtmlEscape(eventName)}<br /><strong>Event date:</strong> ${emailHtmlEscape(eventDate)}</p><p><a href="${emailHtmlEscape(`${publicSiteUrl()}/admin-login`)}">Open Celina Connection admin</a></p>`,
      text: `A paid event promotion was received on Celina Connection.\n\nBusiness: ${business?.name || "Unknown business"}\nOwner email: ${ownerEmail}\nEvent: ${eventName}\nEvent date: ${eventDate}\n\nOpen admin: ${publicSiteUrl()}/admin-login`,
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", adminMessage, parseGhlEventPromotionTags());
  };
  const ownerVerificationResponse = (business: any, verificationUrl: string) => {
    const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
    return {
      business: safeBusiness,
      requiresEmailVerification: true,
      message: "Check your email to verify your listing before signing in.",
      ...(process.env.CELINA_EXPOSE_VERIFICATION_LINK === "true" ? { verificationUrl } : {}),
    };
  };
  const verificationResends = new Map<string, number[]>();
  const checkVerificationResendLimit = (req: express.Request, email: string) => {
    const now = Date.now();
    const key = `${req.ip}:${email.toLowerCase()}`;
    const attempts = (verificationResends.get(key) || []).filter((ts) => now - ts < 1000 * 60 * 15);
    attempts.push(now);
    verificationResends.set(key, attempts);
    return attempts.length <= 3;
  };
  const passwordResetRequests = new Map<string, number[]>();
  const checkPasswordResetLimit = (req: express.Request, email: string) => {
    const now = Date.now();
    const key = `${req.ip}:${email.toLowerCase()}`;
    const attempts = (passwordResetRequests.get(key) || []).filter((ts) => now - ts < 1000 * 60 * 15);
    attempts.push(now);
    passwordResetRequests.set(key, attempts);
    return attempts.length <= 3;
  };
  const makeOwnerSession = (ownerId: string) => {
    const issuedAt = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `${ownerId}.${issuedAt}.${nonce}`;
    const signature = crypto.createHmac("sha256", ownerSessionSecret()).update(payload).digest("hex");
    return `${payload}.${signature}`;
  };
  const readOwnerSession = (req: express.Request) => {
    const session = getCookie(req, ownerCookieName);
    const [ownerId, issuedAt, nonce, signature] = session.split(".");
    if (!ownerId || !issuedAt || !nonce || !signature) return "";
    const ageMs = Date.now() - Number(issuedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > sessionMaxAgeMs) return "";
    const expected = crypto.createHmac("sha256", ownerSessionSecret()).update(`${ownerId}.${issuedAt}.${nonce}`).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "";
    return ownerId;
  };
  const ownerCookie = (session: string) => `${ownerCookieName}=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  const makeCurrentUser = (business: Awaited<ReturnType<typeof repository.getBusiness>>): any => business ? ({
    id: business.ownerId,
    email: business.email,
    businessName: business.name,
    businessId: business.id,
    tier: business.tier,
    isLoggedIn: true,
    role: 'owner',
  }) : null;
  const imageLimitForTier = (tier: string) => tier === 'free' || tier === 'basic' ? 1 : tier === 'pro' ? 5 : 10;
  const eventPromotionWindowDays = 30;
  const dateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const eventDateEndIso = (eventDate: string) => new Date(`${eventDate}T23:59:59`).toISOString();
  const eventDateIsPast = (eventDate: string) => Boolean(eventDate) && new Date(`${eventDate}T23:59:59`).getTime() < Date.now();
  const maxEventPromotionDateInputValue = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + eventPromotionWindowDays);
    return dateInputValue(maxDate);
  };
  const eventDateIsTooFarAway = (eventDate: string) => Boolean(eventDate) && new Date(`${eventDate}T00:00:00`).getTime() > new Date(`${maxEventPromotionDateInputValue()}T23:59:59`).getTime();
  const eventHasExpired = (event: any) => {
    if (event?.status === "expired") return true;
    if (event?.eventDate) return eventDateIsPast(String(event.eventDate));
    return Boolean(event?.expiresAt && new Date(event.expiresAt).getTime() < Date.now());
  };

  const normalizeListingEvents = (incoming: any, existingEvents: any[] = [], isAdmin = false) => {
    if (!Array.isArray(incoming)) return undefined;
    const existingById = new Map(existingEvents.map((event) => [String(event.id), event]));
    const now = Date.now();
    return incoming.slice(0, 20).map((event) => {
      const id = String(event?.id || `event-${crypto.randomBytes(8).toString("hex")}`);
      const existing = existingById.get(id) || {};
      const existingExpired = eventHasExpired(existing);
      if (!isAdmin && existingExpired) return existing;

      const eventDate = String(event?.eventDate || '').trim();
      if (eventDate && eventDateIsTooFarAway(eventDate)) {
        throw new Error("Event promotions can only be scheduled up to 30 days before the event date.");
      }
      const expiresAt = eventDate ? eventDateEndIso(eventDate) : String(existing.expiresAt || new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString());
      const paid = isAdmin ? Boolean(event?.promotionPaid) : Boolean(existing.promotionPaid);
      const paidAt = isAdmin ? String(event?.paidAt || existing.paidAt || '') : String(existing.paidAt || '');
      const requestedStatus = String(event?.status || existing.status || 'draft');
      const status = eventDateIsPast(eventDate) || new Date(expiresAt).getTime() < now
        ? 'expired'
        : isAdmin
          ? (['draft', 'active', 'expired'].includes(requestedStatus) ? requestedStatus : 'draft')
          : paid ? 'active' : 'draft';

      return {
        id,
        title: String(event?.title || '').trim().slice(0, 120),
        description: String(event?.description || '').trim().slice(0, 800),
        eventDate,
        eventTime: String(event?.eventTime || '').trim().slice(0, 80),
        location: String(event?.location || '').trim().slice(0, 160),
        status,
        promotionPaid: paid,
        paidAt,
        expiresAt,
        createdAt: String(existing.createdAt || event?.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const sanitizeOwnerBusinessUpdates = (tier: string, updates: any, currentBusiness?: any) => {
    const allowed: any = {};
    for (const key of ['name', 'description', 'phone', 'email', 'category', 'address', 'logoUrl', 'reviews']) {
      if (updates[key] !== undefined) allowed[key] = updates[key];
    }
    const events = normalizeListingEvents(updates.events, currentBusiness?.events || [], false);
    if (events) allowed.events = events;
    if (Array.isArray(updates.images)) {
      allowed.images = updates.images.slice(0, imageLimitForTier(tier));
    }
    if (tier === 'basic' || tier === 'pro' || tier === 'premium') {
      if (updates.website !== undefined) allowed.website = updates.website;
      if (updates.hours !== undefined) allowed.hours = updates.hours;
    }
    if (tier === 'premium') {
      if (updates.ctaText !== undefined) allowed.ctaText = updates.ctaText;
      if (updates.socialLinks !== undefined) allowed.socialLinks = updates.socialLinks;
    }
    return allowed;
  };
  const hasRequiredListingVisuals = (business: { logoUrl?: unknown; images?: unknown }) => (
    Boolean(String(business.logoUrl || "").trim()) &&
    Array.isArray(business.images) &&
    business.images.some((image: unknown) => Boolean(String(image || "").trim()))
  );
  const listingVisualsRequiredMessage = "A profile image and banner image are required before a listing can be approved.";
  const stripAdminOwnerAccountFields = (updates: any) => {
    const { ownerPassword, ownerEmail, ownerAccountEmail, assignOwnerEmail, ...businessUpdates } = updates || {};
    return businessUpdates;
  };
  const resolveOwnerEmail = (body: any, fallback = '') => String(body?.ownerEmail || body?.ownerAccountEmail || body?.assignOwnerEmail || body?.email || fallback || '').trim().toLowerCase();
  const recentRegistrationAttempts = new Map<string, number[]>();
  const checkRegistrationRateLimit = (req: express.Request, email: string) => {
    if (process.env.NODE_ENV === "test") return true;
    const now = Date.now();
    const key = `${req.ip}:${email.toLowerCase()}`;
    const attempts = (recentRegistrationAttempts.get(key) || []).filter((ts) => now - ts < 1000 * 60 * 15);
    attempts.push(now);
    recentRegistrationAttempts.set(key, attempts);
    return attempts.length <= 5;
  };
  const recentPetitionAttempts = new Map<string, number[]>();
  const checkPetitionRateLimit = (req: express.Request, email: string) => {
    if (process.env.NODE_ENV === "test") return true;
    const now = Date.now();
    const key = `${req.ip}:${email.toLowerCase()}`;
    const attempts = (recentPetitionAttempts.get(key) || []).filter((ts) => now - ts < 1000 * 60 * 15);
    attempts.push(now);
    recentPetitionAttempts.set(key, attempts);
    return attempts.length <= 4;
  };
  const parsePetitionTags = () => (process.env.GHL_LEGACY_HILLS_PETITION_TAGS || "celina-connection,legacy-hills-petition,petition-signature")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const normalizeRequiredString = (value: unknown) => String(value || "").trim();
  const defaultLegacyHillsFieldId = (locationId: string, field: "comments" | "signature") => {
    if (locationId !== "mKLGHZ4PHVm0iun7B9TH") return "";
    return field === "signature" ? "zbXdd33Q0TyHo8i27cdu" : "NSeTHniy0jmywbasoLjy";
  };
  const isSignatureDataUrl = (value: string) => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const sanitizePetitionSignatureFields = (body: any) => ({
    firstName: normalizeRequiredString(body?.firstName),
    lastName: normalizeRequiredString(body?.lastName),
    email: normalizeRequiredString(body?.email).toLowerCase(),
    phone: normalizeRequiredString(body?.phone),
    streetAddress: normalizeRequiredString(body?.streetAddress),
    neighborhood: normalizeRequiredString(body?.neighborhood) || "Legacy Hills",
    phaseSection: "",
    lotBlock: "",
    builder: normalizeRequiredString(body?.builder).slice(0, 160),
    comments: normalizeRequiredString(body?.comments).slice(0, 1200),
    signatureDataUrl: normalizeRequiredString(body?.signatureDataUrl),
  });
  const validatePetitionSignatureFields = (signature: ReturnType<typeof sanitizePetitionSignatureFields>, options: { requireSignature: boolean }) => {
    if (!signature.firstName || !signature.lastName || !signature.email || !signature.phone || !signature.streetAddress) {
      return "First name, last name, email, phone, and street address are required.";
    }
    if (!/^\S+@\S+\.\S+$/.test(signature.email)) {
      return "A valid email address is required.";
    }
    if (options.requireSignature && (!signature.signatureDataUrl || signature.signatureDataUrl.length > 250000 || !isSignatureDataUrl(signature.signatureDataUrl))) {
      return "A drawn signature is required to record your petition signature.";
    }
    if (signature.signatureDataUrl && (signature.signatureDataUrl.length > 250000 || !isSignatureDataUrl(signature.signatureDataUrl))) {
      return "Please add a valid drawn signature image.";
    }
    return "";
  };
  const syncLegacyHillsPetitionSignatureViaGhl = async (signature: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    streetAddress: string;
    neighborhood: string;
    phaseSection?: string;
    lotBlock?: string;
    builder?: string;
    comments: string;
    signatureDataUrl: string;
  }) => {
    const apiKey = process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID;
    if (!apiKey || !locationId) {
      throw new Error("GoHighLevel integration is not configured.");
    }

    const baseUrl = (process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com").replace(/\/$/, "");
    const headers = {
      authorization: `Bearer ${apiKey}`,
      version: process.env.GHL_API_VERSION || "2021-07-28",
      "content-type": "application/json",
      accept: "application/json",
    };
    const source = "Celina Connection - Legacy Hills Petition";
    const upsertResponse = await fetchWithEmailTimeout(`${baseUrl}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        firstName: signature.firstName,
        lastName: signature.lastName,
        name: `${signature.firstName} ${signature.lastName}`.trim(),
        email: signature.email,
        phone: signature.phone,
        address1: signature.streetAddress,
        city: "Celina",
        state: "TX",
        tags: parsePetitionTags(),
        source,
      }),
    });
    if (!upsertResponse.ok) {
      const body = await upsertResponse.text().catch(() => "");
      throw new Error(`GHL contact upsert failed: ${upsertResponse.status} ${body}`.trim());
    }
    const upsertJson: any = await upsertResponse.json().catch(() => ({}));
    const contactId = upsertJson?.contact?.id || upsertJson?.id || upsertJson?.contactId;
    if (!contactId) {
      throw new Error("GHL contact upsert did not return a contact id.");
    }

    const customFieldPayload = [
      [process.env.GHL_LEGACY_HILLS_NEIGHBORHOOD_FIELD_ID, signature.neighborhood],
      [process.env.GHL_LEGACY_HILLS_BUILDER_FIELD_ID, signature.builder],
      [process.env.GHL_LEGACY_HILLS_COMMENTS_FIELD_ID || defaultLegacyHillsFieldId(locationId, "comments"), signature.comments],
      [process.env.GHL_LEGACY_HILLS_SIGNATURE_FIELD_ID || defaultLegacyHillsFieldId(locationId, "signature"), signature.signatureDataUrl],
      [process.env.GHL_LEGACY_HILLS_SIGNED_AT_FIELD_ID, new Date().toISOString()],
    ]
      .filter(([id, value]) => id && value)
      .map(([id, value]) => ({ id, value }));

    if (customFieldPayload.length > 0) {
      const updateResponse = await fetchWithEmailTimeout(`${baseUrl}/contacts/${contactId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ customFields: customFieldPayload }),
      });
      if (!updateResponse.ok) {
        const body = await updateResponse.text().catch(() => "");
        throw new Error(`GHL custom field update failed: ${updateResponse.status} ${body}`.trim());
      }
    }

    return contactId;
  };
  const requireOwnerSession: express.RequestHandler = async (req, res, next) => {
    try {
      const ownerId = readOwnerSession(req);
      if (!ownerId) return res.status(401).json({ error: "Owner authentication is required." });
      const business = await repository.getOwnedBusinessByOwnerId(ownerId);
      if (!business || !business.emailVerified) return res.status(401).json({ error: "Owner authentication is required." });
      (req as any).ownerBusiness = business;
      return next();
    } catch {
      return res.status(401).json({ error: "Owner authentication is required." });
    }
  };
  const requireAdminToken: express.RequestHandler = (req, res, next) => {
    try {
      const expectedToken = process.env.ADMIN_API_TOKEN;
      if (isValidAdminSession(req)) return next();
      if (!expectedToken) {
        const loginConfigured = !!(process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN));
        if (loginConfigured) {
          return res.status(401).json({ error: "Admin authentication is required." });
        }
        return res.status(503).json({
          error: "Admin actions are disabled until server-side authentication is configured.",
        });
      }

      const providedToken = req.header("x-admin-token");
      if (providedToken !== expectedToken) {
        return res.status(401).json({ error: "Admin authentication is required." });
      }

      return next();
    } catch {
      return res.status(401).json({ error: "Admin authentication is required." });
    }
  };

  const siteUrl = SITE_URL;
  const xmlEscape = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  const metaEscape = (value = "") => xmlEscape(String(value));
  const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
  const businessSlug = (business: { slug?: string; id?: string }) => business.slug || business.id || "";
  const findBusinessForSlug = async (slug: string) => {
    const decodedSlug = decodeURIComponent(slug || "").toLowerCase();
    const businesses = await repository.listBusinesses();
    return businesses.find((business) => {
      const slugOrId = businessSlug(business).toLowerCase();
      return slugOrId === decodedSlug || business.id.toLowerCase() === decodedSlug;
    }) || null;
  };
  const firstBusinessImage = (business: Awaited<ReturnType<typeof findBusinessForSlug>>) => {
    if (!business) return "";
    return business.images?.[0] || business.logoUrl || "";
  };
  const isPublicImageUrl = (value = "") => /^https?:\/\//i.test(value);
  const isDataImageUrl = (value = "") => /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(value);
  const businessSocialImageUrl = (business: NonNullable<Awaited<ReturnType<typeof findBusinessForSlug>>>) => {
    const image = firstBusinessImage(business);
    if (isPublicImageUrl(image)) return image;
    if (isDataImageUrl(image)) return `${siteUrl}/api/social-image/business/${encodeURIComponent(businessSlug(business))}`;
    return DEFAULT_SOCIAL_IMAGE;
  };
  const buildDirectoryItemListSchema = (businesses: Awaited<ReturnType<typeof repository.listBusinesses>>) => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}/#business-directory`,
    name: "Celina TX Local Business Directory",
    description: `Browse ${businesses.length || "local"} Celina, Texas businesses by category, reviews, and location.`,
    numberOfItems: businesses.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: businesses.slice(0, 25).map((business, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: business.name,
      url: `${siteUrl}/business/${businessSlug(business)}`,
    })),
  });
  const buildCategoryItemListSchema = (
    categoryName: string,
    url: string,
    businesses: Awaited<ReturnType<typeof repository.listBusinesses>>,
  ) => {
    const categoryBusinesses = businesses.filter((business) => business.category === categoryName);
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${url}#business-list`,
      name: `${categoryName} businesses in Celina, TX`,
      description: `Browse ${categoryBusinesses.length || "local"} ${categoryName.toLowerCase()} businesses in Celina, Texas.`,
      numberOfItems: categoryBusinesses.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: categoryBusinesses.slice(0, 25).map((business, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: business.name,
        url: `${siteUrl}/business/${businessSlug(business)}`,
      })),
    };
  };
  const buildBreadcrumbSchema = (name: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: url,
      },
    ],
  });
  const buildDirectoryFaqSchema = (url: string) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: "Where can I find local businesses in Celina, Texas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[0].answer,
        },
      },
      {
        "@type": "Question",
        name: "How can a Celina business claim a listing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[1].answer,
        },
      },
      {
        "@type": "Question",
        name: "What types of businesses are listed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[2].answer,
        },
      },
    ],
  });
  const buildPricingFaqSchema = (url: string) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: "Is the free launch listing really free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[0].answer,
        },
      },
      {
        "@type": "Question",
        name: "Which paid plan adds a website link and hours?",
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[1].answer,
        },
      },
      {
        "@type": "Question",
        name: "Which plan is best for more visibility?",
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[2].answer,
        },
      },
    ],
  });
  const renderShareHtml = ({
    title,
    description,
    canonical,
    image,
    ogType = "website",
    h1,
    intro,
    schema,
    noindex = false,
  }: {
    title: string;
    description: string;
    canonical: string;
    image: string;
    ogType?: string;
    h1: string;
    intro: string;
    schema: unknown;
    noindex?: boolean;
  }) => `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${metaEscape(title)}</title>
    <meta name="description" content="${metaEscape(description)}" />
    <meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"}" />
    <link rel="canonical" href="${metaEscape(canonical)}" />
    <meta property="og:type" content="${metaEscape(ogType)}" />
    <meta property="og:site_name" content="Celina Connection" />
    <meta property="og:title" content="${metaEscape(title)}" />
    <meta property="og:description" content="${metaEscape(description)}" />
    <meta property="og:url" content="${metaEscape(canonical)}" />
    <meta property="og:image" content="${metaEscape(image)}" />
    <meta property="og:image:secure_url" content="${metaEscape(image)}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${metaEscape(title)}" />
    <meta name="twitter:description" content="${metaEscape(description)}" />
    <meta name="twitter:image" content="${metaEscape(image)}" />
    <script type="application/ld+json">${safeJson(schema)}</script>
  </head>
  <body>
    <main>
      <h1>${metaEscape(h1)}</h1>
      <p>${metaEscape(intro)}</p>
      <p><a href="${metaEscape(canonical)}">Open this page on Celina Connection</a></p>
    </main>
  </body>
</html>`;

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const businesses = await repository.listBusinesses();
    type SitemapPage = { loc: string; priority: string; changefreq: string; lastmod?: string };
    const staticPages: SitemapPage[] = [
      { loc: siteUrl, priority: "1.0", changefreq: "daily" },
      { loc: `${siteUrl}/directory`, priority: "0.9", changefreq: "daily" },
      { loc: `${siteUrl}/events`, priority: "0.7", changefreq: "weekly" },
      { loc: `${siteUrl}/pricing`, priority: "0.8", changefreq: "weekly" },
      { loc: `${siteUrl}/legacyhillspetition`, priority: "0.8", changefreq: "weekly" },
      { loc: `${siteUrl}/launch`, priority: "0.5", changefreq: "monthly" },
    ];
    const categoryPages: SitemapPage[] = CATEGORY_LANDING_PAGES
      .filter((category) => businesses.some((business) => business.category === category.name))
      .map((category) => ({
        loc: `${siteUrl}/directory/${category.slug}`,
        priority: "0.8",
        changefreq: "weekly",
      }));
    const businessPages = businesses
      .filter((business) => business.slug || business.id)
      .map((business) => ({
        loc: `${siteUrl}/business/${business.slug || business.id}`,
        priority: business.featured || business.tier === "premium" ? "0.9" : "0.7",
        changefreq: "weekly",
        lastmod: business.createdAt,
      }));

    const urls = [...staticPages, ...categoryPages, ...businessPages].map((page) => `  <url>\n    <loc>${xmlEscape(page.loc)}</loc>\n    ${page.lastmod ? `<lastmod>${xmlEscape(new Date(page.lastmod).toISOString())}</lastmod>\n    ` : ""}<changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`).join("\n");

    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.get("/api/share/page/:page", async (req, res) => {
    const page = req.params.page.toLowerCase();
    if (!isPublicPageKey(page)) {
      return res.status(404).json({ error: "Share page not found." });
    }

    const definition = PUBLIC_PAGE_META[page];
    const canonical = publicPagePath(page);
    const businesses = await repository.listBusinesses();
    const schema: unknown[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Celina Connection",
        url: siteUrl,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/directory?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Celina Connection",
        url: siteUrl,
        logo: BRAND_LOGO_IMAGE,
        areaServed: {
          "@type": "City",
          name: "Celina",
          addressRegion: "TX",
          addressCountry: "US",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": definition.schemaType,
        "@id": `${canonical}#webpage`,
        name: definition.h1,
        headline: definition.title,
        description: definition.description,
        url: canonical,
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ];

    if (page !== "home") {
      schema.push(buildBreadcrumbSchema(definition.h1, canonical));
    }

    if (page === "home" || page === "directory") {
      schema.push(buildDirectoryItemListSchema(businesses));
      schema.push(buildDirectoryFaqSchema(canonical));
    }

    if (page === "pricing") {
      schema.push(buildPricingFaqSchema(canonical));
    }

    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    res.type("html").send(renderShareHtml({
      title: definition.title,
      description: definition.description,
      canonical,
      image: DEFAULT_SOCIAL_IMAGE,
      h1: definition.h1,
      intro: definition.intro,
      schema,
    }));
  });

  app.get("/api/share/category/:slug", async (req, res) => {
    const category = categoryLandingForSlug(req.params.slug);
    if (!category) {
      return res.redirect(302, `${siteUrl}/directory`);
    }

    const businesses = await repository.listBusinesses();
    const categoryBusinesses = businesses.filter((business) => business.category === category.name);
    const canonical = `${siteUrl}/directory/${category.slug}`;
    const schema: unknown[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Celina Connection",
        url: siteUrl,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/directory?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        name: category.title,
        headline: category.title,
        description: category.description,
        url: canonical,
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      buildBreadcrumbSchema(category.name, canonical),
      buildCategoryItemListSchema(category.name, canonical, businesses),
    ];
    const intro = categoryBusinesses.length
      ? `${category.intro} This category currently includes ${categoryBusinesses.length} local ${categoryBusinesses.length === 1 ? "listing" : "listings"}.`
      : category.intro;

    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    res.type("html").send(renderShareHtml({
      title: category.title,
      description: category.description,
      canonical,
      image: DEFAULT_SOCIAL_IMAGE,
      h1: category.title.replace(" | Celina Connection", ""),
      intro,
      schema,
    }));
  });

  app.get("/api/social-image/business/:slug", async (req, res) => {
    const business = await findBusinessForSlug(req.params.slug);
    const image = firstBusinessImage(business);

    if (isPublicImageUrl(image)) {
      return res.redirect(302, image);
    }

    if (!isDataImageUrl(image)) {
      return res.redirect(302, DEFAULT_SOCIAL_IMAGE);
    }

    const match = image.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
    if (!match) {
      return res.redirect(302, DEFAULT_SOCIAL_IMAGE);
    }

    const imageType = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
    const bytes = Buffer.from(match[2], "base64");
    res.setHeader("cache-control", "public, max-age=3600, s-maxage=86400");
    res.type(`image/${imageType}`).send(bytes);
  });

  app.get("/api/share/business/:slug", async (req, res) => {
    const business = await findBusinessForSlug(req.params.slug);
    if (!business) {
      return res.redirect(302, siteUrl);
    }

    const slug = businessSlug(business);
    const canonical = `${siteUrl}/business/${encodeURIComponent(slug)}`;
    const title = `${business.name} | Celina Connection`;
    const description = `${business.description || `Take a look at ${business.name} on Celina Connection.`}`.slice(0, 280);
    const image = businessSocialImageUrl(business);
    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${canonical}#localbusiness`,
      name: business.name,
      description: business.description,
      url: canonical,
      telephone: business.phone,
      email: business.email,
      image,
      address: business.address
        ? {
            "@type": "PostalAddress",
            streetAddress: business.address.replace(", Celina, TX 75009", "").replace(", TX 75009", ""),
            addressLocality: "Celina",
            addressRegion: "TX",
            postalCode: "75009",
            addressCountry: "US",
          }
        : {
            "@type": "PostalAddress",
            addressLocality: "Celina",
            addressRegion: "TX",
            postalCode: "75009",
            addressCountry: "US",
          },
    };

    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    res.type("html").send(renderShareHtml({
      title,
      description,
      canonical,
      image,
      ogType: "business.business",
      h1: business.name,
      intro: description,
      schema,
    }));
  });

  app.get("/api/payment-config", (_req, res) => {
    res.json({
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
      eventPromotionEnabled: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_EVENT_PROMOTION),
    });
  });

  app.get("/api/ai-config", (_req, res) => {
    res.json({
      aiEnabled: !!geminiApiKey(),
      model: geminiChatModel(),
    });
  });

  app.post("/api/admin/login", (req, res) => {
    try {
      const providedPassword = (req.body?.password || "").toString().trim();
      const configuredPassword = (process.env.ADMIN_PASSWORD || "").trim();

      if (!configuredPassword) {
        return res.status(503).json({ error: "Admin login is disabled until ADMIN_PASSWORD is configured." });
      }

      const isAuthenticated = Boolean(
        providedPassword && providedPassword === configuredPassword
      );

      if (!isAuthenticated) {
        return res.status(401).json({ error: "Invalid admin credentials." });
      }

      const session = makeAdminSession();
      try {
        res.setHeader("set-cookie", `${adminCookieName}=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      } catch {
        // ignore cookie header setting error
      }
      return res.status(200).json({ authenticated: true });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "We could not sign you in right now. Please try again." });
    }
  });

  app.post("/api/admin/logout", (_req, res) => {
    try {
      res.setHeader("set-cookie", `${adminCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    } catch {
      // ignore cookie reset error
    }
    return res.json({ authenticated: false });
  });

  app.get("/api/admin/session", (req, res) => {
    try {
      if (!isValidAdminSession(req)) {
        return res.status(401).json({ authenticated: false });
      }
      return res.json({ authenticated: true });
    } catch {
      return res.status(401).json({ authenticated: false });
    }
  });


  const htmlEscape = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const buildLegacyHillsPetitionDocumentHtml = (signatures: Awaited<ReturnType<typeof repository.listLegacyHillsPetitionSignatures>>) => {
    const rows = signatures.map((signature, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlEscape(`${signature.firstName} ${signature.lastName}`)}</td>
        <td>${htmlEscape(signature.streetAddress)}</td>
        <td>${htmlEscape(signature.builder || '')}</td>
        <td>${htmlEscape(signature.phone)}</td>
        <td>${htmlEscape(signature.email)}</td>
        <td>${new Date(signature.signedAt).toLocaleDateString('en-US')}</td>
        <td class="signature"><img src="${htmlEscape(signature.signatureDataUrl)}" alt="Signature for ${htmlEscape(signature.firstName)} ${htmlEscape(signature.lastName)}" /></td>
      </tr>`).join('');
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Legacy Hills Petition Signature Packet</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; line-height: 1.5; }
    h1 { margin: 0 0 6px; font-size: 26px; }
    h2 { margin: 22px 0 8px; font-size: 18px; }
    p, li { font-size: 12px; }
    .meta { color: #475569; margin-bottom: 22px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
    th { background: #f1f5f9; text-align: left; }
    .signature img { max-width: 170px; max-height: 58px; background: #fff; }
    .summary { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px 16px; margin: 18px 0; background: #f8fafc; }
    @media print { body { margin: 18px; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="float:right;padding:10px 14px;border:0;border-radius:10px;background:#0f172a;color:white;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
  <h1>Pinnacle at Legacy Hills Petition Signature Packet</h1>
  <div class="meta">Generated by Celina Connection on ${new Date().toLocaleString('en-US')}.</div>
  <div class="summary"><strong>Total signatures:</strong> ${signatures.length}<br />Purpose: homeowner, resident, and property stakeholder petition record for Pinnacle at Legacy Hills submissions collected through Celina Connection.</div>
  <h2>Petition Request</h2>
  <p><strong>To:</strong> Pulte Homes, the Pinnacle at Legacy Hills Development Team, HOA Leadership, City Officials, and all parties responsible for the development and maintenance of Pinnacle at Legacy Hills.</p>
  <h2>Community Petition for the Completion of Promised Amenities and Improved Community Standards</h2>
  <p>We, the undersigned homeowners and residents of Pinnacle at Legacy Hills, respectfully submit this petition to express our growing concern regarding continued delays in completing the community as it was represented during the home-buying process.</p>
  <p>We request a clear written timeline for promised amenities, proper completion of drainage and infrastructure work, improved maintenance standards during construction, and consistent communication regarding project timelines, delays, and changes.</p>
  <p>This petition is a respectful request for accountability, transparency, and partnership. We request a written response outlining the status of these concerns, planned timelines, and actions that will be taken to address them.</p>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Street Address</th><th>Builder</th><th>Phone</th><th>Email</th><th>Signed</th><th>Signature</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">No signatures collected yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
  };

  app.get("/api/bootstrap", async (_req, res) => {
    try {
      const businesses = await repository.listBusinesses();
      const reportedBugs = await repository.listBugs();
      const businessList = Array.isArray(businesses) && businesses.length > 0
        ? businesses
        : INITIAL_BUSINESSES;
      return res.json({
        businesses: businessList,
        reportedBugs: Array.isArray(reportedBugs) ? reportedBugs : [],
      });
    } catch (error) {
      console.error("Bootstrap query error:", error);
      return res.json({
        businesses: INITIAL_BUSINESSES,
        reportedBugs: [],
      });
    }
  });

  app.post("/api/petitions/legacy-hills/signatures", async (req, res) => {
    const {
      eligibilityConfirmed,
      consent,
      company,
    } = req.body || {};

    if (company) return res.status(400).json({ error: "Signature failed spam validation." });

    const signature = sanitizePetitionSignatureFields(req.body);
    const validationError = validatePetitionSignatureFields(signature, { requireSignature: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (!eligibilityConfirmed) {
      return res.status(400).json({ error: "Please confirm you are a homeowner, resident, or property stakeholder in Pinnacle at Legacy Hills." });
    }
    if (!consent) {
      return res.status(400).json({ error: "Consent is required to record your petition signature." });
    }
    if (!checkPetitionRateLimit(req, signature.email)) {
      return res.status(429).json({ error: "Too many petition submissions. Please try again later." });
    }

    try {
      const contactId = await syncLegacyHillsPetitionSignatureViaGhl(signature);
      const savedSignature = await repository.createLegacyHillsPetitionSignature({ ...signature, contactId });
      sendAdminPetitionSignatureNotification(savedSignature).catch((notificationError) => {
        console.error("Petition signature admin notification failed:", notificationError instanceof Error ? notificationError.message : String(notificationError));
      });
      return res.status(201).json({ ok: true, contactId, signature: savedSignature });
    } catch (error) {
      console.error("Legacy Hills petition GHL sync failed:", error);
      return res.status(503).json({ error: "Petition signature could not be saved to GoHighLevel. Please try again shortly." });
    }
  });

  app.get("/api/petitions/legacy-hills/signatures", async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    const publicSignatures = signatures.map((signature) => ({
      id: signature.id,
      displayName: `${signature.firstName} ${signature.lastName ? `${signature.lastName.charAt(0)}.` : ''}`.trim(),
      neighborhood: signature.neighborhood || 'Pinnacle at Legacy Hills',
      builder: signature.builder || '',
      signedAt: signature.signedAt,
    }));
    return res.json({ total: signatures.length, signatures: publicSignatures });
  });

  app.get("/api/admin/petitions/legacy-hills/signatures", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    return res.json({ signatures });
  });

  app.patch("/api/admin/petitions/legacy-hills/signatures/:id", requireAdminToken, async (req, res) => {
    const updates = sanitizePetitionSignatureFields(req.body);
    const existingSignatures = await repository.listLegacyHillsPetitionSignatures();
    const existing = existingSignatures.find((signature) => signature.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "We could not find that petition signature." });
    }
    const merged = { ...existing, ...updates };
    const validationError = validatePetitionSignatureFields(merged, { requireSignature: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const updated = await repository.updateLegacyHillsPetitionSignature(req.params.id, updates);
    return res.json({ signature: updated });
  });

  app.get("/api/admin/petitions/legacy-hills/export.csv", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    const headers = ['Signed At', 'First Name', 'Last Name', 'Email', 'Phone', 'Street Address', 'Neighborhood', 'Builder', 'Comments', 'GHL Contact ID'];
    const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(csvEscape).join(',')].concat(signatures.map((signature) => [
      signature.signedAt,
      signature.firstName,
      signature.lastName,
      signature.email,
      signature.phone,
      signature.streetAddress,
      signature.neighborhood,
      signature.builder || '',
      signature.comments || '',
      signature.contactId || '',
    ].map(csvEscape).join(',')));
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="legacy-hills-petition-signatures.csv"');
    return res.send(lines.join('\n'));
  });

  app.get("/api/admin/petitions/legacy-hills/export", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.send(buildLegacyHillsPetitionDocumentHtml(signatures));
  });

  app.post("/api/owner/discover-business", async (req, res) => {
    try {
      const businessName = String(req.body?.businessName || "").trim();
      const website = normalizeWebsiteUrl(req.body?.website);
      if (!businessName || !website) {
        return res.status(400).json({ error: "Please enter a business name and website." });
      }

      let url: URL;
      try {
        url = new URL(website);
      } catch {
        return res.status(400).json({ error: "Please enter a valid website address." });
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return res.status(400).json({ error: "Please enter a public website address." });
      }

      const response = await fetch(url.toString(), {
        headers: {
          "user-agent": "Celina Connection business setup assistant",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return res.status(422).json({ error: "We could not open that website. You can still finish the listing manually." });
      }

      const html = await response.text();
      const signals = extractWebsiteSignals(html, url.toString());
      let placeSignals: Awaited<ReturnType<typeof fetchGooglePlaceSignals>> = null;
      try {
        placeSignals = await fetchGooglePlaceSignals(businessName);
      } catch (placesError) {
        console.error("Business discovery Google Places lookup failed:", placesError instanceof Error ? placesError.message : String(placesError));
      }
      const fallbackDescription = signals.description || `${businessName} is a local business serving Celina and nearby North Texas neighbors.`;
      let draft = {
        name: placeSignals?.name || businessName,
        category: placeSignals?.category || "Services",
        description: fallbackDescription.slice(0, 420),
        phone: placeSignals?.phone || signals.phone,
        email: signals.email,
        website: placeSignals?.website || url.toString(),
        address: placeSignals?.address || "",
        logoUrl: "",
        coverImageUrl: signals.imageUrl,
        confidenceNotes: [
          signals.description ? "Found website description." : "Website description was not clearly listed.",
          placeSignals ? "Checked public Google business listing data." : "Google business listing enrichment is not connected yet.",
          placeSignals?.phone || signals.phone ? "Found a public phone number." : "Phone number needs owner review.",
          signals.email ? "Found a public email address." : "Email needs owner review.",
          signals.imageUrl ? "Found a possible banner image." : "No website image was found.",
        ],
      };

      if (geminiApiKey()) {
        try {
          const ai = getGemini();
          const aiResponse = await generateContentWithFallback(ai, {
            model: geminiSearchModel(),
            contents: `Business name: ${businessName}\nWebsite: ${url.toString()}\nGoogle listing data: ${JSON.stringify(placeSignals || {})}\nPage title: ${signals.title}\nMeta description: ${signals.description}\nPublic phone: ${signals.phone}\nPublic email: ${signals.email}\nPage text excerpt: ${signals.pageText}`,
            config: {
              systemInstruction: `You help Celina Connection create owner-reviewed starter business profiles. Use only the supplied website text and public signals. Do not invent facts. Return warm, customer-facing copy. Choose one category from this exact list: ${publicBusinessCategories.join(", ")}.`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  email: { type: Type.STRING },
                  address: { type: Type.STRING },
                  confidenceNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["name", "category", "description", "phone", "email", "address", "confidenceNotes"],
              },
            },
          });
          const parsed = JSON.parse(aiResponse.text || "{}");
          const category = publicBusinessCategories.includes(parsed.category) ? parsed.category : draft.category;
          draft = {
            ...draft,
            name: String(parsed.name || draft.name).trim() || draft.name,
            category,
            description: String(parsed.description || draft.description).trim().slice(0, 520) || draft.description,
            phone: String(parsed.phone || draft.phone).trim(),
            email: String(parsed.email || draft.email).trim(),
            address: String(parsed.address || draft.address).trim(),
            confidenceNotes: Array.isArray(parsed.confidenceNotes) && parsed.confidenceNotes.length
              ? parsed.confidenceNotes.slice(0, 4).map((note: unknown) => String(note).trim()).filter(Boolean)
              : draft.confidenceNotes,
          };
        } catch (aiError) {
          console.error("Business discovery AI draft failed:", aiError instanceof Error ? aiError.message : String(aiError));
        }
      }

      return res.json({ draft });
    } catch (error) {
      console.error("Business discovery failed:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ error: "We could not build a starter profile from that website right now. You can still finish the listing manually." });
    }
  });

 
  app.post("/api/owner/register", async (req, res) => {
    try {
      const { name, category, description, phone, email, password, startedAt, company } = req.body || {};
      if (company) return res.status(400).json({ error: "Registration failed spam validation." });
      if (!startedAt || Date.now() - Number(startedAt) < 3000) {
        return res.status(429).json({ error: "Please wait a few seconds before submitting the registration form." });
      }
      if (!name || !category || !description || !phone || !email || !password) {
        return res.status(400).json({ error: "Please add your business name, category, description, phone, email, and password." });
      }
      if (String(password).length < 10) {
        return res.status(400).json({ error: "Password must be at least 10 characters." });
      }
      if (!hasRequiredListingVisuals(req.body || {})) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      if (!checkRegistrationRateLimit(req, email)) {
        return res.status(429).json({ error: "Too many registration attempts. Please try again later." });
      }
      const existingOwner = await repository.getOwnedBusinessByEmail(email);
      if (existingOwner) {
        return res.status(409).json({ error: "An owner account already exists for this email." });
      }

      const verification = createEmailVerification();
      const verificationUrl = verificationUrlFor(verification.token);
      const business = await repository.createOwnedBusiness({
        name,
        category,
        description,
        phone,
        email,
        tier: 'free',
        address: req.body.address || '',
        website: req.body.website || '',
        logoUrl: req.body.logoUrl || '',
        images: Array.isArray(req.body.images) ? req.body.images.slice(0, 1) : [],
      }, hashPassword(password), { tokenHash: verification.tokenHash, expiresAt: verification.expiresAt });
      try {
        await sendOwnerVerificationEmail(String(email), business, verificationUrl);
      } catch (emailError) {
        await repository.deleteBusiness(business.id);
        console.error('Owner verification email delivery failed.');
        return res.status(503).json({ error: "We couldn't send the verification email right now. Your listing was not saved, so please try again in a moment." });
      }
      try {
        await sendAdminNewOwnerNotification(business);
      } catch (notificationError) {
        console.error("New owner admin notification failed:", notificationError instanceof Error ? notificationError.message : String(notificationError));
      }
      return res.status(201).json(ownerVerificationResponse(business, verificationUrl));
    } catch (error) {
      console.error("Owner registration error.");
      return res.status(500).json({ error: "We could not finish your registration right now. Please try again." });
    }
  });

  app.get("/api/owner/verify-email", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) return res.status(400).json({ error: "This verification link is incomplete. Please request a new link." });
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const business = await repository.verifyOwnerEmailByTokenHash(tokenHash);
      if (!business) return res.status(400).json({ error: "This verification link is no longer working. Please request a new link." });
      const session = makeOwnerSession(business.ownerId);
      res.setHeader("set-cookie", ownerCookie(session));
      const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
      return res.json({ business: safeBusiness, currentUser: makeCurrentUser(safeBusiness), verified: true });
    } catch (error) {
      console.error("Owner email verification error.");
      return res.status(500).json({ error: "We could not verify your email right now. Please try again." });
    }
  });

  app.post("/api/owner/resend-verification", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "Please enter your email address." });
      if (!checkVerificationResendLimit(req, email)) {
        return res.status(429).json({ error: "Too many verification email requests. Please try again later." });
      }
      const existingOwner = await repository.getOwnedBusinessByEmail(email);
      if (!existingOwner || existingOwner.emailVerified) {
        return res.json({ message: "If that email has an unverified owner account, a new verification link has been sent." });
      }
      const verification = createEmailVerification();
      const verificationUrl = verificationUrlFor(verification.token);
      const business = await repository.refreshOwnerEmailVerification(email, { tokenHash: verification.tokenHash, expiresAt: verification.expiresAt });
      if (business) {
        try {
          await sendOwnerVerificationEmail(String(email), business, verificationUrl);
        } catch (emailError) {
          console.error('Owner verification resend failed.');
          return res.status(503).json({ error: "We couldn't send the verification email right now. Please try again in a moment." });
        }
      }
      return res.json({
        message: "If that email has an unverified owner account, a new verification link has been sent.",
        ...(process.env.CELINA_EXPOSE_VERIFICATION_LINK === "true" && business ? { verificationUrl } : {}),
      });
    } catch (error) {
      console.error("Owner resend verification error.");
      return res.status(500).json({ error: "We could not send a new verification email right now. Please try again." });
    }
  });

  app.post("/api/owner/forgot-password", async (req, res) => {
    const genericMessage = "If that owner account exists, a password reset link has been sent.";
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "Please enter your email address." });
      if (!checkPasswordResetLimit(req, email)) {
        return res.status(429).json({ error: "Too many password reset requests. Please try again later." });
      }

      const existingOwner = await repository.getOwnedBusinessByEmail(email);
      let exposedResetUrl = "";
      if (existingOwner) {
        const reset = createPasswordReset();
        const resetUrl = passwordResetUrlFor(reset.token);
        exposedResetUrl = resetUrl;
        const business = await repository.createOwnerPasswordReset(email, { tokenHash: reset.tokenHash, expiresAt: reset.expiresAt });
        if (business) {
          try {
            await sendOwnerPasswordResetEmail(String(email), business.name, resetUrl);
          } catch {
            console.error("Owner password reset email delivery failed.");
          }
        }
      }

      return res.json({
        message: genericMessage,
        ...(process.env.CELINA_EXPOSE_PASSWORD_RESET_LINK === "true" && existingOwner ? {
          resetUrl: exposedResetUrl,
        } : {}),
      });
    } catch (error) {
      console.error("Owner forgot password error:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ error: "We could not send the reset email right now. Please try again." });
    }
  });

  app.post("/api/owner/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ error: "This reset link is incomplete. Please request a new link." });
      if (String(password).length < 10) {
        return res.status(400).json({ error: "Password must be at least 10 characters." });
      }

      const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
      const business = await repository.resetOwnerPasswordByTokenHash(tokenHash, hashPassword(String(password)));
      if (!business) return res.status(400).json({ error: "This reset link is no longer working. Please request a new link." });

      const session = makeOwnerSession(business.ownerId);
      res.setHeader("set-cookie", ownerCookie(session));
      const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
      return res.json({ business: safeBusiness, currentUser: makeCurrentUser(safeBusiness), reset: true });
    } catch {
      console.error("Owner reset password error.");
      return res.status(500).json({ error: "We could not reset your password right now. Please try again." });
    }
  });

  app.post("/api/owner/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Please enter your email and password." });
      const business = await repository.getOwnedBusinessByEmail(email);
      if (!business || !verifyPassword(password, business.ownerPasswordHash)) {
        return res.status(401).json({ error: "That email and password did not match." });
      }
      if (!business.emailVerified) {
        return res.status(403).json({ error: "Please verify your email before signing in. We can resend the link." });
      }
      const session = makeOwnerSession(business.ownerId);
      res.setHeader("set-cookie", ownerCookie(session));
      const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
      return res.json({ business: safeBusiness, currentUser: makeCurrentUser(safeBusiness) });
    } catch (error) {
      console.error("Owner login error:", error);
      return res.status(500).json({ error: "We could not sign you in right now. Please try again." });
    }
  });

  app.post("/api/owner/logout", (_req, res) => {
    res.setHeader("set-cookie", `${ownerCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return res.json({ authenticated: false });
  });

  app.get("/api/owner/session", requireOwnerSession, (req, res) => {
    const { ownerPasswordHash: _ownerPasswordHash, ...business } = (req as any).ownerBusiness;
    return res.json({ authenticated: true, business, currentUser: makeCurrentUser(business) });
  });

  app.patch("/api/owner/businesses/:id", requireOwnerSession, async (req, res) => {
    try {
      const ownerBusiness = (req as any).ownerBusiness;
      if (ownerBusiness.id !== req.params.id) {
        return res.status(403).json({ error: "Owners can only update their own business listing." });
      }
      const updates = sanitizeOwnerBusinessUpdates(ownerBusiness.tier, req.body || {}, ownerBusiness);
      if (!ownerBusiness.isUnclaimed && !hasRequiredListingVisuals({ ...ownerBusiness, ...updates })) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      const business = await repository.updateBusiness(req.params.id, updates);
      if (!business) return res.status(404).json({ error: "We could not find that business listing." });
      return res.json(business);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save listing changes." });
    }
  });

  app.post("/api/businesses", requireAdminToken, async (req, res) => {
    try {
      const { name, category, description, phone, email, tier } = req.body || {};
      if (!name || !category || !description || !phone || !email || !tier) {
        return res.status(400).json({ error: "Please add the business name, category, description, phone, email, and membership tier." });
      }
      if (req.body?.isUnclaimed === false && !hasRequiredListingVisuals(req.body || {})) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      const business = await repository.createBusiness(req.body);
      return res.status(201).json(business);
    } catch (error) {
      console.error("Create business error.");
      return res.status(500).json({ error: "We could not create that listing right now. Please try again." });
    }
  });

  app.post("/api/claims", async (req, res) => {
    const { businessId, requesterName, requesterEmail, requesterPhone, role } = req.body || {};
    if (!businessId || !requesterName || !requesterEmail || !requesterPhone || !role) {
      return res.status(400).json({ error: "Please add your name, email, phone number, and connection to this business." });
    }
    const claim = await repository.createClaimRequest(req.body);
    if (!claim) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    const business = await repository.getBusiness(businessId);
    sendAdminClaimRequestNotification(claim, business).catch((notificationError) => {
      console.error("Claim request admin notification failed:", notificationError instanceof Error ? notificationError.message : String(notificationError));
    });
    return res.status(201).json(claim);
  });

  app.get("/api/admin/claims", requireAdminToken, async (_req, res) => {
    return res.json(await repository.listClaimRequests());
  });

  app.post("/api/admin/notifications/missing-visuals", requireAdminToken, async (req, res) => {
    const deadlineHours = Math.min(168, Math.max(1, Number(req.body?.deadlineHours || 72)));
    const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);
    const includeUnclaimed = req.body?.includeUnclaimed === true;
    const businesses = await repository.listBusinesses();
    const candidates = businesses.filter((business: any) => {
      if (hasRequiredListingVisuals(business)) return false;
      if (!includeUnclaimed && (business.isUnclaimed || !business.ownerId)) return false;
      return true;
    });

    const sent: Array<{ id: string; name: string; email: string }> = [];
    const skipped: Array<{ id: string; name: string; email: string; reason: string }> = [];
    const failed: Array<{ id: string; name: string; email: string; error: string }> = [];

    for (const business of candidates) {
      const email = String((business as any).email || "").trim();
      if (!isDeliverableOwnerEmail(email)) {
        skipped.push({ id: business.id, name: business.name, email, reason: "No deliverable owner email on file." });
        continue;
      }
      try {
        await sendMissingListingVisualsNotification(business, deadline);
        sent.push({ id: business.id, name: business.name, email });
      } catch (error) {
        failed.push({
          id: business.id,
          name: business.name,
          email,
          error: error instanceof Error ? error.message : "Unable to send this notification.",
        });
      }
    }

    return res.json({
      deadline: deadline.toISOString(),
      deadlineHours,
      includeUnclaimed,
      attempted: candidates.length,
      sent,
      skipped,
      failed,
    });
  });

  app.post("/api/admin/claims/:id/approve", requireAdminToken, async (req, res) => {
    const claims = await repository.listClaimRequests();
    const claim = claims.find((item) => item.id === req.params.id);
    if (!claim) {
      return res.status(404).json({ error: "Claim request not found" });
    }
    const businessToClaim = await repository.getBusiness(claim.businessId);
    if (!businessToClaim) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    if (!hasRequiredListingVisuals(businessToClaim)) {
      return res.status(400).json({ error: listingVisualsRequiredMessage });
    }
    const claimed = await repository.claimBusiness(claim.businessId, claim.requesterEmail);
    if (!claimed) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    const updatedClaim = await repository.updateClaimRequest(claim.id, { status: "approved", reviewedAt: new Date().toISOString() });
    return res.json({ claim: updatedClaim, business: claimed.business });
  });

  app.post("/api/admin/claims/:id/reject", requireAdminToken, async (req, res) => {
    const claim = await repository.updateClaimRequest(req.params.id, { status: "rejected", reviewedAt: new Date().toISOString() });
    if (!claim) {
      return res.status(404).json({ error: "Claim request not found" });
    }
    return res.json({ claim });
  });

  app.patch("/api/businesses/:id", requireAdminToken, async (req, res) => {
    try {
      const body = req.body || {};
      if (body.ownerPassword !== undefined && String(body.ownerPassword).length > 0 && String(body.ownerPassword).length < 10) {
        return res.status(400).json({ error: "Owner password must be at least 10 characters." });
      }

      const existingBusiness = await repository.getBusiness(req.params.id);
      if (!existingBusiness) {
        return res.status(404).json({ error: "We could not find that business listing." });
      }
      const businessUpdates = {
        ...stripAdminOwnerAccountFields(body),
        ...(body.events !== undefined ? { events: normalizeListingEvents(body.events, existingBusiness.events || [], true) } : {}),
      };
      const proposedBusiness = { ...existingBusiness, ...businessUpdates };
      const liveListingRequested = proposedBusiness.isUnclaimed === false || String(proposedBusiness.ownerId || "").trim() !== "";
      if (liveListingRequested && !hasRequiredListingVisuals(proposedBusiness)) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }

      const business = await repository.updateBusiness(req.params.id, businessUpdates);
      if (!business) {
        return res.status(404).json({ error: "We could not find that business listing." });
      }

      const shouldManageOwner = body.ownerPassword || body.ownerEmail !== undefined || body.ownerAccountEmail !== undefined || body.assignOwnerEmail !== undefined || body.ownerId !== undefined || body.isUnclaimed !== undefined;
      if (!shouldManageOwner) return res.json(business);

      if (body.isUnclaimed === true || body.ownerId === '') {
        const unassigned = await repository.updateBusiness(req.params.id, { ownerId: '', isUnclaimed: true });
        return res.json(unassigned);
      }

      const ownerEmail = resolveOwnerEmail(body, business.email);
      if (!ownerEmail) {
        return res.status(400).json({ error: "Owner email is required to assign this listing." });
      }

      const ownerAccount = await repository.updateOwnerAccount(req.params.id, {
        ownerId: String(body.ownerId || business.ownerId || `owner-${business.id}`),
        email: ownerEmail,
        passwordHash: body.ownerPassword ? hashPassword(String(body.ownerPassword)) : undefined,
        emailVerified: true,
      });
      if (!ownerAccount) return res.status(404).json({ error: "We could not find that business listing." });
      const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = ownerAccount;
      return res.json(safeBusiness);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save listing changes." });
    }
  });

  app.delete("/api/businesses/:id", requireAdminToken, async (req, res) => {
    const deleted = await repository.deleteBusiness(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.status(204).send();
  });

  app.post("/api/businesses/:id/claim", requireAdminToken, async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Please enter an email address." });
    }
    const business = await repository.getBusiness(req.params.id);
    if (!business) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    if (!hasRequiredListingVisuals(business)) {
      return res.status(400).json({ error: listingVisualsRequiredMessage });
    }
    const claimed = await repository.claimBusiness(req.params.id, email);
    if (!claimed) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.json(claimed);
  });

  app.post("/api/businesses/:id/reviews", async (req, res) => {
    const { authorName, rating, text, ownerReply } = req.body || {};
    if (!authorName || !rating || !text) {
      return res.status(400).json({ error: "Please add your name, rating, and review." });
    }
    const result = await repository.addReview(req.params.id, { authorName, rating, text, ownerReply });
    if (!result) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.status(201).json(result);
  });

  app.post("/api/businesses/:id/likes", async (req, res) => {
    const liked = req.body?.liked !== false;
    const business = await repository.voteBusiness(req.params.id, liked ? 1 : -1);
    if (!business) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.json({ business, votesCount: business.votesCount || 0, liked });
  });

  app.post("/api/businesses/:id/growth/:action", async (req, res) => {
    const action = req.params.action === "referral-visit" ? "referralVisit" : req.params.action === "share-click" ? "shareClick" : "";
    if (!action) return res.status(400).json({ error: "Unknown growth action." });
    const business = await repository.trackBusinessGrowthAction(req.params.id, action as "shareClick" | "referralVisit");
    if (!business) return res.status(404).json({ error: "We could not find that business listing." });
    return res.json({ business, growthCredits: business.growthCredits });
  });

  app.post("/api/bugs", async (req, res) => {
    const { title, description, category, severity, email } = req.body || {};
    if (!title || !description || !category || !severity || !email) {
      return res.status(400).json({ error: "Please add your email, a short note, and a few details so we can help." });
    }
    return res.status(201).json(await repository.createBug(req.body));
  });

  app.patch("/api/bugs/:id", requireAdminToken, async (req, res) => {
    const updated = await repository.updateBug(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: "We could not find that feedback note." });
    }
    return res.json(updated);
  });

  app.delete("/api/bugs/:id", requireAdminToken, async (req, res) => {
    const deleted = await repository.deleteBug(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "We could not find that feedback note." });
    }
    return res.status(204).send();
  });

  app.post("/api/admin/reset", requireAdminToken, async (_req, res) => {
    return res.json(await repository.reset());
  });

  app.get("/api/admin/petitions/legacy-hills/signatures", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    return res.json({ signatures });
  });

  app.post("/api/petitions/legacy-hills/signatures", async (req, res) => {
    const { firstName, lastName, email, phone, streetAddress, signatureDataUrl } = req.body || {};
    if (!firstName || !lastName || !email || !phone || !streetAddress || !signatureDataUrl) {
      return res.status(400).json({ error: "Missing required petition signature fields." });
    }
    const signature = await repository.createLegacyHillsPetitionSignature({
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      neighborhood: req.body.neighborhood || "Legacy Hills",
      comments: req.body.comments || "",
      signatureDataUrl,
    });
    return res.status(201).json({ ok: true, signature });
  });

  app.get("/api/admin/petitions/legacy-hills/export.csv", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    let csv = "ID,First Name,Last Name,Email,Phone,Address,Neighborhood,Comments,Signed At\n";
    for (const sig of signatures) {
      csv += `"${sig.id}","${sig.firstName}","${sig.lastName}","${sig.email}","${sig.phone}","${sig.streetAddress}","${sig.neighborhood}","${(sig.comments || '').replace(/"/g, '""')}","${sig.signedAt}"\n`;
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="legacy_hills_petition_signatures.csv"');
    return res.send(csv);
  });

  app.post("/api/ai/search", async (req, res) => {
    try {
      const { query, businesses } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Please enter what you are looking for." });
      }

      if (!geminiApiKey()) {
        return res.status(503).json({ error: "Celina AI is taking a short break. Please try again soon." });
      }

      const ai = getGemini();

      const systemInstruction = `You are Celina Connection AI Search. Your task is to analyze a search query and find the best matching business profiles from the provided directory database.

We have a directory of local businesses in Celina, Texas. Here is the active business directory data:
${JSON.stringify(businesses || [])}

Analyze the user's search query: "${query}"
Match businesses based on standard keywords OR conceptual matches (e.g. searching 'cozy place for drinks' should conceptual-match taprooms, cafes, or dining spots even if the word 'drinks' isn't explicitly in the description).

Return a JSON object containing:
1. matchingIds: Array of matching business IDs (exactly as they appear in the data, e.g. 'lucys-on-the-square'). Empty array if nothing matches.
2. insights: A friendly, conversational paragraph (in Markdown) explaining why these businesses are recommended for their search. Use the real names of the businesses. Be brief, warm, and helpful.`;

      const response = await generateContentWithFallback(ai, {
        model: geminiSearchModel(),
        contents: `Analyze this search query: "${query}" against the database.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchingIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of business IDs that match the search query.",
              },
              insights: {
                type: Type.STRING,
                description: "Markdown-formatted text giving warm, tailored local recommendations and explaining why they fit the search.",
              },
            },
            required: ["matchingIds", "insights"],
          },
        },
      });

      const resultText = response.text || "{}";
      let parsedResult;
      try {
        parsedResult = JSON.parse(resultText);
      } catch {
        parsedResult = { matchingIds: [], insights: resultText };
      }

      return res.json(parsedResult);
    } catch (error: any) {
      console.error("AI Search Error:", error);
      return res.status(500).json({ error: "Celina AI could not search right now. Regular directory search is still ready." });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, businesses } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Please enter a message for Celina AI." });
      }

      if (!geminiApiKey()) {
        return res.status(503).json({ error: "Celina AI is taking a short break. Please try again soon." });
      }

      const ai = getGemini();
      const localTime = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

      const systemInstruction = `You are Celina Connection AI, a friendly, ultra-helpful local virtual concierge for Celina, Texas.
Your goal is to answer basic questions about local businesses, locations, operating hours, contact info, ratings, and how to use Celina Connection.

We have a directory of local businesses. Here is the active business directory data:
${JSON.stringify(businesses || [])}

Context & Rules:
1. Current Local Time and Date: ${localTime}
2. Use the directory database to provide extremely accurate details on local businesses. Always favor recommending Premium Partners when appropriate!
3. This is a lightweight Q&A assistant. Do not claim live weather, live events, sports scores, or real-time facts unless that information is present in the provided directory data. If a question needs real-time information, say you can help with directory basics and suggest checking an official current source.
4. Keep answers brief, conversational, and helpful. Always maintain a warm, welcoming Texas tone. Use Markdown formatting.`;

      const formattedContents = messages
        .map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text || m.content || "" }],
        }))
        .filter((m: any) => m.parts[0].text);

      while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
        formattedContents.shift();
      }

      const response = await generateContentWithFallback(ai, {
        model: geminiChatModel(),
        contents: formattedContents,
        config: {
          systemInstruction,
        },
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web) {
            return {
              title: chunk.web.title,
              uri: chunk.web.uri,
            };
          }
          return null;
        })
        .filter(Boolean);

      return res.json({
        text: response.text,
        sources,
      });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      return res.status(500).json({ error: "Celina AI could not answer right now. Please try again soon." });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { tier, userId, businessId, addonQuantity = 0, interval = "year" } = req.body;

      if (tier !== "pro" && tier !== "premium" && tier !== "basic") {
        return res.status(400).json({ error: "Please choose a current Celina Connection membership." });
      }

      if (interval !== "month" && interval !== "year") {
        return res.status(400).json({ error: "Please choose monthly or annual billing." });
      }

      const host = req.headers.host;
      const protocol = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
      const appUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
      const stripe = getStripe();

      const priceIdProAnnual = process.env.STRIPE_PRICE_ID_PRO_ANNUAL || process.env.STRIPE_PRICE_ID_PRO || "price_1TqislIQqe0SJtgjvfYKRChx";
      const priceIdPremiumAnnual = process.env.STRIPE_PRICE_ID_PREMIUM_ANNUAL || process.env.STRIPE_PRICE_ID_PREMIUM || "price_1TqirvIQqe0SJtgjTcWN8HAb";
      const priceIdBasic = process.env.STRIPE_PRICE_ID_BASIC || "price_1TqhN9IQqe0SJtgjZY569vkL";
      const priceIdAddonAnnual = process.env.STRIPE_PRICE_ID_ADDON_ANNUAL || process.env.STRIPE_PRICE_ID_ADDON;
      const priceIdProMonthly = process.env.STRIPE_PRICE_ID_PRO_MONTHLY || "price_1Tr7zkIQqe0SJtgjL2POPOUI";
      const priceIdPremiumMonthly = process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY;
      const priceIdAddonMonthly = process.env.STRIPE_PRICE_ID_ADDON_MONTHLY;

      const line_items: any[] = [];

      if (tier === "premium") {
        if (interval === "year") {
          if (priceIdPremiumAnnual) {
            line_items.push({ price: priceIdPremiumAnnual, quantity: 1 });
          } else {
            line_items.push({
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Celina Connection - Premium Partner Membership (Annual)",
                  description: "Featured carousel placement, photo gallery, review responses, and priority directory sorting. Billed annually.",
                },
                unit_amount: 12000,
                recurring: { interval: "year" },
              },
              quantity: 1,
            });
          }
        } else if (priceIdPremiumMonthly) {
          line_items.push({ price: priceIdPremiumMonthly, quantity: 1 });
        } else {
          line_items.push({
            price_data: {
              currency: "usd",
              product_data: {
                name: "Celina Connection - Premium Partner Membership (Monthly)",
                description: "Featured carousel placement, photo gallery, review responses, and priority directory sorting. Billed monthly.",
              },
              unit_amount: 2900,
              recurring: { interval: "month" },
            },
            quantity: 1,
          });
        }
      } else if (tier === "pro") {
        if (interval === "year") {
          if (priceIdProAnnual) {
            line_items.push({ price: priceIdProAnnual, quantity: 1 });
          } else {
            line_items.push({
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Celina Connection - Pro Partner Membership (Annual)",
                  description: "Standard active listing, review tools, and Verified Business badge. Billed annually.",
                },
                unit_amount: 6000,
                recurring: { interval: "year" },
              },
              quantity: 1,
            });
          }
        } else if (priceIdProMonthly) {
          line_items.push({ price: priceIdProMonthly, quantity: 1 });
        } else {
          line_items.push({
            price_data: {
              currency: "usd",
              product_data: {
                name: "Celina Connection - Pro Partner Membership (Monthly)",
                description: "Standard active listing, review tools, and Verified Business badge. Billed monthly.",
              },
              unit_amount: 600,
              recurring: { interval: "month" },
            },
            quantity: 1,
          });
        }
      } else if (priceIdBasic) {
        line_items.push({ price: priceIdBasic, quantity: 1 });
      } else {
        line_items.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: "Celina Connection - Basic Listing",
              description: "Standard active listing on the free directory plan.",
            },
            unit_amount: 0,
            recurring: { interval: "month" },
          },
          quantity: 1,
        });
      }

      if (addonQuantity && addonQuantity > 0) {
        if (interval === "year") {
          if (priceIdAddonAnnual) {
            line_items.push({ price: priceIdAddonAnnual, quantity: addonQuantity });
          } else {
            line_items.push({
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Additional Business Listing Add-on (Annual)",
                  description: "Extends full membership benefits to one additional business listing under your account. Billed annually.",
                },
                unit_amount: 3600,
                recurring: { interval: "year" },
              },
              quantity: addonQuantity,
            });
          }
        } else if (priceIdAddonMonthly) {
          line_items.push({ price: priceIdAddonMonthly, quantity: addonQuantity });
        } else {
          line_items.push({
            price_data: {
              currency: "usd",
              product_data: {
                name: "Additional Business Listing Add-on (Monthly)",
                description: "Extends full membership benefits to one additional business listing under your account. Billed monthly.",
              },
              unit_amount: 400,
              recurring: { interval: "month" },
            },
            quantity: addonQuantity,
          });
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "subscription",
        success_url: `${appUrl}?payment_status=success&tier=${tier}&businessId=${businessId || ""}&addon_qty=${addonQuantity}&interval=${interval}`,
        cancel_url: `${appUrl}?payment_status=cancel`,
        metadata: {
          tier,
          userId: userId || "",
          businessId: businessId || "",
          addonQuantity: addonQuantity.toString(),
          interval,
        },
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout error:", error);
      return res.status(500).json({ error: "We could not open checkout right now. Please try again in a moment." });
    }
  });

  app.post("/api/create-event-promotion-checkout-session", async (req, res) => {
    try {
      const { userId, businessId, businessName, email, eventId } = req.body || {};
      if (!userId || !email) {
        return res.status(401).json({ error: "Please sign in before promoting an event." });
      }
      if (eventId && businessId) {
        const business = await repository.getBusiness(String(businessId));
        const event = business?.events?.find((item: any) => String(item.id) === String(eventId));
        if (!business || !event) {
          return res.status(404).json({ error: "We could not find that saved event. Please save the event details before purchasing promotion." });
        }
        if (eventHasExpired(event)) {
          return res.status(400).json({ error: "This event has already passed, so it can no longer be promoted." });
        }
        if (eventDateIsTooFarAway(String(event.eventDate || ""))) {
          return res.status(400).json({ error: "Event promotions can only be purchased within 30 days of the event date." });
        }
      }

      const host = req.headers.host;
      const protocol = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
      const appUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
      const stripe = getStripe();
      const priceIdEventPromotion = process.env.STRIPE_PRICE_ID_EVENT_PROMOTION;
      const eventPromotionAmount = Math.max(100, Number(process.env.STRIPE_EVENT_PROMOTION_AMOUNT_CENTS || 2500));

      const lineItem = priceIdEventPromotion
        ? { price: priceIdEventPromotion, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Celina Connection - Local Event Promotion",
                description: "Paid promotion review for one local special event, workshop, grand opening, or networking opportunity.",
              },
              unit_amount: eventPromotionAmount,
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [lineItem],
        mode: "payment",
        customer_email: email,
        success_url: eventId
          ? `${appUrl}/dashboard?payment_status=event_success#dashboard-events`
          : `${appUrl}/events?payment_status=event_success`,
        cancel_url: `${appUrl}/events?payment_status=cancel`,
        metadata: {
          purchaseType: "event_promotion",
          userId: String(userId),
          businessId: businessId || "",
          eventId: eventId || "",
          businessName: businessName || "",
          email: email || "",
        },
      });

      return res.json({ url: session.url });
    } catch (error) {
      console.error("Event Promotion Checkout error:", error);
      return res.status(500).json({ error: "We could not open event promotion checkout right now. Please try again in a moment." });
    }
  });

  return app;
}
