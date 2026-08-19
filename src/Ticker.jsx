// CATCH'EM — The Ticker + Retention v0 (app-specs §1 + §12, mockup v3 grammar).
// All client-side off pulse-feed.json. No auth, no backend, no new deps.
// Truth rules honored in code:
//  - Sparklines + Δ movers come from THIS DEVICE's visit snapshots
//    (localStorage) — the feed carries no history yet. Empty states say so
//    in voice; nothing is faked.
//  - dailyThree.graded ships gated:true → renders locked, no numbers.
//  - Every number keeps its provenance chip → receipts drawer.
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";

const FEED_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/pulse-feed.json";
// Deal Check (§13) reads the FULL tape — same repo, same client-side/zero-
// backend posture; lazy-fetched only when the Check tab opens, then cached
// to localStorage so checks work in convention halls with dead signal.
const TAPE_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/sealed-prices.json";
const STALE_HOURS = 36;
const DISCORD_ALERTS_URL = ""; // TODO(Tyler): discord.gg invite or #alerts channel link — 🔔 hidden while empty

/* ── v3 design tokens ─────────────────────────────────────────────────── */
const css = `
:root{--bg:#0b0d14;--panel:#141824;--raised:#1c2235;--line:rgba(255,255,255,.07);
--txt:#f4f5f8;--dim:#8a93a8;--gold:#ffb84d;--green:#36d399;--red:#ef5a5a;--purple:#c77dff;
--sans:'Sora',-apple-system,system-ui,sans-serif;--disp:'Syne',var(--sans);
--mono:'JetBrains Mono','Courier New',monospace}
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
.tk-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--green))}
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
.d.u{color:var(--green)}.d.dn{color:var(--red)}.d.n{color:#5c637a}
.star{background:none;border:none;font-size:17px;line-height:1;cursor:pointer;color:#3a415a;
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
display:grid;grid-template-columns:repeat(5,1fr);background:#0e1018;border-top:1px solid var(--line);
padding-bottom:env(safe-area-inset-bottom);z-index:20}
.tab{background:none;border:none;color:var(--dim);font:600 10.5px var(--sans);padding:10px 0 8px;
min-height:52px;cursor:pointer}
.tab.on{color:var(--green)}
.tab i{display:block;font-size:16px;font-style:normal;margin-bottom:2px}
.tk-agree{border:1px solid rgba(54,211,153,.35);background:linear-gradient(135deg,#0d1512,var(--panel));
text-align:center;padding:24px 16px;border-radius:14px;margin-bottom:12px}
.tk-agree b{color:var(--green);font-size:15px}
.note{font-size:10.5px;color:var(--dim);margin-top:9px;line-height:1.5}
.locked{opacity:.75}
.drawer-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40}
.drawer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:420px;
background:#0e1018;border:1px solid var(--line);border-radius:16px 16px 0 0;
padding:16px 16px calc(24px + env(safe-area-inset-bottom));z-index:50}
.drawer h4{margin:0 0 8px;font-size:13px}
.receipt{font:400 11.5px/1.6 var(--mono);color:var(--dim);border-left:2px solid var(--line);
padding-left:10px;margin:8px 0;word-break:break-word}
.disc{font:400 10.5px/1.5 var(--mono);color:var(--gold);opacity:.85;margin-top:10px}
.skel{background:var(--panel);border:1px solid var(--line);border-radius:14px;height:76px;
margin-bottom:10px;position:relative;overflow:hidden}
.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
background:linear-gradient(90deg,transparent,rgba(255,184,77,.06),transparent);animation:shim 1.4s infinite}
@keyframes shim{100%{transform:translateX(100%)}}
.load{padding:24px 0;text-align:center;color:var(--dim);font:400 12px var(--mono)}
.cmpsel{width:100%;background:var(--panel);border:1px solid var(--line);color:var(--txt);
border-radius:10px;padding:10px;font:400 12.5px var(--sans);margin-bottom:8px}
.grid6{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}
.grid6 .st{padding:7px 9px}
`;

/* ── storage helpers ─────────────────────────────────────────────────── */
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const fmt = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const pctFmt = (n) => n == null ? "" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

