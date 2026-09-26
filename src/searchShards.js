// Which shards a query needs. Same prefix rule as Catchem-data search-shards.mjs.
import { normalize } from "./searchRank.js";

const KINDS = ["single", "sealed", "slab"];

export function prefixOf(text) {
  const flat = normalize(text).replace(/ /g, "");
  if (flat.length < 2) return null;
  return flat.slice(0, 2);
}

export function shardIdsForQuery(query, kind = "all") {
  const q = normalize(query);
  if (q.length < 2) return [];
  const prefs = new Set();
  const whole = prefixOf(q);
  if (whole) prefs.add(whole);
  for (const token of q.split(" ")) {
    const pref = prefixOf(token);
    if (pref) prefs.add(pref);
  }
  const kinds = kind === "all" ? KINDS : [kind];
  const ids = [];
  for (const one of kinds) for (const pref of prefs) ids.push(`${one}-${pref}`);
  return ids.sort();
}

const cache = new Map();

export function resetShardCache() {
  cache.clear();
}

export function rowsForQuery(shardRows, query, kind = "all") {
  const seen = new Set();
  const items = [];
  for (const id of shardIdsForQuery(query, kind)) {
    for (const item of shardRows[id] || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function loadShard(id, url, fetchImpl = fetch) {
  if (!cache.has(id)) {
    cache.set(id, fetchImpl(url).then((res) => {
      if (!res.ok) throw new Error("missing");
      return res.json();
    }));
  }
  return cache.get(id);
}
