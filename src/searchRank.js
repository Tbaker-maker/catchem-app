// Same rules as Catchem-data scripts/lib/search-rank.mjs.
// Exact phrase, then alias, then a small typo. Short words match whole words
// so "bb" does not hit "Krabby".

export function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function hasToken(hay, token) {
  if (!hay || !token) return false;
  if (token.length <= 3) return hay.split(" ").includes(token);
  return hay.includes(token);
}

function wordsOf(text) {
  return normalize(text).split(" ").filter((word) => word.length >= 4);
}

function tokenHits(tokens, blob, words) {
  return tokens.every((token) => {
    if (hasToken(blob, token)) return true;
    if (token.length < 4) return false;
    const limit = token.length >= 7 ? 2 : 1;
    return words.some((word) => levenshtein(token, word) <= limit);
  });
}

export function searchItems(items, query, opts = {}) {
  const kind = opts.kind || "all";
  const limit = opts.limit ?? 20;
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);
  const hits = [];
  for (const item of items || []) {
    if (kind !== "all" && item.kind !== kind) continue;
    const name = normalize(item.name);
    const aliases = (item.aliases || []).map(normalize).filter(Boolean);
    const nameSet = [name, normalize(item.set), normalize(item.number)].filter(Boolean).join(" ");
    const blob = `${nameSet} ${normalize(item.subtype)} ${aliases.join(" ")}`.trim();
    const words = wordsOf(`${item.name || ""} ${item.set || ""} ${(item.aliases || []).join(" ")}`);
    let tier = null;
    if (name === q || tokens.every((token) => hasToken(nameSet, token))) tier = 0;
    else if (aliases.includes(q) || tokens.every((token) => hasToken(blob, token))) tier = 1;
    else if (tokenHits(tokens, blob, words)) tier = 2;
    if (tier === null) continue;
    let penalty = 0;
    if (item.subtype === "pc-etb" && !q.includes("pc") && !q.includes("center")) penalty += 1;
    if (item.kind === "slab" && !/\b(psa|bgs|cgc|slab|graded)\b/.test(q)) penalty += 2;
    hits.push({ item, tier, penalty });
  }
  hits.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    const pa = typeof a.item.price === "number" ? a.item.price : -1;
    const pb = typeof b.item.price === "number" ? b.item.price : -1;
    if (pa !== pb) return pb - pa;
    return String(a.item.name).localeCompare(String(b.item.name));
  });
  return hits.slice(0, limit).map((hit) => ({
    ...hit.item,
    match: hit.tier === 0 ? "exact" : hit.tier === 1 ? "alias" : "fuzzy",
  }));
}
