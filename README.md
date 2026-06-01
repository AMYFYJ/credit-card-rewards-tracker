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
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Without those env vars, the app still works locally and saves to browser storage.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor. It creates the `reward_tracker_states` table, enables row-level security, and lets each signed-in user read and write only their own synced tracker state.

In Supabase Auth settings, enable email/password signups and turn off Confirm email for direct
in-app sign-in. Then add these redirect URLs for any future auth flows that need redirects:

- `http://localhost:5173`
- `https://amyfyj.github.io/credit-card-rewards-tracker/`
- Your Cloudflare Pages production URL, such as `https://credit-card-rewards-tracker.pages.dev`

## GitHub Pages deployment

The app deploys to GitHub Pages from the `gh-pages` branch. The deploy workflow builds on each push
to `main`; add these repository secrets so account sync is included in deployed builds:

```sh
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Cloudflare Pages deployment

Create a Cloudflare Pages project from this repository with:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

The app is configured as a PWA. After deployment, open the Cloudflare Pages URL on your phone and add it to the home screen.
