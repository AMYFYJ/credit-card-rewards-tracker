# credit-card-rewards-tracker

A small React app for tracking monthly credit card reward opportunities.

It helps compare Bilt rent reward modes, monitor non-housing spend toward rent-point tiers, and keep Chase Freedom Flex and Discover rotating 5% categories organized for the current quarter.

## Local setup

Install dependencies and start the app:

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase values to enable account sync:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Without those env vars, the app still works locally and saves to browser storage.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor. It creates the `reward_tracker_states` table, enables row-level security, and lets each signed-in user read and write only their own synced tracker state.

In Supabase Auth settings, enable email magic links and add these redirect URLs:

- `http://localhost:5173`
- Your Cloudflare Pages production URL, such as `https://credit-card-rewards-tracker.pages.dev`

## Cloudflare Pages deployment

Create a Cloudflare Pages project from this repository with:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

The app is configured as a PWA. After deployment, open the Cloudflare Pages URL on your phone and add it to the home screen.
