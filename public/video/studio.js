import {
  buildPack,
  cardFromRow,
  exportPlan,
  faceLeavesDevice,
  projectJson,
  quotaDecision,
  scriptFor,
  validateScript,
  watermarkFor,
} from "./engine.mjs";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const enabled = params.get("video") === "1" || sessionStorage.getItem("ce-video") === "1";

if (!enabled) {
  $("off").hidden = false;
} else {
  $("app").hidden = false;
  boot().catch((err) => {
    $("facts").textContent = "Could not open the catalog. Nothing was invented to fill the gap.";
    console.error(err);
  });
}

const state = {
  template: params.get("template") || "top5",
  rows: [],
  asof: "",
  source: "",
  setName: "151",
  ids: (params.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean),
  layout: "bubble",
  line: 0,
  takes: new Map(),
  images: new Map(),
  faceOn: false,
  lastBlob: null,
  lastName: "short.webm",
  playing: false,
};

async function boot() {
  $("template-note").textContent =
    "Price mover draws a change only when two dated TCGplayer market readings are supplied. This catalog snapshot has one date, so the Short says so.";
  const live = await loadLive();
  if (live) {
    state.rows = live.rows;
    state.asof = live.asof;
    state.source = live.source;
  } else {
    const fix = await fetch("/video/fixture.json").then((r) => r.json());
    state.rows = fix.cards;
    state.asof = fix.meta.asof;
    state.source = fix.meta.source || "";
    $("facts").textContent = "Using the frozen 151 snapshot (" + state.asof + "). Live catalog file was not on this host.";
  }
  const sets = [...new Set(state.rows.map((r) => r.set).filter(Boolean))].sort();
  const sel = $("set-pick");
  for (const name of sets) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    if (name === "151") o.selected = true;
    sel.appendChild(o);
  }
  if (state.ids.length) {
    const hit = state.rows.find((r) => r.id === state.ids[0]);
    if (hit?.set) {
      state.setName = hit.set;
      sel.value = hit.set;
    }
  }
  sel.onchange = () => {
    state.setName = sel.value;
    state.ids = [];
    render();
  };
  $("templates").onclick = (e) => {
    const b = e.target.closest("[data-template]");
    if (!b) return;
    state.template = b.getAttribute("data-template");
    render();
  };
  $("layouts").onclick = (e) => {
    const b = e.target.closest("[data-layout]");
    if (!b) return;
    state.layout = b.getAttribute("data-layout");
    for (const n of $("layouts").querySelectorAll("button")) n.classList.toggle("on", n === b);
  };
  $("handle").oninput = () => render();
  $("accent").oninput = () => render();
  $("btn-play").onclick = () => play(false);
  $("btn-export").onclick = () => play(true);
  $("btn-share").onclick = share;
  $("btn-thumb").onclick = thumbnail;
  $("btn-line-prev").onclick = () => stepLine(-1);
  $("btn-line-next").onclick = () => stepLine(1);
  $("btn-retake").onclick = retakeLine;
  $("btn-mirror").onclick = () => $("prompter").classList.toggle("mirror");
  $("btn-cam").onclick = startCam;
  $("btn-cam-off").onclick = stopCam;
  $("upload").onchange = onUpload;
  $("card-picks").onclick = (e) => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    const id = b.getAttribute("data-id");
    const i = state.ids.indexOf(id);
    if (i >= 0) state.ids.splice(i, 1);
    else if (state.ids.length < 8) state.ids.push(id);
    render();
  };
  await refreshQuota();
  render();
}

async function loadLive() {
  try {
    const [indexRes, priceRes] = await Promise.all([fetch("/cards/full/index.json"), fetch("/cards/prices.json")]);
    if (!indexRes.ok || !priceRes.ok) return null;
    const index = await indexRes.json();
    const prices = await priceRes.json();
    const rows = [];
    for (const row of index) {
      if (!row || row.set == null) continue;
      const card = cardFromRow(row, prices.usd, prices.asof);
      if (card) rows.push(card);
    }
    return { rows, asof: prices.asof || "", source: prices.source || "" };
  } catch {
    return null;
  }
}

function selectedCards() {
  const inSet = state.rows.filter((r) => r.set === state.setName && r.usd != null);
  if (state.template === "top5") {
    return inSet.slice().sort((a, b) => b.usd - a.usd).slice(0, 5);
  }
  if (state.template === "mover") {
    const id = state.ids[0];
    const one = id ? state.rows.find((r) => r.id === id) : inSet.slice().sort((a, b) => b.usd - a.usd)[0];
    return one ? [one] : [];
  }
  const pinned = state.ids.map((id) => state.rows.find((r) => r.id === id)).filter(Boolean);
  if (pinned.length) return pinned.slice(0, 8);
  return inSet.slice(0, 4);
}

