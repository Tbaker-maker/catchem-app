// Copies of supply that came off before the price moved up.
// Rows are the card history already on file: [date, price, listings].
// A sold count is not an input. A gap of days is not one move.
// No copy count is guessed from the current listing total.

const DAY_MS = 86400000;

export const SUPPLY_LABEL = "Supply off before the price moves up";

export const SUPPLY_NOTE =
  "Copies are the listing total that came off on a consecutive day the price moved up. The percent is how large that drop in that total has to be. If the history does not already show that lineup, the count stays blank. Not a sold count.";

function dayUtc(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function copiesOff(rows, percent = 15) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const pct = typeof percent === "number" ? percent : Number(percent);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  const need = pct / 100;
  let best = null;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const ta = dayUtc(a[0]);
    const tb = dayUtc(b[0]);
    if (ta == null || tb == null || tb - ta !== DAY_MS) continue;
    const priceA = a[1];
    const priceB = b[1];
    const listingsA = a[2];
    const listingsB = b[2];
    if (!Number.isInteger(listingsA) || !Number.isInteger(listingsB)) continue;
    if (!(listingsA > 0) || !(priceA > 0) || !(priceB > 0)) continue;
    if (!(listingsB < listingsA) || !(priceB > priceA)) continue;
    const drop = (listingsA - listingsB) / listingsA;
    if (drop + 1e-12 < need) continue;
    const copies = listingsA - listingsB;
    if (best == null || copies < best) best = copies;
  }
  return best;
}
