# Celina Connection Backend Implementation Plan

> **For Hermes:** Implement this plan directly in this repo using strict TDD.

**Goal:** Replace browser-only directory persistence with a real server-owned backend using SQLite, seeded from the existing mock business catalog.

**Architecture:** Add a lightweight SQLite-backed repository layer under `server/`, expose REST endpoints for bootstrap, businesses, claims, reviews, bugs, and reset operations, then rewire `src/App.tsx` and affected components to use those endpoints instead of `localStorage` for authoritative directory data.

**Tech Stack:** Express, TypeScript, Node `node:sqlite`, Vite/React, Node built-in test runner.

---

### Task 1: Add backend tests for seeded bootstrap and business CRUD
- Create `tests/backend.test.ts`
- Cover bootstrap, create business, update business, claim business, add review, bug CRUD, reset
- Run failing test first

### Task 2: Add SQLite repository and seed logic
- Create `server/database.ts`
- Create tables for businesses and bugs
- Seed from `src/data/mockBusinesses.ts`
- Store nested data as JSON strings where appropriate

### Task 3: Expose REST endpoints in `server/app.ts`
- Add `/api/bootstrap`
- Add business create/read/update/delete endpoints
- Add claim/review/reset endpoints
- Add bug create/update/delete endpoints
- Keep existing AI/Stripe endpoints intact

### Task 4: Rewire frontend data loading in `src/App.tsx`
- Replace initial `localStorage` bootstrap for businesses/bugs with `/api/bootstrap`
- Keep temporary client-side session storage for `currentUser` only

### Task 5: Rewire mutation handlers to call backend
- `handleAddReview`
- `handleAddBusiness`
- `handleUpdateBusiness`
- `handleClaimBusiness`
- `handleDeleteBusiness`
- bug handlers
- reset handler
- checkout upgrade persistence path

### Task 6: Update component call sites for async handlers
- `DashboardView.tsx`
- `DirectoryView.tsx`
- Any prop types/call sites expecting sync `onAddBusiness`

### Task 7: Run verification
- `node --test --import tsx tests/backend.test.ts`
- `npm run lint`
- `npm run build`
