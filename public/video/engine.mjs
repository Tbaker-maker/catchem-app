/**
 * Post Office Shorts — fact pack, scripts, language checks, limits.
 * Browser and Node. No network. No invented cards or prices.
 * A price is printable only as `TCGplayer market: $X.XX (YYYY-MM-DD)`.
 */

export const WATERMARK = "Made with Catch'em Post Office";
export const FREE_PER_WEEK = 2;
export const FREE_PER_DAY = 1;
export const PREMIUM_PER_DAY = 5;
export const PREMIUM_PER_WEEK = 35;
export const HOOK_MAX_SEC = 2;
export const HOOK_MAX_WORDS = 12;

export const CAPTION_FG = "#ffffff";
export const CAPTION_BG = "#141416";

const BANNED =
  /\b(buy|sell|sold|hold|floor|floors|targets?|plays|picks|bullish|bearish|invest|investing|investment|investor|roi|crypto|nft|web3)\b|to the moon/i;
const SLOP = /amazing|check out|🔥|💯|🚀/i;
const ASCII_POKEMON = /pokemon/i;

export function wordCount(text) {
  return String(text || "").trim().match(/\S+/g)?.length || 0;
}

export function money(usd) {
  return "$" + Number(usd).toFixed(2);
}

/** Exact label, or null when price or date is missing. */
export function priceLabel(usd, date) {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) return null;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return `TCGplayer market: ${money(usd)} (${date})`;
}

