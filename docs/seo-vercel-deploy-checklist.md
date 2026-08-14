# SEO and Vercel Deploy Checklist

Use this checklist before pushing SEO, AEO, social preview, or routing changes to GitHub and Vercel.

## Local Verification

Run the required checks from the project root:

```bash
npm run lint
npm run build
npm test
```

Start the built server and inspect representative crawler endpoints:

```bash
npm run start
npm run seo:check
```

Stop the local server after inspection.

## Vercel Preview Verification

After pushing to GitHub, open the Vercel preview deployment and verify:

- Normal browser visits to `/`, `/directory`, `/directory/dining`, `/pricing`, and a `/business/:slug` URL load the React app.
- `SEO_CHECK_BASE_URL=https://your-vercel-preview-url.vercel.app npm run seo:check` passes against the preview URL.
- Bot/crawler rewrites return metadata HTML for:
  - `/api/share/page/directory`
  - `/api/share/category/dining`
  - `/api/share/business/annie-jack-boutique`
- `/sitemap.xml` includes public pages, category pages with listings, and business URLs.
- `/sitemap.xml` does not include `/dashboard`, `/owner-login`, or `/admin-login`.

## Production Social Preview Refresh

After production deployment:

- Use Facebook Sharing Debugger on one business URL and confirm `og:image` is the business listing image.
- Use LinkedIn Post Inspector on one business URL and one category URL.
- Re-share the business URL only after the debugger has scraped the updated metadata.

## Source of Truth

- Page-level SEO metadata lives in `src/lib/seoMetadata.ts`.
- Category landing metadata lives in `src/lib/categoryRoutes.ts`.
- Crawler HTML routes live in `server/app.ts`.
- Vercel bot rewrites live in `vercel.json`.
