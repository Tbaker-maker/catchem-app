// build-public-site.mjs — assembles ./site-public for the `catchem-site`
// Worker (catchemtcg.com). THE SPLIT (2026-08-22): every published link —
// cards, posts, newsletter — pointed at app.catchemtcg.com, so sharing
// anything exposed the untested app. The PUBLIC static surfaces now live
// on the marketing domain; the interactive app stays on app.* (gated).
//
// catchemtcg.com serves:  /  /methodology  /corrections  /pulse  /board
//                         /p/{id}  /sets/{id}  sitemap.xml  robots.txt
// (Workers assets serve extensionless — /methodology → methodology.html.)
//
// index.html = index.html from Tbaker-maker/catchem-site (the waitlist).
//
// Deploy: node scripts/build-public-site.mjs && npx wrangler deploy -c wrangler.site.jsonc
import { readFile, writeFile, mkdir, readdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writePublicRoutes } from "./public-routes.mjs";
import { stampHtml } from "../src/freshness.js";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "site-public");
const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets";

// Host + link rewrites for pages moving from the app domain to the public
// domain. The /product/{id} deep links point INTO the gated app — a public
// visitor would hit the auth wall, so they route to the landing (waitlist)
// until Tyler rules on a better CTA treatment.
const publicize = (html) =>
  html
    .replaceAll("https://app.catchemtcg.com", "https://catchemtcg.com")
    .replace(/href="\/product\/[^"]*"/g, 'href="/"');

const fetchOr = async (url, fallbackPath) => {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.text();
  } catch {}
  if (fallbackPath) { try { return await readFile(fallbackPath, "utf-8"); } catch {} }
  return null;
};

await mkdir(join(OUT, "p"), { recursive: true });
await mkdir(join(OUT, "sets"), { recursive: true });

// 1 · landing
// THE ROOT IS THE WAITLIST (2026-09-25). Source of truth: index.html in
// Tbaker-maker/catchem-site. Order: LANDING_FILE (a local path — the
// catchem-site Workers Build passes its own checkout) → catchem-site main on
// raw.githubusercontent. No local fallback: the old site-landing.html snapshot
// and the generated research/assets/index-landing.html are both older pages,
// and shipping one of them silently is worse than failing the deploy. If the
// fetch fails, the build throws and nothing is uploaded.
const SITE_RAW = "https://raw.githubusercontent.com/Tbaker-maker/catchem-site/main";
const isWaitlist = (h) => !!h && h.includes('id="wl"');
let landing = process.env.LANDING_FILE
  ? await readFile(process.env.LANDING_FILE, "utf-8")
  : await fetchOr(`${SITE_RAW}/index.html`);
if (!landing) throw new Error("no landing available — refusing to ship an empty root");
if (!isWaitlist(landing)) throw new Error("landing has no waitlist form — refusing to ship it");
await writeFile(join(OUT, "index.html"), publicize(landing));

// 1b · og image + favicon, kept beside the landing in catchem-site. og.png is
// stored as base64 text there because the repo is edited through tooling that
// only writes text files.
const ogB64 = process.env.LANDING_FILE
  ? await readFile(join(dirname(process.env.LANDING_FILE), "og.png.b64"), "utf-8").catch(() => null)
  : await fetchOr(`${SITE_RAW}/og.png.b64`);
if (ogB64) await writeFile(join(OUT, "og.png"), Buffer.from(ogB64.replace(/\s+/g, ""), "base64"));
const favicon = process.env.LANDING_FILE
  ? await readFile(join(dirname(process.env.LANDING_FILE), "favicon.svg"), "utf-8").catch(() => null)
  : await fetchOr(`${SITE_RAW}/favicon.svg`);
if (favicon) await writeFile(join(OUT, "favicon.svg"), favicon);

// 2 · methodology + corrections (freshest from the data repo; local mirror as fallback)
const meth = await fetchOr(`${RAW}/methodology.html`, join(ROOT, "public/methodology.html"));
if (!meth) throw new Error("methodology.html unavailable — public site must not ship without it");
await writeFile(join(OUT, "methodology.html"), publicize(meth));
const corr = await fetchOr(`${RAW}/corrections.html`);
if (!corr) throw new Error("corrections.html unavailable — methodology links to it; refusing to ship a 404");
await writeFile(join(OUT, "corrections.html"), publicize(corr));

