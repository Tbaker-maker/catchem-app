// Run clock for The Feed and the Board. 36 hours late means Data delayed.
export const FRESH_HOURS = 36;

export function formatPt(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  return `${clock} PT`;
}

export function freshnessFrom(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return { label: "Data delayed", delayed: true, at: null };
  const ageHours = (now - t) / 3600000;
  if (ageHours > FRESH_HOURS) return { label: "Data delayed", delayed: true, at: new Date(t).toISOString() };
  return { label: `Updated ${formatPt(iso)}`, delayed: false, at: new Date(t).toISOString() };
}

export function stampHtml(html, iso, now = Date.now()) {
  const fresh = freshnessFrom(iso, now);
  let out = String(html || "")
    .replaceAll("Morning Pulse —", "The Feed —")
    .replaceAll("MORNING PULSE", "THE FEED")
    .replaceAll("Get the Morning Pulse", "Get The Feed");
  const block = `<div class="byline" id="fresh" data-at="${fresh.at || ""}">${fresh.label}</div>`;
  if (out.includes('id="fresh"')) out = out.replace(/<div class="byline" id="fresh"[^>]*>[^<]*<\/div>/, block);
  else if (out.includes("<body>")) out = out.replace("<body>", `<body>${block}`);
  else out = block + out;
  if (!out.includes("fresh-stamp-script")) {
    const script = `<script id="fresh-stamp-script">document.addEventListener("DOMContentLoaded",function(){var el=document.getElementById("fresh");if(!el)return;var t=Date.parse(el.getAttribute("data-at")||"");if(!isFinite(t)||(Date.now()-t)/36e5>36)el.textContent="Data delayed";});</script>`;
    out = out.includes("</body>") ? out.replace("</body>", `${script}</body>`) : out + script;
  }
  return out;
}
