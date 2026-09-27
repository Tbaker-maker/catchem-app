// Run clock for The Feed and the Board. Older than 48 hours keeps the date and says STALE.
export const FRESH_HOURS = 48;

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
  const at = new Date(t).toISOString();
  const label = `Updated ${formatPt(iso)}`;
  if ((now - t) / 3600000 > FRESH_HOURS) return { label: `${label} · STALE`, delayed: true, at };
  return { label, delayed: false, at };
}

export function stampHtml(html, iso, now = Date.now()) {
  const fresh = freshnessFrom(iso, now);
  let out = String(html || "")
    .replaceAll("Morning Pulse —", "The Feed —")
    .replaceAll("MORNING PULSE", "THE FEED")
    .replaceAll("Get the Morning Pulse", "Get The Feed");
  const block = `<div class="byline" id="fresh" data-at="${fresh.at || ""}">${fresh.label}</div>`;
  if (out.includes('id="fresh"')) out = out.replace(/<div class="[^"]*" id="fresh"[^>]*>[^<]*<\/div>/, block);
  else if (out.includes("<body>")) out = out.replace("<body>", `<body>${block}`);
  else out = block + out;
  const script = `<script id="fresh-stamp-script">document.addEventListener("DOMContentLoaded",function(){var el=document.getElementById("fresh");if(!el)return;var t=Date.parse(el.getAttribute("data-at")||"");if(!isFinite(t))return;if((Date.now()-t)/36e5>48){el.textContent=el.textContent.replace(/ · STALE$/,"")+" · STALE";}});</script>`;
  if (out.includes("fresh-stamp-script")) {
    out = out.replace(/<script id="fresh-stamp-script">[\s\S]*?<\/script>/, script);
  } else {
    out = out.includes("</body>") ? out.replace("</body>", `${script}</body>`) : out + script;
  }
  return out;
}