// scripts/generate-landers.mjs — SEO landers v1 (the #1 evidenced channel).
// One static page per tracked product at /p/{id}.html, regenerated from the
// live feed at every build, plus /p/index.html, sitemap.xml and robots.txt.
// Truth rules: eBay-native numbers only (median ask, lowest ask, listings,
// per-pack, sealed-vs-loose premium). NO PPT/TCG-side numbers — publication
// of PPT-derived data is licensing-gated (research/ppt-licensing-note.md).
// JSON-LD Product ships offers only where the market is live; no-active-market
// pages say so in plain words and carry no prices. Zero fabricated data.
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setLineBlock } from "./set-lines-view.mjs";
import { money, pretty, esc as escName, headerHtml, footerHtml, chromeCss, FONTS, stampLabel, sparkPrices } from "./lib/public-chrome.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public");
// PUBLIC/GATED SPLIT (2026-08-22): static surfaces (landers, set hubs,
// methodology, pulse, board) are PUBLIC and live on catchemtcg.com (the
// catchem-site Worker, built by scripts/build-public-site.mjs). The app
// domain is unlisted (noindex + robots-disallow; CF Access pending Tyler's
// dashboard). Canonicals point at the public host so search equity
// transfers there.
const SITE = "https://catchemtcg.com";
const TAPE_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/sealed-prices.json";

const esc = (s) => escName(pretty(s));
const usd = (n) => money(n) || "\u2014";

const SUBTYPE_LABEL = {
  "booster-box": "Booster Box", "etb": "Elite Trainer Box",
  "pc-etb": "Pokémon Center Elite Trainer Box", "booster-bundle": "Booster Bundle",
  "premium-collection": "Premium Collection", "upc": "Ultra-Premium Collection",
  "tin": "Tin", "collection-box": "Collection Box",
  "build-and-battle": "Build & Battle Box", "booster-pack": "Booster Pack",
  "surprise-box": "Surprise Box",
};

// ── fetch the tape ──────────────────────────────────────────────────────
let tape = null;
try {
  const r = await fetch(TAPE_URL);
  if (!r.ok) throw new Error("HTTP " + r.status);
  tape = await r.json();
} catch (e) {
  // Build resilience: a transient fetch failure must not brick unrelated
  // deploys — keep previously generated pages if any exist; hard-fail only
  // when there is nothing to serve (a first build must never ship no pages).
  const existing = await readdir(join(OUT, "p")).catch(() => []);
  if (existing.some((f) => f.endsWith(".html"))) {
    console.warn(`landers: tape fetch failed (${e.message}) — keeping ${existing.length} previously generated pages`);
    process.exit(0);
  }
  console.error(`landers: tape fetch failed (${e.message}) and no prior pages exist — aborting build`);
  process.exit(1);
}

const products = tape.products;
let finishedAt = tape.updatedAt || "";
try {
  const rr = await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/ppt/run-report.json");
  if (rr.ok) finishedAt = (await rr.json())?.finishedAt || finishedAt;
} catch { /* keep the tape clock */ }
const when = stampLabel(finishedAt);
const day = (finishedAt || "").slice(0, 10);

// Feed (canonical CI-committed path): lifecycle + premium columns for the
// set hubs. Hub generation degrades gracefully if this fetch fails.
const FEED_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/pulse-feed.json";
let feed = null;
try { const r = await fetch(FEED_URL); if (r.ok) feed = await r.json(); }
catch { console.warn("landers: feed fetch failed — hubs get no lifecycle/premium columns this build"); }
const feedById = new Map((feed?.products ?? []).map(p => [p.id, p]));
const LINES_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/derived/set-lines.json";
let setLines = null;
try { const r = await fetch(LINES_URL); if (r.ok) setLines = await r.json(); }
catch { console.warn("landers: set lines unavailable — hubs say building history"); }
const lineBySet = new Map((setLines?.sets || []).map((s) => [s.setId, s]));
// §19 Deal Zone — engine-computed referee numbers per product (all est.).
const dealZone = feed?.dealZone?.byId ?? {};

