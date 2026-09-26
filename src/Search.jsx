// Search stays off unless VITE_SEARCH_ENABLED=true. It is not in the nav.
import React, { useEffect, useMemo, useState } from "react";
import { searchItems } from "./searchRank.js";

const INDEX_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/search/search-index.json";

const KINDS = [
  ["all", "All"],
  ["single", "Cards"],
  ["sealed", "Sealed"],
  ["slab", "Slabs"],
];

export default function Search() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  useEffect(() => {
    let cancel = false;
    fetch(INDEX_URL)
      .then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
      })
      .then((doc) => {
        if (!cancel) setItems(doc.items || []);
      })
      .catch(() => {
        if (!cancel) setError("Search index is not published yet.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const hits = useMemo(
    () => (items ? searchItems(items, query, { kind, limit: 12 }) : []),
    [items, query, kind],
  );

  return (
    <section className="ce-search" aria-label="Card and sealed search">
      <style>{`
        .ce-search{grid-column:1/-1;margin:12px 0 8px}
        .ce-search input{width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border-strong);
          border-radius:12px;padding:12px 14px;font:600 15px var(--font-body)}
        .ce-search input:focus{outline:2px solid var(--gold);outline-offset:2px}
        .ce-filters{display:flex;gap:8px;margin:8px 0}
        .ce-filters button{background:transparent;color:var(--text-sub);border:1px solid var(--border);
          border-radius:99px;padding:6px 10px;cursor:pointer}
        .ce-filters button.on{color:var(--text);border-color:var(--gold)}
        .ce-hit{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
        .ce-hit b{font-weight:700}
        .ce-meta{color:var(--text-sub);font-size:12px}
        .ce-price{font:700 13px var(--font-mono);text-align:right}
      `}</style>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try moonbreon, charzard, or 151 etb"
        aria-label="Search cards and sealed products"
        autoComplete="off"
      />
      <div className="ce-filters">
        {KINDS.map(([id, label]) => (
          <button key={id} type="button" className={kind === id ? "on" : ""} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="ce-meta">{error}</p>}
      {query.trim().length >= 2 && items && hits.length === 0 && (
        <p className="ce-meta">No match. Try a set name or a nickname like moonbreon.</p>
      )}
      {hits.map((hit) => (
        <div className="ce-hit" key={hit.id}>
          <div>
            <b>{hit.name}</b>
            <div className="ce-meta">
              {hit.set || "Set not listed"}
              {hit.number ? ` · #${hit.number}` : ""}
              {hit.rarity ? ` · ${hit.rarity}` : ""}
              {hit.kind === "sealed" ? " · sealed" : hit.kind === "slab" ? " · slab" : ""}
            </div>
          </div>
          <div className="ce-price">
            {typeof hit.price === "number" ? `$${hit.price.toLocaleString()} USD` : "No price"}
            {hit.source && hit.asOf ? (
              <div className="ce-meta">
                {hit.source}
                <br />
                as of {hit.asOf}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}
