# Catch'em App

The Catch'em React application — Pokemon TCG market intelligence for collectors, flippers, and graders.

Live at: **https://app.catchemtcg.com** (once deployed)

Marketing site: https://catchemtcg.com

## Stack

- **React 18** — UI
- **Vite** — build tool + dev server
- **Deployment:** Cloudflare Pages

No CSS framework, no UI library, no state library, no routing library. Everything is in a single `CatchEm.jsx` component (for now).

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deployment

Auto-deploys to Cloudflare Pages on push to `main`. Build settings:

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 (via `NODE_VERSION=20` env var)

## Data sources

- **Sealed prices:** Fetched from [`catchem-data`](https://github.com/Tbaker-maker/catchem-data) via jsDelivr CDN
- **Card metadata + images:** [pokemontcg.io](https://pokemontcg.io/)
- **Exchange rates:** [Frankfurter API](https://www.frankfurter.app/)

No API keys are embedded in client code.

## Persistence

User state (mode, budget, collection, wishlist, plan, currency) persists via browser `localStorage`. No authentication yet — data is local to each browser.

## Brand

- Built for collectors. Loved by flippers. Trusted by graders.
- Signals, not advice.
