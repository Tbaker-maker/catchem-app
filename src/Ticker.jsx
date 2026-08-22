// CATCH'EM — The Ticker + Retention v0 + product detail (app-specs §1 + §12,
// mockup v3 grammar). All client-side off pulse-feed.json. No auth, no
// backend, no new deps.
// Truth rules honored in code:
//  - Sparklines + Δ come from the feed's committed market history (heat-history,
//    post-2026-08-18 clean cut) — same lines for every visitor, first visit
//    included. Depth grows daily; short lines say how young the tape is.
//  - dailyThree.graded ships gated:true → renders locked, no numbers.
//  - Every number keeps its provenance chip → receipts drawer.
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

// Canonical feed path: research/pulse/ is in the daily run's commit list, so
// this URL updates every CI run (the old research/assets/ copy only moved
// when a human session committed it).
const FEED_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/pulse-feed.json";
// Deal Check (§13) reads the FULL tape — same repo, same client-side/zero-
// backend posture; lazy-fetched only when the Check tab opens, then cached
// to localStorage so checks work in convention halls with dead signal.
const TAPE_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/sealed-prices.json";
const STALE_HOURS = 36;
const DISCORD_ALERTS_URL = ""; // TODO(Tyler): discord.gg invite or #alerts channel link — 🔔 hidden while empty
// Email capture: iOS PWA push is unreliable — email is the retention hedge.
// Posts to the LIVE Formspree waitlist today (the same list newsletter 001
// imports from). TODO(Tyler): claim a buttondown.com username, set it here,
// and the form flips to Buttondown's embed endpoint — one constant, no markup.
const BUTTONDOWN_USERNAME = "catchemtcg";
const CAPTURE_URL = BUTTONDOWN_USERNAME
  ? `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`
  : "https://formspree.io/f/xgorlypa";

/* ── v3 design tokens ─────────────────────────────────────────────────── */
const css = `
/* :root tokens come from src/tokens.css — synced from the live site via
   Catchem-data (node scripts/sync-brand-tokens.mjs). The inline block that
   lived here was the drift vector; change tokens.css, the app follows. */
*{box-sizing:border-box}
.tk-root{--site-btn-pad:14px 24px;--site-btn-radius:10px;--site-col:820px;--site-col-wide:1040px;background:var(--bg);color:var(--txt);min-height:100vh;font:14px/1.5 var(--sans);
display:flex;justify-content:center}
.tk-phone{width:100%;max-width:420px;padding:0 14px calc(84px + env(safe-area-inset-bottom))}
/* ── DESIGN SYSTEM (brand-tokens.md, Aug 22): COLUMN-LOCK ────────────────
   The site and the app share the column. Cards stay 300–400px and
   MULTIPLY inside it — they never grow to fill width. Section headers
   span the column. Mobile is the same card at one-per-row (unchanged). */
@media(min-width:880px){
  .tk-phone{max-width:var(--site-col,820px);display:grid;
    grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
    column-gap:16px;align-items:start}
  .tk-phone > *{grid-column:1/-1;min-width:0}
  .tk-phone > .c3,.tk-phone > .mrow{grid-column:auto}
  .tk-head{grid-column:1/-1}
}
@media(min-width:1200px){.tk-phone{max-width:var(--site-col-wide,1040px)}}
/* accent-dim: informational accent at 40%, BORDERS ONLY — never fills */
.mrow{border-left-color:var(--acc-dim,var(--acc,var(--green)))}
/* long names wrap to two lines on cards — truncation was hiding the product TYPE ("…Pokemon C" lost "Elite Trainer Box"); clamp keeps card height bounded */
.c3 .nm{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tk-head{display:flex;justify-content:space-between;align-items:center;gap:8px;
padding:16px 0 12px;position:sticky;top:0;background:var(--bg);z-index:5}
.tk-wm{font:800 22px/1.2 var(--disp)}.tk-wm b{color:var(--green)}
.tk-hright{display:flex;align-items:center;gap:8px}
.tk-streak{font:700 10px var(--mono);color:var(--gold);background:rgba(255,184,77,.1);
border:1px solid rgba(255,184,77,.35);border-radius:99px;padding:3px 8px}
.tk-date{font:400 10px var(--mono);font-variant-numeric:tabular-nums;color:var(--dim)}
.tk-refresh,.tk-bell{background:transparent;border:1px solid var(--line);color:var(--dim);
border-radius:10px;font-size:12px;min-width:32px;min-height:32px;cursor:pointer}
.tk-banner{background:rgba(239,90,90,.1);border:1px solid rgba(239,90,90,.35);color:var(--red);
border-radius:12px;padding:12px 16px;font-size:12.5px;line-height:1.5;margin:8px 0 12px}
.tk-idx{background:var(--panel);border:1px solid var(--line);border-radius:16px;
padding:14px 16px;display:flex;align-items:center;gap:16px;margin-bottom:14px}
.tk-idx .big{font:var(--num-xl,700 40px var(--mono));font-variant-numeric:tabular-nums}
.tk-idx .cell{flex:1}
.lbl{font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim)}
.tk-bar{height:5px;background:var(--raised);border-radius:99px;overflow:hidden;margin-top:6px}
.tk-fill{height:100%;background:var(--green)}
.tk-sec{font:700 11px var(--mono);color:var(--dim);letter-spacing:.08em;
text-transform:uppercase;margin:32px 0 12px;display:flex;justify-content:space-between;align-items:center}
.c3{background:var(--panel);border:1px solid var(--line);border-radius:16px;
padding:14px;margin-bottom:10px;display:flex;gap:12px;height:100%}
/* Daily Three: three cards of different content lengths were rendering three
   different heights (Tyler, 2026-08-22). Grid + stretch makes them match. */
.d3row{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;align-items:stretch}
.d3row>*{margin-bottom:0}
.c3 img{width:76px;height:76px;object-fit:contain;border-radius:8px;background:#070910;align-self:flex-start;cursor:zoom-in}
/* 76px is a thumbnail on a 400px card — desktop has the room and we now hold
   1000px sources (Tyler, 2026-08-22). Tap any product photo to enlarge. */
@media(min-width:880px){.c3 img{width:104px;height:104px}}
.lbx{position:fixed;inset:0;background:rgba(7,9,16,.94);display:flex;align-items:center;justify-content:center;z-index:90;padding:24px;cursor:zoom-out}
.lbx img{max-width:min(680px,92vw);max-height:86vh;object-fit:contain;border-radius:16px;background:#0b0d14;border:1px solid var(--line)}
.lbx .cap{position:absolute;bottom:22px;left:0;right:0;text-align:center;color:var(--dim);font-size:13px;padding:0 20px}
.c3b{flex:1;min-width:0}
.c3t{display:flex;align-items:center;gap:8px}
.nm{font-size:13.5px;font-weight:600;display:block;margin:3px 0 1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hero{font:700 23px var(--mono);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:10px}
.spk{margin-left:auto;flex:none}
.strip{display:flex;gap:6px;margin:7px 0 6px;flex-wrap:wrap}
.st{background:var(--raised);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-size:10px;color:var(--dim)}
.st b{display:block;color:var(--txt);font:700 11.5px var(--mono);font-variant-numeric:tabular-nums}
.why{font-size:11.5px;color:var(--dim);line-height:1.45}
.chip{font:700 9px var(--mono);letter-spacing:.05em;padding:2px 7px;border-radius:99px;
border:1px solid var(--line);color:var(--dim);margin-left:auto;cursor:pointer;flex:none}
.chip.v{color:var(--green);border-color:var(--green)}
.chip.g{color:var(--gold);border-color:var(--gold)}
.chip.p{color:var(--purple);border-color:var(--purple)}
.d{font:700 10.5px var(--mono);font-variant-numeric:tabular-nums}
.d.u{color:var(--green)}.d.dn{color:var(--red)}.d.n{color:var(--dim)}
.star{background:none;border:none;font-size:17px;line-height:1;cursor:pointer;color:#5c637a;
min-width:36px;min-height:36px;flex:none}
.star.on{color:var(--gold)}
.mvs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mv{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px;
display:flex;align-items:center;gap:7px;font-size:10.5px}
.mv b{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.brow{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.brow img{width:42px;height:42px;object-fit:contain;border-radius:8px;background:#070910}
.bmid{flex:1;min-width:0}
.bmid b{font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bmid span{font-size:10px;color:var(--dim)}
.bnum{text-align:right;font:700 14px var(--mono);font-variant-numeric:tabular-nums}
.bnum .d{display:block}
.search{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--txt);
border-radius:10px;padding:10px 12px;font:400 13px var(--sans);margin-bottom:8px}
.fchips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.fchip{background:var(--panel);border:1px solid var(--line);color:var(--dim);border-radius:99px;
padding:6px 12px;font-size:11px;cursor:pointer;min-height:32px}
.fchip.on{color:var(--acc,var(--green));border-color:var(--acc,var(--green))}
/* §20 MODES — a lens, not a filter: accent + order only. --acc tints
   chips and section headers; numbers never change with it. */
.tk-root{--acc:var(--green);--acc-dim:color-mix(in srgb, var(--acc) 40%, transparent)}
.tk-root.m-flipper{--acc:#64a0ff}
.tk-root.m-grader{--acc:#c77dff}
.tk-root.m-collector{--acc:#36d399}
.tk-sec{border-left:2px solid var(--acc,transparent);padding-left:7px}
@media(min-width:880px){
  .tk-sec{border-left:0;padding-left:0;border-top:1px solid var(--line);padding-top:var(--section-space-1,32px);padding-bottom:6px;font:700 26px/1.15 var(--disp);letter-spacing:0;text-transform:none;color:var(--txt)}
  .tk-sec .lbl,.tk-sec button.lbl{font:700 11px var(--mono);letter-spacing:.08em}
}
.mode-lead{font:600 13px var(--sans);color:var(--txt);margin:2px 0 12px}
.mode-lead b{color:var(--acc,var(--green))}
.mrow{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--acc,var(--green));border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:13px}
.mrow b{font-family:var(--mono);font-variant-numeric:tabular-nums}
.tabs{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;
display:grid;grid-template-columns:repeat(4,1fr);background:#0b0d14;border-top:1px solid var(--line);
padding-bottom:env(safe-area-inset-bottom);z-index:20}
.tab{background:none;border:none;color:var(--dim);font:600 10.5px var(--sans);padding:10px 0 8px;
min-height:52px;cursor:pointer}
.tab.on{color:var(--green)}
.tab i{display:block;font-size:16px;font-style:normal;margin-bottom:2px}
.tk-agree{border:1px solid rgba(54,211,153,.35);background:var(--panel);
text-align:center;padding:24px 16px;border-radius:16px;margin-bottom:12px}
.tk-agree b{color:var(--green);font-size:15px}
.note{font-size:10.5px;color:var(--dim);margin-top:9px;line-height:1.5}
.tool{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--panel);
border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:10px;cursor:pointer;color:var(--txt)}
.ticon{font-size:20px;flex:none;width:28px;text-align:center}
.tbody{flex:1;min-width:0}.tbody b{display:block;font-size:13.5px}
.tbody span{display:block;font:400 10.5px var(--mono);color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tgo{color:var(--dim);font-size:18px;flex:none}
.idot{background:none;border:none;color:var(--dim);font-size:13px;line-height:1;cursor:pointer;
padding:0 4px;min-width:28px;min-height:28px;vertical-align:middle}
.idot:active{color:var(--green)}
.locked{border-style:dashed;border-color:rgba(255,255,255,.18)}
.drawer-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40}
.drawer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:420px;
background:#0b0d14;border:1px solid var(--line);border-radius:16px 16px 0 0;
padding:16px 16px calc(24px + env(safe-area-inset-bottom));z-index:50}
.drawer h4{margin:0 0 8px;font-size:13px}
.receipt{font:400 11.5px/1.6 var(--mono);color:var(--dim);border-left:2px solid var(--line);
padding-left:10px;margin:8px 0;word-break:break-word}
.disc{font:400 10.5px/1.5 var(--mono);color:var(--gold);opacity:.85;margin-top:10px}
.skel{background:var(--panel);border:1px solid var(--line);border-radius:16px;height:76px;
margin-bottom:10px;position:relative;overflow:hidden}
.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
background:var(--raised);animation:shim 1.4s infinite}
@keyframes shim{100%{transform:translateX(100%)}}
.load{padding:24px 0;text-align:center;color:var(--dim);font:400 12px var(--mono)}
.cmpsel{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--txt);
border-radius:10px;padding:10px;font:400 12.5px var(--sans);margin-bottom:8px}
.cap{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:18px 0}
.cap b{font-size:13.5px}
.eras{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;-webkit-overflow-scrolling:touch}
.era{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:150px;flex:none}
.elvl{font:700 18px var(--mono);font-variant-numeric:tabular-nums;margin:2px 0}
.esub{font:400 9.5px var(--mono);color:var(--dim)}
.dt-name{font:700 20px/1.25 var(--disp);margin:4px 0 0}
.grid6{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}
.grid6 .st{padding:7px 9px}
`;

