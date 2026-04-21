import { useState, useMemo, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── Browser storage shim ─────────────────────────────────────────────────────
// Inside Claude artifacts, window.storage is provided by the host. Outside
// (production, local dev), shim it to localStorage so persistence Just Works™.
// Non-destructive: if window.storage already exists, leave it alone.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (key) => {
      try {
        const val = localStorage.getItem(key);
        return val !== null ? { value: val } : null;
      } catch { return null; }
    },
    set: async (key, value) => {
      try { localStorage.setItem(key, value); return true; } catch { return false; }
    },
    delete: async (key) => {
      try { localStorage.removeItem(key); return true; } catch { return false; }
    },
    list: async (prefix) => {
      try {
        const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
        return { keys };
      } catch { return { keys: [] }; }
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EBAY_FEE = 0.1335;
const SHIPPING = 4.5;
const PSA_COST = 25;
const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

const BUDGET_MIN = 10;
const BUDGET_MAX = 10000;
const BUDGET_UNLIMITED = 999999;
const BUDGET_PRESETS = [50, 100, 250, 500, 1000, 5000];

const MODES = {
  collector: {
    key: "collector",
    label: "Collector",
    emoji: "🏆",
    tagline: "Build something worth keeping",
    desc: "We rank by long-term value, appreciation, and collectibility.",
    color: "#6c8fff",
    sortKey: "collectorScore",
  },
  flipper: {
    key: "flipper",
    label: "Flipper",
    emoji: "⚡",
    tagline: "Buy smart. Sell smarter.",
    desc: "We rank by profit margin, liquidity, and speed to sell.",
    color: "#00c97a",
    sortKey: "flipScore",
  },
  grader: {
    key: "grader",
    label: "Grader",
    emoji: "💎",
    tagline: "Find the hidden gems",
    desc: "We rank by grading ROI, gem rate, and PSA 10 upside.",
    color: "#c77dff",
    sortKey: "gradingScore",
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────
// Fallback placeholder for sealed / special items we don't have a card image for
const PH = (label, color = "c77dff") =>
  `https://placehold.co/160x220/16161e/${color}?text=${encodeURIComponent(label)}&font=inter`;

const MARKET_CARDS = [
  { id: "m1", name: "Charizard 1st Edition Holo", set: "Base Set", setId: "base1", type: "graded",
    image: "https://images.pokemontcg.io/base1/4_hires.png",
    price: 12500, change7d: 1.2, change30d: 4.8, change90d: 8.5,
    collectorScore: 98, flipScore: 58, gradingScore: 68,
    liquidity: 42, gemRate: 2, supplyTrend: "declining",
    sparkline: [11200, 11400, 11800, 12000, 12100, 12300, 12500] },

  { id: "m2", name: "Umbreon VMAX Alt Art", set: "Evolving Skies", setId: "swsh7", type: "single",
    image: "https://images.pokemontcg.io/swsh7/215_hires.png",
    price: 158, change7d: 3.2, change30d: 9.4, change90d: 18.9,
    collectorScore: 95, flipScore: 78, gradingScore: 82,
    liquidity: 88, gemRate: 28, supplyTrend: "stable",
    sparkline: [132, 138, 142, 148, 151, 155, 158] },

  { id: "m3", name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", setId: "swsh7", type: "single",
    image: "https://images.pokemontcg.io/swsh7/218_hires.png",
    price: 134, change7d: 4.1, change30d: 12.2, change90d: 24.1,
    collectorScore: 91, flipScore: 82, gradingScore: 85,
    liquidity: 85, gemRate: 32, supplyTrend: "declining",
    sparkline: [108, 114, 119, 124, 128, 131, 134] },

  { id: "m5", name: "Charizard ex SAR", set: "Obsidian Flames", setId: "sv3", type: "single",
    image: "https://images.pokemontcg.io/sv3/215_hires.png",
    price: 52, change7d: 1.8, change30d: 8.4, change90d: 22.4,
    collectorScore: 87, flipScore: 85, gradingScore: 78,
    liquidity: 92, gemRate: 24, supplyTrend: "stable",
    sparkline: [42, 44, 46, 48, 50, 51, 52] },

  { id: "m7", name: "Mew VMAX Alt Art", set: "Fusion Strike", setId: "swsh8", type: "single",
    image: "https://images.pokemontcg.io/swsh8/269_hires.png",
    price: 68, change7d: 5.2, change30d: 15.4, change90d: 31.2,
    collectorScore: 84, flipScore: 88, gradingScore: 86,
    liquidity: 80, gemRate: 22, supplyTrend: "declining",
    sparkline: [52, 55, 58, 62, 64, 66, 68] },

  { id: "m8", name: "Lugia V Alt Art", set: "Silver Tempest", setId: "swsh12", type: "single",
    image: "https://images.pokemontcg.io/swsh12/186_hires.png",
    price: 92, change7d: 2.8, change30d: 8.9, change90d: 19.5,
    collectorScore: 86, flipScore: 76, gradingScore: 80,
    liquidity: 74, gemRate: 30, supplyTrend: "stable",
    sparkline: [78, 81, 84, 86, 88, 90, 92] },

  { id: "m9", name: "Pikachu VMAX Rainbow", set: "Vivid Voltage", type: "single",
    image: "https://images.pokemontcg.io/swsh4/188_hires.png",
    price: 112, change7d: -0.8, change30d: 2.4, change90d: 6.2,
    collectorScore: 78, flipScore: 62, gradingScore: 72,
    liquidity: 70, gemRate: 38, supplyTrend: "stable",
    sparkline: [108, 110, 113, 111, 112, 113, 112] },

  { id: "m10", name: "Gengar VMAX Alt Art", set: "Fusion Strike", setId: "swsh8", type: "single",
    image: "https://images.pokemontcg.io/swsh8/271_hires.png",
    price: 42, change7d: 4.8, change30d: 14.2, change90d: 28.6,
    collectorScore: 82, flipScore: 86, gradingScore: 81,
    liquidity: 82, gemRate: 26, supplyTrend: "declining",
    sparkline: [32, 34, 36, 38, 40, 41, 42] },

  { id: "m11", name: "Pikachu Illustrator", set: "CoroCoro Promo", type: "graded",
    image: PH("Grail", "c77dff"),
    price: 480000, change7d: 0.5, change30d: 2.8, change90d: 5.5,
    collectorScore: 100, flipScore: 28, gradingScore: 52,
    liquidity: 12, gemRate: 1, supplyTrend: "declining",
    sparkline: [455000, 462000, 468000, 472000, 475000, 478000, 480000] },

  { id: "m12", name: "Charizard ex", set: "Obsidian Flames", setId: "sv3", type: "single",
    image: "https://images.pokemontcg.io/sv3/125_hires.png",
    price: 18, change7d: 2.2, change30d: 6.8, change90d: 13.4,
    collectorScore: 72, flipScore: 70, gradingScore: 66,
    liquidity: 88, gemRate: 42, supplyTrend: "stable",
    sparkline: [15, 16, 16, 17, 17, 18, 18] },
];

const INITIAL_COLLECTION = [
  { id: 1, name: "Charizard ex", set: "Obsidian Flames", number: "125/197", condition: "NM",
    quantity: 1, purchasePrice: 12, currentPrice: 18, rawPSA9: 22, rawPSA10: 58,
    image: "https://images.pokemontcg.io/sv3/125_hires.png" },
  { id: 2, name: "Umbreon VMAX Alt Art", set: "Evolving Skies", number: "215/203", condition: "NM",
    quantity: 1, purchasePrice: 120, currentPrice: 158, rawPSA9: 180, rawPSA10: 340,
    image: "https://images.pokemontcg.io/swsh7/215_hires.png" },
  { id: 3, name: "Pikachu VMAX Rainbow", set: "Vivid Voltage", number: "188/185", condition: "LP",
    quantity: 1, purchasePrice: 95, currentPrice: 112, rawPSA9: 125, rawPSA10: 210,
    image: "https://images.pokemontcg.io/swsh4/188_hires.png" },
  { id: 4, name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", number: "218/203", condition: "NM",
    quantity: 1, purchasePrice: 85, currentPrice: 134, rawPSA9: 160, rawPSA10: 290,
    image: "https://images.pokemontcg.io/swsh7/218_hires.png" },
];

const HISTORY = [
  { month: "Nov", value: 312 }, { month: "Dec", value: 389 }, { month: "Jan", value: 411 },
  { month: "Feb", value: 438 }, { month: "Mar", value: 475 }, { month: "Apr", value: 512 },
];

const INITIAL_WISHLIST = [
  { id: 101, name: "Mew VMAX Alt Art", set: "Fusion Strike", targetPrice: 55, currentPrice: 68,
    image: "https://images.pokemontcg.io/swsh8/269_hires.png" },
  { id: 102, name: "Gengar VMAX Alt Art", set: "Fusion Strike", targetPrice: 40, currentPrice: 42,
    image: "https://images.pokemontcg.io/swsh8/271_hires.png" },
];

// Single key holds the whole persisted state blob so we do one write per change,
// not many. See <persistent_storage_for_artifacts> guidance in the system docs.
const STORAGE_KEY = "catchem-state-v1";

// ─── Pokémon TCG API ──────────────────────────────────────────────────────────
// Free public API at pokemontcg.io. No key required for modest use.
// Returns real cards with real TCGplayer market prices. Price history, gem
// rates, and sell-through liquidity aren't in the response — we synthesize
// those from rarity + price + a deterministic hash so the same card always
// produces the same scores. When we wire up real signals (eBay sold history,
// PSA pop reports), the synthesis layer gets replaced and UI stays identical.
const API_BASE = "https://api.pokemontcg.io/v2";
const MARKET_CACHE_KEY = "catchem-market-cache-v5";
const MARKET_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Rarity → baseline Catch'em quality score (0-100). Drives mode scores.
const RARITY_BASE = {
  "Common": 35, "Uncommon": 45,
  "Rare": 60, "Rare Holo": 70,
  "Rare Holo EX": 78, "Rare Holo GX": 80,
  "Rare Holo V": 78, "Rare Holo VMAX": 84, "Rare Holo VSTAR": 84,
  "Rare Ultra": 82, "Ultra Rare": 82,
  "Rare Secret": 88, "Secret Rare": 88,
  "Rare Rainbow": 86, "Rainbow Rare": 86,
  "Rare Shiny": 82, "Shiny Rare": 82,
  "Amazing Rare": 80, "Radiant Rare": 80,
  "Rare Holo LV.X": 86, "LEGEND": 85,
  "Illustration Rare": 88,
  "Special Illustration Rare": 94,
  "Hyper Rare": 95,
  "Double Rare": 72,
  "ACE SPEC Rare": 84,
  "Promo": 55, "Rare Promo": 60,
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function rarityBase(rarity) { return RARITY_BASE[rarity] ?? 60; }

function seedFromId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Deterministic pseudo-random in a range, derived from a seed.
function pseudo(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return min + r * (max - min);
}

// Pull a usable USD market price from TCGplayer's variant map.
// Falls back through market → mid → (low+high)/2 so vintage cards without a
// live market price still register. Prefers 1st edition holo first for vintage.
function extractTCGPrice(tcgplayer) {
  const prices = tcgplayer && tcgplayer.prices;
  if (!prices) return null;
  const extract = p => {
    if (!p) return null;
    if (p.market) return p.market;
    if (p.mid) return p.mid;
    if (p.low && p.high) return (p.low + p.high) / 2;
    if (p.low) return p.low;
    return null;
  };
  const order = ["1stEditionHolofoil", "holofoil", "1stEditionNormal", "normal", "reverseHolofoil", "unlimitedHolofoil"];
  for (const k of order) {
    const v = extract(prices[k]);
    if (v) return v;
  }
  for (const k of Object.keys(prices)) {
    const v = extract(prices[k]);
    if (v) return v;
  }
  return null;
}

function synthSparkline(price, change90d, n = 7) {
  const startPrice = price / (1 + change90d / 100);
  const arr = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const noise = pseudo(price * 1000 + i, -0.03, 0.03);
    arr.push(Math.max(0.01, startPrice + (price - startPrice) * t + price * noise));
  }
  return arr;
}

// Map an API card to our internal market card shape. Returns null if unusable.
function mapApiCard(api) {
  const price = extractTCGPrice(api.tcgplayer);
  if (!price || price < 1) return null;

  const base = rarityBase(api.rarity);
  const seed = seedFromId(api.id);
  const isIllustration = (api.rarity || "").includes("Illustration");
  const setId = api.set && api.set.id;
  const meta = setId ? SET_META[setId] : null;
  const adj = setMetaAdjustment(meta);

  // Synthesized price history — deterministic per card
  const change90d = Math.round(pseudo(seed, -8, 32) * 10) / 10;
  const change30d = Math.round(change90d * pseudo(seed + 1, 0.3, 0.55) * 10) / 10;
  const change7d  = Math.round(change30d * pseudo(seed + 2, 0.25, 0.5) * 10) / 10;

  const collectorScoreBase = base + (isIllustration ? 6 : 0) + pseudo(seed + 3, -4, 4);
  const flipScoreBase = base + (change90d > 10 ? 8 : 0) + (price > 50 && price < 500 ? 5 : 0) + pseudo(seed + 4, -5, 5);
  const gradingScore = clamp(Math.round(base + (isIllustration ? 4 : 0) + (price > 30 ? 5 : -5) + pseudo(seed + 5, -4, 4)), 30, 98);

  const collectorScore = clamp(Math.round(collectorScoreBase + adj.collector), 30, 99);
  const flipScore = clamp(Math.round(flipScoreBase + adj.flip), 25, 99);

  const liquidity = clamp(Math.round(100 - (base - 40) * 0.9 + pseudo(seed + 6, -8, 8)), 20, 95);
  const gemRate = base >= 90 ? Math.round(pseudo(seed + 7, 2, 18))
                : base >= 80 ? Math.round(pseudo(seed + 7, 15, 35))
                : Math.round(pseudo(seed + 7, 30, 55));
  const supplyTrend = adj.supplyTrend || ((change90d > 15 && liquidity < 70) ? "declining" : "stable");

  return {
    id: api.id,
    name: api.name,
    set: (api.set && api.set.name) || "—",
    setId,
    setMeta: meta,
    type: "single",
    image: (api.images && (api.images.small || api.images.large)) || null,
    price: Math.round(price * 100) / 100,
    change7d, change30d, change90d,
    collectorScore, flipScore, gradingScore,
    liquidity, gemRate,
    supplyTrend,
    sparkline: synthSparkline(price, change90d, 7),
    rarity: api.rarity,
  };
}

// ─── Sealed products CDN (catchem-data repo) ─────────────────────────────────
// Prices are refreshed daily by a GitHub Action querying the eBay Browse API,
// committed to the catchem-data repo, and served via jsDelivr's free CDN
// (CORS-enabled, ~10min propagation after commit). If the CDN is unreachable
// or the data is unavailable, we fall back to the hardcoded SEALED_PRODUCTS.
//
// To swap the data source: change CATCHEM_DATA_GH_USER below to your GitHub
// username (where the catchem-data repo lives).
const CATCHEM_DATA_GH_USER = "Tbaker-maker"; // Live: catchem-data repo
const SEALED_CDN_URL = `https://cdn.jsdelivr.net/gh/${CATCHEM_DATA_GH_USER}/catchem-data@main/data/sealed-prices.json`;

// Compute real % change from price history. Finds the entry closest to (but not
// after) N days ago. Returns 0 if insufficient history.
function realChangeFromHistory(history, daysBack) {
  if (!Array.isArray(history) || history.length < 2) return 0;
  const latest = history[history.length - 1];
  if (!latest || !latest.price) return 0;
  const targetDate = new Date(latest.date);
  targetDate.setDate(targetDate.getDate() - daysBack);
  const targetStr = targetDate.toISOString().split("T")[0];
  let older = null;
  for (const h of history) {
    if (h.date <= targetStr && (!older || h.date > older.date)) older = h;
  }
  if (!older || !older.price) older = history[0];
  if (!older.price) return 0;
  return Math.round(((latest.price - older.price) / older.price) * 1000) / 10;
}

function sparklineFromHistory(history, points = 7) {
  if (!Array.isArray(history) || history.length < 2) return null;
  return history.slice(-points).map(h => h.price);
}

// Map a CDN sealed-price entry → the internal sealed card shape used across
// the app. Layers real price history over makeSealed's synthesized defaults.
function mapCdnSealed(cdnItem) {
  if (!cdnItem || !cdnItem.id || !cdnItem.priceUsd) return null;
  // Start with the full synthetic shape from makeSealed, then overlay real data.
  const base = makeSealed({
    id: cdnItem.id,
    name: cdnItem.name,
    set: cdnItem.set,
    setId: cdnItem.setId,
    subtype: cdnItem.subtype || "sealed",
    price: cdnItem.priceUsd,
    vintage: !!cdnItem.vintage,
  });
  const history = cdnItem.priceHistory;
  if (Array.isArray(history) && history.length >= 2) {
    const change7d = realChangeFromHistory(history, 7);
    const change30d = realChangeFromHistory(history, 30);
    const change90d = realChangeFromHistory(history, 90);
    const sparkline = sparklineFromHistory(history, 7);
    return {
      ...base,
      price: Math.round(cdnItem.priceUsd),
      change7d, change30d, change90d,
      sparkline: sparkline || base.sparkline,
      liquidity: cdnItem.listingCount
        ? clamp(40 + Math.min(60, cdnItem.listingCount * 2), 40, 96)
        : base.liquidity,
      dataStatus: cdnItem.dataStatus || "live",
    };
  }
  return { ...base, price: Math.round(cdnItem.priceUsd), dataStatus: cdnItem.dataStatus || "live" };
}

async function fetchSealedFromCDN() {
  try {
    const res = await fetch(SEALED_CDN_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.products) || data.products.length === 0) return null;
    const mapped = data.products.map(mapCdnSealed).filter(Boolean);
    if (mapped.length === 0) return null;
    return mapped;
  } catch {
    return null;
  }
}

async function fetchMarketCards() {
  const fields = "id,name,set,rarity,images,tcgplayer,supertype,number";
  // Modern: a spread of rarities across today's Standard + recent OOP sets
  const modernQ = encodeURIComponent('(rarity:"Illustration Rare" OR rarity:"Special Illustration Rare" OR rarity:"Ultra Rare" OR rarity:"Hyper Rare" OR rarity:"Rare Secret" OR rarity:"Double Rare")');
  const modernUrl = `${API_BASE}/cards?q=${modernQ}&pageSize=100&orderBy=-cardmarket.prices.averageSellPrice&select=${fields}`;
  // Vintage: Base Set, Jungle, Fossil, promos, early Neo — the crown jewels
  const vintageQ = encodeURIComponent('(set.id:base1 OR set.id:base2 OR set.id:base3 OR set.id:basep OR set.id:neo1 OR set.id:neo2)');
  const vintageUrl = `${API_BASE}/cards?q=${vintageQ}&pageSize=30&orderBy=-cardmarket.prices.averageSellPrice&select=${fields}`;

  // Modern + vintage singles from Pokemon TCG API (parallel, vintage is optional).
  // Sealed prices fetched from jsDelivr CDN (via catchem-data GitHub repo +
  // daily eBay Browse API refresh). Falls back to hardcoded SEALED_PRODUCTS if
  // the CDN is unreachable or hasn't been deployed yet.
  const [modernRes, vintageRes, cdnSealed] = await Promise.all([
    fetch(modernUrl),
    fetch(vintageUrl).catch(() => null),
    fetchSealedFromCDN(),
  ]);

  if (!modernRes.ok) throw new Error(`API returned ${modernRes.status}`);
  const modernJson = await modernRes.json();
  const modernCards = (modernJson.data || []).map(mapApiCard).filter(Boolean);
  if (modernCards.length < 10) throw new Error("Not enough cards returned");

  let vintageCards = [];
  if (vintageRes && vintageRes.ok) {
    try {
      const vintageJson = await vintageRes.json();
      vintageCards = (vintageJson.data || []).map(mapApiCard).filter(Boolean);
    } catch (e) { /* vintage merge is optional */ }
  }

  // Sealed: prefer live CDN data, fall back to hardcoded library.
  const sealedCards = cdnSealed && cdnSealed.length > 0 ? cdnSealed : SEALED_PRODUCTS;

  return [...modernCards, ...vintageCards, ...sealedCards];
}

async function loadCachedMarket() {
  if (typeof window === "undefined" || !window.storage) return null;
  try {
    const result = await window.storage.get(MARKET_CACHE_KEY);
    if (!result || !result.value) return null;
    const data = JSON.parse(result.value);
    if (data.timestamp && Date.now() - data.timestamp < MARKET_CACHE_TTL_MS && Array.isArray(data.cards)) {
      return data.cards;
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function saveCachedMarket(cards) {
  if (typeof window === "undefined" || !window.storage) return;
  try {
    const payload = JSON.stringify({ timestamp: Date.now(), cards });
    if (payload.length < 4 * 1024 * 1024) {
      window.storage.set(MARKET_CACHE_KEY, payload).catch(() => {});
    }
  } catch (e) { /* ignore */ }
}

// ─── Set metadata — rotation & print status ──────────────────────────────────
// Pokémon Standard format rotates yearly. Cards with specific "regulation marks"
// (G, H, I, J, etc.) drop out of Standard on rotation day. After rotation,
// Pokémon typically (not always) winds down printing — which tightens supply
// and drives long-term appreciation. Heavy reprints BEFORE rotation can crater
// prices (e.g. Crown Zenith, 151).
//
// ROTATION DATA — verified April 2026 from multiple sources:
//   • Pokemon.com (official rotation announcement, Jan 9, 2026)
//   • PokeBeach, Bulbapedia, LimitlessTCG, PokemonCard.io (regulation marks per set)
// G-mark rotated April 10, 2026 (in-person) / March 26, 2026 (TCG Live).
// H-mark projected to rotate April 2027. I-mark projected April 2028.
// J-mark debuts with Perfect Order (April 2026).
//
// Print status is ESTIMATED from known reprint patterns — Pokémon doesn't publish
// print runs, so tune this constant as you learn more about each set.
const SET_META = {
  // ─── Scarlet & Violet era — G mark rotated April 10, 2026 ───
  "sv1":    { name: "Scarlet & Violet Base", regulation: "G", rotationStatus: "just-rotated", printStatus: "standard-print" },
  "sv2":    { name: "Paldea Evolved",         regulation: "G", rotationStatus: "just-rotated", printStatus: "standard-print" },
  "sv3":    { name: "Obsidian Flames",        regulation: "G", rotationStatus: "just-rotated", printStatus: "standard-print" },
  "sv3pt5": { name: "151",                    regulation: "G", rotationStatus: "just-rotated", printStatus: "heavy-reprint" },
  "sv4":    { name: "Paradox Rift",           regulation: "G", rotationStatus: "just-rotated", printStatus: "standard-print" },
  "sv4pt5": { name: "Paldean Fates",          regulation: "G/H", rotationStatus: "partial-rotation", printStatus: "heavy-reprint" },
  // ─── H mark — pre-rotation window, projected to rotate April 2027 ───
  "sv5":    { name: "Temporal Forces",        regulation: "H", rotationStatus: "current", printStatus: "standard-print" },
  "sv6":    { name: "Twilight Masquerade",    regulation: "H", rotationStatus: "current", printStatus: "standard-print" },
  "sv6pt5": { name: "Shrouded Fable",         regulation: "H", rotationStatus: "current", printStatus: "low-reprint" },
  "sv7":    { name: "Stellar Crown",          regulation: "H", rotationStatus: "current", printStatus: "standard-print" },
  "sv8":    { name: "Surging Sparks",         regulation: "H", rotationStatus: "current", printStatus: "standard-print" },
  "sv8pt5": { name: "Prismatic Evolutions",   regulation: "H", rotationStatus: "current", printStatus: "low-reprint" },
  // ─── I mark — current, projected to rotate April 2028 ───
  "sv9":    { name: "Journey Together",       regulation: "I", rotationStatus: "current", printStatus: "currently-printing" },
  "sv10":   { name: "Destined Rivals",        regulation: "I", rotationStatus: "current", printStatus: "currently-printing" },
  // ─── Sword & Shield era — all long rotated (D/E/F marks) ───
  "swsh1":     { name: "Sword & Shield Base", regulation: "D", rotationStatus: "long-rotated", printStatus: "out-of-print" },
  "swsh7":     { name: "Evolving Skies",      regulation: "E", rotationStatus: "long-rotated", printStatus: "out-of-print" },
  "swsh8":     { name: "Fusion Strike",       regulation: "E", rotationStatus: "long-rotated", printStatus: "out-of-print" },
  "swsh11":    { name: "Lost Origin",         regulation: "F", rotationStatus: "long-rotated", printStatus: "low-reprint" },
  "swsh12":    { name: "Silver Tempest",      regulation: "F", rotationStatus: "long-rotated", printStatus: "low-reprint" },
  "swsh12pt5": { name: "Crown Zenith",        regulation: "F", rotationStatus: "long-rotated", printStatus: "heavy-reprint" },
  "cel25":     { name: "Celebrations",        regulation: "F", rotationStatus: "long-rotated", printStatus: "heavy-reprint" },
  // ─── Vintage — all OOP ───
  "hgss1": { name: "HeartGold SoulSilver",   rotationStatus: "vintage", printStatus: "out-of-print" },
  "bw1":   { name: "Black & White Base",     rotationStatus: "vintage", printStatus: "out-of-print" },
  "base1": { name: "Base Set",               rotationStatus: "vintage", printStatus: "out-of-print" },
  "base2": { name: "Jungle",                 rotationStatus: "vintage", printStatus: "out-of-print" },
  "base3": { name: "Fossil",                 rotationStatus: "vintage", printStatus: "out-of-print" },
  "basep": { name: "WOTC Black Star Promos", rotationStatus: "vintage", printStatus: "out-of-print" },
  "neo1":  { name: "Neo Genesis",            rotationStatus: "vintage", printStatus: "out-of-print" },
  "neo2":  { name: "Neo Discovery",          rotationStatus: "vintage", printStatus: "out-of-print" },
};

function getSetMeta(card) {
  if (!card) return null;
  if (card.setId && SET_META[card.setId]) return SET_META[card.setId];
  // Fallback: match by set name
  if (card.set) {
    const entry = Object.values(SET_META).find(m => m.name === card.set);
    if (entry) return entry;
  }
  return null;
}

// Rotation timeline anchors. The 2026 rotation put G-mark out on April 10.
// Next scheduled rotation is roughly one year later (annual cycle).
const LAST_ROTATION_DATE = new Date("2026-04-10T00:00:00Z");
const NEXT_ROTATION_DATE = new Date("2027-04-10T00:00:00Z");

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}
function daysUntil(date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// Derive scoring deltas from rotation + print status.
// - Just rotated + heavy reprint → flood risk, flip score drops
// - Just rotated + low/no reprint → supply tightens, flip score rises
// - Current + H regulation mark → pre-rotation window (rotates April 2027)
// - Long rotated + out-of-print → established appreciation, both scores rise
// - Vintage → maximum collector weight, supply permanent-declining
function setMetaAdjustment(meta) {
  if (!meta) return { flip: 0, collector: 0, supplyTrend: null };
  const { rotationStatus, printStatus, regulation } = meta;
  let flip = 0, collector = 0, supplyTrend = null;

  if (rotationStatus === "vintage") {
    flip += 10; collector += 15; supplyTrend = "declining";
  } else if (rotationStatus === "long-rotated") {
    if (printStatus === "out-of-print") { flip += 10; collector += 8; supplyTrend = "declining"; }
    else if (printStatus === "low-reprint") { flip += 5; collector += 4; supplyTrend = "declining"; }
    else if (printStatus === "heavy-reprint") { flip -= 4; collector -= 3; }
  } else if (rotationStatus === "just-rotated") {
    if (printStatus === "heavy-reprint") { flip -= 12; supplyTrend = "flooding"; }
    else if (printStatus === "low-reprint") { flip += 8; supplyTrend = "declining"; }
    else { flip -= 3; }
  } else if (rotationStatus === "partial-rotation") {
    if (printStatus === "heavy-reprint") { flip -= 6; }
    else { flip -= 2; }
  } else if (rotationStatus === "current") {
    // Pre-rotation window boost for H-mark sets (rotating April 2027)
    if (regulation === "H") flip += 8;
    if (printStatus === "currently-printing") { collector -= 2; }
  }

  return { flip, collector, supplyTrend };
}

// Render-ready status label with tone + icon.
function setStatusLabel(meta) {
  if (!meta) return null;
  const { rotationStatus, printStatus, regulation } = meta;
  if (rotationStatus === "vintage") return { label: "Vintage · OOP", tone: "strong", icon: "🏛️" };
  if (rotationStatus === "long-rotated" && printStatus === "out-of-print") return { label: "OOP · rotated", tone: "strong", icon: "💎" };
  if (rotationStatus === "long-rotated" && printStatus === "low-reprint") return { label: "Mostly OOP", tone: "strong", icon: "💎" };
  if (rotationStatus === "long-rotated" && printStatus === "heavy-reprint") return { label: "Heavy reprints", tone: "warn", icon: "⚠️" };
  if (rotationStatus === "just-rotated" && printStatus === "heavy-reprint") return { label: "Just rotated · flood risk", tone: "warn", icon: "⚠️" };
  if (rotationStatus === "just-rotated") return { label: "Rotated Apr 2026", tone: "fresh", icon: "📉" };
  if (rotationStatus === "partial-rotation") return { label: "Partial rotation", tone: "mixed", icon: "⚡" };
  if (rotationStatus === "current" && regulation === "H") return { label: "Pre-rotation window", tone: "fresh", icon: "🔥" };
  if (rotationStatus === "current" && (regulation === "I" || regulation === "J")) return { label: "Current · printing", tone: "neutral", icon: "📦" };
  if (rotationStatus === "current") return { label: "Standard legal", tone: "neutral", icon: "📘" };
  return null;
}

// ─── Sealed product library ──────────────────────────────────────────────────
// The Pokémon TCG API doesn't cover sealed products (booster boxes, ETBs, UPCs,
// etc.), so we maintain a curated library here. Prices are representative
// market values; swap in live eBay / TCGplayer sealed pricing when available.
function setLogo(setId) {
  return setId ? `https://images.pokemontcg.io/${setId}/logo.png` : null;
}

function makeSealed({ id, name, set, setId, subtype, price, hot = false, vintage = false }) {
  const seed = seedFromId(id);
  const isChase = hot || price > 500;
  const meta = setId ? SET_META[setId] : null;
  const adj = setMetaAdjustment(meta);

  const change90d = Math.round((vintage ? pseudo(seed, 2, 14)
                               : isChase ? pseudo(seed, 6, 38)
                               : pseudo(seed, -2, 18)) * 10) / 10;
  const change30d = Math.round(change90d * pseudo(seed + 1, 0.3, 0.55) * 10) / 10;
  const change7d  = Math.round(change30d * pseudo(seed + 2, 0.25, 0.5) * 10) / 10;
  const collectorBase = vintage ? 94 + Math.round(pseudo(seed + 3, -3, 5))
                       : isChase ? 88 + Math.round(pseudo(seed + 3, -3, 6))
                       : 76 + Math.round(pseudo(seed + 3, -4, 7));
  const flipBase = vintage ? 58 + Math.round(pseudo(seed + 4, -5, 8))
                  : hot ? 85 + Math.round(pseudo(seed + 4, -4, 7))
                  : 72 + Math.round(pseudo(seed + 4, -5, 7));
  const collectorScore = clamp(collectorBase + adj.collector, 45, 100);
  const flipScore = clamp(flipBase + adj.flip, 25, 97);
  const liquidity = price < 100 ? clamp(82 + Math.round(pseudo(seed + 5, -8, 8)), 65, 94)
                  : price < 500 ? clamp(66 + Math.round(pseudo(seed + 5, -9, 9)), 48, 82)
                  : clamp(42 + Math.round(pseudo(seed + 5, -12, 12)), 22, 62);
  const supplyTrend = adj.supplyTrend || (change90d > 6 ? "declining" : "stable");
  return {
    id, name, set, setId, setMeta: meta, subtype, type: "sealed",
    image: setLogo(setId) || PH(subtype.slice(0, 8), "f5c542"),
    price: Math.round(price),
    change7d, change30d, change90d,
    collectorScore, flipScore, gradingScore: null,
    liquidity, gemRate: null,
    supplyTrend,
    sparkline: synthSparkline(price, change90d, 7),
  };
}

const SEALED_PRODUCTS = [
  // Vintage crown jewels
  makeSealed({ id: "sl-base-box", name: "Base Set Booster Box (Unlimited)", set: "Base Set", setId: "base1", subtype: "Booster Box", price: 18500, vintage: true }),
  makeSealed({ id: "sl-jungle-box", name: "Jungle Booster Box (Unlimited)", set: "Jungle", setId: "base2", subtype: "Booster Box", price: 4800, vintage: true }),
  makeSealed({ id: "sl-fossil-box", name: "Fossil Booster Box (Unlimited)", set: "Fossil", setId: "base3", subtype: "Booster Box", price: 4200, vintage: true }),
  makeSealed({ id: "sl-bw-box", name: "Black & White Booster Box", set: "Black & White", setId: "bw1", subtype: "Booster Box", price: 680, vintage: true }),
  makeSealed({ id: "sl-hgss-etb", name: "HGSS Base Elite Trainer Box", set: "HeartGold SoulSilver", setId: "hgss1", subtype: "ETB", price: 245, vintage: true }),

  // Evolving Skies (the modern holy grail)
  makeSealed({ id: "sl-es-box", name: "Evolving Skies Booster Box", set: "Evolving Skies", setId: "swsh7", subtype: "Booster Box", price: 1450, hot: true }),
  makeSealed({ id: "sl-es-etb", name: "Evolving Skies Elite Trainer Box", set: "Evolving Skies", setId: "swsh7", subtype: "ETB", price: 485, hot: true }),
  makeSealed({ id: "sl-es-bb", name: "Evolving Skies Build & Battle Box", set: "Evolving Skies", setId: "swsh7", subtype: "Build & Battle", price: 165, hot: true }),

  // Fusion Strike
  makeSealed({ id: "sl-fs-box", name: "Fusion Strike Booster Box", set: "Fusion Strike", setId: "swsh8", subtype: "Booster Box", price: 295, hot: true }),
  makeSealed({ id: "sl-fs-etb", name: "Fusion Strike Elite Trainer Box", set: "Fusion Strike", setId: "swsh8", subtype: "ETB", price: 115 }),

  // Lost Origin
  makeSealed({ id: "sl-lo-box", name: "Lost Origin Booster Box", set: "Lost Origin", setId: "swsh11", subtype: "Booster Box", price: 230 }),
  makeSealed({ id: "sl-lo-etb", name: "Lost Origin Elite Trainer Box", set: "Lost Origin", setId: "swsh11", subtype: "ETB", price: 85 }),

  // Silver Tempest
  makeSealed({ id: "sl-st-box", name: "Silver Tempest Booster Box", set: "Silver Tempest", setId: "swsh12", subtype: "Booster Box", price: 210 }),
  makeSealed({ id: "sl-st-etb", name: "Silver Tempest Elite Trainer Box", set: "Silver Tempest", setId: "swsh12", subtype: "ETB", price: 78 }),

  // Crown Zenith (no booster boxes — special set)
  makeSealed({ id: "sl-cz-etb", name: "Crown Zenith Elite Trainer Box", set: "Crown Zenith", setId: "swsh12pt5", subtype: "ETB", price: 105, hot: true }),
  makeSealed({ id: "sl-cz-morpeko", name: "Crown Zenith Morpeko V-UNION Premium", set: "Crown Zenith", setId: "swsh12pt5", subtype: "Premium Collection", price: 58 }),
  makeSealed({ id: "sl-cz-playmat", name: "Crown Zenith Premium Playmat Collection", set: "Crown Zenith", setId: "swsh12pt5", subtype: "Premium Collection", price: 72 }),

  // Celebrations 25th anniversary
  makeSealed({ id: "sl-cel-etb", name: "Celebrations 25th Anniversary ETB", set: "Celebrations", setId: "cel25", subtype: "ETB", price: 58, hot: true }),
  makeSealed({ id: "sl-cel-pin", name: "Celebrations Deluxe Pin Collection", set: "Celebrations", setId: "cel25", subtype: "Premium Collection", price: 48 }),

  // Paldea Evolved
  makeSealed({ id: "sl-pe-box", name: "Paldea Evolved Booster Box", set: "Paldea Evolved", setId: "sv2", subtype: "Booster Box", price: 155 }),
  makeSealed({ id: "sl-pe-etb", name: "Paldea Evolved Elite Trainer Box", set: "Paldea Evolved", setId: "sv2", subtype: "ETB", price: 62 }),

  // Obsidian Flames
  makeSealed({ id: "sl-of-box", name: "Obsidian Flames Booster Box", set: "Obsidian Flames", setId: "sv3", subtype: "Booster Box", price: 148 }),
  makeSealed({ id: "sl-of-etb", name: "Obsidian Flames Elite Trainer Box", set: "Obsidian Flames", setId: "sv3", subtype: "ETB", price: 55 }),
  makeSealed({ id: "sl-of-charizard", name: "Charizard ex Premium Collection", set: "Obsidian Flames", setId: "sv3", subtype: "Premium Collection", price: 65 }),

  // Pokémon 151 — the 2023 darling
  makeSealed({ id: "sl-151-etb", name: "Pokémon 151 Elite Trainer Box", set: "151", setId: "sv3pt5", subtype: "ETB", price: 110, hot: true }),
  makeSealed({ id: "sl-151-bundle", name: "Pokémon 151 Booster Bundle", set: "151", setId: "sv3pt5", subtype: "Booster Bundle", price: 55, hot: true }),
  makeSealed({ id: "sl-151-upc", name: "Pokémon 151 Ultra Premium Collection", set: "151", setId: "sv3pt5", subtype: "UPC", price: 220, hot: true }),
  makeSealed({ id: "sl-151-poster", name: "Pokémon 151 Poster Collection", set: "151", setId: "sv3pt5", subtype: "Poster Collection", price: 42 }),
  makeSealed({ id: "sl-151-binder", name: "Pokémon 151 Binder Collection", set: "151", setId: "sv3pt5", subtype: "Binder Collection", price: 58 }),
  makeSealed({ id: "sl-151-mewtwo", name: "Mewtwo V-UNION Alakazam Collection", set: "151", setId: "sv3pt5", subtype: "Premium Collection", price: 95 }),

  // Paradox Rift
  makeSealed({ id: "sl-pr-box", name: "Paradox Rift Booster Box", set: "Paradox Rift", setId: "sv4", subtype: "Booster Box", price: 142 }),
  makeSealed({ id: "sl-pr-etb", name: "Paradox Rift Elite Trainer Box", set: "Paradox Rift", setId: "sv4", subtype: "ETB", price: 52 }),
  makeSealed({ id: "sl-pr-bundle", name: "Paradox Rift Booster Bundle", set: "Paradox Rift", setId: "sv4", subtype: "Booster Bundle", price: 28 }),

  // Paldean Fates (special set, no booster boxes)
  makeSealed({ id: "sl-pf-etb", name: "Paldean Fates Elite Trainer Box", set: "Paldean Fates", setId: "sv4pt5", subtype: "ETB", price: 78 }),
  makeSealed({ id: "sl-pf-bundle", name: "Paldean Fates Booster Bundle", set: "Paldean Fates", setId: "sv4pt5", subtype: "Booster Bundle", price: 48 }),
  makeSealed({ id: "sl-pf-charizard", name: "Shiny Charizard ex Premium Collection", set: "Paldean Fates", setId: "sv4pt5", subtype: "Premium Collection", price: 95, hot: true }),

  // Temporal Forces
  makeSealed({ id: "sl-tf-box", name: "Temporal Forces Booster Box", set: "Temporal Forces", setId: "sv5", subtype: "Booster Box", price: 128 }),
  makeSealed({ id: "sl-tf-etb", name: "Temporal Forces Elite Trainer Box", set: "Temporal Forces", setId: "sv5", subtype: "ETB", price: 48 }),
  makeSealed({ id: "sl-tf-ironcrown", name: "Iron Crown ex Box", set: "Temporal Forces", setId: "sv5", subtype: "Box", price: 28 }),

  // Twilight Masquerade
  makeSealed({ id: "sl-tm-box", name: "Twilight Masquerade Booster Box", set: "Twilight Masquerade", setId: "sv6", subtype: "Booster Box", price: 125 }),
  makeSealed({ id: "sl-tm-etb", name: "Twilight Masquerade Elite Trainer Box", set: "Twilight Masquerade", setId: "sv6", subtype: "ETB", price: 45 }),
  makeSealed({ id: "sl-tm-bb", name: "Twilight Masquerade Build & Battle Box", set: "Twilight Masquerade", setId: "sv6", subtype: "Build & Battle", price: 22 }),
  makeSealed({ id: "sl-tm-terachar", name: "Tera Charizard ex Premium Collection", set: "Twilight Masquerade", setId: "sv6", subtype: "Premium Collection", price: 82, hot: true }),

  // Shrouded Fable (special set)
  makeSealed({ id: "sl-sf-etb", name: "Shrouded Fable Elite Trainer Box", set: "Shrouded Fable", setId: "sv6pt5", subtype: "ETB", price: 68, hot: true }),
  makeSealed({ id: "sl-sf-bundle", name: "Shrouded Fable Booster Bundle", set: "Shrouded Fable", setId: "sv6pt5", subtype: "Booster Bundle", price: 42 }),

  // Stellar Crown
  makeSealed({ id: "sl-sc-box", name: "Stellar Crown Booster Box", set: "Stellar Crown", setId: "sv7", subtype: "Booster Box", price: 122 }),
  makeSealed({ id: "sl-sc-etb", name: "Stellar Crown Elite Trainer Box", set: "Stellar Crown", setId: "sv7", subtype: "ETB", price: 44 }),
  makeSealed({ id: "sl-sc-bb", name: "Stellar Crown Build & Battle Box", set: "Stellar Crown", setId: "sv7", subtype: "Build & Battle", price: 24 }),

  // Surging Sparks (newest)
  makeSealed({ id: "sl-ss-box", name: "Surging Sparks Booster Box", set: "Surging Sparks", setId: "sv8", subtype: "Booster Box", price: 120 }),
  makeSealed({ id: "sl-ss-etb", name: "Surging Sparks Elite Trainer Box", set: "Surging Sparks", setId: "sv8", subtype: "ETB", price: 44 }),
  makeSealed({ id: "sl-ss-bb", name: "Surging Sparks Build & Battle Box", set: "Surging Sparks", setId: "sv8", subtype: "Build & Battle", price: 22 }),

  // Ultra Premium Collections (flagship)
  makeSealed({ id: "sl-upc-charizard", name: "Charizard Ultra Premium Collection", set: "Crown Zenith", setId: "swsh12pt5", subtype: "UPC", price: 180, hot: true }),
  makeSealed({ id: "sl-upc-zacian", name: "Zacian & Zamazenta Ultra Premium", set: "Sword & Shield", setId: "swsh1", subtype: "UPC", price: 165 }),
  makeSealed({ id: "sl-upc-mewtwo", name: "Mewtwo Ultra Premium Collection", set: "151", setId: "sv3pt5", subtype: "UPC", price: 220, hot: true }),

  // Low-entry items (good for micro budgets)
  makeSealed({ id: "sl-tin-char", name: "Charizard ex Box", set: "Scarlet & Violet", setId: "sv1", subtype: "Box", price: 28 }),
  makeSealed({ id: "sl-tin-mew", name: "Mew ex Box", set: "Scarlet & Violet", setId: "sv1", subtype: "Box", price: 25 }),
];

// Curated Pokémon trading groups on Facebook. We use search URLs rather than
// hardcoded group IDs because specific groups come and go, but search is stable.
const FB_GROUPS = [
  { name: "Pokémon TCG Buy Sell Trade", query: "pokemon tcg buy sell trade", desc: "Largest active BST community" },
  { name: "Pokémon Card Collectors", query: "pokemon card collectors", desc: "Global collector network" },
  { name: "Modern Pokémon BST", query: "modern pokemon buy sell trade", desc: "Scarlet/Violet & recent sets" },
  { name: "Vintage Pokémon BST", query: "vintage pokemon buy sell trade WOTC", desc: "WOTC & pre-2010 era" },
  { name: "PSA Graded Pokémon BST", query: "PSA graded pokemon buy sell trade", desc: "Slabs only — graded cards" },
  { name: "Pokémon Sealed Products BST", query: "pokemon sealed products buy sell", desc: "ETBs, booster boxes, packs" },
];

const FB_BLUE = "#1877F2";
const TCG_COLOR = "#F48024"; // TCGplayer-ish warm orange, distinct from our yellow

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0d12",
  surface: "#16161e",
  surfaceHover: "#1c1c27",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.13)",
  text: "#f0f0f4",
  textSub: "#8888a0",
  textMuted: "#44445a",
  green: "#00c97a",
  red: "#ff5a5a",
  blue: "#6c8fff",
  purple: "#c77dff",
  yellow: "#f5c542",
};

const inp = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
  padding: "10px 12px", color: C.text, fontSize: "0.85rem", fontFamily: "'Inter',sans-serif",
  outline: "none", width: "100%",
};

// ─── Currency system ─────────────────────────────────────────────────────────
// All market prices are stored internally in USD (that's what the Pokémon TCG
// API returns). Display prices are converted to the user's selected currency
// via live exchange rates from frankfurter.app (free, ECB-sourced, no API key).
// Fallback rates are approximate and used only when the API fails.
const CURRENCIES = {
  USD: { code: "USD", symbol: "$",  name: "US Dollar",          fallbackRate: 1 },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar",    fallbackRate: 1.37 },
  GBP: { code: "GBP", symbol: "£",  name: "British Pound",      fallbackRate: 0.80 },
  EUR: { code: "EUR", symbol: "€",  name: "Euro",               fallbackRate: 0.93 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar",  fallbackRate: 1.53 },
  JPY: { code: "JPY", symbol: "¥",  name: "Japanese Yen",       fallbackRate: 149 },
  MXN: { code: "MXN", symbol: "Mex$", name: "Mexican Peso",     fallbackRate: 17.5 },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real",     fallbackRate: 5.00 },
};
const RATES_CACHE_KEY = "catchem-rates-cache-v1";
const RATES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Detect currency from browser locale. Best-effort — user can always override.
function detectCurrency() {
  if (typeof navigator === "undefined") return "USD";
  const lang = (navigator.language || "en-US").toLowerCase();
  if (lang.endsWith("-ca") || lang.includes("-ca-") || lang === "fr-ca") return "CAD";
  if (lang.endsWith("-gb") || lang === "en-gb") return "GBP";
  if (lang.endsWith("-au")) return "AUD";
  if (lang.startsWith("ja")) return "JPY";
  if (lang.endsWith("-mx") || lang === "es-mx") return "MXN";
  if (lang === "pt-br" || lang.startsWith("pt-br")) return "BRL";
  if (["de", "fr", "it", "es", "nl", "pt", "el", "pl", "fi", "sv", "da"].some(l => lang.startsWith(l))) return "EUR";
  return "USD";
}

async function fetchExchangeRates() {
  // Try cache first (24h TTL)
  if (typeof window !== "undefined" && window.storage) {
    try {
      const cached = await window.storage.get(RATES_CACHE_KEY);
      if (cached && cached.value) {
        const data = JSON.parse(cached.value);
        if (data.timestamp && Date.now() - data.timestamp < RATES_CACHE_TTL_MS && data.rates) {
          return data.rates;
        }
      }
    } catch (e) { /* cache miss — fall through */ }
  }
  // Fetch fresh from frankfurter.app
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rates = { USD: 1, ...(json.rates || {}) };
    // Cache for 24h
    if (typeof window !== "undefined" && window.storage) {
      try {
        window.storage.set(RATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), rates })).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    return rates;
  } catch (e) {
    return null; // Caller falls back to fallbackRate
  }
}

// Pure formatting helpers — take USD amount + currency state, return display string.
function formatPriceImpl(usdAmount, currency, rates) {
  if (usdAmount == null || isNaN(usdAmount)) return "—";
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const rate = (rates && rates[currency]) || cur.fallbackRate;
  const converted = usdAmount * rate;
  const decimals = currency === "JPY" ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(converted);
  } catch {
    return `${cur.symbol}${converted.toFixed(decimals)}`;
  }
}