// The Deal Zone band, server-rendered per lander. One glance: lowest ask
// → midpoint → highest recent sale with the ask marked; a plain-English line per
// side; depth behind the methodology anchor. Every figure labeled est.
function dealZoneBlock(p, q) {
  if (!Number.isFinite(q.lowest) || !Number.isFinite(q.high) || q.high <= q.lowest || !money(q.lowest) || !money(q.high)) return "";
  const mark = Number.isFinite(q.median)
    ? Math.min(97, Math.max(3, ((q.median - q.lowest) / (q.high - q.lowest)) * 100))
    : 50;
  const z = dealZone[p.id];
  const kept = z ? money(z.sellerFloor) : null;
  const cost = z ? money(z.buyerCeiling) : null;
  const fee = kept && cost
    ? `<p class="read">Estimate only, not the prices above: after fees a seller keeps about <b>${kept}</b>. With tax a buyer pays about <b>${cost}</b>. <a href="/methodology#deal-zone">How this works</a></p>`
    : "";
  return `
<div class="dz" data-low="${q.lowest}" data-high="${q.high}" data-median="${Number.isFinite(q.median) ? q.median : ""}">
<i>Price range</i>
<div class="dzband"><span class="dzask" style="left:${mark.toFixed(1)}%"></span></div>
<div class="dzrow"><span>lowest ask<b>${usd(q.lowest)}</b></span><span>median<b>${usd(q.median)}</b></span><span>today's high<b>${usd(q.high)}</b></span></div>
${fee}
</div>`;
}


// Brand tokens sync (build-time): freshest tokens.css from Catchem-data —
// the acceptance contract is 'change tokens.css → the app follows on rebuild'.
// Committed src/tokens.css is the offline fallback.
try {
  const rt = await fetch('https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/brand/tokens.css');
  if (rt.ok) await writeFile(new URL('../src/tokens.css', import.meta.url), await rt.text());
} catch { /* keep committed fallback */ }

// Mirror the public methodology page onto the app domain at build time —
// gives the link mesh (and the newsletter) a stable app.catchemtcg.com URL.
try {
  const r = await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/methodology.html");
  if (r.ok) await writeFile(join(OUT, "methodology.html"), await r.text());
  // corrections.html is linked FROM methodology — shipping one without the
  // other 404s every reader who clicks through (found in audit 2026-08-22).
  const rc = await fetch("https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/corrections.html");
  if (rc.ok) await writeFile(join(OUT, "corrections.html"), await rc.text());
  else console.warn("  ⚠ corrections.html unavailable — methodology links to it and will 404");
} catch { console.warn("landers: methodology mirror fetch failed — keeping prior copy if any"); }

// Era-aware pack counts — mirrors packsFor() in Catchem-data/scripts/
// compute-derived.mjs exactly (same instrument, same exclusions); a per-SKU
// packs field on the tape wins when present.
function packsFor(p) {
  if (p.packs != null) return p.packs;
  const era = /^me/.test(p.setId || "") ? "me" : /^sv/.test(p.setId || "") ? "sv" : /^swsh/.test(p.setId || "") ? "swsh" : null;
  if ((p.setId || "") === "cel25") return null; // Celebrations: 4-card mini packs, not comparable
  if (p.subtype === "booster-pack") return 1;
  if (p.subtype === "booster-box") return 36;
  if (p.subtype === "booster-bundle") return 6;
  if (p.subtype === "etb" || p.subtype === "pc-etb") return era === "swsh" ? 8 : (era ? 9 : null);
  return null; // upc/premium/tins: counts vary — excluded honestly
}

const looseBySet = new Map();
for (const p of products)
  if (p.subtype === "booster-pack" && p.dataStatus === "live" && p.priceMedian != null)
    looseBySet.set(p.setId, p.priceMedian);