/* ── storage helpers ─────────────────────────────────────────────────── */
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const CURR = { c: (typeof localStorage!=="undefined" && localStorage.getItem("cur")) || "USD", r: null }; // display-only; data stays USD-native
const fmt = (n) => { if (n == null) return "—";
  if (CURR.c === "CAD" && CURR.r) return "CA$" + Number(n * CURR.r).toLocaleString("en-CA", { maximumFractionDigits: 2 });
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); };
const pctFmt = (n) => n == null ? "" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

/* Build a product index from every feed section that carries ids+prices. */
function buildIndex(feed) {
  const ix = new Map();
  const put = (id, patch) => { if (!id) return; ix.set(id, { id, ...ix.get(id), ...patch }); };
  // Base layer: the full 168-product catalog (feed.products) — gives Board,
  // detail pages and search the whole tracked tape, not just today's signals.
  for (const p of feed.products || [])
    put(p.id, { name: p.name, set: p.set, setId: p.setId, subtype: p.subtype, status: p.status,
      vintage: !!p.vintage, price: p.median, floor: p.floor, high: p.high, listings: p.listings,
      imageUrl: p.img, perPack: p.perPack, loosePack: p.loosePack, vsLoosePct: p.vsLoosePct, packs: p.packs });
  for (const s of feed.signals || [])
    put(s.id, { name: s.name, price: s.ebay?.ask, listings: s.ebay?.listings, spreadPct: s.spreadPct,
      tcg: s.tcg?.market, imageUrl: s.imageUrl, chip: s.class, provenance: s.provenance, why: s.read });
  for (const d of feed.depthReads || [])
    put(d.id, { name: d.name, price: d.price ?? ix.get(d.id)?.price, listings: d.listings, flow: d.read, chip: d.chip });
  for (const bucket of ["priciest", "cheapest"])
    for (const r of feed.packMath?.[bucket] || [])
      put(r.id, { name: r.name, subtype: r.subtype, price: r.price, listings: r.listings, perPack: r.perPack, packs: r.packs });
  for (const p of ix.values()) {
    p.setId = p.setId || p.id.split("-")[0];
    p.subtype = p.subtype || p.id.split("-").slice(1).join("-");
  }
  return ix;
}