function formatPriceCompactImpl(usdAmount, currency, rates) {
  if (usdAmount == null || isNaN(usdAmount)) return "—";
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const rate = (rates && rates[currency]) || cur.fallbackRate;
  const converted = usdAmount * rate;
  if (converted >= 1_000_000) return `${cur.symbol}${(converted / 1_000_000).toFixed(1)}M`;
  if (converted >= 1000)      return `${cur.symbol}${(converted / 1000).toFixed(1)}k`;
  return `${cur.symbol}${Math.round(converted).toLocaleString()}`;
}

// React context so every component can format prices without prop-drilling.
// The default value is USD-only (used before the Provider mounts or in tests).
const CurrencyContext = createContext({
  currency: "USD",
  rates: null,
  setCurrency: () => {},
  fmtPrice: (n) => formatPriceImpl(n, "USD", null),
  fmtPriceCompact: (n) => formatPriceCompactImpl(n, "USD", null),
});
const useCurrency = () => useContext(CurrencyContext);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(n) {
  // USD-only fallback for places that can't use the hook (module-level usage).
  // Components should prefer `useCurrency().fmtPrice` for currency-aware formatting.
  return formatPriceCompactImpl(n, "USD", null);
}

function calcGain(c) { return (c.currentPrice - c.purchasePrice) * c.quantity; }
function calcGainPct(c) { return ((c.currentPrice - c.purchasePrice) / c.purchasePrice) * 100; }
function calcFlipProfit(c) { return c.currentPrice - c.currentPrice * EBAY_FEE - SHIPPING - c.purchasePrice; }
function calcGradROI(c, g) {
  const v = g === 10 ? c.rawPSA10 : c.rawPSA9;
  return { net: v - c.purchasePrice - PSA_COST, psaVal: v };
}

