// Same route files the marketing site needs. catchem-site copies site-public
// after this script runs; these paths are what stop /feed, /try/ and /app/ 404ing.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function neutralizeCopy(html) {
  return String(html)
    .replaceAll("Buy Pressure", "Demand")
    .replaceAll("buy pressure", "demand")
    .replaceAll("BULLISH", "HEAT")
    .replaceAll("Bullish", "HEAT")
    .replaceAll("bullish", "HEAT");
}

const ROUTE_FILES = [
  "feed.html",
  "feed/index.html",
  "try.html",
  "try/index.html",
  "app.html",
  "app/index.html",
];

const FALLBACK = `<!doctype html>
<meta charset="utf-8">
<title>Catch'em — The Feed</title>
<p>The Feed. Calls we track until they hit or miss.</p>
<p><a href="https://discord.gg/fUSjxDX4Hy">Discord Premium · $14.99/mo</a></p>
`;

export async function writePublicRoutes(outDir) {
  for (const name of ["index.html", "pulse.html", "methodology.html", "board.html"]) {
    const path = join(outDir, name);
    let raw;
    try { raw = await readFile(path, "utf8"); } catch { continue; }
    const next = neutralizeCopy(raw);
    if (next !== raw) await writeFile(path, next);
  }
  let feed;
  try { feed = await readFile(join(outDir, "pulse.html"), "utf8"); } catch { feed = FALLBACK; }
  feed = neutralizeCopy(feed);
  for (const rel of ROUTE_FILES) {
    const path = join(outDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, feed);
  }
  return ROUTE_FILES;
}
