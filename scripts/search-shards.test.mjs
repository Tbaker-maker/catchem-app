import { searchItems } from "../src/searchRank.js";
import { resetShardCache, rowsForQuery, shardIdsForQuery } from "../src/searchShards.js";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.error("  FAIL", name); }
};

const shardRows = {
  "single-mo": [{ id: "swsh7-215", name: "Umbreon VMAX", set: "Evolving Skies", kind: "single", aliases: ["moonbreon"], price: 1 }],
  "single-kr": [{ id: "base3-51", name: "Krabby", set: "Fossil", kind: "single", price: 2 }],
  "sealed-15": [{ id: "sv3pt5-etb", name: "151 Elite Trainer Box", set: "151", kind: "sealed", subtype: "etb", price: 3 }],
};

t("moonbreon asks for the mo shard", shardIdsForQuery("moonbreon").includes("single-mo"));
t("bb does not ask for the kr shard", !shardIdsForQuery("bb").includes("single-kr"));
const moon = searchItems(rowsForQuery(shardRows, "moonbreon"), "moonbreon");
t("moonbreon is still found", moon[0]?.id === "swsh7-215");
const etb = searchItems(rowsForQuery(shardRows, "151 etb"), "151 etb");
t("a sealed etb is still found", etb[0]?.id === "sv3pt5-etb" && etb[0].kind === "sealed");
t("bb is not krabby", searchItems(rowsForQuery(shardRows, "bb"), "bb").length === 0);
resetShardCache();
console.log(fail ? `${fail} failed` : "app search shards ok");
if (fail) process.exit(1);