// Generate a Facebook-optimized listing from a card. FB Marketplace and groups
// don't accept URL-pre-fill, so we produce clean copy the user can paste.
function generateFBListing(card) {
  const conditionMap = { NM: "Near Mint", LP: "Light Play", MP: "Moderate Play", HP: "Heavy Play", DMG: "Damaged" };
  const condition = conditionMap[card.condition] || card.condition;
  const price = card.currentPrice.toFixed(0);
  const setTag = "#" + card.set.replace(/[^a-zA-Z0-9]/g, "");
  const numPart = card.number && card.number !== "—" ? ` (${card.number})` : "";

  const title = `${card.name} · ${card.set} · ${card.condition} · $${price}`;

  const description = `🔥 ${card.name}${numPart}
📦 Set: ${card.set}
📊 Condition: ${condition}
💰 Asking $${price} (OBO)

From my personal collection. Stored in a penny sleeve + toploader since I got it.

✅ Ships same or next day
✅ Tracking included on orders $20+
✅ PayPal G&S or Venmo accepted

DM for more photos or questions — happy to negotiate on bundles!

#PokemonTCG #PokemonCards ${setTag} #PokemonBST`;

  return { title, description, price };
}

function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

// ─── Alert helpers ───────────────────────────────────────────────────────────
// Facebook offers no API for monitoring listings, but its native Marketplace
// search has a "notify me on new matches" option (bell icon) that works great.
// We generate the perfect pre-filtered FB search URL, and the user taps the
// bell on FB itself. Tyler's insight: many FB sellers skip the condition field,
// so our default is to INCLUDE unlisted-condition listings — strict filtering
// misses most deals in this category.
function detectProductType(name) {
  const lower = (name || "").toLowerCase();
  if (/booster box|elite trainer|\betb\b|\bupc\b|ultra premium|premium collection|build ?& ?battle|build and battle|booster bundle|booster pack|\btin\b|blister|sealed/.test(lower)) return "sealed";
  if (/\bpsa\s*\d|\bbgs\s*\d|\bcgc\s*\d|graded|\bslab\b/.test(lower)) return "graded";
  return "single";
}

function defaultAlert(goal) {
  const type = detectProductType(goal.name);
  const base = {
    enabled: true,
    productType: type,
    maxPrice: goal.targetPrice,
    alertIfUnlisted: true,
    altTerms: [],
    savedOnFB: false,
  };
  if (type === "single") return { ...base, conditions: ["NM", "LP"] };
  if (type === "graded") return { ...base, grades: ["PSA 10", "PSA 9"] };
  return base; // sealed: no condition filter
}

function buildFBMarketplaceUrl(goal, alert) {
  // FB Marketplace query: combine name + grade/sealed keywords + alt terms
  const parts = [goal.name];
  if (alert.productType === "graded" && alert.grades && alert.grades.length) {
    parts.push(`(${alert.grades.join(" OR ")})`);
  }
  if (alert.productType === "sealed") {
    parts.push("sealed");
  }
  if (alert.altTerms && alert.altTerms.length) {
    parts.push(`(${alert.altTerms.join(" OR ")})`);
  }
  const query = parts.join(" ");
  const params = new URLSearchParams();
  params.set("query", query);
  if (alert.maxPrice) params.set("maxPrice", String(Math.round(alert.maxPrice)));
  params.set("sortBy", "creation_time_descend");
  return `https://www.facebook.com/marketplace/search/?${params.toString()}`;
}

function buildFBGroupsUrl(goal, alert) {
  const terms = [goal.name, "pokemon"];
  if (alert.productType === "sealed") terms.push("sealed");
  return `https://www.facebook.com/search/posts/?q=${encodeURIComponent(terms.join(" "))}`;
}

// eBay saved-search URL: eBay has the most reliable saved-search alert system
// of the three — once saved, they email you on new matching listings.
// Condition filtering is intentionally omitted — eBay's "New/Used" codes don't
// map well to Pokémon grading (NM/LP/etc.), so we rely on keyword matching.
function buildEbayUrl(goal, alert) {
  const parts = [goal.name];
  if (alert.productType === "graded" && alert.grades && alert.grades.length) {
    parts.push(`(${alert.grades.join(",")})`);
  }
  if (alert.productType === "sealed") parts.push("sealed");
  if (alert.altTerms && alert.altTerms.length) {
    parts.push(`(${alert.altTerms.join(",")})`);
  }
  const params = new URLSearchParams();
  params.set("_nkw", parts.join(" "));
  params.set("_sop", "10"); // time ending soonest
  if (alert.maxPrice) params.set("_udhi", String(Math.round(alert.maxPrice)));
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

// TCGplayer search URL — user clicks into a product, then hits "Set Price
// Alert" button on the product page. TCG alerts are per-product, not per-search.
function buildTCGplayerUrl(goal, alert) {
  const parts = [goal.name];
  if (alert.productType === "graded" && alert.grades && alert.grades.length) {
    parts.push(alert.grades[0]);
  }
  if (alert.productType === "sealed") parts.push("sealed");
  return `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(parts.join(" "))}`;
}

// Count how many channels have been activated for a given alert config.
function alertChannelCount(alert) {
  if (!alert) return 0;
  return (alert.fbSaved || alert.savedOnFB ? 1 : 0) + (alert.ebaySaved ? 1 : 0) + (alert.tcgSaved ? 1 : 0);
}

// Responsive hook — components use this to switch layouts below 640px.
function useWindowSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    isMobile: typeof window !== "undefined" ? window.innerWidth < 640 : false,
    isTablet: typeof window !== "undefined" ? window.innerWidth < 900 : false,
  }));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => setSize({
      width: window.innerWidth,
      isMobile: window.innerWidth < 640,
      isTablet: window.innerWidth < 900,
    });
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return size;
}

// ─── Budget slider: log scale ─────────────────────────────────────────────────
// Slider value is 0-101. 101 = "No limit". 0-100 maps log($10) → log($10k).
function sliderPctToBudget(pct) {
  if (pct >= 100.5) return BUDGET_UNLIMITED;
  const lo = Math.log10(BUDGET_MIN), hi = Math.log10(BUDGET_MAX);
  const v = Math.pow(10, lo + (pct / 100) * (hi - lo));
  if (v < 50) return Math.round(v / 5) * 5;
  if (v < 500) return Math.round(v / 10) * 10;
  if (v < 2000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}
function budgetToSliderPct(budget) {
  if (budget >= BUDGET_UNLIMITED) return 101;
  const lo = Math.log10(BUDGET_MIN), hi = Math.log10(BUDGET_MAX);
  const clamped = Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, budget));
  return ((Math.log10(clamped) - lo) / (hi - lo)) * 100;
}

function budgetTier(budget) {
  if (budget >= BUDGET_UNLIMITED) return { label: "No limit", blurb: "Full market visible" };
  if (budget <= 75) return { label: "Micro budget", blurb: "Hunt cheap movers with big % upside" };
  if (budget <= 250) return { label: "Starter budget", blurb: "Balance growth % and liquidity" };
  if (budget <= 750) return { label: "Mid-tier", blurb: "Core flagship singles in play" };
  if (budget <= 2500) return { label: "Serious budget", blurb: "Sealed product + grails" };
  return { label: "Investor range", blurb: "Top-tier vintage and sealed" };
}

// ─── Opportunity score ────────────────────────────────────────────────────────
// Blends the mode's base score with momentum and a mode-specific signal.
// When the budget is constrained, opportunity signals are amplified so cheap
// cards with strong % movement can outrank expensive slow cards.
function opportunityScore(card, mode, budget, timeRange) {
  const baseScore = card[MODES[mode].sortKey] ?? 0;
  const change = card[timeRange] ?? 0;
  const liquidity = card.liquidity ?? 50;
  const isConstrained = budget < BUDGET_UNLIMITED;

  // Universal momentum bonus — strong % gains always matter
  const momentumBonus = Math.max(0, change) * 0.8;

  // Mode-specific opportunity signal
  let modeBonus = 0;
  if (mode === "flipper") {
    const profit = Math.max(0, card.price * (1 - EBAY_FEE) - SHIPPING);
    const marginPct = card.price > 0 ? (profit / card.price) * 100 : 0;
    modeBonus = marginPct * 0.4 + liquidity * 0.15;
  } else if (mode === "collector") {
    modeBonus = liquidity * 0.2 + (card.supplyTrend === "declining" ? 14 : 0);
  } else if (mode === "grader") {
    const gemBonus = card.gemRate != null ? Math.max(0, 50 - card.gemRate) * 0.5 : 0;
    modeBonus = gemBonus;
  }

  // Constrained budgets amplify opportunity signals (cheap movers can win on %)
  const multiplier = isConstrained ? 1.6 : 1.0;

  return baseScore + (momentumBonus + modeBonus) * multiplier;
}

// Per-card "reason" chip — why this card stands out vs others in the ranked list
// ─── Intrinsic Value Model ────────────────────────────────────────────────────
// Two-factor valuation model: scarcity × desirability, calibrated against the
// observed market. Goal is NOT to predict prices to the dollar — it's to flag
// cards where the market has diverged significantly from fundamentals, so
// collectors can spot undervalued gems and avoid frothy overvaluation.
//
// Approach is loosely inspired by supply-and-demand collectible models:
//   intrinsic ≈ base × (1 + supplyCoef)^(scarcity - 5) × (1 + demandCoef)^(desirability - 5)
// Calibrated so a (5, 5) baseline card matches typical mid-tier chase prices.

// Character premium — roughly how much a Pokemon's identity adds to desirability,
// on a 1-10 scale. Based on community heat, historical chase status, and
// universal recognition. Not every Pokemon needs an entry; unknowns default to 5.
const CHARACTER_PREMIUM = {
  // Top tier — generational icons
  "Charizard": 10, "Pikachu": 9.5, "Mewtwo": 9.5, "Mew": 9.5, "Umbreon": 9.5,
  "Lugia": 9, "Rayquaza": 9, "Gengar": 9, "Eevee": 9, "Dragonite": 8.5,
  // Fan favorites — very strong pull
  "Espeon": 8.5, "Sylveon": 8.5, "Vaporeon": 8, "Flareon": 8, "Jolteon": 8,
  "Leafeon": 8, "Glaceon": 8, "Gyarados": 8.5, "Snorlax": 8, "Lucario": 8,
  "Garchomp": 8, "Tyranitar": 8, "Blastoise": 8.5, "Venusaur": 8, "Gardevoir": 8,
  // Legendary / mythical tier
  "Ho-Oh": 8.5, "Arceus": 8, "Giratina": 8, "Dialga": 7.5, "Palkia": 7.5,
  "Darkrai": 7.5, "Zekrom": 7, "Reshiram": 7, "Kyogre": 7.5, "Groudon": 7.5,
  "Zacian": 7, "Zamazenta": 7, "Necrozma": 7, "Yveltal": 7, "Xerneas": 7,
  // Modern popular
  "Greninja": 8, "Decidueye": 7.5, "Cinderace": 7, "Iron Valiant": 7.5,
  "Miraidon": 7, "Koraidon": 7, "Roaring Moon": 7.5, "Iron Crown": 7,
  "Dragapult": 7.5, "Pecharunt": 7, "Ogerpon": 7.5, "Terapagos": 7,
  // Gen 1 Kanto starters / classics
  "Bulbasaur": 7, "Squirtle": 7, "Charmander": 7.5, "Meowth": 7, "Jigglypuff": 6.5,
  "Raichu": 7, "Ninetales": 7.5, "Alakazam": 7, "Machamp": 7, "Articuno": 7.5,
  "Zapdos": 7.5, "Moltres": 7.5,
  // Trainers (key cards often have high pull value regardless)
  "Lillie": 8, "Marnie": 7.5, "N": 7.5, "Iono": 7.5, "Nessa": 7, "Serena": 7.5,
  "Cynthia": 8, "Red": 8, "Blue": 7, "Leon": 7,
};