function currentPack() {
  return buildPack(selectedCards(), { asof: state.asof, source: state.source });
}

function render() {
  for (const n of $("templates").querySelectorAll("button")) {
    n.classList.toggle("on", n.getAttribute("data-template") === state.template);
    n.classList.toggle("go", n.getAttribute("data-template") === state.template);
  }
  const pack = currentPack();
  const script = scriptFor(state.template, pack);
  state.pack = pack;
  state.script = script;
  const faults = script ? validateScript(script, pack) : ["empty"];
  state.faults = faults;
  $("script").textContent = script
    ? script.scenes.map((s, i) => `${i + 1}. ${s.spoken}`).join("\n\n")
    : "No cards in this set.";
  const priced = pack.cards.filter((c) => c.priceLabel).length;
  $("facts").textContent = `${pack.cards.length} cards · ${priced} with a dated TCGplayer market · catalog ${pack.asof || "undated"} · ${pack.source || "catalog"}`;
  const check = $("check");
  if (!faults.length) {
    check.className = "ok";
    check.textContent = "Fact check passed. Every price in the script is a catalog label.";
  } else {
    check.className = "fault";
    check.textContent = "Export blocked: " + faults.join(", ");
  }
  $("btn-export").disabled = faults.length > 0;
  paintPicks();
  stepLine(0);
  const plan = exportPlan({ durationSec: script?.duration || 1, hasFace: state.faceOn || state.takes.size > 0 });
  $("estimate").textContent = script
    ? `About ${Math.round(script.duration)}s. ${plan.note} Estimated render ${Math.round(plan.ms / 1000)}s at ${plan.width}×${plan.height}.`
    : "";
  paintQuota();
  drawAt(0);
}

function paintPicks() {
  const box = $("card-picks");
  if (state.template === "top5") {
    box.innerHTML = "";
    return;
  }
  const pool = state.rows.filter((r) => r.set === state.setName && r.usd != null).slice().sort((a, b) => b.usd - a.usd).slice(0, 8);
  box.innerHTML = "";
  for (const c of pool) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = c.id;
    b.textContent = c.name;
    if (state.ids.includes(c.id)) b.className = "on";
    box.appendChild(b);
  }
}

function stepLine(delta) {
  const scenes = state.script?.scenes || [];
  if (!scenes.length) return;
  if (delta) state.line = Math.max(0, Math.min(scenes.length - 1, state.line + delta));
  const sc = scenes[state.line];
  $("prompter").textContent = sc.spoken;
  const take = state.takes.has(sc.id) ? "Line recorded on this device." : "No take for this line yet.";
  $("line-note").textContent = `Line ${state.line + 1} of ${scenes.length}. ${take}`;
}

async function startCam() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("line-note").textContent = "This browser has no camera API. You can still export the card Short.";
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  state.stream = stream;
  const v = $("cam");
  v.hidden = false;
  v.srcObject = stream;
  await v.play();
  state.faceOn = true;
  $("estimate").textContent += " Camera stays in the browser. faceLeavesDevice=" + faceLeavesDevice();
}

function stopCam() {
  state.faceOn = false;
  const v = $("cam");
  v.hidden = true;
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  v.srcObject = null;
}

function onUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const v = $("cam");
  if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
  state.uploadUrl = URL.createObjectURL(file);
  v.hidden = false;
  v.srcObject = null;
  v.src = state.uploadUrl;
  v.muted = true;
  v.loop = true;
  v.play();
  state.faceOn = true;
  $("line-note").textContent = "Clip stays in this tab. It is not uploaded.";
}

