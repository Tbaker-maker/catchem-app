import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WATERMARK,
  buildPack,
  cardFrame,
  contrastRatio,
  CAPTION_FG,
  CAPTION_BG,
  exportPlan,
  faceLeavesDevice,
  moverScript,
  priceLabel,
  quotaDecision,
  scriptFor,
  top5Script,
  validateScript,
  watermarkFor,
} from "../src/video/engine.mjs";

const fixture = JSON.parse(readFileSync(new URL("../public/video/fixture.json", import.meta.url)));
const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const search = readFileSync(new URL("../src/Search.jsx", import.meta.url), "utf8");

assert.match(main, /VITE_VIDEO_ENABLED === "true"/);
assert.doesNotMatch(search, /VIDEO_ENABLED|Make a Short|video\/studio/);
assert.equal(fixture.meta.asof, "2026-09-16");
assert.equal(fixture.cards[0].id, "sv3pt5-199");
assert.equal(fixture.cards[0].usd, 368.05);
assert.equal(priceLabel(368.05, "2026-09-16"), "TCGplayer market: $368.05 (2026-09-16)");

const pack = buildPack(fixture.cards.slice(0, 5), { asof: fixture.meta.asof, source: fixture.meta.source });
const top = top5Script(pack);
assert.deepEqual(validateScript(top, pack), []);
assert.match(top.scenes.map((s) => s.spoken).join("\n"), /TCGplayer market: \$368\.05 \(2026-09-16\)/);
assert.match(top.scenes.at(-1).spoken, /Pokémon/);

let n = 0;
for (const c of fixture.cards) {
  const p = buildPack([c], { asof: fixture.meta.asof, source: fixture.meta.source });
  for (const template of ["top5", "mover", "binder"]) {
    const script = scriptFor(template, p);
    assert.deepEqual(validateScript(script, p), [], template + " " + c.id);
    assert.match(script.scenes.map((s) => s.spoken).join("\n"), /TCGplayer market: \$/);
    n++;
  }
}
assert.equal(n, 60);

const one = buildPack([fixture.cards[0]], { asof: fixture.meta.asof });
const mover = moverScript(one);
assert.match(mover.scenes.map((s) => s.spoken).join(" "), /No earlier market date/);
assert.equal(quotaDecision({ weekUsed: 2, dayUsed: 0, premium: false }).ok, false);
assert.equal(quotaDecision({ weekUsed: 1, dayUsed: 0, premium: false }).ok, true);
assert.equal(watermarkFor(false), WATERMARK);
assert.equal(watermarkFor(true), "");
assert.equal(faceLeavesDevice(), false);
assert.equal(exportPlan({ durationSec: 30, hasFace: false }).mode, "local");
assert.equal(exportPlan({ durationSec: 30, hasFace: false }).width, 1080);
assert.equal(exportPlan({ durationSec: 30, hasFace: false }).height, 1920);
assert.equal(exportPlan({ durationSec: 65, hasFace: false }).mode, "local-lite");
assert.ok(contrastRatio(CAPTION_FG, CAPTION_BG) >= 7);
const frame = cardFrame(1080, 1920);
assert.ok(frame.ih / 1920 >= 0.6, "card is at least 60% of the frame height");
const studio = readFileSync(new URL("../public/video/studio.js", import.meta.url), "utf8");
assert.doesNotMatch(studio, /params\.get\("video"\)/);
assert.match(studio, /avc1\.42E01E,mp4a\.40\.2/);
assert.match(studio, /search-lite\.json/);
assert.doesNotMatch(studio, /\/cards\/cache\//);
console.log("catchem-app video engine ok", n);