function extractCharacter(cardName) {
  if (!cardName) return null;
  // Strip variants/forms: "Charizard ex" → "Charizard", "Mega Charizard X" → "Charizard",
  // "Umbreon VMAX" → "Umbreon", etc.
  const cleaned = cardName
    .replace(/\bex\b|\bEX\b|\bGX\b|\bV\b|\bVMAX\b|\bVSTAR\b|\bV-UNION\b/g, "")
    .replace(/\bMega\b|\bShadow\b|\bRadiant\b|\bDark\b|\bShining\b/gi, "")
    .replace(/\b(?:X|Y)\b/g, "")
    .replace(/'s\b/, "") // "Lillie's Clefairy" → "Lillie Clefairy"
    .trim();
  // Take the first word that matches a known character, else the first word.
  const words = cleaned.split(/\s+/);
  for (const w of words) {
    if (CHARACTER_PREMIUM[w] !== undefined) return w;
  }
  return words[0] || null;
}

function characterPremium(cardName) {
  const char = extractCharacter(cardName);
  return (char && CHARACTER_PREMIUM[char]) || 5; // default mid
}

// Scarcity score 1-10 — how hard is it to get this card?
function scarcityScore(card) {
  const rarity = (card.rarity || "").toLowerCase();
  // Rarity tier weight (how few of these exist per set on average)
  let rScore = 5;
  if (rarity.includes("special illustration")) rScore = 9;
  else if (rarity.includes("hyper")) rScore = 8.5;
  else if (rarity.includes("illustration")) rScore = 8;
  else if (rarity.includes("secret")) rScore = 8;
  else if (rarity.includes("ultra")) rScore = 6.5;
  else if (rarity.includes("double")) rScore = 5;
  else if (rarity.includes("rare holo")) rScore = 4;
  else if (rarity.includes("rare")) rScore = 3.5;
  else if (rarity.includes("uncommon")) rScore = 2;
  else if (rarity.includes("common")) rScore = 1.5;
  // Set-meta adjustments — OOP, heavily rotated, or vintage sets mean less supply
  const meta = card.setMeta;
  if (meta) {
    if (meta.rotationStatus === "vintage") rScore += 1.5;
    else if (meta.rotationStatus === "long-rotated") rScore += 0.8;
    else if (meta.rotationStatus === "just-rotated") rScore += 0.3;
    if (meta.printStatus === "out-of-print") rScore += 0.6;
    else if (meta.printStatus === "heavy-reprint") rScore -= 0.8;
  }
  return clamp(Math.round(rScore * 10) / 10, 1, 10);
}

// Desirability score 1-10 — how much do people want this card?
// Blends character premium (60%) and "art tier" premium (40%) — SIRs/IRs get
// the art bonus because they ARE the art-focused rarity tier.
function desirabilityScore(card) {
  const char = characterPremium(card.name);
  const rarity = (card.rarity || "").toLowerCase();
  let artScore = 5;
  if (rarity.includes("special illustration")) artScore = 9;
  else if (rarity.includes("illustration")) artScore = 7.5;
  else if (rarity.includes("hyper")) artScore = 6.5;
  else if (rarity.includes("secret")) artScore = 6;
  else if (rarity.includes("ultra")) artScore = 5.5;
  const score = char * 0.6 + artScore * 0.4;
  return clamp(Math.round(score * 10) / 10, 1, 10);
}

// Intrinsic value estimate — calibrated multiplicative model.
// Coefficients tuned against observed market prices for ~15 real cards spanning
// commons ($1-5) through top chase cards ($500+). Baseline $10 represents a
// median card; scarcity adds ~45% per point, desirability adds ~68% per point
// (desirability ~1.5x more impactful than scarcity, matching collector intuition).
// The model is intentionally approximate — its value is flagging OUTLIERS, not
// predicting prices to the dollar.
const INTRINSIC_BASE = 10;
const SCARCITY_COEF = 0.45;
const DESIRABILITY_COEF = 0.68;

function intrinsicValue(card) {
  const s = scarcityScore(card);
  const d = desirabilityScore(card);
  const value = INTRINSIC_BASE
    * Math.pow(1 + SCARCITY_COEF, s - 5)
    * Math.pow(1 + DESIRABILITY_COEF, d - 5);
  return Math.round(value);
}

// Valuation signal — returns { label, color, ratio, intrinsic } comparing
// market price to the model's intrinsic estimate.
// Only applied to singles; sealed has different dynamics (EV-based, not scarcity).
function valuationSignal(card) {
  if (!card || card.type === "sealed" || !card.price || !card.rarity) return null;
  const intrinsic = intrinsicValue(card);
  if (!intrinsic || intrinsic < 1) return null;
  const ratio = card.price / intrinsic;
  if (ratio < 0.55) return { label: "Undervalued", color: C.green, ratio, intrinsic };
  if (ratio < 0.80) return { label: "Below model", color: C.green, ratio, intrinsic };
  if (ratio <= 1.35) return { label: "Fair value", color: C.textSub, ratio, intrinsic };
  if (ratio <= 2.00) return { label: "Above model", color: C.amber, ratio, intrinsic };
  return { label: "Overvalued", color: C.red, ratio, intrinsic };
}

function cardReason(card, mode, timeRange, ctx) {
  const change = card[timeRange] ?? 0;

  // Rotation / print status take priority — these are the dominant market
  // signals in the Pokémon TCG world.
  const meta = card.setMeta || getSetMeta(card);
  if (meta) {
    const { rotationStatus, printStatus, regulation } = meta;
    if (rotationStatus === "just-rotated" && printStatus === "heavy-reprint" && mode === "flipper") {
      return { label: "Flood risk — rotated + reprinted", color: C.red };
    }
    if (rotationStatus === "just-rotated" && printStatus !== "heavy-reprint" && mode === "flipper") {
      return { label: "Post-rotation window", color: C.blue };
    }
    if (rotationStatus === "current" && regulation === "H" && mode === "flipper") {
      return { label: "Pre-rotation window", color: C.blue };
    }
    if (rotationStatus === "vintage" && mode === "collector") {
      return { label: "Vintage — permanent OOP", color: C.green };
    }
    if (rotationStatus === "long-rotated" && printStatus === "out-of-print" && mode === "collector") {
      return { label: "OOP · established climb", color: C.green };
    }
    if (printStatus === "heavy-reprint" && mode === "flipper" && change < 5) {
      return { label: "Heavy reprint — slow mover", color: C.red };
    }
  }

  // Intrinsic-value signal — show to collectors when market diverges notably
  // from our scarcity × desirability model. Flagged extremes get priority.
  const val = valuationSignal(card);
  if (val && mode === "collector") {
    if (val.ratio < 0.70) {
      return { label: `Undervalued · model $${val.intrinsic}`, color: C.green };
    }
    if (val.ratio > 2.2) {
      return { label: `Frothy · fair value $${val.intrinsic}`, color: C.red };
    }
  }
  if (val && mode === "flipper" && val.ratio < 0.75 && card.liquidity >= 75) {
    return { label: `Underpriced · model $${val.intrinsic}`, color: C.green };
  }

  if (change > 0 && change >= ctx.maxChange - 0.5 && change >= 10) {
    return { label: `Top ${timeRangeLabel(timeRange)} gain`, color: C.green };
  }
  if (card.gemRate != null && card.gemRate <= 12 && mode !== "flipper") {
    return { label: `Rare PSA 10`, color: C.purple };
  }
  if (card.supplyTrend === "declining" && change > 5) {
    return { label: `Supply dropping`, color: C.yellow };
  }
  if (card.supplyTrend === "flooding" && mode === "flipper") {
    return { label: `Supply flooding — avoid`, color: C.red };
  }
  if (mode === "flipper") {
    const profit = Math.max(0, card.price * (1 - EBAY_FEE) - SHIPPING);
    const margin = card.price > 0 ? (profit / card.price) * 100 : 0;
    if (margin > 80 && card.liquidity >= 80) return { label: `Quick flip`, color: C.green };
  }
  if (card.liquidity >= ctx.maxLiquidity - 2 && card.liquidity >= 85) {
    return { label: `Fastest selling`, color: C.blue };
  }
  if (card.price <= ctx.medianPrice / 2 && (card[MODES[mode].sortKey] ?? 0) >= 80) {
    return { label: `Hidden value`, color: C.yellow };
  }
  return null;
}

function timeRangeLabel(tr) {
  return tr.replace("change", "");
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, positive }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const W = 72, H = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  const color = positive ? C.green : C.red;
  const id = `g${positive ? "u" : "d"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 72, height: 28, display: "block" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${id})`} />
    </svg>
  );
}

// ─── Score pill ───────────────────────────────────────────────────────────────
function ScorePill({ score, isActive }) {
  if (score == null) return <span style={{ color: C.textMuted, fontSize: "0.8rem" }}>—</span>;
  const color = score >= 85 ? C.green : score >= 70 ? C.yellow : C.red;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 30, height: 30, borderRadius: 99,
      border: `1.5px solid ${isActive ? color : C.border}`,
      background: isActive ? color + "14" : "transparent", transition: "all 0.15s",
    }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: isActive ? color : C.textSub, fontFamily: "'Inter',sans-serif" }}>{score}</span>
    </div>
  );
}

// ─── Change chip ──────────────────────────────────────────────────────────────
function Change({ val }) {
  if (val == null) return <span style={{ color: C.textMuted, fontSize: "0.8rem" }}>—</span>;
  const up = val >= 0;
  return (
    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: up ? C.green : C.red, fontFamily: "'Inter',sans-serif" }}>
      {up ? "+" : ""}{val.toFixed(1)}%
    </span>
  );
}

// ─── Type chip ────────────────────────────────────────────────────────────────
function TypeChip({ type, subtype }) {
  const map = { single: [C.blue, "Single"], sealed: [C.yellow, "Sealed"], graded: [C.purple, "Graded"] };
  const [color, label] = map[type] || [C.textSub, type];
  return <span style={{ fontSize: "0.6rem", fontWeight: 600, color, background: color + "18", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}{subtype ? ` · ${subtype}` : ""}</span>;
}

// Rotation + print status chip. Tone-driven color ties to market signal.
function SetStatusChip({ card }) {
  const meta = card.setMeta || getSetMeta(card);
  const status = setStatusLabel(meta);
  if (!status) return null;
  const toneColor = {
    strong: C.green,   // OOP, vintage — appreciation
    fresh: C.blue,     // rotation windows — time-sensitive signal
    mixed: C.yellow,   // partial / uncertain
    warn: C.red,       // heavy reprint, flood risk
    neutral: C.textSub,
  };
  const color = toneColor[status.tone] || C.textSub;
  return (
    <span style={{
      fontSize: "0.58rem", fontWeight: 600, color,
      background: color + "14", padding: "2px 6px", borderRadius: 4,
      letterSpacing: "0.03em", whiteSpace: "nowrap",
      display: "inline-flex", gap: 3, alignItems: "center",
    }}>
      <span>{status.icon}</span><span>{status.label}</span>
    </span>
  );
}

// ─── Reason chip (budget-aware) ──────────────────────────────────────────────
function ReasonChip({ reason }) {
  if (!reason) return null;
  return (
    <span style={{
      fontSize: "0.6rem", fontWeight: 600, color: reason.color,
      background: reason.color + "14", border: `1px solid ${reason.color}33`,
      padding: "2px 6px", borderRadius: 4, letterSpacing: "0.02em",
    }}>
      {reason.label}
    </span>
  );
}

// Compact valuation indicator shown near price. Only renders when market
// diverges meaningfully from the intrinsic value model (i.e. not fair value)
// so fair-value cards stay visually uncluttered. Uses useCurrency so the
// model price shows in the user's preferred currency.
function ValuationChip({ card }) {
  const { fmtPrice } = useCurrency();
  const val = valuationSignal(card);
  if (!val) return null;
  // Hide for "fair value" — no need to clutter the UI when model & market agree
  if (val.label === "Fair value") return null;
  const isUnder = val.ratio < 1;
  return (
    <div
      title={`Model ${fmtPrice(val.intrinsic)} · market is ${Math.round((val.ratio - 1) * 100)}% ${isUnder ? "below" : "above"} intrinsic value`}
      style={{
        fontSize: "0.62rem", fontWeight: 600, color: val.color,
        display: "inline-flex", alignItems: "center", gap: 3,
        letterSpacing: "0.01em", marginTop: 2,
      }}
    >
      <span style={{ fontSize: "0.7rem", lineHeight: 1 }}>{isUnder ? "↓" : "↑"}</span>
      <span>{fmtPrice(val.intrinsic)} model</span>
    </div>
  );
}

// ─── Buy Links ───────────────────────────────────────────────────────────────
// Renders compact or full-width buy buttons for a given card across all three
// major marketplaces, plus a "Sold" deep-link to eBay's sold-listings search.
// The Sold link is the most honest way to give users real transaction data
// without paying for any API — eBay shows them the actual last ~90 days of
// sales for the exact card. Zero API cost, zero ToS risk, zero scaling ceiling.
// Used in the Markets table and in Best Picks hero cards.
function BuyLinks({ card, size = "sm" }) {
  const query = encodeURIComponent(`${card.name} ${card.set || ""}`.trim());
  const buyLinks = [
    { label: "eBay", url: `https://www.ebay.com/sch/i.html?_nkw=${query}`, color: C.green, title: "Buy on eBay" },
    { label: "TCG", url: `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${query}`, color: TCG_COLOR, title: "Buy on TCGplayer" },
    { label: "FB", url: `https://www.facebook.com/marketplace/search/?query=${query}`, color: "#5b9dff", title: "Buy on Facebook Marketplace" },
  ];
  // eBay sold-listings URL params: LH_Sold=1 restricts to sold items,
  // LH_Complete=1 restricts to completed listings. Together they show the
  // sold-comps view of eBay — the "what did this actually sell for" answer.
  const soldUrl = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  const isCompact = size === "sm";
  const soldColor = "#c77dff"; // Purple to distinguish research intent from buy actions

  const btnStyle = (color) => ({
    flex: isCompact ? "0 0 auto" : 1,
    background: color + "18",
    border: `1px solid ${color}33`,
    color,
    padding: isCompact ? "4px 8px" : "6px 8px",
    borderRadius: isCompact ? 5 : 6,
    fontSize: isCompact ? "0.62rem" : "0.7rem",
    fontWeight: 700,
    textDecoration: "none",
    textAlign: "center",
    fontFamily: "'Inter',sans-serif",
    letterSpacing: "0.02em",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", gap: isCompact ? 4 : 6, justifyContent: isCompact ? "flex-end" : "stretch", flexWrap: isCompact ? "nowrap" : "wrap" }}>
      {buyLinks.map(l => (
        <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
          title={l.title}
          onClick={e => e.stopPropagation()}
          style={btnStyle(l.color)}
          onMouseEnter={e => { e.currentTarget.style.background = l.color + "33"; }}
          onMouseLeave={e => { e.currentTarget.style.background = l.color + "18"; }}
        >
          {l.label}
        </a>
      ))}
      <a href={soldUrl} target="_blank" rel="noreferrer"
        title="See recent sold prices on eBay"
        onClick={e => e.stopPropagation()}
        style={btnStyle(soldColor)}
        onMouseEnter={e => { e.currentTarget.style.background = soldColor + "33"; }}
        onMouseLeave={e => { e.currentTarget.style.background = soldColor + "18"; }}
      >
        Sold
      </a>
    </div>
  );
}

// ─── Onboarding screen ────────────────────────────────────────────────────────
function Onboarding({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: "2rem", fontWeight: 800, color: C.text, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Catch<span style={{ color: C.green }}>'em</span>
        </div>
        <div style={{ fontSize: "1rem", color: C.textSub, fontWeight: 400, maxWidth: 340, lineHeight: 1.6 }}>
          The smartest way to track, collect, and grow your Pokémon card portfolio.
        </div>
      </div>

      <div style={{ fontSize: "0.8rem", color: C.textSub, fontWeight: 500, marginBottom: 20, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pick your mode</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 760 }}>
        {Object.values(MODES).map(mode => {
          const isHov = hovered === mode.key;
          return (
            <div key={mode.key}
              onClick={() => onSelect(mode.key)}
              onMouseEnter={() => setHovered(mode.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: 220, padding: "28px 24px", borderRadius: 20,
                background: isHov ? C.surfaceHover : C.surface,
                border: `1.5px solid ${isHov ? mode.color + "55" : C.border}`,
                cursor: "pointer", transition: "all 0.2s ease",
                transform: isHov ? "translateY(-4px)" : "none",
                boxShadow: isHov ? `0 16px 48px ${mode.color}18` : "none",
              }}>
              <div style={{ fontSize: "2.2rem", marginBottom: 14 }}>{mode.emoji}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: isHov ? mode.color : C.text, marginBottom: 8 }}>{mode.label}</div>
              <div style={{ fontSize: "0.78rem", color: mode.color, fontWeight: 600, marginBottom: 10 }}>{mode.tagline}</div>
              <div style={{ fontSize: "0.75rem", color: C.textSub, lineHeight: 1.6 }}>{mode.desc}</div>
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6, color: isHov ? mode.color : C.textSub, fontSize: "0.78rem", fontWeight: 600 }}>
                Get started <span style={{ fontSize: "1rem" }}>→</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "0.72rem", color: C.textMuted, marginTop: 32 }}>You can switch modes anytime from the top bar.</div>
    </div>
  );
}

// ─── Budget Slider (log scale + working state) ────────────────────────────────
function BudgetSlider({ budget, onChange }) {
  const { fmtPrice } = useCurrency();
  const pct = budgetToSliderPct(budget);
  const unlimited = budget >= BUDGET_UNLIMITED;
  const tier = budgetTier(budget);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.65rem", color: C.textSub, fontWeight: 600, marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Your budget</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1, fontFamily: "'Inter',sans-serif" }}>
            {unlimited ? "No limit" : `Up to ${fmtPrice(budget)}`}
          </div>
          <div style={{ fontSize: "0.72rem", color: C.textSub, marginTop: 6 }}>
            <span style={{ color: C.text, fontWeight: 600 }}>{tier.label}</span> · {tier.blurb}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {BUDGET_PRESETS.map(p => (
            <button key={p} onClick={() => onChange(p)} style={{
              background: budget === p ? C.blue + "22" : "transparent",
              border: `1px solid ${budget === p ? C.blue + "55" : C.border}`,
              color: budget === p ? C.blue : C.textSub,
              padding: "6px 10px", fontSize: "0.72rem", fontWeight: 600, borderRadius: 8,
              cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
            }}>${p < 1000 ? p : `${p/1000}k`}</button>
          ))}
          <button onClick={() => onChange(BUDGET_UNLIMITED)} style={{
            background: unlimited ? C.green + "22" : "transparent",
            border: `1px solid ${unlimited ? C.green + "55" : C.border}`,
            color: unlimited ? C.green : C.textSub,
            padding: "6px 10px", fontSize: "0.72rem", fontWeight: 600, borderRadius: 8,
            cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
          }}>No limit</button>
        </div>
      </div>

      {/* Slider (log scale 0-100, plus 101 = no limit) */}
      <div style={{ position: "relative", height: 6, background: C.border, borderRadius: 99, marginBottom: 8 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${Math.min(100, pct)}%`,
          background: `linear-gradient(90deg, ${C.blue}, ${C.green})`, borderRadius: 99,
        }} />
        <input
          type="range" min={0} max={101} step={1} value={pct}
          onChange={e => onChange(sliderPctToBudget(Number(e.target.value)))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer" }}
        />
        <div style={{
          position: "absolute", top: "50%", left: `${Math.min(100, pct)}%`,
          transform: "translate(-50%, -50%)",
          width: 16, height: 16, borderRadius: 99,
          background: unlimited ? C.green : C.blue,
          boxShadow: `0 0 0 4px ${(unlimited ? C.green : C.blue)}22`,
          pointerEvents: "none", transition: "background 0.15s",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: C.textMuted }}>
        <span>$10</span><span>$100</span><span>$1k</span><span>$10k</span><span style={{ color: unlimited ? C.green : C.textMuted, fontWeight: unlimited ? 700 : 400 }}>No limit</span>
      </div>
    </div>
  );
}

// ─── Best Picks hero strip ────────────────────────────────────────────────────
function BestPicks({ ranked, mode, timeRange, budget }) {
  const { fmtPrice } = useCurrency();
  if (ranked.length < 2) return null;
  const modeData = MODES[mode];
  const trLbl = timeRangeLabel(timeRange);

  const topOpp = ranked[0];
  const biggestMover = [...ranked].sort((a, b) => (b[timeRange] ?? -Infinity) - (a[timeRange] ?? -Infinity))[0];

  // Hidden gem: best base score per dollar, excluding the first two picks
  const gemPool = ranked.filter(c => c.id !== topOpp.id && c.id !== biggestMover.id && c.price > 0);
  const hiddenGem = gemPool.sort((a, b) => {
    const aS = (a[modeData.sortKey] ?? 0) / Math.max(a.price, 1);
    const bS = (b[modeData.sortKey] ?? 0) / Math.max(b.price, 1);
    return bS - aS;
  })[0];

  const picks = [
    {
      card: topOpp, label: "Best Opportunity", color: modeData.color,
      reason: `${modeData.label} score ${topOpp[modeData.sortKey] ?? "—"} · ${fmtPrice(topOpp.price)}`,
    },
    biggestMover && biggestMover.id !== topOpp.id && (biggestMover[timeRange] ?? 0) > 0 && {
      card: biggestMover, label: `Biggest ${trLbl} Mover`, color: C.green,
      reason: `+${(biggestMover[timeRange] ?? 0).toFixed(1)}% · ${fmtPrice(biggestMover.price)}`,
    },
    hiddenGem && {
      card: hiddenGem, label: "Hidden Gem", color: C.yellow,
      reason: `Score ${hiddenGem[modeData.sortKey] ?? "—"} for just ${fmtPrice(hiddenGem.price)}`,
    },
  ].filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`, gap: 12, marginBottom: 20 }}>
      {picks.map(({ card, label, color, reason }) => (
        <div key={card.id + label} style={{
          background: `linear-gradient(135deg, ${color}14, ${C.surface})`,
          border: `1px solid ${color}33`,
          borderRadius: 14, padding: 14,
          display: "flex", flexDirection: "column", gap: 10,
          transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = color + "66"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = color + "33"; }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <img src={card.image} alt="" style={{ width: 44, height: 62, objectFit: "contain", borderRadius: 4, flexShrink: 0, background: C.bg }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.6rem", color, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{card.name}</div>
              <div style={{ fontSize: "0.7rem", color: C.textSub, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reason}</div>
            </div>
          </div>
          <BuyLinks card={card} size="lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Markets Tab ──────────────────────────────────────────────────────────────
const TIME_RANGES = [{ key: "change7d", label: "7D" }, { key: "change30d", label: "30D" }, { key: "change90d", label: "90D" }];
const TYPE_FILTERS = ["All", "Single", "Sealed", "Graded"];
const STATUS_FILTERS = [
  { key: "all",           label: "All",            icon: null,   color: null },
  { key: "undervalued",   label: "Undervalued",    icon: "📊",   color: "#3fb37f" },
  { key: "pre-rotation",  label: "Pre-rotation",   icon: "🔥",   color: "#64a0ff" },
  { key: "just-rotated",  label: "Just rotated",   icon: "📉",   color: "#c77dff" },
  { key: "oop",           label: "OOP",            icon: "💎",   color: "#3fb37f" },
  { key: "vintage",       label: "Vintage",        icon: "🏛️",  color: "#3fb37f" },
  { key: "heavy-reprint", label: "Heavy reprints", icon: "⚠️",  color: "#ef5a5a" },
];

// Check whether a card matches a given rotation/print status filter.
function matchesStatusFilter(card, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "undervalued") {
    const val = valuationSignal(card);
    return !!(val && val.ratio < 0.80);
  }
  const meta = card.setMeta || getSetMeta(card);
  if (!meta) return false;
  const { rotationStatus, printStatus, regulation } = meta;
  switch (statusFilter) {
    case "pre-rotation":  return rotationStatus === "current" && regulation === "H";
    case "just-rotated":  return rotationStatus === "just-rotated" || rotationStatus === "partial-rotation";
    case "oop":           return printStatus === "out-of-print";
    case "vintage":       return rotationStatus === "vintage";
    case "heavy-reprint": return printStatus === "heavy-reprint";
    default: return true;
  }
}

// Compact dashboard card that surfaces a rotation window + card count.
// Tapping the card applies the matching status filter below.
function RotationCard({ icon, title, subtitle, detail, count, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      background: color + "0f",
      border: `1px solid ${color}33`,
      borderRadius: 12, padding: 14, textAlign: "left", cursor: "pointer",
      fontFamily: "'Inter',sans-serif",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "all 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = color + "18"}
      onMouseLeave={e => e.currentTarget.style.background = color + "0f"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "1.15rem" }}>{icon}</span>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, flex: 1, minWidth: 0 }}>{title}</span>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color, background: color + "22", padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{count} →</span>
      </div>
      <div style={{ fontSize: "0.68rem", color, fontWeight: 600 }}>{subtitle}</div>
      <div style={{ fontSize: "0.66rem", color: C.textSub, lineHeight: 1.5 }}>{detail}</div>
    </button>
  );
}

function RotationWindows({ marketCards, onFilter, isMobile }) {
  const preRotationCount = marketCards.filter(c => matchesStatusFilter(c, "pre-rotation")).length;
  const justRotatedCount = marketCards.filter(c => matchesStatusFilter(c, "just-rotated")).length;
  const oopCount = marketCards.filter(c => matchesStatusFilter(c, "oop")).length;
  const daysPost = daysSince(LAST_ROTATION_DATE);
  const daysPre = daysUntil(NEXT_ROTATION_DATE);

  // Don't render if nothing to show (avoids dead space on tiny catalogs)
  if (preRotationCount + justRotatedCount + oopCount === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.6rem", color: C.textMuted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>🕒 Rotation windows</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
        {preRotationCount > 0 && (
          <RotationCard
            icon="🔥" color="#64a0ff"
            title="Pre-rotation window"
            subtitle={`~${daysPre} days · rotates Apr 10, 2027`}
            detail="H-mark: Temporal Forces, Twilight Masquerade, Shrouded Fable"
            count={preRotationCount}
            onClick={() => onFilter("pre-rotation")}
          />
        )}
        {justRotatedCount > 0 && (
          <RotationCard
            icon="📉" color="#c77dff"
            title="Just rotated"
            subtitle={`${daysPost} days ago · prices settling`}
            detail="SV Base, Paldea Evolved, Obsidian Flames, Paradox Rift, 151"
            count={justRotatedCount}
            onClick={() => onFilter("just-rotated")}
          />
        )}
        {oopCount > 0 && (
          <RotationCard
            icon="💎" color="#3fb37f"
            title="Out of print"
            subtitle="Finite supply · long-term climb"
            detail="Evolving Skies, Fusion Strike, older OOP sets"
            count={oopCount}
            onClick={() => onFilter("oop")}
          />
        )}
      </div>
    </div>
  );
}

// Mobile-friendly card row used in place of the table on narrow screens.
function MarketCardRowMobile({ card, rank, mode, modeData, timeRange, reasonCtx }) {
  const { fmtPrice } = useCurrency();
  const isTop = rank === 0;
  const reason = cardReason(card, mode, timeRange, reasonCtx);
  const changeVal = card[timeRange];

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${isTop ? modeData.color + "55" : C.border}`,
      borderRadius: 12, padding: 12,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, borderRadius: 99, flexShrink: 0,
          background: isTop ? modeData.color + "18" : "transparent",
          border: isTop ? `1.5px solid ${modeData.color}` : `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: isTop ? modeData.color : C.textSub }}>{rank + 1}</span>
        </div>
        <img src={card.image} alt="" style={{ width: 42, height: 58, objectFit: "contain", borderRadius: 3, flexShrink: 0, background: C.bg }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
            <TypeChip type={card.type} subtype={card.subtype} /> <SetStatusChip card={card} />
            {card.supplyTrend === "declining" && <span style={{ fontSize: "0.7rem" }}>📉</span>}
            <ReasonChip reason={reason} />
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 3 }}>{card.name}</div>
          <div style={{ fontSize: "0.68rem", color: C.textSub }}>{card.set}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: C.text, fontFamily: "'Inter',sans-serif" }}>{fmtPrice(card.price)}</div>
          <Change val={changeVal} />
          <ValuationChip card={card} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: "0.55rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Score</span>
            <ScorePill score={card[modeData.sortKey]} isActive={true} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: "0.55rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Liq</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: card.liquidity >= 75 ? C.green : card.liquidity >= 50 ? C.yellow : C.red, fontFamily: "'Inter',sans-serif" }}>{card.liquidity}</span>
          </div>
          <Sparkline data={card.sparkline} positive={changeVal >= 0} />
        </div>
        <BuyLinks card={card} size="sm" />
      </div>
    </div>
  );
}

