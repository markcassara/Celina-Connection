var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server/app.ts
import crypto2 from "node:crypto";

// server/listingMedia.ts
import crypto from "node:crypto";
var inlineImage = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;
var digestMarker = /^inline:([a-f0-9]{32})$/;
function listingImageVersion(image) {
  const marker = image.match(digestMarker);
  if (marker) return marker[1];
  return inlineImage.test(image) ? crypto.createHash("md5").update(image).digest("hex") : null;
}
function listingImageUrl(id, slot, image) {
  const version = listingImageVersion(image);
  return version ? `/api/listing-images/${encodeURIComponent(id)}/${slot}/${version}.webp` : image;
}
function publicListingMedia(business) {
  return {
    ...business,
    logoUrl: listingImageUrl(business.id, "logo", business.logoUrl || ""),
    images: (business.images || []).map((image, index) => listingImageUrl(business.id, String(index), image))
  };
}
function restoreListingMedia(current, updates) {
  const originals = /* @__PURE__ */ new Map();
  if (current.logoUrl) originals.set(listingImageUrl(current.id, "logo", current.logoUrl), current.logoUrl);
  (current.images || []).forEach((image, index) => originals.set(listingImageUrl(current.id, String(index), image), image));
  const restore = (value) => {
    if (value.startsWith("/api/listing-images/")) {
      const original = originals.get(value);
      if (original === void 0) throw new Error("This photo changed. Refresh the listing before saving.");
      return original;
    }
    return value;
  };
  return {
    ...updates,
    ...typeof updates.logoUrl === "string" ? { logoUrl: restore(updates.logoUrl) } : {},
    ...Array.isArray(updates.images) ? { images: updates.images.map(restore) } : {}
  };
}

// server/app.ts
import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";

// server/database.ts
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { neon as importedNeon } from "@neondatabase/serverless";

// src/data/mockBusinesses.ts
var CATEGORIES = [
  "All",
  "Activities & Community",
  "Arts & Entertainment",
  "Automotive",
  "Beauty & Personal Care",
  "Business Services",
  "Childcare & Education",
  "Dining",
  "Estate Planning",
  "Events & Venues",
  "Financial Services",
  "Fitness & Recreation",
  "Health & Wellness",
  "Home & Garden",
  "Home & Professional Services",
  "Home Services",
  "Legal Services",
  "Medical & Dental",
  "Mortgage & Lending",
  "Nonprofits & Churches",
  "Pet Services",
  "Professional Services",
  "Real Estate",
  "Retail",
  "Shopping & Retail",
  "Services",
  "Trades & Contractors"
];
var INITIAL_BUSINESSES = [
  {
    id: "lucys-on-the-square",
    name: "Lucy's on the Square",
    category: "Dining",
    description: "An iconic comfort-food dining destination right in the heart of historic downtown Celina. Famous for our classic chicken fried steak, Southern hospitality, and warm homemade pies.",
    phone: "(972) 382-1212",
    email: "info@lucyscelina.com",
    website: "https://www.lucysonthesquare.com",
    address: "127 N Ohio St, Celina, TX 75009",
    hours: {
      monFri: "11:00 AM - 9:00 PM",
      sat: "8:00 AM - 10:00 PM",
      sun: "8:00 AM - 3:00 PM"
    },
    logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
    ],
    rating: 4.8,
    reviewCount: 142,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1240, callClicks: 310, directionsClicks: 180, websiteClicks: 420 },
    reviews: [
      { id: "rev-1", authorName: "Jerome M.", rating: 5, text: "Best chicken fried steak in Collin County! The service is always fast and friendly.", createdAt: "2026-06-10T14:20:00.000Z" },
      { id: "rev-2", authorName: "Cheryl K.", rating: 5, text: "Downtown staple. Make sure to save room for pie!", createdAt: "2026-06-15T18:45:00.000Z" }
    ]
  },
  {
    id: "bistro-115",
    name: "CELINA Bistro",
    category: "Dining",
    description: "Upscale American dining featuring seasonal craft cocktails, hand-cut steaks, and fresh farm-to-table specials in downtown Celina.",
    phone: "(972) 382-2115",
    email: "reservations@bistro115celina.com",
    website: "https://www.bistro115celina.com",
    address: "115 W Pecan St, Celina, TX 75009",
    hours: {
      monFri: "4:00 PM - 10:00 PM",
      sat: "11:00 AM - 11:00 PM",
      sun: "10:00 AM - 4:00 PM"
    },
    logoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80"
    ],
    rating: 4.9,
    reviewCount: 98,
    tier: "premium",
    featured: true,
    isUnclaimed: false,
    ownerId: "admin",
    emailVerified: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 2450, callClicks: 520, directionsClicks: 340, websiteClicks: 890 },
    reviews: [
      { id: "rev-3", authorName: "Net Taylor", rating: 5, text: "Outstanding atmosphere for date night. The filet mignon was cooked to perfection.", createdAt: "2026-06-18T20:10:00.000Z" }
    ]
  },
  {
    id: "celina-financial-planning",
    name: "Celina Financial Planning Co.",
    category: "Services",
    description: "Comprehensive financial planning, wealth management, and retirement strategy solutions tailored for Celina families and business owners.",
    phone: "(972) 382-8800",
    email: "hello@celinafinancialplanning.com",
    website: "https://www.celinafinancialplanning.com",
    address: "302 W Walnut St, Celina, TX 75009",
    hours: {
      monFri: "8:30 AM - 5:00 PM",
      sat: "By Appointment",
      sun: "Closed"
    },
    logoUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80"
    ],
    rating: 5,
    reviewCount: 54,
    tier: "premium",
    featured: true,
    isUnclaimed: false,
    ownerId: "admin",
    emailVerified: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1890, callClicks: 410, directionsClicks: 210, websiteClicks: 670 },
    reviews: [
      { id: "rev-4", authorName: "Marcus B.", rating: 5, text: "Professional, transparent, and knowledgeable. Their team made long-term planning feel clear and approachable.", createdAt: "2026-06-20T11:30:00.000Z" }
    ]
  },
  {
    id: "annie-jack-boutique",
    name: "Annie Jack Boutique",
    category: "Retail",
    description: "Curated apparel, stylish home decor, unique gifts, and local artisan products located on the historic Celina Square.",
    phone: "(972) 382-4550",
    email: "hello@anniejackboutique.com",
    website: "https://www.anniejackboutique.com",
    address: "222 West Walnut St, Celina, TX 75009",
    hours: {
      monFri: "10:00 AM - 6:00 PM",
      sat: "10:00 AM - 5:00 PM",
      sun: "Closed"
    },
    logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
    images: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80"
    ],
    rating: 4.7,
    reviewCount: 86,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1120, callClicks: 190, directionsClicks: 140, websiteClicks: 380 },
    reviews: [
      { id: "rev-5", authorName: "Sarah M.", rating: 5, text: "My favorite place to shop for gifts in Celina. Super friendly staff!", createdAt: "2026-06-22T16:00:00.000Z" }
    ]
  },
  {
    id: "celina-family-chiropractic",
    name: "Celina Family Chiropractic",
    category: "Health & Wellness",
    description: "Gentle, holistic chiropractic care for families, athletes, and pregnant mothers in Celina.",
    phone: "(972) 382-9922",
    email: "care@celinachiro.com",
    website: "https://www.celinachiro.com",
    address: "105 Preston Rd, Celina, TX 75009",
    hours: { monFri: "8:00 AM - 6:00 PM", sat: "By Appointment", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.9,
    reviewCount: 65,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 850, callClicks: 140, directionsClicks: 95, websiteClicks: 210 },
    reviews: []
  },
  {
    id: "celina-auto-repair",
    name: "Celina Auto & Tire",
    category: "Automotive",
    description: "Full-service auto repair, brake service, state inspections, and tire replacement.",
    phone: "(972) 382-3344",
    email: "service@celinaauto.com",
    website: "https://www.celinaauto.com",
    address: "410 S Preston Rd, Celina, TX 75009",
    hours: { monFri: "7:30 AM - 6:00 PM", sat: "8:00 AM - 2:00 PM", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.6,
    reviewCount: 110,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 990, callClicks: 230, directionsClicks: 160, websiteClicks: 270 },
    reviews: []
  },
  {
    id: "celina-plumbing-co",
    name: "Celina Plumbing Co.",
    category: "Home Services",
    description: "Licensed master plumbers offering emergency repair, water heater installation, and drain cleaning.",
    phone: "(972) 382-7711",
    email: "contact@celinaplumbing.com",
    website: "https://www.celinaplumbing.com",
    address: "201 N Oklahoma St, Celina, TX 75009",
    hours: { monFri: "7:00 AM - 7:00 PM", sat: "8:00 AM - 4:00 PM", sun: "Emergency Only" },
    logoUrl: "https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.8,
    reviewCount: 78,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 760, callClicks: 180, directionsClicks: 80, websiteClicks: 190 },
    reviews: []
  },
  {
    id: "toasted-walnut-table",
    name: "Toasted Walnut Table & Bar",
    category: "Dining",
    description: "Craft burgers, gourmet sandwiches, and local Texas beers on tap in historic downtown Celina.",
    phone: "(972) 382-5500",
    email: "hello@toastedwalnut.com",
    website: "https://www.toastedwalnut.com",
    address: "300 W Walnut St, Celina, TX 75009",
    hours: { monFri: "11:00 AM - 9:00 PM", sat: "10:00 AM - 10:00 PM", sun: "10:00 AM - 8:00 PM" },
    logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.7,
    reviewCount: 115,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1400, callClicks: 290, directionsClicks: 210, websiteClicks: 350 },
    reviews: []
  },
  {
    id: "celina-lawn-care",
    name: "Celina Lawn & Landscape",
    category: "Home Services",
    description: "Residential mowing, fertilization, weed control, flowerbed maintenance, and sprinkler repair.",
    phone: "(972) 382-6688",
    email: "info@celinalawn.com",
    website: "https://www.celinalawn.com",
    address: "500 Frontier Pkwy, Celina, TX 75009",
    hours: { monFri: "7:00 AM - 5:00 PM", sat: "8:00 AM - 12:00 PM", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1558904541-efa8c196b27d?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1558904541-efa8c196b27d?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.9,
    reviewCount: 43,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 620, callClicks: 150, directionsClicks: 60, websiteClicks: 140 },
    reviews: []
  },
  {
    id: "tx-roots-salon",
    name: "Texas Roots Salon",
    category: "Health & Wellness",
    description: "Full-service hair salon specializing in modern balayage, cuts, styling, and bridal party packages.",
    phone: "(972) 382-4411",
    email: "style@txrootssalon.com",
    website: "https://www.txrootssalon.com",
    address: "112 W Pecan St, Celina, TX 75009",
    hours: { monFri: "9:00 AM - 7:00 PM", sat: "9:00 AM - 5:00 PM", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.8,
    reviewCount: 92,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1050, callClicks: 210, directionsClicks: 130, websiteClicks: 310 },
    reviews: []
  },
  {
    id: "papa-gallos-mexican-grill",
    name: "Papa Gallo's Mexican Grill",
    category: "Dining",
    description: "Authentic Tex-Mex favorites, handmade tamales, sizzlin' fajitas, and fresh margaritas on the square.",
    phone: "(972) 382-2200",
    email: "info@papagalloscelina.com",
    website: "https://www.papagalloscelina.com",
    address: "241 W Pecan St, Celina, TX 75009",
    hours: { monFri: "11:00 AM - 9:30 PM", sat: "11:00 AM - 10:00 PM", sun: "11:00 AM - 8:30 PM" },
    logoUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.8,
    reviewCount: 130,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1350, callClicks: 320, directionsClicks: 240, websiteClicks: 410 },
    reviews: []
  },
  {
    id: "grannys-bakery",
    name: "Granny's Bakery & Cafe",
    category: "Dining",
    description: "Freshly baked morning cinnamon rolls, custom cakes, sourdough breads, and specialty espresso coffees.",
    phone: "(972) 382-9110",
    email: "order@grannysbakerycelina.com",
    website: "https://www.grannysbakerycelina.com",
    address: "108 W Walnut St, Celina, TX 75009",
    hours: { monFri: "6:30 AM - 4:00 PM", sat: "7:00 AM - 3:00 PM", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.9,
    reviewCount: 112,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1180, callClicks: 260, directionsClicks: 170, websiteClicks: 390 },
    reviews: []
  },
  {
    id: "celina-dental-studio",
    name: "Celina Dental Studio",
    category: "Health & Wellness",
    description: "State-of-the-art family dentistry, teeth whitening, clear aligners, and gentle preventive oral care.",
    phone: "(972) 382-1000",
    email: "smile@celinadentalstudio.com",
    website: "https://www.celinadentalstudio.com",
    address: "105 S Preston Rd, Celina, TX 75009",
    hours: { monFri: "8:00 AM - 5:00 PM", sat: "By Appointment", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80"],
    rating: 5,
    reviewCount: 74,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 940, callClicks: 190, directionsClicks: 110, websiteClicks: 280 },
    reviews: []
  },
  {
    id: "bobcat-electric-solar",
    name: "Bobcat Electric & Solar",
    category: "Home Services",
    description: "Licensed commercial & residential electrical contractors, EV charger installers, and solar power specialists.",
    phone: "(972) 382-8400",
    email: "service@bobcatelectric.com",
    website: "https://www.bobcatelectric.com",
    address: "300 E Pecan St, Celina, TX 75009",
    hours: { monFri: "7:00 AM - 6:00 PM", sat: "8:00 AM - 2:00 PM", sun: "Closed" },
    logoUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.8,
    reviewCount: 58,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 710, callClicks: 160, directionsClicks: 75, websiteClicks: 180 },
    reviews: []
  },
  {
    id: "square-one-coffee",
    name: "Square One Coffee & Tea",
    category: "Dining",
    description: "Artisanal espresso bar, cold brews, matcha lattes, and fresh breakfast pastries right on Ohio Street.",
    phone: "(972) 382-4100",
    email: "hello@squareonecoffee.com",
    website: "https://www.squareonecoffee.com",
    address: "114 N Ohio St, Celina, TX 75009",
    hours: { monFri: "6:00 AM - 6:00 PM", sat: "7:00 AM - 6:00 PM", sun: "7:00 AM - 4:00 PM" },
    logoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&q=80",
    images: ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80"],
    rating: 4.9,
    reviewCount: 105,
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    metrics: { pageViews: 1290, callClicks: 280, directionsClicks: 195, websiteClicks: 340 },
    reviews: []
  },
  {
    id: "shebuild-apex-roofing-co",
    name: "SheBuild Apex Roofing Co.",
    category: "Trades & Contractors",
    description: "A women-led roofing and construction company delivering high-end residential and commercial roofing, storm restoration, inspections, gutters, waterproofing, and related property services across Texas.",
    phone: "(786) 365-0468",
    email: "info@shebuildapexroofingco.com",
    website: "https://shebuildapexroofingco.com/",
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-08-24T00:00:00.000Z",
    reviews: []
  },
  {
    id: "kh-visual-co",
    name: "KH Visual Co",
    category: "Business Services",
    description: "Dallas-Fort Worth corporate and event photography for conferences, brand activations, product launches, grand openings, galas, weddings, and lifestyle sessions.",
    phone: "",
    email: "klhends@gmail.com",
    website: "https://khvisualco.com/",
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-08-24T00:00:00.000Z",
    reviews: []
  },
  {
    id: "289-sports-performance",
    name: "289 Sports Performance",
    category: "Fitness & Recreation",
    description: "Athletic performance, speed and strength development, pain recovery, adult restoration training, nutrition support, life coaching, and track club programs.",
    phone: "402.310.5926",
    email: "wade@289sportsperformance.com",
    website: "https://www.289sportsperformance.com/",
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-08-24T00:00:00.000Z",
    reviews: []
  },
  {
    id: "the-atlas-social",
    name: "The Atlas Social",
    category: "Business Services",
    description: "Social media and digital marketing services helping businesses strengthen their online presence, connect with customers, and grow through consistent engagement.",
    phone: "",
    email: "joserubio@theatlassocial.com",
    website: "https://theatlassocial.com/",
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-08-24T00:00:00.000Z",
    reviews: []
  },
  {
    id: "craft-clean-co",
    name: "Craft Clean Co.",
    category: "Home Services",
    description: "Professional residential and commercial cleaning services with a focus on dependable, detail-oriented care.",
    phone: "",
    email: "craftcleanco@gmail.com",
    website: "https://www.craftclean.co/",
    tier: "basic",
    isUnclaimed: true,
    ownerId: "",
    createdAt: "2026-08-24T00:00:00.000Z",
    reviews: []
  }
];

