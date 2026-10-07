import { commit, peek, readUser } from "./quota.mjs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/card-img" && request.method === "GET") {
      const pid = Number(url.searchParams.get("pid"));
      if (!Number.isFinite(pid) || pid <= 0) return new Response("Bad", { status: 400 });
      const img = await fetch("https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_in_400x400.jpg");
      if (!img.ok) return new Response("Not found", { status: 404 });
      return new Response(img.body, { headers: { "content-type": img.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" } });
    }
    if (url.pathname === "/api/video/quota" && request.method === "POST") {
      const user = await readUser(request, env);
      let body = {};
      try { body = await request.json(); } catch { body = {}; }
      const gate = peek(user, "video");
      if (!gate.ok) return json({ ...gate, premium: false, dayUsed: gate.dayUsed || 0, weekUsed: gate.weekUsed || 0 }, gate.status);
      if (body.action === "complete") commit(user, "video");
      const after = peek(user, "video");
      return json({
        ok: true,
        signedIn: true,
        premium: user.premium === true,
        dayUsed: after.dayUsed,
        weekUsed: after.weekUsed,
        dayCap: after.dayCap,
        weekCap: after.weekCap,
      });
    }
    if ((url.pathname === "/video" || url.pathname.startsWith("/video/")) && env?.VIDEO_ENABLED !== "true") {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