/* Build a product index from every feed section that carries ids+prices. */
function buildIndex(feed) {
  const ix = new Map();
  const put = (id, patch) => { if (!id) return; ix.set(id, { id, ...ix.get(id), ...patch }); };
  for (const s of feed.signals || [])
    put(s.id, { name: s.name, price: s.ebay?.ask, listings: s.ebay?.listings, spreadPct: s.spreadPct,
      tcg: s.tcg?.market, imageUrl: s.imageUrl, chip: s.class, provenance: s.provenance, why: s.read });
  for (const d of feed.depthReads || [])
    put(d.id, { name: d.name, price: d.price ?? ix.get(d.id)?.price, listings: d.listings, flow: d.read, chip: d.chip });
  for (const bucket of ["priciest", "cheapest"])
    for (const r of feed.packMath?.[bucket] || [])
      put(r.id, { name: r.name, subtype: r.subtype, price: r.price, listings: r.listings, perPack: r.perPack, packs: r.packs });
  for (const p of ix.values()) {
    p.setId = p.id.split("-")[0];
    p.subtype = p.subtype || p.id.split("-").slice(1).join("-");
  }
  return ix;
}

/* Visit snapshots: {date: {id: price}} — this device's own history. */
function recordSnapshot(feed, ix) {
  const snaps = lsGet("snap:v1", {});
  const today = feed.date;
  const day = snaps[today] || {};
  for (const p of ix.values()) if (p.price != null) day[p.id] = p.price;
  snaps[today] = day;
  const dates = Object.keys(snaps).sort();
  while (dates.length > 30) delete snaps[dates.shift()];
  lsSet("snap:v1", snaps);
  return snaps;
}
const seriesFor = (snaps, id) =>
  Object.keys(snaps).sort().map(d => snaps[d][id]).filter(v => v != null);
