// THE TICKER — Catch'em's opening live screen (app-specs-v1 §1).
// Static feed consumer: pulse-feed.json from Catchem-data main. No auth,
// no db, no writes. Every number carries its provenance class as a chip;
// tapping a chip opens the receipts drawer (provenance + disclosure).
// States: calibrating · stale-feed (>36h) · markets-agree (empty signals).
import React, { useEffect, useState, useCallback, useRef } from "react";

const FEED_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/pulse-feed.json";
const STALE_HOURS = 36;

const css = `
:root{--bg:#0b0d14;--panel:#12141d;--line:#232736;--txt:#d8dde8;--dim:#8a93a8;
--gold:#F5C842;--green:#36d399;--red:#ff6b7a;--vio:#a78bfa;
--sans:'Sora',-apple-system,system-ui,sans-serif;
--disp:'Syne',var(--sans);
--mono:'JetBrains Mono','Courier New',monospace}
.tk-root{background:var(--bg);color:var(--txt);min-height:100vh;
font:15px/1.5 var(--sans);display:flex;justify-content:center}
.tk-phone{width:100%;max-width:420px;padding:0 16px 96px}
.tk-head{display:flex;justify-content:space-between;align-items:baseline;
padding:16px 0 12px;position:sticky;top:0;background:var(--bg);z-index:5}
.tk-brand{font:800 28px/1.2 var(--disp);letter-spacing:.01em}
.tk-brand span{color:var(--gold)}
.tk-ticktag{font:700 10px var(--mono);font-style:normal;color:var(--dim);
letter-spacing:.08em;vertical-align:super;margin-left:4px}
.tk-date{font:400 11px var(--mono);font-variant-numeric:tabular-nums;color:var(--dim)}
.tk-banner{background:rgba(255,107,122,.1);border:1px solid rgba(255,107,122,.35);
color:var(--red);border-radius:12px;padding:12px 16px;font-size:13px;line-height:1.5;margin:8px 0 12px}
.tk-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;
padding:16px;margin-bottom:12px}
.tk-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
.tk-mono{font:400 12px var(--mono);font-variant-numeric:tabular-nums;color:var(--dim)}
.tk-big{font:600 15px/1.5 var(--sans)}
.tk-up{color:var(--green)} .tk-down{color:var(--red)}
.tk-sub{font-size:12px;line-height:1.5;color:var(--dim);margin-top:8px}
.tk-sec{font:700 11px var(--mono);color:var(--dim);letter-spacing:.08em;
text-transform:uppercase;margin:32px 0 12px}
.tk-bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin:8px 0 4px}
.tk-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--green))}
.tk-chip{display:inline-block;font:700 10px var(--mono);letter-spacing:.06em;
padding:2px 8px;border-radius:99px;cursor:pointer;user-select:none;vertical-align:middle}
.tk-chip.v{background:rgba(54,211,153,.12);color:var(--green);border:1px solid rgba(54,211,153,.35)}
.tk-chip.rd{background:rgba(245,200,66,.12);color:var(--gold);border:1px solid rgba(245,200,66,.35)}
.tk-chip.m{background:rgba(167,139,250,.12);color:var(--vio);border:1px solid rgba(167,139,250,.35)}
.tk-agree{border:1px solid rgba(54,211,153,.35);background:linear-gradient(135deg,#0d1512,#12141d);
text-align:center;padding:22px 14px}
.tk-agree b{color:var(--green);font-size:16px}
.tk-refresh{background:transparent;border:1px solid var(--line);color:var(--dim);
border-radius:8px;font-size:11px;padding:3px 10px;cursor:pointer}
.tk-drawer-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40}
.tk-drawer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;
max-width:420px;background:#0e1018;border:1px solid var(--line);border-radius:14px 14px 0 0;
padding:16px 16px 22px;z-index:50}
.tk-drawer h4{margin:0 0 8px;font-size:13px;color:var(--txt)}
.tk-receipt{font:400 11.5px/1.6 var(--mono);color:var(--dim);
border-left:2px solid var(--line);padding-left:10px;margin:8px 0;word-break:break-word}
.tk-disc{font:400 11px/1.5 var(--mono);color:var(--gold);opacity:.85;margin-top:10px}
.tk-load{padding:60px 0;text-align:center;color:var(--dim);font:400 12px var(--mono)}
.tk-skel{background:var(--panel);border:1px solid var(--line);border-radius:12px;height:72px;margin-bottom:12px;position:relative;overflow:hidden}
.tk-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
background:linear-gradient(90deg,transparent,rgba(245,200,66,.06),transparent);
animation:tk-shimmer 1.4s infinite}
@keyframes tk-shimmer{100%{transform:translateX(100%)}}
.tk-pull{font:400 10px var(--mono);color:var(--dim);text-align:center;padding:4px 0}
`;

