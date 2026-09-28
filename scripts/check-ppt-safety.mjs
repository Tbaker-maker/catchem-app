// Equivalent of Catchem-data scripts/check-ppt-safety.mjs.
// Fails if a raw PPT price key is tracked, or if the lines this pass
// removed show up in src or the landing page.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
const KEYS = ["pptSold", "pptPrice", "backcalcPrice", "rawPpt", "sellerKeeps", "buyerPays"];
const COPY = ["Know what to rip", "sells for", "about 0"];

const { stdout } = await exec("git", ["ls-files"], { cwd: ROOT });
const tracked = stdout.split("\n").filter(Boolean);
const reasons = [];
for (const rel of tracked) {
  let body = "";
  try { body = await readFile(join(ROOT, rel), "utf8"); } catch { continue; }
  if (rel.endsWith(".json") && !rel.includes("node_modules")) {
    for (const key of KEYS) if (body.includes('"' + key + '"')) reasons.push(rel + " has " + key);
  }
  if ((rel.startsWith("src/") || rel === "index.html") && /\.(html|mjs|js|jsx|css)$/.test(rel)) {
    for (const line of COPY) if (body.includes(line)) reasons.push(rel + " has " + JSON.stringify(line));
  }
}
if (reasons.length) {
  console.error(reasons.join("\n"));
  process.exit(1);
}
console.log("ppt safety ok");
