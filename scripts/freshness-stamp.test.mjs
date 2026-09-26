import { freshnessFrom, stampHtml } from "../src/freshness.js";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};
const fresh = freshnessFrom("2026-09-26T20:20:00.000Z", Date.parse("2026-09-26T22:00:00.000Z"));
t("fresh label names PT", fresh.delayed === false && fresh.label.endsWith("PT"));
const old = freshnessFrom("2026-09-20T20:20:00.000Z", Date.parse("2026-09-26T22:00:00.000Z"));
t("old clock is Data delayed", old.label === "Data delayed");
const html = stampHtml("<html><body><title>Morning Pulse — 2026-09-26</title><div class=\"kicker\">CATCH'EM · MORNING PULSE</div></body></html>", "2026-09-26T20:20:00.000Z", Date.parse("2026-09-26T22:00:00.000Z"));
t("title becomes The Feed", html.includes("The Feed — 2026-09-26") && html.includes("THE FEED") && html.includes('id="fresh"') && html.includes("Updated "));
const aged = stampHtml("<body></body>", "2026-09-20T20:20:00.000Z", Date.parse("2026-09-26T22:00:00.000Z"));
t("aged html says Data delayed", aged.includes("Data delayed"));
if (fail) process.exit(1);
console.log("freshness stamp ok");
