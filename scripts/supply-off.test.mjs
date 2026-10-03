import { readFileSync } from "node:fs";
import { copiesOff, SUPPLY_LABEL, SUPPLY_NOTE } from "../src/supply-off.js";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const step = [
  ["2026-08-20", 10, 9],
  ["2026-08-21", 11, 7],
];

t("9 to 7 on the next day at 15% is 2 copies", copiesOff(step, 15) === 2);
t("the same step at the default percent is 2 copies", copiesOff(step) === 2);
t("25% blanks a 22% step", copiesOff(step, 25) === null);
t("a typed percent works", copiesOff(step, "15") === 2);
t("an empty percent stays blank", copiesOff(step, "") === null);
t("a gap is not one move", copiesOff([
  ["2026-08-26", 10, 9],
  ["2026-09-21", 12, 7],
], 15) === null);
t("price up with no listing drop stays blank", copiesOff([
  ["2026-08-20", 10, 9],
  ["2026-08-21", 11, 9],
], 15) === null);
t("a listing drop with no price rise stays blank", copiesOff([
  ["2026-08-20", 11, 9],
  ["2026-08-21", 10, 7],
], 15) === null);
t("price up while listings rise stays blank", copiesOff([
  ["2026-08-20", 10, 9],
  ["2026-08-21", 11, 12],
], 15) === null);
t("fractional listings are ignored", copiesOff([
  ["2026-08-20", 10, 9.5],
  ["2026-08-21", 11, 7],
], 15) === null);
t("a missing listing total stays blank", copiesOff([
  ["2026-08-20", 10, null],
  ["2026-08-21", 11, 7],
], 15) === null);
t("one row cannot invent a count", copiesOff([["2026-08-20", 10, 100]], 15) === null);
t("a sold figure on the row is not the count", copiesOff([
  ["2026-08-20", 10, 9, 50],
  ["2026-08-21", 11, 9, 40],
], 15) === null);
t("several lined-up days keep the smallest copy count", copiesOff([
  ["2026-08-20", 10, 20],
  ["2026-08-21", 11, 10],
  ["2026-08-22", 12, 8],
], 15) === 2);
t("a zero price stays blank", copiesOff([
  ["2026-08-20", 0, 9],
  ["2026-08-21", 11, 7],
], 15) === null);

const banned = ["stored", "last print", "printed", "took a bigger last step"];
const copy = `${SUPPLY_LABEL}\n${SUPPLY_NOTE}\n${readFileSync(new URL("../src/supply-off.js", import.meta.url), "utf8")}`;
for (const phrase of banned) {
  t(`copy does not say ${JSON.stringify(phrase)}`, !copy.toLowerCase().includes(phrase));
}

if (fail) process.exit(1);
console.log("supply off ok");
