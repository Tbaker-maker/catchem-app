// scripts/audit-words.mjs — v7 Digest Law instrument: user-facing word count
// per screen in src/Ticker.jsx. Counts words inside string literals and JSX
// text that contain a space (prose), skipping URLs, class names and style
// values. Same script before/after = honest delta.
import { readFile } from "node:fs/promises";

const src = await readFile(process.argv[2] || new URL("../src/Ticker.jsx", import.meta.url), "utf8");

// screen boundaries: [label, start-marker]
const MARKS = [
  ["shared/top (helpers, capture, overlay)", 0],
  ["Home", src.indexOf("const Home = ")],
  ["Movers", src.indexOf("const Movers = ")],
  ["WatchTab", src.indexOf("const WatchTab = ")],
  ["Tools hub", src.indexOf("const Tools = ")],
  ["PackMath", src.indexOf("const PackMath = ")],
  ["PrintWatch", src.indexOf("const PrintWatch = ")],
  ["NetCalc", src.indexOf("const NetCalc = ")],
  ["RipOrHold", src.indexOf("const RipOrHold = ")],
  ["Board", src.indexOf("const Board = ")],
  ["DealCheck", src.indexOf("const DealCheck = ")],
  ["ProductDetail", src.indexOf("const ProductDetail = ")],
  ["Studio", src.indexOf("const Studio = ")],
  ["StudioArchive", src.indexOf("const StudioArchive = ")],
  ["Compare", src.indexOf("const Compare = ")],
  ["shell/return", src.lastIndexOf("<div className=\"tk-root\">")],
].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);

const SKIP = /^(https?:|\/|#[0-9a-f]{3,8}$|[\d.,%$]+$)/i;
const CSSISH = /(:\s*\d|display|flex|margin|padding|border|background|font|color:|width|height|position|overflow|radius|align|justify|grid|text-)/;

function tuckedWords(slice) {
  let n = 0;
  for (const m of slice.matchAll(/<I t="([^"]*)"/g))
    n += m[1].split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w)).length;
  return n;
}

function words(slice) {
  // ⓘ bodies are one-tap-away depth, not on-glance words — count separately.
  slice = slice.replace(/<I t="[^"]*"/g, "<I ");
  let total = 0;
  const strings = [
    // single-line only: multi-line captures pair apostrophes/backticks across
    // CODE (a "Couldn't" once counted 270 words of JavaScript as prose)
    ...slice.matchAll(/"([^"\n]*)"/g),
    ...slice.matchAll(/`([^`\n]*)`/g),
    ...slice.matchAll(/>([^<>{}]+)</g), // JSX text nodes
  ];
  for (const m of strings) {
    const s = m[1].trim();
    if (!s || !s.includes(" ")) continue;       // prose has spaces
    if (SKIP.test(s) || CSSISH.test(s)) continue; // urls/colors/inline css
    if (/^[\d\s.,:%$·|—-]+$/.test(s)) continue;  // numeric fragments
    total += s.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w)).length;
  }
  return total;
}

let grand = 0, grandTucked = 0;
const rows = [];
for (let i = 0; i < MARKS.length; i++) {
  const [label, start] = MARKS[i];
  const end = i + 1 < MARKS.length ? MARKS[i + 1][1] : src.length;
  const slice = src.slice(start, end);
  const w = words(slice), tk = tuckedWords(slice);
  grand += w; grandTucked += tk;
  rows.push([label, w, tk]);
}
console.log("on-glance  tucked(ⓘ)  screen");
for (const [l, w, tk] of rows) console.log(String(w).padStart(9), String(tk).padStart(10), " ", l);
console.log(String(grand).padStart(9), String(grandTucked).padStart(10), "  TOTAL");
