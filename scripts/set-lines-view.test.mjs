import { setLineBlock } from "./set-lines-view.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};
const live = setLineBlock({ sealed: { status: "live", level: 101.2 }, chase: { status: "live", level: 98.4, names: ["Chase"] } });
t("live lines stay apart", live.includes("Sealed line") && live.includes("101.2") && live.includes("Chase line") && live.includes("98.4") && live.includes("Chase"));
const thin = setLineBlock({ sealed: { status: "building history", level: null }, chase: { status: "building history", level: null, names: [] } });
t("thin data says building history", thin.includes("building history") && !thin.includes("null"));
t("missing file is still a block", setLineBlock(null).includes("building history"));
if (fail) process.exit(1);
console.log("set lines view ok");
