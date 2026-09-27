// Sealed line and chase line. Never one blended number.
export function lineCell(side) {
  if (!side || side.status !== "live" || side.level == null) return "building history";
  return String(side.level);
}

export function setLineBlock(line) {
  const names = line?.chase?.names?.length ? ` (${line.chase.names.join(", ")})` : "";
  return `<div class="life"><b>Sealed line</b> ${lineCell(line?.sealed)} · <b>Chase line</b> ${lineCell(line?.chase)}${names}<div>Two lines. Sealed uses sealed products only. Chase uses chase singles only. They are not averaged.</div></div>`;
}
