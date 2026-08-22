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
.tk-root{background:var(--bg);color:var(--txt);min-height:100vh;font:14px/1.5 var(--sans);
display:flex;justify-content:center}
.tk-phone{width:100%;max-width:420px;padding:0 14px calc(84px + env(safe-area-inset-bottom))}
.tk-head{display:flex;justify-content:space-between;align-items:center;gap:8px;
padding:16px 0 12px;position:sticky;top:0;background:var(--bg);z-index:5}
.tk-wm{font:800 22px/1.2 var(--disp)}.tk-wm b{color:var(--green)}
.tk-hright{display:flex;align-items:center;gap:8px}
.tk-streak{font:700 10px var(--mono);color:var(--gold);background:rgba(255,184,77,.1);
border:1px solid rgba(255,184,77,.35);border-radius:99px;padding:3px 8px}
.tk-date{font:400 10px var(--mono);font-variant-numeric:tabular-nums;color:var(--dim)}
.tk-refresh,.tk-bell{background:transparent;border:1px solid var(--line);color:var(--dim);
border-radius:9px;font-size:12px;min-width:32px;min-height:32px;cursor:pointer}
.tk-banner{background:rgba(239,90,90,.1);border:1px solid rgba(239,90,90,.35);color:var(--red);
border-radius:12px;padding:12px 16px;font-size:12.5px;line-height:1.5;margin:8px 0 12px}
.tk-idx{background:var(--panel);border:1px solid var(--line);border-radius:14px;
padding:14px 16px;display:flex;align-items:center;gap:16px;margin-bottom:14px}
.tk-idx .big{font:700 26px var(--mono);font-variant-numeric:tabular-nums}
.tk-idx .cell{flex:1}
.lbl{font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim)}
.tk-bar{height:5px;background:var(--raised);border-radius:99px;overflow:hidden;margin-top:6px}
.tk-fill{height:100%;background:var(--green)}
.tk-sec{font:700 11px var(--mono);color:var(--dim);letter-spacing:.08em;
text-transform:uppercase;margin:32px 0 12px;display:flex;justify-content:space-between;align-items:center}
.c3{background:var(--panel);border:1px solid var(--line);border-radius:14px;
padding:14px;margin-bottom:10px;display:flex;gap:12px}
.c3 img{width:76px;height:76px;object-fit:contain;border-radius:8px;background:#070910;align-self:flex-start}
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
.brow img{width:42px;height:42px;object-fit:contain;border-radius:6px;background:#070910}
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
.fchip.on{color:var(--green);border-color:var(--green)}
.tabs{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;
display:grid;grid-template-columns:repeat(4,1fr);background:#0b0d14;border-top:1px solid var(--line);
padding-bottom:env(safe-area-inset-bottom);z-index:20}
.tab{background:none;border:none;color:var(--dim);font:600 10.5px var(--sans);padding:10px 0 8px;
min-height:52px;cursor:pointer}
.tab.on{color:var(--green)}
.tab i{display:block;font-size:16px;font-style:normal;margin-bottom:2px}
.tk-agree{border:1px solid rgba(54,211,153,.35);background:var(--panel);
text-align:center;padding:24px 16px;border-radius:14px;margin-bottom:12px}
.tk-agree b{color:var(--green);font-size:15px}
.note{font-size:10.5px;color:var(--dim);margin-top:9px;line-height:1.5}
.tool{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--panel);
border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;color:var(--txt)}
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
.skel{background:var(--panel);border:1px solid var(--line);border-radius:14px;height:76px;
margin-bottom:10px;position:relative;overflow:hidden}
.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
background:var(--raised);animation:shim 1.4s infinite}
@keyframes shim{100%{transform:translateX(100%)}}
.load{padding:24px 0;text-align:center;color:var(--dim);font:400 12px var(--mono)}
.cmpsel{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--txt);
border-radius:10px;padding:10px;font:400 12.5px var(--sans);margin-bottom:8px}
.cap{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:18px 0}
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
  if (path.startsWith("/studio")) return { name: "studio" };
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
  const box = { display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(11,13,20,.82)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "12px 18px", fontFamily: "'Sora',sans-serif", color: "#f4f5f8", margin: 8 };
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
  const [cur, setCur] = React.useState(CURR.c);
  const [caPrompt, setCaPrompt] = React.useState(false);
  React.useEffect(() => { CURR.r = feed?.fx?.usdcad ?? null;
    if (feed?.fx?.usdcad && !localStorage.getItem("curAsked") && (navigator.language||"").toLowerCase().includes("-ca")) setCaPrompt(true);
  }, [feed]);
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
  const touchY = useRef(null);

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
    } catch (e) { setErr(String(e.message || e)); }
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
    return (<div className="tk-root"><style>{css}</style><main className="tk-phone">
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
    return (<div className="tk-root"><style>{css}</style><main className="tk-phone">
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

  const ProductCard = ({ x, why }) => (
    <div className="c3" key={x.id}>
      {x.imageUrl ? <img src={x.imageUrl} alt="" loading="lazy" width="76" height="76" /> : null}
      <div className="c3b">
        <div className="c3t"><span className="lbl">{x.subtype || "sealed"}</span>
          {x.chip ? <Chip cls={x.chip} onTap={() => showReceipts(x.name, x.provenance)} /> : null}<Star id={x.id} /></div>
        <span className="nm" onClick={() => ix.has(x.id) && openProduct(x.id)} style={ix.has(x.id) ? { cursor: "pointer" } : null}>{x.name}</span>
        <div className="hero">{fmt(x.price)} <Delta d={deltaFor(feed, x.id)} /><Spark pts={seriesFor(feed, x.id)} /></div>
        <div className="strip">
          {x.listings != null && <span className="st">Listings<b>{x.listings}</b></span>}
          {x.spreadPct != null && <span className="st">Spread<b>{pctFmt(x.spreadPct)}</b></span>}
          {x.tcg != null && <span className="st">TCG<b>{fmt(x.tcg)}</b></span>}
          {x.perPack != null && <span className="st">Per pack<b>{fmt(x.perPack)}</b></span>}
        </div>
        {(why || x.why) && <div className="why">{why || x.why}</div>}
      </div>
    </div>);

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
    return (<>
      {six && (
        <div className="tk-idx">
          <div className="cell"><div className="lbl">Sealed Index<I t="One number for the whole shelf: every tracked product vs its own starting price, averaged. Breadth counts how many rose vs fell." a="index" /></div>
            <div className="big">{six.level}</div></div>
          <div className="cell" style={{ textAlign: "center" }}><Delta d={ixDelta} /><Spark pts={ixSeries} w={62} h={18} /></div>
          <div className="cell" style={{ textAlign: "right" }}><div className="lbl">breadth</div>
            <div className="d" style={{ fontSize: 12 }}><span className="u">▲{six.breadth?.up ?? 0}</span> <span className="dn">▼{six.breadth?.down ?? 0}</span></div></div>
        </div>)}
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
      {d3.sealed && <ProductCard x={{ id: "d3-sealed", name: d3.sealed.name, price: d3.sealed.ebay, tcg: d3.sealed.tcg,
        spreadPct: d3.sealed.spreadPct, listings: d3.sealed.listings, chip: d3.sealed.chip, subtype: "sealed pick" }} why={d3.sealed.reason} />}
      {d3.graded && (d3.graded.gated
        ? <div className="c3 locked"><div className="c3b"><div className="c3t"><span className="lbl">graded pick</span><span className="chip p">🔒 GATED</span><I t="The Grading Premium table publishes when data licensing clears — we don't print numbers we can't stand behind publicly." a="raw-graded" /></div>
            <span className="nm">{d3.graded.name}</span>
            <div className="why">Unlocks with licensing.</div></div></div>
        : <ProductCard x={{ id: "d3-graded", name: d3.graded.name, price: d3.graded.raw, chip: d3.graded.chip, subtype: "graded pick" }} why={d3.graded.reason} />)}
      {d3.raw && <ProductCard x={{ id: "d3-raw", name: `${d3.raw.name} (${d3.raw.set})`, price: d3.raw.price, chip: d3.raw.chip, subtype: "chase" }} why={d3.raw.reason} />}

      {feed.ripOrHold && (<>
        <div className="tk-sec">🗳 Rip or Hold?<I t="One-tap daily vote in the Discord — results revisited in tomorrow's Pulse. The crowd keeps a track record, just like we do." a="house-reads" /></div>
        <div className="c3"><div className="c3b">
          <b className="nm" style={{ whiteSpace: "normal" }}>{feed.ripOrHold.question}</b>
          <div className="why" style={{ marginTop: 4 }}>{DISCORD_ALERTS_URL ? <a href={DISCORD_ALERTS_URL} style={{ color: "var(--green)" }}>Vote in the Discord →</a> : "Daily vote — Discord opening soon."}</div>
        </div></div>
      </>)}

      <div className="tk-sec">Movers <button className="lbl" style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer" }} onClick={() => openTool("movers")}>see all ▸</button></div>
      {movers.length === 0
        ? <div className="c3"><div className="c3b"><div className="why">Tape's one day old — movers land tomorrow.<I t="Movers compare the last two committed days of market history — the same real lines for every visitor, first visit included. The clean tape began 2026-08-18." a="history" /></div></div></div>
        : movers.slice(0, 3).map(x => <ProductCard x={x} key={x.id} />)}

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
        {movers.filter(m => m.delta.pct > 0).slice(0, 8).map(x => <ProductCard x={x} key={x.id} />)}
        <div className="lbl" style={{ margin: "8px 0" }}>▼ Down</div>
        {movers.filter(m => m.delta.pct < 0).slice(-8).reverse().map(x => <ProductCard x={x} key={x.id} />)}
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
              listings: x.listingCount, dataStatus: x.dataStatus, img: x.representativeImage,
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
        : watched.map(x => <ProductCard x={x} key={x.id} />)}
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
  const Studio = () => {
    const [shareImg, setShareImg] = useState(null);
    const [copied, setCopied] = useState(null);
    const kits = feed.storyKits || [];
    const copy = async (k) => {
      try {
        await navigator.clipboard.writeText(`${k.headline}\n\n${k.body}\n\n${k.receipts}`);
        setCopied(k.id); setTimeout(() => setCopied(null), 1500);
      } catch {}
    };
    const render = (k) => {
      const p = ix.get(k.productId);
      if (p) renderShareCard({ name: p.name, median: p.price, floorClean: p.floor, listings: p.listings, vintage: p.vintage, img: p.imageUrl }, today, setShareImg);
    };
    return (<>
      <div className="tk-sec" style={{ marginTop: 8 }}>Studio</div>
      {kits.length === 0 && <div className="note">Kits mint with the morning run.</div>}
      {kits.map(k => (
        <div className="c3" style={{ flexDirection: "column" }} key={k.id}>
          <div className="lbl">{k.angle}</div>
          <span className="nm" style={{ whiteSpace: "normal" }}>{k.headline}</span>
          <div className="why">{k.body}</div>
          <div className="esub" style={{ margin: "8px 0" }}>{k.receipts}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fchip" onClick={() => copy(k)}>{copied === k.id ? "✓ copied" : "Copy text"}</button>
            {ix.get(k.productId) && <button className="fchip on" onClick={() => render(k)}>Card 📸</button>}
          </div>
        </div>))}
      {shareImg && (<>
        <img src={shareImg} alt="story card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
        <div className="note">Long-press to save.</div>
      </>)}
      <div className="note" style={{ margin: "16px 0" }}>Machine angles, your voice. <a href="/studio/archive" style={{ color: "var(--green)" }} onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/studio/archive"); setRoute({ name: "studio-archive" }); }}>Prior days →</a></div>
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

  return (
    <div className="tk-root">
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
        {route?.name === "product" ? <ProductDetail id={route.id} /> : route?.name === "studio" ? <Studio /> : route?.name === "studio-archive" ? <StudioArchive /> :
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