function MarketsTab({ mode, budget, setBudget, marketCards, marketStatus, onRefreshMarket }) {
  const modeData = MODES[mode];
  const { fmtPrice } = useCurrency();
  const [timeRange, setTimeRange] = useState("change90d");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [hovered, setHovered] = useState(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const { isMobile } = useWindowSize();

  const withinBudget = budget >= BUDGET_UNLIMITED;

  const ranked = useMemo(() => {
    return [...marketCards]
      .filter(c => withinBudget || c.price <= budget)
      .filter(c => typeFilter === "All" || c.type === typeFilter.toLowerCase())
      .filter(c => matchesStatusFilter(c, statusFilter))
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.set.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (!sortCol) {
          const as = opportunityScore(a, mode, budget, timeRange);
          const bs = opportunityScore(b, mode, budget, timeRange);
          return sortDir === "desc" ? bs - as : as - bs;
        }
        const av = a[sortCol] ?? -Infinity, bv = b[sortCol] ?? -Infinity;
        return sortDir === "desc" ? bv - av : av - bv;
      });
  }, [mode, budget, timeRange, typeFilter, statusFilter, search, sortCol, sortDir, withinBudget, marketCards]);

  // Context for reason chips: max change, max liquidity, median price in current ranked set
  const reasonCtx = useMemo(() => {
    if (!ranked.length) return { maxChange: 0, maxLiquidity: 0, medianPrice: 0 };
    const changes = ranked.map(c => c[timeRange] ?? 0);
    const liqs = ranked.map(c => c.liquidity ?? 0);
    const prices = [...ranked.map(c => c.price)].sort((a, b) => a - b);
    return {
      maxChange: Math.max(...changes),
      maxLiquidity: Math.max(...liqs),
      medianPrice: prices[Math.floor(prices.length / 2)],
    };
  }, [ranked, timeRange]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const activeSort = sortCol;
  const SortArrow = ({ col }) => (
    <span style={{ marginLeft: 4, color: activeSort === col ? modeData.color : C.textMuted, fontSize: "0.7rem" }}>
      {activeSort === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );
  const Th = ({ col, children, right }) => (
    <th onClick={() => handleSort(col)} style={{
      padding: "12px 16px", textAlign: right ? "right" : "left",
      fontSize: "0.68rem", fontWeight: 600, color: C.textSub,
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: `1px solid ${C.border}`, cursor: "pointer", userSelect: "none",
      whiteSpace: "nowrap",
    }}>{children}<SortArrow col={col} /></th>
  );

  return (
    <div>
      <BudgetSlider budget={budget} onChange={setBudget} />

      {/* Market data status */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 10, gap: 8 }}>
        {marketStatus === "loading" && (
          <span style={{ fontSize: "0.68rem", color: C.textSub, display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, padding: "5px 10px", borderRadius: 99 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: C.blue, animation: "pulse 1.4s ease-in-out infinite" }} />
            Loading live market...
          </span>
        )}
        {marketStatus === "live" && (
          <button onClick={onRefreshMarket} title="Refresh from Pokémon TCG API"
            style={{ fontSize: "0.68rem", color: C.green, display: "inline-flex", alignItems: "center", gap: 6, background: C.green + "12", border: `1px solid ${C.green}33`, padding: "5px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: C.green }} />
            Live · {marketCards.length} cards · refresh
          </button>
        )}
        {marketStatus === "error" && (
          <button onClick={onRefreshMarket} title="Retry"
            style={{ fontSize: "0.68rem", color: C.yellow, display: "inline-flex", alignItems: "center", gap: 6, background: C.yellow + "12", border: `1px solid ${C.yellow}33`, padding: "5px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: C.yellow }} />
            Demo fallback · retry
          </button>
        )}
      </div>

      {/* Personalized header */}
      <div style={{
        background: `linear-gradient(135deg, ${modeData.color}14, transparent)`,
        border: `1px solid ${modeData.color}22`, borderRadius: 14, padding: "16px 20px",
        marginBottom: 16, display: "flex", gap: 16, alignItems: "center",
      }}>
        <div style={{ fontSize: "2rem" }}>{modeData.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Ranked for <span style={{ color: modeData.color }}>{modeData.label}s</span>
            {!withinBudget && <span style={{ color: C.textSub, fontWeight: 400 }}> · under {fmtPrice(budget)}</span>}
          </div>
          <div style={{ fontSize: "0.78rem", color: C.textSub, lineHeight: 1.5 }}>{modeData.desc}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "0.62rem", color: C.textMuted, marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Showing</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: modeData.color, lineHeight: 1 }}>{ranked.length}</div>
          <div style={{ fontSize: "0.65rem", color: C.textMuted }}>of {marketCards.length} cards</div>
        </div>
      </div>

      {/* Best Picks hero strip */}
      {ranked.length > 0 && <BestPicks ranked={ranked} mode={mode} timeRange={timeRange} budget={budget} />}

      {/* Rotation windows dashboard */}
      <RotationWindows marketCards={marketCards} onFilter={setStatusFilter} isMobile={isMobile} />

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: "0.85rem" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or set..." style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
          {TIME_RANGES.map(({ key, label }) => (
            <button key={key} onClick={() => setTimeRange(key)} style={{
              background: timeRange === key ? modeData.color + "22" : "transparent",
              border: "none", color: timeRange === key ? modeData.color : C.textSub,
              padding: "7px 12px", fontSize: "0.72rem", fontWeight: 600, borderRadius: 7,
              cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={{
              background: typeFilter === f ? C.text + "12" : C.surface,
              border: `1px solid ${typeFilter === f ? C.borderStrong : C.border}`,
              color: typeFilter === f ? C.text : C.textSub,
              padding: "7px 12px", fontSize: "0.72rem", fontWeight: 600, borderRadius: 8,
              cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
            }}>{f}</button>
          ))}
        </div>
        {sortCol && (
          <button onClick={() => setSortCol(null)} style={{
            background: "transparent", border: `1px dashed ${C.border}`,
            color: C.textSub, padding: "7px 12px", fontSize: "0.7rem", fontWeight: 600,
            borderRadius: 8, cursor: "pointer", fontFamily: "'Inter',sans-serif",
          }}>Reset to opportunity rank ×</button>
        )}
      </div>

      {/* Status filter chips — rotation & print signal */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.58rem", color: C.textMuted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 2 }}>Status:</span>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          const tintColor = f.color || C.textSub;
          return (
            <button key={f.key}
              onClick={() => setStatusFilter(active && f.key !== "all" ? "all" : f.key)}
              style={{
                background: active ? tintColor + "22" : "transparent",
                border: `1px solid ${active ? tintColor + "66" : C.border}`,
                color: active ? tintColor : C.textSub,
                padding: "5px 10px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap",
                display: "inline-flex", gap: 4, alignItems: "center", transition: "all 0.12s",
              }}>
              {f.icon && <span>{f.icon}</span>}<span>{f.label}</span>
              {active && f.key !== "all" && <span style={{ opacity: 0.6, marginLeft: 2 }}>×</span>}
            </button>
          );
        })}
        <button
          onClick={() => setShowModelInfo(true)}
          title="How the valuation model works"
          style={{
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.textMuted, width: 24, height: 24, borderRadius: 99,
            cursor: "pointer", fontFamily: "'Inter',sans-serif",
            fontSize: "0.72rem", fontWeight: 700, lineHeight: 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginLeft: 4, transition: "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.borderStrong; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
        >
          ?
        </button>
      </div>

      {showModelInfo && <ModelInfoModal onClose={() => setShowModelInfo(false)} />}

      {/* Table */}
      {ranked.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: C.text, marginBottom: 8 }}>No cards match your filters</div>
          <div style={{ fontSize: "0.8rem", color: C.textSub }}>Try increasing your budget or clearing filters.</div>
        </div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((card, i) => (
            <MarketCardRowMobile
              key={card.id}
              card={card}
              rank={i}
              mode={mode}
              modeData={modeData}
              timeRange={timeRange}
              reasonCtx={reasonCtx}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: C.textSub, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>#</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: C.textSub, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>Card</th>
                  <Th col="price" right>Price</Th>
                  <Th col={timeRange} right>{timeRangeLabel(timeRange)}%</Th>
                  <Th col="collectorScore" right>Collector</Th>
                  <Th col="flipScore" right>Flipper</Th>
                  <Th col="gradingScore" right>Grading</Th>
                  <Th col="liquidity" right>Liquidity</Th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.68rem", fontWeight: 600, color: C.textSub, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>Trend</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.68rem", fontWeight: 600, color: C.textSub, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>Shop</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((card, i) => {
                  const changeVal = card[timeRange];
                  const up = changeVal >= 0;
                  const isTop = i === 0;
                  const isHov = hovered === card.id;
                  const reason = cardReason(card, mode, timeRange, reasonCtx);
                  return (
                    <tr key={card.id}
                      onMouseEnter={() => setHovered(card.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ background: isHov ? C.surfaceHover : "transparent", transition: "background 0.12s" }}
                    >
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: 99,
                          background: isTop ? modeData.color + "18" : "transparent",
                          border: isTop ? `1.5px solid ${modeData.color}` : `1px solid ${C.border}`,
                        }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: isTop ? modeData.color : C.textSub }}>{i + 1}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <img src={card.image} alt="" style={{ width: 32, height: 44, objectFit: "contain", borderRadius: 3, background: C.bg, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                              <TypeChip type={card.type} subtype={card.subtype} /> <SetStatusChip card={card} />
                              {card.supplyTrend === "declining" && <span style={{ fontSize: "0.7rem" }} title="Supply declining">📉</span>}
                              <ReasonChip reason={reason} />
                            </div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div>
                            <div style={{ fontSize: "0.7rem", color: C.textSub, marginTop: 2 }}>{card.set}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 700, color: C.text, fontFamily: "'Inter',sans-serif" }}>{fmtPrice(card.price)}</div>
                        <ValuationChip card={card} />
                        {card.gemRate != null && (
                          <div style={{ fontSize: "0.62rem", color: card.gemRate <= 15 ? C.purple : C.textMuted, marginTop: 2 }}>
                            {card.gemRate}% gem rate
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <Change val={changeVal} />
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <ScorePill score={card.collectorScore} isActive={mode === "collector"} />
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <ScorePill score={card.flipScore} isActive={mode === "flipper"} />
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <ScorePill score={card.gradingScore} isActive={mode === "grader"} />
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: card.liquidity >= 75 ? C.green : card.liquidity >= 50 ? C.yellow : C.red, fontFamily: "'Inter',sans-serif" }}>{card.liquidity}</span>
                          <div style={{ width: 44, height: 3, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${card.liquidity}%`, background: card.liquidity >= 75 ? C.green : card.liquidity >= 50 ? C.yellow : C.red }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <Sparkline data={card.sparkline} positive={up} />
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                        <BuyLinks card={card} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: "0.66rem", color: C.textMuted, textAlign: "right" }}>
        Demo data · Default sort: budget-aware opportunity · Click any column to override
      </div>
    </div>
  );
}

// ─── Portfolio Tab ────────────────────────────────────────────────────────────
function MiniChart({ data }) {
  const vals = data.map(d => d.value);
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
  const W = 100, H = 44;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * W},${H - ((d.value - min) / range) * H}`).join(" ");
  return (
    <div style={{ marginTop: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 56, overflow: "visible" }} preserveAspectRatio="none">
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity="0.25" /><stop offset="100%" stopColor={C.green} stopOpacity="0" /></linearGradient></defs>
        <polyline points={pts} fill="none" stroke={C.green} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#cg)" />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.value - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r="1.8" fill={C.green} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {data.map(d => <span key={d.month} style={{ fontSize: "0.62rem", color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>{d.month}</span>)}
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color = C.green }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: "0.66rem", color: C.textSub, fontWeight: 600, marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1, fontFamily: "'Inter',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: C.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function PortfolioTab({ collection, onRemove }) {
  const { fmtPrice, fmtPriceExact } = useCurrency();
  const tv = collection.reduce((s, c) => s + c.currentPrice * c.quantity, 0);
  const tc = collection.reduce((s, c) => s + c.purchasePrice * c.quantity, 0);
  const tg = tv - tc;
  const tgPct = tc > 0 ? (tg / tc) * 100 : 0;
  const { isMobile } = useWindowSize();

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatBox label="Portfolio Value" value={fmtPrice(tv)} sub="current market" color={C.green} />
        <StatBox label="Total Invested" value={fmtPrice(tc)} sub="what you paid" color={C.blue} />
        <StatBox label="Total Gain" value={`${tg >= 0 ? "+" : ""}${fmtPrice(tg)}`} sub={`${tgPct >= 0 ? "+" : ""}${tgPct.toFixed(1)}%`} color={tg >= 0 ? C.green : C.red} />
        <StatBox label="Cards Owned" value={collection.reduce((s, c) => s + c.quantity, 0)} sub={`${collection.length} unique`} color={C.purple} />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text }}>Collection Value · Last 6 Months</div>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: C.green, background: C.green + "18", padding: "3px 8px", borderRadius: 6 }}>+64%</span>
        </div>
        <MiniChart data={HISTORY} />
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {collection.map(c => {
            const g = calcGain(c), p = calcGainPct(c);
            const condColor = c.condition === "NM" ? C.green : C.yellow;
            return (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <img src={c.image} alt="" style={{ width: 42, height: 58, objectFit: "contain", borderRadius: 3, flexShrink: 0, background: C.bg }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize: "0.68rem", color: C.textSub, marginBottom: 6 }}>{c.set} · {c.number}</div>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: condColor, background: condColor + "18", padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em" }}>{c.condition}</span>
                  </div>
                  <button onClick={() => onRemove(c.id)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>×</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: "0.55rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>Paid</div>
                      <div style={{ fontSize: "0.78rem", color: C.textSub, fontFamily: "'Inter',sans-serif" }}>{fmtPriceExact(c.purchasePrice)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.55rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>Market</div>
                      <div style={{ fontSize: "0.78rem", color: C.text, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{fmtPriceExact(c.currentPrice)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: g >= 0 ? C.green : C.red, fontFamily: "'Inter',sans-serif" }}>{g >= 0 ? "+" : "-"}{fmtPriceExact(Math.abs(g))}</div>
                    <div style={{ fontSize: "0.66rem", color: g >= 0 ? C.green + "99" : C.red + "99" }}>{g >= 0 ? "+" : ""}{p.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", padding: "12px 20px", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
            {["Card", "Condition", "Paid", "Market", "Gain / Loss", ""].map(h => (
              <span key={h} style={{ fontSize: "0.66rem", fontWeight: 600, color: C.textSub, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          {collection.map(c => {
            const g = calcGain(c), p = calcGainPct(c);
            return (
              <div key={c.id}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", padding: "14px 20px", borderBottom: `1px solid ${C.border}`, gap: 12, alignItems: "center", transition: "background 0.12s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={c.image} alt="" style={{ width: 30, height: 42, objectFit: "contain", borderRadius: 3, background: C.bg }} />
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text }}>{c.name}</div>
                    <div style={{ fontSize: "0.7rem", color: C.textSub, marginTop: 2 }}>{c.set} · {c.number}</div>
                  </div>
                </div>
                <span style={{ fontSize: "0.74rem", fontWeight: 600, color: c.condition === "NM" ? C.green : C.yellow }}>{c.condition}</span>
                <span style={{ fontSize: "0.82rem", color: C.textSub, fontFamily: "'Inter',sans-serif" }}>{fmtPriceExact(c.purchasePrice)}</span>
                <span style={{ fontSize: "0.82rem", color: C.text, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{fmtPriceExact(c.currentPrice)}</span>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: g >= 0 ? C.green : C.red }}>{g >= 0 ? "+" : "-"}{fmtPriceExact(Math.abs(g))}</div>
                  <div style={{ fontSize: "0.68rem", color: g >= 0 ? C.green + "99" : C.red + "99" }}>{g >= 0 ? "+" : ""}{p.toFixed(1)}%</div>
                </div>
                <button onClick={() => onRemove(c.id)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = C.red; e.target.style.color = C.red; }}
                  onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.textSub; }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Grading Tab ──────────────────────────────────────────────────────────────
function GradingTab({ collection, plan, onUpgrade }) {
  const { fmtPriceExact } = useCurrency();
  if (plan !== "pro") {
    return <ProLock
      plan={plan}
      onUpgrade={onUpgrade}
      title="Grading ROI Calculator"
      blurb="Know exactly how much you'll net if you send a card to PSA — before you ship it. Catch'em crunches the numbers across PSA 9 and PSA 10 outcomes after every fee, so you stop submitting cards that aren't worth it."
      benefits={[
        "PSA 9 & 10 projected net profit for every card you own",
        "Fees, shipping, and purchase price already deducted",
        "Flags which cards are worth sending and which to keep raw",
        "One user in our testimonials avoided $100 in bad submissions in a week",
      ]}
    />;
  }
  return (
    <div>
      <div style={{ background: C.yellow + "12", border: `1px solid ${C.yellow}30`, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: "0.8rem", color: C.text, lineHeight: 1.6 }}>
        💡 <strong>How this works:</strong> We calculate your net profit if you send each card to PSA (graded at 9 or 10), after grading fees and your purchase price. Cards with a ✓ are worth submitting.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {collection.map(c => {
          const r9 = calcGradROI(c, 9), r10 = calcGradROI(c, 10);
          const worthy = r10.net > 50 || r9.net > 30;
          return (
            <div key={c.id} style={{ background: C.surface, border: `1px solid ${worthy ? C.yellow + "55" : C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <img src={c.image} alt="" style={{ width: 42, height: 58, objectFit: "contain", borderRadius: 3, background: C.bg }} />
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: C.textSub, background: C.bg, padding: "2px 7px", borderRadius: 4 }}>{c.condition}</span>
                    {worthy && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: C.yellow, background: C.yellow + "18", padding: "2px 7px", borderRadius: 4 }}>✓ Worth grading</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ grade: "PSA 9", val: r9.psaVal, net: r9.net }, { grade: "PSA 10", val: r10.psaVal, net: r10.net }].map(({ grade, val, net }) => (
                  <div key={grade} style={{ background: C.bg, borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.64rem", color: C.textSub, fontWeight: 600, marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{grade}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.yellow, marginBottom: 8 }}>{fmtPriceExact(val)}</div>
                    <div style={{ fontSize: "0.62rem", color: C.textMuted, marginBottom: 4 }}>Net after fees</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: net > 0 ? C.green : C.red }}>{net >= 0 ? "+" : "-"}{fmtPriceExact(Math.abs(net))}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Builder Tab ──────────────────────────────────────────────────────────────
// Progress bar showing how close a goal card's current price is to the target.
// Fill is 100% when at-or-below target, shrinks as overage grows, capped at 50%
// above target. Color shifts green → yellow → amber → red.
function GoalProgress({ targetPrice, currentPrice }) {
  const overage = (currentPrice - targetPrice) / targetPrice;
  const at = currentPrice <= targetPrice;
  const progress = Math.max(0, Math.min(100, (1 - Math.max(0, overage) / 0.5) * 100));

  let color, label;
  if (at) {
    color = C.green;
    const delta = ((targetPrice - currentPrice) / targetPrice) * 100;
    label = delta > 0.5 ? `${delta.toFixed(0)}% below target — steal deal` : "At target — buy now!";
  } else if (overage < 0.05) {
    color = C.yellow;
    label = `${(overage * 100).toFixed(0)}% over — almost there`;
  } else if (overage < 0.2) {
    color = "#f5a524";
    label = `${(overage * 100).toFixed(0)}% over target`;
  } else {
    color = C.red;
    const over = overage * 100;
    label = over > 50 ? "50%+ over — long wait" : `${over.toFixed(0)}% over target`;
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: color, transition: "width 0.4s ease, background 0.2s" }} />
      </div>
      <div style={{ fontSize: "0.66rem", color, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function BuilderTab({ wishlist, onRemoveWish, onAddWish, onUpdateWish, plan, onUpgrade }) {
  const { fmtPriceExact } = useCurrency();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [alertGoalId, setAlertGoalId] = useState(null);
  const alertGoal = alertGoalId != null ? wishlist.find(g => g.id === alertGoalId) : null;
  const totalChannels = wishlist.reduce((s, g) => s + alertChannelCount(g.alert), 0);
  const configuredAlerts = wishlist.filter(g => g.alert && alertChannelCount(g.alert) === 0).length;
  const activeAlertGoals = wishlist.filter(g => alertChannelCount(g.alert) > 0).length;
  const goalsWithAnyAlert = wishlist.filter(g => g.alert).length;
  const FREE_ALERT_LIMIT = 3;
  const isFree = plan !== "pro";
  const alertsRemaining = isFree ? Math.max(0, FREE_ALERT_LIMIT - goalsWithAnyAlert) : Infinity;

  function tryOpenAlert(goal) {
    // Free users can edit existing alerts freely; they just can't create new ones past the limit
    if (isFree && !goal.alert && goalsWithAnyAlert >= FREE_ALERT_LIMIT) {
      onUpgrade();
      return;
    }
    setAlertGoalId(goal.id);
  }

  return (
    <div>
      {alertGoal && (
        <AlertSetupModal
          goal={alertGoal}
          onClose={() => setAlertGoalId(null)}
          onSave={(alert) => onUpdateWish(alertGoal.id, { alert })}
        />
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 16 }}>🎯 Add card to goal list</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Card name…" style={{ ...inp, flex: 2, minWidth: 180 }} />
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target price ($)" type="number" style={{ ...inp, flex: 1, minWidth: 120 }} />
          <button onClick={() => { if (!name || !target) return; onAddWish({ id: Date.now(), name, set: "—", targetPrice: parseFloat(target), currentPrice: parseFloat(target) * 1.3, image: null }); setName(""); setTarget(""); }}
            style={{ background: C.blue + "22", border: `1px solid ${C.blue}55`, color: C.blue, padding: "10px 18px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Add</button>
        </div>
      </div>

      {/* Alert summary */}
      {wishlist.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.62rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Alerts:</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: totalChannels > 0 ? C.green : C.textSub, background: (totalChannels > 0 ? C.green : C.textSub) + "14", padding: "4px 10px", borderRadius: 99 }}>
            🔔 {activeAlertGoals} {activeAlertGoals === 1 ? "goal" : "goals"} · {totalChannels} {totalChannels === 1 ? "channel" : "channels"}
          </span>
          {configuredAlerts > 0 && (
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: C.yellow, background: C.yellow + "14", padding: "4px 10px", borderRadius: 99 }}>
              ⚠ {configuredAlerts} need activation
            </span>
          )}
          {isFree && (
            <button onClick={onUpgrade} style={{
              fontSize: "0.7rem", fontWeight: 700,
              color: alertsRemaining === 0 ? C.purple : C.textSub,
              background: alertsRemaining === 0 ? C.purple + "14" : "transparent",
              border: `1px ${alertsRemaining === 0 ? "solid" : "dashed"} ${alertsRemaining === 0 ? C.purple + "55" : C.border}`,
              padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "'Inter',sans-serif",
            }}>
              {alertsRemaining === 0
                ? "Free limit reached · Upgrade for unlimited ✨"
                : `Free plan · ${alertsRemaining} of ${FREE_ALERT_LIMIT} remaining`}
            </button>
          )}
          {wishlist.length - activeAlertGoals - configuredAlerts > 0 && (
            <span style={{ fontSize: "0.72rem", color: C.textSub, background: C.surface, border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 99 }}>
              {wishlist.length - activeAlertGoals - configuredAlerts} unconfigured
            </span>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {wishlist.map(c => {
          const diff = c.currentPrice - c.targetPrice, at = diff <= 0;
          const alert = c.alert;
          return (
            <div key={c.id} style={{ background: C.surface, border: `1px solid ${at ? C.green + "55" : C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                {c.image && <img src={c.image} alt="" style={{ width: 38, height: 52, objectFit: "contain", borderRadius: 3, background: C.bg }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  {at
                    ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: C.green, background: C.green + "18", padding: "2px 7px", borderRadius: 4 }}>🎯 At target</span>
                    : <span style={{ fontSize: "0.7rem", fontWeight: 600, color: C.red, background: C.red + "12", padding: "2px 7px", borderRadius: 4 }}>+{fmtPriceExact(diff)} over</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[{ l: "Your Target", v: fmtPriceExact(c.targetPrice), col: C.blue }, { l: "Current", v: fmtPriceExact(c.currentPrice), col: at ? C.green : C.red }].map(({ l, v, col }) => (
                  <div key={l} style={{ background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: "0.64rem", color: C.textSub, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: col }}>{v}</div>
                  </div>
                ))}
              </div>
              <GoalProgress targetPrice={c.targetPrice} currentPrice={c.currentPrice} />

              {/* Alert status row */}
              {(() => {
                const channels = alertChannelCount(alert);
                const color = !alert ? C.textSub : channels === 0 ? C.yellow : C.green;
                const bg = !alert ? "transparent" : channels === 0 ? C.yellow + "10" : C.green + "10";
                const borderStyle = !alert ? "dashed" : "solid";
                const label = !alert ? "🔕 No alerts set"
                  : channels === 0 ? "⚠ Configured — activate channels"
                  : `🔔 Active on ${channels} ${channels === 1 ? "channel" : "channels"}`;
                return (
                  <button onClick={() => tryOpenAlert(c)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    background: bg, border: `1px ${borderStyle} ${color}44`, color,
                    padding: "9px 12px", borderRadius: 10, fontSize: "0.74rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "'Inter',sans-serif", marginBottom: 12,
                    transition: "all 0.15s",
                  }}>
                    <span>{label}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{!alert ? (isFree && alertsRemaining === 0 ? "Pro ✨" : "Set up →") : "Edit →"}</span>
                  </button>
                );
              })()}

              <div style={{ fontSize: "0.58rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Shop this card</div>
              <div style={{ marginBottom: 10 }}>
                <BuyLinks card={c} size="lg" />
              </div>
              <button onClick={() => onRemoveWish(c.id)} style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, padding: "8px 12px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Remove from goals</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Flip Tab ─────────────────────────────────────────────────────────────────
function FlipTab({ collection, plan, onUpgrade }) {
  const { fmtPriceExact } = useCurrency();
  const [shareCard, setShareCard] = useState(null);
  const allFlippable = collection.filter(c => calcFlipProfit(c) > 5).sort((a, b) => calcFlipProfit(b) - calcFlipProfit(a));
  const FREE_FLIP_LIMIT = 3;
  const isFree = plan !== "pro";
  const flippable = isFree ? allFlippable.slice(0, FREE_FLIP_LIMIT) : allFlippable;
  const hiddenCount = isFree ? Math.max(0, allFlippable.length - FREE_FLIP_LIMIT) : 0;
  return (
    <div>
      {shareCard && <ShareFBModal card={shareCard} onClose={() => setShareCard(null)} />}
      <div style={{ background: C.yellow + "10", border: `1px solid ${C.yellow}30`, borderRadius: 12, padding: 14, marginBottom: 18, fontSize: "0.8rem", color: C.text, lineHeight: 1.6 }}>
        ⚡ Cards <strong>you already own</strong> that could sell for profit today, ranked by <strong>net profit</strong> after eBay fees ({(EBAY_FEE * 100).toFixed(1)}%) and shipping ($4.50).
        <div style={{ fontSize: "0.72rem", color: C.textSub, marginTop: 6, lineHeight: 1.5 }}>
          Channel fees compared: <strong style={{ color: C.green }}>eBay ~13.4%</strong> · <strong style={{ color: TCG_COLOR }}>TCGplayer ~10.25%</strong> · <strong style={{ color: "#5b9dff" }}>Facebook 0% local / ~5% shipped</strong>
        </div>
      </div>
      {!flippable.length
        ? <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: "1.8rem", marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: C.text, marginBottom: 8 }}>No flip opportunities right now</div>
          <div style={{ fontSize: "0.78rem", color: C.textSub }}>Check back as prices update — cards need &gt;$5 profit to show here.</div>
        </div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {flippable.map(c => {
            const profit = calcFlipProfit(c);
            const roi = ((profit / c.purchasePrice) * 100).toFixed(0);
            return (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.green + "33"}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                  <img src={c.image} alt="" style={{ width: 38, height: 52, objectFit: "contain", borderRadius: 3, background: C.bg }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 4 }}>{c.name}</div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: C.green, background: C.green + "18", padding: "2px 7px", borderRadius: 4 }}>+{roi}% ROI</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[{ l: "You Paid", v: fmtPriceExact(c.purchasePrice), col: C.textSub },
                    { l: "Sell For", v: fmtPriceExact(c.currentPrice), col: C.text },
                    { l: "Net Profit", v: fmtPriceExact(profit), col: C.green }].map(({ l, v, col }) => (
                    <div key={l} style={{ background: C.bg, borderRadius: 9, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: C.textMuted, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: col }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(c.name + " " + c.set)}&LH_Sold=1&LH_Complete=1`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: C.green + "18", border: `1px solid ${C.green}33`, color: C.green, padding: "9px 6px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600, textDecoration: "none", textAlign: "center", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>eBay →</a>
                  <a href={`https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(c.name + " " + c.set)}`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: TCG_COLOR + "18", border: `1px solid ${TCG_COLOR}44`, color: TCG_COLOR, padding: "9px 6px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600, textDecoration: "none", textAlign: "center", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>TCGplayer →</a>
                  <button onClick={() => setShareCard(c)}
                    style={{ flex: 1, background: FB_BLUE + "18", border: `1px solid ${FB_BLUE}44`, color: "#5b9dff", padding: "9px 6px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>
                    📘 Facebook
                  </button>
                </div>
                <div style={{ fontSize: "0.6rem", color: C.textMuted, marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>
                  TCGplayer selling requires US bank + TIN · eBay & Facebook work worldwide
                </div>
              </div>
            );
          })}
        </div>
      }
      {hiddenCount > 0 && (
        <div style={{
          marginTop: 16,
          background: `linear-gradient(135deg, ${C.purple}14, ${C.surface})`,
          border: `1px solid ${C.purple}44`,
          borderRadius: 14, padding: 18,
          display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
        }}>
          <div style={{ fontSize: "1.8rem" }}>✨</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "0.6rem", color: C.purple, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Pro feature</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {hiddenCount} more flip {hiddenCount === 1 ? "opportunity" : "opportunities"} hidden
            </div>
            <div style={{ fontSize: "0.75rem", color: C.textSub, lineHeight: 1.5 }}>
              Free plan shows the top {FREE_FLIP_LIMIT}. Pro unlocks every flippable card you own, ranked by real net profit.
            </div>
          </div>
          <button onClick={onUpgrade} style={{
            background: C.purple + "22", border: `1px solid ${C.purple}66`, color: C.purple,
            padding: "11px 20px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
            cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap",
          }}>Upgrade to Pro</button>
        </div>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

// Small pill button that shows "✓ Copied" feedback for 2s after click.
function CopyButton({ text, label = "Copy", compact = false }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { copyText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        background: copied ? C.green + "22" : C.bg,
        border: `1px solid ${copied ? C.green + "55" : C.border}`,
        color: copied ? C.green : C.textSub,
        padding: compact ? "4px 10px" : "7px 12px",
        borderRadius: 6,
        fontSize: compact ? "0.66rem" : "0.72rem",
        fontWeight: 600, cursor: "pointer",
        fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textSub, cursor: "pointer", fontSize: "1.2rem", padding: 4 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Explains the intrinsic value model to curious users. Linked from the filter
// row near the "Undervalued" chip. Kept concise — one screen, no scrolling on
// desktop, minimal scrolling on mobile. Honest about what the model can and
// can't do so we build trust rather than overselling.
function ModelInfoModal({ onClose }) {
  const p = { fontSize: "0.82rem", color: C.textSub, lineHeight: 1.55, marginBottom: 14 };
  const h = { fontSize: "0.72rem", color: C.text, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, marginTop: 18 };
  const code = { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: C.green, background: C.bg, padding: "8px 10px", borderRadius: 6, display: "block", margin: "6px 0 10px", border: `1px solid ${C.border}` };
  return (
    <Modal onClose={onClose} title="📊 How the valuation model works">
      <p style={p}>
        Catch'em scores every card on two factors and compares the combined score to the current market price. When the two diverge significantly, we flag it.
      </p>

      <div style={h}>Scarcity score (1–10)</div>
      <p style={p}>
        How hard it is to get the card. Built from rarity tier (Special Illustration Rare &gt; Illustration Rare &gt; Ultra Rare) and set status (vintage, long-rotated, out-of-print, heavy-reprint).
      </p>

      <div style={h}>Desirability score (1–10)</div>
      <p style={p}>
        How much people want the card. 60% character premium (Charizard, Umbreon, Pikachu rank highest), 40% art-tier weight (SIRs and IRs are the art-focused rarities).
      </p>

      <div style={h}>The math</div>
      <code style={code}>
        intrinsic = $10 × 1.45<sup>(scarcity−5)</sup> × 1.68<sup>(desirability−5)</sup>
      </code>
      <p style={p}>
        Desirability is ~1.5× more impactful than scarcity, matching how collectors actually price cards.
      </p>

      <div style={h}>How to read the signals</div>
      <p style={p}>
        <span style={{ color: C.green, fontWeight: 600 }}>↓ $X model</span> — market is below what fundamentals suggest. Potential hidden value.<br/>
        <span style={{ color: C.amber, fontWeight: 600 }}>↑ $X model</span> — market is above fundamentals. Paying for momentum or hype.<br/>
        No chip — market and model agree. Fair value.
      </p>

      <div style={h}>What this model <em>doesn't</em> capture</div>
      <p style={{ ...p, marginBottom: 4 }}>
        Short-term hype cycles, social-media virality, tournament meta shifts, Pokémon Center exclusivity, and raw sales velocity. Use the model as one input alongside rotation status and your own judgment — not as a buy/sell oracle.
      </p>
    </Modal>
  );
}

// ShareFBModal: generates a Facebook-optimized listing and lets the user open
// Marketplace or relevant groups with the listing pre-copied to clipboard.
function ShareFBModal({ card, onClose }) {
  const listing = generateFBListing(card);
  const fullListing = `${listing.title}\n\n${listing.description}`;

  function openWithCopy(url) {
    copyText(fullListing);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const sectionLabel = { fontSize: "0.68rem", color: C.textSub, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 };

  return (
    <Modal onClose={onClose} title="📘 Share to Facebook">
      {/* Card summary */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, padding: 12, background: C.bg, borderRadius: 12 }}>
        <img src={card.image} alt="" style={{ width: 42, height: 58, objectFit: "contain", borderRadius: 3, background: C.bg }} />
        <div>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 3 }}>{card.name}</div>
          <div style={{ fontSize: "0.72rem", color: C.textSub }}>{card.set} · {card.condition} · ${card.currentPrice.toFixed(0)}</div>
        </div>
      </div>

      {/* Heads up */}
      <div style={{ background: FB_BLUE + "12", border: `1px solid ${FB_BLUE}33`, borderRadius: 10, padding: 12, marginBottom: 18, fontSize: "0.74rem", color: C.textSub, lineHeight: 1.55 }}>
        💡 Facebook doesn't allow auto-posting to Marketplace. We've generated a ready-to-paste listing — tap any channel below and we'll copy it to your clipboard so you just paste and submit.
      </div>

      {/* Generated listing */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={sectionLabel}>Your listing</div>
          <CopyButton text={fullListing} label="Copy all" compact />
        </div>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
              <div style={{ fontSize: "0.62rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Title</div>
              <CopyButton text={listing.title} compact />
            </div>
            <div style={{ fontSize: "0.82rem", color: C.text, fontWeight: 600, lineHeight: 1.4 }}>{listing.title}</div>
          </div>
          <div style={{ height: 1, background: C.border, marginBottom: 12 }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
              <div style={{ fontSize: "0.62rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Description</div>
              <CopyButton text={listing.description} compact />
            </div>
            <div style={{ fontSize: "0.76rem", color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{listing.description}</div>
          </div>
        </div>
      </div>

      {/* Marketplace CTA */}
      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>Post to Marketplace</div>
        <button
          onClick={() => openWithCopy("https://www.facebook.com/marketplace/create/item")}
          style={{
            width: "100%", background: FB_BLUE + "22", border: `1px solid ${FB_BLUE}66`,
            color: "#5b9dff", padding: "12px 16px", borderRadius: 10,
            fontSize: "0.84rem", fontWeight: 700, cursor: "pointer",
            fontFamily: "'Inter',sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = FB_BLUE + "33"; }}
          onMouseLeave={e => { e.currentTarget.style.background = FB_BLUE + "22"; }}
        >
          <span style={{ fontSize: "1rem" }}>📘</span> Open Facebook Marketplace →
        </button>
        <div style={{ fontSize: "0.64rem", color: C.textMuted, marginTop: 6, textAlign: "center" }}>Listing auto-copies to clipboard</div>
      </div>

      {/* Groups */}
      <div>
        <div style={sectionLabel}>Or share in a Pokémon group</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FB_GROUPS.map(g => (
            <button
              key={g.name}
              onClick={() => openWithCopy(`https://www.facebook.com/search/groups/?q=${encodeURIComponent(g.query)}`)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
                padding: "11px 14px", cursor: "pointer",
                fontFamily: "'Inter',sans-serif", textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = FB_BLUE + "55"; e.currentTarget.style.background = FB_BLUE + "08"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text, marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: "0.68rem", color: C.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.desc}</div>
              </div>
              <span style={{ color: "#5b9dff", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>Find →</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.64rem", color: C.textMuted, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
          Opens a Facebook group search — join the one that fits, then paste your listing.
        </div>
      </div>
    </Modal>
  );
}

// ─── Scanner Modal ────────────────────────────────────────────────────────────
// Full-screen modal that opens the camera, captures a card, runs a (demo) scan,
// then shows a full breakdown with buy links and add-to-collection actions.
// Mobile-first: designed primarily for phone use where scanning makes sense.
function ScannerModal({ onClose, onAddToCollection, onAddToGoal, marketCards }) {
  const { fmtPrice } = useCurrency();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stage, setStage] = useState("camera"); // camera | scanning | result
  const [cameraStatus, setCameraStatus] = useState("pending"); // pending | ready | denied
  const [captured, setCaptured] = useState(null);
  const [identified, setIdentified] = useState(null);
  const { isMobile } = useWindowSize();
  const pool = (marketCards && marketCards.length) ? marketCards : MARKET_CARDS;

  // Start / stop camera when stage changes
  useEffect(() => {
    let cancelled = false;
    if (stage === "camera") {
      (async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraStatus("denied"); return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } }
          });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCameraStatus("ready");
        } catch (err) {
          setCameraStatus("denied");
        }
      })();
    }
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [stage]);

  function capture() {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    runScan();
  }

  function onFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setCaptured(r.result); runScan(); };
    r.readAsDataURL(file);
  }

  // Demo recognition: picks a random card from the market catalog after a delay.
  // When real recognition is wired up (Pokémon TCG API / custom CV model),
  // swap this function for the real API call. UI stays the same.
  function runScan() {
    setStage("scanning");
    setTimeout(() => {
      const card = pool[Math.floor(Math.random() * pool.length)];
      setIdentified(card);
      setStage("result");
    }, 1600);
  }

  function demoScan() {
    const card = pool[Math.floor(Math.random() * pool.length)];
    setCaptured(card.image);
    setStage("scanning");
    setTimeout(() => { setIdentified(card); setStage("result"); }, 1200);
  }

  function reset() {
    setCaptured(null);
    setIdentified(null);
    setStage("camera");
  }

  function addToCollection() {
    if (!identified) return;
    onAddToCollection({
      id: Date.now(),
      name: identified.name,
      set: identified.set,
      number: "—",
      condition: "NM",
      quantity: 1,
      purchasePrice: identified.price,
      currentPrice: identified.price,
      rawPSA9: Math.round(identified.price * 1.6),
      rawPSA10: Math.round(identified.price * 2.8),
      image: identified.image,
    });
    onClose();
  }

  function addToGoal() {
    if (!identified) return;
    onAddToGoal({
      id: Date.now(),
      name: identified.name,
      set: identified.set,
      targetPrice: Math.round(identified.price * 0.9),
      currentPrice: identified.price,
      image: identified.image,
    });
    onClose();
  }

  const stageTitle = { camera: "📷 Scan a Card", scanning: "🔍 Analyzing...", result: "✨ Card Found" }[stage];
  const primaryBtn = { padding: "12px 16px", borderRadius: 10, fontSize: "0.86rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", border: "none", transition: "all 0.15s" };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 1000, display: "flex", flexDirection: "column", fontFamily: "'Inter',sans-serif" }}>
      <style>{`@keyframes scanline{0%{top:0}100%{top:calc(100% - 3px)}}@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>

      {/* Modal header */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.98rem", fontWeight: 700, color: C.text }}>{stageTitle}</div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textSub, cursor: "pointer", fontSize: "1.5rem", padding: 4, lineHeight: 1 }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 14 : 20 }}>

        {/* Camera stage */}
        {stage === "camera" && (
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            {cameraStatus === "ready" && (
              <>
                <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", background: "#000", marginBottom: 16 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {/* Corner guides */}
                  <div style={{ position: "absolute", inset: 20, pointerEvents: "none" }}>
                    {[["tl", 0, 0, 1, 0, 1, 0], ["tr", 0, 0, 0, 1, 1, 0], ["bl", 0, 0, 1, 0, 0, 1], ["br", 0, 0, 0, 1, 0, 1]].map(([k, _a, _b, l, r, t, bot]) => (
                      <div key={k} style={{
                        position: "absolute",
                        [t ? "top" : "bottom"]: 0,
                        [l ? "left" : "right"]: 0,
                        width: 32, height: 32,
                        borderTop: t ? `3px solid ${C.green}` : "none",
                        borderBottom: bot ? `3px solid ${C.green}` : "none",
                        borderLeft: l ? `3px solid ${C.green}` : "none",
                        borderRight: r ? `3px solid ${C.green}` : "none",
                        borderRadius: 4,
                      }} />
                    ))}
                  </div>
                  <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.5)", padding: "6px 10px", borderRadius: 8 }}>
                    Fill the frame with the card · hold steady
                  </div>
                </div>
                <button onClick={capture} style={{ ...primaryBtn, width: "100%", background: C.green + "22", border: `1px solid ${C.green}66`, color: C.green, marginBottom: 10 }}>
                  📸 Capture & Scan
                </button>
              </>
            )}

            {cameraStatus === "pending" && (
              <div style={{ aspectRatio: "3/4", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: C.textSub, fontSize: "0.85rem" }}>
                Requesting camera access...
              </div>
            )}

            {cameraStatus === "denied" && (
              <div style={{ aspectRatio: "3/4", borderRadius: 16, background: C.surface, border: `1px dashed ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>📷</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: C.text, marginBottom: 8 }}>Camera unavailable</div>
                <div style={{ fontSize: "0.76rem", color: C.textSub, lineHeight: 1.5, maxWidth: 260 }}>Enable camera permissions, upload a photo, or try a demo scan below.</div>
              </div>
            )}

            {/* Alternatives */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePick} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...primaryBtn, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 600 }}>
                📁 Upload Photo
              </button>
              <button onClick={demoScan} style={{ ...primaryBtn, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 600 }}>
                ⚡ Demo Scan
              </button>
            </div>
            <div style={{ fontSize: "0.66rem", color: C.textMuted, marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
              Demo mode: we're simulating card recognition. Real recognition via<br />Pokémon TCG API coming in the next update.
            </div>
          </div>
        )}

        {/* Scanning stage */}
        {stage === "scanning" && (
          <div style={{ maxWidth: 360, margin: "0 auto", textAlign: "center" }}>
            <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", marginBottom: 20, background: C.surface }}>
              {captured && <img src={captured} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`, boxShadow: `0 0 16px ${C.green}`, animation: "scanline 1.4s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.4) 100%)` }} />
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, marginBottom: 6, animation: "pulse 1.4s ease-in-out infinite" }}>Analyzing card details...</div>
            <div style={{ fontSize: "0.76rem", color: C.textSub }}>Matching against 12k+ cards in our catalog</div>
          </div>
        )}

        {/* Result stage */}
        {stage === "result" && identified && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            {/* Match confidence banner */}
            <div style={{ background: C.green + "14", border: `1px solid ${C.green}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.78rem", color: C.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              ✓ Match found <span style={{ color: C.textSub, fontWeight: 400 }}>· 94% confidence</span>
            </div>

            {/* Card hero */}
            <div style={{ display: "flex", gap: 16, marginBottom: 20, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "center" : "flex-start" }}>
              <img src={identified.image} alt="" style={{ width: isMobile ? 140 : 120, aspectRatio: "5/7", objectFit: "contain", borderRadius: 6, background: C.surface, flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: isMobile ? "center" : "left", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: isMobile ? "center" : "flex-start", flexWrap: "wrap" }}>
                  <TypeChip type={identified.type} subtype={identified.subtype} /> <SetStatusChip card={identified} />
                  {identified.supplyTrend === "declining" && <span style={{ fontSize: "0.6rem", fontWeight: 600, color: C.yellow, background: C.yellow + "18", padding: "2px 6px", borderRadius: 4 }}>Supply dropping</span>}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.text, marginBottom: 4, lineHeight: 1.2 }}>{identified.name}</div>
                <div style={{ fontSize: "0.8rem", color: C.textSub, marginBottom: 12 }}>{identified.set}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: C.text, letterSpacing: "-0.02em", fontFamily: "'Inter',sans-serif" }}>{fmtPrice(identified.price)}</div>
                <div style={{ fontSize: "0.72rem", color: C.textSub, marginTop: 2 }}>Current market · Near Mint</div>
              </div>
            </div>

            {/* Price changes */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {[{ l: "7d", v: identified.change7d }, { l: "30d", v: identified.change30d }, { l: "90d", v: identified.change90d }].map(({ l, v }) => (
                <div key={l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.6rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                  <Change val={v} />
                </div>
              ))}
            </div>

            {/* Scores row */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: "0.66rem", color: C.textSub, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Catch'em Scores</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {Object.values(MODES).map(m => (
                  <div key={m.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>{m.emoji}</div>
                    <div style={{ fontSize: "0.62rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{m.label}</div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <ScorePill score={identified[m.sortKey]} isActive={true} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Liquidity + gem rate */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: "0.6rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Liquidity</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: identified.liquidity >= 75 ? C.green : identified.liquidity >= 50 ? C.yellow : C.red }}>{identified.liquidity}/100</div>
                <div style={{ fontSize: "0.66rem", color: C.textSub, marginTop: 2 }}>{identified.liquidity >= 75 ? "Sells fast" : identified.liquidity >= 50 ? "Moderate demand" : "Slower mover"}</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: "0.6rem", color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>PSA 10 Gem Rate</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: identified.gemRate == null ? C.textMuted : identified.gemRate <= 15 ? C.purple : C.text }}>
                  {identified.gemRate == null ? "—" : `${identified.gemRate}%`}
                </div>
                <div style={{ fontSize: "0.66rem", color: C.textSub, marginTop: 2 }}>
                  {identified.gemRate == null ? "Not typically graded" : identified.gemRate <= 15 ? "Rare — tough to gem" : "Common gem"}
                </div>
              </div>
            </div>

            {/* Grading predictor placeholder */}
            <div style={{ background: `linear-gradient(135deg, ${C.purple}12, transparent)`, border: `1px dashed ${C.purple}44`, borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: "1.6rem" }}>🎯</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.text, marginBottom: 2 }}>Grade Predictor</div>
                <div style={{ fontSize: "0.7rem", color: C.textSub, lineHeight: 1.4 }}>Estimate PSA grade from your scan photo. Coming in the next update.</div>
              </div>
              <span style={{ fontSize: "0.62rem", fontWeight: 700, color: C.purple, background: C.purple + "18", padding: "4px 8px", borderRadius: 5, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Soon</span>
            </div>

            {/* Buy links */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.66rem", color: C.textSub, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Shop this card</div>
              <BuyLinks card={identified} size="lg" />
            </div>

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <button onClick={addToCollection} style={{ ...primaryBtn, background: C.green + "22", border: `1px solid ${C.green}55`, color: C.green }}>
                + Add to Collection
              </button>
              <button onClick={addToGoal} style={{ ...primaryBtn, background: C.blue + "22", border: `1px solid ${C.blue}55`, color: C.blue }}>
                🎯 Add to Goals
              </button>
            </div>
            <button onClick={reset} style={{ ...primaryBtn, width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontWeight: 600 }}>
              Scan Another Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alert Setup Modal ───────────────────────────────────────────────────────
// Per-goal Facebook alert configuration. We generate an optimized FB search URL
// and the user activates FB's native "notify me" feature (bell icon) on that
// page. See comment on alert helpers above for why this is the honest approach.
function AlertSetupModal({ goal, onClose, onSave }) {
  const { fmtPriceExact } = useCurrency();
  const initial = goal.alert || defaultAlert(goal);
  const [cfg, setCfg] = useState(initial);
  const [altInput, setAltInput] = useState("");
  const update = (patch) => setCfg(c => ({ ...c, ...patch }));
  const fbUrl = buildFBMarketplaceUrl(goal, cfg);
  const groupsUrl = buildFBGroupsUrl(goal, cfg);
  const ebayUrl = buildEbayUrl(goal, cfg);
  const tcgUrl = buildTCGplayerUrl(goal, cfg);
  const fbSaved = !!(cfg.fbSaved || cfg.savedOnFB);

  const conditionOpts = [
    { k: "NM", l: "Near Mint" }, { k: "LP", l: "Lightly Played" },
    { k: "MP", l: "Moderately Played" }, { k: "HP", l: "Heavily Played" }, { k: "DMG", l: "Damaged" },
  ];
  const gradeOpts = ["PSA 10", "PSA 9", "PSA 8", "BGS 10", "BGS 9.5", "BGS 9", "CGC 10", "CGC 9.5"];

  function toggle(key, value) {
    const list = cfg[key] || [];
    const next = list.includes(value) ? list.filter(x => x !== value) : [...list, value];
    update({ [key]: next });
  }

  function addAltTerm() {
    const t = altInput.trim();
    if (!t) return;
    update({ altTerms: [...(cfg.altTerms || []), t] });
    setAltInput("");
  }

  function openChannel(url, channelKey) {
    window.open(url, "_blank", "noopener,noreferrer");
    onSave(cfg);
  }

  function toggleSaved(channelKey) {
    const next = { ...cfg, [channelKey]: !cfg[channelKey], lastUpdated: Date.now() };
    // migrate legacy savedOnFB -> fbSaved on first write
    if (channelKey === "fbSaved") delete next.savedOnFB;
    setCfg(next);
    onSave(next);
  }

  const sectionLabel = { fontSize: "0.62rem", color: C.textSub, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 };
  const checkboxRow = (checked, label, onClick, hint) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      background: checked ? C.blue + "14" : C.bg,
      border: `1px solid ${checked ? C.blue + "55" : C.border}`,
      padding: "10px 12px", borderRadius: 8, cursor: "pointer",
      fontFamily: "'Inter',sans-serif", transition: "all 0.12s",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked ? C.blue : C.border}`,
        background: checked ? C.blue : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "0.7rem", fontWeight: 900,
      }}>{checked ? "✓" : ""}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text }}>{label}</div>
        {hint && <div style={{ fontSize: "0.68rem", color: C.textSub, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
    </button>
  );

  return (
    <Modal onClose={onClose} title="🔔 Set up Facebook alert">
      {/* Goal header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, padding: 12, background: C.bg, borderRadius: 12 }}>
        {goal.image && <img src={goal.image} alt="" style={{ width: 42, height: 58, objectFit: "contain", borderRadius: 3, background: C.bg }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, marginBottom: 3 }}>{goal.name}</div>
          <div style={{ fontSize: "0.7rem", color: C.textSub }}>Target {fmtPriceExact(goal.targetPrice)} · Current {fmtPriceExact(goal.currentPrice)}</div>
        </div>
      </div>

      {/* Reality check banner */}
      <div style={{ background: FB_BLUE + "10", border: `1px solid ${FB_BLUE}30`, borderRadius: 10, padding: 12, marginBottom: 18, fontSize: "0.72rem", color: C.textSub, lineHeight: 1.55 }}>
        💡 Facebook doesn't let third-party tools watch listings. But FB's own Marketplace has a built-in "notify me" bell — we generate the perfect pre-filtered search, you tap the bell on FB, you get the alerts.
      </div>

      {/* Product type */}
      <div style={sectionLabel}>What kind of listing?</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 18 }}>
        {[{ k: "single", l: "Raw Single" }, { k: "graded", l: "Graded Slab" }, { k: "sealed", l: "Sealed Product" }].map(({ k, l }) => (
          <button key={k} onClick={() => update({ productType: k })} style={{
            background: cfg.productType === k ? C.blue + "22" : C.bg,
            border: `1px solid ${cfg.productType === k ? C.blue + "66" : C.border}`,
            color: cfg.productType === k ? C.blue : C.text,
            padding: "10px 8px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "'Inter',sans-serif",
          }}>{l}</button>
        ))}
      </div>

      {/* Max price */}
      <div style={sectionLabel}>Max price you'll accept</div>
      <div style={{ position: "relative", marginBottom: 18 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textSub, fontWeight: 700 }}>$</span>
        <input type="number" value={cfg.maxPrice} onChange={e => update({ maxPrice: Number(e.target.value) || 0 })}
          style={{ ...inp, paddingLeft: 28, fontSize: "1rem", fontWeight: 700 }} />
      </div>

      {/* Condition/grade picker */}
      {cfg.productType === "single" && (
        <>
          <div style={sectionLabel}>Acceptable conditions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {conditionOpts.map(({ k, l }) =>
              checkboxRow((cfg.conditions || []).includes(k), `${k} — ${l}`, () => toggle("conditions", k))
            )}
          </div>
          {checkboxRow(
            cfg.alertIfUnlisted,
            "Also alert when condition isn't listed",
            () => update({ alertIfUnlisted: !cfg.alertIfUnlisted }),
            "Recommended — most FB sellers skip this field. Turning this off will miss a lot of good deals from casual sellers."
          )}
          <div style={{ height: 18 }} />
        </>
      )}

      {cfg.productType === "graded" && (
        <>
          <div style={sectionLabel}>Acceptable grades</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {gradeOpts.map(g => {
              const on = (cfg.grades || []).includes(g);
              return (
                <button key={g} onClick={() => toggle("grades", g)} style={{
                  background: on ? C.purple + "22" : C.bg,
                  border: `1px solid ${on ? C.purple + "66" : C.border}`,
                  color: on ? C.purple : C.textSub,
                  padding: "7px 12px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Inter',sans-serif",
                }}>{g}</button>
              );
            })}
          </div>
        </>
      )}

      {cfg.productType === "sealed" && (
        <div style={{ background: C.yellow + "10", border: `1px solid ${C.yellow}30`, borderRadius: 10, padding: 12, marginBottom: 18, fontSize: "0.72rem", color: C.textSub, lineHeight: 1.55 }}>
          📦 Sealed means factory-sealed — no condition filter needed. We'll add the word "sealed" to your search to filter out opened/loose items.
        </div>
      )}

      {/* Alt search terms */}
      <div style={sectionLabel}>Alternative keywords (optional)</div>
      <div style={{ fontSize: "0.7rem", color: C.textSub, marginBottom: 8, lineHeight: 1.5 }}>
        Casual sellers misspell or shorten names. Add variants so you catch mislabeled listings — e.g. "umbreon alt" or "umbreon 215".
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={altInput} onChange={e => setAltInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAltTerm(); } }}
          placeholder="Alternative term..." style={{ ...inp, flex: 1 }} />
        <button onClick={addAltTerm} style={{ background: C.blue + "22", border: `1px solid ${C.blue}55`, color: C.blue, padding: "0 14px", borderRadius: 10, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Add</button>
      </div>
      {cfg.altTerms && cfg.altTerms.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {cfg.altTerms.map((t, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.border}`, padding: "5px 10px", borderRadius: 6, fontSize: "0.72rem", color: C.text, fontFamily: "'Inter',sans-serif" }}>
              {t}
              <button onClick={() => update({ altTerms: cfg.altTerms.filter((_, j) => j !== i) })}
                style={{ background: "transparent", border: "none", color: C.textSub, cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Activate across channels */}
      <div style={sectionLabel}>Activate alerts</div>
      <div style={{ fontSize: "0.7rem", color: C.textSub, marginBottom: 12, lineHeight: 1.55 }}>
        Each platform has its own native alert system. Activate as many as you want — more channels = more chances to catch a deal first.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[
          { key: "fb", color: FB_BLUE, icon: "📘", name: "Facebook Marketplace", blurb: "Tap the 🔔 bell icon on FB to save the search.", url: fbUrl, secondary: { label: "Also search FB Groups posts →", url: groupsUrl }, saved: fbSaved, savedKey: "fbSaved" },
          { key: "ebay", color: C.green, icon: "🛍️", name: "eBay Saved Search", blurb: "Most reliable. Click 'Save this search' on eBay → get email alerts.", url: ebayUrl, saved: !!cfg.ebaySaved, savedKey: "ebaySaved" },
          { key: "tcg", color: TCG_COLOR, icon: "🎴", name: "TCGplayer Price Alert", blurb: "Find your product → click 'Set Price Alert' on the product page.", url: tcgUrl, saved: !!cfg.tcgSaved, savedKey: "tcgSaved" },
        ].map(ch => (
          <div key={ch.key} style={{
            background: ch.saved ? ch.color + "10" : C.bg,
            border: `1px solid ${ch.saved ? ch.color + "55" : C.border}`,
            borderRadius: 12, padding: 12,
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>{ch.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.text }}>{ch.name}</div>
                <div style={{ fontSize: "0.68rem", color: C.textSub, marginTop: 2, lineHeight: 1.4 }}>{ch.blurb}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openChannel(ch.url, ch.savedKey)} style={{
                flex: 1, background: ch.color + "18", border: `1px solid ${ch.color}44`, color: ch.color,
                padding: "9px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap",
              }}>Open →</button>
              <button onClick={() => toggleSaved(ch.savedKey)} style={{
                flex: 1.2,
                background: ch.saved ? C.green + "22" : "transparent",
                border: `1px solid ${ch.saved ? C.green + "66" : C.border}`,
                color: ch.saved ? C.green : C.textSub,
                padding: "9px 12px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap",
              }}>{ch.saved ? "✓ Active" : "Mark as saved"}</button>
            </div>
            {ch.secondary && (
              <a href={ch.secondary.url} target="_blank" rel="noreferrer"
                style={{ display: "block", marginTop: 8, textAlign: "center", fontSize: "0.68rem", color: C.textSub, textDecoration: "underline", fontFamily: "'Inter',sans-serif" }}>
                {ch.secondary.label}
              </a>
            )}
          </div>
        ))}
      </div>

      <button onClick={onClose} style={{
        width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.text,
        padding: "12px 16px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "'Inter',sans-serif",
      }}>Done</button>
    </Modal>
  );
}

// ─── Plan / Pro Gating ───────────────────────────────────────────────────────
// The philosophy: free tier caps INTELLIGENCE, never your own data. Tracking
// your collection and goals is always unlimited. Pro unlocks tools that
// actively make or save you money — Grading ROI, full sell opportunities,
// unlimited alerts across channels.

const PLAN_FEATURES = {
  free: {
    label: "Free", price: "$0", accent: "#8888a0",
    includes: [
      "Unlimited portfolio tracking",
      "Unlimited goal list",
      "Market rankings & live catalog",
      "Buy links — eBay, TCGplayer, Facebook",
      "Card scanner (demo mode)",
      "Alerts on up to 3 goals",
      "Top 3 sell opportunities",
    ],
    excludes: [
      "Grading ROI calculator",
      "Full sell opportunity finder",
      "Unlimited alerts across channels",
    ],
  },
  pro: {
    label: "Pro", price: "$9", accent: "#c77dff",
    includes: [
      "Everything in Free",
      "Grading ROI calculator — PSA 9 & 10",
      "Full sell opportunity finder",
      "Unlimited alerts on every goal",
      "Card intelligence feed (soon)",
      "Supply & demand signals (soon)",
      "Grade predictor from photo (soon)",
    ],
    excludes: [],
  },
};

// Reusable lock that shows a CTA instead of gated content for free users.
function ProLock({ plan, onUpgrade, title, blurb, benefits = [] }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.purple}14, ${C.surface})`,
      border: `1px solid ${C.purple}44`,
      borderRadius: 14, padding: 24, textAlign: "center",
    }}>
      <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>✨</div>
      <div style={{ fontSize: "0.62rem", color: C.purple, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Pro feature</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.text, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: "0.82rem", color: C.textSub, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.55 }}>{blurb}</div>
      {benefits.length > 0 && (
        <div style={{ maxWidth: 380, margin: "0 auto 20px", textAlign: "left" }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, fontSize: "0.8rem", color: C.text, lineHeight: 1.5 }}>
              <span style={{ color: C.purple, fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={onUpgrade} style={{
        background: C.purple + "22", border: `1px solid ${C.purple}66`, color: C.purple,
        padding: "12px 28px", borderRadius: 10, fontSize: "0.86rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "'Inter',sans-serif",
      }}>Upgrade to Pro — $9/mo</button>
    </div>
  );
}

// ─── Currency selector ───────────────────────────────────────────────────────
// Native <select> styled to match the header button cluster. Uses the system
// picker on mobile (better UX than a custom dropdown) and a compact inline
// select on desktop. No external library needed.
function CurrencySelector({ compact = false }) {
  const { currency, setCurrency, rates } = useCurrency();
  const hasLiveRates = rates && Object.keys(rates).length > 0;
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      title={hasLiveRates ? "Live exchange rates · updated daily" : "Using fallback exchange rates"}>
      <select
        value={currency}
        onChange={e => setCurrency(e.target.value)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          background: C.surface,
          border: `1px solid ${C.border}`,
          color: C.textSub,
          padding: compact ? "7px 22px 7px 10px" : "7px 26px 7px 12px",
          borderRadius: 8,
          fontSize: "0.74rem",
          fontWeight: 600,
          fontFamily: "'Inter',sans-serif",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {Object.values(CURRENCIES).map(c => (
          <option key={c.code} value={c.code}>
            {compact ? c.code : `${c.symbol} ${c.code}`}
          </option>
        ))}
      </select>
      {/* Caret indicator */}
      <span style={{
        position: "absolute",
        right: 8,
        pointerEvents: "none",
        color: C.textMuted,
        fontSize: "0.58rem",
      }}>▾</span>
    </div>
  );
}

function PlanModal({ plan, onClose, onSetPlan }) {
  return (
    <Modal onClose={onClose} title="✨ Plans & Pricing">
      <div style={{ fontSize: "0.78rem", color: C.textSub, marginBottom: 20, lineHeight: 1.55 }}>
        Track everything you own and want — free, forever. Pay only for the intelligence that pays you back.
      </div>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {["free", "pro"].map(key => {
          const f = PLAN_FEATURES[key];
          const isCurrent = plan === key;
          const isPro = key === "pro";
          return (
            <div key={key} style={{
              background: isPro ? `linear-gradient(135deg, ${C.purple}10, ${C.surface})` : C.surface,
              border: `1.5px solid ${isCurrent ? f.accent + "88" : isPro ? C.purple + "44" : C.border}`,
              borderRadius: 14, padding: 18,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: f.accent, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
                    {f.label}{isPro && " ✨"}
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: C.text, lineHeight: 1 }}>
                    {f.price}<span style={{ fontSize: "0.8rem", color: C.textSub, fontWeight: 400 }}>/mo</span>
                  </div>
                </div>
                {isCurrent && (
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: C.green, background: C.green + "18", padding: "4px 10px", borderRadius: 99, letterSpacing: "0.08em", textTransform: "uppercase" }}>Current</span>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                {f.includes.map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6, fontSize: "0.78rem", color: C.text, lineHeight: 1.5 }}>
                    <span style={{ color: f.accent, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span>{b}</span>
                  </div>
                ))}
                {f.excludes.map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6, fontSize: "0.78rem", color: C.textMuted, lineHeight: 1.5 }}>
                    <span style={{ color: C.textMuted, flexShrink: 0 }}>✗</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              {!isCurrent && (
                <button onClick={() => { onSetPlan(key); onClose(); }} style={{
                  width: "100%",
                  background: isPro ? C.purple + "22" : C.bg,
                  border: `1px solid ${isPro ? C.purple + "66" : C.border}`,
                  color: isPro ? C.purple : C.text,
                  padding: "12px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Inter',sans-serif",
                }}>
                  {isPro ? "Upgrade to Pro" : "Switch to Free"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "0.66rem", color: C.textMuted, textAlign: "center", lineHeight: 1.6 }}>
        Demo mode — clicking Upgrade flips the plan immediately for testing.<br />
        Payment integration (Stripe) wires in when you're ready to launch.
      </div>
    </Modal>
  );
}

// Robust CSV parser: handles BOM, CRLF line endings, and quoted values with
// commas inside. Detects the columns we care about (name, price, set,
// condition, quantity) by keyword match against whatever header the export
// gives us.
function parseCSVText(text) {
  if (!text || !text.trim()) return { cards: [], error: "Paste some CSV text first." };

  // Strip UTF-8 BOM, normalize line endings, split
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { cards: [], error: "Need at least a header row and one card." };

  const parseRow = (line) => {
    const cols = []; let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) { cols.push(cur); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur);
    return cols.map(c => c.trim().replace(/^["']|["']$/g, ""));
  };

  const header = parseRow(lines[0]).map(h => h.toLowerCase());
  const findIdx = (...keywords) => {
    for (const kw of keywords) {
      const i = header.findIndex(h => h === kw || h.includes(kw));
      if (i !== -1) return i;
    }
    return -1;
  };

  const ni = findIdx("name", "card", "title");
  const pi = findIdx("price", "paid", "cost", "value", "market");
  const si = findIdx("set", "expansion", "series");
  const ci = findIdx("condition", "grade");
  const qi = findIdx("quantity", "qty", "count", "amount");
  const nbi = findIdx("number", "card #", "number");

  if (ni === -1) return { cards: [], error: "Couldn't find a card name column. Your CSV needs a header like 'name' or 'card'." };

  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (!cols[ni]) continue;
    const rawPrice = pi >= 0 ? (cols[pi] || "").replace(/[$€£,]/g, "") : "";
    const price = parseFloat(rawPrice) || 10;
    cards.push({
      id: Date.now() + i,
      name: cols[ni],
      set: (si >= 0 && cols[si]) ? cols[si] : "Imported",
      number: (nbi >= 0 && cols[nbi]) ? cols[nbi] : "—",
      condition: (ci >= 0 && cols[ci]) ? cols[ci] : "NM",
      quantity: qi >= 0 ? (parseInt(cols[qi]) || 1) : 1,
      purchasePrice: price,
      currentPrice: Math.round(price * 1.1 * 100) / 100,
      rawPSA9: Math.round(price * 1.5 * 100) / 100,
      rawPSA10: Math.round(price * 2.5 * 100) / 100,
      image: PH("Card", "6c8fff"),
    });
  }
  if (!cards.length) return { cards: [], error: "Couldn't find any cards in the CSV." };
  return { cards, detected: { name: header[ni], price: pi >= 0 ? header[pi] : null, set: si >= 0 ? header[si] : null, condition: ci >= 0 ? header[ci] : null, quantity: qi >= 0 ? header[qi] : null } };
}

function CSVModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef(null);

  function handleText(v) {
    setText(v);
    setParsed(v.trim() ? parseCSVText(v) : null);
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const content = String(reader.result || ""); handleText(content); };
    reader.onerror = () => setParsed({ cards: [], error: "Couldn't read that file. Try pasting the CSV text instead." });
    reader.readAsText(file);
  }

  function confirm() {
    if (!parsed || !parsed.cards || !parsed.cards.length) return;
    onImport(parsed.cards);
    onClose();
  }

  const count = parsed && parsed.cards ? parsed.cards.length : 0;
  const sample = parsed && parsed.cards ? parsed.cards.slice(0, 3).map(c => c.name).join(", ") : "";

  return (
    <Modal onClose={onClose} title="Import from Collectr or Shiny">
      {/* Step-by-step expando */}
      <button onClick={() => setShowInstructions(!showInstructions)} style={{
        width: "100%", textAlign: "left", background: C.bg, border: `1px solid ${C.border}`,
        color: C.text, padding: "10px 12px", borderRadius: 10, fontSize: "0.78rem",
        fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif",
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
      }}>
        <span>{showInstructions ? "▼" : "▶"} How to export from Collectr or Shiny</span>
        <span style={{ fontSize: "0.7rem", color: C.textSub }}>takes ~30s</span>
      </button>
      {showInstructions && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: "0.76rem", color: C.textSub, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10 }}>
            <strong style={{ color: C.text }}>📱 Collectr</strong><br />
            Open your collection → tap the <strong style={{ color: C.text }}>⋯ menu</strong> (top right) → <strong style={{ color: C.text }}>Export</strong> or <strong style={{ color: C.text }}>Share as CSV</strong>. Save to Files or email to yourself.
          </div>
          <div style={{ marginBottom: 10 }}>
            <strong style={{ color: C.text }}>📱 Shiny</strong><br />
            <strong style={{ color: C.text }}>Settings</strong> → <strong style={{ color: C.text }}>Export Collection</strong> → choose CSV format. Share to your Files app or email.
          </div>
          <div style={{ fontSize: "0.7rem", color: C.textMuted, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            If these menus have moved in recent app updates, look for "Export", "Share", or "Download" under Settings or the ⋯ menu on your collection screen.
          </div>
        </div>
      )}

      {/* File upload */}
      <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv" onChange={handleFile} style={{ display: "none" }} />
      <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
        width: "100%", background: C.blue + "18", border: `1px dashed ${C.blue}66`, color: C.blue,
        padding: "14px", borderRadius: 10, fontSize: "0.86rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "'Inter',sans-serif", marginBottom: 12,
      }}>📁 Upload CSV file</button>

      <div style={{ textAlign: "center", fontSize: "0.68rem", color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>— or paste text —</div>

      <textarea value={text} onChange={e => handleText(e.target.value)}
        placeholder={"name,set,condition,price\nCharizard ex,Obsidian Flames,NM,52\nUmbreon VMAX Alt Art,Evolving Skies,NM,385"}
        style={{ ...inp, minHeight: 120, fontFamily: "monospace", fontSize: "0.76rem", resize: "vertical", width: "100%" }} />

      {/* Parse feedback */}
      {parsed && parsed.error && (
        <div style={{ color: C.red, fontSize: "0.76rem", marginTop: 10, background: C.red + "12", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "8px 12px" }}>
          ⚠ {parsed.error}
        </div>
      )}
      {parsed && parsed.cards && parsed.cards.length > 0 && (
        <div style={{ marginTop: 10, background: C.green + "10", border: `1px solid ${C.green}44`, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.green, marginBottom: 4 }}>
            ✓ Found {count} card{count === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: "0.72rem", color: C.textSub, lineHeight: 1.5 }}>
            Sample: <span style={{ color: C.text }}>{sample}</span>{count > 3 ? " and more…" : ""}
          </div>
          {parsed.detected && (
            <div style={{ fontSize: "0.66rem", color: C.textMuted, marginTop: 6 }}>
              Detected columns: {[parsed.detected.name, parsed.detected.price, parsed.detected.set, parsed.detected.condition, parsed.detected.quantity].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, padding: "12px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
        <button onClick={confirm} disabled={!count}
          style={{
            flex: 2,
            background: count ? C.green + "22" : C.surface,
            border: `1px solid ${count ? C.green + "55" : C.border}`,
            color: count ? C.green : C.textMuted,
            padding: "12px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 700,
            cursor: count ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif",
          }}>Import {count || ""} {count ? (count === 1 ? "card" : "cards") : ""}</button>
      </div>
    </Modal>
  );
}

function AddCardModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name: "", set: "", number: "", condition: "NM", quantity: 1, purchasePrice: "", currentPrice: "" });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const labelStyle = { fontSize: "0.7rem", color: C.textSub, fontWeight: 600, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" };
  return (
    <Modal onClose={onClose} title="Add Card to Collection">
      <div style={{ display: "grid", gap: 12 }}>
        {[
          { l: "Card Name", k: "name", p: "e.g. Charizard ex" },
          { l: "Set", k: "set", p: "e.g. Obsidian Flames" },
          { l: "Number", k: "number", p: "e.g. 125/197" },
        ].map(({ l, k, p }) => (
          <div key={k}>
            <div style={labelStyle}>{l}</div>
            <input value={f[k]} onChange={e => u(k, e.target.value)} placeholder={p} style={inp} />
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><div style={labelStyle}>Condition</div>
            <select value={f.condition} onChange={e => u("condition", e.target.value)} style={inp}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><div style={labelStyle}>Qty</div>
            <input type="number" value={f.quantity} onChange={e => u("quantity", Math.max(1, parseInt(e.target.value) || 1))} style={inp} />
          </div>
          <div><div style={labelStyle}>Paid ($)</div>
            <input type="number" value={f.purchasePrice} onChange={e => u("purchasePrice", e.target.value)} placeholder="0" style={inp} />
          </div>
        </div>
        <div><div style={labelStyle}>Current Market Price ($)</div>
          <input type="number" value={f.currentPrice} onChange={e => u("currentPrice", e.target.value)} placeholder="0" style={inp} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, padding: "10px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
        <button onClick={() => {
          if (!f.name || !f.purchasePrice) return;
          const pp = parseFloat(f.purchasePrice);
          const cp = parseFloat(f.currentPrice) || pp;
          onAdd({
            id: Date.now(), name: f.name, set: f.set || "—", number: f.number || "—",
            condition: f.condition, quantity: parseInt(f.quantity) || 1,
            purchasePrice: pp, currentPrice: cp,
            rawPSA9: cp * 1.6, rawPSA10: cp * 2.8, image: PH("Card", "6c8fff"),
          });
          onClose();
        }} style={{ flex: 2, background: C.green + "22", border: `1px solid ${C.green}55`, color: C.green, padding: "10px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Add Card</button>
      </div>
    </Modal>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
const TABS = ["Markets", "My Collection", "Grading ROI", "Sell Opportunities", "Goal List"];

export default function CatchEm() {
  const [mode, setMode] = useState(null);
  const [budget, setBudget] = useState(BUDGET_UNLIMITED);
  const [tab, setTab] = useState(0);
  const [collection, setCollection] = useState(INITIAL_COLLECTION);
  const [wishlist, setWishlist] = useState(INITIAL_WISHLIST);
  const [showCSV, setShowCSV] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [marketCards, setMarketCards] = useState(() => [...MARKET_CARDS, ...SEALED_PRODUCTS]);
  const [marketStatus, setMarketStatus] = useState("demo"); // demo | loading | live | error
  const [plan, setPlan] = useState("free"); // free | pro
  const [currency, setCurrency] = useState(() => detectCurrency());
  const [rates, setRates] = useState(null);
  const { isMobile } = useWindowSize();

  // Feature-detect storage so the app still works outside the artifact env.
  const hasStorage = typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

  // Load persisted state once on mount.
  useEffect(() => {
    if (!hasStorage) { setLoaded(true); return; }
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          const data = JSON.parse(result.value);
          if (data.mode && MODES[data.mode]) setMode(data.mode);
          if (typeof data.budget === "number") setBudget(data.budget);
          if (Array.isArray(data.collection)) setCollection(data.collection);
          if (Array.isArray(data.wishlist)) setWishlist(data.wishlist);
          if (data.plan === "pro" || data.plan === "free") setPlan(data.plan);
          if (data.currency && CURRENCIES[data.currency]) setCurrency(data.currency);
        }
      } catch (e) {
        // First-time user — key doesn't exist yet. Totally normal.
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch exchange rates on mount (cached 24h). Non-blocking — falls back to
  // approximate fallbackRate in CURRENCIES if fetch fails.
  useEffect(() => {
    fetchExchangeRates().then(r => { if (r) setRates(r); });
  }, []);

  // Load live market data (cached or fresh from pokemontcg.io)
  useEffect(() => {
    (async () => {
      const cached = await loadCachedMarket();
      if (cached && cached.length) {
        setMarketCards(cached);
        setMarketStatus("live");
        return;
      }
      setMarketStatus("loading");
      try {
        const cards = await fetchMarketCards();
        setMarketCards(cards);
        setMarketStatus("live");
        saveCachedMarket(cards);
      } catch (e) {
        console.warn("Market fetch failed, using demo data:", e);
        setMarketStatus("error");
      }
    })();
  }, []);

  async function refreshMarket() {
    setMarketStatus("loading");
    try {
      const cards = await fetchMarketCards();
      setMarketCards(cards);
      setMarketStatus("live");
      saveCachedMarket(cards);
    } catch (e) {
      setMarketStatus("error");
    }
  }

  // Debounced save on any data change. 500ms avoids rate-limiting from slider drags.
  useEffect(() => {
    if (!loaded || !hasStorage) return;
    const timer = setTimeout(() => {
      const data = { mode, budget, collection, wishlist, plan, currency };
      try {
        window.storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
      } catch (e) { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, budget, collection, wishlist, plan, currency, loaded, hasStorage]);

  function resetData() {
    if (!confirm("Reset all your Catch'em data? This clears your collection, goals, mode, and budget — can't be undone.")) return;
    if (hasStorage) {
      try {
        window.storage.delete(STORAGE_KEY).catch(() => {});
        window.storage.delete(MARKET_CACHE_KEY).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    setMode(null);
    setBudget(BUDGET_UNLIMITED);
    setCollection(INITIAL_COLLECTION);
    setWishlist(INITIAL_WISHLIST);
    setPlan("free");
    setCurrency(detectCurrency());
    setTab(0);
  }

  // Splash while we check storage — prevents a flicker of onboarding for returning users.
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@keyframes fade{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
        <div style={{ textAlign: "center", animation: "fade 1.4s ease-in-out infinite" }}>
          <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: "0.85rem", color: C.textSub }}>Loading your collection...</div>
        </div>
      </div>
    );
  }

  if (!mode) return <Onboarding onSelect={m => { setMode(m); setBudget(BUDGET_UNLIMITED); }} />;

  const modeData = MODES[mode];

  // Memoized currency context value so components re-render only when currency/rates change.
  const currencyCtxValue = useMemo(() => ({
    currency,
    rates,
    setCurrency,
    fmtPrice: (n) => formatPriceCompactImpl(n, currency, rates),
    fmtPriceExact: (n) => formatPriceImpl(n, currency, rates),
  }), [currency, rates]);

  return (
    <CurrencyContext.Provider value={currencyCtxValue}>
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
        input::placeholder,textarea::placeholder{color:${C.textMuted}}
        select option{background:${C.bg};color:${C.text}}
        a:hover{opacity:.85}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>

      {showCSV && <CSVModal onClose={() => setShowCSV(false)} onImport={cards => setCollection(prev => [...prev, ...cards])} />}
      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdd={card => setCollection(prev => [...prev, card])} />}
      {showScanner && <ScannerModal
        onClose={() => setShowScanner(false)}
        onAddToCollection={card => setCollection(prev => [...prev, card])}
        onAddToGoal={card => setWishlist(prev => [...prev, card])}
        marketCards={marketCards}
      />}
      {showPlan && <PlanModal plan={plan} onClose={() => setShowPlan(false)} onSetPlan={setPlan} />}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 12px" : "0 24px", position: "sticky", top: 0, background: C.bg, zIndex: 50, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: "1.2rem" }}>⚡</span>
          {!isMobile && (
            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: C.text, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              Catch<span style={{ color: C.green }}>'em</span>
            </span>
          )}
          <div style={{ display: "flex", gap: 3, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: 3 }}>
            {Object.values(MODES).map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} style={{
                background: mode === m.key ? m.color + "22" : "transparent",
                border: "none", color: mode === m.key ? m.color : C.textSub,
                padding: isMobile ? "6px 8px" : "6px 10px", fontSize: isMobile ? "0.78rem" : "0.72rem",
                fontWeight: 600, borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 5,
              }}
              title={m.label}>
                <span>{m.emoji}</span>
                {!isMobile && <span>{m.label}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 6 : 8, flexShrink: 0, alignItems: "center" }}>
          <CurrencySelector compact={isMobile} />
          <button onClick={() => setShowPlan(true)} style={{
            background: plan === "pro" ? C.purple + "22" : "transparent",
            border: `1px solid ${plan === "pro" ? C.purple + "66" : C.purple + "44"}`,
            color: C.purple,
            padding: isMobile ? "7px 10px" : "7px 12px", borderRadius: 8, fontSize: "0.74rem",
            fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif",
            whiteSpace: "nowrap",
          }} title={plan === "pro" ? "Pro plan active" : "Upgrade to Pro"}>
            {plan === "pro" ? "✨ Pro" : (isMobile ? "✨" : "Upgrade ✨")}
          </button>
          <button onClick={() => setShowScanner(true)} style={{
            background: C.purple + "20", border: `1px solid ${C.purple}55`, color: C.purple,
            padding: isMobile ? "7px 10px" : "7px 14px", borderRadius: 8, fontSize: "0.76rem",
            fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif",
            whiteSpace: "nowrap",
          }} title="Scan a card">
            📷{isMobile ? "" : " Scan"}
          </button>
          {!isMobile && (
            <button onClick={() => setShowCSV(true)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSub, padding: "7px 12px", borderRadius: 8, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}
              onMouseEnter={e => { e.target.style.borderColor = C.blue; e.target.style.color = C.blue; }}
              onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.textSub; }}>Import CSV</button>
          )}
          {isMobile && (
            <button onClick={() => setShowCSV(true)} title="Import from Collectr or Shiny" style={{
              background: "transparent", border: `1px solid ${C.border}`, color: C.textSub,
              padding: "7px 10px", borderRadius: 8, fontSize: "0.88rem", cursor: "pointer",
              fontFamily: "'Inter',sans-serif",
            }}>📁</button>
          )}
          <button onClick={() => setShowAdd(true)} style={{
            background: C.green + "20", border: `1px solid ${C.green}55`, color: C.green,
            padding: isMobile ? "7px 10px" : "7px 14px", borderRadius: 8, fontSize: "0.76rem",
            fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap",
          }}>+ {isMobile ? "" : "Add Card"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: isMobile ? "0 12px" : "0 24px", display: "flex", overflowX: "auto" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            background: "none", border: "none",
            borderBottom: tab === i ? `2px solid ${modeData.color}` : "2px solid transparent",
            color: tab === i ? C.text : C.textSub,
            padding: isMobile ? "13px 12px" : "15px 18px", cursor: "pointer",
            fontSize: isMobile ? "0.78rem" : "0.82rem",
            fontWeight: tab === i ? 700 : 400, whiteSpace: "nowrap",
            fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 12px" : "28px 24px" }}>
        {tab === 0 && <MarketsTab mode={mode} budget={budget} setBudget={setBudget} marketCards={marketCards} marketStatus={marketStatus} onRefreshMarket={refreshMarket} />}
        {tab === 1 && <PortfolioTab collection={collection} onRemove={id => setCollection(c => c.filter(x => x.id !== id))} />}
        {tab === 2 && <GradingTab collection={collection} plan={plan} onUpgrade={() => setShowPlan(true)} />}
        {tab === 3 && <FlipTab collection={collection} plan={plan} onUpgrade={() => setShowPlan(true)} />}
        {tab === 4 && <BuilderTab
          wishlist={wishlist}
          onRemoveWish={id => setWishlist(w => w.filter(x => x.id !== id))}
          onAddWish={w => setWishlist(prev => [...prev, w])}
          onUpdateWish={(id, patch) => setWishlist(w => w.map(g => g.id === id ? { ...g, ...patch } : g))}
          plan={plan}
          onUpgrade={() => setShowPlan(true)}
        />}
        <div style={{ marginTop: 40, textAlign: "center", fontSize: "0.68rem", color: C.textMuted }}>
          Demo data · Live prices coming soon · Catch'em v2.0
          {hasStorage && <>
            {" · "}
            <button onClick={resetData} style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: "0.68rem", textDecoration: "underline", fontFamily: "'Inter',sans-serif", padding: 0 }}>Reset data</button>
          </>}
        </div>
      </div>
    </div>
    </CurrencyContext.Provider>
  );
}