// 3 · pulse + board. The stamp uses the pipeline clock, not the moment this
// build happened. A missing clock says Data delayed. Older than 48 hours
// keeps the date and adds STALE.
const RAW_DATA = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/ppt/run-report.json";
let runClock = null;
try {
  const report = JSON.parse(await fetchOr(RAW_DATA) || "null");
  runClock = report?.finishedAt || report?.startedAt || null;
} catch { runClock = null; }
const pulse = await fetchOr(`${RAW}/the-pulse.html`);
if (pulse) await writeFile(join(OUT, "pulse.html"), stampHtml(publicize(pulse), runClock));
const board = await fetchOr(`${RAW}/the-board.html`, join(ROOT, "public/the-board.html"));
if (board) await writeFile(join(OUT, "board.html"), stampHtml(publicize(board), runClock));

// 4 · landers + set hubs (committed fallback copies in public/)
let landers = 0, hubs = 0;
for (const f of await readdir(join(ROOT, "public/p"))) {
  if (!f.endsWith(".html")) continue;
  await writeFile(join(OUT, "p", f), publicize(await readFile(join(ROOT, "public/p", f), "utf-8")));
  landers++;
}
for (const f of await readdir(join(ROOT, "public/sets")).catch(() => [])) {
  if (!f.endsWith(".html")) continue;
  await writeFile(join(OUT, "sets", f), publicize(await readFile(join(ROOT, "public/sets", f), "utf-8")));
  hubs++;
}

// 5 · /build is not the editor. A 68KB snapshot used to ship here and
// people opened it thinking it was Catch'em Creators. The editor is
// Catchem-data on GitHub Pages. This path is a pointer.
const EDITOR = "https://tbaker-maker.github.io/Catchem-data/research/assets/build.html";
await writeFile(join(OUT, "build.html"),
  "<!doctype html><meta charset=\"utf-8\">" +
  "<meta http-equiv=\"refresh\" content=\"0;url=" + EDITOR + "\">" +
  "<link rel=\"canonical\" href=\"" + EDITOR + "\">" +
  "<title>Catch'em Creators</title>" +
  "<p><a href=\"" + EDITOR + "\">Open the editor</a></p>\n");
let creators = await fetchOr(`${RAW}/creators.html`);
if (creators) await writeFile(join(OUT, "creators.html"), publicize(creators));
// The FAQ was orphaned — real reader-facing content (the index, berries,
// provably-fair draws) written by no generator and reachable from nowhere. It
// has an owner now (scripts/build-faq.mjs from data/faq.json), so it can ship.
const faq = await fetchOr(`${RAW}/faq.html`);
if (faq) await writeFile(join(OUT, "faq.html"), publicize(faq));

// 5b · card index — served live since August by an earlier build; keep it.
const cardIndex = await fetchOr(`${RAW}/card-index.json`);
if (cardIndex) await writeFile(join(OUT, "card-index.json"), cardIndex);

// 6 · composites, served from our own domain so downloads need no CORS
let imgs = 0;
try {
  const names = JSON.parse(await (await fetch(
    "https://api.github.com/repos/Tbaker-maker/Catchem-data/contents/research/assets/img",
    { headers: { "User-Agent": "catchem-site-build" } })).text());
  if (Array.isArray(names)) {
    await mkdir(join(OUT, "img"), { recursive: true });
    for (const n of names.filter(x => x.name?.endsWith(".png"))) {
      const r = await fetch(n.download_url);
      if (!r.ok) continue;
      await writeFile(join(OUT, "img", n.name), Buffer.from(await r.arrayBuffer()));
      imgs++;
    }
  }
} catch { /* composites are an enhancement; the pages stand without them */ }

// 7 · robots + sitemap (host rewritten to the public domain)
await writeFile(join(OUT, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://catchemtcg.com/sitemap.xml\n");
try {
  const sm = await readFile(join(ROOT, "public/sitemap.xml"), "utf-8");
  await writeFile(join(OUT, "sitemap.xml"), sm.replaceAll("app.catchemtcg.com", "catchemtcg.com"));
} catch {}

await writePublicRoutes(OUT);

console.log(`✓ site-public assembled: landing + methodology + corrections${pulse ? " + pulse" : ""}${board ? " + board" : ""} + ${landers} landers + ${hubs} set hubs${ogB64 ? " + og.png" : ""} + /build pointer${creators ? " + /creators" : ""}${imgs ? ` + ${imgs} composite(s)` : ""} + /feed /try /app`);
console.log("  deploy: npx wrangler deploy -c wrangler.site.jsonc");
