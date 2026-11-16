/* ═══════════════════════════════════════════════════════════════════
   Draft Ambient — minimal 3D wireframe spheres on canvas
   Slowly rotating lat/long spheres, a dot-sphere and orbit rings,
   rendered behind the liquid-glass surfaces. Depth-faded strokes,
   pointer parallax, DPR-aware, pauses off-screen.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

var canvas = document.getElementById("bgCanvas");
if (!canvas) return;
var ctx = canvas.getContext("2d");
if (!ctx) return;

var reduceMotion =
  (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
  document.documentElement.getAttribute("data-motion") === "reduce";

var W = 0, H = 0, DPR = 1, T = 0;
var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

/* accent hues (match Spectral) */
var HUE_A = [141, 241, 255];  // ice cyan
var HUE_B = [122, 162, 255];  // periwinkle
var HUE_C = [196, 155, 255];  // orchid

function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
function lerp(a, b, t) { return a + (b - a) * t; }
function mix3(c1, c2, t) { return [lerp(c1[0], c2[0], t) | 0, lerp(c1[1], c2[1], t) | 0, lerp(c1[2], c2[2], t) | 0]; }
function ringColor(t) { return t < 0.5 ? mix3(HUE_A, HUE_B, t * 2) : mix3(HUE_B, HUE_C, (t - 0.5) * 2); }

/* ───────── sphere point factories ───────── */
function latitudeRing(lat, segs) {
  var pts = [];
  var r = Math.cos(lat), y = Math.sin(lat);
  for (var i = 0; i <= segs; i++) {
    var th = (i / segs) * Math.PI * 2;
    pts.push({ x: r * Math.cos(th), y: y, z: r * Math.sin(th) });
  }
  return pts;
}
function longitudeRing(lon, segs) {
  var pts = [];
  var c = Math.cos(lon), s = Math.sin(lon);
  for (var i = 0; i <= segs; i++) {
    var ph = (i / segs) * Math.PI * 2;
    // great circle through the poles, rotated around Y
    var x = Math.cos(ph), y = Math.sin(ph), z = 0;
    pts.push({ x: x * c, y: y, z: x * s });
  }
  return pts;
}
function fibonacciSphere(n) {
  var pts = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < n; i++) {
    var y = 1 - (i / (n - 1)) * 2;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var th = ga * i;
    pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r });
  }
  return pts;
}

/* ───────── scene definition ───────── */
var spheres = [
  {
    kind: "wire", nx: 0.82, ny: 0.17, r: 0.30, // fraction of min(W,H)… scaled below
    rBase: 240, lat: 6, lon: 9, segs: 72,
    speed: 0.00016, tilt: 0.42, bob: 16, bobSpeed: 0.00023, phase: 0.0,
    alpha: 0.5, hueShift: 0.0, parallax: 1.6
  },
  {
    kind: "wire", nx: 0.13, ny: 0.85, r: 0.19,
    rBase: 165, lat: 5, lon: 8, segs: 64,
    speed: -0.00021, tilt: -0.34, bob: 20, bobSpeed: 0.00019, phase: 2.1,
    alpha: 0.4, hueShift: 0.25, parallax: 2.3
  },
  {
    kind: "dots", nx: 0.33, ny: 0.28, r: 0.075,
    rBase: 64, count: 150, segs: 48,
    speed: 0.00028, tilt: 0.35, bob: 12, bobSpeed: 0.00031, phase: 4.4,
    alpha: 0.75, hueShift: 0.6, parallax: 3.4
  }
];
// precompute geometry once
spheres.forEach(function (sp) {
  sp.latRings = [];
  if (sp.lat) {
    for (var i = 1; i <= sp.lat; i++) {
      var lat = (i / (sp.lat + 1) - 0.5) * Math.PI * 0.92;
      sp.latRings.push(latitudeRing(lat, sp.segs));
    }
  }
  sp.lonRings = [];
  if (sp.lon) {
    for (var j = 0; j < sp.lon; j++) {
      sp.lonRings.push(longitudeRing((j / sp.lon) * Math.PI, sp.segs));
    }
  }
  sp.dotPts = sp.count ? fibonacciSphere(sp.count) : null;
  sp.equator = latitudeRing(0, 72);
});

var stars = [];
for (var i = 0; i < 110; i++) {
  stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.25 + 0.3, a: Math.random() * 0.45 + 0.08, tw: Math.random() * Math.PI * 2, tws: 0.0006 + Math.random() * 0.0009 });
}

