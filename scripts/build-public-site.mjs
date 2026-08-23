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
// index.html = site-landing.html, a committed snapshot of the live landing
// (the deployed page was fully self-contained; no source repo existed for
// the catchem-site Worker before this).
//
// Deploy: node scripts/build-public-site.mjs && npx wrangler deploy -c wrangler.site.jsonc
import { readFile, writeFile, mkdir, readdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
await writeFile(join(OUT, "index.html"), await readFile(join(ROOT, "site-landing.html"), "utf-8"));

// 2 · methodology + corrections (freshest from the data repo; local mirror as fallback)
const meth = await fetchOr(`${RAW}/methodology.html`, join(ROOT, "public/methodology.html"));
if (!meth) throw new Error("methodology.html unavailable — public site must not ship without it");
await writeFile(join(OUT, "methodology.html"), publicize(meth));
const corr = await fetchOr(`${RAW}/corrections.html`);
if (!corr) throw new Error("corrections.html unavailable — methodology links to it; refusing to ship a 404");
await writeFile(join(OUT, "corrections.html"), publicize(corr));

// 3 · pulse + board
const pulse = await fetchOr(`${RAW}/the-pulse.html`);
if (pulse) await writeFile(join(OUT, "pulse.html"), publicize(pulse));
const board = await fetchOr(`${RAW}/the-board.html`, join(ROOT, "public/the-board.html"));
if (board) await writeFile(join(OUT, "board.html"), publicize(board));

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

// 5 · creators + the editor
// THE INDEX IS FETCHED RELATIVE TO THE PAGE. build.html does a bare
// `fetch("card-index.json")`, and Workers assets serve extensionless — so the
// editor lives at /build with no trailing slash, which makes the relative base
// "/" and resolves the index to /card-index.json. Both therefore sit at the
// served ROOT. Putting them in a /build/ subdirectory instead would only work
// if every visitor arrived at the trailing-slash form, which nothing guarantees.
const editor = await fetchOr(`${RAW}/build.html`);
const index = await fetchOr(`${RAW}/card-index.json`);
let creators = await fetchOr(`${RAW}/creators.html`);
if (editor && index) {
  await writeFile(join(OUT, "build.html"), publicize(editor));
  await writeFile(join(OUT, "card-index.json"), index);
} else if (editor && !index) {
  // An editor with no index is a search box that finds nothing. Ship neither.
  throw new Error("build.html present but card-index.json missing — refusing to ship an editor that cannot load its catalogue");
}
if (creators) await writeFile(join(OUT, "creators.html"), publicize(creators));
// The FAQ was orphaned — real reader-facing content (the index, berries,
// provably-fair draws) written by no generator and reachable from nowhere. It
// has an owner now (scripts/build-faq.mjs from data/faq.json), so it can ship.
const faq = await fetchOr(`${RAW}/faq.html`);
if (faq) await writeFile(join(OUT, "faq.html"), publicize(faq));

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

console.log(`✓ site-public assembled: landing + methodology + corrections${pulse ? " + pulse" : ""}${board ? " + board" : ""} + ${landers} landers + ${hubs} set hubs${editor ? " + /build editor" : ""}${creators ? " + /creators" : ""}${imgs ? ` + ${imgs} composite(s)` : ""}`);
console.log("  deploy: npx wrangler deploy -c wrangler.site.jsonc");
