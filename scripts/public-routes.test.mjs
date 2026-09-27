import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePublicRoutes } from "./public-routes.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const dir = await mkdtemp(join(tmpdir(), "app-routes-"));
await writeFile(join(dir, "methodology.html"), "<h2>Buy Pressure (est.)</h2><p>bullish read</p>");
await writeFile(join(dir, "pulse.html"), "<p>BULLISH·long</p><p>Buy Pressure</p>");
await writePublicRoutes(dir);
const feed = await readFile(join(dir, "try/index.html"), "utf8");
const meth = await readFile(join(dir, "methodology.html"), "utf8");
t("try serves the feed without BULLISH", feed.includes("HEAT") && !feed.includes("BULLISH") && !feed.includes("Buy Pressure"));
t("app and feed files exist", await readFile(join(dir, "app/index.html"), "utf8").then(s => s.includes("HEAT")));
t("methodology says Demand", meth.includes("Demand") && meth.includes("HEAT") && !meth.includes("Buy Pressure") && !/bullish/i.test(meth) && !meth.includes(">heat<") && !meth.includes("heat read"));
await rm(dir, { recursive: true, force: true });
if (fail) process.exit(1);
console.log("app public routes ok");