/* ───────── resize ───────── */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* ───────── frame drawing ───────── */
function project(p, cx, cy, R, rotY, tiltX) {
  // rotate around Y
  var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  var x1 = p.x * cosY + p.z * sinY;
  var z1 = -p.x * sinY + p.z * cosY;
  // tilt around X
  var cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
  var y2 = p.y * cosX - z1 * sinX;
  var z2 = p.y * sinX + z1 * cosX;
  // gentle perspective
  var persp = 1 / (1 - z2 * 0.18);
  return { x: cx + x1 * R * persp, y: cy + y2 * R * persp, z: z2 };
}

function drawRing(ring, cx, cy, R, rotY, tiltX, color, alpha, lineWidth) {
  var prev = null;
  for (var i = 0; i < ring.length; i++) {
    var pt = project(ring[i], cx, cy, R, rotY, tiltX);
    if (prev) {
      var facing = (pt.z + prev.z) * 0.5;          // -1..1
      var depth = 0.5 + 0.5 * facing;               // 1 = front, 0 = back
      var a = alpha * (0.10 + 0.9 * Math.pow(depth, 1.6));
      if (a > 0.015) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth * (0.55 + depth * 0.75);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    }
    prev = pt;
  }
}

function drawSphere(sp, t, par) {
  var minDim = Math.min(W, H);
  var R = Math.min(sp.rBase, minDim * sp.r * 1.28);
  if (R < 26) return;
  var bob = Math.sin(t * sp.bobSpeed + sp.phase) * sp.bob;
  var cx = sp.nx * W + par.x * sp.parallax * 9;
  var cy = sp.ny * H + bob + par.y * sp.parallax * 9;
  var rotY = t * sp.speed;
  var tiltX = sp.tilt + Math.sin(t * 0.00011 + sp.phase) * 0.08;

  // faint glass body behind the wireframe
  var bodyG = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.02);
  bodyG.addColorStop(0, "rgba(190,214,255,0.055)");
  bodyG.addColorStop(0.55, "rgba(140,165,235,0.028)");
  bodyG.addColorStop(1, "rgba(120,140,220,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = bodyG;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2); ctx.fill();

  // latitude rings
  var i, n = sp.latRings.length;
  for (i = 0; i < n; i++) {
    var tf = i / Math.max(1, n - 1);
    var col = ringColor(Math.min(1, Math.max(0, tf * 0.85 + sp.hueShift * 0.15)));
    drawRing(sp.latRings[i], cx, cy, R, rotY, tiltX, rgba(col, 1), sp.alpha, 1.05);
  }
  // longitude rings
  for (i = 0; i < sp.lonRings.length; i++) {
    var tf2 = i / Math.max(1, sp.lonRings.length - 1);
    var col2 = ringColor(Math.min(1, Math.max(0, tf2 * 0.8 + 0.1 + sp.hueShift * 0.2)));
    drawRing(sp.lonRings[i], cx, cy, R, rotY + Math.PI / sp.lonRings.length * 0.5, tiltX, rgba(col2, 1), sp.alpha * 0.92, 1.0);
  }
  // equator accent — brighter, fading at the limbs
  drawRing(sp.equator, cx, cy, R, rotY, tiltX, rgba(ringColor(0.15 + sp.hueShift * 0.5), 1), sp.alpha * 0.9, 1.25);

  // dot sphere body
  if (sp.dotPts) {
    for (i = 0; i < sp.dotPts.length; i++) {
      var pt = project(sp.dotPts[i], cx, cy, R, rotY, tiltX);
      var facing2 = 0.5 + 0.5 * pt.z;
      var tw = 0.72 + 0.28 * Math.sin(t * 0.0021 + i * 1.7);
      var a2 = sp.alpha * Math.pow(facing2, 2.1) * tw;
      if (a2 <= 0.02) continue;
      var dotR = 0.7 + facing2 * 1.55;
      var col3 = ringColor((i / sp.dotPts.length + sp.hueShift) % 1);
      ctx.globalAlpha = a2;
      ctx.fillStyle = rgba(col3, 1);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2); ctx.fill();
    }
  }

  // fresnel rim — a luminous fading circle outline
  var rimG = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.045);
  rimG.addColorStop(0, "rgba(170,200,255,0)");
  rimG.addColorStop(0.62, "rgba(170,200,255," + (0.16 * sp.alpha + 0.05) + ")");
  rimG.addColorStop(0.92, "rgba(220,235,255," + (0.34 * sp.alpha + 0.08) + ")");
  rimG.addColorStop(1, "rgba(190,210,255,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = rimG;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2); ctx.fill();
}