const parseRoute = () => {
  const path = window.location.pathname;
  const m = path.match(/^\/product\/([\w.'-]+)/);
  if (m) return { name: "product", id: m[1] };
  if (path.startsWith("/overlay")) return { name: "overlay" };
  if (path.startsWith("/studio/archive")) return { name: "studio-archive" };
  if (path.startsWith("/studio/posts")) return { name: "studio-posts", mine: new URLSearchParams(window.location.search).get("mine") === "1" };
  if (path.startsWith("/studio")) return { name: "studio" };
  if (path.startsWith("/show")) return { name: "show" };
  const tool = path.match(/^\/tools\/([a-z-]+)/);
  if (tool) return { name: "tool", tool: tool[1] };
  // legacy tab URLs redirect into Tools (IA v2, §15)
  if (path === "/check") return { name: "tool", tool: "check" };
  if (path === "/compare") return { name: "tool", tool: "compare" };
  if (path === "/movers") return { name: "tool", tool: "movers" };
  return null;
};

const KITS_ARCHIVE_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/kits-archive.json";

/* Market history from the feed: history[id] = [[date, price, listings], …]
   (committed heat-history, post-2026-08-18 clean cut — same for everyone). */
const seriesFor = (feed, id) => (feed?.history?.[id] ?? []).map(r => r[1]);
function deltaFor(feed, id) {
  const h = feed?.history?.[id];
  if (!h || h.length < 2) return null;
  const prev = h[h.length - 2][1], cur = h[h.length - 1][1];
  if (prev == null || cur == null || prev === 0) return null;
  return { pct: ((cur - prev) / prev) * 100, prev };
}

/* streak: consecutive-day visit counter (cosmetic only) */
function bumpStreak(today) {
  const s = lsGet("streak:v1", { last: null, days: 0 });
  if (s.last === today) return s.days;
  const y = new Date(new Date(today) - 86400000).toISOString().split("T")[0];
  const days = s.last === y ? s.days + 1 : 1;
  lsSet("streak:v1", { last: today, days });
  return days;
}

/* ── small components ────────────────────────────────────────────────── */
function Spark({ pts, w = 56, h = 20 }) {
  if (!pts || pts.length < 2)
    return <svg className="spk" width={w} height={h} aria-label="sparkline pending"><line x1="2" y1={h/2} x2={w-2} y2={h/2} stroke="#5c637a" strokeDasharray="3 3" /></svg>;
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const step = (w - 4) / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${2 + i * step},${h - 3 - ((v - min) / span) * (h - 6)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return <svg className="spk" width={w} height={h}><path d={d} fill="none" stroke={up ? "#36d399" : "#ef5a5a"} strokeWidth="1.6" /></svg>;
}
const Delta = ({ d }) =>
  d == null ? <span className="d n">—</span> :
  <span className={`d ${d.pct >= 0.05 ? "u" : d.pct <= -0.05 ? "dn" : "n"}`}>{d.pct >= 0 ? "▲" : "▼"}{Math.abs(d.pct).toFixed(1)}%</span>;
const Chip = ({ cls, onTap }) => {
  const tone = cls === "VERIFIED" ? "v" : cls === "MEASURED" ? "p" : "g";
  return <span className={`chip ${tone}`} onClick={onTap} role="button">{cls === "VERIFIED" ? "VERIFIED" : cls === "MEASURED" ? "MEASURED" : "READ"}</span>;
};

/* Branded share card (canvas PNG). One renderer powers Deal Check (§13) and
   the product detail page; Studio (§14) rides it later. x needs {name, median,
   floorClean, listings, vintage, img}. */
function renderShareCard(x, dateStr, setShareImg) {
  const cv = document.createElement("canvas");
  cv.width = 500; cv.height = 620;
  const g = cv.getContext("2d");
  const draw = (photo) => {
    g.fillStyle = "#0b0d14"; g.fillRect(0, 0, 500, 620);
    g.fillStyle = "#141824"; g.strokeStyle = "rgba(255,255,255,.12)";
    g.fillRect(20, 20, 460, 580); g.strokeRect(20, 20, 460, 580);
    g.fillStyle = "#f4f5f8"; g.font = "800 26px Syne, sans-serif";
    g.fillText("⚡CATCH", 40, 62);
    g.fillStyle = "#36d399"; g.fillText("'EM", 158, 62);
    g.fillStyle = "#8a93a8"; g.font = "700 11px 'JetBrains Mono', monospace";
    g.fillText("DEAL CHECK · " + dateStr, 40, 84);
    if (photo) { try { g.drawImage(photo, 150, 100, 200, 200); } catch {} }
    g.fillStyle = "#f4f5f8"; g.font = "600 19px Sora, sans-serif";
    const nm = x.name.length > 38 ? x.name.slice(0, 36) + "…" : x.name;
    g.fillText(nm, 40, photo ? 336 : 150);
    const y0 = photo ? 360 : 180;
    g.fillStyle = "#36d399"; g.font = "700 44px 'JetBrains Mono', monospace";
    g.fillText(fmt(x.median), 40, y0 + 44);
    g.fillStyle = "#8a93a8"; g.font = "700 11px 'JetBrains Mono', monospace";
    g.fillText("TODAY'S EBAY MEDIAN (DELIVERED, BIN-ONLY)", 40, y0 + 64);
    g.fillStyle = "#f4f5f8"; g.font = "700 20px 'JetBrains Mono', monospace";
    g.fillText(fmt(x.floorClean), 40, y0 + 104);
    g.fillStyle = "#8a93a8"; g.font = "700 11px 'JetBrains Mono', monospace";
    g.fillText("CHEAPEST CLEAN LISTING", 40, y0 + 122);
    g.fillText(String(x.listings ?? "—") + " ACTIVE LISTINGS" + (x.vintage ? "  ·  EBAY-NATIVE VENUE" : ""), 40, y0 + 148);
    g.fillStyle = "#ffb84d"; g.font = "600 12px Sora, sans-serif";
    g.fillText("asks cluster between clean floor and median", 40, y0 + 176);
    g.fillStyle = "#5c637a"; g.font = "600 11px Sora, sans-serif";
    g.fillText("catchemtcg.com — every number carries its receipts", 40, 578);
    try { setShareImg(cv.toDataURL("image/png")); }
    catch { if (photo) draw(null); else setShareImg(null); }
  };
  if (x.img) {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => draw(im);
    im.onerror = () => draw(null);
    im.src = x.img;
  } else draw(null);
}

/* §19 Deal Zone share card — the asset shown ACROSS a table, so it is built
   for arm's length: three huge mono numbers, a band, nothing subtle. PNG
   only (canvas → dataURL), every figure labeled EST., USD stamped. */
function renderDealZoneCard(x, z, dateStr, setShareImg) {
  const cv = document.createElement("canvas");
  cv.width = 500; cv.height = 640;
  const g = cv.getContext("2d");
  // money on this card always shows cents — "$2,836.3" reads like a typo
  // across a table (the shared fmt drops trailing zeros)
  const fmt = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const draw = (photo) => {
    g.fillStyle = "#0b0d14"; g.fillRect(0, 0, 500, 640);
    g.fillStyle = "#141824"; g.strokeStyle = "rgba(255,255,255,.12)";
    g.fillRect(20, 20, 460, 600); g.strokeRect(20, 20, 460, 600);
    g.fillStyle = "#f4f5f8"; g.font = "800 26px Syne, sans-serif";
    g.fillText("⚡CATCH", 40, 62);
    g.fillStyle = "#36d399"; g.fillText("'EM", 158, 62);
    g.fillStyle = "#8a93a8"; g.font = "700 11px 'JetBrains Mono', monospace";
    g.fillText("DEAL ZONE · " + dateStr + " · USD · ALL FIGURES EST.", 40, 84);
    if (photo) { try { g.drawImage(photo, 175, 96, 150, 150); } catch {} }
    g.fillStyle = "#f4f5f8"; g.font = "600 18px Sora, sans-serif";
    const nm = x.name.length > 40 ? x.name.slice(0, 38) + "…" : x.name;
    g.fillText(nm, 40, photo ? 276 : 130);
    const y0 = photo ? 292 : 150;
    // the band: flat green zone, white ask marker (brand law: no gradients)
    g.fillStyle = "rgba(54,211,153,.35)"; g.fillRect(40, y0 + 8, 420, 16);
    const askPct = Math.min(0.97, Math.max(0.03, (z.ask - z.sellerFloor) / (z.buyerCeiling - z.sellerFloor)));
    g.fillStyle = "#f4f5f8"; g.fillRect(40 + 420 * askPct - 2, y0, 4, 32);
    g.fillStyle = "#8a93a8"; g.font = "700 10px 'JetBrains Mono', monospace";
    g.fillText("ASK " + fmt(z.ask), Math.min(360, Math.max(40, 40 + 420 * askPct - 30)), y0 + 46);
    const row = (label, val, y, color) => {
      g.fillStyle = color; g.font = "700 40px 'JetBrains Mono', monospace";
      g.fillText(fmt(val), 40, y);
      g.fillStyle = "#8a93a8"; g.font = "700 12px 'JetBrains Mono', monospace";
      g.fillText(label, 40, y + 20);
    };
    row("SELLER FLOOR — KEEPS THIS ONLINE, AFTER FEES (EST.)", z.sellerFloor, y0 + 106, "#f4f5f8");
    row("MIDPOINT — THE FAIR HANDSHAKE", z.midpoint, y0 + 176, "#36d399");
    row("BUYER CEILING — PAYS THIS ONLINE, W/ TAX (EST.)", z.buyerCeiling, y0 + 246, "#f4f5f8");
    g.fillStyle = "#ffb84d"; g.font = "600 13px Sora, sans-serif";
    g.fillText("Any cash price in the band beats eBay — for both sides.", 40, y0 + 286);
    g.fillStyle = "#5c637a"; g.font = "600 11px Sora, sans-serif";
    g.fillText("catchemtcg.com/methodology#deal-zone — the receipts", 40, 598);
    try { setShareImg(cv.toDataURL("image/png")); }
    catch { if (photo) draw(null); else setShareImg(null); }
  };
  if (x.img) {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => draw(im);
    im.onerror = () => draw(null);
    im.src = x.img;
  } else draw(null);
}

/* §20 MODES — a lens on the SAME data: order + accent + lead line only.
   The Honesty Law (enforced by scripts/mode-diff-test.mjs in the data
   repo): every figure renders in every mode; position may move, values
   may not. Vendors are Flippers; Show Mode's selling toggle is the
   vendor face (§22: mode ≠ portal ≠ context). */
const MODE_DEF = {
  balanced:  { chip: "Balanced 🟢🔵🟣", cls: "", pre: ["idx"], post: ["leadPrint", "leadSpread", "leadGraded"],
               lead: <>The whole market at a glance — <b>every number, every mode</b>.</> },
  collector: { chip: "Collector 🟢", cls: "m-collector", pre: ["idx", "leadPrint"], post: ["leadSpread", "leadGraded"],
               lead: <>Can you still get it — and what is it? <b>Print windows lead.</b></> },
  flipper:   { chip: "Flipper 🔵", cls: "m-flipper", pre: ["idx", "leadSpread"], post: ["leadPrint", "leadGraded"],
               lead: <>What moved — and what would you clear? <b>The gaps lead.</b></> },
  grader:    { chip: "Grader 🟣", cls: "m-grader", pre: ["idx", "leadGraded"], post: ["leadPrint", "leadSpread"],
               lead: <>Worth slabbing? <b>The premium math leads</b> — cautions included.</> },
};

/* /overlay — OBS browser source (Studio §14). Transparent background, brand
   fonts, auto-refreshes from the feed every 5 minutes. Modes:
     /overlay            (or ?mode=index) → Sealed Index level + Δ + spark
     /overlay?product={id}                → product price + Δ + spark
   The wordmark rides every mode — watermark law. */
function Overlay() {
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const load = async () => { try { const r = await fetch(FEED_URL, { cache: "no-store" }); if (r.ok) setFeed(await r.json()); } catch {} };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  if (!feed) return null;
  const box = { display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(11,13,20,.82)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: "12px 18px", fontFamily: "'Sora',sans-serif", color: "#f4f5f8", margin: 8 };
  const wm = <span style={{ font: "800 15px Syne,sans-serif", whiteSpace: "nowrap" }}>⚡CATCH<span style={{ color: "#36d399" }}>'EM</span></span>;
  const pid = new URLSearchParams(window.location.search).get("product");
  if (pid) {
    const p = (feed.products || []).find(x => x.id === pid);
    if (!p) return <div style={box}>{wm}<span style={{ color: "#8a93a8", fontSize: 13 }}>unknown product: {pid}</span></div>;
    return (<div style={box}>
      {wm}
      <span style={{ fontSize: 14, fontWeight: 600, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
      <span style={{ font: "700 22px 'JetBrains Mono',monospace", fontVariantNumeric: "tabular-nums" }}>{fmt(p.median)}</span>
      <Delta d={deltaFor(feed, pid)} />
      <Spark pts={seriesFor(feed, pid)} w={70} h={22} />
    </div>);
  }
  const six = feed.sealedIndex;
  const s = (feed.indexHistory || []).map(r => r[1]);
  const d = s.length >= 2 && s[s.length - 2] ? { pct: ((s[s.length - 1] - s[s.length - 2]) / s[s.length - 2]) * 100 } : (six?.ddPct != null ? { pct: six.ddPct } : null);
  return (<div style={box}>
    {wm}
    <span style={{ fontSize: 11, letterSpacing: ".08em", color: "#8a93a8", textTransform: "uppercase", whiteSpace: "nowrap" }}>Sealed Index</span>
    <span style={{ font: "700 24px 'JetBrains Mono',monospace", fontVariantNumeric: "tabular-nums" }}>{six?.level ?? "—"}</span>
    <Delta d={d} />
    <Spark pts={s} w={70} h={22} />
    {six?.breadth && <span style={{ fontSize: 11, color: "#8a93a8", whiteSpace: "nowrap" }}>▲{six.breadth.up} ▼{six.breadth.down}</span>}
  </div>);
}

/* Email capture (module-level: keeps its own state so typing never re-renders
   the app shell). Subscribed devices collapse it permanently — never nag. */
function EmailCapture() {
  const [state, setState] = useState(() => (lsGet("mail:v1", false) ? "done-prior" : "idle"));
  const [email, setEmail] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setState("sending");
    try {
      const body = new FormData();
      body.append("email", email);
      const r = await fetch(CAPTURE_URL, { method: "POST", body, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error();
      lsSet("mail:v1", true);
      setState("done");
    } catch { setState("error"); }
  };
  if (state === "done-prior") return null;
  if (state === "done")
    return <div className="cap"><b style={{ color: "var(--green)" }}>✓ You're on the list.</b></div>;
  return (
    <form className="cap" onSubmit={submit}>
      <b>Get the Morning Pulse in your inbox</b>
      <div className="note" style={{ margin: "4px 0 10px" }}>Daily. No spam.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="search" style={{ margin: 0, flex: 1 }} type="email" required placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} aria-label="email address" />
        <button className="fchip on" type="submit" disabled={state === "sending"}>{state === "sending" ? "…" : "Send it"}</button>
      </div>
      {state === "error" && <div className="note" style={{ color: "var(--red)", marginTop: 8 }}>Couldn't reach the list — try again.</div>}
    </form>
  );
}

/* ── the app ─────────────────────────────────────────────────────────── */
export default function Ticker() {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  // v7 Digest Law: every sentence cut from a screen lives one tap away —
  // ⓘ opens this bottom sheet with the explanation + its methodology anchor.
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState("today");
  const [watch, setWatch] = useState(() => lsGet("watch:v1", []));
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState(null);
  const [cmpA, setCmpA] = useState(""); const [cmpB, setCmpB] = useState("");
  const [streak, setStreak] = useState(0);
  // Routes (deep-linkable; CF Pages serves the SPA via public/_redirects):
  //   /product/{id} — detail page (landers point here)
  //   /studio       — Story Kits (Studio v0, §14)
  //   /overlay      — OBS browser source (transparent, auto-refreshing)
  const [route, setRoute] = useState(parseRoute);
  const [zoom, setZoom] = useState(null); // {src,name} — tap-to-enlarge product photo
  const Lightbox = () => zoom ? (<div className="lbx" onClick={() => setZoom(null)} role="dialog" aria-label={`${zoom.name} enlarged`}>
    <img src={zoom.src} alt={zoom.name} onClick={(e) => e.stopPropagation()} />
    <div className="cap">{zoom.name} · tap anywhere to close</div>
  </div>) : null;
  useEffect(() => { if (!zoom) return; const k = e => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [zoom]);
  const touchY = useRef(null);
  // §20 mode: one localStorage key; accent + order + lead line only.
  const [mode, setMode] = React.useState(() => {
    const m = (typeof localStorage !== "undefined" && localStorage.getItem("mode")) || "balanced";
    return MODE_DEF[m] ? m : "balanced";
  });
  const setModeKeep = (m) => { setMode(m); try { localStorage.setItem("mode", m); } catch {} };
  const modeCls = MODE_DEF[mode]?.cls || "";
  // §19 Show Mode: cached-feed stamp (null = live fetch) + PWA install hook.
  const [cachedAt, setCachedAt] = React.useState(null);
  const [installEvt, setInstallEvt] = React.useState(null);
  React.useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  // CAD display toggle state — lived inside Overlay by accident (e528fa4),
  // where Ticker's header/loading returns referenced it: ReferenceError,
  // whole app crashed. Belongs here, before any conditional return.
  const [cur, setCur] = React.useState(CURR.c);
  const [caPrompt, setCaPrompt] = React.useState(false);
  React.useEffect(() => { CURR.r = feed?.fx?.usdcad ?? null;
    if (feed?.fx?.usdcad && !localStorage.getItem("curAsked") && (navigator.language||"").toLowerCase().includes("-ca")) setCaPrompt(true);
  }, [feed]);

  const openProduct = (id) => { window.history.pushState({}, "", `/product/${id}`); setRoute({ name: "product", id }); window.scrollTo(0, 0); };
  const openTool = (tool) => { window.history.pushState({}, "", `/tools/${tool}`); setRoute({ name: "tool", tool }); window.scrollTo(0, 0); };
  const closeProduct = () => { window.history.pushState({}, "", "/"); setRoute(null); };
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(FEED_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("feed " + r.status);
      const f = await r.json();
      setFeed(f); setErr(null);
      setStreak(bumpStreak(f.date));
      // §19 Show Mode offline posture: last good feed persists so a
      // convention hall with no signal still gets numbers, stamped.
      try { localStorage.setItem("feedCache", JSON.stringify({ at: Date.now(), feed: f })); setCachedAt(null); } catch {}
    } catch (e) {
      try {
        const c = JSON.parse(localStorage.getItem("feedCache") || "null");
        if (c?.feed) { setFeed(c.feed); setCachedAt(c.at); setErr(null); }
        else setErr(String(e.message || e));
      } catch { setErr(String(e.message || e)); }
    }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ix = useMemo(() => feed ? buildIndex(feed) : new Map(), [feed]);

  useEffect(() => {
    const start = (e) => { if (window.scrollY === 0) touchY.current = e.touches[0].clientY; };
    const end = (e) => { if (touchY.current != null && e.changedTouches[0].clientY - touchY.current > 90) load(); touchY.current = null; };
    window.addEventListener("touchstart", start); window.addEventListener("touchend", end);
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [load]);

  const toggleWatch = (id) => setWatch(w => { const n = w.includes(id) ? w.filter(x => x !== id) : [...w, id]; lsSet("watch:v1", n); return n; });
  const showReceipts = (title, provenance) => {
    const lines = typeof provenance === "string" ? [provenance]
      : provenance ? Object.entries(provenance).map(([k, v]) => `${k}: ${v}`) : ["Catchem-data eBay active asks (see feed provenance)"];
    setReceipt({ title, lines });
  };

  // OBS overlay renders outside the phone shell entirely (transparent bg, no
  // tabs, no skeleton — a loading overlay must show nothing, not a dark box).
  if (route?.name === "overlay") return <Overlay />;

  if (loading && !feed)
    return (<div className={"tk-root " + modeCls}><style>{css}</style><Lightbox /><main className="tk-phone">
      <div className="tk-head"><div className="tk-wm">CATCH<b>'EM</b></div>
        <button onClick={() => { const n = cur === "USD" ? "CAD" : "USD"; setCur(n); localStorage.setItem("cur", n); CURR.c = n; }}
          style={{ marginLeft: "auto", background: "var(--raised)", border: "1px solid var(--line)", color: cur === "CAD" ? "var(--green)" : "var(--dim)", borderRadius: 8, font: "700 10px 'JetBrains Mono'", padding: "4px 8px" }}
          title={feed?.fx?.usdcad ? `1 USD = ${feed.fx.usdcad} CAD (${feed.fx.date})` : "CAD rate arrives with tonight's data run"}
          disabled={cur === "USD" && !feed?.fx?.usdcad}>{cur === "CAD" ? "CA$ ≈" : "USD"}</button></div>
      {caPrompt && (<div className="note" style={{ display: "flex", gap: 8, alignItems: "center", margin: "0 0 10px" }}>
        🇨🇦 Show prices in CAD (converted)?
        <button onClick={() => { setCur("CAD"); localStorage.setItem("cur","CAD"); CURR.c = "CAD"; setCaPrompt(false); localStorage.setItem("curAsked","1"); }} style={{ background:"none", border:"1px solid var(--green)", color:"var(--green)", borderRadius:8, padding:"2px 10px" }}>Yes</button>
        <button onClick={() => { setCaPrompt(false); localStorage.setItem("curAsked","1"); }} style={{ background:"none", border:"1px solid var(--line)", color:"var(--dim)", borderRadius:8, padding:"2px 10px" }}>Keep USD</button>
      </div>)}
      {[0,1,2,3,4].map(i => <div className="skel" key={i} aria-hidden="true" />)}
      <div className="load">reading the tape…</div></main></div>);
  if (err && !feed)
    return (<div className={"tk-root " + modeCls}><style>{css}</style><Lightbox /><main className="tk-phone">
      <div className="tk-banner">Couldn't reach the feed ({err}). <button className="tk-refresh" onClick={load}>retry</button></div></main></div>);

  const p = feed.panel || {};
  const today = feed.date;
  const stale = (Date.now() - new Date(feed.generatedAt)) / 36e5 > STALE_HOURS;
  const products = [...ix.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const subtypes = [...new Set(products.map(x => x.subtype).filter(Boolean))].slice(0, 6);
  const movers = products
    .map(x => ({ ...x, delta: deltaFor(feed, x.id) }))
    .filter(x => x.delta != null)
    .sort((a, b) => b.delta.pct - a.delta.pct);

  const Star = ({ id }) => (
    <button className={`star ${watch.includes(id) ? "on" : ""}`} onClick={() => toggleWatch(id)}
      aria-label={watch.includes(id) ? "unstar" : "star"}>{watch.includes(id) ? "★" : "☆"}</button>);

  /* ⓘ — one tap to the cut sentence (bottom sheet), one more to methodology */
  const I = ({ t, a }) => (
    <button className="idot" aria-label="more info"
      onClick={(e) => { e.stopPropagation(); setInfo({ body: t, anchor: a }); }}>ⓘ</button>);

  /* CARD DENSITY RULE (brand-tokens.md, Tyler approved Aug 22; ref
     app-mockup-v6): ONE component, a density prop. Expanded = all six
     parts, wherever ≤3 items share a screen (Daily Three, product pages,
     Deal Check). Compact = same parts, same order, same tokens — the
     photo shrinks to a 64px thumb and the plain line folds behind ⓘ
     (Board, movers, watchlist, heat). Nothing removed, only folded:
     Digest Law and Sandbox Rule satisfied by the same fold. */
  const ProductCard = ({ x, why, density = "expanded" }) => {
    const compact = density === "compact";
    const line = why || x.why;
    return (
    <div className="c3" key={x.id}>
      {x.imageUrl ? <img src={x.imageUrl} alt="" loading="lazy" onClick={() => setZoom({ src: x.imageUrl, name: x.name })} width={compact ? 64 : 76} height={compact ? 64 : 76} style={compact ? { width: 64, height: 64 } : null} /> : null}
      <div className="c3b">
        <div className="c3t"><span className="lbl">{x.subtype || "sealed"}</span>
          {x.chip ? <Chip cls={x.chip} onTap={() => showReceipts(x.name, x.provenance)} /> : null}{compact && line ? <I t={line} /> : null}<Star id={x.id} /></div>
        <span className="nm" onClick={() => ix.has(x.id) && openProduct(x.id)} style={ix.has(x.id) ? { cursor: "pointer" } : null}>{x.name}</span>
        <div className="hero">{fmt(x.price)} <Delta d={deltaFor(feed, x.id)} /><Spark pts={seriesFor(feed, x.id)} /></div>
        <div className="strip">
          {x.listings != null && <span className="st">Listings<b>{x.listings}</b></span>}
          {x.spreadPct != null && <span className="st">Spread<b>{pctFmt(x.spreadPct)}</b></span>}
          {x.tcg != null && <span className="st">TCG<b>{fmt(x.tcg)}</b></span>}
          {x.perPack != null && <span className="st">Per pack<b>{fmt(x.perPack)}</b></span>}
        </div>
        {line && !compact && <div className="why">{line}</div>}
      </div>
    </div>);
  };

  /* ── screens ── */
  // Today (§15 IA v2): Index → Daily Three → Rip-or-Hold → Movers preview →
  // email band. Watch is its own tab now. The Spread/pack-math/quiet-
  // movers/radar truths relocated: spread stat on every card + Board rows,
  // per-pack on product pages, movers tab (radar rides its foot), ⓘ→methodology.
  const Home = () => {
    const d3 = feed.dailyThree || {};
    const six = feed.sealedIndex;
    const ixSeries = (feed.indexHistory || []).map(r => r[1]);
    const ixDelta = ixSeries.length >= 2 && ixSeries[ixSeries.length - 2]
      ? { pct: ((ixSeries[ixSeries.length - 1] - ixSeries[ixSeries.length - 2]) / ixSeries[ixSeries.length - 2]) * 100 } : null;
    /* §20 MODE LEAD ROWS — present in EVERY mode (the Honesty Law: modes
       reorder, never hide), only their POSITION changes. Each row shows
       figures the app already publishes on its own screen. */
    const pw0 = (feed.printWatch || [])[0];
    const sg0 = (feed.signals || [])[0];
    const leadPrint = pw0 ? (
      <div className="mrow" key="leadPrint" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openTool("printwatch")}>
        <span>⏳ {pw0.set} print window</span><b>{pw0.daysLeft}d left (est.)</b>
      </div>) : null;
    const leadSpread = sg0 ? (
      <div className="mrow" key="leadSpread" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openProduct(sg0.id)}>
        <span>⚡ {sg0.name}</span><b>{sg0.spreadPct > 0 ? "+" : ""}{sg0.spreadPct}% gap</b>
      </div>) : null;
    const leadGraded = (
      <div className="mrow" key="leadGraded">
        <span>🎓 Grading Premium</span>
        <b style={{ fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12, color: "var(--dim)" }}>the 9 rarely pays — only the 10<I t="The PSA-9 tax: on established sets a 9 usually returns less than the raw card plus the grading fee. Fresh sets can invert this." a="house-reads" /></b>
      </div>);
    const S = {
      idx: six ? (
        <div className="tk-idx" key="idx">
          <div className="cell"><div className="lbl">Sealed Index<I t="One number for the whole shelf: every tracked product vs its own starting price, averaged. Breadth counts how many rose vs fell." a="index" /></div>
            <div className="big">{six.level}</div></div>
          <div className="cell" style={{ textAlign: "center" }}><Delta d={ixDelta} /><Spark pts={ixSeries} w={62} h={18} /></div>
          <div className="cell" style={{ textAlign: "right" }}><div className="lbl">breadth</div>
            <div className="d" style={{ fontSize: 12 }}><span className="u">▲{six.breadth?.up ?? 0}</span> <span className="dn">▼{six.breadth?.down ?? 0}</span></div></div>
        </div>) : null,
      leadPrint, leadSpread, leadGraded,
    };
    const M = MODE_DEF[mode] || MODE_DEF.balanced;
    return (<>
      <div className="mode-lead">{M.lead}</div>
      {M.pre.map(k => S[k])}
      {(feed.eraIndexes || []).length > 0 && (
        <div className="eras">
          {feed.eraIndexes.map(e => {
            const s = (feed.eraHistory?.[e.era] || []).map(r => r[1]);
            const ed = s.length >= 2 && s[s.length - 2] ? { pct: ((s[s.length - 1] - s[s.length - 2]) / s[s.length - 2]) * 100 } : null;
            return (
              <div className="era" key={e.era}>
                <div className="lbl">{e.era}</div>
                <div className="elvl">{fmt(e.level)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Delta d={ed} /><Spark pts={s} w={62} h={18} /></div>
                <div className="esub">{e.products} products · {e.listingsPerProduct} l/p</div>
              </div>);
          })}
        </div>)}

      <div className="tk-sec">The Daily Three</div>
      <div className="d3row">
      {d3.sealed && <ProductCard x={{ id: "d3-sealed", name: d3.sealed.name, price: d3.sealed.ebay, tcg: d3.sealed.tcg,
        imageUrl: (feed.products || []).find(p => p.name === d3.sealed.name)?.img,
        spreadPct: d3.sealed.spreadPct, listings: d3.sealed.listings, chip: d3.sealed.chip, subtype: "sealed pick" }} why={d3.sealed.whyChosen || d3.sealed.reason} />}
      {d3.shelf && <div className="c3"><div className="c3b">
        <div className="c3t"><span className="lbl">shelf pick</span><span className="chip">READ</span></div>
        <b className="nm">{d3.shelf.name}</b>
        <div className="hero" style={{ fontSize: 22 }}>{d3.shelf.prev} → {d3.shelf.listings}
          <span className="d" style={{ marginLeft: 8, color: d3.shelf.dPct > 0 ? "var(--gold)" : "var(--green)" }}>
            {d3.shelf.dPct > 0 ? "+" : ""}{d3.shelf.dPct}%</span></div>
        <div className="why">{d3.shelf.explain}</div>
      </div></div>}
      {d3.graded && !d3.graded.gated && <ProductCard x={{ id: "d3-graded", name: d3.graded.name, price: d3.graded.raw, chip: d3.graded.chip, subtype: "graded pick" }} why={d3.graded.reason} />}
      {d3.raw && <ProductCard x={{ id: "d3-raw", name: `${d3.raw.name} (${d3.raw.set})`, price: d3.raw.price, chip: d3.raw.chip, subtype: "chase",
        imageUrl: (feed.chases || []).find(c => c.name === d3.raw.name)?.imageUrl }} why={d3.raw.reason} />}
      </div>

      {feed.ripOrHold && (<>
        <div className="tk-sec">🗳 Rip or Hold?<I t="One-tap daily vote in the Discord — results revisited in tomorrow's Pulse. The crowd keeps a track record, just like we do." a="house-reads" /></div>
        <div className="c3"><div className="c3b">
          <b className="nm" style={{ whiteSpace: "normal" }}>{feed.ripOrHold.question}</b>
          <div className="why" style={{ marginTop: 4 }}>{DISCORD_ALERTS_URL ? <a href={DISCORD_ALERTS_URL} style={{ color: "var(--green)" }}>Vote in the Discord →</a> : "Daily vote — Discord opening soon."}</div>
        </div></div>
      </>)}

      <div className="tk-sec">Top movers <button className="lbl" style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer" }} onClick={() => openTool("movers")}>see all ▸</button></div>
      {movers.length === 0
        ? <div className="c3"><div className="c3b"><div className="why">Tape's one day old — movers land tomorrow.<I t="Movers compare the last two committed days of market history — the same real lines for every visitor, first visit included. The clean tape began 2026-08-18." a="history" /></div></div></div>
        : (<>
          {/* Top movers must show BOTH directions. Showing only gainers reads
              as hype and hides half the market (Tyler, 2026-08-22). */}
          <div className="lbl" style={{ margin: "2px 0 6px", color: "var(--green)" }}>▲ Top gains</div>
          {movers.filter(x => x.delta.pct > 0).slice(0, 3).map(x => <ProductCard x={x} key={x.id} density="compact" />)}
          {movers.some(x => x.delta.pct < 0) && (<>
            <div className="lbl" style={{ margin: "14px 0 6px", color: "#ef5a5a" }}>▼ Top losses</div>
            {movers.filter(x => x.delta.pct < 0).slice(-3).reverse().map(x => <ProductCard x={x} key={x.id} density="compact" />)}
          </>)}
        </>)}

      {M.post.map(k => S[k])}
      {/* §20: mode selection offered AFTER the app has been useful — a
          strip at the foot, never a gate. Switching is instant + reversible. */}
      <div className="tk-sec">Set the app up for you</div>
      <div className="fchips" style={{ marginBottom: 4 }}>
        {Object.entries(MODE_DEF).map(([k, m]) => (
          <button key={k} className={"fchip" + (mode === k ? " on" : "")} onClick={() => setModeKeep(k)}>{m.chip}</button>))}
      </div>
      <div className="note" style={{ margin: "0 0 12px" }}>A mode reorders and tints — it never hides or changes a number.<I t="The Mode Honesty Law: same truth, different first screen. Anything a mode de-emphasises stays one tap away, never removed — and a machine test fails the build if any mode drops a figure." a="house-reads" /></div>
      <EmailCapture />
      <div className="note" style={{ textAlign: "center", margin: "16px 0" }}>{feed.disclosure}<I t="Buy Pressure is estimated from listing-count changes — inventory draining or building. It is not reported sales; nobody outside the marketplaces has real sales data." a="buy-pressure" /></div>
    </>);
  };

  const Movers = () => (<>
    <div className="tk-sec">Movers<I t="Δ compares the last two committed days of market history — the same real lines for every visitor, first visit included. The clean tape began 2026-08-18." a="history" /></div>
    {movers.length === 0
      ? <div className="c3"><div className="c3b"><div className="why">Tape's one day old — movers land tomorrow.</div></div></div>
      : (<>
        <div className="lbl" style={{ margin: "8px 0" }}>▲ Up</div>
        {movers.filter(m => m.delta.pct > 0).slice(0, 8).map(x => <ProductCard x={x} key={x.id} density="compact" />)}
        <div className="lbl" style={{ margin: "8px 0" }}>▼ Down</div>
        {movers.filter(m => m.delta.pct < 0).slice(-8).reverse().map(x => <ProductCard x={x} key={x.id} density="compact" />)}
      </>)}
    {(feed.radar || []).length > 0 && (<>
      <div className="tk-sec">Release radar</div>
      {feed.radar.map((r, i) => <div className="brow" key={i}><div className="bmid"><b>{r.name}</b><span>{r.note || ""}</span></div><div className="bnum">{r.date}</div></div>)}
    </>)}
  </>);

  const Board = () => {
    const rows = products.filter(x =>
      (!q || (x.name || "").toLowerCase().includes(q.toLowerCase()) || x.id.includes(q.toLowerCase())) &&
      (!ftype || x.subtype === ftype));
    return (<>
      <div className="tk-sec">The Board <span className="lbl">{rows.length} of {products.length}</span></div>
      <input className="search" placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="fchips">{subtypes.map(t =>
        <button className={`fchip ${ftype === t ? "on" : ""}`} key={t} onClick={() => setFtype(ftype === t ? null : t)}>{t}</button>)}</div>
      {rows.map(x => (
        <div className="brow" key={x.id}>
          {x.imageUrl ? <img src={x.imageUrl} alt="" loading="lazy" width="42" height="42" /> : null}
          <div className="bmid" onClick={() => openProduct(x.id)} style={{ cursor: "pointer" }}><b>{x.name}</b><span>{x.subtype}{x.listings != null ? ` · ${x.listings} listings` : ""}{x.spreadPct != null ? ` · spread ${pctFmt(x.spreadPct)}` : ""}</span></div>
          <div className="bnum">{fmt(x.price)}<Delta d={deltaFor(feed, x.id)} /></div>
          <Star id={x.id} />
        </div>))}
      <div className="note">Tap any row for detail.</div>
    </>);
  };

  /* ── Deal Check (§13): the in-pocket reference ── */
  const DealCheck = () => {
    const [tape, setTape] = useState(() => lsGet("tape:v1", null));
    const [tq, setTq] = useState("");
    const [sel, setSel] = useState(null);
    const [shareImg, setShareImg] = useState(null);
    const [tapeState, setTapeState] = useState("idle");

    useEffect(() => {
      let dead = false;
      (async () => {
        setTapeState("loading");
        try {
          const r = await fetch(TAPE_URL, { cache: "no-store" });
          if (!r.ok) throw new Error("tape " + r.status);
          const full = await r.json();
          const slim = {
            date: full.updatedAt,
            products: full.products.map(x => ({
              id: x.id, name: x.name, set: x.set, subtype: x.subtype, vintage: !!x.vintage,
              median: x.priceMedian, floorClean: x.priceFloorClean, high: x.priceHigh,
              listings: x.listingCount, dataStatus: x.dataStatus, img: x.tcgPlayerId ? `https://tcgplayer-cdn.tcgplayer.com/product/${x.tcgPlayerId}_in_1000x1000.jpg` : x.representativeImage,
              hist: (x.priceHistory || []).slice(-30).map(h => h.price),
            })),
          };
          if (!dead) { setTape(slim); setTapeState("live"); lsSet("tape:v1", slim); }
        } catch {
          if (!dead) setTapeState(tape ? "cached" : "offline-empty");
        }
      })();
      return () => { dead = true; };
    }, []); // eslint-disable-line

    const results = !tape ? [] : tape.products.filter(x =>
      tq.length >= 2 && (x.name.toLowerCase().includes(tq.toLowerCase()) || x.id.includes(tq.toLowerCase()))).slice(0, 8);

    const renderShare = (x) => renderShareCard(x, (tape.date || "").slice(0, 10), setShareImg);

    const Check = ({ x }) => {
      const d = x.hist && x.hist.length >= 2
        ? { pct: ((x.hist[x.hist.length - 1] - x.hist[x.hist.length - 2]) / x.hist[x.hist.length - 2]) * 100 } : null;
      const nam = x.dataStatus === "no-active-market";
      const pctIn = x.median != null && x.high > (x.floorClean ?? 0)
        ? Math.min(96, Math.max(4, 100 * ((x.median - x.floorClean) / (x.high - x.floorClean)))) : 50;
      return (
        <div className="c3" style={{ flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {x.img ? <img src={x.img} alt="" loading="lazy" width="76" height="76" /> : null}
            <div className="c3b">
              <div className="c3t"><span className="lbl">{x.subtype}{x.vintage ? " · eBay-native venue" : ""}</span><Star id={x.id} /></div>
              <span className="nm">{x.name}</span>
              {nam ? null : <div className="hero">{fmt(x.median)} <Delta d={d} /><Spark pts={x.hist} /></div>}
            </div>
          </div>
          {nam ? (
            <div className="why" style={{ marginTop: 8 }}>
              No active listings — auctions & comps venue.<I t="Vintage-class product rarely trades as live eBay listings — the market lives in auctions, shows and collector groups, so there is no honest fair-range to print. We show gaps, not guesses." a="venue-law" />
            </div>
          ) : (<>
            <div className="strip" style={{ marginTop: 10 }}>
              <span className="st">Clean floor<b>{fmt(x.floorClean)}</b></span>
              <span className="st">Median<b>{fmt(x.median)}</b></span>
              <span className="st">Listings<b>{x.listings ?? "—"}</b></span>
              {!x.vintage && ix.get(x.id)?.spreadPct != null && <span className="st">Spread<b>{pctFmt(ix.get(x.id).spreadPct)}</b></span>}
            </div>
            {feed.netProceeds?.byId?.[x.id] != null && (
              <div className="esub" style={{ marginTop: 8 }}>Seller nets ≈ <b className="mono">{fmt(feed.netProceeds.byId[x.id])}</b> after eBay fees (est.)<I t="Sale price minus eBay final-value fees and typical costs — the number that settles a show-floor negotiation." a="fair-range" /></div>
            )}
            <div style={{ position: "relative", height: 6, background: "var(--raised)", borderRadius: 99, margin: "14px 0 4px" }}>
              <div style={{ position: "absolute", left: 0, width: `${pctIn}%`, top: 0, bottom: 0, background: "var(--green)", borderRadius: 99 }} />
            </div>
            <div className="why">Fair zone: floor → median.<I t="Asks cluster between the clean floor and the median — offers under the floor are reaching; asks past the median need a reason." a="fair-range" /></div>
            <button className="fchip on" style={{ marginTop: 10 }} onClick={() => renderShare(x)}>Share card 📸</button>
            {shareImg && (<>
              <img src={shareImg} alt="Deal check share card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
              <div className="note">Long-press to save.</div>
            </>)}
          </>)}
        </div>);
    };

    return (<>
      <div className="tk-sec">✓ Is this ask fair? <span className="lbl">{tapeState === "cached" ? "offline · cached" : tapeState === "live" ? `${tape?.products.length ?? 0} products` : ""}</span></div>
      {tapeState === "offline-empty"
        ? <div className="tk-banner">No signal, no cache yet — open once online.</div>
        : (<>
          <input className="search" placeholder="Search any tracked product…" value={tq} onChange={e => { setTq(e.target.value); setSel(null); setShareImg(null); }} />
          {sel ? <Check x={sel} /> : results.map(x => (
            <div className="brow" key={x.id} onClick={() => { setSel(x); setShareImg(null); }} style={{ cursor: "pointer" }}>
              {x.img ? <img src={x.img} alt="" loading="lazy" width="42" height="42" /> : null}
              <div className="bmid"><b>{x.name}</b><span>{x.subtype}{x.vintage ? " · vintage" : ""}</span></div>
              <div className="bnum">{fmt(x.median)}</div>
            </div>))}
          {!sel && tq.length >= 2 && results.length === 0 && tape && <div className="note">No match in {tape.products.length} tracked.</div>}
          {!sel && tq.length < 2 && <div className="note">Type two letters. Offline-ready.</div>}
        </>)}
    </>);
  };

  /* ── §15 Utilities IA: every tool is displayed as ITS JOB — the question
     it answers. Tools hub + the new surfaces (mockup v4 = acceptance). ── */
  const WatchTab = () => {
    const watched = watch.map(id => ix.get(id)).filter(Boolean);
    return (<>
      <div className="tk-sec">What did my stuff do? <span className="lbl">{watched.length ? `${watched.length} starred` : ""}</span></div>
      {watched.length === 0
        ? <div className="c3"><div className="c3b"><div className="why">Star anything — it lives here.</div></div></div>
        : watched.map(x => <ProductCard x={x} key={x.id} density="compact" />)}
    </>);
  };

  const Tools = () => {
    const np = feed.netProceeds || {};
    const evsNet = np.byId?.["swsh7-booster-box"];
    const pm = feed.packMath || {};
    const pw0 = (feed.printWatch || [])[0];
    const lastCmp = lsGet("cmp:last", null);
    const rows = [
      ["check", "✓", "Is this ask fair?", `${feed.products?.length ?? "—"} products · show-floor speed`],
      ["compare", "⇄", "Which of these two?", lastCmp ? `${lastCmp[0]} vs ${lastCmp[1]}` : "9 instruments side-by-side"],
      ["net", "💵", "What lands in my pocket?", evsNet ? `EvSkies box: ${fmt(evsNet)} after fees` : "both venues' nets"],
      ["packmath", "🎴", "Rip it, or buy singles?", pm.best ? `best ${fmt(pm.best.perPack)}/pack · worst ${fmt(pm.worst?.perPack)}` : "every box's math"],
      ["printwatch", "⏳", "How long can I still buy it?", pw0 ? `${pw0.set} ~${pw0.daysLeft}d (est.)` : "the countdowns"],
      ["roh", "🗳", "What does the crowd say?", feed.ripOrHold ? `${feed.ripOrHold.name} — vote live` : "the daily vote"],
    ];
    return (<>
      <div className="tk-sec">🧰 Tools <span className="lbl">every tool is a question</span></div>
      {rows.map(([id, icon, q, teaser]) => (
        <button className="tool" key={id} onClick={() => openTool(id)}>
          <span className="ticon">{icon}</span>
          <span className="tbody"><b>{q}</b><span>{teaser}</span></span>
          <span className="tgo">›</span>
        </button>))}
      <div className="note" style={{ margin: "14px 0" }}>
        <a href="/studio" style={{ color: "var(--green)" }} onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/studio"); setRoute({ name: "studio" }); }}>🎨 Studio →</a>
      </div>
    </>);
  };

  /* Pack Math — "Rip it, or buy singles?" (engine existed, humans never saw it) */
  const PackMath = () => {
    const [pq, setPq] = useState("");
    const [sel, setSel] = useState(null);
    const pm = feed.packMath || {};
    const all = (pm.all || []).map(r => ({ ...r, name: ix.get(r.id)?.name || r.id, loose: ix.get(r.id)?.loosePack }));
    const verdict = (r) => r.premium == null ? "No loose lane — per-pack only."
      : r.premium > 15 ? "Sealed carries the box premium — ripping pays only on nostalgia."
      : r.premium < 0 ? "The box is the cheap way in."
      : "Parity — rip for fun, not math.";
    const results = pq.length >= 2 ? all.filter(r => r.name.toLowerCase().includes(pq.toLowerCase())).slice(0, 6) : [];
    const table = [...all].sort((a, b) => (b.premium ?? -999) - (a.premium ?? -999));
    return (<>
      <div className="tk-sec">🎴 Rip it, or buy singles?<I t="Per-pack = ask median ÷ era-aware pack count. The sealed premium compares that to the same set's loose-pack street price — positive means you pay extra to keep it sealed. Thin lanes (under 10 listings) are flagged, not hidden." a="premiums" /></div>
      {!sel && <div className="why" style={{ marginBottom: 10 }}>{pm.best ? `Best way in today: ${pm.best.name}, ${fmt(pm.best.perPack)}/pack.` : "Every box's per-pack math."}</div>}
      <input className="search" placeholder="Search a box…" value={pq} onChange={e => { setPq(e.target.value); setSel(null); }} />
      {results.map(r => (
        <div className="brow" key={r.id} onClick={() => setSel(r)} style={{ cursor: "pointer" }}>
          <div className="bmid"><b>{r.name}</b></div>
          <div className="bnum">{fmt(r.perPack)}/pk</div>
        </div>))}
      {sel && (
        <div className="c3" style={{ flexDirection: "column" }}>
          <span className="nm" style={{ whiteSpace: "normal" }}>{sel.name}</span>
          <div className="strip" style={{ marginTop: 8 }}>
            <span className="st">This box / pack<b>{fmt(sel.perPack)}</b></span>
            <span className="st">Loose pack<b>{sel.loose ? fmt(sel.loose) : "—"}</b></span>
            <span className="st">Premium<b>{sel.premium != null ? (sel.premium > 0 ? "+" : "") + sel.premium + "%" : "—"}{sel.thin ? " ⚠" : ""}</b></span>
          </div>
          <div className="why" style={{ marginTop: 8 }}>{verdict(sel)}<I t="Asks only, not sales. Thin ⚠ = the loose-pack lane has under 10 listings, so the premium is a soft read." a="premiums" /></div>
        </div>)}
      {!sel && pq.length < 2 && (<>
        <div className="tk-sec">Today's table <span className="lbl">by premium</span></div>
        {table.map(r => (
          <div className="brow" key={r.id} onClick={() => setSel(r)} style={{ cursor: "pointer" }}>
            <div className="bmid"><b>{r.name}</b><span>{fmt(r.perPack)}/pack{r.thin ? " · ⚠ thin" : ""}</span></div>
            <div className="bnum">{r.premium != null ? (r.premium > 0 ? "+" : "") + r.premium + "%" : "—"}</div>
          </div>))}
      </>)}
    </>);
  };

  /* Print Watch — "How long can I still buy it?" (site page, app grammar) */
  const PrintWatch = () => {
    const pw = feed.printWatch || [];
    const tight = feed.tightening || [];
    return (<>
      <div className="tk-sec">⏳ How long can I still buy it?<I t="A 30-month print-window model per set, crossed with live listing depth and reprint news. The countdown is an estimate, not an announcement — a reprint resets the clock and we say so." a="print-watch" /></div>
      {pw[0] && <div className="why" style={{ marginBottom: 10 }}>{pw[0].set} closes first — ~{pw[0].daysLeft}d (est.).</div>}
      {pw.map(r => (
        <div className="brow" key={r.setId}>
          <div className="bmid"><b>{r.set}</b><span>{r.supply} listings · {r.legalTag}</span></div>
          <div className="bnum">~{r.daysLeft}d<span className={`d ${r.tier === "low" ? "dn" : "n"}`} style={{ display: "block" }}>{r.tier} supply</span></div>
        </div>))}
      {tight.length > 0 && (<>
        <div className="tk-sec">🔒 Tightening <span className="lbl">out of print · thinning</span></div>
        {tight.map(t => (
          <div className="brow" key={t.setId}>
            <div className="bmid"><b>{t.set}</b></div>
            <div className="bnum">{t.supply} left</div>
          </div>))}
      </>)}
    </>);
  };

  /* Net Proceeds — "What lands in my pocket?" */
  const NetCalc = () => {
    const [priceIn, setPriceIn] = useState("");
    const np = feed.netProceeds || {};
    const p = parseFloat(priceIn);
    const net = (m) => m && !isNaN(p) && p > 0 ? p * (1 - (m.pct ?? 0) / 100) - (m.fixed ?? 0) : null;
    const nE = net(np.model), nT = net(np.tcgModel);
    return (<>
      <div className="tk-sec">💵 What lands in my pocket?<I t="Sale price minus each venue's fees: eBay ≈13.25% + $0.30; TCGplayer ≈10.75% + 2.5% + $0.30. Estimates — shipping and promoted-listing costs are yours to add." a="fair-range" /></div>
      <input className="search" inputMode="decimal" placeholder="$ sale price…" value={priceIn} onChange={e => setPriceIn(e.target.value)} />
      {nE != null && (
        <div className="strip">
          <span className="st">eBay nets<b>{fmt(Math.max(0, nE))}</b></span>
          <span className="st">TCGplayer nets<b>{nT != null ? fmt(Math.max(0, nT)) : "—"}</b></span>
        </div>)}
    </>);
  };

  /* Rip or Hold — "What does the crowd say?" */
  const RipOrHold = () => (<>
    <div className="tk-sec">🗳 What does the crowd say?<I t="One-tap daily vote in the Discord — results revisited in tomorrow's Pulse. The crowd keeps a track record, just like we do." a="house-reads" /></div>
    {feed.ripOrHold ? (
      <div className="c3"><div className="c3b">
        <b className="nm" style={{ whiteSpace: "normal" }}>{feed.ripOrHold.question}</b>
        <div className="why" style={{ marginTop: 4 }}>{DISCORD_ALERTS_URL ? <a href={DISCORD_ALERTS_URL} style={{ color: "var(--green)" }}>Vote in the Discord →</a> : "Daily vote — Discord opening soon."}</div>
      </div></div>
    ) : <div className="note">Today's question mints with the morning run.</div>}
  </>);

  /* Product detail (/product/{id}) — mockup v3 parity: photo, price+Δ, range
     bar, 6-stat grid, history chart, share card. Landers deep-link here. */
  /* ── §19 THE SHOW FLOOR ──────────────────────────────────────────────
     zoneFor: the engine's zone, recomputed client-side ONLY from the
     model's own numeric fields (taxPctDefault, feeTiers) + the user's
     saved settings. The rates live in ONE place — the feed. */
  const zoneFor = (id) => {
    const z = feed?.dealZone?.byId?.[id];
    if (!z) return null;
    const m = feed?.dealZone?.model;
    if (!m?.feeTiers) return z; // old cached feed: engine numbers as-is
    const tiers = m.feeTiers;
    const defTier = tiers.find(t => t.default) || tiers[0];
    const tier = tiers.find(t => t.id === localStorage.getItem("dzTier")) || defTier;
    const taxRaw = localStorage.getItem("dzTax");
    const taxPct = taxRaw != null && taxRaw !== "" && !isNaN(parseFloat(taxRaw)) ? parseFloat(taxRaw) : m.taxPctDefault;
    if (tier.id === defTier.id && taxPct === m.taxPctDefault) return z; // engine defaults
    const r2 = (n) => Math.round(n * 100) / 100;
    const buyerCeiling = r2(z.ask * (1 + taxPct / 100));
    const sellerFloor = r2(z.ask * (1 - tier.pct / 100) - tier.fixed);
    if (sellerFloor <= 0 || buyerCeiling <= sellerFloor) return z;
    return { ...z, buyerCeiling, sellerFloor,
      zoneWidth: r2(buyerCeiling - sellerFloor),
      zonePct: Math.round((buyerCeiling - sellerFloor) / z.ask * 1000) / 10,
      midpoint: r2((buyerCeiling + sellerFloor) / 2), custom: true };
  };

  /* The band — one glance: floor → midpoint → ceiling, ask marked. */
  const DealZoneBand = ({ z, big }) => {
    if (!z) return null;
    const askPct = Math.min(97, Math.max(3, ((z.ask - z.sellerFloor) / (z.buyerCeiling - z.sellerFloor)) * 100));
    const num = { font: `700 ${big ? 26 : 15}px 'JetBrains Mono',monospace`, fontVariantNumeric: "tabular-nums", display: "block" };
    return (<div>
      <div style={{ position: "relative", height: big ? 12 : 8, background: "rgba(54,211,153,.35)", borderRadius: 99 }}>
        <span style={{ position: "absolute", left: `${askPct}%`, top: big ? -5 : -3, width: 3, height: big ? 22 : 14, background: "var(--txt)", borderRadius: 8, transform: "translateX(-50%)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }} className="esub">
        <span>seller floor<b style={num}>{fmt(z.sellerFloor)}</b></span>
        <span style={{ textAlign: "center" }}>midpoint<b style={{ ...num, color: "var(--green)" }}>{fmt(z.midpoint)}</b></span>
        <span style={{ textAlign: "right" }}>buyer ceiling<b style={num}>{fmt(z.buyerCeiling)}</b></span>
      </div>
    </div>);
  };

  /* /show — SHOW MODE: a convention-hall screen. Huge search, huge
     numbers, minimal chrome, offline via the cached feed. */
  const ShowMode = () => {
    const [q, setQ] = useState("");
    const [pick, setPick] = useState(null);
    const [side, setSide] = useState(localStorage.getItem("dzSide") || "buying");
    const [sheet, setSheet] = useState(false);
    const [shareImg, setShareImg] = useState(null);
    const [, bump] = useState(0); // settings save → recompute
    const m = feed?.dealZone?.model;
    const results = q.length >= 2
      ? [...ix.values()].filter(p => p.name.toLowerCase().includes(q.toLowerCase()) && p.price != null).slice(0, 8)
      : [];
    const x = pick ? ix.get(pick) : null;
    const z = pick ? zoneFor(pick) : null;
    const setSideKeep = (s) => { setSide(s); localStorage.setItem("dzSide", s); };
    const stamp = cachedAt ? new Date(cachedAt) : null;
    const bigNum = { font: "800 44px 'JetBrains Mono',monospace", fontVariantNumeric: "tabular-nums", color: "var(--green)" };
    const tiers = m?.feeTiers || [];
    const curTier = tiers.find(t => t.id === localStorage.getItem("dzTier")) || tiers.find(t => t.default) || tiers[0];
    const curTax = (() => { const v = localStorage.getItem("dzTax"); return v != null && v !== "" && !isNaN(parseFloat(v)) ? parseFloat(v) : m?.taxPctDefault; })();
    return (<>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0 10px" }}>
        <a href="/" style={{ color: "var(--dim)", textDecoration: "none", fontSize: 22 }} onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/"); setRoute(null); }}>←</a>
        <div className="tk-wm" style={{ fontSize: 19 }}>SHOW<b> MODE</b></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {stamp
            ? <span className="lbl" style={{ color: "var(--gold)" }}>cached at {String(stamp.getHours()).padStart(2, "0")}:{String(stamp.getMinutes()).padStart(2, "0")}</span>
            : <span className="lbl" style={{ color: "var(--green)" }}>live · cached ✓</span>}
          <button className="fchip" onClick={() => setSheet(true)} aria-label="tax and fee settings">⚙</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={"fchip" + (side === "buying" ? " on" : "")} style={{ flex: 1, padding: "12px 0", fontSize: 15 }} onClick={() => setSideKeep("buying")}>I'm buying</button>
        <button className={"fchip" + (side === "selling" ? " on" : "")} style={{ flex: 1, padding: "12px 0", fontSize: 15 }} onClick={() => setSideKeep("selling")}>I'm selling</button>
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder="Search any product…" aria-label="search products"
        style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--txt)", borderRadius: 16, padding: "18px 16px", font: "600 20px 'Sora',sans-serif" }} />
      {results.length > 0 && !pick && (
        <div style={{ marginTop: 8 }}>
          {results.map(p => (
            <button key={p.id} onClick={() => { setPick(p.id); setShareImg(null); }}
              style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--txt)", borderRadius: 12, padding: "14px 14px", marginBottom: 6, font: "600 16px 'Sora',sans-serif", cursor: "pointer", textAlign: "left" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <b className="mono" style={{ flex: "none" }}>{fmt(p.price)}</b>
            </button>))}
        </div>)}
      {x && z && (<>
        <div className="lbl" style={{ marginTop: 16 }}>{x.name}</div>
        {side === "buying" ? (<>
          <div style={bigNum}>{fmt(z.buyerCeiling)}</div>
          <div className="esub" style={{ marginBottom: 12 }}>your walk-away ceiling (est.) — above this, buy it online instead. A buyer pays about {fmt(z.buyerCeiling)} online after shipping and tax.</div>
        </>) : (<>
          <div style={bigNum}>{fmt(z.sellerFloor)}</div>
          <div className="esub" style={{ marginBottom: 12 }}>your booth floor (est.) — cash above this beats listing it. A seller keeps about {fmt(z.sellerFloor)} online after fees.</div>
        </>)}
        <DealZoneBand z={z} big />
        {z.custom && <div className="esub" style={{ marginTop: 6, color: "var(--gold)" }}>your rates: {curTax}% tax · {curTier?.label}</div>}
        <div className="grid6" style={{ marginTop: 14 }}>
          <span className="st">Median<b>{fmt(x.price)}</b><span style={{ display: "block", fontSize: 9.5 }}>delivered · est.</span></span>
          <span className="st">Clean floor<b>{fmt(x.floor)}</b></span>
          <span className="st">Listings<b>{x.listings ?? "—"}</b></span>
        </div>
        <button className="fchip on" style={{ marginTop: 14, padding: "12px 18px", fontSize: 15 }}
          onClick={() => renderDealZoneCard({ name: x.name, img: x.imageUrl }, z, today, setShareImg)}>Deal Zone card 📸</button>
        {shareImg && (<>
          <img src={shareImg} alt="deal zone card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
          <div className="note">Long-press to save — show it across the table.</div>
        </>)}
      </>)}
      {!pick && !results.length && (
        <div className="note" style={{ margin: "16px 0" }}>Built for the table: search a product, get the referee numbers. Works offline once loaded.{installEvt ? <> <button className="fchip on" style={{ marginLeft: 6 }} onClick={async () => { installEvt.prompt(); setInstallEvt(null); }}>Install app</button></> : /iphone|ipad/i.test(navigator.userAgent) ? " Tip: Share → Add to Home Screen for one-tap access." : ""}</div>)}
      {sheet && (
        <div role="dialog" aria-label="tax and fee settings" style={{ position: "fixed", inset: 0, background: "rgba(7,9,16,.8)", display: "flex", alignItems: "flex-end", zIndex: 40 }} onClick={() => setSheet(false)}>
          <div style={{ background: "var(--panel)", borderRadius: "16px 16px 0 0", padding: 18, width: "100%", maxWidth: 420, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="lbl">Your rates (est. · saved on this device)</div>
            <label className="esub" style={{ display: "block", margin: "12px 0 4px" }}>Sales-tax rate %</label>
            <input type="number" step="0.1" min="0" max="15" defaultValue={curTax}
              onChange={(e) => { localStorage.setItem("dzTax", e.target.value); bump(n => n + 1); }}
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--txt)", borderRadius: 10, padding: "12px", font: "600 18px 'JetBrains Mono',monospace" }} />
            <label className="esub" style={{ display: "block", margin: "12px 0 4px" }}>Seller fee tier</label>
            {tiers.map(t => (
              <button key={t.id} className={"fchip" + (curTier?.id === t.id ? " on" : "")} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: "10px 12px" }}
                onClick={() => { localStorage.setItem("dzTier", t.id); bump(n => n + 1); }}>
                {t.label} — {t.pct}%{t.fixed ? ` + $${t.fixed.toFixed(2)}` : ""}{t.note ? ` · ${t.note}` : ""}</button>))}
            <div className="note" style={{ marginTop: 8 }}>Rates come from the day's feed model — one source of truth. Zones recompute instantly.</div>
            <button className="fchip on" style={{ marginTop: 8, width: "100%", padding: "12px 0" }} onClick={() => setSheet(false)}>Done</button>
          </div>
        </div>)}
    </>);
  };

  const ProductDetail = ({ id }) => {
    const [shareImg, setShareImg] = useState(null);
    const x = ix.get(id);
    if (!x) return (<>
      <button className="fchip" onClick={closeProduct} style={{ marginTop: 8 }}>← back</button>
      <div className="c3" style={{ marginTop: 12 }}><div className="c3b"><div className="why">Not on the tape — search the Board.</div></div></div>
    </>);
    const life = feed.lifecycle?.[x.setId];
    const hist = feed.history?.[id] || [];
    const d = deltaFor(feed, id);
    const nam = x.status === "no-active-market" || x.price == null;
    const pctIn = !nam && x.floor != null && x.high > x.floor
      ? Math.min(96, Math.max(4, 100 * ((x.price - x.floor) / (x.high - x.floor)))) : null;
    const Chart = () => {
      if (hist.length < 2)
        return <div className="note" style={{ margin: "14px 0" }}>Day {hist.length || 0} of the clean tape.<I t="Price history accrues from the clean tape, born 2026-08-18 — the line grows one point every morning, the same for every visitor." a="history" /></div>;
      const W = 352, H = 120, pr = hist.map(r => r[1]);
      const min = Math.min(...pr), max = Math.max(...pr), span = max - min || 1;
      const step = (W - 8) / (pr.length - 1);
      const dd = pr.map((v, i) => `${i ? "L" : "M"}${(4 + i * step).toFixed(1)},${(H - 10 - ((v - min) / span) * (H - 24)).toFixed(1)}`).join(" ");
      return (
        <div className="c3" style={{ flexDirection: "column", marginTop: 12 }}>
          <div className="lbl">last {pr.length} days</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} role="img" aria-label={`price history, ${pr.length} days`}>
            <path d={dd} fill="none" stroke={pr[pr.length - 1] >= pr[0] ? "var(--green)" : "var(--red)"} strokeWidth="2" />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between" }} className="esub">
            <span>{hist[0][0]}</span><span>low {fmt(min)} · high {fmt(max)}</span><span>{hist[hist.length - 1][0]}</span>
          </div>
        </div>);
    };
    return (<>
      <button className="fchip" onClick={closeProduct} style={{ margin: "8px 0 14px" }}>← back</button>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {x.imageUrl && <img src={x.imageUrl} alt={x.name} width="104" height="104" style={{ width: 104, height: 104, objectFit: "contain", borderRadius: 12, background: "#070910", flex: "none" }} />}
        <div style={{ minWidth: 0 }}>
          <div className="lbl">{x.set || x.setId} · {x.subtype}{x.vintage ? " · eBay-native venue" : ""}</div>
          <div className="dt-name">{x.name}</div>
          <div style={{ marginTop: 6 }}><Star id={x.id} /></div>
        </div>
      </div>
      {nam ? (
        <div className="c3" style={{ marginTop: 14 }}><div className="c3b"><div className="why">
          No active listings — auctions & comps venue.<I t="Vintage-class product rarely trades as live eBay listings — the market lives in auctions, shows and collector groups, so there is no honest fair-range to print. We show gaps, not guesses." a="venue-law" />
        </div></div></div>
      ) : (<>
        <div className="hero" style={{ fontSize: 30, marginTop: 14 }}>{fmt(x.price)} <Delta d={d} /></div>
        {(() => { const nE = feed.netProceeds?.byId?.[id], nT = feed.netProceeds?.tcgById?.[id];
          return nE ? (<div className="esub" style={{ marginTop: 4 }}>
            nets ≈ <b className="mono">{fmt(nE)}</b> eBay{nT ? <> · <b className="mono">{fmt(nT)}</b> TCG</> : null} after fees (est.)<I t="In-pocket if sold today: sale price minus marketplace final-value fees plus $0.30 — the seller's real number, not the sticker." a="fair-range" />
          </div>) : null; })()}
        <div className="lbl" style={{ marginTop: 2 }}>ask median · delivered<I t="Today's eBay asking median: Buy-It-Now listings only, delivered price (item + shipping), scam-vocabulary filtered. Asks, not sales." a="prices" /></div>
        {pctIn != null && (
          <div style={{ margin: "16px 0 2px" }}>
            <div style={{ position: "relative", height: 6, background: "var(--raised)", borderRadius: 99 }}>
              <div style={{ position: "absolute", left: 0, width: `${pctIn}%`, top: 0, bottom: 0, background: "var(--green)", borderRadius: 99 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }} className="esub">
              <span>clean floor {fmt(x.floor)}</span><span>median {fmt(x.price)}</span><span>high {fmt(x.high)}</span>
            </div>
          </div>)}
        <div className="grid6" style={{ marginTop: 14 }}>
          <span className="st">Listings<b>{x.listings ?? "—"}</b><span style={{ display: "block", fontSize: 9.5 }}>filtered</span></span>
          <span className="st">Clean floor<b>{fmt(x.floor)}</b></span>
          <span className="st">Per pack<b>{x.perPack != null ? fmt(x.perPack) : "—"}</b><span style={{ display: "block", fontSize: 9.5 }}>{x.packs ? `÷ ${x.packs} packs` : "varies"}</span></span>
          <span className="st">Vs loose pack<b>{x.vsLoosePct != null ? (x.vsLoosePct > 0 ? "+" : "") + x.vsLoosePct + "%" : "—"}</b><span style={{ display: "block", fontSize: 9.5 }}>{x.loosePack ? `loose ${fmt(x.loosePack)}` : "no loose lane"}</span></span>
          <span className="st">Age · phase<b>{life?.ageMonths != null ? life.ageMonths + "mo" : "—"}</b><span style={{ display: "block", fontSize: 9.5 }}>{life?.phase ?? "—"}</span></span>
          <span className="st">⚖ Legality<b>{life?.legalTag ?? "—"}</b><span style={{ display: "block", fontSize: 9.5 }}>{life?.standardLegal ? "Standard" : life ? "rotated" : ""}</span></span>
        </div>
        {(() => { const z = zoneFor(id); return z ? (
          <div className="c3" style={{ flexDirection: "column", marginTop: 12 }}>
            <div className="lbl">Deal Zone (est.)<I t="A buyer's true online cost is the delivered total plus sales tax; a seller's true online outcome is the ask minus fees. Any cash price between them beats eBay for both sides." a="deal-zone" /></div>
            <DealZoneBand z={z} />
            <div className="esub" style={{ marginTop: 8 }}>A buyer pays about <b className="mono">{fmt(z.buyerCeiling)}</b> online after shipping and tax (est.) · a seller keeps about <b className="mono">{fmt(z.sellerFloor)}</b> online after fees (est.)</div>
          </div>) : null; })()}
        <Chart />
        <button className="fchip on" style={{ marginTop: 12 }}
          onClick={() => renderShareCard({ name: x.name, median: x.price, floorClean: x.floor, listings: x.listings, vintage: x.vintage, img: x.imageUrl }, today, setShareImg)}>
          Share card 📸</button>
        {shareImg && (<>
          <img src={shareImg} alt="share card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
          <div className="note">Long-press to save.</div>
        </>)}
      </>)}
      <div className="note" style={{ margin: "18px 0" }}>{feed.disclosure}</div>
    </>);
  };

  /* /studio — Story Kits (Studio v0, §14): today's three shaped stories with
     copy-text and render-as-card. Every export carries the watermark (the
     shared renderer bakes it in). */
  /* /studio — THE CREATOR PORTAL (§21). Modes are how you READ; this is
     where you MAKE. One door, five sections; every existing route keeps
     working (/studio/posts, /studio/archive, /overlay). Guardrails:
     raffles stay ours-only · webhook URLs never leave the browser ·
     every export keeps its chip + est. labelling + watermark. */
  const Studio = () => {
    const [ptab, setPtab] = useState("today");
    const [shareImg, setShareImg] = useState(null);
    const [copied, setCopied] = useState(null);
    const [pickQ, setPickQ] = useState("");
    const [pick, setPick] = useState(null);
    const [hook, setHook] = useState("");
    const [hookMsg, setHookMsg] = useState(null);
    const kits = feed.storyKits || [];
    const bank = feed.postBank;
    const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/";
    const APPURL = "https://app.catchemtcg.com";
    const nav = (path, r) => (e) => { e.preventDefault(); window.history.pushState({}, "", path); setRoute(r); };
    const copyText = async (t, key) => { try { await navigator.clipboard.writeText(t); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {} };
    const results = pickQ.length >= 2 ? [...ix.values()].filter(p => p.name.toLowerCase().includes(pickQ.toLowerCase()) && p.price != null).slice(0, 5) : [];
    const px = pick ? ix.get(pick) : null;
    const CopyRow = ({ label, text, k }) => (
      <div className="mrow"><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <button className="fchip" style={{ flex: "none" }} onClick={() => copyText(text, k)}>{copied === k ? "✓" : "Copy"}</button></div>);
    return (<>
      <div className="tk-sec" style={{ marginTop: 8 }}>Creator Portal</div>
      <div className="mode-lead">Free, forever — the watermark rides along.</div>
      <div className="fchips">
        {[["today", "Today"], ["make", "Make"], ["stream", "Stream"], ["synd", "Syndicate"], ["learn", "Learn"]].map(([k, l]) => (
          <button key={k} className={"fchip" + (ptab === k ? " on" : "")} onClick={() => setPtab(k)}>{l}</button>))}
      </div>

      {ptab === "today" && (<>
        <div className="mrow"><span>✍️ {bank?.ideas?.length ?? 0} finished angles × 4 formats</span>
          <a className="fchip on" href="/studio/posts" onClick={nav("/studio/posts", { name: "studio-posts", mine: false })}>Open →</a></div>
        {kits.length === 0 && <div className="note">Kits mint with the morning run.</div>}
        {kits.map(k => (
          <div className="c3" style={{ flexDirection: "column" }} key={k.id}>
            <div className="lbl">{k.angle}</div>
            <span className="nm" style={{ whiteSpace: "normal" }}>{k.headline}</span>
            <div className="why">{k.body}</div>
            <div className="esub" style={{ margin: "8px 0" }}>{k.receipts}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fchip" onClick={() => copyText(`${k.headline}\n\n${k.body}\n\n${k.receipts}`, k.id)}>{copied === k.id ? "✓ copied" : "Copy text"}</button>
              {ix.get(k.productId) && <button className="fchip on" onClick={() => { const p = ix.get(k.productId); renderShareCard({ name: p.name, median: p.price, floorClean: p.floor, listings: p.listings, vintage: p.vintage, img: p.imageUrl }, today, setShareImg); }}>Card 📸</button>}
            </div>
          </div>))}
        <div className="mrow"><span>🖼 Today's minted cards (PNG, watermarked)</span>
          <a className="fchip" href={RAW + "research/pulse/cards/latest-index.png"} target="_blank" rel="noreferrer">Index ⬇</a></div>
        <div className="note"><a href="/studio/archive" style={{ color: "var(--acc, var(--green))" }} onClick={nav("/studio/archive", { name: "studio-archive" })}>Prior days →</a></div>
      </>)}

      {ptab === "make" && (<>
        <div className="note" style={{ margin: "4px 0 8px" }}>Pick a product, mint a branded PNG. Every card carries the chip, est. labels, and the wordmark.</div>
        <input value={pickQ} onChange={(e) => { setPickQ(e.target.value); setPick(null); }} placeholder="Search a product…" aria-label="card maker search"
          style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--txt)", borderRadius: 10, padding: "12px", font: "600 15px var(--sans)" }} />
        {results.length > 0 && !pick && results.map(p => (
          <button key={p.id} className="mrow" style={{ width: "100%", cursor: "pointer", textAlign: "left" }} onClick={() => setPick(p.id)}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span><b>{fmt(p.price)}</b></button>))}
        {px && (<div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
          <button className="fchip on" onClick={() => renderShareCard({ name: px.name, median: px.price, floorClean: px.floor, listings: px.listings, vintage: px.vintage, img: px.imageUrl }, today, setShareImg)}>Price card 📸</button>
          {zoneFor(px.id) && <button className="fchip on" onClick={() => renderDealZoneCard({ name: px.name, img: px.imageUrl }, zoneFor(px.id), today, setShareImg)}>Deal Zone card 📸</button>}
        </div>)}
        <div className="mrow"><span>🗂 Binder pages — data-driven themes, minted daily</span>
          <a className="fchip" href={RAW + "research/pulse/cards/latest-binder.png"} target="_blank" rel="noreferrer">Chase Wall ⬇</a></div>
        <div className="note">Chart export lives on every product page — open one, Share card 📸.</div>
      </>)}

      {ptab === "stream" && (<>
        <div className="note" style={{ margin: "4px 0 8px" }}>OBS browser sources — transparent, auto-refreshing, wordmark on. Add as a Browser Source at 800×220.</div>
        <CopyRow label="Index overlay" text={APPURL + "/overlay"} k="ov1" />
        <CopyRow label={px ? `Product overlay — ${px.name}` : "Product overlay (pick in Make)"} text={APPURL + "/overlay?product=" + (pick || "{product-id}")} k="ov2" />
        <div className="note">Rip-or-Hold vote widget ships with the Discord rail — the daily question is in your embed every morning.</div>
      </>)}

      {ptab === "synd" && (<>
        <div className="note" style={{ margin: "4px 0 8px" }}>A branded Morning Pulse in YOUR server every day. Your webhook never leaves this browser — we test it from here, then Tyler adds it to the send list (the URL lives in a secret store, never a repo).</div>
        <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="discord webhook url"
          style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--txt)", borderRadius: 10, padding: "12px", font: "600 13px var(--mono)" }} />
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <button className="fchip on" disabled={!/^https:\/\/discord\.com\/api\/webhooks\//.test(hook)} onClick={async () => {
            setHookMsg("sending…");
            try {
              const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "Catch'em Morning Pulse", embeds: [{ title: "⚡ Test — your server is wired", description: "This is what the daily Pulse embed looks like. Numbers arrive with the 04:00 UTC run.", color: 0x36d399, footer: { text: "catchemtcg.com · VERIFIED = measured, READ = our take" } }] }) });
              setHookMsg(r.ok ? "✓ test embed sent — screenshot it + DM @Tyler to join the daily send" : "✗ Discord said " + r.status);
            } catch { setHookMsg("✗ could not reach that webhook"); }
          }}>Send test embed</button>
        </div>
        {hookMsg && <div className="note">{hookMsg}</div>}
        <div className="tk-sec" style={{ marginTop: 12 }}>Embeds for your site</div>
        <CopyRow label="Index ticker (iframe)" text={`<iframe src="${APPURL}/overlay" width="640" height="160" frameborder="0" title="Catch'em Sealed Index — catchemtcg.com"></iframe>`} k="em1" />
        <CopyRow label="Product card (iframe)" text={`<iframe src="${APPURL}/overlay?product=${pick || "{product-id}"}" width="640" height="160" frameborder="0" title="Catch'em price — catchemtcg.com"></iframe>`} k="em2" />
        <div className="note">Attribution is baked in — the wordmark and catchemtcg.com render inside every embed.</div>
      </>)}

      {ptab === "learn" && (<>
        <div className="c3" style={{ flexDirection: "column" }}>
          <div className="lbl">Our chips, in one breath</div>
          <div className="why"><b style={{ color: "var(--green)" }}>VERIFIED</b> = we measured it (or a primary source did). <b>READ</b> = our interpretation, grounded and falsifiable. Estimated figures always say <b>est.</b> If a number has no chip, don't quote it as ours.</div>
        </div>
        <div className="c3" style={{ flexDirection: "column" }}>
          <div className="lbl">Citing us</div>
          <div className="why">"per Catch'em (catchemtcg.com), {today}" + keep the chip. You can show any number we publish; you can't turn a READ into a promise or attach a price target to it — we don't make calls, and neither can our numbers.</div>
        </div>
        <div className="c3" style={{ flexDirection: "column" }}>
          <div className="lbl">Why the angles work</div>
          <div className="why">{(bank?.ideas || []).slice(0, 3).map(i => `${i.angle}: ${i.why}`).join(" — ") || "Coaching notes ride every angle in Post Studio."}</div>
        </div>
      </>)}

      {shareImg && (<>
        <img src={shareImg} alt="minted card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
        <div className="note">Long-press to save.</div>
      </>)}
    </>);
  };

  /* /studio/posts — POST STUDIO (§17): six finished angles × four formats
     from the morning post-bank. Angle cards stay glanceable (v7: angle +
     chip + why); everything else lives behind the tap. Voice changes
     phrasing only — numbers never move. ?mine=1 = Tyler's §16 queue. */
  const PostStudio = ({ mine }) => {
    const bank = feed.postBank, q = feed.socialQueue;
    const [sel, setSel] = useState(null);
    const [tab, setTab] = useState("x");
    const [voice, setVoice] = useState("analyst");
    const [copied, setCopied] = useState(null);
    const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/";
    const TABS = [["x", "X"], ["youtube_title", "YT title"], ["youtube_hook", "YT hook"], ["short_script", "Short"]];
    /* phrasing-only voice shift: casual lowers the opener, energetic adds
       one 👀 to the first line. Digits are untouched by construction. */
    const speak = (t) => !t ? t
      : voice === "casual" ? t.replace(/^([A-Z])(?=[a-z])/, (m) => m.toLowerCase())
      : voice === "hype" ? t.replace(/(\n|$)/, " 👀$1") : t;
    const copy = async (t, key) => {
      try { await navigator.clipboard.writeText(t); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
    };
    if (mine) return (<>
      <div className="tk-sec" style={{ marginTop: 8 }}>My daily slots{q?.dayNumber ? ` · day ${q.dayNumber}` : ""}</div>
      {!q?.posts?.length && <div className="note">The queue mints with the morning run.</div>}
      {(q?.posts || []).map(p => (
        <div className="c3" style={{ flexDirection: "column" }} key={p.slot}>
          <div className="lbl">{p.slot}{p.suggestedTime ? ` · ${p.suggestedTime}` : ""}{p.lens ? ` · ${p.lens}` : ""}</div>
          <div className="why" style={{ whiteSpace: "pre-wrap" }}>{p.text}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="fchip" onClick={() => copy(p.text, p.slot)}>{copied === p.slot ? "✓ copied" : "Copy"}</button>
            {p.card && <a className="fchip" href={RAW + p.card} target="_blank" rel="noreferrer">Card ⬇</a>}
          </div>
        </div>))}
      <div className="note" style={{ margin: "16px 0" }}><a href="/studio/posts" style={{ color: "var(--green)" }} onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/studio/posts"); setRoute({ name: "studio-posts", mine: false }); }}>← All angles</a></div>
    </>);
    return (<>
      <div className="tk-sec" style={{ marginTop: 8 }}>Post Studio</div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0 10px" }}>
        {[["analyst", "Analyst"], ["casual", "Casual"], ["hype", "Energetic"]].map(([v, l]) => (
          <button key={v} className={"fchip" + (voice === v ? " on" : "")} onClick={() => setVoice(v)}>{l}</button>))}
      </div>
      {!bank?.ideas?.length && <div className="note">Angles mint with the morning run.</div>}
      {(bank?.ideas || []).map(i => (
        <div className="c3" style={{ flexDirection: "column" }} key={i.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer" }}
               onClick={() => { setSel(sel === i.id ? null : i.id); setTab("x"); }}>
            <span className="nm" style={{ whiteSpace: "normal" }}>{i.angle}</span>
            <span className="lbl" style={{ color: i.chip === "VERIFIED" ? "var(--green)" : "var(--dim)" }}>{i.chip}</span>
          </div>
          <div className="why">{i.why}</div>
          {sel === i.id && (<>
            <div style={{ display: "flex", gap: 6, margin: "10px 0 8px" }}>
              {TABS.map(([k, l]) => i.platforms?.[k] != null && (
                <button key={k} className={"fchip" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>))}
            </div>
            <div className="why" style={{ whiteSpace: "pre-wrap", background: "var(--raised)", borderRadius: 10, padding: "10px 12px" }}>{speak(i.platforms?.[tab])}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="fchip" onClick={() => copy(speak(i.platforms?.[tab]) || "", i.id + tab)}>{copied === i.id + tab ? "✓ copied" : "Copy"}</button>
              {i.card && <a className="fchip" href={RAW + i.card} target="_blank" rel="noreferrer">Card ⬇</a>}
            </div>
          </>)}
        </div>))}
      <div className="note" style={{ margin: "16px 0" }}>{bank?.date ? `Bank refreshes with the morning run · ${bank.date}` : ""} · <a href="/studio/posts?mine=1" style={{ color: "var(--green)" }} onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/studio/posts?mine=1"); setRoute({ name: "studio-posts", mine: true }); }}>My slots →</a></div>
    </>);
  };

  /* /studio/archive — prior days' kits from the CI-committed archive. */
  const StudioArchive = () => {
    const [arch, setArch] = useState(null);
    const [err2, setErr2] = useState(null);
    const [copied, setCopied] = useState(null);
    useEffect(() => {
      (async () => {
        try {
          const r = await fetch(KITS_ARCHIVE_URL, { cache: "no-store" });
          if (!r.ok) throw new Error("archive " + r.status);
          setArch(await r.json());
        } catch (e) { setErr2(String(e.message || e)); }
      })();
    }, []);
    const copy = async (k) => {
      try { await navigator.clipboard.writeText(`${k.headline}\n\n${k.body}\n\n${k.receipts}`); setCopied(k.headline); setTimeout(() => setCopied(null), 1500); } catch {}
    };
    return (<>
      <div className="tk-sec" style={{ marginTop: 8 }}>Archive</div>
      {err2 && <div className="tk-banner">Couldn't reach the archive ({err2}).</div>}
      {!arch && !err2 && <div className="load">reading the archive…</div>}
      {arch && [...arch.entries].reverse().map((day) => (
        <div key={day.date}>
          <div className="lbl" style={{ margin: "14px 0 6px" }}>{day.date}</div>
          {day.kits.map((k, i) => (
            <div className="c3" style={{ flexDirection: "column" }} key={i}>
              <div className="lbl">{k.angle}</div>
              <span className="nm" style={{ whiteSpace: "normal" }}>{k.headline}</span>
              <div className="why">{k.body}</div>
              <div className="esub" style={{ margin: "6px 0" }}>{k.receipts}</div>
              <button className="fchip" style={{ alignSelf: "flex-start" }} onClick={() => copy(k)}>{copied === k.headline ? "✓ copied" : "Copy text"}</button>
            </div>))}
        </div>))}
      
    </>);
  };

  const Compare = () => {
    const A = ix.get(cmpA), B = ix.get(cmpB);
    const life = (x) => feed.lifecycle?.[x?.setId];
    const row = (label, f) => (
      <div className="grid6" key={label}>
        <span className="st">{label}<b>{A ? f(A) ?? "—" : "—"}</b></span>
        <span className="st">{label}<b>{B ? f(B) ?? "—" : "—"}</b></span>
      </div>);
    return (<>
      <div className="tk-sec">⇄ Which of these two?</div>
      <select className="cmpsel" value={cmpA} onChange={e => setCmpA(e.target.value)}>
        <option value="">Pick product A…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select className="cmpsel" value={cmpB} onChange={e => setCmpB(e.target.value)}>
        <option value="">Pick product B…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      {A && B && (() => { try { lsSet("cmp:last", [A.name.split(" ").slice(0, 2).join(" "), B.name.split(" ").slice(0, 2).join(" ")]); } catch {} return null; })()}
      {A && B ? (<>
        {row("Price", x => fmt(x.price))}
        {row("Spread", x => x.spreadPct != null ? pctFmt(x.spreadPct) : null)}
        {row("Listings", x => x.listings)}
        {row("Per pack", x => x.perPack != null ? fmt(x.perPack) : null)}
        {row("vs loose packs", x => { const pm = (feed.packMath?.all || []).find(r => r.id === x.id); return pm?.premium != null ? `${pm.premium > 0 ? "+" : ""}${pm.premium}%${pm.thin ? " ⚠ thin" : ""}` : null; })}
        {row("In-pocket (eBay)", x => feed.netProceeds?.byId?.[x.id] != null ? fmt(feed.netProceeds.byId[x.id]) : null)}
        {row("Δ today", x => { const d = deltaFor(feed, x.id); return d?.pct != null ? `${d.pct > 0 ? "▲" : d.pct < 0 ? "▼" : "·"} ${Math.abs(d.pct).toFixed(1)}%` : null; })}
        {row("Phase", x => life(x)?.phase)}
        {row("Legality", x => life(x)?.legalTag)}
        <div className="note">Blank cells<I t="A blank cell means the daily feed carries no verified number for that instrument — we show gaps, not guesses." a="prices" /></div>
      </>) : <div className="note">Pick two products.</div>}
    </>);
  };

  // §19 Show Mode gets its own shell: no header, no tab bar — a screen
  // built for a convention hall, not a feed browse.
  if (route?.name === "show") return (
    <div className={"tk-root "+modeCls}><style>{css}</style><Lightbox />
      <main className="tk-phone"><ShowMode /></main>
    </div>);

  return (
    <div className={"tk-root " + modeCls}>
      <style>{css}</style>
      <main className="tk-phone">
        <div className="tk-head">
          <div className="tk-wm">⚡CATCH<b>'EM</b></div>
          <div className="tk-hright">
            {streak > 1 && <span className="tk-streak">🔥 Day {streak}</span>}
            {DISCORD_ALERTS_URL && <a className="tk-bell" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} href={DISCORD_ALERTS_URL} target="_blank" rel="noreferrer" aria-label="Discord alerts">🔔</a>}
            <span className="tk-date">{today}</span>
            <button className="tk-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
          </div>
        </div>
        {stale && <div className="tk-banner">Showing yesterday's tape — bots catching up.</div>}
        {route?.name === "product" ? <ProductDetail id={route.id} /> : route?.name === "studio" ? <Studio /> : route?.name === "studio-posts" ? <PostStudio mine={route.mine} /> : route?.name === "studio-archive" ? <StudioArchive /> :
         route?.name === "tool" ? (
          route.tool === "check" ? <DealCheck /> :
          route.tool === "compare" ? <Compare /> :
          route.tool === "packmath" ? <PackMath /> :
          route.tool === "printwatch" ? <PrintWatch /> :
          route.tool === "net" ? <NetCalc /> :
          route.tool === "roh" ? <RipOrHold /> :
          route.tool === "movers" ? <Movers /> : <Tools />
        ) : (<>
          {tab === "today" && <Home />}
          {tab === "tools" && <Tools />}
          {tab === "watch" && <WatchTab />}
          {tab === "board" && <Board />}
        </>)}
        {receipt && (<>
          <div className="drawer-back" onClick={() => setReceipt(null)} />
          <div className="drawer" role="dialog" aria-label="Receipts">
            <h4>Receipts — {receipt.title}</h4>
            {receipt.lines.map((l, i) => <div className="receipt" key={i}>{l}</div>)}
            <div className="disc">{feed.disclosure}</div>
          </div></>)}
        {info && (<>
          <div className="drawer-back" onClick={() => setInfo(null)} />
          <div className="drawer" role="dialog" aria-label="Info">
            <div className="why" style={{ fontSize: 13, lineHeight: 1.6 }}>{info.body}</div>
            {info.anchor && <a href={`/methodology.html#${info.anchor}`} style={{ color: "var(--green)", fontSize: 12, display: "inline-block", marginTop: 12 }}>full story → methodology</a>}
          </div></>)}
        <nav className="tabs">
          {[["today", "⚡", "Today"], ["tools", "🧰", "Tools"], ["watch", "⭐", "Watch"], ["board", "▦", "Board"]].map(([id, icon, name]) =>
            <button className={`tab ${tab === id && !route ? "on" : ""}`} key={id} onClick={() => { if (route) closeProduct(); setTab(id); }}><i>{icon}</i>{name}</button>)}
        </nav>
      </main>
    </div>
  );
}
