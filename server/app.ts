import crypto from "node:crypto";
import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";
import { createRepository } from "./database.js";

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

// Lazy-loaded Gemini AI client instance to prevent crashes when GEMINI_API_KEY is missing
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
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

// Helper to perform generateContent with automatic model fallback (e.g. gemini-3.5-flash -> gemini-2.5-flash)
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

    if (isSearchError || isOverloadOrQuota || params.model === "gemini-3.5-flash") {
      const fallbackModel = "gemini-2.5-flash";
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

export function createApp(options: { dbPath?: string } = {}) {
  const app = express();
  const repository = createRepository(options);
  app.use(express.json());

  const adminCookieName = "celina_admin_session";
  const ownerCookieName = "celina_owner_session";
  const getCookie = (req: express.Request, name: string) => {
    const cookies = req.header("cookie") || "";
    const pair = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
  };
  const makeAdminSession = () => {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "";
    if (!secret) return "";
    const issuedAt = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `${issuedAt}.${nonce}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return `${payload}.${signature}`;
  };
  const isValidAdminSession = (req: express.Request) => {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "";
    if (!secret) return false;
    const session = getCookie(req, adminCookieName);
    const [issuedAt, nonce, signature] = session.split(".");
    if (!issuedAt || !nonce || !signature) return false;
    const ageMs = Date.now() - Number(issuedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 1000 * 60 * 60 * 12) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${issuedAt}.${nonce}`).digest("hex");
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  };

  const ownerSessionSecret = () => process.env.OWNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "celina-owner-dev-session-secret";
  const hashPassword = (password: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  };
  const verifyPassword = (password: string, stored = "") => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
    return hash.length === candidate.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
  };
  const createEmailVerification = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return {
      token,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    };
  };
  const verificationUrlFor = (token: string) => `${(process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  const ownerVerificationEmail = (businessName: string, verificationUrl: string) => ({
    subject: "Verify your Celina Connection listing",
    html: `<p>Thanks for registering ${businessName}.</p><p>Click below to verify your email and activate your owner login:</p><p><a href=\"${verificationUrl}\">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
    text: `Thanks for registering ${businessName}.\n\nVerify your email and activate your owner login: ${verificationUrl}\n\nThis link expires in 24 hours.`,
  });
  const emailDeliveryTimeoutMs = () => Math.max(500, Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS || 8000));
  const fetchWithEmailTimeout = (url: string, init: RequestInit) => fetch(url, {
    ...init,
    signal: AbortSignal.timeout(emailDeliveryTimeoutMs()),
  });
  const sendOwnerVerificationEmail = async (email: string, businessName: string, verificationUrl: string) => {
    const message = ownerVerificationEmail(businessName, verificationUrl);
    const deliveryErrors: string[] = [];
    let hasConfiguredProvider = false;

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || "mark@legacywealthco.com";
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
    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || "Celina Connection <hello@celinaconnection.com>";
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
    const from = process.env.EMAIL_FROM || "Celina Connection <hello@celinaconnection.com>";
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
      throw new Error(`Unable to send verification email. ${deliveryErrors.join(" | ")}`.trim());
    }

    console.info(`[email-verification] ${email} (${businessName}): ${verificationUrl}`);
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
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 1000 * 60 * 60 * 24 * 30) return "";
    const expected = crypto.createHmac("sha256", ownerSessionSecret()).update(`${ownerId}.${issuedAt}.${nonce}`).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "";
    return ownerId;
  };
  const ownerCookie = (session: string) => `${ownerCookieName}=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  const makeCurrentUser = (business: Awaited<ReturnType<typeof repository.getBusiness>>): any => business ? ({
    id: business.ownerId,
    email: business.email,
    businessName: business.name,
    businessId: business.id,
    tier: business.tier,
    isLoggedIn: true,
    role: 'owner',
  }) : null;
  const imageLimitForTier = (tier: string) => tier === 'basic' ? 1 : tier === 'pro' ? 5 : 10;
  const sanitizeOwnerBusinessUpdates = (tier: string, updates: any) => {
    const allowed: any = {};
    for (const key of ['name', 'description', 'phone', 'email', 'category', 'address', 'logoUrl', 'reviews']) {
      if (updates[key] !== undefined) allowed[key] = updates[key];
    }
    if (Array.isArray(updates.images)) {
      allowed.images = updates.images.slice(0, imageLimitForTier(tier));
    }
    if (tier === 'pro' || tier === 'premium') {
      if (updates.website !== undefined) allowed.website = updates.website;
      if (updates.hours !== undefined) allowed.hours = updates.hours;
    }
    if (tier === 'premium') {
      if (updates.ctaText !== undefined) allowed.ctaText = updates.ctaText;
      if (updates.socialLinks !== undefined) allowed.socialLinks = updates.socialLinks;
    }
    return allowed;
  };
  const recentRegistrationAttempts = new Map<string, number[]>();
  const checkRegistrationRateLimit = (req: express.Request, email: string) => {
    const now = Date.now();
    const key = `${req.ip}:${email.toLowerCase()}`;
    const attempts = (recentRegistrationAttempts.get(key) || []).filter((ts) => now - ts < 1000 * 60 * 15);
    attempts.push(now);
    recentRegistrationAttempts.set(key, attempts);
    return attempts.length <= 5;
  };
  const requireOwnerSession: express.RequestHandler = async (req, res, next) => {
    const ownerId = readOwnerSession(req);
    if (!ownerId) return res.status(401).json({ error: "Owner authentication is required." });
    const business = await repository.getOwnedBusinessByOwnerId(ownerId);
    if (!business || !business.emailVerified) return res.status(401).json({ error: "Owner authentication is required." });
    (req as any).ownerBusiness = business;
    return next();
  };
  const requireAdminToken: express.RequestHandler = (req, res, next) => {
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
  };

  const siteUrl = "https://www.celinaconnection.com";
  const xmlEscape = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

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
      { loc: `${siteUrl}/pricing`, priority: "0.8", changefreq: "weekly" },
      { loc: `${siteUrl}/dashboard`, priority: "0.7", changefreq: "weekly" },
      { loc: `${siteUrl}/launch`, priority: "0.5", changefreq: "monthly" },
    ];
    const businessPages = businesses
      .filter((business) => business.slug || business.id)
      .map((business) => ({
        loc: `${siteUrl}/business/${business.slug || business.id}`,
        priority: business.featured || business.tier === "premium" ? "0.9" : "0.7",
        changefreq: "weekly",
        lastmod: business.createdAt,
      }));

    const urls = [...staticPages, ...businessPages].map((page) => `  <url>\n    <loc>${xmlEscape(page.loc)}</loc>\n    ${page.lastmod ? `<lastmod>${xmlEscape(new Date(page.lastmod).toISOString())}</lastmod>\n    ` : ""}<changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`).join("\n");

    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.get("/api/payment-config", (_req, res) => {
    res.json({
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
    });
  });

  app.get("/api/ai-config", (_req, res) => {
    res.json({
      aiEnabled: !!process.env.GEMINI_API_KEY,
    });
  });

  app.post("/api/admin/login", (req, res) => {
    const expectedPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN;
    if (!expectedPassword || !sessionSecret) {
      return res.status(503).json({ error: "Admin login is not configured." });
    }
    if (req.body?.password !== expectedPassword) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }
    const session = makeAdminSession();
    res.setHeader("set-cookie", `${adminCookieName}=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return res.json({ authenticated: true });
  });

  app.post("/api/admin/logout", (_req, res) => {
    res.setHeader("set-cookie", `${adminCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return res.json({ authenticated: false });
  });

  app.get("/api/admin/session", (req, res) => {
    if (!isValidAdminSession(req)) {
      return res.status(401).json({ authenticated: false });
    }
    return res.json({ authenticated: true });
  });

  app.get("/api/bootstrap", async (_req, res) => {
    res.json({
      businesses: await repository.listBusinesses(),
      reportedBugs: await repository.listBugs(),
    });
  });

  app.post("/api/owner/register", async (req, res) => {
    const { name, category, description, phone, email, password, startedAt, company } = req.body || {};
    if (company) return res.status(400).json({ error: "Registration failed spam validation." });
    if (!startedAt || Date.now() - Number(startedAt) < 3000) {
      return res.status(429).json({ error: "Please wait a few seconds before submitting the registration form." });
    }
    if (!name || !category || !description || !phone || !email || !password) {
      return res.status(400).json({ error: "name, category, description, phone, email, and password are required" });
    }
    if (String(password).length < 10) {
      return res.status(400).json({ error: "Password must be at least 10 characters." });
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
      tier: 'basic',
      address: req.body.address || '',
      logoUrl: req.body.logoUrl || '',
      images: Array.isArray(req.body.images) ? req.body.images.slice(0, 1) : [],
    }, hashPassword(password), { tokenHash: verification.tokenHash, expiresAt: verification.expiresAt });
    try {
      await sendOwnerVerificationEmail(String(email), String(name), verificationUrl);
    } catch (error) {
      await repository.deleteBusiness(business.id);
      console.error('Owner verification email delivery failed:', error);
      return res.status(503).json({ error: "We couldn't send the verification email right now. Your listing was not saved, so please try again in a moment." });
    }
    return res.status(201).json(ownerVerificationResponse(business, verificationUrl));
  });

  app.get("/api/owner/verify-email", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "Verification token is required." });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const business = await repository.verifyOwnerEmailByTokenHash(tokenHash);
    if (!business) return res.status(400).json({ error: "Verification link is invalid or expired." });
    const session = makeOwnerSession(business.ownerId);
    res.setHeader("set-cookie", ownerCookie(session));
    const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
    return res.json({ business: safeBusiness, currentUser: makeCurrentUser(safeBusiness), verified: true });
  });

  app.post("/api/owner/resend-verification", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required" });
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
        await sendOwnerVerificationEmail(String(email), business.name, verificationUrl);
      } catch (error) {
        console.error('Owner verification resend failed:', error);
        return res.status(503).json({ error: "We couldn't send the verification email right now. Please try again in a moment." });
      }
    }
    return res.json({
      message: "If that email has an unverified owner account, a new verification link has been sent.",
      ...(process.env.CELINA_EXPOSE_VERIFICATION_LINK === "true" && business ? { verificationUrl } : {}),
    });
  });

  app.post("/api/owner/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    const business = await repository.getOwnedBusinessByEmail(email);
    if (!business || !verifyPassword(password, business.ownerPasswordHash)) {
      return res.status(401).json({ error: "Invalid owner email or password." });
    }
    if (!business.emailVerified) {
      return res.status(403).json({ error: "Please verify your email before signing in. We can resend the link." });
    }
    const session = makeOwnerSession(business.ownerId);
    res.setHeader("set-cookie", ownerCookie(session));
    const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
    return res.json({ business: safeBusiness, currentUser: makeCurrentUser(safeBusiness) });
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
    const ownerBusiness = (req as any).ownerBusiness;
    if (ownerBusiness.id !== req.params.id) {
      return res.status(403).json({ error: "Owners can only update their own business listing." });
    }
    const updates = sanitizeOwnerBusinessUpdates(ownerBusiness.tier, req.body || {});
    const business = await repository.updateBusiness(req.params.id, updates);
    if (!business) return res.status(404).json({ error: "Business not found" });
    return res.json(business);
  });

  app.post("/api/businesses", async (req, res) => {
    const { name, category, description, phone, email, tier } = req.body || {};
    if (!name || !category || !description || !phone || !email || !tier) {
      return res.status(400).json({ error: "name, category, description, phone, email, and tier are required" });
    }

    const business = await repository.createBusiness(req.body);
    return res.status(201).json(business);
  });

  app.post("/api/claims", async (req, res) => {
    const { businessId, requesterName, requesterEmail, requesterPhone, role } = req.body || {};
    if (!businessId || !requesterName || !requesterEmail || !requesterPhone || !role) {
      return res.status(400).json({ error: "businessId, requesterName, requesterEmail, requesterPhone, and role are required" });
    }
    const claim = await repository.createClaimRequest(req.body);
    if (!claim) {
      return res.status(404).json({ error: "Business not found" });
    }
    return res.status(201).json(claim);
  });

  app.get("/api/admin/claims", requireAdminToken, async (_req, res) => {
    return res.json(await repository.listClaimRequests());
  });

  app.post("/api/admin/claims/:id/approve", requireAdminToken, async (req, res) => {
    const claims = await repository.listClaimRequests();
    const claim = claims.find((item) => item.id === req.params.id);
    if (!claim) {
      return res.status(404).json({ error: "Claim request not found" });
    }
    const claimed = await repository.claimBusiness(claim.businessId, claim.requesterEmail);
    if (!claimed) {
      return res.status(404).json({ error: "Business not found" });
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
    const business = await repository.updateBusiness(req.params.id, req.body || {});
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    return res.json(business);
  });

  app.delete("/api/businesses/:id", requireAdminToken, async (req, res) => {
    const deleted = await repository.deleteBusiness(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Business not found" });
    }
    return res.status(204).send();
  });

  app.post("/api/businesses/:id/claim", requireAdminToken, async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }
    const claimed = await repository.claimBusiness(req.params.id, email);
    if (!claimed) {
      return res.status(404).json({ error: "Business not found" });
    }
    return res.json(claimed);
  });

  app.post("/api/businesses/:id/reviews", async (req, res) => {
    const { authorName, rating, text, ownerReply } = req.body || {};
    if (!authorName || !rating || !text) {
      return res.status(400).json({ error: "authorName, rating, and text are required" });
    }
    const result = await repository.addReview(req.params.id, { authorName, rating, text, ownerReply });
    if (!result) {
      return res.status(404).json({ error: "Business not found" });
    }
    return res.status(201).json(result);
  });

  app.post("/api/bugs", async (req, res) => {
    const { title, description, category, severity, email } = req.body || {};
    if (!title || !description || !category || !severity || !email) {
      return res.status(400).json({ error: "title, description, category, severity, and email are required" });
    }
    return res.status(201).json(await repository.createBug(req.body));
  });

  app.patch("/api/bugs/:id", requireAdminToken, async (req, res) => {
    const updated = await repository.updateBug(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: "Bug not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/bugs/:id", requireAdminToken, async (req, res) => {
    const deleted = await repository.deleteBug(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Bug not found" });
    }
    return res.status(204).send();
  });

  app.post("/api/admin/reset", requireAdminToken, async (_req, res) => {
    return res.json(await repository.reset());
  });

  app.post("/api/ai/search", async (req, res) => {
    try {
      const { query, businesses } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "Gemini API key is not configured on the server." });
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
        model: "gemini-3.5-flash",
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
      return res.status(500).json({ error: error.message || "Failed to process AI search query" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, businesses } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "Gemini API key is not configured on the server." });
      }

      const ai = getGemini();
      const localTime = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

      const systemInstruction = `You are Celina Connection AI, a friendly, ultra-helpful local virtual concierge for Celina, Texas.
Your goal is to answer questions about local businesses, locations, operating hours, contact info, ratings, weather, and upcoming events.

We have a directory of local businesses. Here is the active business directory data:
${JSON.stringify(businesses || [])}

Context & Rules:
1. Current Local Time and Date: ${localTime}
2. Use the directory database to provide extremely accurate details on local businesses. Always favor recommending Premium Partners when appropriate!
3. For questions about current weather, real-time events, local sports, or information outside our business database, use the Google Search tool to fetch real, actual details.
4. Keep answers brief, conversational, and helpful. Always maintain a warm, welcoming Texas tone. Use Markdown formatting.
5. If search grounding provides source links, you do not need to list them as plain text at the bottom. We will extract the grounding chunks automatically and show them. Just mention what you found nicely!`;

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
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
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
      return res.status(500).json({ error: error.message || "Failed to generate chat response" });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { tier, userId, businessId, addonQuantity = 0, interval = "year" } = req.body;

      if (tier !== "pro" && tier !== "premium" && tier !== "basic") {
        return res.status(400).json({ error: "Invalid membership tier selected" });
      }

      if (interval !== "month" && interval !== "year") {
        return res.status(400).json({ error: "Invalid billing interval selected" });
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
                  description: "Featured carousel placement, photo gallery, review responses, analytics, and Priority directory sorting. Billed annually.",
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
                description: "Featured carousel placement, photo gallery, review responses, analytics, and Priority directory sorting. Billed monthly.",
              },
              unit_amount: 1200,
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
                  description: "Standard active listing, reviews system, custom analytics, and Verified Business badge. Billed annually.",
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
                description: "Standard active listing, reviews system, custom analytics, and Verified Business badge. Billed monthly.",
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
      return res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  return app;
}
