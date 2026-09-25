# Catch'em App

Ticker only. Live at **https://app.catchemtcg.com** (Cloudflare Worker).

The creation editor is **not this repo**. It lives in
[Tbaker-maker/Catchem-data](https://github.com/Tbaker-maker/Catchem-data)
and runs at
https://tbaker-maker.github.io/Catchem-data/research/assets/build.html

`src/CatchEm.jsx` is gone. It was a prototype. Nothing mounts it.

`site-public/build.html` is a pointer to that editor, not a copy of it.
The 68KB snapshot that used to sit there was stale. Do not treat it as
the product.

## Stack

- React 18 + Vite
- `src/Ticker.jsx` is the app
- Deploy: **Cloudflare Workers** via Wrangler (`wrangler.jsonc` → `catchem-app`, `wrangler.site.jsonc` → `catchem-site` for catchemtcg.com)

Not Cloudflare Pages.

## Local

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy        # app.catchemtcg.com
npm run deploy:site   # catchemtcg.com (static)
```

catchemtcg.com also deploys itself: Tbaker-maker/catchem-site is connected to
Workers Builds for the `catchem-site` Worker. A push to that repo's main runs
its `scripts/build.mjs`, which clones this repo and runs
`scripts/build-public-site.mjs` with catchem-site's `index.html` as the root.
The waitlist landing's source of truth is `index.html` in catchem-site
(`site-landing.html` was an older snapshot and is gone). After changing anything under
`site-public` inputs here, push to catchem-site (or run `npm run deploy:site`)
to publish.

## Data

Sealed prices from [Catchem-data](https://github.com/Tbaker-maker/Catchem-data). No API keys in client code.