const spark = (hist) => {
  const pts = sparkPrices((hist || []).map((h) => h.price)).slice(-30);
  if (pts.length < 2) return "";
  const w = 260, h = 56, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = (w - 8) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(h - 6 - ((v - min) / span) * (h - 12)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="price history, ${pts.length} days"><path d="${d}" fill="none" stroke="${up ? "#7fc79a" : "#e0675b"}" stroke-width="2"/></svg>`;
};

function quoteOf(p) {
  const nPacks = packsFor(p);
  const median = p.dataStatus === "live" ? Number(p.priceMedian) : NaN;
  const lowest = Number(p.priceFloorClean);
  const high = Number(p.priceHigh);
  const perPack = Number.isFinite(median) && median > 0 && nPacks > 1 ? median / nPacks : null;
  const loose = perPack != null ? looseBySet.get(p.setId) : null;
  const premiumPct = perPack != null && loose ? Math.round(100 * (perPack - loose) / loose) : null;
  return { nPacks, median, lowest, high, perPack, loose, premiumPct };
}

function page(p) {
  const live = p.dataStatus === "live";
  const nam = p.dataStatus === "no-active-market";
  const label = SUBTYPE_LABEL[p.subtype] || p.subtype;
  const img = p.representativeImage || p.image || null;
  const url = `${SITE}/p/${p.id}.html`;
  const q = quoteOf(p);
  const title = live
    ? `${pretty(p.name)} price`
    : `${pretty(p.name)} — no listings right now`;
  const desc = live
    ? `${pretty(p.name)} median ${usd(q.median)}, lowest ask ${usd(q.lowest)}, ${p.listingCount} listings.`
    : `${pretty(p.name)} has no price to publish.`;
  const jsonld = live && money(q.lowest) && money(q.high) ? `
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Product",
    name: pretty(p.name), ...(img ? { image: img } : {}),
    description: `Sealed Pokémon TCG product, ${pretty(p.set)} ${label}.`,
    offers: {
      "@type": "AggregateOffer", priceCurrency: "USD",
      lowPrice: q.lowest, highPrice: q.high,
      offerCount: p.listingCount, availability: "https://schema.org/InStock",
    },
  })}</script>` : "";
  const siblings = products
    .filter((s) => s.setId === p.setId && s.id !== p.id).slice(0, 6)
    .map((s) => `<a href="/p/${s.id}.html">${esc(s.name)}</a>`).join(" · ");
  const stats = live ? `
<p class="byline">${when}</p>
<div class="hero" data-median="${Number.isFinite(q.median) ? q.median : ""}">${usd(q.median)}<span class="sub">median ask, delivered, fixed-price listings</span></div>
${spark(p.priceHistory)}
<div class="grid">
<div class="st" data-k="lowestAsk"><i>Lowest ask</i><b>${usd(q.lowest)}</b><span>cheapest clean listing</span></div>
<div class="st" data-k="high"><i>Today's high</i><b>${usd(q.high)}</b><span>highest ask we kept</span></div>
<div class="st"><i>Listings</i><b>${p.listingCount ?? "—"}</b><span>after title and price filters</span></div>
${q.perPack != null ? `<div class="st"><i>Per pack</i><b>${usd(q.perPack)}</b><span>median ÷ ${q.nPacks} packs</span></div>` : ""}
${q.premiumPct != null ? `<div class="st" data-k="premium"><i>Sealed premium</i><b>${q.premiumPct > 0 ? "+" : ""}${q.premiumPct}%</b><span>versus a loose pack (${usd(q.loose)})</span></div>` : ""}
</div>
<p class="read">Asks cluster between the lowest ask and the median. Offers under the lowest ask are reaching. Asks past the median need a reason.</p>
${dealZoneBlock(p, q)}`
    : `<p class="byline">${when}</p><div class="nam"><b>No listings to price.</b> ${nam
        ? "This one trades in auctions and sold comps, so there is no ask to print."
        : "Nothing cleared the filters."}</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}">${img ? `\n<meta property="og:image" content="${escName(img)}">` : ""}
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${FONTS}" rel="stylesheet">${jsonld}
<style>
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--faint:#9a9184;--gold:#d9b779;--green:#7fc79a;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:var(--bg);color:var(--txt);font:16px/1.55 var(--sans)}
${chromeCss}
main.col{max-width:680px;margin:0 auto;padding:22px 18px 36px}
.byline{color:var(--dim);font-size:14px;margin:0 0 12px}
.crumb{font-size:13px;color:var(--dim);margin:0 0 8px}.crumb a{color:var(--dim)}
h1{font:500 30px/1.15 var(--serif);letter-spacing:-.02em;margin:0 0 14px}
img.ph{max-width:220px;width:100%;border-radius:12px;background:var(--panel);display:block;margin:0 0 16px}
.hero{font:600 40px/1 var(--serif);font-variant-numeric:tabular-nums;color:var(--gold)}
.hero .sub{display:block;font:400 13px/1.4 var(--sans);color:var(--dim);margin:6px 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
.st{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.st i{font:600 11px/1 var(--sans);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block}
.st b{font:600 20px/1.2 var(--serif);font-variant-numeric:tabular-nums}.st span{display:block;font-size:12px;color:var(--dim)}
.read{color:var(--dim);font-size:14px;margin:10px 0}
.nam{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;color:var(--dim);margin:14px 0}.nam b{color:var(--txt)}
.dz{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin:16px 0}
.dz i{font:600 11px/1 var(--sans);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px}
.dzband{position:relative;height:8px;border-radius:99px;background:rgba(217,183,121,.35)}
.dzask{position:absolute;top:-3px;width:3px;height:14px;background:var(--txt);border-radius:2px;transform:translateX(-50%)}
.dzrow{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:var(--dim)}
.dzrow b{display:block;font:600 16px/1.2 var(--serif);font-variant-numeric:tabular-nums;color:var(--txt)}
.sib{font-size:14px;color:var(--dim);margin-top:18px;line-height:1.7}
a{color:var(--gold)}
</style></head><body>
${headerHtml("")}
<main class="col">
<div class="crumb"><a href="/p/">All tracked products</a> · <a href="/sets/${p.setId}.html">${esc(p.set)}</a> · ${esc(label)}</div>
<h1>${esc(p.name)}</h1>
${img ? `<img class="ph" src="${escName(img)}" alt="${esc(p.name)}" loading="lazy">` : `<span class="ph" style="display:block;height:120px"></span>`}
${stats}
${siblings ? `<div class="sib">More from ${esc(p.set)}: ${siblings}</div>` : ""}
<div class="sib"><a href="/sets/${p.setId}.html">The set page</a> · <a href="/board">The Board</a> · <a href="/methodology">How the numbers are made</a></div>
</main>
${footerHtml()}
</body></html>`;
}

// ── emit ────────────────────────────────────────────────────────────────
await mkdir(join(OUT, "p"), { recursive: true });
for (const p of products) await writeFile(join(OUT, "p", `${p.id}.html`), page(p));

// ── Set hubs: /sets/{setId}.html — logo, lifecycle + legality, products
// table with premiums; links down to landers, up to methodology + studio.
await mkdir(join(OUT, "sets"), { recursive: true });
const bySetId = new Map();
for (const p of products) { if (!bySetId.has(p.setId)) bySetId.set(p.setId, []); bySetId.get(p.setId).push(p); }
for (const [setId, ps] of bySetId) {
  const setName = ps[0].set;
  const life = feed?.lifecycle?.[setId];
  const logo = ps[0].image || null; // pokemontcg.io set logo from the catalog
  const liveCt = ps.filter(x => x.dataStatus === "live").length;
  const rows = ps.map(p => {
    const q = quoteOf(p);
    const liveRow = p.dataStatus === "live" && money(q.median);
    return `<tr data-id="${p.id}" data-low="${Number.isFinite(q.lowest) ? q.lowest : ""}" data-median="${Number.isFinite(q.median) ? q.median : ""}" data-premium="${q.premiumPct ?? ""}"><td><a href="/p/${p.id}.html">${esc(p.name)}</a></td><td>${esc(SUBTYPE_LABEL[p.subtype] || p.subtype)}</td>` +
      (liveRow
        ? `<td class="m">${usd(q.median)}</td><td class="m">${usd(q.lowest)}</td><td class="m">${p.listingCount ?? "—"}</td><td class="m">${q.perPack != null ? usd(q.perPack) : "—"}</td><td class="m">${q.premiumPct != null ? (q.premiumPct > 0 ? "+" : "") + q.premiumPct + "%" : "—"}</td>`
        : `<td class="m dim" colspan="5">no listings to price</td>`) +
      `</tr>`;
  }).join("\n");
  const title = `${pretty(setName)} sealed prices`;
  const desc = `${ps.length} tracked ${pretty(setName)} sealed products: median asks, lowest asks, and how many listings we kept.`;
  const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/sets/${setId}.html">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${SITE}/sets/${setId}.html">${logo ? `\n<meta property="og:image" content="${esc(logo)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${FONTS}" rel="stylesheet">
<style>
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--gold:#d9b779;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:#12100e;color:#efe9de;font:15px/1.55 'IBM Plex Sans',system-ui,sans-serif}
a{color:#d9b779}.crumb{font-size:13px;color:#b3aa9c;margin:0 0 8px}.crumb a{color:#b3aa9c}
h1{font:500 30px/1.15 'Fraunces',Georgia,serif;margin:0 0 10px}img.logo{max-width:200px;background:#1a1815;border-radius:12px;padding:8px;display:block;margin:6px 0 12px}
.life{background:#1a1815;border:1px solid #2f2b26;border-radius:12px;padding:12px 14px;font-size:14px;color:#b3aa9c;margin:0 0 16px}.life b{color:#efe9de}
.tw{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}table{min-width:640px;width:100%;border-collapse:collapse;background:#1a1815;border-radius:12px;font-size:14px}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#b3aa9c;text-align:left;padding:9px 10px;border-bottom:1px solid #2f2b26}
td{padding:9px 10px;border-bottom:1px solid #2f2b26}.m{font-variant-numeric:tabular-nums;white-space:nowrap}.dim{color:#b3aa9c}
.mesh{font-size:14px;color:#b3aa9c;margin-top:20px;line-height:1.7}
.site-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:14px 22px;border-bottom:1px solid #2f2b26}
.site-bar .logo{font:600 28px/1 'Fraunces',Georgia,serif;color:#efe9de;text-decoration:none}.site-bar .logo span{color:#d9b779}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 16px}.site-bar nav a{color:#b3aa9c;text-decoration:none;font:500 14.5px/1 'IBM Plex Sans',system-ui,sans-serif}
.site-bar nav a[aria-current="page"]{color:#d9b779}
main.col{max-width:860px;margin:0 auto;padding:22px 18px 28px}
.site-foot{max-width:860px;margin:0 auto;padding:8px 18px 48px;color:#9a9184;font-size:14px}
</style></head><body>
${headerHtml("")}
<main class="col">
<div class="crumb"><a href="/p/">All tracked products</a> · ${esc(setName)}</div>
<h1>${esc(setName)} sealed prices</h1>
${logo ? `<img class="logo" src="${escName(logo)}" alt="" loading="lazy">` : ""}
<p class="byline" style="color:#b3aa9c">${when}</p>
<div class="life">${liveCt} of ${ps.length} tracked products have a price${life ? ` · <b>${life.ageMonths} months old</b> · ${esc(life.phase)} · ${esc(life.legalTag)}` : ""}</div>
${setLineBlock(lineBySet.get(setId))}
<div class="tw"><table>
<tr><th>Product</th><th>Type</th><th>Median ask</th><th>Lowest ask</th><th>Listings</th><th>Per pack</th><th>Vs loose</th></tr>
${rows}
</table></div>
<div class="mesh"><a href="/methodology">How the numbers are made</a> · <a href="/board">The Board</a> · <a href="/feed">The Feed</a></div>
</main>
${footerHtml()}
</body></html>`;
  await writeFile(join(OUT, "sets", `${setId}.html`), hubHtml);
}

// crawl hub: /p/index.html grouped by set
const bySet = new Map();
for (const p of products) { if (!bySet.has(p.set)) bySet.set(p.set, []); bySet.get(p.set).push(p); }
const hub = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Every tracked Pokémon TCG sealed product | Catch'em</title>
<meta name="description" content="Medians and lowest asks for ${products.length} tracked sealed Pokémon TCG products. ${when}.">
<link rel="canonical" href="${SITE}/p/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${FONTS}" rel="stylesheet">
<style>
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--faint:#9a9184;--gold:#d9b779;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:var(--bg);color:var(--txt);font:15px/1.7 var(--sans)}
${chromeCss}
main.col{max-width:680px;margin:0 auto;padding:22px 18px 36px}
a{color:var(--gold)}h1{font:500 28px/1.2 var(--serif);margin:8px 0}h2{font:600 13px/1 var(--sans);color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin:20px 0 4px}
.byline{color:var(--dim)}
</style></head><body>
${headerHtml("")}
<main class="col">
<p class="byline">${when}</p>
<h1>Every tracked sealed product (${products.length})</h1>
${[...bySet.entries()].map(([set, ps]) =>
  `<h2><a href="/sets/${ps[0].setId}.html">${esc(set)}</a></h2>${ps.map((p) => `<a href="/p/${p.id}.html">${esc(p.name)}</a>${p.dataStatus === "live" && money(p.priceMedian) ? ` — ${usd(p.priceMedian)}` : ""}`).join("<br>")}`).join("")}
</main>
${footerHtml()}
</body></html>`;
await writeFile(join(OUT, "p", "index.html"), hub);

const lastmod = day || new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>
<url><loc>${SITE}/p/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>
${[...bySetId.keys()].map((s) => `<url><loc>${SITE}/sets/${s}.html</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}
${products.map((p) => `<url><loc>${SITE}/p/${p.id}.html</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}
</urlset>
`;
await writeFile(join(OUT, "sitemap.xml"), sitemap);
// The APP domain serves this copy — disallow all (public copies of every
// static page live on catchemtcg.com; the interactive app is unlisted).
await writeFile(join(OUT, "robots.txt"), `User-agent: *\nDisallow: /\n`);

console.log(`landers: ${products.length} pages + hub + sitemap + robots.txt (tape ${tape.updatedAt})`);