// server/database.ts
var req;
try {
  req = typeof __require !== "undefined" ? __require : createRequire(import.meta.url || "file:///" + process.cwd() + "/");
} catch {
  req = () => null;
}
var DatabaseSyncClass = null;
try {
  const sqliteModule = req("node:sqlite");
  DatabaseSyncClass = sqliteModule?.DatabaseSync || sqliteModule?.default?.DatabaseSync || null;
} catch {
  DatabaseSyncClass = null;
}
var neonFn = typeof importedNeon === "function" ? importedNeon : null;
function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `business-${Date.now()}`;
}
function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
function toJson(value) {
  return JSON.stringify(value ?? null);
}
function fromJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function rowToBusiness(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website || "",
    address: row.address || "",
    hours: fromJson(row.hours_json, void 0),
    logoUrl: row.logo_url || "",
    images: fromJson(row.images_json, []),
    socialLinks: fromJson(row.social_links_json, {}),
    featured: Boolean(row.featured),
    ctaText: row.cta_text || "",
    tier: row.tier,
    ownerId: row.owner_id || "",
    createdAt: row.created_at,
    reviews: fromJson(row.reviews_json, []),
    events: fromJson(row.events_json, []),
    viewsCount: Number(row.views_count || 0),
    votesCount: Number(row.votes_count || 0),
    growthCredits: fromJson(row.growth_credits_json, { shareClicks: 0, referralVisits: 0 }),
    notificationsEnabled: row.owner_notifications_enabled !== 0,
    eventNotificationsEnabled: row.owner_event_notifications_enabled !== 0,
    isUnclaimed: Boolean(row.is_unclaimed),
    isRegistryOnly: Boolean(row.is_registry_only),
    emailVerified: Boolean(row.email_verified),
    emailVerifiedAt: row.email_verified_at || ""
  };
}
function rowToOwnedBusiness(row) {
  return {
    ...rowToBusiness(row),
    ownerPasswordHash: row.owner_password_hash || ""
  };
}
function rowToBug(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    email: row.email,
    createdAt: row.created_at,
    status: row.status
  };
}
function rowToLegacyHillsPetitionSignature(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    streetAddress: row.street_address,
    neighborhood: row.neighborhood,
    phaseSection: row.phase_section || "",
    lotBlock: row.lot_block || "",
    builder: row.builder || "",
    comments: row.comments || "",
    signatureDataUrl: row.signature_data_url,
    contactId: row.contact_id || "",
    signedAt: row.signed_at,
    updatedAt: row.updated_at || ""
  };
}
function toLegacyHillsPetitionParams(signature) {
  return {
    id: signature.id,
    first_name: signature.firstName,
    last_name: signature.lastName,
    email: signature.email,
    phone: signature.phone,
    street_address: signature.streetAddress,
    neighborhood: signature.neighborhood || "Legacy Hills",
    phase_section: signature.phaseSection || "",
    lot_block: signature.lotBlock || "",
    builder: signature.builder || "",
    comments: signature.comments || "",
    signature_data_url: signature.signatureDataUrl,
    contact_id: signature.contactId || "",
    edit_token_hash: signature.editTokenHash || "",
    signed_at: signature.signedAt,
    updated_at: signature.updatedAt || ""
  };
}
function rowToClaimRequest(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    role: row.role,
    proofUrl: row.proof_url || "",
    notes: row.notes || "",
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || ""
  };
}
function toClaimParams(claim) {
  return {
    id: claim.id,
    business_id: claim.businessId,
    business_name: claim.businessName,
    requester_name: claim.requesterName,
    requester_email: claim.requesterEmail,
    requester_phone: claim.requesterPhone,
    role: claim.role,
    proof_url: claim.proofUrl || "",
    notes: claim.notes || "",
    status: claim.status,
    created_at: claim.createdAt,
    reviewed_at: claim.reviewedAt || ""
  };
}
function makeBusiness(input) {
  const id = input.id || `${slugify(input.name)}-${Math.random().toString(36).slice(2, 5)}`;
  return {
    id,
    slug: input.slug || slugify(input.name),
    name: input.name,
    category: input.category,
    description: input.description,
    phone: input.phone,
    email: input.email,
    website: input.website || "",
    address: input.address || "",
    hours: input.hours || { monFri: "9:00 AM - 5:00 PM", sat: "10:00 AM - 4:00 PM", sun: "Closed" },
    logoUrl: input.logoUrl || "",
    images: input.images || [],
    socialLinks: input.socialLinks || {},
    featured: input.featured || false,
    ctaText: input.ctaText || "Learn More",
    tier: input.tier,
    ownerId: input.ownerId || "",
    createdAt: input.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    reviews: input.reviews || [],
    viewsCount: input.viewsCount ?? 0,
    votesCount: input.votesCount ?? 0,
    growthCredits: input.growthCredits || { shareClicks: 0, referralVisits: 0 },
    notificationsEnabled: input.notificationsEnabled ?? true,
    eventNotificationsEnabled: input.eventNotificationsEnabled ?? true,
    isUnclaimed: input.isUnclaimed ?? false,
    isRegistryOnly: input.isRegistryOnly ?? false,
    emailVerified: input.emailVerified ?? true,
    emailVerifiedAt: input.emailVerifiedAt || ""
  };
}
function makeLegacyHillsPetitionSignature(input) {
  return {
    id: randomId("petition"),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    streetAddress: input.streetAddress,
    neighborhood: input.neighborhood || "Legacy Hills",
    phaseSection: input.phaseSection || "",
    lotBlock: input.lotBlock || "",
    builder: input.builder || "",
    comments: input.comments || "",
    signatureDataUrl: input.signatureDataUrl,
    contactId: input.contactId || "",
    ...input.editTokenHash ? { editTokenHash: input.editTokenHash } : {},
    signedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: ""
  };
}
function makeClaimPayload(business, email) {
  const currentUser = {
    id: `owner-${business.id}`,
    email,
    businessName: business.name,
    businessId: business.id,
    tier: business.tier,
    isLoggedIn: true,
    role: "owner"
  };
  return { business, currentUser };
}
function getInitialBusinessByName(name) {
  return INITIAL_BUSINESSES.find((business) => business.name === name);
}
function makeFeaturedPlaceholderBusiness(name) {
  const business = getInitialBusinessByName(name);
  if (!business) throw new Error(`Missing initial featured placeholder business: ${name}`);
  return makeBusiness(business);
}
var CelinaRepository = class {
  constructor(dbPath) {
    this.db = null;
    this.businessesMap = /* @__PURE__ */ new Map();
    this.bugsMap = /* @__PURE__ */ new Map();
    this.claimsMap = /* @__PURE__ */ new Map();
    this.petitionsMap = /* @__PURE__ */ new Map();
    if (DatabaseSyncClass) {
      let resolvedDbPath = dbPath;
      if (!resolvedDbPath) {
        const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_BUILDER);
        if (isVercel) {
          resolvedDbPath = path.join(os.tmpdir(), "celina.sqlite");
        } else {
          resolvedDbPath = path.join(process.cwd(), "data", "celina.sqlite");
        }
      }
      try {
        if (resolvedDbPath !== ":memory:") {
          fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });
        }
        this.db = new DatabaseSyncClass(resolvedDbPath);
      } catch (err) {
        console.warn(`Failed to initialize database at ${resolvedDbPath}, falling back to tmpdir/memory:`, err);
        try {
          const fallbackPath = path.join(os.tmpdir(), "celina.sqlite");
          fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
          this.db = new DatabaseSyncClass(fallbackPath);
        } catch {
          try {
            this.db = new DatabaseSyncClass(":memory:");
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
          owner_notifications_enabled INTEGER NOT NULL DEFAULT 1,
          owner_event_notifications_enabled INTEGER NOT NULL DEFAULT 1,
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
        "ALTER TABLE businesses ADD COLUMN owner_password_hash TEXT",
        "ALTER TABLE businesses ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE businesses ADD COLUMN email_verified_at TEXT",
        "ALTER TABLE businesses ADD COLUMN email_verification_token_hash TEXT",
        "ALTER TABLE businesses ADD COLUMN email_verification_expires_at TEXT",
        "ALTER TABLE businesses ADD COLUMN password_reset_token_hash TEXT",
        "ALTER TABLE businesses ADD COLUMN password_reset_expires_at TEXT",
        "ALTER TABLE businesses ADD COLUMN events_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE businesses ADD COLUMN votes_count INTEGER NOT NULL DEFAULT 0",
        `ALTER TABLE businesses ADD COLUMN growth_credits_json TEXT NOT NULL DEFAULT '{"shareClicks":0,"referralVisits":0}'`,
        "ALTER TABLE businesses ADD COLUMN owner_notifications_enabled INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE businesses ADD COLUMN owner_event_notifications_enabled INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE legacy_hills_petition_signatures ADD COLUMN phase_section TEXT",
        "ALTER TABLE legacy_hills_petition_signatures ADD COLUMN lot_block TEXT",
        "ALTER TABLE legacy_hills_petition_signatures ADD COLUMN builder TEXT",
        "ALTER TABLE legacy_hills_petition_signatures ADD COLUMN edit_token_hash TEXT",
        "ALTER TABLE legacy_hills_petition_signatures ADD COLUMN updated_at TEXT"
      ]) {
        try {
          this.db.exec(statement);
        } catch {
        }
      }
      const businessCount = Number(this.db.prepare("SELECT COUNT(*) as count FROM businesses").get().count || 0);
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
      this.db.exec("DELETE FROM businesses; DELETE FROM reported_bugs; DELETE FROM claim_requests; DELETE FROM legacy_hills_petition_signatures;");
      for (const business of INITIAL_BUSINESSES) {
        this.upsertBusiness(makeBusiness(business));
      }
    } else {
      this.businessesMap.clear();
      for (const business of INITIAL_BUSINESSES) {
        const busObj = makeBusiness(business);
        this.businessesMap.set(busObj.id, busObj);
      }
    }
  }
  ensureFeaturedPlaceholderBusinesses() {
    if (!this.db) return;
    for (const initBiz of INITIAL_BUSINESSES) {
      const existing = this.db.prepare("SELECT id FROM businesses WHERE id = ? OR lower(name) = lower(?)").get(initBiz.id, initBiz.name);
      if (!existing) {
        this.upsertBusiness(makeBusiness(initBiz));
      }
    }
    const lucys = makeFeaturedPlaceholderBusiness("Lucy's on the Square");
    this.db.prepare(`
      UPDATE businesses
      SET featured = 0, tier = 'basic'
      WHERE id = ? OR lower(name) = lower(?)
    `).run(lucys.id, lucys.name);
    const celinaBistro = makeFeaturedPlaceholderBusiness("CELINA Bistro");
    const existingBistro = this.db.prepare("SELECT id FROM businesses WHERE lower(name) LIKE 'celina bistro%' OR id = 'celina-bistro-demo' ORDER BY created_at DESC LIMIT 1").get();
    if (existingBistro?.id) {
      this.db.prepare(`
        UPDATE businesses
        SET name = ?, slug = ?, featured = 1, tier = ?, is_unclaimed = 0, email_verified = 1,
            owner_id = ?, logo_url = ?, images_json = ?, cta_text = ?
        WHERE id = ?
      `).run(celinaBistro.name, celinaBistro.slug, celinaBistro.tier, celinaBistro.ownerId || "admin", celinaBistro.logoUrl, JSON.stringify(celinaBistro.images || []), celinaBistro.ctaText || "View Demo", existingBistro.id);
    } else {
      this.upsertBusiness(celinaBistro);
    }
    const celinaFinancial = makeFeaturedPlaceholderBusiness("Celina Financial Planning Co.");
    const existingCelinaFinancialRows = this.db.prepare("SELECT id FROM businesses WHERE lower(name) = lower(?) OR lower(email) = lower(?)").all(celinaFinancial.name, celinaFinancial.email);
    if (existingCelinaFinancialRows.length) {
      this.db.prepare(`
        UPDATE businesses
        SET featured = 1, tier = ?, is_unclaimed = 0, email_verified = 1,
            owner_id = ?
        WHERE lower(name) = lower(?) OR lower(email) = lower(?)
      `).run(celinaFinancial.tier, celinaFinancial.ownerId || "admin", celinaFinancial.name, celinaFinancial.email);
    } else {
      this.upsertBusiness(celinaFinancial);
    }
  }
  resetLaunchCountersOnce() {
    if (!this.db) return;
    const flag = this.db.prepare("SELECT value FROM app_settings WHERE key = 'launch_counters_reset_2026_08'").get();
    if (flag?.value === "true") return;
    this.db.exec("UPDATE businesses SET views_count = 0;");
    this.db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('launch_counters_reset_2026_08', 'true')").run();
  }
  listBusinesses() {
    if (!this.db) return Array.from(this.businessesMap.values()).filter((b) => b.emailVerified !== false);
    return this.db.prepare("SELECT * FROM businesses WHERE email_verified = 1 ORDER BY featured DESC, views_count DESC, name ASC").all().map(rowToBusiness);
  }
  listPublicBusinesses() {
    return this.listBusinesses().filter((business) => business.tier !== "pending").map(publicListingMedia);
  }
  getPublicListingImage(id, slot) {
    const business = this.getBusiness(id);
    if (!business || !business.emailVerified || business.tier === "pending") return null;
    return (slot === "logo" ? business.logoUrl : business.images?.[Number(slot)]) || null;
  }
  getBusiness(id) {
    if (!this.db) return this.businessesMap.get(id) || null;
    const row = this.db.prepare("SELECT * FROM businesses WHERE id = ?").get(id);
    return row ? rowToBusiness(row) : null;
  }
  createBusiness(input) {
    const business = makeBusiness(input);
    this.upsertBusiness(business);
    return business;
  }
  createOwnedBusiness(input, passwordHash, verification) {
    const business = makeBusiness({
      ...input,
      tier: input.tier || "free",
      ownerId: input.ownerId || randomId("owner"),
      featured: false,
      website: input.website || "",
      hours: void 0,
      socialLinks: {},
      ctaText: "Learn More",
      isUnclaimed: false,
      emailVerified: false,
      emailVerifiedAt: ""
    });
    this.upsertBusiness({ ...business, ownerPasswordHash: passwordHash });
    if (this.db) {
      this.db.prepare("UPDATE businesses SET owner_password_hash = ?, email_verified = 0, email_verified_at = ?, email_verification_token_hash = ?, email_verification_expires_at = ? WHERE id = ?").run(passwordHash, "", verification.tokenHash, verification.expiresAt, business.id);
    }
    return business;
  }
  getOwnedBusinessByEmail(email) {
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find((b) => b.email.toLowerCase() === email.toLowerCase());
      return found || null;
    }
    const row = this.db.prepare("SELECT * FROM businesses WHERE lower(email) = lower(?) AND owner_password_hash IS NOT NULL AND owner_password_hash != ? ORDER BY created_at DESC LIMIT 1").get(email, "");
    return row ? rowToOwnedBusiness(row) : null;
  }
  getOwnedBusinessByOwnerId(ownerId) {
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find((b) => b.ownerId === ownerId);
      return found || null;
    }
    const row = this.db.prepare("SELECT * FROM businesses WHERE owner_id = ? AND owner_password_hash IS NOT NULL AND owner_password_hash != ? ORDER BY created_at DESC LIMIT 1").get(ownerId, "");
    return row ? rowToOwnedBusiness(row) : null;
  }
  verifyOwnerEmailByTokenHash(tokenHash) {
    if (!this.db) return null;
    const row = this.db.prepare("SELECT * FROM businesses WHERE email_verification_token_hash = ? AND email_verification_expires_at > ? LIMIT 1").get(tokenHash, (/* @__PURE__ */ new Date()).toISOString());
    if (!row) return null;
    const verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare("UPDATE businesses SET email_verified = 1, email_verified_at = ?, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ?").run(verifiedAt, row.id);
    return this.getOwnedBusinessByOwnerId(row.owner_id);
  }
  refreshOwnerEmailVerification(email, verification) {
    if (!this.db) return null;
    const existing = this.getOwnedBusinessByEmail(email);
    if (!existing || existing.emailVerified) return null;
    this.db.prepare("UPDATE businesses SET email_verification_token_hash = ?, email_verification_expires_at = ? WHERE id = ?").run(verification.tokenHash, verification.expiresAt, existing.id);
    return this.getBusiness(existing.id);
  }
  createOwnerPasswordReset(email, reset) {
    const existing = this.getOwnedBusinessByEmail(email);
    if (!existing) return null;
    if (!this.db) {
      this.businessesMap.set(existing.id, {
        ...existing,
        passwordResetTokenHash: reset.tokenHash,
        passwordResetExpiresAt: reset.expiresAt
      });
      return existing;
    }
    this.db.prepare("UPDATE businesses SET password_reset_token_hash = ?, password_reset_expires_at = ? WHERE id = ?").run(reset.tokenHash, reset.expiresAt, existing.id);
    return this.getBusiness(existing.id);
  }
  resetOwnerPasswordByTokenHash(tokenHash, passwordHash) {
    const verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!this.db) {
      const found = Array.from(this.businessesMap.values()).find(
        (business) => business.passwordResetTokenHash === tokenHash && business.passwordResetExpiresAt && business.passwordResetExpiresAt > verifiedAt
      );
      if (!found) return null;
      const updated = {
        ...found,
        ownerPasswordHash: passwordHash,
        emailVerified: true,
        emailVerifiedAt: found.emailVerifiedAt || verifiedAt,
        passwordResetTokenHash: "",
        passwordResetExpiresAt: ""
      };
      this.businessesMap.set(found.id, updated);
      return updated;
    }
    const row = this.db.prepare("SELECT * FROM businesses WHERE password_reset_token_hash = ? AND password_reset_expires_at > ? LIMIT 1").get(tokenHash, verifiedAt);
    if (!row) return null;
    this.db.prepare("UPDATE businesses SET owner_password_hash = ?, email_verified = 1, email_verified_at = COALESCE(NULLIF(email_verified_at, ?), ?), password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ?").run(passwordHash, "", verifiedAt, row.id);
    return this.getOwnedBusinessByOwnerId(row.owner_id);
  }
  upsertBusiness(input) {
    const business = makeBusiness(input);
    if (!this.db) {
      this.businessesMap.set(business.id, business);
      return business;
    }
    this.db.prepare(`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, events_json, views_count, votes_count, growth_credits_json, is_unclaimed, is_registry_only,
        email_verified, email_verified_at, owner_notifications_enabled, owner_event_notifications_enabled
      ) VALUES (
        @id, @slug, @name, @category, @description, @phone, @email, @website, @address,
        @hours_json, @logo_url, @images_json, @social_links_json, @featured, @cta_text,
        @tier, @owner_id, @created_at, @reviews_json, @events_json, @views_count, @votes_count, @growth_credits_json, @is_unclaimed, @is_registry_only,
        @email_verified, @email_verified_at, @owner_notifications_enabled, @owner_event_notifications_enabled
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
        email_verified_at = excluded.email_verified_at,
        owner_notifications_enabled = excluded.owner_notifications_enabled,
        owner_event_notifications_enabled = excluded.owner_event_notifications_enabled
    `).run(toBusinessParams(business));
  }
  updateBusiness(id, updates) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const updated = { ...current, ...restoreListingMedia(current, updates), id };
    this.upsertBusiness(updated);
    return updated;
  }
  updateOwnerAccount(id, updates) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const ownerId = updates.ownerId ?? current.ownerId;
    const email = updates.email ?? current.email;
    const emailVerified = updates.emailVerified ?? current.emailVerified ?? true;
    const emailVerifiedAt = emailVerified ? current.emailVerifiedAt || (/* @__PURE__ */ new Date()).toISOString() : "";
    const updated = {
      ...current,
      ownerId,
      email,
      isUnclaimed: !ownerId,
      emailVerified,
      emailVerifiedAt
    };
    this.upsertBusiness(updated);
    if (this.db) {
      const passwordClause = updates.passwordHash ? ", owner_password_hash = ?" : "";
      const params = updates.passwordHash ? [emailVerified ? 1 : 0, emailVerifiedAt, "", null, updates.passwordHash, id] : [emailVerified ? 1 : 0, emailVerifiedAt, "", null, id];
      this.db.prepare(`UPDATE businesses SET email_verified = ?, email_verified_at = ?, email_verification_token_hash = ?, email_verification_expires_at = ?${passwordClause} WHERE id = ?`).run(...params);
    }
    return this.getOwnedBusinessByOwnerId(ownerId) || rowToOwnedBusiness({ ...toBusinessParams(updated), owner_password_hash: updates.passwordHash || "" });
  }
  deleteBusiness(id) {
    if (!this.db) {
      return this.businessesMap.delete(id);
    }
    const result = this.db.prepare("DELETE FROM businesses WHERE id = ?").run(id);
    return result.changes > 0;
  }
  claimBusiness(id, email) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const business = { ...current, tier: "pending", email, isUnclaimed: false, ownerId: `owner-${id}` };
    this.upsertBusiness(business);
    return makeClaimPayload(business, email);
  }
  addReview(id, input) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const review = { id: randomId("review"), authorName: input.authorName, rating: input.rating, text: input.text, createdAt: (/* @__PURE__ */ new Date()).toISOString(), ownerReply: input.ownerReply };
    const business = { ...current, reviews: [review, ...current.reviews || []] };
    this.upsertBusiness(business);
    return { business, review };
  }
  voteBusiness(id, delta) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const business = { ...current, votesCount: Math.max(0, Number(current.votesCount || 0) + delta) };
    this.upsertBusiness(business);
    return business;
  }
  trackBusinessGrowthAction(id, action) {
    const current = this.getBusiness(id);
    if (!current) return null;
    const growth = {
      shareClicks: Number(current.growthCredits?.shareClicks || 0),
      referralVisits: Number(current.growthCredits?.referralVisits || 0),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (action === "shareClick") growth.shareClicks += 1;
    if (action === "referralVisit") growth.referralVisits += 1;
    const business = { ...current, growthCredits: growth };
    this.upsertBusiness(business);
    return business;
  }
  listBugs() {
    if (!this.db) {
      return Array.from(this.bugsMap.values());
    }
    return this.db.prepare("SELECT * FROM reported_bugs ORDER BY created_at DESC").all().map(rowToBug);
  }
  createLegacyHillsPetitionSignature(input) {
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
    return this.db.prepare("SELECT * FROM legacy_hills_petition_signatures ORDER BY signed_at DESC").all().map(rowToLegacyHillsPetitionSignature);
  }
  getLegacyHillsPetitionSignatureByContact(email, phone) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const matchesContact = (signature) => signature.email.trim().toLowerCase() === normalizedEmail && signature.phone.replace(/\D/g, "") === normalizedPhone;
    if (!this.db) {
      return Array.from(this.petitionsMap.values()).find(matchesContact) || null;
    }
    const signatures = this.db.prepare("SELECT * FROM legacy_hills_petition_signatures WHERE lower(email) = ? ORDER BY signed_at DESC").all(normalizedEmail).map(rowToLegacyHillsPetitionSignature);
    return signatures.find(matchesContact) || null;
  }
  getLegacyHillsPetitionSignatureByEditTokenHash(tokenHash) {
    if (!this.db) {
      return Array.from(this.petitionsMap.values()).find((signature) => signature.editTokenHash === tokenHash) || null;
    }
    const row = this.db.prepare("SELECT * FROM legacy_hills_petition_signatures WHERE edit_token_hash = ?").get(tokenHash);
    return row ? rowToLegacyHillsPetitionSignature(row) : null;
  }
  updateLegacyHillsPetitionSignature(id, updates) {
    const existing = !this.db ? this.petitionsMap.get(id) : this.db.prepare("SELECT * FROM legacy_hills_petition_signatures WHERE id = ?").get(id);
    if (!existing) return null;
    const current = this.db ? rowToLegacyHillsPetitionSignature(existing) : existing;
    const next = {
      ...current,
      ...updates,
      email: updates.email ? updates.email.trim().toLowerCase() : current.email,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
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
      updated_at: values.updated_at
    });
    return rowToLegacyHillsPetitionSignature(this.db.prepare("SELECT * FROM legacy_hills_petition_signatures WHERE id = ?").get(id));
  }
  createBug(input) {
    const bug = { id: randomId("bug"), ...input, createdAt: (/* @__PURE__ */ new Date()).toISOString(), status: "open" };
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
  updateBug(id, updates) {
    if (!this.db) {
      const existing = this.bugsMap.get(id);
      if (!existing) return null;
      const bug2 = { ...existing, ...updates, id };
      this.bugsMap.set(id, bug2);
      return bug2;
    }
    const current = this.db.prepare("SELECT * FROM reported_bugs WHERE id = ?").get(id);
    if (!current) return null;
    const bug = { ...rowToBug(current), ...updates, id };
    this.db.prepare(`
      UPDATE reported_bugs
      SET title = @title, description = @description, category = @category, severity = @severity, email = @email, created_at = @created_at, status = @status
      WHERE id = @id
    `).run(toBugParams(bug));
    return bug;
  }
  deleteBug(id) {
    if (!this.db) {
      return this.bugsMap.delete(id);
    }
    const result = this.db.prepare("DELETE FROM reported_bugs WHERE id = ?").run(id);
    return result.changes > 0;
  }
  createClaimRequest(input) {
    const business = this.getBusiness(input.businessId);
    if (!business) return null;
    const claim = {
      id: randomId("claim"),
      businessId: business.id,
      businessName: business.name,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      role: input.role,
      proofUrl: input.proofUrl || "",
      notes: input.notes || "",
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      reviewedAt: ""
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
    return this.db.prepare("SELECT * FROM claim_requests ORDER BY created_at DESC").all().map(rowToClaimRequest);
  }
  updateClaimRequest(id, updates) {
    const current = this.db.prepare("SELECT * FROM claim_requests WHERE id = ?").get(id);
    if (!current) return null;
    const claim = { ...rowToClaimRequest(current), ...updates, id };
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
};
var PostgresRepository = class {
  constructor(databaseUrl, sqlOverride) {
    this.sql = null;
    if (sqlOverride) {
      this.sql = sqlOverride;
      return;
    }
    this.fallbackRepo = new CelinaRepository(":memory:");
    if (neonFn) {
      try {
        const sql = neonFn(databaseUrl);
        this.sql = typeof sql === "function" ? sql : null;
        if (!this.sql) {
          console.warn("Neon client did not return a callable SQL function; using in-memory fallback.");
        }
      } catch (err) {
        console.warn("Failed to initialize neon client:", err);
        this.sql = null;
      }
    }
  }
  async ensureInitialized() {
    if (!this.sql) throw new Error("Persistent database client is unavailable.");
    if (!this.initialized) {
      this.initialized = this.initialize().catch((err) => {
        this.initialized = void 0;
        throw err;
      });
    }
    await this.initialized;
  }
  async initialize() {
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
        owner_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        owner_event_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
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
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
    await this.sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_event_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
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
    const rows = await this.sql`SELECT COUNT(*)::int AS count FROM businesses`;
    if (Number(rows[0]?.count || 0) === 0) {
      await this.seedInitialData();
    }
    await this.ensureFeaturedPlaceholderBusinesses();
    await this.resetLaunchCountersOnce();
  }
  async seedInitialData() {
    await this.sql`DELETE FROM businesses`;
    await this.sql`DELETE FROM reported_bugs`;
    await this.sql`DELETE FROM claim_requests`;
    await this.sql`DELETE FROM legacy_hills_petition_signatures`;
    for (const business of INITIAL_BUSINESSES) {
      await this.upsertBusiness(makeBusiness(business), false);
    }
  }
  async ensureFeaturedPlaceholderBusinesses() {
    const seedVersion = "public-directory-v2-" + createHash("sha256").update(JSON.stringify(INITIAL_BUSINESSES)).digest("hex");
    const versionRows = await this.sql`SELECT value FROM app_settings WHERE key = 'directory_seed_version'`;
    if (versionRows[0]?.value === seedVersion) return;
    for (const initBiz of INITIAL_BUSINESSES) {
      const existing = await this.sql`
        SELECT id FROM businesses
        WHERE id = ${initBiz.id} OR lower(name) = lower(${initBiz.name})
        LIMIT 1
      `;
      if (!existing.length) {
        await this.upsertBusiness(makeBusiness(initBiz), false);
      }
    }
    const lucys = makeFeaturedPlaceholderBusiness("Lucy's on the Square");
    await this.sql`
      UPDATE businesses
      SET featured = FALSE, tier = 'basic'
      WHERE id = ${lucys.id} OR lower(name) = lower(${lucys.name})
    `;
    const celinaBistro = makeFeaturedPlaceholderBusiness("CELINA Bistro");
    const existingBistro = await this.sql`
      SELECT id FROM businesses WHERE lower(name) LIKE 'celina bistro%' OR id = 'celina-bistro-demo' ORDER BY created_at DESC LIMIT 1
    `;
    if (existingBistro[0]?.id) {
      await this.sql`
        UPDATE businesses
        SET name = ${celinaBistro.name}, slug = ${celinaBistro.slug}, featured = TRUE, tier = ${celinaBistro.tier}, is_unclaimed = FALSE, email_verified = TRUE,
            owner_id = ${celinaBistro.ownerId || "admin"}, logo_url = ${celinaBistro.logoUrl}, images_json = ${JSON.stringify(celinaBistro.images || [])}, cta_text = ${celinaBistro.ctaText || "View Demo"}
        WHERE id = ${existingBistro[0].id}
      `;
    } else {
      await this.upsertBusiness(celinaBistro, false);
    }
    const celinaFinancial = makeFeaturedPlaceholderBusiness("Celina Financial Planning Co.");
    const existingCelinaFinancialRows = await this.sql`
      SELECT id FROM businesses WHERE lower(name) = lower(${celinaFinancial.name}) OR lower(email) = lower(${celinaFinancial.email})
    `;
    if (existingCelinaFinancialRows.length) {
      await this.sql`
        UPDATE businesses
        SET featured = TRUE, tier = ${celinaFinancial.tier}, is_unclaimed = FALSE, email_verified = TRUE,
            owner_id = ${celinaFinancial.ownerId || "admin"}
        WHERE lower(name) = lower(${celinaFinancial.name}) OR lower(email) = lower(${celinaFinancial.email})
      `;
    } else {
      await this.upsertBusiness(celinaFinancial, false);
    }
    await this.sql`INSERT INTO app_settings (key, value) VALUES ('directory_seed_version', ${seedVersion})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  async resetLaunchCountersOnce() {
    const rows = await this.sql`SELECT value FROM app_settings WHERE key = 'launch_counters_reset_2026_08'`;
    if (rows[0]?.value === "true") return;
    await this.sql`UPDATE businesses SET views_count = 0`;
    await this.sql`INSERT INTO app_settings (key, value) VALUES ('launch_counters_reset_2026_08', 'true') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  async listBusinesses() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE email_verified = TRUE ORDER BY featured DESC, views_count DESC, name ASC`;
    return rows.map(rowToBusiness);
  }
  async listPublicBusinesses() {
    await this.ensureInitialized();
    const rows = await this.sql`
      SELECT (to_jsonb(b) - ARRAY['logo_url', 'images_json', 'owner_password_hash',
        'email_verification_token_hash', 'password_reset_token_hash']) ||
        jsonb_build_object(
          'logo_url', CASE WHEN logo_url ~* '^data:image/(png|jpe?g|webp|gif);base64,'
            THEN 'inline:' || md5(logo_url) ELSE coalesce(logo_url, '') END,
          'images_json', coalesce((
            SELECT jsonb_agg(CASE WHEN image ~* '^data:image/(png|jpe?g|webp|gif);base64,'
              THEN 'inline:' || md5(image) ELSE image END ORDER BY position)
            FROM jsonb_array_elements_text(coalesce(images_json::jsonb, '[]'::jsonb))
              WITH ORDINALITY AS media(image, position)
          ), '[]'::jsonb)
        ) AS business
      FROM businesses b WHERE email_verified = TRUE AND tier != 'pending'
      ORDER BY featured DESC, views_count DESC, name ASC
    `;
    return rows.map((row) => publicListingMedia(rowToBusiness(row.business)));
  }
  async getPublicListingImage(id, slot) {
    await this.ensureInitialized();
    const rows = slot === "logo" ? await this.sql`SELECT logo_url AS image FROM businesses WHERE id = ${id} AND email_verified = TRUE AND tier != 'pending'` : await this.sql`SELECT images_json::jsonb ->> ${Number(slot)}::int AS image FROM businesses WHERE id = ${id} AND email_verified = TRUE AND tier != 'pending'`;
    return rows[0]?.image || null;
  }
  async getBusiness(id) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE id = ${id}`;
    return rows[0] ? rowToBusiness(rows[0]) : null;
  }
  async createBusiness(input) {
    await this.ensureInitialized();
    const business = makeBusiness(input);
    await this.upsertBusiness(business, false);
    return business;
  }
  async createOwnedBusiness(input, passwordHash, verification) {
    await this.ensureInitialized();
    const business = makeBusiness({
      ...input,
      tier: input.tier || "free",
      ownerId: input.ownerId || randomId("owner"),
      featured: false,
      website: "",
      hours: void 0,
      socialLinks: {},
      ctaText: "Learn More",
      isUnclaimed: false,
      emailVerified: false,
      emailVerifiedAt: ""
    });
    await this.upsertBusiness(business, false);
    await this.sql`UPDATE businesses SET owner_password_hash = ${passwordHash}, email_verified = FALSE, email_verified_at = '', email_verification_token_hash = ${verification.tokenHash}, email_verification_expires_at = ${verification.expiresAt} WHERE id = ${business.id}`;
    return business;
  }
  async getOwnedBusinessByEmail(email) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.getOwnedBusinessByEmail(email);
    const rows = await this.sql`SELECT * FROM businesses WHERE lower(email) = lower(${email}) AND owner_password_hash IS NOT NULL AND owner_password_hash != '' ORDER BY created_at DESC LIMIT 1`;
    return rows[0] ? rowToOwnedBusiness(rows[0]) : null;
  }
  async getOwnedBusinessByOwnerId(ownerId) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.getOwnedBusinessByOwnerId(ownerId);
    const rows = await this.sql`SELECT * FROM businesses WHERE owner_id = ${ownerId} AND owner_password_hash IS NOT NULL AND owner_password_hash != '' ORDER BY created_at DESC LIMIT 1`;
    return rows[0] ? rowToOwnedBusiness(rows[0]) : null;
  }
  async verifyOwnerEmailByTokenHash(tokenHash) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM businesses WHERE email_verification_token_hash = ${tokenHash} AND email_verification_expires_at > ${(/* @__PURE__ */ new Date()).toISOString()} LIMIT 1`;
    if (!rows[0]) return null;
    const verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.sql`UPDATE businesses SET email_verified = TRUE, email_verified_at = ${verifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${rows[0].id}`;
    return this.getOwnedBusinessByOwnerId(rows[0].owner_id);
  }
  async refreshOwnerEmailVerification(email, verification) {
    const existing = await this.getOwnedBusinessByEmail(email);
    if (!existing || existing.emailVerified) return null;
    await this.sql`UPDATE businesses SET email_verification_token_hash = ${verification.tokenHash}, email_verification_expires_at = ${verification.expiresAt} WHERE id = ${existing.id}`;
    return this.getBusiness(existing.id);
  }
  async createOwnerPasswordReset(email, reset) {
    const existing = await this.getOwnedBusinessByEmail(email);
    if (!existing) return null;
    if (!this.sql) return this.fallbackRepo.createOwnerPasswordReset(email, reset);
    await this.sql`UPDATE businesses SET password_reset_token_hash = ${reset.tokenHash}, password_reset_expires_at = ${reset.expiresAt} WHERE id = ${existing.id}`;
    return this.getBusiness(existing.id);
  }
  async resetOwnerPasswordByTokenHash(tokenHash, passwordHash) {
    await this.ensureInitialized();
    if (!this.sql) return this.fallbackRepo.resetOwnerPasswordByTokenHash(tokenHash, passwordHash);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rows = await this.sql`SELECT * FROM businesses WHERE password_reset_token_hash = ${tokenHash} AND password_reset_expires_at > ${now} LIMIT 1`;
    if (!rows[0]) return null;
    const verifiedAt = rows[0].email_verified_at || now;
    await this.sql`UPDATE businesses SET owner_password_hash = ${passwordHash}, email_verified = TRUE, email_verified_at = ${verifiedAt}, password_reset_token_hash = NULL, password_reset_expires_at = NULL WHERE id = ${rows[0].id}`;
    return this.getOwnedBusinessByOwnerId(rows[0].owner_id);
  }
  async prepareBusinessMedia(business) {
    return business;
  }
  async upsertBusiness(business, initialize = true) {
    if (initialize) await this.ensureInitialized();
    business = await this.prepareBusinessMedia(business);
    const values = toBusinessParams(business);
    await this.sql`
      INSERT INTO businesses (
        id, slug, name, category, description, phone, email, website, address,
        hours_json, logo_url, images_json, social_links_json, featured, cta_text,
        tier, owner_id, created_at, reviews_json, events_json, views_count, votes_count, growth_credits_json, is_unclaimed, is_registry_only,
        email_verified, email_verified_at
        , owner_notifications_enabled, owner_event_notifications_enabled
      ) VALUES (
        ${values.id}, ${values.slug}, ${values.name}, ${values.category}, ${values.description}, ${values.phone}, ${values.email}, ${values.website}, ${values.address},
        ${values.hours_json}, ${values.logo_url}, ${values.images_json}, ${values.social_links_json}, ${Boolean(values.featured)}, ${values.cta_text},
        ${values.tier}, ${values.owner_id}, ${values.created_at}, ${values.reviews_json}, ${values.events_json}, ${values.views_count}, ${values.votes_count}, ${values.growth_credits_json}, ${Boolean(values.is_unclaimed)}, ${Boolean(values.is_registry_only)},
        ${Boolean(values.email_verified)}, ${values.email_verified_at}, ${Boolean(values.owner_notifications_enabled)}, ${Boolean(values.owner_event_notifications_enabled)}
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
        email_verified_at = EXCLUDED.email_verified_at,
        owner_notifications_enabled = EXCLUDED.owner_notifications_enabled,
        owner_event_notifications_enabled = EXCLUDED.owner_event_notifications_enabled
    `;
  }
  async updateBusiness(id, updates) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const updated = { ...current, ...restoreListingMedia(current, updates), id };
    await this.upsertBusiness(updated);
    return updated;
  }
  async updateOwnerAccount(id, updates) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const ownerId = updates.ownerId ?? current.ownerId;
    const email = updates.email ?? current.email;
    const emailVerified = updates.emailVerified ?? current.emailVerified ?? true;
    const emailVerifiedAt = emailVerified ? current.emailVerifiedAt || (/* @__PURE__ */ new Date()).toISOString() : "";
    const updated = {
      ...current,
      ownerId,
      email,
      isUnclaimed: !ownerId,
      emailVerified,
      emailVerifiedAt
    };
    await this.upsertBusiness(updated);
    if (updates.passwordHash) {
      await this.sql`UPDATE businesses SET owner_password_hash = ${updates.passwordHash}, email_verified = ${emailVerified}, email_verified_at = ${emailVerifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${id}`;
    } else {
      await this.sql`UPDATE businesses SET email_verified = ${emailVerified}, email_verified_at = ${emailVerifiedAt}, email_verification_token_hash = NULL, email_verification_expires_at = NULL WHERE id = ${id}`;
    }
    const owned = await this.getOwnedBusinessByOwnerId(ownerId);
    return owned || { ...updated, ownerPasswordHash: updates.passwordHash || "" };
  }
  async deleteBusiness(id) {
    await this.ensureInitialized();
    const rows = await this.sql`DELETE FROM businesses WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  async claimBusiness(id, email) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const business = { ...current, tier: "pending", email, isUnclaimed: false, ownerId: `owner-${id}` };
    await this.upsertBusiness(business);
    return makeClaimPayload(business, email);
  }
  async addReview(id, input) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const review = { id: randomId("review"), authorName: input.authorName, rating: input.rating, text: input.text, createdAt: (/* @__PURE__ */ new Date()).toISOString(), ownerReply: input.ownerReply };
    const business = { ...current, reviews: [review, ...current.reviews || []] };
    await this.upsertBusiness(business);
    return { business, review };
  }
  async voteBusiness(id, delta) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const business = { ...current, votesCount: Math.max(0, Number(current.votesCount || 0) + delta) };
    await this.upsertBusiness(business);
    return business;
  }
  async trackBusinessGrowthAction(id, action) {
    const current = await this.getBusiness(id);
    if (!current) return null;
    const growth = {
      shareClicks: Number(current.growthCredits?.shareClicks || 0),
      referralVisits: Number(current.growthCredits?.referralVisits || 0),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (action === "shareClick") growth.shareClicks += 1;
    if (action === "referralVisit") growth.referralVisits += 1;
    const business = { ...current, growthCredits: growth };
    await this.upsertBusiness(business);
    return business;
  }
  async listBugs() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM reported_bugs ORDER BY created_at DESC`;
    return rows.map(rowToBug);
  }
  async createLegacyHillsPetitionSignature(input) {
    await this.ensureInitialized();
    const signature = makeLegacyHillsPetitionSignature(input);
    await this.sql`
      INSERT INTO legacy_hills_petition_signatures (
        id, first_name, last_name, email, phone, street_address, neighborhood, phase_section, lot_block, builder, comments, signature_data_url, contact_id, edit_token_hash, signed_at, updated_at
      ) VALUES (
        ${signature.id}, ${signature.firstName}, ${signature.lastName}, ${signature.email}, ${signature.phone}, ${signature.streetAddress}, ${signature.neighborhood}, ${signature.phaseSection || ""}, ${signature.lotBlock || ""}, ${signature.builder || ""}, ${signature.comments || ""}, ${signature.signatureDataUrl}, ${signature.contactId || ""}, ${signature.editTokenHash || ""}, ${signature.signedAt}, ${signature.updatedAt || ""}
      )
    `;
    return signature;
  }
  async listLegacyHillsPetitionSignatures() {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures ORDER BY signed_at DESC`;
    return rows.map(rowToLegacyHillsPetitionSignature);
  }
  async getLegacyHillsPetitionSignatureByContact(email, phone) {
    await this.ensureInitialized();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE lower(email) = ${normalizedEmail} ORDER BY signed_at DESC`;
    return rows.map(rowToLegacyHillsPetitionSignature).find((signature) => signature.phone.replace(/\D/g, "") === normalizedPhone) || null;
  }
  async getLegacyHillsPetitionSignatureByEditTokenHash(tokenHash) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE edit_token_hash = ${tokenHash} LIMIT 1`;
    return rows[0] ? rowToLegacyHillsPetitionSignature(rows[0]) : null;
  }
  async updateLegacyHillsPetitionSignature(id, updates) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) return null;
    const current = rowToLegacyHillsPetitionSignature(rows[0]);
    const next = {
      ...current,
      ...updates,
      email: updates.email ? updates.email.trim().toLowerCase() : current.email,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.sql`
      UPDATE legacy_hills_petition_signatures SET
        first_name = ${next.firstName},
        last_name = ${next.lastName},
        email = ${next.email},
        phone = ${next.phone},
        street_address = ${next.streetAddress},
        neighborhood = ${next.neighborhood || "Legacy Hills"},
        phase_section = ${next.phaseSection || ""},
        lot_block = ${next.lotBlock || ""},
        builder = ${next.builder || ""},
        comments = ${next.comments || ""},
        signature_data_url = ${next.signatureDataUrl},
        updated_at = ${next.updatedAt || ""}
      WHERE id = ${id}
    `;
    const refreshed = await this.sql`SELECT * FROM legacy_hills_petition_signatures WHERE id = ${id} LIMIT 1`;
    return refreshed[0] ? rowToLegacyHillsPetitionSignature(refreshed[0]) : null;
  }
  async createBug(input) {
    await this.ensureInitialized();
    const bug = { id: randomId("bug"), ...input, createdAt: (/* @__PURE__ */ new Date()).toISOString(), status: "open" };
    const values = toBugParams(bug);
    await this.sql`
      INSERT INTO reported_bugs (id, title, description, category, severity, email, created_at, status)
      VALUES (${values.id}, ${values.title}, ${values.description}, ${values.category}, ${values.severity}, ${values.email}, ${values.created_at}, ${values.status})
    `;
    return bug;
  }
  async updateBug(id, updates) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM reported_bugs WHERE id = ${id}`;
    if (!rows[0]) return null;
    const bug = { ...rowToBug(rows[0]), ...updates, id };
    const values = toBugParams(bug);
    await this.sql`
      UPDATE reported_bugs
      SET title = ${values.title}, description = ${values.description}, category = ${values.category}, severity = ${values.severity}, email = ${values.email}, created_at = ${values.created_at}, status = ${values.status}
      WHERE id = ${values.id}
    `;
    return bug;
  }
  async deleteBug(id) {
    await this.ensureInitialized();
    const rows = await this.sql`DELETE FROM reported_bugs WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  async createClaimRequest(input) {
    const business = await this.getBusiness(input.businessId);
    if (!business) return null;
    const claim = {
      id: randomId("claim"),
      businessId: business.id,
      businessName: business.name,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      requesterPhone: input.requesterPhone,
      role: input.role,
      proofUrl: input.proofUrl || "",
      notes: input.notes || "",
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      reviewedAt: ""
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
    const rows = await this.sql`SELECT * FROM claim_requests ORDER BY created_at DESC`;
    return rows.map(rowToClaimRequest);
  }
  async updateClaimRequest(id, updates) {
    await this.ensureInitialized();
    const rows = await this.sql`SELECT * FROM claim_requests WHERE id = ${id}`;
    if (!rows[0]) return null;
    const claim = { ...rowToClaimRequest(rows[0]), ...updates, id };
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
};
function toBusinessParams(business) {
  return {
    id: business.id,
    slug: business.slug || slugify(business.name),
    name: business.name,
    category: business.category,
    description: business.description,
    phone: business.phone,
    email: business.email,
    website: business.website || "",
    address: business.address || "",
    hours_json: toJson(business.hours ?? null),
    logo_url: business.logoUrl || "",
    images_json: toJson(business.images ?? []),
    social_links_json: toJson(business.socialLinks ?? {}),
    featured: business.featured ? 1 : 0,
    cta_text: business.ctaText || "",
    tier: business.tier,
    owner_id: business.ownerId || "",
    created_at: business.createdAt,
    reviews_json: toJson(business.reviews ?? []),
    events_json: toJson(business.events ?? []),
    views_count: business.viewsCount || 0,
    votes_count: business.votesCount || 0,
    growth_credits_json: toJson(business.growthCredits ?? { shareClicks: 0, referralVisits: 0 }),
    is_unclaimed: business.isUnclaimed ? 1 : 0,
    is_registry_only: business.isRegistryOnly ? 1 : 0,
    email_verified: business.emailVerified === false ? 0 : 1,
    email_verified_at: business.emailVerifiedAt || "",
    owner_notifications_enabled: business.notificationsEnabled === false ? 0 : 1,
    owner_event_notifications_enabled: business.eventNotificationsEnabled === false ? 0 : 1
  };
}
function toBugParams(bug) {
  return {
    id: bug.id,
    title: bug.title,
    description: bug.description,
    category: bug.category,
    severity: bug.severity,
    email: bug.email,
    created_at: bug.createdAt,
    status: bug.status
  };
}
function createRepository(options = {}) {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!options.dbPath && databaseUrl) {
    return new PostgresRepository(databaseUrl);
  }
  return new CelinaRepository(options.dbPath);
}

