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
  /* The carving is the record of this visit: every line is something
     the visitor actually did here, read back while the knife works.
     (Fallbacks are used when there is nothing to quote.) */
  var LINE_WIN = [
    [0.035, 0.105], [0.105, 0.175], [0.175, 0.245],
    [0.245, 0.315], [0.315, 0.385], [0.385, 0.455], [0.455, 0.535]
  ];
  var CLIMAX_IN = 0.6, CLIMAX_SPAN = 0.12;     /* words reveal 0.60–0.72, held, then let go */
  var SUB_IN = 0.735, TEXT_OUT = 0.8;          /* after 0.84: only the hollow, and silence */
  var CUT_START = 0.3, CUT_END = 0.58;
  var NAMES = { hero: 'the first screen', logos: 'the logos', features: 'the features', bench: 'the benchmarks', how: 'How it works',
    voices: 'the testimonials', trace: 'its reasoning', pricing: 'the pricing', card: 'what it’s made of', changelog: 'the changelog',
    faq: 'the questions' };
  function clipq(t, n) { t = String(t || '').replace(/[«»]/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  function recordLines() {
    var h = hw() || {}, sn = h.seen || { sent: [], chips: [], away: [], reversals: 0, dwell: {} };
    var hm = h.hm || function (t) { var x = new Date(t || Date.now()); return x.getHours() + ':' + ('0' + x.getMinutes()).slice(-2); };
    var dur = h.dur || function (x) { return Math.round(x) + ' seconds'; };
    var dev = h.device || 'a screen', L = [];
    L.push(sn.visit > 1 ? 'You came back at ' + hm(sn.arrival) + ', on ' + dev + '. Visit ' + sn.visit + '.' : 'You came in at ' + hm(sn.arrival) + ', on ' + dev + '.');
    if (sn.sent && sn.sent.length) {
      L.push(sn.sent.length > 1 ? 'You asked it “' + clipq(sn.sent[0].text, 44) + '”. Then “' + clipq(sn.sent[sn.sent.length - 1].text, 36) + '”.' : 'You asked it “' + clipq(sn.sent[0].text, 60) + '”.');
    } else if (sn.chips && sn.chips.length) {
      L.push('You let it choose your words for you: “' + clipq(sn.chips[0], 40) + '”.');
    } else L.push('You never said a word to it. You only read. It learned you from that.');
    var dw = sn.dwell || {}, best = null, mx = 0;
    Object.keys(NAMES).forEach(function (k) { if ((dw[k] || 0) > mx) { mx = dw[k]; best = k; } });
    var tb = sn.tookBack, hb = sn.hesitation && sn.hesitation.before.toLowerCase();
    var spoil = tb && hb && (tb.text.toLowerCase().indexOf(hb.slice(0, 12)) === 0 || hb.indexOf(tb.text.toLowerCase().slice(0, 12)) === 0);
    if (sn.hesitation && spoil) L.push('You stopped typing for ' + Math.round(sn.hesitation.sec) + ' seconds. Then you changed your mind.');
    else if (sn.hesitation) L.push('You stopped typing for ' + Math.round(sn.hesitation.sec) + ' seconds at “' + clipq(sn.hesitation.before, 36) + '”.');
    else if (best && mx > 8) L.push('You stayed longest on ' + NAMES[best] + '. ' + dur(mx) + '. It noticed which part.');
    else L.push('You read quickly. As if you already knew how this goes.');
    if (sn.away && sn.away.length) { var a = sn.away[sn.away.length - 1]; L.push('You left for ' + dur(a.sec) + '. It kept your place.'); }
    else if (sn.reversals) L.push('You went back up ' + sn.reversals + (sn.reversals === 1 ? ' time' : ' times') + ', to see if it had changed. It had.');
    else L.push('You never once looked away. It noticed that too.');
    L.push(sn.visit > 1 ? 'This is the ' + ordinal(sn.visit) + ' time. Every visit is a ring.' : 'You have been here ' + dur(h.elapsed ? h.elapsed() : 0) + '. Every minute is a ring.');
    L.push('It kept all of it. Not on a server. Here, on ' + dev + ', with you.');
    L.push('Every one of those was a cut. You were holding the knife.');
    return L;
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

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
  function fx(k, x) { var h = hw(), o = x || {}; o.k = k; if (h && typeof h.emit === 'function') { try { h.emit('sfx', o); } catch (e) {} } }
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

    var sec, pin, canvas, ctx, shade, meter, climaxEl, subEl, lastP = -1, lastCut = 0, filledAt = -1;
    function fillLines() {
      var L = recordLines();
      for (var i = 0; i < lineEls.length; i++) lineEls[i].textContent = L[i] || '';
      filledAt = Date.now();
    }
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
      for (var i = 0; i < LINE_WIN.length; i++) {
        var p = document.createElement('p'); p.className = 'cv-line';
        lines.appendChild(p); lineEls.push(p);
      }
      fillLines();
      climaxEl = document.createElement('p'); climaxEl.className = 'cv-climax';
      var words = SENTENCE.split(' ');
      for (i = 0; i < words.length; i++) {
        if (i) climaxEl.appendChild(document.createTextNode(' '));
        var w = document.createElement('span'); w.className = 'cv-w'; w.textContent = words[i];
        climaxEl.appendChild(w); wordEls.push(w);
      }
      subEl = document.createElement('span'); subEl.className = 'cv-sub';
      var hr = new Date().getHours();
      subEl.textContent = 'You were very hungry ' + (hr >= 18 || hr < 5 ? 'tonight' : 'today') + '. It was very patient.';
      climaxEl.appendChild(subEl);
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
          if (visible && progressOf(sec) < 0.03) fillLines();   /* written from the visit as it is now */
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
      cues(p);
      updateText(p);
      if (key === lastKey) return;
      lastKey = key;
      var t0 = performance.now();
      draw(reduced ? 0.8 : p, reduced ? 0 : time);
      watchPerf(performance.now() - t0);
    }

    /* sound cues from the scroll position (forward motion only) */
    function cues(p) {
      if (lastP < 0) { lastP = p; return; }
      if (p > lastP && p - lastP < 0.2) {
        var st = geo.strokes, nowT = performance.now();
        for (var i = 0; i < st.length; i++) {
          if (lastP < st[i].t && p >= st[i].t && nowT - lastCut > 110) { lastCut = nowT; fx('cut', { i: i, n: st.length }); }
        }
        var rg = geo.rings;
        for (var r = 0; r < rg.length; r++) if (rg[r].born > 0 && lastP < rg[r].born && p >= rg[r].born) fx('ring', { i: r, f: r / rg.length });
        for (var j = 0; j < LINE_WIN.length; j++) if (lastP < LINE_WIN[j][0] && p >= LINE_WIN[j][0]) fx('line', { i: j });
        if (lastP < CLIMAX_IN && p >= CLIMAX_IN) fx('climax');
        if (lastP < 0.83 && p >= 0.83) fx('still');
      }
      lastP = p;
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
      var n = wordEls.length, step = CLIMAX_SPAN / n, out = reduced ? (p >= 0.84 ? 1 : 0) : smooth(TEXT_OUT, 0.84, p);
      for (i = 0; i < n; i++) {
        var w0 = CLIMAX_IN + i * step;
        v = reduced ? (p >= CLIMAX_IN ? 1 : 0) : smooth(w0, w0 + step * 3.2, p);
        setOp(wordEls[i], 'w' + i, v * (1 - out));
      }
      v = reduced ? (p >= SUB_IN ? 1 : 0) : smooth(SUB_IN, SUB_IN + 0.025, p);
      setOp(subEl, 'sub', v * (1 - out));
      var climaxOn = p >= CLIMAX_IN - 0.01 && p < 0.86;
      if (textCache.cl !== climaxOn) { textCache.cl = climaxOn; climaxEl.classList.toggle('on', climaxOn); }
      /* radial darkening behind whatever text is up */
      var sh = Math.max(
        0.62 * smooth(0.02, 0.06, p) * (1 - smooth(0.52, 0.56, p)),
        0.9 * smooth(0.58, 0.66, p) * (1 - 0.75 * smooth(TEXT_OUT, 0.86, p))
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
    /* Opt-in only: nothing is created until a click on the speaker or on the
       "best with sound" prompt. Everything is synthesised; there are no files.

       The bed is tonal, not noise: four pitched voices (a just-intonation
       chord) built from a glassy additive waveform, each a pair of slightly
       detuned oscillators so it beats, each breathing slowly in and out on its
       own cycle. Dread does the rest: the root sags three semitones, the major
       third goes minor, the fifth collapses toward a tritone, the octave sours
       to a minor ninth and the beating quickens. Fundamentals sit between
       ~185 and 900 Hz with harmonics above, so phone speakers carry it; the
       low sine underneath is only support for headphones.
       Noise is used only for two short, dry events (the knife, a key edge).
       Space comes from a small feedback-delay network, not a recorded room.
       Everything runs through a compressor and a limiter, every change is
       ramped, and the context is suspended whenever the tab is hidden. */
    var btn, btnT, ac = null, on = false, timer = 0;
    var master, bus, wet, comp, lim, glass = null, noiseBuf = null, bed = null;
    var duck = 1, duckTarget = 1, clockOn = false, nextClock = 0, nextCreak = 0, lastStage = -1;
    var resolved = false, keyN = 0, clockN = 0, lastRing = 0, lastKey = 0;
    var BED = 0.13;
    /* how wrong the product chime has gone, by stage */
    var SOUR = [0, 0.14, 0.32, 0.52, 0.76, 1];

    function label() {
      if (!btn) return;
      var late = currentD() >= 0.78;
      var t = on ? (late ? 'Listening' : 'Sound on') : 'Sound off';
      if (btnT && btnT.textContent !== t) btnT.textContent = t;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on');
      btn.classList.toggle('is-on', on);
    }

    function osc(type, f) { var o = ac.createOscillator(); if (type === 'glass') o.setPeriodicWave(glass); else o.type = type; o.frequency.value = f; return o; }
    function gain(v) { var g = ac.createGain(); g.gain.value = v; return g; }
    function filt(type, f, q) { var b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
    function set(param, v, tc) { param.setTargetAtTime(v, ac.currentTime, tc || 0.6); }
    function rnd() { return Math.random(); }
    function semi(n) { return Math.pow(2, n / 12); }

    function makeNoise() {
      var len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), r = mulberry32(77);
      for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
      return buf;
    }
    /* a glassy, bowed-sounding waveform: a fundamental and a soft, falling
       series of partials (enough upper harmonics for a phone speaker) */
    function makeGlass() {
      var a = [0, 1, 0.42, 0.24, 0.13, 0.08, 0.045, 0.025, 0.014], re = new Float32Array(a.length), im = new Float32Array(a);
      return ac.createPeriodicWave(re, im);
    }
    /* the room: two allpass diffusers into six damped feedback combs (each
       its own single loop, with a one-pole damper so its gain can never
       exceed one), slowly modulated so it doesn't ring, spread over two channels */
    function room(rt, damp, scale) {
      function allpass(dt, g) {
        var inp = gain(1), sum = gain(1), dl = ac.createDelay(0.1), fb = gain(g), ff = gain(-g), out = gain(1);
        dl.delayTime.value = dt; inp.connect(sum); sum.connect(dl); dl.connect(fb); fb.connect(sum);
        sum.connect(ff); ff.connect(out); dl.connect(out);
        return { input: inp, output: out };
      }
      var a = Math.exp(-2 * Math.PI * damp / ac.sampleRate);
      var input = gain(1), hp = filt('highpass', 180, 0.7), ap1 = allpass(0.0051, 0.6), ap2 = allpass(0.0017, 0.6), out = ac.createChannelMerger(2);
      input.connect(hp); hp.connect(ap1.input); ap1.output.connect(ap2.input);
      [0.0297, 0.0371, 0.0411, 0.0437, 0.0503, 0.0571].forEach(function (d0, i) {
        var d = d0 * scale, s = gain(1), dl = ac.createDelay(0.5), lp = ac.createIIRFilter([1 - a], [1, -a]), fb = gain(Math.pow(10, -3 * d / rt)), o = gain(i % 2 ? -0.3 : 0.3);
        var m = osc('sine', 0.07 + i * 0.043), mg = gain(0.0004);
        dl.delayTime.value = d; m.connect(mg); mg.connect(dl.delayTime); m.start();
        ap2.output.connect(s); s.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(s); lp.connect(o); o.connect(out, 0, i % 2);
      });
      return { input: input, output: out };
    }

    function init() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ac = new AC({ latencyHint: 'playback' }); } catch (e) { ac = new AC(); }
      noiseBuf = makeNoise(); glass = makeGlass();
      lim = ac.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.3;
      var hp = filt('highpass', 55, 0.7);
      master = gain(0);
      master.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(ac.destination);
      bus = gain(1); bus.connect(master);                     /* dry */
      var rm = room(3.2, 3200, 1.6), rg = gain(1.4);
      wet = gain(0.3); wet.connect(rm.input); rm.output.connect(rg); rg.connect(master);   /* a large, dim room */
      buildBed();
      document.addEventListener('visibilitychange', function () {
        if (!ac) return;
        if (document.hidden) { try { ac.suspend(); } catch (e) { /* ignore */ } }
        else if (on) { try { ac.resume(); } catch (e) { /* ignore */ } }
      });
      return true;
    }

    /* ---------- the bed ---------- */
    function buildBed() {
      var b = { g: gain(0), voices: [], VG: [0.36, 0.3, 0.32, 0.18] };
      b.g.connect(bus); b.g.connect(wet);
      for (var i = 0; i < 4; i++) {
        var a = osc('glass', 220), c = osc('glass', 220), ag = gain(0.5), vg = gain(b.VG[i]);
        a.connect(ag); c.connect(ag); ag.connect(vg); vg.connect(b.g);
        /* each voice breathes on its own slow cycle, so the chord keeps shifting weight */
        var l = osc('sine', 0.029 + i * 0.017), lg = gain(0.2); l.connect(lg); lg.connect(ag.gain);
        a.start(); c.start(); l.start();
        b.voices.push({ a: a, c: c });
      }
      /* a bowed-glass overtone (gentle FM) that grows inharmonic with dread */
      b.car = osc('sine', 1320); b.mod = osc('sine', 2640); b.modG = gain(0); b.glassG = gain(0);
      b.mod.connect(b.modG); b.modG.connect(b.car.frequency); b.car.connect(b.glassG); b.glassG.connect(b.g);
      b.car.start(); b.mod.start();
      /* the thin, beating high tone that arrives late */
      b.hiG = gain(0); b.hi = [osc('sine', 1975.5), osc('sine', 1979)];
      b.hi.forEach(function (o) { o.connect(b.hiG); o.start(); }); b.hiG.connect(b.g);
      /* a little weight underneath, for headphones; never the main event */
      b.sub = osc('sine', 110); b.subG = gain(0); b.sub.connect(b.subG); b.subG.connect(bus); b.sub.start();
      bed = b;
    }
    function rootHz(d) { if (d == null) d = currentD(); return 220 * semi(-3 * d); }

    /* ---------- one-shot voices ---------- */
    /* modal: a struck object as a few sine partials, each with its own decay
       ([ratio, amp, decay seconds]); used for wood, keys, ticks, bells */
    function modal(f, parts, peak, at, dest, twin) {
      var t = ac.currentTime + 0.012 + (at || 0), out = gain(peak), end = 0;
      out.connect(dest || bus);
      parts.forEach(function (p) {
        var fr = f * p[0], dc = p[2], g = gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(p[1], t + Math.min(0.004, dc * 0.2));
        g.gain.setTargetAtTime(0, t + Math.min(0.004, dc * 0.2), dc / 4);
        g.connect(out);
        var o = osc('sine', fr); o.connect(g); o.start(t); o.stop(t + dc * 1.6 + 0.05);
        if (twin && fr < 4000) { var o2 = osc('sine', fr + twin * (0.6 + rnd() * 0.8)); o2.connect(g); o2.start(t); o2.stop(t + dc * 1.6 + 0.05); }
        end = Math.max(end, dc);
      });
      return t;
    }
    function wetOf(v) { var g = gain(v); g.connect(wet); var d = gain(1); d.connect(bus); d.connect(g); return d; }

    /* the product chime: a clean two-note "ding-dong" early on. Later the
       same chime comes back wrong: flat, its second note sliding past the
       fourth toward a tritone, partials going inharmonic, a beating ghost
       a few hertz off, a slow droop, a longer and wetter tail. */
    function chime(sour, opt) {
      opt = opt || {};
      var t = ac.currentTime + 0.02 + (opt.at || 0), k = opt.k || 1, pk = (opt.peak || 0.085) * (1 - 0.25 * sour);
      var dest = wetOf(0.25 + 0.6 * sour);
      var notes = [[1318.5 * semi(-0.35 * sour) * k, 0], [1318.5 * semi(-(5 + 1.4 * sour)) * k, 0.14 + 0.1 * sour]];
      var parts = [[1, 1], [2 + 0.23 * sour, 0.16 + 0.12 * sour], [3 + 0.55 * sour, 0.05 + 0.08 * sour]];
      var tc = 0.16 + 0.45 * sour;
      notes.forEach(function (n) {
        var g = gain(0), st = t + n[1];
        g.connect(dest);
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(pk, st + 0.005); g.gain.setTargetAtTime(0, st + 0.005, tc);
        parts.forEach(function (p, i) {
          var o = osc(i ? 'sine' : 'triangle', n[0] * p[0]), pg = gain(p[1]);
          if (sour > 0) o.frequency.setTargetAtTime(n[0] * p[0] * semi(-0.5 * sour), st + 0.05, tc * 2);
          o.connect(pg); pg.connect(g); o.start(st); o.stop(st + tc * 7 + 0.1);
          if (!i && sour > 0.1) { var gh = osc('sine', n[0] + 3 + 9 * sour), gg = gain(0.55 * sour); gh.connect(gg); gg.connect(g); gh.start(st); gh.stop(st + tc * 7 + 0.1); }
        });
      });
    }
    /* one struck bowl/bell: inharmonic partials, each twinned so it beats */
    function bowl(f, peak, decay, sour) {
      var p = [[1, 1, decay], [2.71, 0.55, decay * 0.8], [5.15, 0.3, decay * 0.55], [8.43, 0.14, decay * 0.4], [12.4, 0.06, decay * 0.25]];
      if (sour) p.push([1.06, 0.4, decay * 0.9]);
      modal(f, p, peak, 0, wetOf(0.9), 0.9);
    }
    function tock(f, peak, dest) { modal(f, [[1, 1, 0.07], [2.31, 0.45, 0.035], [4.12, 0.2, 0.018]], peak, 0, dest); }
    /* a dry knife cut: a short scrape (noise through a narrow, falling
       band, chattered by stick-slip) that ends in the blade biting wood */
    function scrape(i, peak) {
      var t = ac.currentTime + 0.012, dur = 0.12 + rnd() * 0.07, f0 = 4200 - (i % 4) * 260;
      var s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      var hp = filt('highpass', 1800, 0.7), bp = filt('bandpass', f0, 8), am = gain(0.55), ch = osc('sawtooth', 48 + rnd() * 30), chg = gain(0.45), g = gain(0);
      ch.connect(chg); chg.connect(am.gain);
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + dur);
      s.connect(hp); hp.connect(bp); bp.connect(am); am.connect(g); g.connect(wetOf(0.12));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.012); g.gain.setValueAtTime(peak, t + dur * 0.6); g.gain.setTargetAtTime(0, t + dur * 0.6, 0.025);
      s.start(t, rnd() * 0.5); s.stop(t + dur + 0.2); ch.start(t); ch.stop(t + dur + 0.2);
      modal(330 + rnd() * 40, [[1, 1, 0.09], [2.62, 0.5, 0.05], [5.1, 0.25, 0.025]], peak * 0.55, dur * 0.85, wetOf(0.2));
    }
    /* a mechanical key: a bright plastic click, a low thock, and the release */
    function keyClick(del) {
      var t = ac.currentTime + 0.01, s = ac.createBufferSource(), hp = filt('highpass', 3500, 0.7), g = gain(0);
      s.buffer = noiseBuf; s.connect(hp); hp.connect(g); g.connect(bus);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028, t + 0.001); g.gain.setTargetAtTime(0, t + 0.001, 0.0012);
      s.start(t, rnd() * 0.8); s.stop(t + 0.03);
      var hi = del ? 1750 : 2300 + rnd() * 350, lo = del ? 185 : 235 + rnd() * 45;
      modal(hi, [[1, 1, 0.012], [1.7, 0.45, 0.008]], 0.05, 0, wetOf(0.1));
      modal(lo, [[1, 1, 0.03], [2.4, 0.4, 0.016]], 0.11, 0.002);
      modal(hi * 0.86, [[1, 1, 0.008]], 0.022, 0.07 + rnd() * 0.03);
    }
    /* a held chord that swells and fades, in the glass voice */
    var swells = [];
    function swell(freqs, peak, up, hold, down, beat) {
      var t = ac.currentTime + 0.02, g = gain(0), end = t + up + hold + down;
      g.connect(bus); g.connect(wet);
      swells.push(g); setTimeout(function () { var i = swells.indexOf(g); if (i >= 0) swells.splice(i, 1); }, (end - t + 0.5) * 1000);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + up); g.gain.setValueAtTime(peak, t + up + hold); g.gain.linearRampToValueAtTime(0, end);
      freqs.forEach(function (fr, i) {
        var o = osc('glass', fr), o2 = osc('glass', fr + (beat || 0.3) * (1 + i * 0.4)), og = gain(0.3 / Math.sqrt(freqs.length));
        o.connect(og); o2.connect(og); og.connect(g); o.start(t); o2.start(t); o.stop(end + 0.1); o2.stop(end + 0.1);
      });
    }
    function hushSwells() {
      swells.forEach(function (g) { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(g.gain.value, ac.currentTime); g.gain.setTargetAtTime(0, ac.currentTime, 0.9); });
      swells = [];
    }
    /* a single glass tone that leans up a semitone, like something taking hold */
    function lean(f, peak) {
      var t = ac.currentTime + 0.02, o = osc('glass', f), g = gain(0);
      o.frequency.setValueAtTime(f, t); o.frequency.setTargetAtTime(f * semi(1), t + 0.4, 0.8);
      o.connect(g); g.connect(bus); g.connect(wet);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.6); g.gain.setTargetAtTime(0, t + 1.6, 0.7);
      o.start(t); o.stop(t + 6);
    }
    /* wood settling: a stick-slip pulse train ringing two resonances of
       the grain, its rate bending up and back (a creak, not a gust) */
    function creak(peak) {
      var t = ac.currentTime + 0.02, dur = 0.45 + rnd() * 0.45, r0 = 18 + rnd() * 10;
      var src = osc('sawtooth', r0), b1 = filt('bandpass', 520 + rnd() * 140, 11), b2 = filt('bandpass', 1250 + rnd() * 250, 14), g = gain(0);
      src.frequency.setValueAtTime(r0, t); src.frequency.linearRampToValueAtTime(r0 * 1.7, t + dur * 0.55); src.frequency.linearRampToValueAtTime(r0 * 1.15, t + dur);
      b1.frequency.setTargetAtTime(b1.frequency.value * 1.07, t, dur);
      src.connect(b1); src.connect(b2); b1.connect(g); b2.connect(g); g.connect(bus); g.connect(wet);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.08); g.gain.setValueAtTime(peak, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
      src.start(t); src.stop(t + dur + 0.05);
    }

    function sfx(e) {
      if (!ac || !on || ac.state !== 'running' || !e) return;
      var s = currentStage(), d = currentD(), r = rootHz(d), nowT = performance.now();
      switch (e.k) {
        case 'notify': chime(SOUR[s] || 0); break;
        case 'reply': bowl(r * 4, 0.022, 2.4, s >= 4); break;
        case 'cut': scrape(e.i || 0, 0.22); break;
        case 'ring':
          /* a soft tick as each ring is laid down, a little lower each time */
          if (isReduced() || nowT - lastRing < 70) break;
          lastRing = nowT;
          modal(2100 * semi(-(e.f || 0) * 7), [[1, 1, 0.014], [2.7, 0.3, 0.007]], 0.045, 0, wetOf(0.25));
          break;
        case 'line': tock(360 + rnd() * 30, 0.1, wetOf(0.35)); break;
        case 'climax': swell([r * 2, r * 2 * 1.2, r * 2 * 1.40625, r * 4 * semi(1)], 0.07, 3, 4, 4, 0.9); break;
        case 'still': duckTarget = 0.05; clockOn = false; hushSwells(); break;
        case 'autoscroll': lean(r * 4, 0.05); break;
        case 'handback': tock(392, 0.12, wetOf(0.35)); break;
        case 'key':
          if (nowT - lastKey < 25) break;
          lastKey = nowT; keyN++;
          keyClick(!!e.del);
          break;
        case 'reveal': duckTarget = 0.04; bowl(196, 0.075, 9, false); break;
        case 'send': chime(1, { peak: 0.06 }); break;
        case 'tookback': break;
        case 'resolve': resolved = true; duckTarget = 0.45; swell([r * 2, r * 3, r * 4, r * 6], 0.05, 4, 3, 7, 0.15); break;
      }
    }

    function scheduleTexture() {
      if (!ac || !on || ac.state !== 'running') return;
      var d = currentD(), t = performance.now();
      /* the clock in the room: from stage 3, slightly irregular, until the stillness */
      if (clockOn && d >= 0.55 && duck > 0.5 && t >= nextClock) {
        clockN++;
        tock(clockN % 2 ? 1180 : 990, 0.035 + 0.03 * smooth(0.55, 0.9, d), wetOf(0.3));
        nextClock = t + 1150 + Math.random() * 260 + (Math.random() < 0.1 ? 900 : 0);
      }
      /* wood settling */
      if (d >= 0.42 && duck > 0.5 && t >= nextCreak) {
        if (nextCreak) creak(0.5 + 0.5 * smooth(0.42, 1, d));
        nextCreak = t + lerp(15000, 7000, smooth(0.42, 1, d)) * (0.6 + Math.random() * 0.8);
      }
    }

    function update() {
      label();
      if (!ac || !on) return;
      var d = currentD(), cp = Carve.progress();
      var inCarve = cp > 0 && cp < 1 && (function () { var s = document.getElementById('carve'); if (!s) return false; var r = s.getBoundingClientRect(); return r.top <= 1 && r.bottom > innerHeight * 0.5; })();
      /* stillness: scrolling back out of the ending lifts the hush again */
      if (!resolved) {
        var w = (hw() && hw().where) || '';
        var deep = (inCarve && cp >= 0.83) || w === 'end';
        if (!deep && duckTarget < 0.5) duckTarget = 1;
        if (deep && duckTarget > 0.1) { duckTarget = 0.05; hushSwells(); }
      }
      clockOn = duckTarget > 0.5;
      duck += (duckTarget - duck) * 0.08;
      var r = rootHz(d), b = bed;
      var third = lerp(1.25, 1.2, smooth(0.18, 0.45, d)) * semi(-0.45 * smooth(0.8, 1, d));   /* major → minor → sagging */
      var fifth = lerp(1.5, 1.40625, smooth(0.45, 0.92, d));                                  /* the fifth collapses to a tritone */
      var oct = 2 * lerp(1, 16 / 15, smooth(0.68, 1, d));                                      /* the octave sours to a minor ninth */
      /* open voicing: the root low, the third and fifth an octave up, the octave above that (phone speakers) */
      var ratios = [1, third * 2, fifth * 2, oct * 2], beat = 0.12 + 3.2 * Math.pow(d, 1.6);
      for (var i = 0; i < b.voices.length; i++) {
        var f = r * ratios[i];
        set(b.voices[i].a.frequency, f, 1.2);
        set(b.voices[i].c.frequency, f + beat * (0.7 + 0.25 * i), 1.2);
      }
      var gf = r * 6, mr = lerp(2, 1.414, smooth(0.4, 0.9, d));
      set(b.car.frequency, gf, 1.5); set(b.mod.frequency, gf * mr, 1.5);
      set(b.modG.gain, gf * lerp(0.25, 1.1, d), 1.5);
      set(b.glassG.gain, 0.05 * smooth(0.22, 0.8, d), 1.5);
      set(b.hiG.gain, 0.03 * smooth(0.78, 1, d), 2);
      set(b.sub.frequency, r / 2, 1.5);
      set(b.subG.gain, 0.02 * smooth(0.3, 0.9, d) * duck, 1);
      set(b.g.gain, BED * (0.62 + 0.38 * smooth(0, 0.6, d)) * duck, 0.8);   /* quieter while it is still a product */
      set(master.gain, 0.9, 0.4);
      var st = currentStage();
      if (st !== lastStage) {
        var prev = lastStage; lastStage = st;
        /* each new stage: the same product chime, a step lower and further gone */
        if (prev >= 0 && st > prev) chime(SOUR[st] || 1, { k: semi(-st), peak: 0.08 });
      }
      scheduleTexture();
    }

    function turnOn() {
      if (!ac && !init()) { if (btnT) btnT.textContent = 'No sound'; return; }
      /* iOS: play through the silent switch, like a media player would */
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      on = true;
      try { var pr = ac.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ }
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(0.0001, ac.currentTime);
      master.gain.linearRampToValueAtTime(0.9, ac.currentTime + 1.6);   /* fade in, never a jump */
      lastStage = currentStage();
      update();
      /* a small hello so the visitor knows it worked: the product chime, as it is right now */
      setTimeout(function () { if (on && ac) chime(SOUR[currentStage()] || 0); }, 250);
      if (!timer) timer = setInterval(update, 120);
      var h = hw(); if (h) { h.soundPref = 'on'; try { h.memory && h.memory.save(); } catch (e) {} }
    }
    function turnOff() {
      on = false;
      label();
      var h = hw(); if (h) { h.soundPref = 'off'; try { h.memory && h.memory.save(); } catch (e) {} }
      if (!ac) return;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.12);
      setTimeout(function () { if (!on && ac) { try { ac.suspend(); } catch (e) { /* ignore */ } } }, 900);
    }

    function finale() { /* the ending's own cue ('resolve') carries it */ }

    function build() {
      btn = document.getElementById('ambient');
      if (!btn) return;
      btnT = btn.querySelector('.amb-t');
      label();
      btn.addEventListener('click', function () { if (on) turnOff(); else turnOn(); });
      setInterval(function () { if (!on) label(); }, 1000);
      hwOn('sfx', sfx);
      var h = hw();
      if (h) h.sound = { on: function () { if (!on) turnOn(); }, off: turnOff, isOn: function () { return on; }, ctx: function () { return ac; } };
    }

    return { build: build, finale: finale, ctx: function () { return ac; } };
  })();

  /* =========================================================
     3. FAVICON + END STATE
     ========================================================= */
  var End = (function () {
    var link, lastSig = '', done = false, bottomSince = 0, badge = 0;

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
      if (badge > 0) {   /* while you're away: an unread badge, like any app */
        x.fillStyle = '#D9381E'; x.beginPath(); x.arc(46, 18, 16, 0, TAU); x.fill();
        x.fillStyle = '#FFF6EC'; x.font = 'bold 22px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(Math.min(9, badge)), 46, 19.5);
      }
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
      var sig = Math.max(1, Math.round(5 - d * 4.4)) + ':' + Math.round(smooth(0.35, 0.85, d) * 4) + ':' + badge;
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
      hwOn('away', function (e) { badge = e && e.count ? e.count : 0; lastSig = ''; if (!done) tick(); });
      hwOn('back', function () { badge = 0; lastSig = ''; if (!done) tick(); });
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
