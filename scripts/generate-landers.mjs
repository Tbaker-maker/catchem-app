// scripts/generate-landers.mjs — SEO landers v1 (the #1 evidenced channel).
// One static page per tracked product at /p/{id}.html, regenerated from the
// live feed at every build, plus /p/index.html, sitemap.xml and robots.txt.
// Truth rules: eBay-native numbers only (median ask, clean floor, listings,
// per-pack, sealed-vs-loose premium). NO PPT/TCG-side numbers — publication
// of PPT-derived data is licensing-gated (research/ppt-licensing-note.md).
// JSON-LD Product ships offers only where the market is live; no-active-market
// pages say so in plain words and carry no prices. Zero fabricated data.
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (n) => n == null ? "—" :
  "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

const SUBTYPE_LABEL = {
  "booster-box": "Booster Box", "etb": "Elite Trainer Box",
  "pc-etb": "Pokemon Center Elite Trainer Box", "booster-bundle": "Booster Bundle",
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
const day = (tape.updatedAt || "").slice(0, 10);

// Feed (canonical CI-committed path): lifecycle + premium columns for the
// set hubs. Hub generation degrades gracefully if this fetch fails.
const FEED_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/pulse-feed.json";
let feed = null;
try { const r = await fetch(FEED_URL); if (r.ok) feed = await r.json(); }
catch { console.warn("landers: feed fetch failed — hubs get no lifecycle/premium columns this build"); }
const feedById = new Map((feed?.products ?? []).map(p => [p.id, p]));
// §19 Deal Zone — engine-computed referee numbers per product (all est.).
const dealZone = feed?.dealZone?.byId ?? {};

// The Deal Zone band, server-rendered per lander. One glance: seller floor
// → midpoint → buyer ceiling with the ask marked; a plain-English line per
// side; depth behind the methodology anchor. Every figure labeled est.
function dealZoneBlock(id) {
  const z = dealZone[id];
  if (!z) return "";
  const span = z.buyerCeiling - z.sellerFloor;
  const askPct = Math.min(97, Math.max(3, ((z.ask - z.sellerFloor) / span) * 100)).toFixed(1);
  return `
<div class="dz">
<i>Deal Zone (est.) · the show-floor referee</i>
<div class="dzband"><span class="dzask" style="left:${askPct}%"></span></div>
<div class="dzrow"><span>seller floor<b>${usd(z.sellerFloor)}</b></span><span>midpoint<b>${usd(z.midpoint)}</b></span><span>buyer ceiling<b>${usd(z.buyerCeiling)}</b></span></div>
<p class="read">A buyer pays about <b>${usd(z.buyerCeiling)}</b> online after shipping and tax (est.). A seller keeps about <b>${usd(z.sellerFloor)}</b> online after fees (est.). Any cash price between them beats eBay for both sides — the zone is ${usd(z.zoneWidth)} wide (${z.zonePct}% of the ask). <a href="/methodology#deal-zone">How this works →</a></p>
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
  const pts = (hist || []).map((h) => h.price).filter((v) => v != null).slice(-30);
  if (pts.length < 2) return "";
  const w = 260, h = 56, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = (w - 8) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(h - 6 - ((v - min) / span) * (h - 12)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="price history, ${pts.length} days"><path d="${d}" fill="none" stroke="${up ? "#36d399" : "#ef5a5a"}" stroke-width="2"/></svg>`;
};

function page(p) {
  const live = p.dataStatus === "live";
  const nam = p.dataStatus === "no-active-market";
  const label = SUBTYPE_LABEL[p.subtype] || p.subtype;
  const img = p.representativeImage || p.image || null;
  const url = `${SITE}/p/${p.id}.html`;

  const nPacks = packsFor(p);
  const perPack = live && nPacks > 1 && p.priceMedian != null
    ? p.priceMedian / nPacks : null;
  const loose = perPack != null ? looseBySet.get(p.setId) : null;
  const premiumPct = perPack != null && loose ? Math.round(100 * (perPack - loose) / loose) : null;

  const title = live
    ? `${p.name} Price — live eBay ask, clean floor${premiumPct != null ? ", premium" : ""}`
    : `${p.name} Price — tracked market, no live ask today`;
  const desc = live
    ? `Today's eBay ask median for ${p.name}: ${usd(p.priceMedian)} delivered (BIN-only). Cheapest clean listing ${usd(p.priceFloorClean)}, ${p.listingCount} active listings. Updated ${day}.`
    : nam
      ? `${p.name} shows no active eBay listings today — this market trades via auctions and sold comps. We show gaps, not guesses. Updated ${day}.`
      : `${p.name} is tracked by Catch'em but carries no publishable price today. Updated ${day}.`;

  const jsonld = live && p.priceFloorClean != null && p.priceHigh != null ? `
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Product",
    name: p.name, ...(img ? { image: img } : {}),
    description: `Sealed Pokemon TCG product, ${p.set} ${label}. Live eBay market stats aggregated by Catch'em.`,
    offers: {
      "@type": "AggregateOffer", priceCurrency: "USD",
      lowPrice: p.priceFloorClean, highPrice: p.priceHigh,
      offerCount: p.listingCount, availability: "https://schema.org/InStock",
    },
  })}</script>` : "";

  const fr = p.filterReport;
  const receipts = live
    ? `Source: eBay active listings, Browse API — Buy-It-Now only, delivered price (item + shipping), trimmed median, title-filtered${fr ? ` (${fr.kept} of ${fr.fetched} listings kept)` : ""}. English product only. Updated ${day}.`
    : `Source: eBay active listings, Browse API — the daily sweep found no publishable market. English product only. Updated ${day}.`;

  const siblings = products
    .filter((s) => s.setId === p.setId && s.id !== p.id).slice(0, 6)
    .map((s) => `<a href="/p/${s.id}.html">${esc(s.name)}</a>`).join(" · ");

  const stats = live ? `