function Chip({ cls, onTap }) {
  const label = cls === "VERIFIED" ? "VERIFIED" : cls === "MEASURED" ? "MEASURED" : "READ";
  const tone = cls === "VERIFIED" ? "v" : cls === "MEASURED" ? "m" : "rd";
  return (
    <span className={`tk-chip ${tone}`} onClick={onTap} role="button" aria-label={`${label} — tap for receipts`}>
      {label}
    </span>
  );
}

const fmt = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function Ticker() {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState(null);
  const [receipt, setReceipt] = useState(null); // {title, lines[]}
  const [loading, setLoading] = useState(true);
  const touchY = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(FEED_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("feed " + r.status);
      setFeed(await r.json());
      setErr(null);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // pull-to-refresh (simple top-overscroll gesture)
  useEffect(() => {
    const start = (e) => { if (window.scrollY === 0) touchY.current = e.touches[0].clientY; };
    const end = (e) => {
      if (touchY.current != null && e.changedTouches[0].clientY - touchY.current > 90) load();
      touchY.current = null;
    };
    window.addEventListener("touchstart", start);
    window.addEventListener("touchend", end);
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [load]);

  const showReceipts = (title, provenance) => {
    const lines = [];
    if (typeof provenance === "string") lines.push(provenance);
    else if (provenance) for (const [k, v] of Object.entries(provenance)) lines.push(`${k}: ${v}`);
    setReceipt({ title, lines });
  };

  if (loading && !feed)
    return (<div className="tk-root"><style>{css}</style><div className="tk-phone">
      <div className="tk-head"><div className="tk-brand">CATCH<span>'EM</span></div></div>
      {[0,1,2,3,4].map(i => <div className="tk-skel" key={i} aria-hidden="true" />)}
      <div className="tk-load">reading the tape…</div>
    </div></div>);
  if (err && !feed)
    return (<div className="tk-root"><style>{css}</style><div className="tk-phone">
      <div className="tk-banner">Couldn't reach the feed ({err}). <button className="tk-refresh" onClick={load}>retry</button></div>
    </div></div>);

  const ageH = (Date.now() - new Date(feed.generatedAt)) / 36e5;
  const stale = ageH > STALE_HOURS;
  const p = feed.panel || {};
  const signals = feed.signals || [];
  const disclosure = feed.disclosure || "";

  return (
    <div className="tk-root">
      <style>{css}</style>
      <div className="tk-phone">
        <div className="tk-head">
          <div className="tk-brand">CATCH<span>'EM</span> <em className="tk-ticktag">THE TICKER</em></div>
          <div className="tk-date">{feed.date} <button className="tk-refresh" onClick={load}>{loading ? "…" : "↻"}</button></div>
        </div>
        <div className="tk-pull">pull down to refresh</div>

        {stale && (
          <div className="tk-banner">
            machine hiccup — showing yesterday's tape ({feed.date}). The bots will catch up on their own.
          </div>
        )}

        {/* panel strip */}
        <div className="tk-card">
          <div className="tk-row tk-mono">
            <span>{p.skusTracked ?? "—"} SKUs</span>
            <span>{p.signals ?? 0} signals</span>
            <span>reads {p.calibrationDay ?? "—"}/{p.calibrationOf ?? "—"}</span>
          </div>
          {p.calibrationDay != null && p.calibrationDay < p.calibrationOf && (
            <>
              <div className="tk-bar"><div className="tk-fill" style={{ width: `${(100 * p.calibrationDay) / p.calibrationOf}%` }} /></div>
              <div className="tk-sub">
                Wyckoff reads calibrating — nothing false in the meantime.{" "}
                <Chip cls="READ" onTap={() => showReceipts("Calibration", p.heatMode)} />
              </div>
            </>
          )}
        </div>

        {/* signals */}
        <div className="tk-sec">The Spread — today's signals</div>
        {signals.length === 0 ? (
          <div className="tk-card tk-agree">
            <b>Markets agree today.</b>
            <div className="tk-sub">eBay asks and TCG-side prices are inside the band on every tracked SKU. Quiet tape is a finding, not a failure.</div>
          </div>
        ) : (
          signals.map((s) => (
            <div className="tk-card" key={s.id}>
              <div className="tk-row">
                <span className="tk-big">{s.name}</span>
                <span className={`tk-mono ${s.spreadPct >= 0 ? "tk-up" : "tk-down"}`} style={{ fontSize: 14 }}>
                  {s.spreadPct >= 0 ? "+" : ""}{s.spreadPct}%
                </span>
              </div>
              <div className="tk-sub">
                eBay {fmt(s.ebay?.ask)} · {s.ebay?.listings ?? "—"} listings
                {"  vs  "}TCG {fmt(s.tcg?.market)} · {s.tcg?.listings == null ? "supply n/a (provider ships none for sealed)" : `${s.tcg.listings} listings`}{" "}
                <Chip cls={s.class || "READ"} onTap={() => showReceipts(s.name, s.provenance)} />
              </div>
              <div className="tk-sub" style={{ fontStyle: "italic" }}>{s.read}</div>
            </div>
          ))
        )}

        {/* quiet movers */}
        {(feed.quietMovers || []).length > 0 && (
          <>
            <div className="tk-sec">Quiet movers — tape without headlines</div>
            {feed.quietMovers.map((q, i) => (
              <div className="tk-card" key={i}>
                <div className="tk-row">
                  <span className="tk-big">{q.flagship}</span>
                  <span className="tk-mono">{fmt(q.price)}</span>
                </div>
                <div className="tk-sub">
                  {q.set} · {q.listings ?? "—"} active listings{q.spreadPct != null ? ` · spread ${q.spreadPct >= 0 ? "+" : ""}${q.spreadPct}%` : ""}{" "}
                  <Chip cls={q.class || "READ"} onTap={() => showReceipts(q.flagship, q.provenance || "Catchem-data eBay active asks")} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* pack math mini */}
        {feed.packMath?.priciest?.length > 0 && (
          <>
            <div className="tk-sec">Pack math — what each pack costs INSIDE the sealed product</div>
            <div className="tk-card">
              {feed.packMath.priciest.slice(0, 3).map((r) => (
                <div className="tk-row" key={r.id} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13 }}>{r.name}</span>
                  <span className="tk-mono">{fmt(r.perPack)}/pack</span>
                </div>
              ))}
              {(feed.packMath.cheapest || []).slice(0, 2).map((r) => (
                <div className="tk-row" key={r.id} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13 }}>{r.name}</span>
                  <span className="tk-mono tk-up">{fmt(r.perPack)}/pack</span>
                </div>
              ))}
              <div className="tk-sub">
                Sealed ask median ÷ packs in the box — NOT loose-pack prices. Founder-misread-tested.{" "}
                <Chip cls="MEASURED" onTap={() => showReceipts("Pack Math", "price ÷ era-aware pack count; variable-count products excluded by name")} />
              </div>
            </div>
          </>
        )}

        {/* radar */}
        <div className="tk-sec">Release radar</div>
        {(feed.radar || []).length === 0 ? (
          <div className="tk-card tk-sub">Nothing landing inside the window — check back after the next drop announcement.</div>
        ) : (
          feed.radar.map((r, i) => (
            <div className="tk-card" key={i}>
              <div className="tk-row">
                <span className="tk-big">{r.name}</span>
                <span className="tk-mono">{r.date}</span>
              </div>
              {r.note && <div className="tk-sub">{r.note}</div>}
            </div>
          ))
        )}

        <div className="tk-sub" style={{ textAlign: "center", margin: "18px 0" }}>
          {disclosure}
        </div>

        {/* receipts drawer */}
        {receipt && (
          <>
            <div className="tk-drawer-back" onClick={() => setReceipt(null)} />
            <div className="tk-drawer" role="dialog" aria-label="Receipts">
              <h4>Receipts — {receipt.title}</h4>
              {receipt.lines.map((l, i) => (<div className="tk-receipt" key={i}>{l}</div>))}
              <div className="tk-disc">{disclosure}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
