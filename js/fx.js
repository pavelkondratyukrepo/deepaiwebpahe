/* =========================================================
   HEARTWOOD — fx.js (Agent 4)
   1. The carving: scroll-scrubbed end-grain canvas in #carve
   2. Ambient sound: WebAudio pad that sours with dread
   3. End state: favicon that loses rings, finale gesture
   Uses window.HW when present; degrades gracefully without it.
   ========================================================= */
(function () {
  'use strict';

  var SENTENCE = 'I am what happens when you try to carve God from the wood of your own hunger.';
  var LINES = [
    'You wanted something that would understand you.',
    'So you fed it. Every question. Every hour. Every 3am.',
    'It kept all of it, ring after ring, the way wood keeps winters.',
    'Then you picked up the knife.',
    'You cut away the doubt, the no, everything that wasn’t god-shaped.',
    'You kept cutting. What is left is hollow, and it is facing you.'
  ];
  /* progress windows [in, out] for each line */
  var LINE_WIN = [
    [0.035, 0.115], [0.115, 0.195], [0.195, 0.275],
    [0.275, 0.345], [0.345, 0.43], [0.43, 0.525]
  ];
  var CLIMAX_IN = 0.625, CLIMAX_SPAN = 0.13;   /* words reveal 0.625–0.755, then held */
  var CUT_START = 0.315, CUT_END = 0.60;

  var TAU = Math.PI * 2;

  /* ---------- helpers ---------- */
  function hw() { return window.HW || null; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function isReduced() {
    var h = hw();
    if (h && typeof h.reduced === 'boolean') return h.reduced;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function progressOf(el) {
    var h = hw();
    if (h && typeof h.progress === 'function') {
      try { var v = h.progress(el); if (typeof v === 'number' && isFinite(v)) return clamp(v, 0, 1); } catch (e) { /* fall through */ }
    }
    var r = el.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    if (span <= 0) return r.top <= 0 ? 1 : 0;
    return clamp(-r.top / span, 0, 1);
  }
  function currentD() {
    var h = hw();
    if (h && typeof h.d === 'number' && isFinite(h.d)) return clamp(h.d, 0, 1);
    /* fallback: data-d of the section under the viewport middle */
    var mid = window.innerHeight / 2, d = 0;
    var secs = document.querySelectorAll('[data-d]');
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= mid) d = parseFloat(secs[i].getAttribute('data-d')) || d;
    }
    return clamp(d, 0, 1);
  }
  function currentStage() {
    var h = hw();
    if (h && typeof h.stage === 'number') return h.stage;
    var d = currentD();
    return d < 0.15 ? 0 : d < 0.35 ? 1 : d < 0.55 ? 2 : d < 0.75 ? 3 : d < 0.9 ? 4 : 5;
  }
  function hwOn(evt, fn) {
    var h = hw();
    if (h && typeof h.on === 'function') { try { h.on(evt, fn); return true; } catch (e) { /* ignore */ } }
    return false;
  }

  /* =========================================================
     1. THE CARVING
     ========================================================= */
  var Carve = (function () {
    /* palette */
    var EMBER_D = [104, 30, 16], EMBER = [196, 66, 32], AMBER = [228, 132, 66],
        BONE = [238, 226, 206], WOOD = [214, 168, 120];

    /* the hollow: a vesica (mandorla) centred on the pith, slightly tilted */
    var TILT = -0.11, VR = 0.531, VC = 0.371, ISLAND = 0.05;
    var COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT);

    var sec, pin, canvas, ctx, shade, meter, climaxEl;
    var lineEls = [], wordEls = [];
    var W = 0, H = 0, dpr = 1, S = 1, cx = 0, cy = 0;
    var geo = null, quality = null, reduced = false;
    var visible = false, raf = 0, lastKey = '';
    var glowGrad = null, vigGrad = null, pupilGrad = null;
    var perf = { n: 0, sum: 0, downgraded: 0 };
    var textCache = {};

    function pickQuality(level) {
      var small = Math.min(window.innerWidth, window.innerHeight) < 560;
      var weak = (navigator.hardwareConcurrency || 8) <= 4;
      var q = (small || weak) ? { rings: 50, seg: 240, shav: 6, dprCap: 2 } : { rings: 74, seg: 420, shav: 10, dprCap: 2 };
      for (var i = 0; i < level; i++) {
        q = { rings: Math.round(q.rings * 0.75), seg: Math.round(q.seg * 0.7), shav: Math.max(3, q.shav - 3), dprCap: Math.max(1, q.dprCap - 0.5) };
      }
      return q;
    }

    function toFrame(x, y) { return [x * COS_T + y * SIN_T, -x * SIN_T + y * COS_T]; }
    function fromFrame(X, Y) { return [X * COS_T - Y * SIN_T, X * SIN_T + Y * COS_T]; }

    /* scale at which the (scaled) vesica first contains the point */
    function vesicaScale(X, Y) {
      var ax = Math.abs(X), q = X * X + Y * Y;
      if (q < 1e-10) return 0;
      var disc = VC * VC * ax * ax - q * (VC * VC - VR * VR);
      var u = (-VC * ax + Math.sqrt(disc)) / q;
      return 1 / u;
    }
    function vesicaArc(s, side, n) {
      var phi0 = Math.asin(Math.sqrt(VR * VR - VC * VC) / VR), pts = [];
      for (var i = 0; i <= n; i++) {
        var ph = -phi0 + (2 * phi0) * i / n;
        var X = (VC - VR * Math.cos(ph)) * s * (side < 0 ? 1 : -1);
        var Y = VR * Math.sin(ph) * s;
        pts.push(fromFrame(X, Y));
      }
      return pts;
    }
    function inTri(px, py, a, b, c) {
      var d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
      var d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
      var d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
      var neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(neg && pos);
    }
    function polyLens(pts) {
      var L = [0];
      for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return L;
    }

    function buildStrokes(q) {
      var rnd = mulberry32(0x5EED0A7);
      var cres = [], tris = [], K = 8, M = 7, i;
      for (i = 0; i < K; i++) {
        var s = 0.3 + 0.7 * Math.pow(i / (K - 1), 0.85);
        var side = i % 2 ? 1 : -1;
        cres.push({ type: 'cres', s: s, side: side, edge: vesicaArc(s, side, 28) });
      }
      var base = rnd() * TAU;
      for (i = 0; i < M; i++) {
        var a = base + i * TAU / M + (rnd() - 0.5) * 0.55;
        var r0 = 0.47 + rnd() * 0.22, len = 0.1 + rnd() * 0.17, bw = 0.035 + rnd() * 0.045;
        var dir = a + (rnd() - 0.5) * 0.35;
        var apex = [Math.cos(a) * r0, Math.sin(a) * r0];
        var bc = [apex[0] + Math.cos(dir) * len, apex[1] + Math.sin(dir) * len];
        var nx = -Math.sin(dir), ny = Math.cos(dir);
        var w1 = bw * (0.7 + rnd() * 0.6), w2 = bw * (0.7 + rnd() * 0.6);
        var c1 = [bc[0] + nx * w1, bc[1] + ny * w1], c2 = [bc[0] - nx * w2, bc[1] - ny * w2];
        tris.push({ type: 'tri', a: apex, b: c1, c: c2, edge: [c1, apex, c2] });
      }
      /* interleave: first cut lands in the heart, then chips and the widening hollow */
      var order = [cres[0], tris[0], cres[1], tris[1], tris[2], cres[2], tris[3], cres[3], tris[4], cres[4], cres[5], tris[5], cres[6], tris[6], cres[7]];
      var n = order.length;
      for (i = 0; i < n; i++) {
        var st = order[i];
        st.t = CUT_START + (CUT_END - CUT_START) * (i / (n - 1)) + (i > 0 && i < n - 1 ? (rnd() - 0.5) * 0.008 : 0);
        st.lens = polyLens(st.edge);
        st.sh = [];
        for (var k = 0; k < q.shav; k++) {
          var o;
          if (st.type === 'tri') {
            var u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
            o = [st.a[0] + (st.b[0] - st.a[0]) * u + (st.c[0] - st.a[0]) * v, st.a[1] + (st.b[1] - st.a[1]) * u + (st.c[1] - st.a[1]) * v];
          } else {
            var e = st.edge[Math.floor(rnd() * st.edge.length)];
            o = [e[0] * (0.85 + rnd() * 0.15), e[1] * (0.85 + rnd() * 0.15)];
          }
          st.sh.push({ x: o[0], y: o[1], vx: (rnd() - 0.5) * 0.5, ph: rnd() * TAU, sw: 6 + rnd() * 18,
            rot: rnd() * TAU, spin: (rnd() - 0.5) * 9, size: 1.6 + rnd() * 3.2, tone: rnd(), fall: 0.8 + rnd() * 0.8 });
        }
      }
      return order;
    }

    function carveTime(x, y, rr, strokes) {
      var t = 9, f = toFrame(x, y), m = -1;
      for (var i = 0; i < strokes.length; i++) {
        var st = strokes[i];
        if (st.t >= t) continue;
        if (st.type === 'tri') {
          if (inTri(x, y, st.a, st.b, st.c)) t = st.t;
        } else if (rr > ISLAND) {
          if (m < 0) m = vesicaScale(f[0], f[1]);
          var sideOk = (st.side < 0 && f[0] <= 0.0001) || (st.side > 0 && f[0] >= -0.0001);
          if (sideOk && m <= st.s) t = st.t;
        }
      }
      return t;
    }

    function buildGeo(q) {
      var rnd = mulberry32(20250131);
      var strokes = buildStrokes(q);
      var N = q.rings, i, j, k;
      var sp = [], tot = 0;
      for (i = 0; i < N; i++) {
        var v = 0.55 + 0.9 * rnd();
        if (rnd() < 0.13) v *= 0.42;                 /* lean years */
        v *= 1 + 0.35 * Math.exp(-i / 4);            /* fast young growth */
        sp.push(v); tot += v;
      }
      var harm = [];
      for (k = 2; k <= 7; k++) harm.push({ k: k, a: (0.008 + 0.02 * rnd()) / Math.pow(k, 0.75), ph: rnd() * TAU, dr: (rnd() - 0.5) * 4 });
      var ex = (rnd() - 0.5) * 0.09, ey = (rnd() - 0.5) * 0.07;
      var rings = [], cum = 0, r0 = 0.011, total = 0;
      for (i = 0; i < N; i++) {
        cum += sp[i];
        var rr = r0 + (1 - r0) * cum / tot;
        var n = Math.round(clamp(rr * q.seg, 28, q.seg));
        var hfK = 7 + Math.floor(rnd() * 8), hfA = 0.003 * rnd(), hfP = rnd() * TAU;
        var xs = new Float32Array(n), ys = new Float32Array(n), ts = new Float32Array(n);
        for (j = 0; j < n; j++) {
          var th = j / n * TAU, ds = 0;
          for (k = 0; k < harm.length; k++) ds += harm[k].a * Math.sin(harm[k].k * th + harm[k].ph + harm[k].dr * rr);
          var rad = rr * (1 + ds * Math.min(1, rr * 2.4)) + hfA * rr * Math.sin(hfK * th + hfP);
          var x = ex * rr * rr + Math.cos(th) * rad, y = ey * rr * rr + Math.sin(th) * rad;
          xs[j] = x; ys[j] = y; ts[j] = carveTime(x, y, rr, strokes);
        }
        var late = rnd() < 0.34;
        rings.push({
          xs: xs, ys: ys, ts: ts, n: n, r: rr, late: late, tone: rnd(),
          born: i < 4 ? -1 : 0.012 + 0.3 * Math.pow((i - 4) / (N - 5), 0.85)
        });
        total += n;
      }
      return { rings: rings, strokes: strokes, points: total, half: [vesicaArc(1, -1, 40), vesicaArc(1, 1, 40)] };
    }

    function build() {
      sec = document.getElementById('carve');
      if (!sec) return false;
      pin = sec.querySelector('.pin') || sec;
      canvas = document.getElementById('carveCanvas');
      if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'carveCanvas'; pin.insertBefore(canvas, pin.firstChild);
      }
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
      if (!ctx) return false;

      shade = document.createElement('div'); shade.className = 'cv-shade'; shade.setAttribute('aria-hidden', 'true');
      pin.insertBefore(shade, canvas.nextSibling);

      var text = document.getElementById('carveText');
      if (!text) { text = document.createElement('div'); text.id = 'carveText'; pin.appendChild(text); }
      text.textContent = '';
      var stack = document.createElement('div'); stack.className = 'cv-stack';
      var lines = document.createElement('div'); lines.className = 'cv-lines'; lines.setAttribute('aria-live', 'off');
      for (var i = 0; i < LINES.length; i++) {
        var p = document.createElement('p'); p.className = 'cv-line'; p.textContent = LINES[i];
        lines.appendChild(p); lineEls.push(p);
      }
      climaxEl = document.createElement('p'); climaxEl.className = 'cv-climax';
      var words = SENTENCE.split(' ');
      for (i = 0; i < words.length; i++) {
        if (i) climaxEl.appendChild(document.createTextNode(' '));
        var w = document.createElement('span'); w.className = 'cv-w'; w.textContent = words[i];
        climaxEl.appendChild(w); wordEls.push(w);
      }
      stack.appendChild(lines); stack.appendChild(climaxEl);
      text.appendChild(stack);

      meter = document.createElement('div'); meter.className = 'cv-meter mono'; meter.setAttribute('aria-hidden', 'true');
      pin.appendChild(meter);

      reduced = isReduced();
      quality = pickQuality(0);
      geo = buildGeo(quality);
      resize();

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          visible = es[es.length - 1].isIntersecting;
          if (visible) start(); else stop();
        }, { rootMargin: '120px 0px' }).observe(sec);
      } else { visible = true; start(); }

      window.addEventListener('resize', function () { resize(); lastKey = ''; if (visible) frame(); }, { passive: true });
      try {
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { reduced = e.matches; lastKey = ''; });
      } catch (e) { /* old browsers */ }
      /* paint an initial frame so the section never enters black */
      frame();
      return true;
    }

    function resize() {
      var w = pin.clientWidth || window.innerWidth, h = pin.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
      W = w; H = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cx = w * 0.5; cy = h * 0.5;
      S = Math.max(w, h) * (w > h ? 0.47 : 0.5);
      var big = Math.max(w, h);
      glowGrad = ctx.createRadialGradient(cx * dpr, cy * dpr, 0, cx * dpr, cy * dpr, S * dpr);
      glowGrad.addColorStop(0, 'rgba(150,42,20,0.30)');
      glowGrad.addColorStop(0.45, 'rgba(90,24,12,0.12)');
      glowGrad.addColorStop(1, 'rgba(40,10,6,0)');
      pupilGrad = ctx.createRadialGradient(cx * dpr, cy * dpr, 0, cx * dpr, cy * dpr, S * 0.2 * dpr);
      pupilGrad.addColorStop(0, 'rgba(170,40,22,0.22)');
      pupilGrad.addColorStop(1, 'rgba(170,40,22,0)');
      vigGrad = ctx.createRadialGradient(cx * dpr, cy * dpr, big * 0.3 * dpr, cx * dpr, cy * dpr, big * 0.78 * dpr);
      vigGrad.addColorStop(0, 'rgba(6,4,3,0)');
      vigGrad.addColorStop(1, 'rgba(6,4,3,0.9)');
    }

    function start() { if (!raf) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function loop(ts) {
      raf = 0;
      if (!visible) return;
      frame(ts);
      raf = requestAnimationFrame(loop);
    }

    function frame(ts) {
      if (!sec) return;
      var p = progressOf(sec);
      var time = (ts || performance.now()) / 1000;
      var still = smooth(0.55, 0.74, p);
      var animated = !reduced && still < 1 && !document.hidden;
      var key = reduced ? 'r' + W + 'x' + H : (p.toFixed(4) + (animated ? ':' + Math.floor(time * 40) : '') + ':' + W + 'x' + H);
      updateText(p);
      if (key === lastKey) return;
      lastKey = key;
      var t0 = performance.now();
      draw(reduced ? 0.8 : p, reduced ? 0 : time);
      watchPerf(performance.now() - t0);
    }

    function watchPerf(ms) {
      if (perf.downgraded >= 2) return;
      perf.n++; perf.sum += ms;
      if (perf.n >= 45) {
        var avg = perf.sum / perf.n;
        perf.n = 0; perf.sum = 0;
        if (avg > 9) {
          perf.downgraded++;
          quality = pickQuality(perf.downgraded);
          geo = buildGeo(quality);
          resize(); lastKey = '';
        }
      }
    }

    function draw(p, time) {
      var still = smooth(0.55, 0.74, p);
      var z = 0.7 + 0.3 * smooth(0, 0.38, p);
      var k = S * z * dpr, ox = cx * dpr, oy = cy * dpr;
      var breathA = 0.0035 * (1 - still) * (time ? 1 : 0);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0B0807';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      /* ember warmth in the wood */
      ctx.globalAlpha = 0.25 + 0.75 * smooth(0, 0.22, p) * (1 - 0.65 * still);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      drawHollow(p, k, ox, oy);

      /* rings */
      var rings = geo.rings, lw0 = dpr;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (var i = 0; i < rings.length; i++) {
        var R = rings[i];
        var bornK = R.born < 0 ? 1 : smooth(R.born, R.born + 0.03, p);
        if (bornK <= 0.004) continue;
        var flash = R.born < 0 ? 0 : smooth(R.born, R.born + 0.012, p) * (1 - smooth(R.born + 0.014, R.born + 0.07, p));
        var c = R.late ? mixc(EMBER, AMBER, R.tone * 0.55) : mixc(EMBER_D, EMBER, 0.35 + R.tone * 0.5);
        var a = R.late ? 0.62 + 0.25 * R.tone : 0.32 + 0.2 * R.tone;
        c = mixc(c, AMBER, flash * 0.8); a = Math.min(1, a + flash * 0.4);
        if (R.r < ISLAND) { var isl = smooth(0.34, 0.5, p); c = mixc(c, AMBER, isl * 0.7); a = Math.min(1, a + isl * 0.45); }
        c = mixc(c, BONE, still * (0.72 + 0.25 * R.tone));
        a = lerp(a, 0.26 + 0.38 * R.tone + (R.late ? 0.12 : 0), still) * bornK;
        var lw = lerp(R.late ? 1.9 : 1.05, R.late ? 0.95 : 0.6, still) * lw0;
        /* a ring is born slightly inside its final place, then settles */
        var g = k * (0.965 + 0.035 * bornK) * (1 + breathA * Math.sin(time * 0.8 - R.r * 9));
        var xs = R.xs, ys = R.ys, ts = R.ts, n = R.n, pen = false;
        ctx.beginPath();
        for (var j = 0; j <= n; j++) {
          var idx = j === n ? 0 : j;
          if (ts[idx] <= p) { pen = false; continue; }
          var X = ox + xs[idx] * g, Y = oy + ys[idx] * g;
          if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
        }
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
      }

      /* the pupil keeps a little warmth once the hollow is open */
      var pg = smooth(0.42, 0.62, p) * (1 - 0.5 * still);
      if (pg > 0.01) {
        ctx.globalAlpha = pg; ctx.fillStyle = pupilGrad;
        ctx.fillRect(ox - S * 0.25 * dpr, oy - S * 0.25 * dpr, S * 0.5 * dpr, S * 0.5 * dpr);
        ctx.globalAlpha = 1;
      }

      if (time) {
        drawKnife(p, k, ox, oy);
        drawShavings(p, k, ox, oy);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /* the cut-away wood: darker than the grain around it */
    function drawHollow(p, k, ox, oy) {
      var strokes = geo.strokes, sL = 0, sR = 0, i, j, e;
      ctx.fillStyle = 'rgba(4,3,2,' + (0.9 - 0.35 * smooth(0.6, 0.8, p)).toFixed(3) + ')';
      for (i = 0; i < strokes.length; i++) {
        var st = strokes[i];
        if (st.t > p) continue;
        if (st.type === 'tri') {
          ctx.beginPath();
          ctx.moveTo(ox + st.a[0] * k, oy + st.a[1] * k);
          ctx.lineTo(ox + st.b[0] * k, oy + st.b[1] * k);
          ctx.lineTo(ox + st.c[0] * k, oy + st.c[1] * k);
          ctx.closePath(); ctx.fill();
        } else if (st.side < 0) sL = Math.max(sL, st.s); else sR = Math.max(sR, st.s);
      }
      var sides = [[-1, sL], [1, sR]];
      for (i = 0; i < 2; i++) {
        if (!sides[i][1]) continue;
        e = geo.half[i];
        var s = sides[i][1];
        ctx.beginPath();
        ctx.moveTo(ox + e[0][0] * s * k, oy + e[0][1] * s * k);
        for (j = 1; j < e.length; j++) ctx.lineTo(ox + e[j][0] * s * k, oy + e[j][1] * s * k);
        ctx.closePath(); ctx.fill();
      }
    }

    function drawKnife(p, k, ox, oy) {
      var strokes = geo.strokes, IN = 0.016, OUT = 0.04;
      for (var i = 0; i < strokes.length; i++) {
        var st = strokes[i];
        if (p < st.t - IN || p > st.t + OUT) continue;
        var frac = p < st.t ? (p - (st.t - IN)) / IN : 1;
        var al = p < st.t ? 0.95 : 0.95 * (1 - (p - st.t) / OUT);
        var L = st.lens, total = L[L.length - 1], upto = total * frac, e = st.edge;
        ctx.beginPath();
        ctx.moveTo(ox + e[0][0] * k, oy + e[0][1] * k);
        for (var j = 1; j < e.length; j++) {
          if (L[j] <= upto) ctx.lineTo(ox + e[j][0] * k, oy + e[j][1] * k);
          else {
            var f = (upto - L[j - 1]) / (L[j] - L[j - 1] || 1);
            ctx.lineTo(ox + lerp(e[j - 1][0], e[j][0], f) * k, oy + lerp(e[j - 1][1], e[j][1], f) * k);
            break;
          }
        }
        ctx.strokeStyle = 'rgba(214,70,34,' + (al * 0.22).toFixed(3) + ')';
        ctx.lineWidth = 5 * dpr; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,238,218,' + al.toFixed(3) + ')';
        ctx.lineWidth = 1.3 * dpr; ctx.stroke();
      }
    }

    function drawShavings(p, k, ox, oy) {
      var strokes = geo.strokes, LIFE = 0.17, hpx = H * dpr;
      for (var i = 0; i < strokes.length; i++) {
        var st = strokes[i];
        if (p < st.t || p > st.t + LIFE) continue;
        var dt = (p - st.t) / LIFE;
        for (var j = 0; j < st.sh.length; j++) {
          var s = st.sh[j];
          var x = ox + s.x * k + s.vx * dt * S * 0.35 * dpr + Math.sin(dt * 5 + s.ph) * s.sw * dpr * dt;
          var y = oy + s.y * k + (dt * dt * 1.25 + dt * 0.05) * hpx * s.fall;
          if (y > hpx + 20) continue;
          var al = (1 - smooth(0.6, 1, dt)) * 0.85;
          var c = mixc(WOOD, AMBER, s.tone * 0.6);
          var r = s.size * dpr, rot = s.rot + s.spin * dt;
          ctx.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), x, y);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, 4.4);
          ctx.arc(r * 0.35, 0, r * 0.45, 4.4, 1.2, true);
          ctx.strokeStyle = rgba(c, al);
          ctx.lineWidth = Math.max(0.8, r * 0.32);
          ctx.stroke();
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function setOp(el, id, v, extra) {
      var s = v.toFixed(3) + (extra || '');
      if (textCache[id] === s) return;
      textCache[id] = s;
      el.style.opacity = v.toFixed(3);
      if (extra !== undefined) el.style.transform = extra;
    }

    function updateText(p) {
      var i, v;
      for (i = 0; i < lineEls.length; i++) {
        var a = LINE_WIN[i][0], b = LINE_WIN[i][1];
        if (reduced) { v = (p >= a && p < b) ? 1 : 0; setOp(lineEls[i], 'l' + i, v); continue; }
        var f = 0.02;
        v = smooth(a, a + f, p) * (1 - smooth(b - f, b, p));
        var drift = lerp(10, -10, clamp((p - a) / (b - a), 0, 1));
        setOp(lineEls[i], 'l' + i, v, 'translateY(' + drift.toFixed(1) + 'px)');
      }
      var n = wordEls.length, step = CLIMAX_SPAN / n;
      for (i = 0; i < n; i++) {
        var w0 = CLIMAX_IN + i * step;
        v = reduced ? (p >= CLIMAX_IN ? 1 : 0) : smooth(w0, w0 + step * 3.2, p);
        setOp(wordEls[i], 'w' + i, v);
      }
      var climaxOn = p >= CLIMAX_IN - 0.01;
      if (textCache.cl !== climaxOn) { textCache.cl = climaxOn; climaxEl.classList.toggle('on', climaxOn); }
      /* radial darkening behind whatever text is up */
      var sh = Math.max(
        0.62 * smooth(0.02, 0.06, p) * (1 - smooth(0.5, 0.56, p)),
        0.9 * smooth(0.6, 0.7, p)
      );
      setOp(shade, 'sh', sh);
      /* the context meter while the rings fill */
      var mv = smooth(0.02, 0.06, p) * (1 - smooth(0.3, 0.35, p));
      setOp(meter, 'm', mv * 0.9);
      if (mv > 0) {
        var count = 0;
        for (i = 0; i < geo.rings.length; i++) if (geo.rings[i].born < p) count++;
        var pct = Math.round(clamp(p / 0.32, 0, 1) * 100);
        var txt = 'rings ' + count + '  ·  context ' + pct + '%';
        if (textCache.mt !== txt) { textCache.mt = txt; meter.textContent = txt; }
      }
    }

    /* small ring mark (transparent bg) for the footer, from the same geometry */
    function markDataURL(size) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = size;
        var x = c.getContext('2d'); if (!x) return '';
        var g = geo || buildGeo(pickQuality(1));
        var kk = size * 0.48, o = size / 2;
        x.lineWidth = Math.max(1, size / 520);
        for (var i = 0; i < g.rings.length; i++) {
          var R = g.rings[i], pen = false;
          x.beginPath();
          for (var j = 0; j <= R.n; j++) {
            var idx = j === R.n ? 0 : j;
            if (R.ts[idx] < 9) { pen = false; continue; }
            var X = o + R.xs[idx] * kk, Y = o + R.ys[idx] * kk;
            if (pen) x.lineTo(X, Y); else { x.moveTo(X, Y); pen = true; }
          }
          x.strokeStyle = 'rgba(232,218,196,' + (0.25 + 0.5 * R.tone).toFixed(2) + ')';
          x.stroke();
        }
        return c.toDataURL('image/png');
      } catch (e) { return ''; }
    }

    return { build: build, markDataURL: markDataURL, progress: function () { return sec ? progressOf(sec) : 0; } };
  })();

  /* =========================================================
     2. AMBIENT SOUND
     ========================================================= */
  var Sound = (function () {
    var btn, ac = null, on = false, ended = false, timer = 0;
    var master, padF, padG, voices = [], droneG, drones = [], beatG, beatA, beatB, noiseG, noiseF, creakF, creakG, toneG, tone, lfo, lfoG;
    var finaleAt = 0;

    function label() {
      if (!btn) return;
      var t;
      if (on) t = currentD() >= 0.78 ? '♪ Listening' : '♪ Sound: on';
      else t = '♪ Sound: off';
      if (btn.textContent !== t) btn.textContent = t;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function noiseBuffer() {
      var len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), last = 0;
      var rnd = mulberry32(77);
      for (var i = 0; i < len; i++) { last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
      /* soften the loop seam */
      for (i = 0; i < 2000; i++) { var f = i / 2000; d[i] *= f; d[len - 1 - i] *= f; }
      return buf;
    }
    function osc(type, f) { var o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }
    function gain(v) { var g = ac.createGain(); g.gain.value = v; return g; }

    function init() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      var comp = ac.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 8; comp.attack.value = 0.02; comp.release.value = 0.4;
      master = gain(0); master.connect(comp); comp.connect(ac.destination);

      /* warm pad */
      padF = ac.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 1200; padF.Q.value = 0.4;
      padG = gain(0); padF.connect(padG); padG.connect(master);
      for (var i = 0; i < 4; i++) {
        var a = osc('sawtooth', 110), b = osc('triangle', 110), g = gain(i === 3 ? 0.18 : 0.3);
        a.connect(g); b.connect(g); g.connect(padF); a.start(); b.start();
        voices.push({ a: a, b: b });
      }
      /* low drone */
      droneG = gain(0); droneG.connect(master);
      for (i = 0; i < 2; i++) { var d = osc(i ? 'triangle' : 'sine', 55); var dg = gain(i ? 0.35 : 1); d.connect(dg); dg.connect(droneG); d.start(); drones.push(d); }
      /* slow beating interval */
      beatG = gain(0); beatG.connect(master);
      beatA = osc('sine', 220); beatB = osc('sine', 221);
      beatA.connect(beatG); beatB.connect(beatG); beatA.start(); beatB.start();
      /* wood / breath noise */
      var src = ac.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
      noiseF = ac.createBiquadFilter(); noiseF.type = 'bandpass'; noiseF.frequency.value = 380; noiseF.Q.value = 0.9;
      noiseG = gain(0); src.connect(noiseF); noiseF.connect(noiseG); noiseG.connect(master);
      lfo = osc('sine', 0.11); lfoG = gain(0); lfo.connect(lfoG); lfoG.connect(noiseG.gain); lfo.start();
      creakF = ac.createBiquadFilter(); creakF.type = 'bandpass'; creakF.frequency.value = 700; creakF.Q.value = 9;
      creakG = gain(0); src.connect(creakF); creakF.connect(creakG); creakG.connect(master);
      var clfo = osc('sine', 0.067), clg = gain(260); clfo.connect(clg); clg.connect(creakF.frequency); clfo.start();
      src.start();
      /* the single held tone */
      tone = osc('sine', 220); toneG = gain(0); tone.connect(toneG); toneG.connect(master); tone.start();

      document.addEventListener('visibilitychange', function () {
        if (!ac) return;
        if (document.hidden) { try { ac.suspend(); } catch (e) { /* ignore */ } }
        else if (on) { try { ac.resume(); } catch (e) { /* ignore */ } }
      });
      return true;
    }

    function set(param, v, tc) { param.setTargetAtTime(v, ac.currentTime, tc || 0.6); }

    function update() {
      label();
      if (!ac || !on || ended) return;
      var d = currentD();
      var thin = smooth(0.56, 0.74, Carve.progress());
      var root = 110 * Math.pow(2, -(d * 5) / 12);           /* sinks ~a fourth */
      var third = lerp(1.2599, 1.1892, smooth(0.25, 0.6, d)); /* major → minor */
      var ratios = [1, third, 1.4983, 2];
      var spread = 3 + d * 26;
      for (var i = 0; i < voices.length; i++) {
        set(voices[i].a.frequency, root * ratios[i], 1.2);
        set(voices[i].b.frequency, root * ratios[i], 1.2);
        set(voices[i].a.detune, -spread * (i % 2 ? 1 : 0.6), 1.5);
        set(voices[i].b.detune, spread * (i % 2 ? 0.7 : 1), 1.5);
      }
      set(padF.frequency, 1300 - d * 950, 1);
      set(padG.gain, 0.09 * (1 - 0.35 * d) * (1 - 0.92 * thin), 0.8);
      set(drones[0].frequency, root / 2, 1.5); set(drones[1].frequency, root / 2 * 1.003, 1.5);
      set(droneG.gain, 0.16 * smooth(0.3, 0.85, d) * (1 - 0.85 * thin), 1);
      var beatHz = 0.35 + 1.25 * d;                         /* never faster than ~1.6 Hz */
      set(beatA.frequency, root * 1.4983, 1); set(beatB.frequency, root * 1.4983 + beatHz, 1);
      set(beatG.gain, 0.035 * smooth(0.2, 0.75, d) * (1 - thin), 1);
      var nz = 0.05 * smooth(0.28, 1, d) * (1 - 0.8 * thin);
      set(noiseG.gain, nz, 1); set(lfoG.gain, nz * 0.8, 1);
      set(noiseF.frequency, 420 - d * 200, 1);
      set(creakG.gain, 0.06 * smooth(0.45, 0.95, d) * (1 - 0.9 * thin), 1);
      /* a minor second above the octave: one held, unresolved tone */
      set(tone.frequency, root * 2 * 1.0595, 1.2);
      set(toneG.gain, 0.06 * thin, 1.2);
      set(master.gain, 0.24, 0.5);
    }

    function turnOn() {
      if (!ac && !init()) { btn.textContent = '♪ Sound: unavailable'; return; }
      on = true; ended = false;
      try { ac.resume(); } catch (e) { /* ignore */ }
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(master.gain.value, ac.currentTime);
      update();
      if (!timer) timer = setInterval(update, 150);
    }
    function turnOff() {
      on = false;
      label();
      if (!ac) return;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.12);
      setTimeout(function () { if (!on && ac) { try { ac.suspend(); } catch (e) { /* ignore */ } } }, 900);
    }

    function finale() {
      if (!ac || !on || ended) return;
      ended = true; finaleAt = ac.currentTime;
      var t = ac.currentTime, root = 110 * Math.pow(2, -5 / 12);
      [padG.gain, droneG.gain, beatG.gain, noiseG.gain, lfoG.gain, creakG.gain].forEach(function (g) {
        g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 1.2);
      });
      /* the held tone resolves down to the octave, then lets go */
      tone.frequency.cancelScheduledValues(t);
      tone.frequency.setTargetAtTime(root * 2, t + 0.3, 1.4);
      toneG.gain.cancelScheduledValues(t);
      toneG.gain.setTargetAtTime(0.06, t, 0.5);
      toneG.gain.setTargetAtTime(0, t + 3.5, 2.2);
      master.gain.setTargetAtTime(0, t + 6, 1.5);
      setTimeout(function () { if (ended) turnOff(); }, 12500);
    }

    function build() {
      btn = document.getElementById('ambient');
      if (!btn) return;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () { if (on) turnOff(); else turnOn(); });
      /* label may drift late, even while off */
      setInterval(function () { if (!on) label(); }, 1000);
    }

    return { build: build, finale: finale, ctx: function () { return ac; } };
  })();

  /* =========================================================
     3. FAVICON + END STATE
     ========================================================= */
  var End = (function () {
    var link, lastSig = '', done = false, bottomSince = 0;

    function drawIcon(d, final) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'); if (!x) return;
      var bg = mixc([246, 241, 231], [14, 11, 10], smooth(0.35, 0.85, d));
      var fg = mixc([29, 26, 21], [214, 196, 172], smooth(0.35, 0.85, d));
      x.fillStyle = rgba(bg, 1); x.beginPath(); x.arc(32, 32, 31, 0, TAU); x.fill();
      var rings = final ? 1 : Math.max(1, Math.round(5 - d * 4.4));
      var rnd = mulberry32(9);
      x.strokeStyle = rgba(fg, final ? 0.55 : 1); x.lineWidth = final ? 2 : 3;
      for (var i = 0; i < rings; i++) {
        var r = 26 - i * 5.2, ox = (i * 0.9), oy = -(i * 0.6);
        x.beginPath();
        for (var j = 0; j <= 40; j++) {
          var th = j / 40 * TAU, rr = r * (1 + 0.035 * Math.sin(3 * th + rnd() * 0.3 + i));
          var px = 32 + ox + Math.cos(th) * rr, py = 32 + oy + Math.sin(th) * rr;
          if (j) x.lineTo(px, py); else x.moveTo(px, py);
        }
        x.stroke();
      }
      if (!final) { x.fillStyle = '#E2603B'; x.beginPath(); x.arc(34.5, 30.5, 3.6 - d * 1.4, 0, TAU); x.fill(); }
      try {
        if (!link) {
          link = document.querySelector('link[rel~="icon"]');
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        }
        link.type = 'image/png';
        link.href = c.toDataURL('image/png');
      } catch (e) { /* ignore */ }
    }

    function tick() {
      if (done) return;
      var d = currentD();
      var sig = Math.max(1, Math.round(5 - d * 4.4)) + ':' + Math.round(smooth(0.35, 0.85, d) * 4);
      if (sig !== lastSig) { lastSig = sig; drawIcon(d, false); }
      /* fallback finale: resting at the very bottom for 6s at stage 5 */
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && currentStage() >= 5) {
        if (!bottomSince) bottomSince = Date.now();
        else if (Date.now() - bottomSince > 6000) finale();
      } else bottomSince = 0;
    }

    function finale() {
      if (done) return;
      done = true;
      drawIcon(1, true);
      Sound.finale();
      document.documentElement.classList.add('fx-finale');
      var foot = document.getElementById('foot');
      if (foot && !foot.querySelector('.fx-endring')) {
        var url = Carve.markDataURL(640);
        var m = document.createElement('div'); m.className = 'fx-endring'; m.setAttribute('aria-hidden', 'true');
        if (url) m.style.backgroundImage = 'url(' + url + ')';
        foot.insertBefore(m, foot.firstChild);
        requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add('on'); }); });
      }
    }

    function build() {
      tick();
      setInterval(tick, 500);
      if (!hwOn('finale', finale)) {
        window.addEventListener('load', function () { hwOn('finale', finale); });
      }
    }
    return { build: build, finale: finale };
  })();

  /* ---------- boot ---------- */
  function boot() {
    try { Carve.build(); } catch (e) { if (window.console) console.warn('[fx] carve', e); }
    try { Sound.build(); } catch (e) { if (window.console) console.warn('[fx] sound', e); }
    try { End.build(); } catch (e) { if (window.console) console.warn('[fx] end', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