<div class="hero">${usd(p.priceMedian)}<span class="sub">today's eBay ask median · delivered, BIN-only</span></div>
${spark(p.priceHistory)}
<div class="grid">
<div class="st"><i>Clean floor</i><b>${usd(p.priceFloorClean)}</b><span>cheapest clean listing</span></div>
<div class="st"><i>Today's high</i><b>${usd(p.priceHigh)}</b><span>top filtered ask</span></div>
<div class="st"><i>Active listings</i><b>${p.listingCount}</b><span>after title + price filters</span></div>
${perPack != null ? `<div class="st"><i>Per pack</i><b>${usd(perPack)}</b><span>median ÷ ${nPacks} packs</span></div>` : ""}
${premiumPct != null ? `<div class="st"><i>Sealed premium</i><b>${premiumPct > 0 ? "+" : ""}${premiumPct}%</b><span>vs the loose-pack lane (${usd(loose)}/pack)</span></div>` : ""}
</div>
<p class="read">Asks cluster between the clean floor and the median — offers under the floor are reaching; asks past the median need a reason.</p>
${dealZoneBlock(p.id)}`
    : `<div class="nam"><b>No active listings today.</b> ${nam
        ? "This market trades via auctions and sold comps, so there is no honest fair-range to print. We show gaps, not guesses."
        : "No publishable price cleared our filters today."}</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}">${img ? `\n<meta property="og:image" content="${esc(img)}">` : ""}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23141824'/%3E%3Ctext x='16' y='23' font-size='19' text-anchor='middle'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">${jsonld}