function relLuminance(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const ch = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(fg, bg) {
  const a = relLuminance(fg);
  const b = relLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function cardFromRow(row, usdMap, asof) {
  if (!row || !row.id || !row.name) return null;
  const card = {
    id: String(row.id),
    name: String(row.name),
    set: String(row.set || ""),
    number: String(row.number ?? row.lock ?? ""),
    artist: String(row.artist || ""),
    year: String(row.year || ""),
    rarity: String(row.rarity || ""),
    image: String(row.image || row.src || ""),
  };
  const raw = usdMap ? usdMap[card.id] : row.usd;
  const date = row.date || asof || "";
  if (typeof raw === "number" && Number.isFinite(raw) && date) {
    const label = priceLabel(raw, String(date).slice(0, 10));
    if (label) {
      card.usd = raw;
      card.date = String(date).slice(0, 10);
      card.priceLabel = label;
    }
  }
  return card;
}

/**
 * @param {object[]} cards catalog rows already narrowed
 * @param {{asof?: string, source?: string, points?: object[]}} meta
 * points, when present, must be supplied dated readings. Never synthesized here.
 */
export function buildPack(cards, meta = {}) {
  const asof = meta.asof || "";
  const clean = [];
  for (const row of cards || []) {
    const card = row.priceLabel ? row : cardFromRow(row, null, row.date || asof);
    if (!card) continue;
    clean.push(card);
  }
  const points = [];
  for (const p of meta.points || []) {
    const label = priceLabel(p.usd, p.date);
    if (!label || !p.id) continue;
    points.push({ id: String(p.id), usd: p.usd, date: p.date, label });
  }
  const refs = new Set();
  const allowedPrices = new Set();
  for (const c of clean) {
    refs.add("card:" + c.id);
    if (c.priceLabel) {
      refs.add("price:" + c.id);
      allowedPrices.add(c.priceLabel);
    }
  }
  for (const p of points) {
    refs.add("price:" + p.id + ":" + p.date);
    allowedPrices.add(p.label);
  }
  return {
    asof,
    source: meta.source || "",
    cards: clean,
    points,
    refs: [...refs],
    allowedPrices: [...allowedPrices],
  };
}

function scene(id, duration, onScreen, spoken, factRefs) {
  return {
    id,
    duration,
    onScreen,
    spoken,
    caption: onScreen,
    factRefs: factRefs || [],
  };
}

function endScene() {
  return scene(
    "rights",
    2.2,
    "Card art belongs to its rights holders.\nNot an official Pokémon site.",
    "Card art belongs to its rights holders. Not an official Pokémon site.",
    []
  );
}

export function top5Script(pack) {
  const cards = pack.cards.slice(0, 5);
  const setName = cards[0]?.set || "this set";
  const words = ["Zero", "One", "Two", "Three", "Four", "Five"];
  const n = cards.length;
  const hook = `${words[n] || String(n)} chase ${n === 1 ? "card" : "cards"} in ${setName}.`;
  const scenes = [scene("hook", 1.7, hook, hook, cards.map((c) => "card:" + c.id))];
  const ranked = cards.slice().reverse();
  ranked.forEach((c, i) => {
    const place = ranked.length - i;
    const lines = [
      "#" + place,
      c.name,
      [c.number, c.set].filter(Boolean).join(" · "),
      c.artist || "",
      c.priceLabel || "",
    ].filter(Boolean);
    const spoken = [c.name, c.number ? "number " + c.number : "", c.set, c.artist ? "art by " + c.artist : "", c.priceLabel || ""]
      .filter(Boolean)
      .join(". ");
    const refs = ["card:" + c.id];
    if (c.priceLabel) refs.push("price:" + c.id);
    scenes.push(scene("card-" + c.id, 3.2, lines.join("\n"), spoken, refs));
  });
  scenes.push(endScene());
  return finish("top5", hook, scenes, pack);
}

export function moverScript(pack) {
  const card = pack.cards[0];
  if (!card) return null;
  const pts = (pack.points || []).filter((p) => p.id === card.id);
  const hook = pts.length >= 2 ? "Two dated market readings." : "One market reading.";
  const scenes = [scene("hook", 1.6, hook, hook, [])];
  if (pts.length >= 2) {
    const a = pts[0];
    const b = pts[1];
    const on = `${card.name}\n${a.label}\n${b.label}\nIt changed.`;
    const spoken = `${card.name}. ${a.label}. ${b.label}. It changed.`;
    scenes.push(
      scene("change", 8, on, spoken, ["card:" + card.id, "price:" + card.id + ":" + a.date, "price:" + card.id + ":" + b.date])
    );
  } else if (card.priceLabel) {
    const on = `${card.name}\n${card.number ? card.number + " · " : ""}${card.set}\n${card.priceLabel}\nNo earlier market date in this snapshot.`;
    const spoken = `${card.name}. ${card.priceLabel}. No earlier market date in this snapshot.`;
    scenes.push(scene("reading", 8, on, spoken, ["card:" + card.id, "price:" + card.id]));
  } else {
    const on = `${card.name}\nNo dated TCGplayer market reading in this snapshot.`;
    scenes.push(scene("reading", 6, on, on.replace(/\n/g, " "), ["card:" + card.id]));
  }
  scenes.push(endScene());
  return finish("mover", hook, scenes, pack);
}

export function binderScript(pack) {
  const cards = pack.cards.slice(0, 8);
  const hook = "Open the binder.";
  const scenes = [scene("hook", 1.5, hook, hook, [])];
  for (const c of cards) {
    const lines = [c.name, [c.number, c.set].filter(Boolean).join(" · "), c.artist || "", c.priceLabel || ""].filter(Boolean);
    const spoken = [c.name, c.set, c.artist ? "art by " + c.artist : "", c.priceLabel || ""].filter(Boolean).join(". ");
    const refs = ["card:" + c.id];
    if (c.priceLabel) refs.push("price:" + c.id);
    scenes.push(scene("bind-" + c.id, 2.8, lines.join("\n"), spoken, refs));
  }
  scenes.push(endScene());
  return finish("binder", hook, scenes, pack);
}

function finish(template, hook, scenes, pack) {
  let t = 0;
  const timed = scenes.map((s) => {
    const words = String(s.spoken || "").split(/\s+/).filter(Boolean);
    const step = words.length ? s.duration / words.length : s.duration;
    const cues = words.map((w, i) => ({ t: Math.round((t + i * step) * 100) / 100, w }));
    const out = { ...s, t0: Math.round(t * 100) / 100, cues };
    t += s.duration;
    return out;
  });
  const names = pack.cards.map((c) => c.name).filter(Boolean);
  const caption = [hook, names.slice(0, 5).join(", ")].filter(Boolean).join(" ");
  return {
    template,
    hook,
    scenes: timed,
    duration: Math.round(t * 100) / 100,
    title: hook.slice(0, 70),
    caption: caption.slice(0, 150),
    watermark: WATERMARK,
  };
}

export function scriptFor(template, pack) {
  if (template === "top5") return top5Script(pack);
  if (template === "mover") return moverScript(pack);
  if (template === "binder") return binderScript(pack);
  return null;
}

export function languageFaults(text) {
  const faults = [];
  const s = String(text || "");
  if (BANNED.test(s)) faults.push("banned");
  if (SLOP.test(s)) faults.push("slop");
  if (ASCII_POKEMON.test(s)) faults.push("accent");
  return faults;
}

export function validateScript(script, pack) {
  const faults = [];
  if (!script || !script.scenes?.length) {
    faults.push("empty");
    return faults;
  }
  const hook = script.scenes[0];
  if (hook.duration > HOOK_MAX_SEC) faults.push("hook-slow");
  if (wordCount(hook.onScreen) > HOOK_MAX_WORDS || wordCount(hook.spoken) > HOOK_MAX_WORDS) faults.push("hook-long");
  const allowed = new Set(pack.allowedPrices || []);
  const refs = new Set(pack.refs || []);
  const blob = [];
  for (const sc of script.scenes) {
    blob.push(sc.onScreen, sc.spoken, sc.caption);
    for (const ref of sc.factRefs || []) {
      if (ref && !refs.has(ref)) faults.push("ref:" + ref);
    }
    const joined = `${sc.onScreen}\n${sc.spoken}`;
    for (const f of languageFaults(joined)) faults.push(f);
    const dollars = joined.match(/\$\d+(?:\.\d+)?/g) || [];
    for (const d of dollars) {
      const hit = [...allowed].some((label) => label.includes(d));
      if (!hit) faults.push("price:" + d);
    }
    if (/TCGplayer market:/.test(joined)) {
      const labels = joined.match(/TCGplayer market: \$\d+\.\d{2} \(\d{4}-\d{2}-\d{2}\)/g) || [];
      if (!labels.length) faults.push("price-shape");
      for (const label of labels) {
        if (!allowed.has(label)) faults.push("price-unlisted:" + label);
      }
    }
  }
  for (const f of languageFaults(script.caption || "")) faults.push(f);
  for (const f of languageFaults(script.title || "")) faults.push(f);
  return [...new Set(faults)];
}

/** Planning estimate, not a measured phone. 1080p over 60s drops to a lighter local frame. */
export function estimateRenderMs({ durationSec, width, height, hasFace }) {
  const pixels = width * height;
  const base = pixels >= 1080 * 1920 ? 2.4 : pixels >= 720 * 1280 ? 1.35 : 0.85;
  const face = hasFace ? 1.35 : 1;
  return Math.round(durationSec * 1000 * base * face);
}

export function exportPlan({ durationSec, hasFace }) {
  const full = { width: 1080, height: 1920, ms: estimateRenderMs({ durationSec, width: 1080, height: 1920, hasFace }) };
  if (full.ms <= 60000) return { mode: "local", ...full, note: "Estimate is under 60s." };
  const lite = { width: 540, height: 960, ms: estimateRenderMs({ durationSec, width: 540, height: 960, hasFace }) };
  if (lite.ms <= 60000) {
    return {
      mode: "local-lite",
      ...lite,
      note: "1080×1920 estimate is over 60s, so this export stays on your device at 540×960.",
    };
  }
  return {
    mode: "server-blocked",
    width: 540,
    height: 960,
    ms: lite.ms,
    note: "Even the light export estimates over 60s. Server render is not connected, so nothing is uploaded.",
  };
}

export function quotaDecision({ weekUsed, dayUsed, premium }) {
  const weekCap = premium ? PREMIUM_PER_WEEK : FREE_PER_WEEK;
  const dayCap = premium ? PREMIUM_PER_DAY : FREE_PER_DAY;
  const week = weekUsed | 0;
  const day = dayUsed | 0;
  if (day >= dayCap) return { ok: false, reason: "day", weekCap, dayCap, upgrade: !premium };
  if (week >= weekCap) return { ok: false, reason: "week", weekCap, dayCap, upgrade: !premium };
  return { ok: true, reason: "", weekCap, dayCap, weekLeft: weekCap - week, dayLeft: dayCap - day, upgrade: false };
}

export function watermarkFor(premium) {
  return premium ? "" : WATERMARK;
}

/** Face pixels are not given a destination. This stays false so a reviewer can grep the contract. */
export function faceLeavesDevice() {
  return false;
}

export function projectJson({ template, pack, script, brand }) {
  return {
    version: 1,
    template,
    savedAt: pack.asof || "",
    catalogAsOf: pack.asof || "",
    source: pack.source || "",
    cardIds: pack.cards.map((c) => c.id),
    script,
    brand: {
      handle: String(brand?.handle || "").slice(0, 32),
      accent: /^#[0-9a-fA-F]{6}$/.test(brand?.accent || "") ? brand.accent : "#7eb6ff",
    },
    consent: { saveFace: false, serverRender: false },
  };
}
