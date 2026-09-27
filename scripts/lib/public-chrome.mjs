// Shared public-page chrome and the guards that keep a bad Feed from shipping.
// Homepage tokens: warm brown-black, Fraunces, IBM Plex, gold.

export const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export const DISCORD = "https://discord.gg/fUSjxDX4Hy";

const ENT = {
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
  "'": "\u0026#39;",
};
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);

export function pretty(name) {
  return String(name ?? "")
    .replace(/\bPokemon\b/g, "Pokémon")
    .replace(/Pokémon 151 Pokémon Center/g, "151 Pokémon Center")
    .replace(/\s+/g, " ")
    .trim();
}

export function money(n) {
  const x = typeof n === "number" ? n : (n == null || n === "" ? NaN : Number(n));
  if (!Number.isFinite(x) || x <= 0) return null;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moveLabel(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "unchanged";
  return `${n > 0 ? "▲" : "▼"} ${Math.abs(n)}%`;
}

export function cleanLine(s) {
  let t = String(s ?? "");
  if ((t.match(/\|/g) || []).length >= 2) return "";
  t = t.replace(/\[[^\]]+\]\([^)]+\)/g, "");
  t = t.replace(/orderable as of [^.]+\.?/ig, "");
  t = t.replace(/\b(supply injection|absorb-or-stall|on the tape|spread signals|table referee)\b/ig, "");
  t = t.replace(/\bprice floors?\b/ig, "lowest asks");
  t = t.replace(/\bfloors?\b/ig, "lowest asks");
  t = t.replace(/\bS&P 500 Equal Weight\b/g, "a second index");
  t = t.replace(/\bS&P 500\b/g, "a broad index");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || /orderable as of/i.test(t)) return "";
  return t;
}

export function stampLabel(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "Data delayed";
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  const label = `Updated ${clock} PT`;
  if ((now - t) / 36e5 > 48) return `${label} · STALE`;
  return label;
}

export function headerHtml(active) {
  const item = (href, label) => {
    const here = active === label ? ` aria-current="page"` : "";
    const ext = href.startsWith("http") ? ` rel="noopener"` : "";
    return `<a href="${href}"${here}${ext}>${label}</a>`;
  };
  return `<header class="site-bar"><a class="logo" href="/">Catch'em<span>.</span></a><nav>` +
    item("/feed", "The Feed") +
    item("/board", "Board") +
    item("/methodology", "Methodology") +
    item(DISCORD, "Discord Premium") +
    `</nav></header>`;
}

export function footerHtml() {
  return `<footer class="site-foot"><p>Made by one person who collects. Card images and names are © Pokémon / Nintendo / Creatures / GAME FREAK. Catch'em is an independent fan project and is not affiliated with or endorsed by them.</p><p><a href="mailto:support@catchemtcg.com">support@catchemtcg.com</a></p></footer>`;
}

export const chromeCss = `
.site-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:14px 22px;border-bottom:1px solid var(--line);background:var(--bg)}
.site-bar .logo{font:600 28px/1 var(--serif);color:var(--txt);text-decoration:none;letter-spacing:-.03em}
.site-bar .logo span{color:var(--gold)}
.site-bar nav{display:flex;flex-wrap:wrap;gap:8px 16px}
.site-bar nav a{color:var(--dim);text-decoration:none;font:500 14.5px/1 var(--sans)}
.site-bar nav a[aria-current="page"],.site-bar nav a:hover{color:var(--gold)}
.site-foot{max-width:1040px;margin:0 auto;padding:28px 22px 56px;color:var(--faint);font:14px/1.7 var(--sans)}
.site-foot p{margin:0 0 8px}
.site-foot a{color:var(--gold)}
`.trim();

export function feedStyle() {
  return `:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--faint:#9a9184;--gold:#d9b779;--green:#7fc79a;--red:#e0675b;--blue:#6f9be8;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:var(--bg);color:var(--txt);font:16px/1.6 var(--sans)}
${chromeCss}
main.col{max-width:680px;margin:0 auto;padding:28px 20px 48px}
.kicker{font:600 12px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
h1{font:500 34px/1.1 var(--serif);letter-spacing:-.02em;margin:8px 0 4px}h1 span{color:var(--dim);font-weight:500}
.byline{color:var(--dim);font-size:14px;margin-bottom:18px}
.panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:22px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 12px;text-align:center}
.stat b{display:block;font:600 22px/1.2 var(--serif);color:var(--txt)}
.stat i{font-style:normal;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
h2{font:600 13px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:26px 0 10px}
.sig{display:flex;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;padding:12px 14px;margin-bottom:8px;min-width:0;max-width:100%}
.sighead{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.pct{font:600 16px/1 var(--sans);color:var(--gold)}
.signame{font-weight:600}.sigsub{font-size:14px;color:var(--dim);margin-top:3px}.sigsub b{color:var(--txt)}.sigread{font-size:13px;color:var(--dim);margin-top:4px}.foot{font-size:12px;color:var(--dim);margin-top:8px}
.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);min-width:0}
.row em{color:var(--dim);font-style:normal;font-size:13px}.mono{font:500 14px/1.3 var(--sans);font-variant-numeric:tabular-nums;color:var(--txt)}
.sigbody{flex:1;min-width:0}
img.thumb{width:46px;max-width:46px;min-width:0;height:auto;border-radius:6px;flex:none;border:1px solid var(--line);background:var(--panel)}
img.thumb.logo{width:56px;max-width:56px;min-width:0;height:auto;padding:4px}
.idxhead{display:flex;justify-content:space-between;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 16px}
.idxhead a{color:var(--gold)}
`;
}

export function assertValidCss(css) {
  const errors = [];
  let depth = 0;
  let quote = null;
  const text = String(css || "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (depth < 0) errors.push("extra closing brace");
  }
  if (quote) errors.push("unclosed quote");
  if (depth !== 0) errors.push("unbalanced braces");
  if (text.includes("monospace',monospace")) errors.push("stray quote in font stack");
  if (/'[A-Za-z0-9 ]+,[^'\n]+'/.test(text)) errors.push("font stack quoted as one family");
  if (/html\s*,\s*body\s*\{[^}]*max-width\s*:\s*100%/.test(text)) errors.push("html,body max-width 100% cancels the column");
  return errors;
}

export function brokenNumbers(html) {
  const hits = [];
  const text = String(html || "");
  if (/\$undefined|\$null|\$NaN/.test(text)) hits.push("broken dollar");
  if (/NaN%/.test(text)) hits.push("NaN percent");
  if (/>\s*undefined\s*</.test(text)) hits.push("undefined text");
  const plain = text.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  if (/\bnull\b/.test(plain)) hits.push("null text");
  if (/\bfloor\b/i.test(plain)) hits.push("floor wording");
  return hits;
}

export function assertCleanHtml(html, label = "html") {
  const hits = brokenNumbers(html);
  if (hits.length) throw new Error(`${label}: ${hits.join(", ")}`);
}

export function sparkPrices(values) {
  let pts = (values || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (pts.length >= 4) {
    const sorted = [...pts].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const kept = pts.filter((v) => v >= med * 0.4);
    if (kept.length >= 2) pts = kept;
  }
  return pts;
}