<style>:root{--bg:#0b0d14;--panel:#141824;--line:rgba(255,255,255,.07);--txt:#f4f5f8;--dim:#8a93a8;--gold:#ffb84d;--green:#36d399}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:15px/1.55 'Sora',system-ui,sans-serif;max-width:640px;margin:0 auto;padding:28px 18px 48px}
a{color:var(--green)}.wm{font:800 20px 'Syne',sans-serif;color:var(--txt);text-decoration:none}.wm b{color:var(--green)}
.crumb{font:11px 'JetBrains Mono',monospace;color:var(--dim);margin:14px 0 4px}.crumb a{color:var(--dim)}
h1{font-size:26px;letter-spacing:-.3px;margin:2px 0 14px}
img.ph{max-width:220px;width:100%;border-radius:10px;background:#070910;display:block;margin:0 0 16px}
.hero{font:700 40px 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;color:var(--green)}
.hero .sub{display:block;font:400 12px 'Sora',sans-serif;color:var(--dim);margin:4px 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}
.st{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px 13px}
.st i{font:11px 'JetBrains Mono',monospace;font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block}
.st b{font:700 19px 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}.st span{display:block;font-size:10.5px;color:var(--dim)}
.read{color:var(--dim);font-size:13px;margin:10px 0}
.nam{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;color:var(--dim);font-size:13.5px;margin:14px 0}.nam b{color:var(--txt)}
.receipts{font:11.5px/1.6 'JetBrains Mono',monospace;color:var(--dim);border-left:2px solid var(--gold);padding-left:12px;margin:20px 0}
.dz{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px;margin:16px 0}
.dz i{font:11px 'JetBrains Mono',monospace;font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px}
.dzband{position:relative;height:8px;border-radius:99px;background:rgba(54,211,153,.35)}
.dzask{position:absolute;top:-3px;width:3px;height:14px;background:var(--txt);border-radius:2px;transform:translateX(-50%)}
.dzrow{display:flex;justify-content:space-between;margin-top:8px;font-size:10.5px;color:var(--dim)}
.dzrow b{display:block;font:700 15px 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;color:var(--txt)}
.cta{display:inline-block;background:var(--green);color:#0b0d14;font-weight:700;border-radius:9px;padding:11px 18px;text-decoration:none;margin:8px 0 4px}
.sib{font-size:12px;color:var(--dim);margin-top:22px;line-height:2}
footer{margin-top:28px;font:11px 'JetBrains Mono',monospace;color:var(--dim)}</style></head><body>
<a class="wm" href="/">⚡CATCH<b>'EM</b></a>
<div class="crumb"><a href="/p/">all tracked products</a> · <a href="/sets/${esc(p.setId)}.html">${esc(p.set)}</a> · ${esc(label)}</div>
<h1>${esc(p.name)}</h1>
${img ? `<img class="ph" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : ""}
${stats}
<div class="receipts">${esc(receipts)}</div>
<a class="cta" href="/product/${p.id}">See the live read →</a>
<p class="read">The live page adds the price chart, range bar, movers Δ and a shareable stat card — every number carries its receipts. Or open <a href="/">the full ticker</a>.</p>
${siblings ? `<div class="sib">More from ${esc(p.set)}: ${siblings}</div>` : ""}
<div class="sib">All of ${esc(p.set)} at a glance: <a href="/sets/${esc(p.setId)}.html">the set page</a> · how we measure: <a href="/methodology.html">methodology</a></div>
<footer>Catch'em · catchemtcg.com — observational data, not financial advice. Prices are asks, not sales.</footer>
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
    const f = feedById.get(p.id) || {};
    const liveRow = p.dataStatus === "live";
    return `<tr><td><a href="/p/${p.id}.html">${esc(p.name)}</a></td><td>${esc(SUBTYPE_LABEL[p.subtype] || p.subtype)}</td>` +
      (liveRow
        ? `<td class="m">${usd(p.priceMedian)}</td><td class="m">${usd(p.priceFloorClean)}</td><td class="m">${p.listingCount ?? "—"}</td><td class="m">${f.perPack != null ? usd(f.perPack) : "—"}</td><td class="m">${f.vsLoosePct != null ? (f.vsLoosePct > 0 ? "+" : "") + f.vsLoosePct + "%" : "—"}</td>`
        : `<td class="m dim" colspan="5">no active listings — auctions & sold comps venue; we show gaps, not guesses</td>`) +
      `</tr>`;
  }).join("\n");
  const title = `${setName} sealed prices — every tracked product, live eBay stats`;
  const desc = `${ps.length} tracked ${setName} sealed products: eBay ask medians, clean floors, listing depth${life ? `, ${life.legalTag}` : ""}. Updated ${day}.`;
  const hubHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/sets/${setId}.html">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${SITE}/sets/${setId}.html">${logo ? `\n<meta property="og:image" content="${esc(logo)}">` : ""}
<style>:root{--bg:#0b0d14;--panel:#141824;--line:rgba(255,255,255,.07);--txt:#f4f5f8;--dim:#98a1b5;--gold:#ffb84d;--green:#36d399}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:14px/1.55 'Sora',system-ui,sans-serif;max-width:760px;margin:0 auto;padding:28px 18px 48px}
a{color:var(--green)}.crumb{font:11px 'JetBrains Mono',monospace;color:var(--dim);margin:14px 0 4px}.crumb a{color:var(--dim)}
h1{font-size:24px;margin:2px 0 10px}img.logo{max-width:200px;background:#070910;border-radius:10px;padding:8px;display:block;margin:6px 0 12px}
.life{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--dim);margin:0 0 16px}.life b{color:var(--txt)}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;background:var(--panel);border-radius:10px;overflow:hidden;font-size:12.5px}
th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
td{padding:9px 10px;border-bottom:1px solid var(--line)}.m{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}.dim{color:var(--dim)}
.mesh{font-size:12px;color:var(--dim);margin-top:20px;line-height:2}footer{margin-top:24px;font:11px 'JetBrains Mono',monospace;color:var(--dim)}</style></head><body>
<a href="/" style="font:800 20px 'Syne',sans-serif;color:var(--txt);text-decoration:none">⚡CATCH<span style="color:var(--green)">'EM</span></a>
<div class="crumb"><a href="/p/">all tracked products</a> · ${esc(setName)}</div>
<h1>${esc(setName)} — sealed, on the tape</h1>
${logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(setName)} logo" loading="lazy">` : ""}
<div class="life">${liveCt} of ${ps.length} tracked products live today${life ? ` · <b>${life.ageMonths}mo old</b> · ${esc(life.phase)} · ⚖ ${esc(life.legalTag)}` : ""} · updated ${day}</div>
<div class="tw"><table>
<tr><th>Product</th><th>Type</th><th>Median ask</th><th>Clean floor</th><th>Listings</th><th>Per pack</th><th>Vs loose</th></tr>
${rows}
</table></div>
<div class="mesh">Numbers: eBay active asks, BIN-only, delivered — <a href="/methodology.html">how we measure</a> · live app: <a href="/">the ticker</a> · today's stories: <a href="/studio">Studio</a></div>
<footer>Catch'em · catchemtcg.com — observational data, not financial advice. Prices are asks, not sales.</footer>
</body></html>`;
  await writeFile(join(OUT, "sets", `${setId}.html`), hubHtml);
}

// crawl hub: /p/index.html grouped by set
const bySet = new Map();
for (const p of products) { if (!bySet.has(p.set)) bySet.set(p.set, []); bySet.get(p.set).push(p); }
const hub = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Every tracked Pokemon TCG sealed product — live eBay prices | Catch'em</title>
<meta name="description" content="Live eBay ask medians, clean floors and listing depth for ${products.length} tracked sealed Pokemon TCG products. Updated ${day}.">
<link rel="canonical" href="${SITE}/p/">
<style>:root{--bg:#0b0d14;--txt:#f4f5f8;--dim:#8a93a8;--green:#36d399}*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--txt);font:14px/1.7 'Sora',system-ui,sans-serif;max-width:640px;margin:0 auto;padding:28px 18px 48px}
a{color:var(--green)}h1{font-size:22px;margin:12px 0}h2{font-size:13px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin:20px 0 4px}</style></head><body>
<a href="/" style="font-weight:800;font-size:18px;color:var(--txt);text-decoration:none">⚡CATCH<span style="color:var(--green)">'EM</span></a>
<h1>Every tracked sealed product (${products.length}) — updated ${day}</h1>
${[...bySet.entries()].map(([set, ps]) =>
  `<h2><a href="/sets/${esc(ps[0].setId)}.html">${esc(set)}</a></h2>${ps.map((p) => `<a href="/p/${p.id}.html">${esc(p.name)}</a>${p.dataStatus === "live" && p.priceMedian != null ? ` — ${usd(p.priceMedian)}` : ""}`).join("<br>")}`).join("")}
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
