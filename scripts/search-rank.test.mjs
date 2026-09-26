import { searchItems } from "../src/searchRank.js";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name); }
};
const items = [
  { id: "es-215", name: "Umbreon VMAX", set: "Evolving Skies", number: "215", kind: "single", aliases: ["moonbreon"], price: 10 },
  { id: "zard", name: "Charizard ex", set: "151", kind: "single", aliases: ["zard", "charzard"], price: 12 },
  { id: "etb", name: "151 Elite Trainer Box", set: "Scarlet & Violet 151", kind: "sealed", subtype: "etb", aliases: ["etb", "151"], price: 70 },
  { id: "bb", name: "Evolving Skies Booster Box", set: "Evolving Skies", kind: "sealed", subtype: "booster-box", aliases: ["bb"], price: 90 },
  { id: "krabby", name: "Krabby", set: "Base", kind: "single", aliases: [], price: 1 },
];
t("moonbreon", searchItems(items, "moonbreon")[0].id === "es-215");
t("charzard", searchItems(items, "charzard")[0].id === "zard");
t("151 etb", searchItems(items, "151 etb")[0].id === "etb");
t("bb is not krabby", searchItems(items, "bb")[0].id === "bb");
t("sealed filter", searchItems(items, "151", { kind: "sealed" }).every((h) => h.kind === "sealed"));
if (fail) process.exit(1);
console.log("app search rank ok");