function drawOrbitRing(sp, t, par) {
  var minDim = Math.min(W, H);
  var R = Math.min(sp.rBase, minDim * sp.r * 1.28);
  var bob = Math.sin(t * sp.bobSpeed + sp.phase) * sp.bob;
  var cx = sp.nx * W + par.x * sp.parallax * 9;
  var cy = sp.ny * H + bob + par.y * sp.parallax * 9;
  // two tilted decorative elliptical orbits with travelling satellites
  var tilts = [0.32, -0.42];
  for (var k = 0; k < tilts.length; k++) {
    var tilt = tilts[k];
    var rx = R * (1.28 + k * 0.42), ry = rx * Math.abs(Math.sin(tilt) + 0.28);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt * 0.55);
    // fade the ellipse ends by stroking as an arc gradient is not possible — use dashes
    ctx.globalAlpha = 0.32 - k * 0.1;
    ctx.strokeStyle = rgba(mix3(HUE_A, HUE_C, 0.35 + k * 0.45), 1);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // satellite (radial-gradient glow — no shadowBlur)
    var ang = t * (0.00024 + k * 0.0001) * (k ? -1 : 1) + sp.phase + k * 2.4;
    var sx = Math.cos(ang) * rx, sy = Math.sin(ang) * ry;
    var sat = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5.2);
    sat.addColorStop(0, "rgba(240,247,255,0.98)");
    sat.addColorStop(0.32, "rgba(200,224,255,0.85)");
    sat.addColorStop(1, "rgba(170,205,255,0)");
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = sat;
    ctx.beginPath(); ctx.arc(sx, sy, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function frame(t) {
  T = t;
  ctx.clearRect(0, 0, W, H);

  // ease pointer parallax
  pointer.x += (pointer.tx - pointer.x) * 0.045;
  pointer.y += (pointer.ty - pointer.y) * 0.045;
  var par = { x: (pointer.x - 0.5) * 2, y: (pointer.y - 0.5) * 2 };

  // stars
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    var tw = 0.55 + 0.45 * Math.sin(t * s.tws + s.tw);
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = "#dfe8ff";
    ctx.beginPath(); ctx.arc(s.x * W + par.x * 3, s.y * H + par.y * 3, s.r, 0, Math.PI * 2); ctx.fill();
  }

  drawOrbitRing(spheres[1], t, par);
  drawSphere(spheres[1], t, par);
  drawSphere(spheres[0], t, par);
  drawSphere(spheres[2], t, par);

  ctx.globalAlpha = 1;
}

var rafId = 0;
var lastFrame = 0;
var FRAME_INTERVAL = 33; // ~30fps — the ambient canvas renders behind glass; half rate is indistinguishable
function loop(t) {
  rafId = requestAnimationFrame(loop);
  t = t || 0;
  if (t - lastFrame < FRAME_INTERVAL) return;
  lastFrame = t;
  frame(t);
}
var resizeTimer = 0;
resize();
window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 160);
}, { passive: true });
window.addEventListener("pointermove", function (e) {
  pointer.tx = e.clientX / Math.max(1, W);
  pointer.ty = e.clientY / Math.max(1, H);
}, { passive: true });
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
  else if (!rafId && !reduceMotion) { rafId = requestAnimationFrame(loop); }
});
/* re-evaluate reduced motion if the preference flips */
if (window.matchMedia) {
  var mm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var onChange = function () {
    reduceMotion = mm.matches || document.documentElement.getAttribute("data-motion") === "reduce";
    if (reduceMotion) { cancelAnimationFrame(rafId); rafId = 0; frame(0); }
    else if (!rafId) { rafId = requestAnimationFrame(loop); }
  };
  if (mm.addEventListener) mm.addEventListener("change", onChange);
}
/* react to the in-app motion toggle */
window.addEventListener("draft:motion", function () {
  var reduced = document.documentElement.getAttribute("data-motion") === "reduce";
  if (reduced) { cancelAnimationFrame(rafId); rafId = 0; frame(0); }
  else if (!rafId) { rafId = requestAnimationFrame(loop); }
});

if (reduceMotion) { frame(0); } else { rafId = requestAnimationFrame(loop); }

})();