function retakeLine() {
  const sc = state.script?.scenes?.[state.line];
  if (!sc) return;
  const cam = $("cam");
  if (!state.faceOn || cam.readyState < 2) {
    $("line-note").textContent = "Turn the camera on or upload a clip, then retake the line.";
    return;
  }
  const recCanvas = document.createElement("canvas");
  recCanvas.width = 270;
  recCanvas.height = 480;
  const ctx = recCanvas.getContext("2d");
  const stream = recCanvas.captureStream(12);
  const mime = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const bits = [];
  rec.ondataavailable = (ev) => { if (ev.data.size) bits.push(ev.data); };
  const timer = setInterval(() => {
    ctx.drawImage(cam, 0, 0, recCanvas.width, recCanvas.height);
  }, 80);
  rec.onstop = () => {
    clearInterval(timer);
    const blob = new Blob(bits, { type: rec.mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const vid = document.createElement("video");
    vid.src = url;
    vid.muted = true;
    vid.playsInline = true;
    state.takes.set(sc.id, vid);
    stepLine(0);
  };
  rec.start();
  setTimeout(() => rec.stop(), Math.max(800, sc.duration * 1000));
  $("line-note").textContent = "Recording this line on the device…";
}

function brand() {
  return { handle: $("handle").value, accent: $("accent").value };
}

async function ensureImages(pack) {
  await Promise.all(pack.cards.map(async (c) => {
    if (!c.image || state.images.has(c.id)) return;
    const img = new Image();
    img.decoding = "async";
    const ok = await new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = c.image.startsWith("/img/") ? c.image : c.image;
    });
    state.images.set(c.id, ok ? img : null);
  }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFace(ctx, w, h) {
  const live = $("cam");
  const sc = sceneAt(state.drawT || 0);
  const take = sc && state.takes.get(sc.id);
  const src = take && take.readyState >= 2 ? take : state.faceOn && live.readyState >= 2 ? live : null;
  if (!src) return;
  const layout = state.layout;
  if (layout === "split") {
    ctx.save();
    ctx.drawImage(src, 0, 0, w * 0.42, h);
    ctx.restore();
    return;
  }
  const bw = layout === "cutout" ? w * 0.7 : w * 0.34;
  const bh = bw * 1.25;
  const x = layout === "cutout" ? (w - bw) / 2 : w - bw - 28;
  const y = layout === "cutout" ? h * 0.42 : h - bh - 220;
  if (layout === "chroma") {
    const off = document.createElement("canvas");
    off.width = 120;
    off.height = 160;
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.drawImage(src, 0, 0, off.width, off.height);
    const frame = octx.getImageData(0, 0, off.width, off.height);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 1] > 90 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.4) d[i + 3] = 0;
    }
    octx.putImageData(frame, 0, 0);
    ctx.drawImage(off, x, y, bw, bh);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + bw / 2, y + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(src, x, y, bw, bh);
  ctx.restore();
}

function sceneAt(t) {
  const scenes = state.script?.scenes || [];
  return scenes.find((s) => t >= s.t0 && t < s.t0 + s.duration) || scenes.at(-1);
}

function drawAt(t) {
  state.drawT = t;
  const canvas = $("stage");
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / 540;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const w = 540;
  const h = 960;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, w, h);
  const sc = sceneAt(t);
  if (!sc) return;
  const accent = /^#[0-9a-fA-F]{6}$/.test($("accent").value) ? $("accent").value : "#7eb6ff";
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, 10);
  const cardId = (sc.factRefs || []).find((r) => r.startsWith("card:"));
  const id = cardId ? cardId.slice(5) : "";
  const img = id && state.images.get(id);
  if (img && state.layout !== "split") {
    const iw = 250;
    const ih = 350;
    ctx.drawImage(img, (w - iw) / 2, 150, iw, ih);
  } else if (img && state.layout === "split") {
    ctx.drawImage(img, w * 0.46, 180, 250, 350);
  }
  drawFace(ctx, w, h);
  const lines = String(sc.onScreen || "").split("\n").slice(0, 6);
  ctx.fillStyle = "#f2f3f5";
  ctx.font = sc.id === "hook" ? "700 42px sans-serif" : "600 28px sans-serif";
  ctx.textAlign = "center";
  let y = sc.id === "hook" ? 430 : 620;
  for (const line of lines) {
    ctx.fillText(line.slice(0, 42), w / 2, y, w - 48);
    y += sc.id === "hook" ? 52 : 36;
  }
  const local = t - sc.t0;
  const cues = sc.cues || [];
  let shown = cues.filter((c) => c.t - sc.t0 <= local).map((c) => c.w).join(" ");
  const cut = shown.indexOf("TCGplayer");
  if (cut >= 0) shown = shown.slice(0, cut).trim();
  if (shown.includes("$")) shown = shown.split("$")[0].trim();
  shown = shown.slice(-80);
  if (shown) {
    roundRect(ctx, 24, h - 250, w - 48, 86, 14);
    ctx.fillStyle = "rgba(20,20,22,0.92)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(shown.slice(-80), w / 2, h - 198, w - 72);
  }
  const mark = watermarkFor(false);
  ctx.font = "500 14px sans-serif";
  ctx.fillStyle = "rgba(230,215,184,0.8)";
  ctx.fillText(mark, w / 2, h - 120, w - 40);
  const handle = ($("handle").value || "").trim();
  if (handle) {
    ctx.fillStyle = accent;
    ctx.font = "600 16px sans-serif";
    ctx.fillText(handle.slice(0, 32), w / 2, 48, w - 40);
  }
  ctx.fillStyle = "#9a9aa3";
  ctx.font = "14px sans-serif";
  ctx.fillText(state.asof ? "Catalog " + state.asof : "", w / 2, h - 88);
}