// src/lib/categoryRoutes.ts
var CATEGORY_LANDING_PAGES = [
  {
    name: "Dining",
    slug: "dining",
    title: "Celina Restaurants & Dining | Celina Connection",
    description: "Find Celina, TX restaurants, bakeries, coffee shops, bars, barbecue, and local dining favorites on Celina Connection.",
    intro: "Browse Celina restaurants, bakeries, coffee shops, barbecue spots, bars, and other local dining favorites."
  },
  {
    name: "Shopping & Boutiques",
    slug: "shopping-boutiques",
    title: "Celina Shopping & Boutiques | Celina Connection",
    description: "Browse Celina, TX boutiques, gift shops, retail stores, apparel, home goods, and local shopping destinations.",
    intro: "Explore Celina boutiques, gift shops, apparel, home goods, retail stores, and local shopping destinations."
  },
  {
    name: "Health & Beauty",
    slug: "health-beauty",
    title: "Celina Health & Beauty Businesses | Celina Connection",
    description: "Find Celina, TX health, wellness, beauty, fitness, dental, barber, salon, and personal care businesses.",
    intro: "Find Celina health, wellness, beauty, fitness, dental, barber, salon, and personal care providers."
  },
  {
    name: "Automotive",
    slug: "automotive",
    title: "Celina Automotive Services | Celina Connection",
    description: "Find Celina, TX automotive repair, maintenance, detailing, tire, diesel, and vehicle service businesses.",
    intro: "Browse local Celina automotive repair, maintenance, detailing, tire, diesel, and vehicle service businesses."
  },
  {
    name: "Real Estate",
    slug: "real-estate",
    title: "Celina Real Estate Businesses | Celina Connection",
    description: "Find Celina, TX real estate agents, brokerages, property professionals, and local housing service providers.",
    intro: "Find Celina real estate agents, brokerages, property professionals, and housing service providers."
  },
  {
    name: "Insurance",
    slug: "insurance",
    title: "Celina Insurance Agencies | Celina Connection",
    description: "Find Celina, TX insurance agencies and local providers for home, auto, life, business, and specialty coverage.",
    intro: "Browse Celina insurance agencies and providers for home, auto, life, business, and specialty coverage."
  },
  {
    name: "Estate Planning",
    slug: "estate-planning",
    title: "Celina Estate Planning Services | Celina Connection",
    description: "Find Celina, TX estate planning professionals, legacy planning resources, trusts, wills, and family planning services.",
    intro: "Find Celina estate planning professionals, legacy planning resources, trusts, wills, and family planning services."
  },
  {
    name: "Financial Services",
    slug: "financial-services",
    title: "Celina Financial Services | Celina Connection",
    description: "Find Celina, TX financial advisors, wealth education, bookkeeping, tax, lending, and local money professionals.",
    intro: "Browse Celina financial advisors, wealth education, bookkeeping, tax, lending, and local money professionals."
  },
  {
    name: "Legal Services",
    slug: "legal-services",
    title: "Celina Legal Services | Celina Connection",
    description: "Find Celina, TX attorneys, legal service providers, business law, family law, estate law, and local legal resources.",
    intro: "Find Celina attorneys, legal service providers, business law, family law, estate law, and local legal resources."
  },
  {
    name: "Mortgage & Lending",
    slug: "mortgage-lending",
    title: "Celina Mortgage & Lending Services | Celina Connection",
    description: "Find Celina, TX mortgage lenders, loan officers, home financing specialists, and local lending resources.",
    intro: "Browse Celina mortgage lenders, loan officers, home financing specialists, and local lending resources."
  },
  {
    name: "Home Services",
    slug: "home-services",
    title: "Celina Home Services | Celina Connection",
    description: "Find Celina, TX contractors, plumbers, lawn care, cleaners, repair pros, and home service providers.",
    intro: "Find Celina contractors, plumbers, lawn care, cleaners, repair pros, and other home service providers."
  },
  {
    name: "Professional Services",
    slug: "professional-services",
    title: "Celina Professional Services | Celina Connection",
    description: "Find Celina, TX professional service providers including consultants, business services, marketing, finance, and operations support.",
    intro: "Browse Celina consultants, business services, marketing, finance, and operations support providers."
  },
  {
    name: "Home & Professional Services",
    slug: "home-professional-services",
    title: "Celina Home & Professional Services | Celina Connection",
    description: "Find Celina, TX home service providers, consultants, financial professionals, local service companies, and business support providers.",
    intro: "Find Celina home service providers, consultants, financial professionals, local service companies, and business support providers."
  },
  {
    name: "Activities & Community",
    slug: "activities-community",
    title: "Celina Activities & Community | Celina Connection",
    description: "Find Celina, TX activities, community businesses, local experiences, family destinations, and things to do.",
    intro: "Explore Celina activities, community businesses, local experiences, family destinations, and things to do."
  }
];
function categoryLandingForSlug(slug = "") {
  return CATEGORY_LANDING_PAGES.find((category) => category.slug === slug.toLowerCase()) || null;
}