function deltaFor(snaps, id, today) {
  const dates = Object.keys(snaps).sort().filter(d => d < today && snaps[d][id] != null);
  if (!dates.length) return null;
  const prev = snaps[dates[dates.length - 1]][id];
  const cur = snaps[today]?.[id];
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
    return <svg className="spk" width={w} height={h} aria-label="sparkline pending — appears after two visits"><line x1="2" y1={h/2} x2={w-2} y2={h/2} stroke="#3a415a" strokeDasharray="3 3" /></svg>;
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

/* ── the app ─────────────────────────────────────────────────────────── */
export default function Ticker() {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [tab, setTab] = useState("home");
  const [watch, setWatch] = useState(() => lsGet("watch:v1", []));
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState(null);
  const [cmpA, setCmpA] = useState(""); const [cmpB, setCmpB] = useState("");
  const [streak, setStreak] = useState(0);
  const [snaps, setSnaps] = useState({});
  const touchY = useRef(null);

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
  useEffect(() => { if (feed && ix.size) setSnaps(recordSnapshot(feed, ix)); }, [feed, ix]);

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

  if (loading && !feed)
    return (<div className="tk-root"><style>{css}</style><div className="tk-phone">
      <div className="tk-head"><div className="tk-wm">CATCH<b>'EM</b></div></div>
      {[0,1,2,3,4].map(i => <div className="skel" key={i} aria-hidden="true" />)}
      <div className="load">reading the tape…</div></div></div>);
  if (err && !feed)
    return (<div className="tk-root"><style>{css}</style><div className="tk-phone">
      <div className="tk-banner">Couldn't reach the feed ({err}). <button className="tk-refresh" onClick={load}>retry</button></div></div></div>);

  const p = feed.panel || {};
  const today = feed.date;
  const stale = (Date.now() - new Date(feed.generatedAt)) / 36e5 > STALE_HOURS;
  const products = [...ix.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const subtypes = [...new Set(products.map(x => x.subtype).filter(Boolean))].slice(0, 6);
  const movers = products
    .map(x => ({ ...x, delta: deltaFor(snaps, x.id, today) }))
    .filter(x => x.delta != null)
    .sort((a, b) => b.delta.pct - a.delta.pct);

  const Star = ({ id }) => (
    <button className={`star ${watch.includes(id) ? "on" : ""}`} onClick={() => toggleWatch(id)}
      aria-label={watch.includes(id) ? "unstar" : "star"}>{watch.includes(id) ? "★" : "☆"}</button>);

  const ProductCard = ({ x, why }) => (
    <div className="c3" key={x.id}>
      {x.imageUrl ? <img src={x.imageUrl} alt="" loading="lazy" width="76" height="76" /> : null}
      <div className="c3b">
        <div className="c3t"><span className="lbl">{x.subtype || "sealed"}</span>
          {x.chip ? <Chip cls={x.chip} onTap={() => showReceipts(x.name, x.provenance)} /> : null}<Star id={x.id} /></div>
        <span className="nm">{x.name}</span>
        <div className="hero">{fmt(x.price)} <Delta d={deltaFor(snaps, x.id, today)} /><Spark pts={seriesFor(snaps, x.id)} /></div>
        <div className="strip">
          {x.listings != null && <span className="st">Active Listings<b>{x.listings}</b></span>}
          {x.spreadPct != null && <span className="st">Spread<b>{pctFmt(x.spreadPct)}</b></span>}
          {x.tcg != null && <span className="st">TCG side<b>{fmt(x.tcg)}</b></span>}
          {x.perPack != null && <span className="st">Per pack<b>{fmt(x.perPack)}</b></span>}
        </div>
        {(why || x.why) && <div className="why">{why || x.why}</div>}
      </div>
    </div>);

  /* ── screens ── */
  const Home = () => {
    const watched = watch.map(id => ix.get(id)).filter(Boolean);
    const d3 = feed.dailyThree || {};
    return (<>
      <div className="tk-idx">
        <div className="cell"><div className="big">{p.skusTracked ?? "—"}</div><div className="lbl">sealed tracked</div></div>
        <div className="cell"><div className="big">{p.signals ?? 0}</div><div className="lbl">signals</div></div>
        <div className="cell"><div className="big">{p.calibrationDay ?? "—"}/{p.calibrationOf ?? "—"}</div><div className="lbl">reads calibrating</div>
          {p.calibrationDay < p.calibrationOf && <div className="tk-bar"><div className="tk-fill" style={{ width: `${100 * p.calibrationDay / p.calibrationOf}%` }} /></div>}</div>
      </div>

      <div className="tk-sec">My Watch <span className="lbl">{watched.length ? `${watched.length} starred` : ""}</span></div>
      {watched.length === 0
        ? <div className="c3"><div className="c3b"><div className="why">Star anything — it lives here. Your list is the reason to come back tomorrow.</div></div></div>
        : watched.map(x => <ProductCard x={x} key={x.id} />)}

      <div className="tk-sec">The Daily Three</div>
      {d3.sealed && <ProductCard x={{ id: "d3-sealed", name: d3.sealed.name, price: d3.sealed.ebay, tcg: d3.sealed.tcg,
        spreadPct: d3.sealed.spreadPct, listings: d3.sealed.listings, chip: d3.sealed.chip, subtype: "sealed pick" }} why={d3.sealed.reason} />}
      {d3.graded && (d3.graded.gated
        ? <div className="c3 locked"><div className="c3b"><div className="c3t"><span className="lbl">graded pick</span><span className="chip p">🔒 GATED</span></div>
            <span className="nm">{d3.graded.name}</span>
            <div className="why">Grading Premium unlocks when data licensing clears — we don't publish numbers we can't stand behind publicly yet.</div></div></div>
        : <ProductCard x={{ id: "d3-graded", name: d3.graded.name, price: d3.graded.raw, chip: d3.graded.chip, subtype: "graded pick" }} why={d3.graded.reason} />)}
      {d3.raw && <ProductCard x={{ id: "d3-raw", name: `${d3.raw.name} (${d3.raw.set})`, price: d3.raw.price, chip: d3.raw.chip, subtype: "chase" }} why={d3.raw.reason} />}

      <div className="tk-sec">The Spread — today's signals</div>
      {(feed.signals || []).length === 0
        ? <div className="tk-agree"><b>Markets agree today.</b><div className="note">Every tracked product is inside the band. Quiet tape is a finding, not a failure.</div></div>
        : (feed.signals || []).slice(0, 12).map(s => <ProductCard x={ix.get(s.id) || { id: s.id, name: s.name, price: s.ebay?.ask, spreadPct: s.spreadPct, listings: s.ebay?.listings, tcg: s.tcg?.market, imageUrl: s.imageUrl, chip: s.class, provenance: s.provenance }} why={s.read} key={s.id} />)}
      {(feed.signals || []).length > 12 && <div className="note">+{feed.signals.length - 12} more signals on the Board tab.</div>}

      {(feed.quietMovers || []).length > 0 && (<>
        <div className="tk-sec">Quiet movers</div>
        <div className="mvs">{feed.quietMovers.slice(0, 4).map((m, i) =>
          <div className="mv" key={i}><b>{m.flagship}</b><span className="d n">{fmt(m.price)}</span></div>)}</div></>)}

      {feed.packMath?.priciest?.length > 0 && (<>
        <div className="tk-sec">Pack math — inside the sealed product</div>
        <div className="c3"><div className="c3b">
          {[...feed.packMath.priciest.slice(0, 3), ...(feed.packMath.cheapest || []).slice(0, 2)].map(r =>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }} key={r.id}>
              <span style={{ fontSize: 12.5 }}>{r.name}</span><span className="d n">{fmt(r.perPack)}/pack</span></div>)}
          <div className="note">Sealed ask median ÷ packs in the box — NOT loose-pack prices. <Chip cls="MEASURED" onTap={() => showReceipts("Pack Math", "price ÷ era-aware pack count; variable-count products excluded by name")} /></div>
        </div></div></>)}

      <div className="tk-sec">Release radar</div>
      {(feed.radar || []).length === 0
        ? <div className="note">Nothing landing inside the window — check back after the next drop announcement.</div>
        : feed.radar.map((r, i) => <div className="brow" key={i}><div className="bmid"><b>{r.name}</b><span>{r.note || ""}</span></div><div className="bnum">{r.date}</div></div>)}
      <div className="note" style={{ textAlign: "center", margin: "20px 0" }}>{feed.disclosure}</div>
    </>);
  };

  const Movers = () => (<>
    <div className="tk-sec">Movers — your view's overnight Δ</div>
    {movers.length === 0
      ? <div className="c3"><div className="c3b"><div className="why">First visit on this device — movers appear once the app has seen two different days of the tape. Come back tomorrow; the Δs will be real, not invented.</div></div></div>
      : (<>
        <div className="lbl" style={{ margin: "8px 0" }}>▲ up since your last visit</div>
        {movers.filter(m => m.delta.pct > 0).slice(0, 8).map(x => <ProductCard x={x} key={x.id} />)}
        <div className="lbl" style={{ margin: "8px 0" }}>▼ down since your last visit</div>
        {movers.filter(m => m.delta.pct < 0).slice(-8).reverse().map(x => <ProductCard x={x} key={x.id} />)}
      </>)}
    <div className="note">Δ compares this device's snapshots of the daily feed — it becomes richer the more days you check.</div>
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
          <div className="bmid"><b>{x.name}</b><span>{x.subtype}{x.listings != null ? ` · ${x.listings} listings` : ""}</span></div>
          <div className="bnum">{fmt(x.price)}<Delta d={deltaFor(snaps, x.id, today)} /></div>
          <Star id={x.id} />
        </div>))}
      <div className="note">Board shows every product the daily feed carries data for ({products.length}); the full 168-product tape lives in the data engine.</div>
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

    const renderShare = (x) => {
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
        g.fillText("DEAL CHECK · " + (tape.date || "").slice(0, 10), 40, 84);
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
    };

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
              No active listings — this market trades via auctions and sold comps, so there's no honest fair-range to print. We show gaps, not guesses.
            </div>
          ) : (<>
            <div className="strip" style={{ marginTop: 10 }}>
              <span className="st">Clean floor<b>{fmt(x.floorClean)}</b></span>
              <span className="st">Median<b>{fmt(x.median)}</b></span>
              <span className="st">Active Listings<b>{x.listings ?? "—"}</b></span>
              {!x.vintage && ix.get(x.id)?.spreadPct != null && <span className="st">Spread<b>{pctFmt(ix.get(x.id).spreadPct)}</b></span>}
            </div>
            <div style={{ position: "relative", height: 6, background: "var(--raised)", borderRadius: 99, margin: "14px 0 4px" }}>
              <div style={{ position: "absolute", left: 0, width: `${pctIn}%`, top: 0, bottom: 0, background: "linear-gradient(90deg,rgba(54,211,153,.5),var(--green))", borderRadius: 99 }} />
            </div>
            <div className="why">Asks cluster between the clean floor and the median — offers under the floor are reaching; asks past the median need a reason.</div>
            <button className="fchip on" style={{ marginTop: 10 }} onClick={() => renderShare(x)}>Render share card 📸</button>
            {shareImg && (<>
              <img src={shareImg} alt="Deal check share card" style={{ width: "100%", borderRadius: 12, marginTop: 10 }} />
              <div className="note">Long-press (or right-click) the card to save · sized for group posts.</div>
            </>)}
          </>)}
        </div>);
    };

    return (<>
      <div className="tk-sec">Deal Check <span className="lbl">{tapeState === "cached" ? "offline — cached tape" : tapeState === "live" ? `${tape?.products.length ?? 0} products` : ""}</span></div>
      {tapeState === "offline-empty"
        ? <div className="tk-banner">Can't reach the tape and nothing's cached yet — open this tab once with signal and it works offline after.</div>
        : (<>
          <input className="search" placeholder="Search any tracked product… (show-floor speed)" value={tq} onChange={e => { setTq(e.target.value); setSel(null); setShareImg(null); }} />
          {sel ? <Check x={sel} /> : results.map(x => (
            <div className="brow" key={x.id} onClick={() => { setSel(x); setShareImg(null); }} style={{ cursor: "pointer" }}>
              {x.img ? <img src={x.img} alt="" loading="lazy" width="42" height="42" /> : null}
              <div className="bmid"><b>{x.name}</b><span>{x.subtype}{x.vintage ? " · vintage" : ""}</span></div>
              <div className="bnum">{fmt(x.median)}</div>
            </div>))}
          {!sel && tq.length >= 2 && results.length === 0 && tape && <div className="note">Nothing tracked matches "{tq}" — the tape covers {tape.products.length} sealed products.</div>}
          {!sel && tq.length < 2 && <div className="note">Type two letters — built for deciding on a $1,400 ask in ten seconds, works offline once loaded.</div>}
        </>)}
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
      <div className="tk-sec">Compare — receipts side by side</div>
      <select className="cmpsel" value={cmpA} onChange={e => setCmpA(e.target.value)}>
        <option value="">Pick product A…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select className="cmpsel" value={cmpB} onChange={e => setCmpB(e.target.value)}>
        <option value="">Pick product B…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      {A && B ? (<>
        {row("Price", x => fmt(x.price))}
        {row("Spread", x => x.spreadPct != null ? pctFmt(x.spreadPct) : null)}
        {row("Active Listings", x => x.listings)}
        {row("Per pack", x => x.perPack != null ? fmt(x.perPack) : null)}
        {row("Phase", x => life(x)?.phase)}
        {row("Legality", x => life(x)?.legalTag)}
        <div className="note">Blank cells mean the daily feed carries no verified number for that instrument — we show gaps, not guesses.</div>
      </>) : <div className="note">Pick two products to lay their receipts side by side.</div>}
    </>);
  };

  return (
    <div className="tk-root">
      <style>{css}</style>
      <div className="tk-phone">
        <div className="tk-head">
          <div className="tk-wm">⚡CATCH<b>'EM</b></div>
          <div className="tk-hright">
            {streak > 1 && <span className="tk-streak">🔥 Day {streak}</span>}
            {DISCORD_ALERTS_URL && <a className="tk-bell" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} href={DISCORD_ALERTS_URL} target="_blank" rel="noreferrer" aria-label="Discord alerts">🔔</a>}
            <span className="tk-date">{today}</span>
            <button className="tk-refresh" onClick={load}>{loading ? "…" : "↻"}</button>
          </div>
        </div>
        {stale && <div className="tk-banner">machine hiccup — showing yesterday's tape ({today}). The bots will catch up on their own.</div>}
        {tab === "home" && <Home />}
        {tab === "movers" && <Movers />}
        {tab === "board" && <Board />}
        {tab === "compare" && <Compare />}
        {tab === "check" && <DealCheck />}
        {receipt && (<>
          <div className="drawer-back" onClick={() => setReceipt(null)} />
          <div className="drawer" role="dialog" aria-label="Receipts">
            <h4>Receipts — {receipt.title}</h4>
            {receipt.lines.map((l, i) => <div className="receipt" key={i}>{l}</div>)}
            <div className="disc">{feed.disclosure}</div>
          </div></>)}
        <nav className="tabs">
          {[["home", "⚡", "Ticker"], ["movers", "▲▼", "Movers"], ["board", "▦", "Board"], ["compare", "⇄", "Compare"], ["check", "✓", "Check"]].map(([id, icon, name]) =>
            <button className={`tab ${tab === id ? "on" : ""}`} key={id} onClick={() => setTab(id)}><i>{icon}</i>{name}</button>)}
        </nav>
      </div>
    </div>
  );
}
