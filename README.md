# Celina Connection

Celina Connection is a Vite + React directory site with server-side API endpoints for:
- Gemini-powered directory search and chat
- Stripe Checkout session creation
- Google Maps client-side embeds

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

The local dev server runs the Vite frontend and Express API together on port `3000`.

## Vercel deployment

This repo is set up for Vercel with:
- `vercel.json` using the Vite output in `dist/`
- `api/index.ts` and `api/[...route].ts` exporting the shared Express app for `/api/*`
- shared API logic in `server/app.ts`

### Required environment variables

Set these in **Vercel → Project Settings → Environment Variables** for Production:

- `APP_URL=https://celinaconnection.com`
- `GEMINI_API_KEY`
- `GOOGLE_MAPS_PLATFORM_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_BASIC`
- `STRIPE_PRICE_ID_PRO_ANNUAL`
- `STRIPE_PRICE_ID_PREMIUM_ANNUAL`
- `STRIPE_PRICE_ID_PRO_MONTHLY`

Optional:
- `STRIPE_PRICE_ID_ADDON_ANNUAL`
- `STRIPE_PRICE_ID_PREMIUM_MONTHLY`
- `STRIPE_PRICE_ID_ADDON_MONTHLY`

### Production checks

After deployment, verify:

1. `GET /api/payment-config` returns `{"stripeEnabled":true}`
2. `GET /api/ai-config` returns `{"aiEnabled":true}`
3. Google Maps renders for listings with map modal access
4. Stripe checkout redirects use `https://celinaconnection.com`
5. `celinaconnection.com` and `www.celinaconnection.com` point to Vercel instead of GitHub Pages