// src/lib/seoMetadata.ts
var SITE_URL = "https://www.celinaconnection.com";
var DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/assets/social/business-owners-banner.jpg`;
var BRAND_LOGO_IMAGE = `${SITE_URL}/images/celina-connection-logo.png`;
var DEFAULT_TITLE = "Celina Connection | Celina TX Local Business Directory";
var DEFAULT_DESCRIPTION = "Find Celina, Texas restaurants, shops, services, events, and featured small businesses. Browse local favorites or claim a Celina business listing.";
var PUBLIC_PAGE_META = {
  home: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    h1: "Celina Connection local business directory",
    intro: "Celina Connection helps residents discover trusted local restaurants, shops, services, events, and small businesses in Celina, Texas.",
    schemaType: "CollectionPage"
  },
  directory: {
    title: "Celina Business Directory | Restaurants, Shops & Services",
    description: "Browse Celina, TX businesses by category, including dining, shopping, health, home services, professional services, and community favorites.",
    path: "/directory",
    h1: "Celina business directory",
    intro: "Search the Celina Connection directory for local businesses, service providers, restaurants, boutiques, and community resources.",
    schemaType: "CollectionPage"
  },
  events: {
    title: "Celina TX Events | Local Community Calendar",
    description: "Find local Celina, Texas events, community happenings, business events, and family-friendly activities through Celina Connection.",
    path: "/events",
    h1: "Celina local events",
    intro: "Explore community events and local happenings in Celina, Texas.",
    schemaType: "CollectionPage"
  },
  pricing: {
    title: "Claim Your Celina Business Listing | Celina Connection Plans",
    description: "Compare paid Basic, Pro, and Premium Celina Connection listing options for local businesses in Celina, Texas.",
    path: "/pricing",
    h1: "Celina Connection listing plans",
    intro: "New business listings require a paid Basic, Pro, or Premium plan and confirmed payment.",
    schemaType: "WebPage"
  },
  launch: {
    title: "Celina Connection | Paid Business Listings",
    description: "Choose a paid Celina Connection listing for your local business in Celina, Texas. Plans start at $6 per month or $60 per year.",
    path: "/launch",
    h1: "Celina Connection launch",
    intro: "The launch campaign helps the first Celina business owners claim a local directory presence and reach nearby customers.",
    schemaType: "WebPage"
  },
  legacyhillspetition: {
    title: "Legacy Hills Community Petition | Celina Connection",
    description: "Sign the Legacy Hills community petition and receive neighbor updates through Celina Connection.",
    path: "/legacyhillspetition",
    h1: "Legacy Hills community petition",
    intro: "Celina Connection is collecting Legacy Hills neighbor signatures so residents can be counted together and contacted with petition updates.",
    schemaType: "WebPage"
  }
};
var PRIVATE_PAGE_META = {
  dashboard: {
    title: "Add or Claim a Celina Business Listing | Celina Connection",
    description: "Create a paid Celina Connection listing, update business details, and help local customers find your Celina, TX business.",
    path: "/dashboard",
    h1: "Add or claim a Celina business listing",
    intro: "Business owners can sign in, claim listings, and manage local business profiles.",
    schemaType: "WebPage"
  },
  "owner-login": {
    title: "Business Owner Login | Celina Connection",
    description: "Sign in to manage your Celina Connection business listing, reviews, photos, hours, and listing plan.",
    path: "/owner-login",
    h1: "Business owner login",
    intro: "Sign in to manage your Celina Connection business listing.",
    schemaType: "WebPage"
  },
  "admin-login": {
    title: "Admin Login | Celina Connection",
    description: "Administrative access for Celina Connection listing management.",
    path: "/admin-login",
    h1: "Admin login",
    intro: "Administrative access for Celina Connection listing management.",
    schemaType: "WebPage"
  }
};
var PAGE_META = {
  ...PUBLIC_PAGE_META,
  ...PRIVATE_PAGE_META
};
var DIRECTORY_FAQ = [
  {
    question: "Where can I find local businesses in Celina, Texas?",
    answer: "Use Celina Connection to browse restaurants, shops, service providers, health and beauty businesses, activities, and featured community businesses in Celina, TX."
  },
  {
    question: "How can a Celina business claim a listing?",
    answer: "Business owners can register, verify their email, and activate a listing with a paid Basic, Pro, or Premium plan."
  },
  {
    question: "What types of businesses are listed?",
    answer: "The directory includes dining, shopping, boutiques, home services, professional services, financial services, legal services, real estate, wellness, and community categories."
  }
];
var PRICING_FAQ = [
  {
    question: "Is a paid plan required for a new listing?",
    answer: "Yes. All new listings require a paid plan. Basic starts at $6 per month or $60 per year. Your listing is published only after email verification and confirmed payment."
  },
  {
    question: "Which paid plan adds a website link and hours?",
    answer: "Local Pioneer Basic adds a website link and hours of operation while keeping the listing at the standard directory placement level."
  },
  {
    question: "Which plan is best for more visibility?",
    answer: "Celina Champion Pro and Preston Elite Premium are built for businesses that want stronger placement, galleries, review tools, and featured visibility."
  }
];
function publicPagePath(page) {
  return PUBLIC_PAGE_META[page].path === "/" ? SITE_URL : `${SITE_URL}${PUBLIC_PAGE_META[page].path}`;
}
function isPublicPageKey(value) {
  return value in PUBLIC_PAGE_META;
}

// server/app.ts
dotenv.config({ path: [".env.local", ".env"] });
var stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required for real payments.");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2025-01-27.acacia"
    });
  }
  return stripeClient;
}
var geminiApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
var geminiChatModel = () => process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite";
var geminiSearchModel = () => process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite";
var googlePlacesApiKey = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
var publicBusinessCategories = CATEGORIES.filter((category) => category !== "All");
var aiClient = null;
function getGemini() {
  if (!aiClient) {
    const key = geminiApiKey();
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI features.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function generateContentWithFallback(ai, params) {
  try {
    return await ai.models.generateContent(params);
  } catch (error) {
    console.warn(`Primary model ${params.model} invocation failed. Attempting fallback... Error:`, error.message || error);
    const errMsg = String(error.message || error || "");
    const isSearchError = errMsg.includes("googleSearch") || errMsg.includes("grounding");
    const isOverloadOrQuota = error.status === 503 || error.status === 429 || errMsg.includes("quota") || errMsg.includes("demand") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("UNAVAILABLE") || errMsg.includes("limit") || errMsg.includes("exhausted");
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
          config: fallbackConfig
        });
      } catch (fallbackErr) {
        console.error("Fallback model failed as well:", fallbackErr.message || fallbackErr);
        throw fallbackErr;
      }
    }
    throw error;
  }
}
var normalizeWebsiteUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};
var decodeHtmlEntities = (value) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, " ");
var cleanPageText = (value, maxLength = 6e3) => decodeHtmlEntities(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
var htmlAttribute = (html, pattern) => {
  const match = html.match(pattern);
  return decodeHtmlEntities(match?.[1] || "").trim();
};
var extractWebsiteSignals = (html, websiteUrl) => {
  const title = htmlAttribute(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = htmlAttribute(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i) || htmlAttribute(html, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i);
  const ogImage = htmlAttribute(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) || htmlAttribute(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  const phone = htmlAttribute(html, /href=["']tel:([^"']+)["']/i) || htmlAttribute(cleanPageText(html), /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  const email = htmlAttribute(html, /href=["']mailto:([^"'?]+)[^"']*["']/i) || htmlAttribute(cleanPageText(html), /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
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
    pageText: cleanPageText(html)
  };
};
var categoryFromPlaceTypes = (types = []) => {
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
var fetchGooglePlaceSignals = async (businessName) => {
  const apiKey = googlePlacesApiKey();
  if (!apiKey) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.types,places.rating,places.userRatingCount"
    },
    body: JSON.stringify({
      textQuery: `${businessName} Celina TX`,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: 33.3246, longitude: -96.7844 },
          radius: 2e4
        }
      }
    }),
    signal: AbortSignal.timeout(8e3)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Places lookup failed: ${response.status} ${body}`.trim());
  }
  const json = await response.json().catch(() => ({}));
  const place = json?.places?.[0];
  if (!place) return null;
  return {
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    website: place.websiteUri || "",
    category: categoryFromPlaceTypes([place.primaryType, ...place.types || []].filter(Boolean)),
    rating: place.rating,
    reviewCount: place.userRatingCount,
    types: [place.primaryType, ...place.types || []].filter(Boolean)
  };
};
function createApp(options = {}) {
  const app = express();
  let repository;
  try {
    repository = options.repository || createRepository(options);
  } catch (err) {
    if (options.repository || process.env.NODE_ENV === "production") throw err;
    console.error("Repository initialization failed, falling back to memory repository:", err);
    repository = new CelinaRepository(":memory:");
  }
  let publicDirectory;
  let publicDirectoryExpires = 0;
  let publicDirectoryGeneration = 0;
  let publicDirectoryPending;
  const readPublicDirectory = async () => {
    if (publicDirectory && Date.now() < publicDirectoryExpires) return publicDirectory;
    if (!publicDirectoryPending) {
      const generation = publicDirectoryGeneration;
      publicDirectoryPending = Promise.resolve().then(() => repository.listPublicBusinesses()).then((businesses) => {
        if (generation === publicDirectoryGeneration) {
          publicDirectory = businesses;
          publicDirectoryExpires = Date.now() + 6e4;
        }
        return businesses;
      }).finally(() => {
        publicDirectoryPending = void 0;
      });
    }
    return publicDirectoryPending;
  };
  app.use("/api", (req2, res, next) => {
    if (/^\/(admin|owner)(\/|$)/.test(req2.path)) res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req2.method) || req2.path === "/owner/verify-email") {
      res.setHeader("Cache-Control", "no-store");
      res.on("finish", () => {
        if (res.statusCode < 400) {
          publicDirectoryGeneration++;
          publicDirectory = void 0;
          publicDirectoryExpires = 0;
        }
      });
    }
    next();
  });
  const applyPaidMembership = async ({
    tier,
    businessId,
    ownerId,
    addonQuantity = 0
  }) => {
    if (tier !== "basic" && tier !== "pro" && tier !== "premium") {
      throw new Error("Unsupported paid membership tier.");
    }
    const businesses = await repository.listBusinesses();
    const ownedBusinesses = businesses.filter(
      (business) => businessId && business.id === businessId || ownerId && business.ownerId === ownerId
    );
    if (ownedBusinesses.length === 0) {
      throw new Error("No matching business found for paid membership fulfillment.");
    }
    const targetBusiness = ownedBusinesses.find((business) => business.id === businessId) || ownedBusinesses[0];
    const additionalBusinesses = ownedBusinesses.filter((business) => business.id !== targetBusiness.id).slice(0, Math.max(0, addonQuantity));
    const coveredIds = /* @__PURE__ */ new Set([targetBusiness.id, ...additionalBusinesses.map((business) => business.id)]);
    const updated = await Promise.all(ownedBusinesses.filter((business) => coveredIds.has(business.id)).map(
      (business) => repository.updateBusiness(business.id, { tier, featured: tier === "premium" })
    ));
    return updated.filter(Boolean);
  };
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req2, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: "Stripe webhook handling is not configured." });
    }
    const signature = req2.header("stripe-signature");
    if (!signature) {
      return res.status(400).json({ error: "Stripe signature is required." });
    }
    let event;
    try {
      event = getStripe().webhooks.constructEvent(req2.body, signature, webhookSecret);
    } catch (error) {
      console.error("Stripe webhook signature verification failed.");
      return res.status(400).json({ error: "Invalid Stripe webhook signature." });
    }
    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object;
        if (session.mode === "subscription" && session.payment_status === "paid" && Number(session.amount_total) > 0) {
          const metadata = session.metadata || {};
          await applyPaidMembership({
            tier: metadata.tier || "",
            businessId: metadata.businessId || void 0,
            ownerId: metadata.userId || void 0,
            addonQuantity: Number(metadata.addonQuantity || 0)
          });
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          const metadata = session.metadata || {};
          if (metadata.purchaseType === "event_promotion" && metadata.businessId && metadata.eventId) {
            const business = await repository.getBusiness(metadata.businessId);
            if (business) {
              const now = (/* @__PURE__ */ new Date()).toISOString();
              const nextEvents = (business.events || []).map((listingEvent) => {
                if (listingEvent.id !== metadata.eventId) return listingEvent;
                if (eventHasExpired(listingEvent) || eventDateIsTooFarAway(String(listingEvent.eventDate || ""))) {
                  return { ...listingEvent, status: "expired", updatedAt: now };
                }
                return { ...listingEvent, promotionPaid: true, paidAt: listingEvent.paidAt || now, status: "active", expiresAt: listingEvent.eventDate ? eventDateEndIso(listingEvent.eventDate) : listingEvent.expiresAt, updatedAt: now };
              });
              await repository.updateBusiness(business.id, { events: nextEvents });
              const promotedEvent = nextEvents.find((listingEvent) => listingEvent.id === metadata.eventId && listingEvent.promotionPaid);
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
  const sessionMaxAgeMs = sessionMaxAgeSeconds * 1e3;
  const getCookie = (req2, name) => {
    const cookies = req2.header("cookie") || "";
    const pair = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
  };
  const adminSessionSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "celina-admin-session-secret-fallback";
  const makeAdminSession = () => {
    const secret = adminSessionSecret();
    const issuedAt = Date.now().toString();
    const nonce = crypto2.randomBytes(16).toString("hex");
    const payload = `${issuedAt}.${nonce}`;
    const signature = crypto2.createHmac("sha256", secret).update(payload).digest("hex");
    return `${payload}.${signature}`;
  };
  const isValidAdminSession = (req2) => {
    try {
      const secret = adminSessionSecret();
      const session = getCookie(req2, adminCookieName);
      if (!session) return false;
      const parts = session.split(".");
      if (parts.length !== 3) return false;
      const [issuedAt, nonce, signature] = parts;
      if (!issuedAt || !nonce || !signature) return false;
      const ageMs = Date.now() - Number(issuedAt);
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > sessionMaxAgeMs) return false;
      const expected = crypto2.createHmac("sha256", secret).update(`${issuedAt}.${nonce}`).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      return sigBuf.length === expBuf.length && crypto2.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  };
  const ownerSessionSecret = () => process.env.OWNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN || "celina-owner-dev-session-secret";
  const hashPassword = (password) => {
    const salt = crypto2.randomBytes(16).toString("hex");
    const hash = crypto2.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  };
  const verifyPassword = (password, stored = "") => {
    try {
      if (!stored) return false;
      const [salt, hash] = stored.split(":");
      if (!salt || !hash) return false;
      const candidate = crypto2.scryptSync(password, salt, 64).toString("hex");
      const hashBuf = Buffer.from(hash);
      const candBuf = Buffer.from(candidate);
      return hashBuf.length === candBuf.length && crypto2.timingSafeEqual(hashBuf, candBuf);
    } catch {
      return false;
    }
  };
  const createEmailVerification = () => {
    const token = crypto2.randomBytes(32).toString("hex");
    return {
      token,
      tokenHash: crypto2.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 1e3 * 60 * 60 * 24).toISOString()
    };
  };
  const createPasswordReset = () => {
    const token = crypto2.randomBytes(32).toString("hex");
    return {
      token,
      tokenHash: crypto2.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 1e3 * 60 * 60).toISOString()
    };
  };
  const verificationUrlFor = (token) => `${(process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  const passwordResetUrlFor = (token) => `${(process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const publicSiteUrl = () => (process.env.PUBLIC_SITE_URL || "https://www.celinaconnection.com").replace(/\/$/, "");
  const emailHtmlEscape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ownerVerificationEmail = (business, verificationUrl) => {
    const details = [
      ["Business", business.name],
      ["Category", business.category],
      ["Phone", business.phone],
      ["Address", business.address || "Not provided yet"],
      ["Starting plan", business.tier || "free"],
      ["Profile image", business.logoUrl ? "Received" : "Needed"],
      ["Banner image", Array.isArray(business.images) && business.images.length > 0 ? "Received" : "Needed"]
    ];
    const rows = details.map(([label, value]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;">${emailHtmlEscape(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${emailHtmlEscape(value)}</td></tr>`).join("");
    const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
    return {
      subject: "Welcome to Celina Connection",
      html: `<p>Welcome to Celina Connection, and thank you for adding ${emailHtmlEscape(business.name)} to the local directory.</p><p>Please verify your email to activate your owner login. This keeps listings safer for local business owners and Celina neighbors.</p><p><a href="${emailHtmlEscape(verificationUrl)}">Verify my email</a></p><p>This link expires in 24 hours.</p><p><strong>Your submitted listing details:</strong></p><table style="border-collapse:collapse;width:100%;max-width:680px;">${rows}</table><p><strong>What happens next:</strong><br />After verification, you can sign in to update your profile, manage photos, add events, and choose a paid plan when you are ready for more visibility.</p><p>If anything looks off, reply to this email and the Celina Connection team will help.</p>`,
      text: `Welcome to Celina Connection, and thank you for adding ${business.name} to the local directory.

Please verify your email to activate your owner login: ${verificationUrl}

This link expires in 24 hours.

Your submitted listing details:
${textDetails}

What happens next:
After verification, you can sign in to update your profile, manage photos, add events, and choose a paid plan when you are ready for more visibility.

If anything looks off, reply to this email and the Celina Connection team will help.`
    };
  };
  const newOwnerAdminNotificationEmail = (business) => {
    const submittedAt = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Chicago" });
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
      ["Banner image", Array.isArray(business.images) && business.images.length > 0 ? "Provided" : "Missing"]
    ];
    const rows = details.map(([label, value]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;">${emailHtmlEscape(label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${emailHtmlEscape(value)}</td></tr>`).join("");
    const textDetails = details.map(([label, value]) => `${label}: ${value}`).join("\n");
    return {
      subject: `New Celina Connection user: ${business.name}`,
      html: `<p>A new business owner registered on Celina Connection and is waiting on email verification.</p><table style="border-collapse:collapse;width:100%;max-width:680px;">${rows}</table><p><strong>Description:</strong><br />${emailHtmlEscape(business.description || "Not provided")}</p><p><strong>Suggested review:</strong><br />Confirm the business is Celina-area relevant, review the submitted profile and banner images, check the category, then approve or follow up from the admin dashboard.</p><p><a href="${emailHtmlEscape(adminUrl)}">Open Celina Connection admin</a></p>`,
      text: `A new business owner registered on Celina Connection and is waiting on email verification.

${textDetails}

Description: ${business.description || "Not provided"}

Suggested review: Confirm the business is Celina-area relevant, review the submitted profile and banner images, check the category, then approve or follow up from the admin dashboard.

Open admin: ${adminUrl}`
    };
  };
  const ownerPasswordResetEmail = (businessName, resetUrl) => ({
    subject: "Reset your Celina Connection password",
    html: `<p>We received a password reset request for ${businessName}.</p><p>Click below to choose a new owner password:</p><p><a href="${resetUrl}">Reset my password</a></p><p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
    text: `We received a password reset request for ${businessName}.

Choose a new owner password: ${resetUrl}

This link expires in 1 hour. If you did not request it, you can ignore this email.`
  });
  const emailDeliveryTimeoutMs = () => Math.max(500, Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS || 8e3));
  const petitionDatabaseTimeoutMs = () => Math.max(500, Number(process.env.PETITION_DATABASE_TIMEOUT_MS || 3500));
  const withPetitionDatabaseTimeout = async (operation) => Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Petition database operation timed out after ${petitionDatabaseTimeoutMs()}ms.`)), petitionDatabaseTimeoutMs());
    })
  ]);
  const fetchWithEmailTimeout = (url, init) => fetch(url, {
    ...init,
    signal: AbortSignal.timeout(emailDeliveryTimeoutMs())
  });
  const parseGhlTags = () => (process.env.GHL_WELCOME_TAGS || "celina-connection,owner-registration").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlAdminNotificationTags = () => (process.env.GHL_ADMIN_NOTIFICATION_TAGS || "celina-connection,admin-notification,new-owner-registration").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlPasswordResetTags = () => (process.env.GHL_PASSWORD_RESET_TAGS || "celina-connection,password-reset").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlMissingImagesTags = () => (process.env.GHL_MISSING_IMAGES_TAGS || "celina-connection,missing-listing-images,72-hour-image-notice").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlClaimRequestTags = () => (process.env.GHL_CLAIM_REQUEST_TAGS || "celina-connection,admin-notification,claim-request").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlPetitionNotificationTags = () => (process.env.GHL_PETITION_NOTIFICATION_TAGS || "celina-connection,admin-notification,petition-signature").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlEventPromotionTags = () => (process.env.GHL_EVENT_PROMOTION_TAGS || "celina-connection,event-promotion,payment-received").split(",").map((tag) => tag.trim()).filter(Boolean);
  const parseGhlOwnerEngagementTags = () => (process.env.GHL_OWNER_ENGAGEMENT_TAGS || "celina-connection,owner-engagement").split(",").map((tag) => tag.trim()).filter(Boolean);
  const isDeliverableOwnerEmail = (email) => {
    const value = String(email || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith("@example.com");
  };
  const sendOwnerEngagementNotification = async (business, action) => {
    if (!business?.notificationsEnabled || !isDeliverableOwnerEmail(business.email)) return;
    const actionLabel = action === "like" ? "liked your listing" : "shared your listing";
    const listingUrl = `${publicSiteUrl()}/business/${business.slug || business.id}`;
    const message = {
      subject: `${business.name} just got a little more love on Celina Connection`,
      html: `<p>Great news \u2014 someone just <strong>${actionLabel}</strong> on Celina Connection.</p><p>Keep the momentum going by adding fresh photos, replying to reviews, and sharing your referral link.</p><p><a href="${emailHtmlEscape(listingUrl)}">View your listing</a> &nbsp; <a href="${emailHtmlEscape(`${publicSiteUrl()}/owner-login`)}">Open owner dashboard</a></p>`,
      text: `Great news \u2014 someone just ${actionLabel} on Celina Connection.

View your listing: ${listingUrl}
Open your owner dashboard: ${publicSiteUrl()}/owner-login`
    };
    await sendOwnerEmailMessage(String(business.email), String(business.name || "Celina business"), message, `owner-${action}`, listingUrl, parseGhlOwnerEngagementTags());
  };
  const adminNotificationEmail = () => String(process.env.CELINA_ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || "info@celinaconnection.com").trim();
  const missingListingVisualsEmail = (business, deadline) => {
    const deadlineLabel = deadline.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
    const dashboardUrl = `${publicSiteUrl()}/dashboard`;
    const missingItems = [
      !String(business.logoUrl || "").trim() ? "profile image" : "",
      !Array.isArray(business.images) || !business.images.some((image) => String(image || "").trim()) ? "banner image" : ""
    ].filter(Boolean);
    const missingText = missingItems.length ? missingItems.join(" and ") : "required listing images";
    return {
      subject: "Action needed: add photos to keep your Celina Connection listing visible",
      html: `<p>Hi ${emailHtmlEscape(business.name || "there")},</p><p>We are getting Celina Connection ready for local launch, and every active listing needs both a profile image and a banner image so neighbors can recognize the business at a glance.</p><p>Your listing is currently missing: <strong>${emailHtmlEscape(missingText)}</strong>.</p><p>Please sign in and add the missing image${missingItems.length === 1 ? "" : "s"} by <strong>${emailHtmlEscape(deadlineLabel)}</strong>. Listings without the required visuals may be hidden until the photos are added.</p><p><a href="${emailHtmlEscape(dashboardUrl)}">Update my listing</a></p><p>Need help choosing a photo? Reply to this email and the Celina Connection team can point you in the right direction.</p>`,
      text: `Hi ${business.name || "there"},

We are getting Celina Connection ready for local launch, and every active listing needs both a profile image and a banner image so neighbors can recognize the business at a glance.

Your listing is currently missing: ${missingText}.

Please sign in and add the missing image${missingItems.length === 1 ? "" : "s"} by ${deadlineLabel}. Listings without the required visuals may be hidden until the photos are added.

Update your listing: ${dashboardUrl}

Need help choosing a photo? Reply to this email and the Celina Connection team can point you in the right direction.`
    };
  };
  const sendEmailViaGhl = async (email, businessName, message, tags = parseGhlTags()) => {
    const apiKey = process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID;
    if (!apiKey || !locationId) return false;
    const baseUrl = (process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com").replace(/\/$/, "");
    const headers = {
      authorization: `Bearer ${apiKey}`,
      version: process.env.GHL_API_VERSION || "2021-07-28",
      "content-type": "application/json",
      accept: "application/json"
    };
    const upsertResponse = await fetchWithEmailTimeout(`${baseUrl}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        email,
        name: businessName,
        tags,
        source: "Celina Connection"
      })
    });
    if (!upsertResponse.ok) {
      const body = await upsertResponse.text().catch(() => "");
      throw new Error(`contact upsert failed: ${upsertResponse.status} ${body}`.trim());
    }
    const upsertJson = await upsertResponse.json().catch(() => ({}));
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
        message: message.text
      })
    });
    if (!sendResponse.ok) {
      const body = await sendResponse.text().catch(() => "");
      throw new Error(`email send failed: ${sendResponse.status} ${body}`.trim());
    }
    return true;
  };
  const sendOwnerEmailMessage = async (email, businessName, message, logLabel, fallbackUrl, ghlTags = parseGhlTags()) => {
    const deliveryErrors = [];
    let hasConfiguredProvider = false;
    const hasGhlConfig = !!((process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY) && (process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID));
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
            accept: "application/json"
          },
          body: JSON.stringify({
            sender: { name: brevoSenderName, email: brevoSenderEmail },
            to: [{ email }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text
          })
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
            pass: smtpPass
          },
          connectionTimeout: emailDeliveryTimeoutMs(),
          socketTimeout: emailDeliveryTimeoutMs(),
          greetingTimeout: emailDeliveryTimeoutMs()
        });
        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          ...message
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
            "content-type": "application/json"
          },
          body: JSON.stringify({
            from,
            to: [email],
            ...message
          })
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
  const sendOwnerVerificationEmail = async (email, business, verificationUrl) => {
    await sendOwnerEmailMessage(email, String(business.name || "New listing"), ownerVerificationEmail(business, verificationUrl), "email-verification", verificationUrl);
  };
  const sendOwnerPasswordResetEmail = async (email, businessName, resetUrl) => {
    await sendOwnerEmailMessage(email, businessName, ownerPasswordResetEmail(businessName, resetUrl), "password-reset", resetUrl, parseGhlPasswordResetTags());
  };
  const sendAdminNewOwnerNotification = async (business) => {
    const hasGhlConfig = !!((process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY) && (process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID));
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
      parseGhlAdminNotificationTags()
    );
  };
  const sendMissingListingVisualsNotification = async (business, deadline) => {
    await sendEmailViaGhl(String(business.email), String(business.name || "Celina business"), missingListingVisualsEmail(business, deadline), parseGhlMissingImagesTags());
  };
  const sendAdminClaimRequestNotification = async (claim, business) => {
    const adminEmail = adminNotificationEmail();
    if (!adminEmail) return;
    const adminUrl = `${publicSiteUrl()}/admin-login`;
    const businessName = business?.name || claim.businessId || "Unknown listing";
    const message = {
      subject: `New listing claim request: ${businessName}`,
      html: `<p>A business owner requested access to a Celina Connection listing.</p><p><strong>Business:</strong> ${emailHtmlEscape(businessName)}<br /><strong>Requester:</strong> ${emailHtmlEscape(claim.requesterName)}<br /><strong>Email:</strong> ${emailHtmlEscape(claim.requesterEmail)}<br /><strong>Phone:</strong> ${emailHtmlEscape(claim.requesterPhone)}<br /><strong>Role:</strong> ${emailHtmlEscape(claim.role)}</p><p><strong>Notes:</strong><br />${emailHtmlEscape(claim.notes || "No notes provided.")}</p><p><a href="${emailHtmlEscape(adminUrl)}">Review this claim in admin</a></p>`,
      text: `A business owner requested access to a Celina Connection listing.

Business: ${businessName}
Requester: ${claim.requesterName}
Email: ${claim.requesterEmail}
Phone: ${claim.requesterPhone}
Role: ${claim.role}

Notes: ${claim.notes || "No notes provided."}

Review this claim in admin: ${adminUrl}`
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", message, parseGhlClaimRequestTags());
  };
  const sendAdminPetitionSignatureNotification = async (signature) => {
    const adminEmail = adminNotificationEmail();
    if (!adminEmail) return;
    const adminUrl = `${publicSiteUrl()}/admin-login`;
    const message = {
      subject: `New Legacy Hills petition signature: ${signature.firstName} ${signature.lastName}`,
      html: `<p>A new Legacy Hills petition signature was submitted through Celina Connection.</p><p><strong>Name:</strong> ${emailHtmlEscape(`${signature.firstName} ${signature.lastName}`)}<br /><strong>Email:</strong> ${emailHtmlEscape(signature.email)}<br /><strong>Phone:</strong> ${emailHtmlEscape(signature.phone)}<br /><strong>Address:</strong> ${emailHtmlEscape(signature.streetAddress)}<br /><strong>Community:</strong> ${emailHtmlEscape(signature.neighborhood || "Legacy Hills")}</p><p><strong>Comments:</strong><br />${emailHtmlEscape(signature.comments || "No comments provided.")}</p><p><a href="${emailHtmlEscape(adminUrl)}">Open petition signatures</a></p>`,
      text: `A new Legacy Hills petition signature was submitted through Celina Connection.

Name: ${signature.firstName} ${signature.lastName}
Email: ${signature.email}
Phone: ${signature.phone}
Address: ${signature.streetAddress}
Community: ${signature.neighborhood || "Legacy Hills"}

Comments: ${signature.comments || "No comments provided."}

Open petition signatures: ${adminUrl}`
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", message, parseGhlPetitionNotificationTags());
  };
  const sendEventPromotionNotifications = async (business, event, ownerEmail) => {
    const adminEmail = adminNotificationEmail();
    const eventName = event?.title || event?.name || "Local event";
    const eventDate = event?.eventDate || event?.date || "Date not provided";
    const ownerMessage = {
      subject: `Event promotion received: ${eventName}`,
      html: `<p>We received your Celina Connection event promotion for <strong>${emailHtmlEscape(eventName)}</strong>.</p><p>The team will review the event details before it appears publicly. Event promotions expire after the event date.</p><p><strong>Business:</strong> ${emailHtmlEscape(business?.name || "Your business")}<br /><strong>Event date:</strong> ${emailHtmlEscape(eventDate)}</p>`,
      text: `We received your Celina Connection event promotion for ${eventName}.

The team will review the event details before it appears publicly. Event promotions expire after the event date.

Business: ${business?.name || "Your business"}
Event date: ${eventDate}`
    };
    await sendEmailViaGhl(ownerEmail, String(business?.name || "Celina business"), ownerMessage, parseGhlEventPromotionTags());
    if (!adminEmail) return;
    const adminMessage = {
      subject: `Event promotion purchase: ${eventName}`,
      html: `<p>A paid event promotion was received on Celina Connection.</p><p><strong>Business:</strong> ${emailHtmlEscape(business?.name || "Unknown business")}<br /><strong>Owner email:</strong> ${emailHtmlEscape(ownerEmail)}<br /><strong>Event:</strong> ${emailHtmlEscape(eventName)}<br /><strong>Event date:</strong> ${emailHtmlEscape(eventDate)}</p><p><a href="${emailHtmlEscape(`${publicSiteUrl()}/admin-login`)}">Open Celina Connection admin</a></p>`,
      text: `A paid event promotion was received on Celina Connection.

Business: ${business?.name || "Unknown business"}
Owner email: ${ownerEmail}
Event: ${eventName}
Event date: ${eventDate}

Open admin: ${publicSiteUrl()}/admin-login`
    };
    await sendEmailViaGhl(adminEmail, "Celina Connection Admin", adminMessage, parseGhlEventPromotionTags());
  };
  const ownerVerificationResponse = (business, verificationUrl) => {
    const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = business;
    return {
      business: safeBusiness,
      requiresEmailVerification: true,
      message: "Verify your email, then sign in and complete paid checkout to publish your listing.",
      ...process.env.CELINA_EXPOSE_VERIFICATION_LINK === "true" ? { verificationUrl } : {}
    };
  };
  const verificationResends = /* @__PURE__ */ new Map();
  const checkVerificationResendLimit = (req2, email) => {
    const now = Date.now();
    const key = `${req2.ip}:${email.toLowerCase()}`;
    const attempts = (verificationResends.get(key) || []).filter((ts) => now - ts < 1e3 * 60 * 15);
    attempts.push(now);
    verificationResends.set(key, attempts);
    return attempts.length <= 3;
  };
  const passwordResetRequests = /* @__PURE__ */ new Map();
  const checkPasswordResetLimit = (req2, email) => {
    const now = Date.now();
    const key = `${req2.ip}:${email.toLowerCase()}`;
    const attempts = (passwordResetRequests.get(key) || []).filter((ts) => now - ts < 1e3 * 60 * 15);
    attempts.push(now);
    passwordResetRequests.set(key, attempts);
    return attempts.length <= 3;
  };
  const makeOwnerSession = (ownerId) => {
    const issuedAt = Date.now().toString();
    const nonce = crypto2.randomBytes(16).toString("hex");
    const payload = `${ownerId}.${issuedAt}.${nonce}`;
    const signature = crypto2.createHmac("sha256", ownerSessionSecret()).update(payload).digest("hex");
    return `${payload}.${signature}`;
  };
  const readOwnerSession = (req2) => {
    const session = getCookie(req2, ownerCookieName);
    const [ownerId, issuedAt, nonce, signature] = session.split(".");
    if (!ownerId || !issuedAt || !nonce || !signature) return "";
    const ageMs = Date.now() - Number(issuedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > sessionMaxAgeMs) return "";
    const expected = crypto2.createHmac("sha256", ownerSessionSecret()).update(`${ownerId}.${issuedAt}.${nonce}`).digest("hex");
    if (signature.length !== expected.length || !crypto2.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "";
    return ownerId;
  };
  const ownerCookie = (session) => `${ownerCookieName}=${encodeURIComponent(session)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  const makeCurrentUser = (business) => business ? {
    id: business.ownerId,
    email: business.email,
    businessName: business.name,
    businessId: business.id,
    tier: business.tier,
    isLoggedIn: true,
    role: "owner"
  } : null;
  const imageLimitForTier = (tier) => tier === "pending" || tier === "free" || tier === "basic" ? 1 : tier === "pro" ? 5 : 10;
  const eventPromotionWindowDays = 30;
  const dateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const eventDateEndIso = (eventDate) => (/* @__PURE__ */ new Date(`${eventDate}T23:59:59`)).toISOString();
  const eventDateIsPast = (eventDate) => Boolean(eventDate) && (/* @__PURE__ */ new Date(`${eventDate}T23:59:59`)).getTime() < Date.now();
  const maxEventPromotionDateInputValue = () => {
    const maxDate = /* @__PURE__ */ new Date();
    maxDate.setDate(maxDate.getDate() + eventPromotionWindowDays);
    return dateInputValue(maxDate);
  };
  const eventDateIsTooFarAway = (eventDate) => Boolean(eventDate) && (/* @__PURE__ */ new Date(`${eventDate}T00:00:00`)).getTime() > (/* @__PURE__ */ new Date(`${maxEventPromotionDateInputValue()}T23:59:59`)).getTime();
  const eventHasExpired = (event) => {
    if (event?.status === "expired") return true;
    if (event?.eventDate) return eventDateIsPast(String(event.eventDate));
    return Boolean(event?.expiresAt && new Date(event.expiresAt).getTime() < Date.now());
  };
  const normalizeListingEvents = (incoming, existingEvents = [], isAdmin = false) => {
    if (!Array.isArray(incoming)) return void 0;
    const existingById = new Map(existingEvents.map((event) => [String(event.id), event]));
    const now = Date.now();
    return incoming.slice(0, 20).map((event) => {
      const id = String(event?.id || `event-${crypto2.randomBytes(8).toString("hex")}`);
      const existing = existingById.get(id) || {};
      const existingExpired = eventHasExpired(existing);
      if (!isAdmin && existingExpired) return existing;
      const eventDate = String(event?.eventDate || "").trim();
      if (eventDate && eventDateIsTooFarAway(eventDate)) {
        throw new Error("Event promotions can only be scheduled up to 30 days before the event date.");
      }
      const expiresAt = eventDate ? eventDateEndIso(eventDate) : String(existing.expiresAt || new Date(now + 30 * 24 * 60 * 60 * 1e3).toISOString());
      const paid = isAdmin ? Boolean(event?.promotionPaid) : Boolean(existing.promotionPaid);
      const paidAt = isAdmin ? String(event?.paidAt || existing.paidAt || "") : String(existing.paidAt || "");
      const requestedStatus = String(event?.status || existing.status || "draft");
      const status = eventDateIsPast(eventDate) || new Date(expiresAt).getTime() < now ? "expired" : isAdmin ? ["draft", "active", "expired"].includes(requestedStatus) ? requestedStatus : "draft" : paid ? "active" : "draft";
      return {
        id,
        title: String(event?.title || "").trim().slice(0, 120),
        description: String(event?.description || "").trim().slice(0, 800),
        eventDate,
        eventTime: String(event?.eventTime || "").trim().slice(0, 80),
        location: String(event?.location || "").trim().slice(0, 160),
        status,
        promotionPaid: paid,
        paidAt,
        expiresAt,
        createdAt: String(existing.createdAt || event?.createdAt || (/* @__PURE__ */ new Date()).toISOString()),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
  };
  const sanitizeOwnerBusinessUpdates = (tier, updates, currentBusiness) => {
    const allowed = {};
    for (const key of ["name", "description", "phone", "email", "category", "address", "logoUrl", "reviews"]) {
      if (updates[key] !== void 0) allowed[key] = updates[key];
    }
    const events = normalizeListingEvents(updates.events, currentBusiness?.events || [], false);
    if (events) allowed.events = events;
    if (Array.isArray(updates.images)) {
      allowed.images = updates.images.slice(0, imageLimitForTier(tier));
    }
    if (tier === "basic" || tier === "pro" || tier === "premium") {
      if (updates.website !== void 0) allowed.website = updates.website;
      if (updates.hours !== void 0) allowed.hours = updates.hours;
    }
    if (tier === "premium") {
      if (updates.ctaText !== void 0) allowed.ctaText = updates.ctaText;
      if (updates.socialLinks !== void 0) allowed.socialLinks = updates.socialLinks;
    }
    return allowed;
  };
  const hasRequiredListingVisuals = (business) => Boolean(String(business.logoUrl || "").trim()) && Array.isArray(business.images) && business.images.some((image) => Boolean(String(image || "").trim()));
  const listingVisualsRequiredMessage = "A profile image and banner image are required before a listing can be approved.";
  const stripAdminOwnerAccountFields = (updates) => {
    const { ownerPassword, ownerEmail, ownerAccountEmail, assignOwnerEmail, ...businessUpdates } = updates || {};
    return businessUpdates;
  };
  const resolveOwnerEmail = (body, fallback = "") => String(body?.ownerEmail || body?.ownerAccountEmail || body?.assignOwnerEmail || body?.email || fallback || "").trim().toLowerCase();
  const recentRegistrationAttempts = /* @__PURE__ */ new Map();
  const checkRegistrationRateLimit = (req2, email) => {
    if (process.env.NODE_ENV === "test") return true;
    const now = Date.now();
    const key = `${req2.ip}:${email.toLowerCase()}`;
    const attempts = (recentRegistrationAttempts.get(key) || []).filter((ts) => now - ts < 1e3 * 60 * 15);
    attempts.push(now);
    recentRegistrationAttempts.set(key, attempts);
    return attempts.length <= 5;
  };
  const recentPetitionAttempts = /* @__PURE__ */ new Map();
  const checkPetitionRateLimit = (req2, email) => {
    if (process.env.NODE_ENV === "test") return true;
    const now = Date.now();
    const key = `${req2.ip}:${email.toLowerCase()}`;
    const attempts = (recentPetitionAttempts.get(key) || []).filter((ts) => now - ts < 1e3 * 60 * 15);
    attempts.push(now);
    recentPetitionAttempts.set(key, attempts);
    return attempts.length <= 4;
  };
  const parsePetitionTags = () => (process.env.GHL_LEGACY_HILLS_PETITION_TAGS || "celina-connection,legacy-hills-petition,petition-signature").split(",").map((tag) => tag.trim()).filter(Boolean);
  const normalizeRequiredString = (value) => String(value || "").trim();
  const defaultLegacyHillsFieldId = (locationId, field) => {
    if (locationId !== "mKLGHZ4PHVm0iun7B9TH") return "";
    return field === "signature" ? "zbXdd33Q0TyHo8i27cdu" : "NSeTHniy0jmywbasoLjy";
  };
  const isSignatureDataUrl = (value) => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const sanitizePetitionSignatureFields = (body) => ({
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
    signatureDataUrl: normalizeRequiredString(body?.signatureDataUrl)
  });
  const validatePetitionSignatureFields = (signature, options2) => {
    if (!signature.firstName || !signature.lastName || !signature.email || !signature.phone || !signature.streetAddress) {
      return "First name, last name, email, phone, and street address are required.";
    }
    if (!/^\S+@\S+\.\S+$/.test(signature.email)) {
      return "A valid email address is required.";
    }
    if (options2.requireSignature && (!signature.signatureDataUrl || signature.signatureDataUrl.length > 25e4 || !isSignatureDataUrl(signature.signatureDataUrl))) {
      return "A drawn signature is required to record your petition signature.";
    }
    if (signature.signatureDataUrl && (signature.signatureDataUrl.length > 25e4 || !isSignatureDataUrl(signature.signatureDataUrl))) {
      return "Please add a valid drawn signature image.";
    }
    return "";
  };
  const syncLegacyHillsPetitionSignatureViaGhl = async (signature) => {
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
      accept: "application/json"
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
        source
      })
    });
    if (!upsertResponse.ok) {
      const body = await upsertResponse.text().catch(() => "");
      throw new Error(`GHL contact upsert failed: ${upsertResponse.status} ${body}`.trim());
    }
    const upsertJson = await upsertResponse.json().catch(() => ({}));
    const contactId = upsertJson?.contact?.id || upsertJson?.id || upsertJson?.contactId;
    if (!contactId) {
      throw new Error("GHL contact upsert did not return a contact id.");
    }
    const customFieldPayload = [
      [process.env.GHL_LEGACY_HILLS_NEIGHBORHOOD_FIELD_ID, signature.neighborhood],
      [process.env.GHL_LEGACY_HILLS_BUILDER_FIELD_ID, signature.builder],
      [process.env.GHL_LEGACY_HILLS_COMMENTS_FIELD_ID || defaultLegacyHillsFieldId(locationId, "comments"), signature.comments],
      [process.env.GHL_LEGACY_HILLS_SIGNATURE_FIELD_ID || defaultLegacyHillsFieldId(locationId, "signature"), signature.signatureDataUrl],
      [process.env.GHL_LEGACY_HILLS_SIGNED_AT_FIELD_ID, (/* @__PURE__ */ new Date()).toISOString()]
    ].filter(([id, value]) => id && value).map(([id, value]) => ({ id, value }));
    if (customFieldPayload.length > 0) {
      const updateResponse = await fetchWithEmailTimeout(`${baseUrl}/contacts/${contactId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ customFields: customFieldPayload })
      });
      if (!updateResponse.ok) {
        const body = await updateResponse.text().catch(() => "");
        throw new Error(`GHL custom field update failed: ${updateResponse.status} ${body}`.trim());
      }
    }
    return contactId;
  };
  const requireOwnerSession = async (req2, res, next) => {
    try {
      const ownerId = readOwnerSession(req2);
      if (!ownerId) return res.status(401).json({ error: "Owner authentication is required." });
      const business = await repository.getOwnedBusinessByOwnerId(ownerId);
      if (!business || !business.emailVerified) return res.status(401).json({ error: "Owner authentication is required." });
      req2.ownerBusiness = business;
      return next();
    } catch {
      return res.status(401).json({ error: "Owner authentication is required." });
    }
  };
  const requireAdminToken = (req2, res, next) => {
    try {
      const expectedToken = process.env.ADMIN_API_TOKEN;
      if (isValidAdminSession(req2)) return next();
      if (!expectedToken) {
        const loginConfigured = !!(process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_TOKEN));
        if (loginConfigured) {
          return res.status(401).json({ error: "Admin authentication is required." });
        }
        return res.status(503).json({
          error: "Admin actions are disabled until server-side authentication is configured."
        });
      }
      const providedToken = req2.header("x-admin-token");
      if (providedToken !== expectedToken) {
        return res.status(401).json({ error: "Admin authentication is required." });
      }
      return next();
    } catch {
      return res.status(401).json({ error: "Admin authentication is required." });
    }
  };
  const siteUrl = SITE_URL;
  const socialCrawlerUserAgentPattern = /(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterestbot|Googlebot|bingbot)/i;
  const xmlEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const metaEscape = (value = "") => xmlEscape(String(value));
  const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const businessSlug = (business) => business.slug || business.id || "";
  const findBusinessForSlug = async (slug) => {
    const decodedSlug = decodeURIComponent(slug || "").toLowerCase();
    const businesses = await readPublicDirectory();
    return businesses.find((business) => {
      const slugOrId = businessSlug(business).toLowerCase();
      return slugOrId === decodedSlug || business.id.toLowerCase() === decodedSlug;
    }) || null;
  };
  const firstBusinessImage = (business) => {
    if (!business) return "";
    return business.images?.[0] || business.logoUrl || "";
  };
  const isPublicImageUrl = (value = "") => /^https?:\/\//i.test(value);
  const isDataImageUrl = (value = "") => /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(value);
  const businessSocialImageUrl = (business) => {
    const image = firstBusinessImage(business);
    if (isPublicImageUrl(image)) return image;
    if (image.startsWith("/api/listing-images/")) return `${siteUrl}/social-image/business/${encodeURIComponent(businessSlug(business))}`;
    if (isDataImageUrl(image)) return `${siteUrl}/social-image/business/${encodeURIComponent(businessSlug(business))}`;
    return DEFAULT_SOCIAL_IMAGE;
  };
  const buildDirectoryItemListSchema = (businesses) => ({
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
      url: `${siteUrl}/business/${businessSlug(business)}`
    }))
  });
  const buildCategoryItemListSchema = (categoryName, url, businesses) => {
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
        url: `${siteUrl}/business/${businessSlug(business)}`
      }))
    };
  };
  const buildBreadcrumbSchema = (name, url) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: url
      }
    ]
  });
  const buildDirectoryFaqSchema = (url) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: "Where can I find local businesses in Celina, Texas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[0].answer
        }
      },
      {
        "@type": "Question",
        name: "How can a Celina business claim a listing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[1].answer
        }
      },
      {
        "@type": "Question",
        name: "What types of businesses are listed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: DIRECTORY_FAQ[2].answer
        }
      }
    ]
  });
  const buildPricingFaqSchema = (url) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: PRICING_FAQ[0].question,
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[0].answer
        }
      },
      {
        "@type": "Question",
        name: "Which paid plan adds a website link and hours?",
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[1].answer
        }
      },
      {
        "@type": "Question",
        name: "Which plan is best for more visibility?",
        acceptedAnswer: {
          "@type": "Answer",
          text: PRICING_FAQ[2].answer
        }
      }
    ]
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
    noindex = false
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
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${metaEscape(title)}" />
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
      "Allow: /social-image/",
      "Allow: /api/social-image/",
      "Disallow: /api/",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      ""
    ].join("\n"));
  });
  const publicReadHandler = (handler2) => (req2, res, next) => {
    Promise.resolve().then(() => handler2(req2, res, next)).catch((error) => {
      console.error("Public directory read failed:", error instanceof Error ? error.message : "Unknown error");
      if (res.headersSent) return next(error);
      res.setHeader("Cache-Control", "no-store");
      res.status(503).send("The directory is temporarily unavailable. Please try again shortly.");
    });
  };
  app.get(["/sitemap.xml", "/api/sitemap.xml"], publicReadHandler(async (_req, res) => {
    const businesses = await readPublicDirectory();
    const staticPages = [
      { loc: siteUrl, priority: "1.0", changefreq: "daily" },
      { loc: `${siteUrl}/directory`, priority: "0.9", changefreq: "daily" },
      { loc: `${siteUrl}/events`, priority: "0.7", changefreq: "weekly" },
      { loc: `${siteUrl}/pricing`, priority: "0.8", changefreq: "weekly" },
      { loc: `${siteUrl}/legacyhillspetition`, priority: "0.8", changefreq: "weekly" },
      { loc: `${siteUrl}/launch`, priority: "0.5", changefreq: "monthly" }
    ];
    const categoryPages = CATEGORY_LANDING_PAGES.filter((category) => businesses.some((business) => business.category === category.name)).map((category) => ({
      loc: `${siteUrl}/directory/${category.slug}`,
      priority: "0.8",
      changefreq: "weekly"
    }));
    const businessPages = businesses.filter((business) => business.slug || business.id).map((business) => ({
      loc: `${siteUrl}/business/${business.slug || business.id}`,
      priority: business.featured || business.tier === "premium" ? "0.9" : "0.7",
      changefreq: "weekly",
      lastmod: business.createdAt
    }));
    const urls = [...staticPages, ...categoryPages, ...businessPages].map((page) => `  <url>
    <loc>${xmlEscape(page.loc)}</loc>
    ${page.lastmod ? `<lastmod>${xmlEscape(new Date(page.lastmod).toISOString())}</lastmod>
    ` : ""}<changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("\n");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
  }));
  app.get("/api/share/page/:page", publicReadHandler(async (req2, res) => {
    const page = req2.params.page.toLowerCase();
    if (!isPublicPageKey(page)) {
      return res.status(404).json({ error: "Share page not found." });
    }
    const definition = PUBLIC_PAGE_META[page];
    const canonical = publicPagePath(page);
    const businesses = await readPublicDirectory();
    const schema = [
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
          "query-input": "required name=search_term_string"
        }
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
          addressCountry: "US"
        }
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
        publisher: { "@id": `${siteUrl}/#organization` }
      }
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
      schema
    }));
  }));
  app.get("/api/share/category/:slug", publicReadHandler(async (req2, res) => {
    const category = categoryLandingForSlug(req2.params.slug);
    if (!category) {
      return res.redirect(302, `${siteUrl}/directory`);
    }
    const businesses = await readPublicDirectory();
    const categoryBusinesses = businesses.filter((business) => business.category === category.name);
    const canonical = `${siteUrl}/directory/${category.slug}`;
    const schema = [
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
          "query-input": "required name=search_term_string"
        }
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
        isPartOf: { "@id": `${siteUrl}/#website` }
      },
      buildBreadcrumbSchema(category.name, canonical),
      buildCategoryItemListSchema(category.name, canonical, businesses)
    ];
    const intro = categoryBusinesses.length ? `${category.intro} This category currently includes ${categoryBusinesses.length} local ${categoryBusinesses.length === 1 ? "listing" : "listings"}.` : category.intro;
    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    res.type("html").send(renderShareHtml({
      title: category.title,
      description: category.description,
      canonical,
      image: DEFAULT_SOCIAL_IMAGE,
      h1: category.title.replace(" | Celina Connection", ""),
      intro,
      schema
    }));
  }));
  app.get(["/api/social-image/business/:slug", "/social-image/business/:slug"], publicReadHandler(async (req2, res) => {
    const business = await findBusinessForSlug(req2.params.slug);
    let image = firstBusinessImage(business);
    if (business && image.startsWith("/api/listing-images/")) {
      const slot = image.split("/")[4];
      image = await repository.getPublicListingImage(business.id, slot) || "";
    }
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
  }));
  const sendBusinessShareHtml = async (slugParam, res) => {
    const business = await findBusinessForSlug(slugParam);
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
      address: business.address ? {
        "@type": "PostalAddress",
        streetAddress: business.address.replace(", Celina, TX 75009", "").replace(", TX 75009", ""),
        addressLocality: "Celina",
        addressRegion: "TX",
        postalCode: "75009",
        addressCountry: "US"
      } : {
        "@type": "PostalAddress",
        addressLocality: "Celina",
        addressRegion: "TX",
        postalCode: "75009",
        addressCountry: "US"
      }
    };
    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    return res.type("html").send(renderShareHtml({
      title,
      description,
      canonical,
      image,
      ogType: "business.business",
      h1: business.name,
      intro: description,
      schema
    }));
  };
  app.get("/api/share/business/:slug", publicReadHandler(async (req2, res) => {
    return sendBusinessShareHtml(req2.params.slug, res);
  }));
  app.get("/business/:slug", publicReadHandler(async (req2, res, next) => {
    const userAgent = req2.header("user-agent") || "";
    if (!socialCrawlerUserAgentPattern.test(userAgent)) {
      return next();
    }
    res.setHeader("vary", "User-Agent");
    return sendBusinessShareHtml(req2.params.slug, res);
  }));
  app.get("/api/payment-config", (_req, res) => {
    res.json({
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
      eventPromotionEnabled: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_EVENT_PROMOTION)
    });
  });
  app.get("/api/ai-config", (_req, res) => {
    res.json({
      aiEnabled: !!geminiApiKey(),
      model: geminiChatModel()
    });
  });
  app.post("/api/admin/login", (req2, res) => {
    try {
      const providedPassword = (req2.body?.password || "").toString().trim();
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
      }
      return res.status(200).json({ authenticated: true });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "We could not sign you in right now. Please try again." });
    }
  });
  app.post("/api/logout", (_req, res) => {
    const suffix = `HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    res.setHeader("Set-Cookie", [
      `${ownerCookieName}=; ${suffix}`,
      `${adminCookieName}=; ${suffix}`
    ]);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ authenticated: false });
  });
  app.post("/api/admin/logout", (_req, res) => {
    try {
      res.setHeader("set-cookie", `${adminCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    } catch {
    }
    return res.json({ authenticated: false });
  });
  app.get("/api/admin/session", (req2, res) => {
    try {
      if (!isValidAdminSession(req2)) {
        return res.status(401).json({ authenticated: false });
      }
      return res.json({ authenticated: true });
    } catch {
      return res.status(401).json({ authenticated: false });
    }
  });
  const htmlEscape = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const buildLegacyHillsPetitionDocumentHtml = (signatures) => {
    const rows = signatures.map((signature, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlEscape(`${signature.firstName} ${signature.lastName}`)}</td>
        <td>${htmlEscape(signature.streetAddress)}</td>
        <td>${htmlEscape(signature.neighborhood || "Legacy Hills")}</td>
        <td>${htmlEscape(signature.builder || "")}</td>
        <td>${htmlEscape(signature.phone)}</td>
        <td>${htmlEscape(signature.email)}</td>
        <td>${new Date(signature.signedAt).toLocaleDateString("en-US")}</td>
        <td class="signature"><img src="${htmlEscape(signature.signatureDataUrl)}" alt="Signature for ${htmlEscape(signature.firstName)} ${htmlEscape(signature.lastName)}" /></td>
      </tr>`).join("");
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
  <h1>Legacy Hills Petition Signature Packet</h1>
  <div class="meta">Generated by Celina Connection on ${(/* @__PURE__ */ new Date()).toLocaleString("en-US")}.</div>
  <div class="summary"><strong>Total signatures:</strong> ${signatures.length}<br />Purpose: homeowner, resident, and property stakeholder petition record for Legacy Hills submissions collected through Celina Connection.</div>
  <h2>Petition Request</h2>
  <p><strong>To:</strong> Legacy Hills builders, the Legacy Hills Development Team, HOA Leadership, City Officials, and all parties responsible for the development and maintenance of Legacy Hills.</p>
  <h2>Community Petition for the Completion of Promised Amenities and Improved Community Standards</h2>
  <p>We, the undersigned homeowners and residents of Legacy Hills communities, respectfully submit this petition to express our growing concern regarding continued delays in completing the master-planned community as it was represented during the home-buying process.</p>
  <p>We request a clear written timeline for promised amenities, proper completion of drainage and infrastructure work, improved maintenance standards during construction, and consistent communication regarding project timelines, delays, and changes.</p>
  <p>This petition is a respectful request for accountability, transparency, and partnership. We request a written response outlining the status of these concerns, planned timelines, and actions that will be taken to address them.</p>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Street Address</th><th>Community</th><th>Builder</th><th>Phone</th><th>Email</th><th>Signed</th><th>Signature</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="9">No signatures collected yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
  };
  app.get("/api/listing-images/:id/:slot/:version.webp", async (req2, res) => {
    const { id, slot, version } = req2.params;
    if (!/^(logo|[0-9]{1,2})$/.test(slot) || !/^[a-f0-9]{32}$/.test(version)) {
      return res.status(404).end();
    }
    try {
      const image = await repository.getPublicListingImage(id, slot);
      if (!image || listingImageVersion(image) !== version) return res.status(404).end();
      const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
      const mimeType = image.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,/i)?.[1] || "image/jpeg";
      let output = bytes;
      let outputType = mimeType;
      try {
        const { default: sharp } = await import("sharp");
        output = await sharp(bytes, { limitInputPixels: 4e7 }).rotate().resize({ width: slot === "logo" ? 320 : 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        outputType = "image/webp";
      } catch (imageProcessingError) {
        console.warn("Listing image optimization unavailable; serving original image:", imageProcessingError instanceof Error ? imageProcessingError.message : String(imageProcessingError));
      }
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.type(outputType).send(output);
    } catch (error) {
      console.error("Listing image unavailable:", error instanceof Error ? error.message : "Unknown error");
      return res.status(503).end();
    }
  });
  app.get("/api/admin/bugs", requireAdminToken, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      return res.json({ reportedBugs: await repository.listBugs() });
    } catch {
      return res.status(503).json({ error: "Bug reports are temporarily unavailable." });
    }
  });
  app.get("/api/bootstrap", async (_req, res) => {
    try {
      const businesses = await readPublicDirectory();
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
      return res.json({ businesses, reportedBugs: [] });
    } catch (error) {
      console.error("Bootstrap query error:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "The directory is temporarily unavailable. Please try again shortly." });
    }
  });
  app.post("/api/petitions/legacy-hills/signatures", async (req2, res) => {
    const {
      eligibilityConfirmed,
      consent,
      company
    } = req2.body || {};
    if (company) return res.status(400).json({ error: "Signature failed spam validation." });
    const signature = sanitizePetitionSignatureFields(req2.body);
    const validationError = validatePetitionSignatureFields(signature, { requireSignature: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (!eligibilityConfirmed) {
      return res.status(400).json({ error: "Please confirm you are a homeowner, resident, or property stakeholder in a Legacy Hills community." });
    }
    if (!consent) {
      return res.status(400).json({ error: "Consent is required to record your petition signature." });
    }
    if (!checkPetitionRateLimit(req2, signature.email)) {
      return res.status(429).json({ error: "Too many petition submissions. Please try again later." });
    }
    try {
      const contactId = await syncLegacyHillsPetitionSignatureViaGhl(signature);
      let savedSignature;
      try {
        savedSignature = await withPetitionDatabaseTimeout(repository.createLegacyHillsPetitionSignature({ ...signature, contactId }));
      } catch (databaseError) {
        console.error("Legacy Hills petition database save failed after GHL capture:", databaseError);
        savedSignature = {
          ...signature,
          contactId,
          id: `ghl-${contactId}`,
          signedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      sendAdminPetitionSignatureNotification(savedSignature).catch((notificationError) => {
        console.error("Petition signature admin notification failed:", notificationError instanceof Error ? notificationError.message : String(notificationError));
      });
      return res.status(201).json({ ok: true, contactId, signature: savedSignature });
    } catch (error) {
      console.error("Legacy Hills petition GHL sync failed:", error);
      return res.status(503).json({ error: "Petition signature could not be saved to GoHighLevel. Please try again shortly." });
    }
  });
  app.post("/api/networking-event/rsvps", async (req2, res) => {
    const { name, business, email, guests, notes, company } = req2.body || {};
    if (company) return res.status(400).json({ error: "RSVP failed spam validation." });
    if (!String(name || "").trim() || !String(business || "").trim()) {
      return res.status(400).json({ error: "Name and business are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const guestCount = Math.min(20, Math.max(1, Number(guests) || 1));
    try {
      const ghlApiKey = process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || process.env.LEADCONNECTOR_API_KEY;
      const ghlLocationId = process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || process.env.LEADCONNECTOR_LOCATION_ID;
      if (ghlApiKey && ghlLocationId) {
        const ghlBaseUrl = (process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com").replace(/\/$/, "");
        const upsertRes = await fetchWithEmailTimeout(`${ghlBaseUrl}/contacts/upsert`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${ghlApiKey}`,
            version: process.env.GHL_API_VERSION || "2021-07-28",
            "content-type": "application/json",
            accept: "application/json"
          },
          body: JSON.stringify({
            locationId: ghlLocationId,
            name: String(name).trim(),
            email: String(email).trim(),
            companyName: String(business).trim(),
            tags: process.env.GHL_NETWORKING_EVENT_TAGS || "celina-connection,networking-event-rsvp",
            source: "Celina Connection - Networking Event Nov 23"
          })
        });
        if (!upsertRes.ok) {
          console.error("Networking Event RSVP contact upsert failed:", upsertRes.status, await upsertRes.text().catch(() => ""));
        }
      }
    } catch (error) {
      console.error("Networking Event RSVP contact upsert failed:", error instanceof Error ? error.message : String(error));
    }
    const adminEmail = adminNotificationEmail();
    if (adminEmail) {
      const message = {
        subject: `Networking Event RSVP: ${String(name).trim()} \u2014 ${String(business).trim()}`,
        html: `<p>A new RSVP was submitted for the Celina Connection Networking Event (Monday, November 23, 2026, 5:30\u20137:30 PM, Voodoo Brewing Company).</p><p><strong>Name:</strong> ${emailHtmlEscape(String(name).trim())}<br /><strong>Business:</strong> ${emailHtmlEscape(String(business).trim())}<br /><strong>Email:</strong> ${emailHtmlEscape(String(email).trim())}<br /><strong>Attending:</strong> ${guestCount}</p><p><strong>Notes:</strong><br />${emailHtmlEscape(String(notes || "None"))}</p>`,
        text: `A new RSVP was submitted for the Celina Connection Networking Event (Monday, November 23, 2026, 5:30\u20137:30 PM, Voodoo Brewing Company).

Name: ${String(name).trim()}
Business: ${String(business).trim()}
Email: ${String(email).trim()}
Attending: ${guestCount}

Notes: ${String(notes || "None")}`
      };
      try {
        await sendOwnerEmailMessage(adminEmail, "Celina Connection Admin", message, "networking-event-rsvp", `${publicSiteUrl()}/networking-event`, parseGhlAdminNotificationTags());
      } catch (error) {
        console.error("Networking Event RSVP notification failed:", error instanceof Error ? error.message : String(error));
        return res.status(503).json({ error: "We could not send your RSVP right now. Please try again shortly." });
      }
    }
    return res.status(201).json({ ok: true });
  });
  app.get("/api/petitions/legacy-hills/signatures", async (_req, res) => {
    let signatures;
    try {
      signatures = await withPetitionDatabaseTimeout(repository.listLegacyHillsPetitionSignatures());
    } catch (error) {
      console.error("Legacy Hills petition list failed:", error);
      return res.status(503).json({ error: "Petition signatures are temporarily unavailable. Please try again shortly." });
    }
    const publicSignatures = signatures.map((signature) => ({
      id: signature.id,
      displayName: `${signature.firstName} ${signature.lastName ? `${signature.lastName.charAt(0)}.` : ""}`.trim(),
      neighborhood: signature.neighborhood || "Legacy Hills",
      builder: signature.builder || "",
      signedAt: signature.signedAt
    }));
    return res.json({ total: signatures.length, signatures: publicSignatures });
  });
  app.get("/api/admin/petitions/legacy-hills/signatures", requireAdminToken, async (_req, res) => {
    let signatures;
    try {
      signatures = await withPetitionDatabaseTimeout(repository.listLegacyHillsPetitionSignatures());
    } catch (error) {
      console.error("Admin Legacy Hills petition list failed:", error);
      return res.status(503).json({ error: "Petition reporting is temporarily unavailable. Please restore the database quota and try again." });
    }
    return res.json({ signatures });
  });
  app.patch("/api/admin/petitions/legacy-hills/signatures/:id", requireAdminToken, async (req2, res) => {
    const updates = sanitizePetitionSignatureFields(req2.body);
    const existingSignatures = await repository.listLegacyHillsPetitionSignatures();
    const existing = existingSignatures.find((signature) => signature.id === req2.params.id);
    if (!existing) {
      return res.status(404).json({ error: "We could not find that petition signature." });
    }
    const merged = { ...existing, ...updates };
    const validationError = validatePetitionSignatureFields(merged, { requireSignature: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const updated = await repository.updateLegacyHillsPetitionSignature(req2.params.id, updates);
    return res.json({ signature: updated });
  });
  app.get("/api/admin/petitions/legacy-hills/export.csv", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    const headers = ["Signed At", "First Name", "Last Name", "Email", "Phone", "Street Address", "Neighborhood", "Builder", "Comments", "GHL Contact ID"];
    const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(csvEscape).join(",")].concat(signatures.map((signature) => [
      signature.signedAt,
      signature.firstName,
      signature.lastName,
      signature.email,
      signature.phone,
      signature.streetAddress,
      signature.neighborhood,
      signature.builder || "",
      signature.comments || "",
      signature.contactId || ""
    ].map(csvEscape).join(",")));
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", 'attachment; filename="legacy-hills-petition-signatures.csv"');
    return res.send(lines.join("\n"));
  });
  app.get("/api/admin/petitions/legacy-hills/export", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.send(buildLegacyHillsPetitionDocumentHtml(signatures));
  });
  app.post("/api/owner/discover-business", async (req2, res) => {
    try {
      const businessName = String(req2.body?.businessName || "").trim();
      const website = normalizeWebsiteUrl(req2.body?.website);
      if (!businessName || !website) {
        return res.status(400).json({ error: "Please enter a business name and website." });
      }
      let url;
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
          accept: "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(8e3)
      });
      if (!response.ok) {
        return res.status(422).json({ error: "We could not open that website. You can still finish the listing manually." });
      }
      const html = await response.text();
      const signals = extractWebsiteSignals(html, url.toString());
      let placeSignals = null;
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
          signals.imageUrl ? "Found a possible banner image." : "No website image was found."
        ]
      };
      if (geminiApiKey()) {
        try {
          const ai = getGemini();
          const aiResponse = await generateContentWithFallback(ai, {
            model: geminiSearchModel(),
            contents: `Business name: ${businessName}
Website: ${url.toString()}
Google listing data: ${JSON.stringify(placeSignals || {})}
Page title: ${signals.title}
Meta description: ${signals.description}
Public phone: ${signals.phone}
Public email: ${signals.email}
Page text excerpt: ${signals.pageText}`,
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
                  confidenceNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "category", "description", "phone", "email", "address", "confidenceNotes"]
              }
            }
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
            confidenceNotes: Array.isArray(parsed.confidenceNotes) && parsed.confidenceNotes.length ? parsed.confidenceNotes.slice(0, 4).map((note) => String(note).trim()).filter(Boolean) : draft.confidenceNotes
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
  app.post("/api/owner/register", async (req2, res) => {
    try {
      if (req2.body?.tier !== void 0 && !["basic", "pro", "premium"].includes(req2.body.tier)) {
        return res.status(400).json({ error: "A paid Basic, Pro, or Premium plan is required. Complimentary signups are no longer available." });
      }
      const { name, category, description, phone, email, password, startedAt, company } = req2.body || {};
      if (company) return res.status(400).json({ error: "Registration failed spam validation." });
      if (!startedAt || Date.now() - Number(startedAt) < 3e3) {
        return res.status(429).json({ error: "Please wait a few seconds before submitting the registration form." });
      }
      if (!name || !category || !description || !phone || !email || !password) {
        return res.status(400).json({ error: "Please add your business name, category, description, phone, email, and password." });
      }
      if (String(password).length < 10) {
        return res.status(400).json({ error: "Password must be at least 10 characters." });
      }
      if (!hasRequiredListingVisuals(req2.body || {})) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      if (!checkRegistrationRateLimit(req2, email)) {
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
        tier: "pending",
        address: req2.body.address || "",
        website: req2.body.website || "",
        logoUrl: req2.body.logoUrl || "",
        images: Array.isArray(req2.body.images) ? req2.body.images.slice(0, 1) : []
      }, hashPassword(password), { tokenHash: verification.tokenHash, expiresAt: verification.expiresAt });
      try {
        await sendOwnerVerificationEmail(String(email), business, verificationUrl);
      } catch (emailError) {
        await repository.deleteBusiness(business.id);
        console.error("Owner verification email delivery failed.");
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
  app.get("/api/owner/verify-email", async (req2, res) => {
    try {
      const token = typeof req2.query.token === "string" ? req2.query.token : "";
      if (!token) return res.status(400).json({ error: "This verification link is incomplete. Please request a new link." });
      const tokenHash = crypto2.createHash("sha256").update(token).digest("hex");
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
  app.post("/api/owner/resend-verification", async (req2, res) => {
    try {
      const { email } = req2.body || {};
      if (!email) return res.status(400).json({ error: "Please enter your email address." });
      if (!checkVerificationResendLimit(req2, email)) {
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
          console.error("Owner verification resend failed.");
          return res.status(503).json({ error: "We couldn't send the verification email right now. Please try again in a moment." });
        }
      }
      return res.json({
        message: "If that email has an unverified owner account, a new verification link has been sent.",
        ...process.env.CELINA_EXPOSE_VERIFICATION_LINK === "true" && business ? { verificationUrl } : {}
      });
    } catch (error) {
      console.error("Owner resend verification error.");
      return res.status(500).json({ error: "We could not send a new verification email right now. Please try again." });
    }
  });
  app.post("/api/owner/forgot-password", async (req2, res) => {
    const genericMessage = "If that owner account exists, a password reset link has been sent.";
    try {
      const { email } = req2.body || {};
      if (!email) return res.status(400).json({ error: "Please enter your email address." });
      if (!checkPasswordResetLimit(req2, email)) {
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
        ...process.env.CELINA_EXPOSE_PASSWORD_RESET_LINK === "true" && existingOwner ? {
          resetUrl: exposedResetUrl
        } : {}
      });
    } catch (error) {
      console.error("Owner forgot password error:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ error: "We could not send the reset email right now. Please try again." });
    }
  });
  app.post("/api/owner/reset-password", async (req2, res) => {
    try {
      const { token, password } = req2.body || {};
      if (!token || !password) return res.status(400).json({ error: "This reset link is incomplete. Please request a new link." });
      if (String(password).length < 10) {
        return res.status(400).json({ error: "Password must be at least 10 characters." });
      }
      const tokenHash = crypto2.createHash("sha256").update(String(token)).digest("hex");
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
  app.post("/api/owner/login", async (req2, res) => {
    try {
      const { email, password } = req2.body || {};
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
  app.get("/api/owner/session", requireOwnerSession, (req2, res) => {
    const { ownerPasswordHash: _ownerPasswordHash, ...business } = req2.ownerBusiness;
    return res.json({ authenticated: true, business, currentUser: makeCurrentUser(business) });
  });
  app.patch("/api/owner/businesses/:id", requireOwnerSession, async (req2, res) => {
    try {
      const ownerBusiness = req2.ownerBusiness;
      if (ownerBusiness.id !== req2.params.id) {
        return res.status(403).json({ error: "Owners can only update their own business listing." });
      }
      const updates = sanitizeOwnerBusinessUpdates(ownerBusiness.tier, req2.body || {}, ownerBusiness);
      if (!ownerBusiness.isUnclaimed && !hasRequiredListingVisuals({ ...ownerBusiness, ...updates })) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      const business = await repository.updateBusiness(req2.params.id, updates);
      if (!business) return res.status(404).json({ error: "We could not find that business listing." });
      return res.json(business);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save listing changes." });
    }
  });
  app.patch("/api/owner/businesses/:id/notification-settings", requireOwnerSession, async (req2, res) => {
    const ownerBusiness = req2.ownerBusiness;
    if (ownerBusiness.id !== req2.params.id) return res.status(403).json({ error: "Owners can only update their own notification settings." });
    const notificationsEnabled = req2.body?.notificationsEnabled !== false;
    const eventNotificationsEnabled = req2.body?.eventNotificationsEnabled !== false;
    const business = await repository.updateBusiness(req2.params.id, { notificationsEnabled, eventNotificationsEnabled });
    if (!business) return res.status(404).json({ error: "We could not find that business listing." });
    return res.json(business);
  });
  app.post("/api/businesses", requireAdminToken, async (req2, res) => {
    try {
      if (!["basic", "pro", "premium", "pending"].includes(req2.body?.tier)) {
        return res.status(400).json({ error: "New listings require a paid plan or pending-payment status." });
      }
      const { name, category, description, phone, email, tier } = req2.body || {};
      if (!name || !category || !description || !phone || !email || !tier) {
        return res.status(400).json({ error: "Please add the business name, category, description, phone, email, and membership tier." });
      }
      if (req2.body?.isUnclaimed === false && !hasRequiredListingVisuals(req2.body || {})) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      const business = await repository.createBusiness(req2.body);
      return res.status(201).json(business);
    } catch (error) {
      console.error("Create business error.");
      return res.status(500).json({ error: "We could not create that listing right now. Please try again." });
    }
  });
  app.post("/api/claims", async (req2, res) => {
    const { businessId, requesterName, requesterEmail, requesterPhone, role } = req2.body || {};
    if (!businessId || !requesterName || !requesterEmail || !requesterPhone || !role) {
      return res.status(400).json({ error: "Please add your name, email, phone number, and connection to this business." });
    }
    const claim = await repository.createClaimRequest(req2.body);
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
  app.post("/api/admin/notifications/missing-visuals", requireAdminToken, async (req2, res) => {
    const deadlineHours = Math.min(168, Math.max(1, Number(req2.body?.deadlineHours || 72)));
    const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1e3);
    const includeUnclaimed = req2.body?.includeUnclaimed === true;
    const businesses = await repository.listBusinesses();
    const candidates = businesses.filter((business) => {
      if (hasRequiredListingVisuals(business)) return false;
      if (!includeUnclaimed && (business.isUnclaimed || !business.ownerId)) return false;
      return true;
    });
    const sent = [];
    const skipped = [];
    const failed = [];
    for (const business of candidates) {
      const email = String(business.email || "").trim();
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
          error: error instanceof Error ? error.message : "Unable to send this notification."
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
      failed
    });
  });
  app.post("/api/admin/claims/:id/approve", requireAdminToken, async (req2, res) => {
    const claims = await repository.listClaimRequests();
    const claim = claims.find((item) => item.id === req2.params.id);
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
    const updatedClaim = await repository.updateClaimRequest(claim.id, { status: "approved", reviewedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return res.json({ claim: updatedClaim, business: claimed.business });
  });
  app.post("/api/admin/claims/:id/reject", requireAdminToken, async (req2, res) => {
    const claim = await repository.updateClaimRequest(req2.params.id, { status: "rejected", reviewedAt: (/* @__PURE__ */ new Date()).toISOString() });
    if (!claim) {
      return res.status(404).json({ error: "Claim request not found" });
    }
    return res.json({ claim });
  });
  app.patch("/api/businesses/:id", requireAdminToken, async (req2, res) => {
    try {
      if (req2.body?.tier === "free") return res.status(400).json({ error: "The complimentary tier is closed. Choose a paid plan or pending-payment status." });
      const body = req2.body || {};
      if (body.ownerPassword !== void 0 && String(body.ownerPassword).length > 0 && String(body.ownerPassword).length < 10) {
        return res.status(400).json({ error: "Owner password must be at least 10 characters." });
      }
      const existingBusiness = await repository.getBusiness(req2.params.id);
      if (!existingBusiness) {
        return res.status(404).json({ error: "We could not find that business listing." });
      }
      const businessUpdates = {
        ...stripAdminOwnerAccountFields(body),
        ...body.events !== void 0 ? { events: normalizeListingEvents(body.events, existingBusiness.events || [], true) } : {}
      };
      const proposedBusiness = { ...existingBusiness, ...businessUpdates };
      const liveListingRequested = proposedBusiness.isUnclaimed === false || String(proposedBusiness.ownerId || "").trim() !== "";
      if (liveListingRequested && !hasRequiredListingVisuals(proposedBusiness)) {
        return res.status(400).json({ error: listingVisualsRequiredMessage });
      }
      const business = await repository.updateBusiness(req2.params.id, businessUpdates);
      if (!business) {
        return res.status(404).json({ error: "We could not find that business listing." });
      }
      const shouldManageOwner = body.ownerPassword || body.ownerEmail !== void 0 || body.ownerAccountEmail !== void 0 || body.assignOwnerEmail !== void 0 || body.ownerId !== void 0 || body.isUnclaimed !== void 0;
      if (!shouldManageOwner) return res.json(business);
      if (body.isUnclaimed === true || body.ownerId === "") {
        const unassigned = await repository.updateBusiness(req2.params.id, { ownerId: "", isUnclaimed: true });
        return res.json(unassigned);
      }
      const ownerEmail = resolveOwnerEmail(body, business.email);
      if (!ownerEmail) {
        return res.status(400).json({ error: "Owner email is required to assign this listing." });
      }
      const ownerAccount = await repository.updateOwnerAccount(req2.params.id, {
        ownerId: String(body.ownerId || business.ownerId || `owner-${business.id}`),
        email: ownerEmail,
        passwordHash: body.ownerPassword ? hashPassword(String(body.ownerPassword)) : void 0,
        emailVerified: true
      });
      if (!ownerAccount) return res.status(404).json({ error: "We could not find that business listing." });
      const { ownerPasswordHash: _ownerPasswordHash, ...safeBusiness } = ownerAccount;
      return res.json(safeBusiness);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save listing changes." });
    }
  });
  app.delete("/api/businesses/:id", requireAdminToken, async (req2, res) => {
    const deleted = await repository.deleteBusiness(req2.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.status(204).send();
  });
  app.post("/api/businesses/:id/claim", requireAdminToken, async (req2, res) => {
    const { email } = req2.body || {};
    if (!email) {
      return res.status(400).json({ error: "Please enter an email address." });
    }
    const business = await repository.getBusiness(req2.params.id);
    if (!business) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    if (!hasRequiredListingVisuals(business)) {
      return res.status(400).json({ error: listingVisualsRequiredMessage });
    }
    const claimed = await repository.claimBusiness(req2.params.id, email);
    if (!claimed) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.json(claimed);
  });
  app.post("/api/businesses/:id/reviews", async (req2, res) => {
    const { authorName, rating, text, ownerReply } = req2.body || {};
    if (!authorName || !rating || !text) {
      return res.status(400).json({ error: "Please add your name, rating, and review." });
    }
    const result = await repository.addReview(req2.params.id, { authorName, rating, text, ownerReply });
    if (!result) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    return res.status(201).json(result);
  });
  app.post("/api/businesses/:id/likes", async (req2, res) => {
    const liked = req2.body?.liked !== false;
    const business = await repository.voteBusiness(req2.params.id, liked ? 1 : -1);
    if (!business) {
      return res.status(404).json({ error: "We could not find that business listing." });
    }
    if (liked) {
      sendOwnerEngagementNotification(business, "like").catch((error) => console.error("Owner like notification failed:", error instanceof Error ? error.message : String(error)));
    }
    return res.json({ business, votesCount: business.votesCount || 0, liked });
  });
  app.post("/api/businesses/:id/growth/:action", async (req2, res) => {
    const action = req2.params.action === "referral-visit" ? "referralVisit" : req2.params.action === "share-click" ? "shareClick" : "";
    if (!action) return res.status(400).json({ error: "Unknown growth action." });
    const business = await repository.trackBusinessGrowthAction(req2.params.id, action);
    if (!business) return res.status(404).json({ error: "We could not find that business listing." });
    if (action === "shareClick") {
      sendOwnerEngagementNotification(business, "share").catch((error) => console.error("Owner share notification failed:", error instanceof Error ? error.message : String(error)));
    }
    return res.json({ business, growthCredits: business.growthCredits });
  });
  app.post("/api/bugs", async (req2, res) => {
    const { title, description, category, severity, email } = req2.body || {};
    if (!title || !description || !category || !severity || !email) {
      return res.status(400).json({ error: "Please add your email, a short note, and a few details so we can help." });
    }
    return res.status(201).json(await repository.createBug(req2.body));
  });
  app.patch("/api/bugs/:id", requireAdminToken, async (req2, res) => {
    const updated = await repository.updateBug(req2.params.id, req2.body || {});
    if (!updated) {
      return res.status(404).json({ error: "We could not find that feedback note." });
    }
    return res.json(updated);
  });
  app.delete("/api/bugs/:id", requireAdminToken, async (req2, res) => {
    const deleted = await repository.deleteBug(req2.params.id);
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
  app.post("/api/petitions/legacy-hills/signatures", async (req2, res) => {
    const { firstName, lastName, email, phone, streetAddress, signatureDataUrl } = req2.body || {};
    if (!firstName || !lastName || !email || !phone || !streetAddress || !signatureDataUrl) {
      return res.status(400).json({ error: "Missing required petition signature fields." });
    }
    const signature = await repository.createLegacyHillsPetitionSignature({
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      neighborhood: req2.body.neighborhood || "Legacy Hills",
      comments: req2.body.comments || "",
      signatureDataUrl
    });
    return res.status(201).json({ ok: true, signature });
  });
  app.get("/api/admin/petitions/legacy-hills/export.csv", requireAdminToken, async (_req, res) => {
    const signatures = await repository.listLegacyHillsPetitionSignatures();
    let csv = "ID,First Name,Last Name,Email,Phone,Address,Community,Comments,Signed At\n";
    for (const sig of signatures) {
      csv += `"${sig.id}","${sig.firstName}","${sig.lastName}","${sig.email}","${sig.phone}","${sig.streetAddress}","${sig.neighborhood}","${(sig.comments || "").replace(/"/g, '""')}","${sig.signedAt}"
`;
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="legacy_hills_petition_signatures.csv"');
    return res.send(csv);
  });
  app.post("/api/ai/search", async (req2, res) => {
    try {
      const { query, businesses } = req2.body;
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
                description: "Array of business IDs that match the search query."
              },
              insights: {
                type: Type.STRING,
                description: "Markdown-formatted text giving warm, tailored local recommendations and explaining why they fit the search."
              }
            },
            required: ["matchingIds", "insights"]
          }
        }
      });
      const resultText = response.text || "{}";
      let parsedResult;
      try {
        parsedResult = JSON.parse(resultText);
      } catch {
        parsedResult = { matchingIds: [], insights: resultText };
      }
      return res.json(parsedResult);
    } catch (error) {
      console.error("AI Search Error:", error);
      return res.status(500).json({ error: "Celina AI could not search right now. Regular directory search is still ready." });
    }
  });
  app.post("/api/ai/chat", async (req2, res) => {
    try {
      const { messages, businesses } = req2.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Please enter a message for Celina AI." });
      }
      if (!geminiApiKey()) {
        return res.status(503).json({ error: "Celina AI is taking a short break. Please try again soon." });
      }
      const ai = getGemini();
      const localTime = (/* @__PURE__ */ new Date()).toLocaleDateString() + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString();
      const systemInstruction = `You are Celina Connection AI, a friendly, ultra-helpful local virtual concierge for Celina, Texas.
Your goal is to answer basic questions about local businesses, locations, operating hours, contact info, ratings, and how to use Celina Connection.

We have a directory of local businesses. Here is the active business directory data:
${JSON.stringify(businesses || [])}

Context & Rules:
1. Current Local Time and Date: ${localTime}
2. Use the directory database to provide extremely accurate details on local businesses. Always favor recommending Premium Partners when appropriate!
3. This is a lightweight Q&A assistant. Do not claim live weather, live events, sports scores, or real-time facts unless that information is present in the provided directory data. If a question needs real-time information, say you can help with directory basics and suggest checking an official current source.
4. If the directory has no exact or useful match, still be helpful: recommend one real, recognizable Celina-area place or destination from your general knowledge when you are confident it exists. Clearly say that it is not currently listed in the Celina Connection directory, and do not invent an address, phone number, hours, rating, availability, or other details. If you are not confident about a specific place, recommend a relevant local destination such as Downtown Celina or the Celina Square without making unsupported business claims.
5. Whenever you recommend something that is not currently in the directory, end with a friendly invitation such as: \u201CIf you visit or know them, let them know about Celina Connection so they can get their own listing here too.\u201D
6. Keep answers brief, conversational, and helpful. Always maintain a warm, welcoming Texas tone. Use Markdown formatting.`;
      const formattedContents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text || m.content || "" }]
      })).filter((m) => m.parts[0].text);
      while (formattedContents.length > 0 && formattedContents[0].role !== "user") {
        formattedContents.shift();
      }
      const response = await generateContentWithFallback(ai, {
        model: geminiChatModel(),
        contents: formattedContents,
        config: {
          systemInstruction
        }
      });
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.map((chunk) => {
        if (chunk.web) {
          return {
            title: chunk.web.title,
            uri: chunk.web.uri
          };
        }
        return null;
      }).filter(Boolean);
      return res.json({
        text: response.text,
        sources
      });
    } catch (error) {
      console.error("AI Chat Error:", error);
      return res.status(500).json({ error: "Celina AI could not answer right now. Please try again soon." });
    }
  });
  app.post("/api/create-checkout-session", requireOwnerSession, async (req2, res) => {
    try {
      const { tier, interval = "year", addonQuantity = 0 } = req2.body || {};
      if (!["basic", "pro", "premium"].includes(tier)) return res.status(400).json({ error: "Choose a paid Basic, Pro, or Premium plan." });
      if (!["month", "year"].includes(interval)) return res.status(400).json({ error: "Choose monthly or annual billing." });
      if (!Number.isInteger(addonQuantity) || addonQuantity < 0 || addonQuantity > 20) return res.status(400).json({ error: "Choose a valid number of additional listings." });
      if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Paid activation is temporarily unavailable. Please contact Celina Connection." });
      const owner = req2.ownerBusiness;
      if (req2.body.businessId && req2.body.businessId !== owner.id) return res.status(403).json({ error: "Choose your own business listing." });
      const stripe = getStripe();
      const plans = {
        basic: { name: "Local Pioneer (Basic)", month: 600, year: 6e3 },
        pro: { name: "Celina Champion (Pro)", month: 1600, year: 16e3 },
        premium: { name: "Preston Elite (Premium)", month: 2900, year: 29e3 }
      };
      const plan = plans[tier];
      const configuredPrice = process.env[`STRIPE_PRICE_ID_${tier.toUpperCase()}_${interval === "year" ? "ANNUAL" : "MONTHLY"}`] || (interval === "year" ? process.env[`STRIPE_PRICE_ID_${tier.toUpperCase()}`] : void 0);
      const amount = plan[interval];
      const line_items = [];
      if (configuredPrice) {
        const price = await stripe.prices.retrieve(configuredPrice);
        if (!price.active || price.unit_amount !== amount || price.currency !== "usd" || price.recurring?.interval !== interval || price.recurring.interval_count !== 1) {
          return res.status(503).json({ error: "The selected billing plan needs configuration. Please contact Celina Connection." });
        }
        line_items.push({ price: configuredPrice, quantity: 1 });
      } else {
        line_items.push({ price_data: { currency: "usd", product_data: { name: `Celina Connection \u2014 ${plan.name}` }, unit_amount: amount, recurring: { interval } }, quantity: 1 });
      }
      if (addonQuantity) line_items.push({ price_data: { currency: "usd", product_data: { name: "Additional business listing" }, unit_amount: interval === "year" ? 3600 : 400, recurring: { interval } }, quantity: addonQuantity });
      const appUrl = process.env.APP_URL || SITE_URL;
      const session = await stripe.checkout.sessions.create({
        line_items,
        mode: "subscription",
        success_url: `${appUrl}/dashboard?payment_status=success`,
        cancel_url: `${appUrl}/dashboard?payment_status=cancel`,
        metadata: { tier, userId: owner.ownerId, businessId: owner.id, addonQuantity: String(addonQuantity), interval }
      });
      return res.json({ url: session.url });
    } catch (error) {
      console.error("Stripe checkout failed:", error instanceof Error ? error.message : "Unknown error");
      return res.status(503).json({ error: "Checkout is temporarily unavailable. Your listing has not been activated." });
    }
  });
  app.post("/api/create-event-promotion-checkout-session", async (req2, res) => {
    try {
      const { userId, businessId, businessName, email, eventId } = req2.body || {};
      if (!userId || !email) {
        return res.status(401).json({ error: "Please sign in before promoting an event." });
      }
      if (eventId && businessId) {
        const business = await repository.getBusiness(String(businessId));
        const event = business?.events?.find((item) => String(item.id) === String(eventId));
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
      const host = req2.headers.host;
      const protocol = req2.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http");
      const appUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
      const stripe = getStripe();
      const priceIdEventPromotion = process.env.STRIPE_PRICE_ID_EVENT_PROMOTION;
      const eventPromotionAmount = Math.max(100, Number(process.env.STRIPE_EVENT_PROMOTION_AMOUNT_CENTS || 2500));
      const lineItem = priceIdEventPromotion ? { price: priceIdEventPromotion, quantity: 1 } : {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Celina Connection - Local Event Promotion",
            description: "Paid promotion review for one local special event, workshop, grand opening, or networking opportunity."
          },
          unit_amount: eventPromotionAmount
        },
        quantity: 1
      };
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [lineItem],
        mode: "payment",
        customer_email: email,
        success_url: eventId ? `${appUrl}/dashboard?payment_status=event_success#dashboard-events` : `${appUrl}/events?payment_status=event_success`,
        cancel_url: `${appUrl}/events?payment_status=cancel`,
        metadata: {
          purchaseType: "event_promotion",
          userId: String(userId),
          businessId: businessId || "",
          eventId: eventId || "",
          businessName: businessName || "",
          email: email || ""
        }
      });
      return res.json({ url: session.url });
    } catch (error) {
      console.error("Event Promotion Checkout error:", error);
      return res.status(500).json({ error: "We could not open event promotion checkout right now. Please try again in a moment." });
    }
  });
  return app;
}

// api/[...route].ts
var appInstance = null;
function getApp() {
  if (!appInstance) {
    try {
      appInstance = createApp();
    } catch (err) {
      console.error("Failed to initialize Express app:", err);
      throw err;
    }
  }
  return appInstance;
}
function handler(req2, res) {
  try {
    const app = getApp();
    if (req2.url && !req2.url.startsWith("/api") && !req2.url.startsWith("/api/")) {
      req2.url = "/api" + (req2.url.startsWith("/") ? req2.url : "/" + req2.url);
    }
    return app(req2, res);
  } catch (error) {
    console.error("Vercel API Handler Exception:", error);
    return res.status(500).json({
      error: "Server initialization error",
      details: error?.message || String(error)
    });
  }
}
export {
  handler as default
};
//# sourceMappingURL=route.mjs.map
