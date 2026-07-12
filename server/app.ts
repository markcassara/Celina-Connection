import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import { createRepository } from "./database.js";

dotenv.config();

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

  const requireAdminToken: express.RequestHandler = (req, res, next) => {
    const expectedToken = process.env.ADMIN_API_TOKEN;
    if (!expectedToken) {
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

  app.get("/api/bootstrap", async (_req, res) => {
    res.json({
      businesses: await repository.listBusinesses(),
      reportedBugs: await repository.listBugs(),
    });
  });

  app.post("/api/businesses", async (req, res) => {
    const { name, category, description, phone, email, tier } = req.body || {};
    if (!name || !category || !description || !phone || !email || !tier) {
      return res.status(400).json({ error: "name, category, description, phone, email, and tier are required" });
    }

    const business = await repository.createBusiness(req.body);
    return res.status(201).json(business);
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
