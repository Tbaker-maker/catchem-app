import { readFile } from "node:fs/promises";
import { money } from "./lib/public-chrome.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const id = "sv3pt5-etb";
const product = await readFile(new URL(`../public/p/${id}.html`, import.meta.url), "utf8");
const set = await readFile(new URL("../public/sets/sv3pt5.html", import.meta.url), "utf8");
const low = product.match(/data-k="lowestAsk"[\s\S]*?<b>([^<]+)<\/b>/)?.[1];
const high = product.match(/data-k="high"[\s\S]*?<b>([^<]+)<\/b>/)?.[1];
const barLow = product.match(/data-low="([^"]+)"/)?.[1];
const barHigh = product.match(/data-high="([^"]+)"/)?.[1];
const row = set.match(new RegExp(`data-id="${id}"[^>]*>`))?.[0] || "";
t("lowest ask card matches the range bar", low && low === money(Number(barLow)));
t("today's high matches the range bar", high && high === money(Number(barHigh)));
t("set row uses the same lowest ask", row.includes(`data-low="${barLow}"`));
t("no undefined or NaN on the product page", !product.includes("$undefined") && !product.includes("NaN") && !/\bfloor\b/i.test(product));
t("no ticker or studio links", !product.includes("/studio") && !set.includes("/studio") && !set.includes("the ticker") && !product.includes("the full ticker"));
t("one human timestamp", (product.match(/Updated /g) || []).length === 1);

if (fail) process.exit(1);
console.log("numbers agree");