async function refreshQuota() {
  try {
    const res = await fetch("/api/video/quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
    });
    if (!res.ok) throw new Error("status");
    state.quota = await res.json();
  } catch {
    state.quota = null;
  }
  paintQuota();
}

function paintQuota() {
  const q = state.quota;
  const faults = state.faults || [];
  if (!q) {
    $("quota").textContent = "Weekly cap is not connected on this host. Export stays off so the limit cannot be skipped.";
    $("btn-export").disabled = true;
    return;
  }
  const decision = quotaDecision({ weekUsed: q.weekUsed, dayUsed: q.dayUsed, premium: false });
  $("quota").textContent = `Free cap: ${q.dayUsed}/${decision.dayCap} today, ${q.weekUsed}/${decision.weekCap} this week. Premium is not signed in.`;
  $("upgrade").hidden = decision.ok;
  $("btn-export").disabled = faults.length > 0 || !decision.ok;
}

async function play(record) {
  const pack = state.pack;
  const script = state.script;
  if (!script || state.faults?.length) return;
  if (record) {
    if (!state.quota) return;
    const gate = await fetch("/api/video/quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reserve", template: state.template }),
    });
    const body = await gate.json().catch(() => ({}));
    if (!gate.ok || body.ok === false) {
      state.quota = body;
      paintQuota();
      $("upgrade").hidden = false;
      $("export-note").textContent = "Cap reached. Nothing was exported.";
      return;
    }
  }
  await ensureImages(pack);
  if (state.playing) return;
  state.playing = true;
  const canvas = $("stage");
  const plan = exportPlan({ durationSec: script.duration, hasFace: state.faceOn || state.takes.size > 0 });
  const prevSize = [canvas.width, canvas.height];
  if (record && plan.mode === "local") {
    canvas.width = plan.width;
    canvas.height = plan.height;
  }
  let rec = null;
  let chunks = [];
  let audioCtx = null;
  if (record && plan.mode !== "server-blocked") {
    const stream = canvas.captureStream(24);
    audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 196;
    const ducked = state.takes.size > 0;
    gain.gain.value = ducked ? 0.015 : 0.04;
    osc.connect(gain);
    const dest = audioCtx.createMediaStreamDestination();
    gain.connect(dest);
    osc.start();
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: canvas.width >= 1080 ? 2500000 : 1200000 });
    rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
    rec.start();
    $("export-note").textContent = `Exporting ${mime} at ${canvas.width}×${canvas.height}. ${plan.note} Music is an original tone, quieter when a face take exists.`;
  } else if (record) {
    canvas.width = prevSize[0];
    canvas.height = prevSize[1];
    $("export-note").textContent = plan.note;
    state.playing = false;
    return;
  }
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      const t = (now - t0) / 1000;
      drawAt(Math.min(t, script.duration));
      const sc = sceneAt(t);
      if (sc) $("prompter").textContent = sc.spoken;
      if (t < script.duration) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  if (rec) {
    await new Promise((resolve) => {
      rec.onstop = resolve;
      rec.stop();
    });
    if (audioCtx) audioCtx.close();
    const type = rec.mimeType || "video/webm";
    const blob = new Blob(chunks, { type });
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isFtyp = head.length > 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
    state.lastBlob = blob;
    state.lastName = isFtyp ? "short.mp4" : "short.webm";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.lastName;
    a.click();
    $("btn-share").disabled = false;
    const done = await fetch("/api/video/quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", template: state.template }),
    });
    state.quota = await done.json();
    paintQuota();
    const project = projectJson({ template: state.template, pack, script, brand: brand() });
    $("export-note").textContent =
      `Saved ${state.lastName} (${Math.round(blob.size / 1000)} KB) at ${canvas.width}×${canvas.height}. ${isFtyp ? "The file has an MP4 header. The codec is whatever this browser recorded, which may not be H.264." : "This browser recorded WebM, not MP4."} Project keeps catalog ${project.catalogAsOf}. Face file was not sent.`;
  }
  canvas.width = prevSize[0];
  canvas.height = prevSize[1];
  state.playing = false;
  drawAt(0);
}

async function share() {
  if (!state.lastBlob) return;
  const file = new File([state.lastBlob], state.lastName, { type: state.lastBlob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: state.script?.title || "Short" });
    return;
  }
  $("export-note").textContent = "This browser has no file share sheet. The download is the share.";
}

function thumbnail() {
  drawAt(0.2);
  const a = document.createElement("a");
  a.href = $("stage").toDataURL("image/png");
  a.download = "short-thumb.png";
  a.click();
}
