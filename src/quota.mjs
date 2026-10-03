// Sign-in caps. A browser cookie that is not a signed session does not count.

export const LIMITS = {
  ideas: { free: 3, premium: 50 },
  "post-text": { free: 3, premium: 100 },
  video: { freeDay: 1, premiumDay: 5, freeWeek: 2, premiumWeek: 35 },
};

const usage = new Map();

export function pacificDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function b64url(text) {
  return btoa(text).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(user, secret, now = Date.now()) {
  const payload = {
    sub: String(user.sub || ""),
    premium: user.premium === true,
    exp: now + 30 * 86400000,
  };
  const body = b64url(JSON.stringify(payload));
  return body + "." + await hmac(secret, body);
}

export async function readUser(request, env) {
  const secret = env && env.SESSION_SECRET;
  if (!secret) return null;
  const header = request.headers.get("cookie") || "";
  const raw = header.split(";").map((p) => p.trim()).find((p) => p.startsWith("ce_session="));
  if (!raw) return null;
  const token = decodeURIComponent(raw.slice("ce_session=".length));
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = await hmac(secret, body);
  if (expect.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(body));
  } catch {
    return null;
  }
  if (!payload || !payload.sub || Number(payload.exp) < Date.now()) return null;
  return { sub: String(payload.sub), premium: payload.premium === true };
}

function bucket(sub, feature) {
  const key = sub + ":" + feature;
  const now = Date.now();
  const recent = (usage.get(key) || []).filter((t) => now - t < 7 * 86400000);
  usage.set(key, recent);
  const day = pacificDay();
  const dayUsed = recent.filter((t) => pacificDay(new Date(t)) === day).length;
  return { recent, dayUsed, weekUsed: recent.length };
}

export function signInCard(feature) {
  if (feature === "video") {
    return {
      title: "Sign in to export",
      body: "Export is tied to the signed-in seat. A browser cookie is not a pass. Free is 1 a day and 2 a week. Premium is 5 a day and 35 a week.",
    };
  }
  if (feature === "ideas") {
    return {
      title: "Sign in for Ideas",
      body: "Ideas are 3 a day on a free seat and 50 a day on Premium. A browser cookie is not a pass.",
    };
  }
  return {
    title: "Sign in for post text",
    body: "Post text is 3 a day on a free seat and 100 a day on Premium. A browser cookie is not a pass.",
  };
}

export function limitCard(feature, cap, premium) {
  const seat = premium ? "Premium" : "Free";
  if (feature === "video") {
    return { title: "Export limit", body: `${seat} export limit is reached. It resets on the Pacific day, and the week cap still applies.` };
  }
  if (feature === "ideas") {
    return { title: "Ideas limit", body: `${seat} Ideas are capped at ${cap} a day. The count resets at midnight Pacific.` };
  }
  return { title: "Post text limit", body: `${seat} post text is capped at ${cap} a day. The count resets at midnight Pacific.` };
}

export function peek(user, feature) {
  if (!user) return { ok: false, status: 401, signedIn: false, card: signInCard(feature) };
  const spec = LIMITS[feature];
  const { dayUsed, weekUsed } = bucket(user.sub, feature);
  if (feature === "video") {
    const dayCap = user.premium ? spec.premiumDay : spec.freeDay;
    const weekCap = user.premium ? spec.premiumWeek : spec.freeWeek;
    if (dayUsed >= dayCap || weekUsed >= weekCap) {
      return { ok: false, status: 429, signedIn: true, premium: user.premium, dayUsed, weekUsed, dayCap, weekCap, card: limitCard(feature, dayCap, user.premium) };
    }
    return { ok: true, status: 200, signedIn: true, premium: user.premium, dayUsed, weekUsed, dayCap, weekCap };
  }
  const cap = user.premium ? spec.premium : spec.free;
  if (dayUsed >= cap) {
    return { ok: false, status: 429, signedIn: true, premium: user.premium, used: dayUsed, cap, card: limitCard(feature, cap, user.premium) };
  }
  return { ok: true, status: 200, signedIn: true, premium: user.premium, used: dayUsed, cap };
}

export function commit(user, feature) {
  const key = user.sub + ":" + feature;
  const { recent } = bucket(user.sub, feature);
  recent.push(Date.now());
  usage.set(key, recent);
}

export function resetQuota() {
  usage.clear();
}
