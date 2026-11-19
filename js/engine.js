/* =========================================================
   HEARTWOOD — engine.js (Agent 2)
   The dread engine: one number, D, and everything it touches.
   window.HW is created synchronously, before anything else.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     0. Global API — created first, synchronously
     --------------------------------------------------------- */
  var T0 = (window.performance && performance.now) ? performance.now() : Date.now();
  function now() { return performance.now(); }
  var listeners = {};
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  var HW = window.HW = {
    d: 0,
    stage: 0,
    reduced: !!(mq && mq.matches),
    device: detectDevice(),
    said: [],
    palette: { bg: '#F6F1E7', fg: '#1D1A15', accent: '#E2603B' },
    elapsed: function () { return (now() - T0) / 1000; },
    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function off() {
        var a = listeners[evt]; if (!a) return;
        var i = a.indexOf(fn); if (i > -1) a.splice(i, 1);
      };
    },
    off: function (evt, fn) {
      var a = listeners[evt]; if (!a) return;
      var i = a.indexOf(fn); if (i > -1) a.splice(i, 1);
    },
    emit: function (evt, data) {
      var a = listeners[evt]; if (!a || !a.length) return;
      a = a.slice();
      for (var i = 0; i < a.length; i++) {
        try { a[i](data); } catch (e) { if (window.console) console.error('[HW] listener for "' + evt + '" threw:', e); }
      }
    },
    bump: function (x) {
      x = +x; if (!(x > 0)) return;
      bumps = Math.min(BUMP_CAP, bumps + x);
    },
    progress: function (el) { return progressOf(el); },
    mix: function (a, b, t) { return toHex(mixRGB(parseHex(a), parseHex(b), clamp(+t || 0, 0, 1))); },
    debug: {}
  };
  if (mq) {
    var onMQ = function (e) { HW.reduced = !!e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMQ); else if (mq.addListener) mq.addListener(onMQ);
  }

  /* ---------------------------------------------------------
     Tuning
     --------------------------------------------------------- */
  var PEAK_K = 0.55;          // floor share of the deepest point you've scrolled to
  var TIME_START = 35;        // seconds of (visible) time before the clock starts to count
  var TIME_RATE = 0.004;      // per second  (≈ +0.12 per 30s)
  var TIME_CAP = 0.30;
  var BUMP_CAP = 0.35;
  var STAGES = [0.15, 0.35, 0.55, 0.75, 0.9];
  var IDLE_MARKS = [8, 20, 45];

  /* ---------------------------------------------------------
     Small utils
     --------------------------------------------------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function parseHex(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16); if (isNaN(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) {
    return '#' + ((1 << 24) | (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])).toString(16).slice(1).toUpperCase();
  }
  function mixRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function contrast(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function hash(a, b) {
    var x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function stageOf(d) { var s = 0; while (s < STAGES.length && d >= STAGES[s]) s++; return s; }

  function detectDevice() {
    var ua = navigator.userAgent || '', p = navigator.platform || '';
    var touch = (navigator.maxTouchPoints || 0) > 1;
    if (/iPhone|iPod/.test(ua)) return 'an iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'an iPad';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'an Android phone' : 'an Android tablet';
    if (/CrOS/.test(ua)) return 'a Chromebook';
    if (/Mac/.test(p) || /Macintosh/.test(ua)) return 'a Mac';
    if (/Win/.test(p) || /Windows/.test(ua)) return 'a Windows PC';
    if (/Linux/.test(p) || /Linux/.test(ua)) return 'a Linux machine';
    return 'a screen';
  }

  /* ---------------------------------------------------------
     State
     --------------------------------------------------------- */
  var root = document.documentElement;
  var pin = (function () {
    try {
      var v = new URLSearchParams(location.search).get('d');
      if (v === null || v === '') return null;
      var n = parseFloat(v); return isFinite(n) ? clamp(n, 0, 1) : null;
    } catch (e) { return null; }
  })();

  var sections = [];           // {el, top, h, d, bg, fg, ac}
  var offCache = new WeakMap();// el -> {top,h} for HW.progress
  var vh = window.innerHeight || 800;
  var dirty = true;

  var scrollD = 0, peak = 0, floor = pin !== null ? pin : 0, bumps = 0;
  var activeTime = 0, lastFrame = 0;
  var emittedD = -1, emittedStage = 0;
  var lastInput = now(), idleFired = 0;
  var booting = true;
  var hiddenAt = 0;
  var cur = { bg: '', fg: '', ac: '', d: '' };
  var polarityDark = true;     // fg pole: true = dark text on light bg

  /* ---------------------------------------------------------
     1. Section geometry (cached; recomputed only when layout changes)
     --------------------------------------------------------- */
  function collectSections() {
    var els = document.querySelectorAll('main > section[data-d], body > footer[data-d], #foot[data-d]');
    var seen = [];
    sections = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i]; if (seen.indexOf(el) > -1) continue; seen.push(el);
      sections.push({
        el: el, top: 0, h: 1,
        d: clamp(parseFloat(el.getAttribute('data-d')) || 0, 0, 1),
        bg: parseHex(el.getAttribute('data-bg') || '#F6F1E7'),
        fg: parseHex(el.getAttribute('data-fg') || '#1D1A15'),
        ac: parseHex(el.getAttribute('data-ac') || '#E2603B')
      });
    }
    sections.sort(function (a, b) { return a.el.compareDocumentPosition(b.el) & 2 ? 1 : -1; });
  }
  var measures = 0;
  function measure() {
    dirty = false; measures++;
    vh = window.innerHeight || vh;
    var sy = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i], r = s.el.getBoundingClientRect();
      s.top = r.top + sy; s.h = Math.max(1, r.height);
      offCache.set(s.el, { top: s.top, h: s.h });
    }
  }
  var adhoc = [];
  function progressOf(el) {
    if (!el) return 0;
    var c = offCache.get(el);
    if (!c) {
      var r = el.getBoundingClientRect(), sy = window.scrollY || 0;
      c = { top: r.top + sy, h: Math.max(1, r.height) };
      offCache.set(el, c); adhoc.push(el);
    }
    var range = c.h - vh;
    if (range <= 1) { // not taller than viewport: progress through its pass across the screen
      return clamp(((window.scrollY || 0) + vh - c.top) / (c.h + vh), 0, 1);
    }
    return clamp(((window.scrollY || 0) - c.top) / range, 0, 1);
  }
  function markDirty() {
    dirty = true;
    // ad-hoc progress caches go stale too
    for (var i = 0; i < adhoc.length; i++) offCache.delete(adhoc[i]);
    adhoc = [];
  }

  function computeScrollD() {
    var n = sections.length; if (!n) return 0;
    var mid = (window.scrollY || 0) + vh * 0.5;
    var i = 0;
    for (var k = n - 1; k >= 0; k--) { if (mid >= sections[k].top) { i = k; break; } }
    var s = sections[i], nx = sections[Math.min(n - 1, i + 1)];
    var t = clamp((mid - s.top) / s.h, 0, 1);
    scrollPal = paletteBetween(s, nx, smooth(0.35, 1, t));
    return lerp(s.d, nx.d, t);
  }

  /* ---------------------------------------------------------
     2. Palette
     --------------------------------------------------------- */
  var scrollPal = null;
  var POLE_DARK = parseHex('#0D0B09'), POLE_LIGHT = parseHex('#F4ECDF');
  function isLightBg(c) { return lum(c) > 0.18; }
  function paletteBetween(a, b, t) {
    // light→dark crossings happen quickly, so the page never lingers on mid-grey
    if (isLightBg(a.bg) !== isLightBg(b.bg)) t = smooth(0.38, 0.62, t);
    return { bg: mixRGB(a.bg, b.bg, t), fg: mixRGB(a.fg, b.fg, t), ac: mixRGB(a.ac, b.ac, t) };
  }
  function paletteAtD(d) {
    var n = sections.length;
    if (!n) return null;
    if (d <= sections[0].d) return paletteBetween(sections[0], sections[0], 0);
    for (var k = 0; k < n - 1; k++) {
      var a = sections[k], b = sections[k + 1];
      if (d >= a.d && d <= b.d) {
        var span = b.d - a.d;
        return paletteBetween(a, b, span > 0 ? (d - a.d) / span : 1);
      }
    }
    var l = sections[n - 1]; return paletteBetween(l, l, 0);
  }
  function safePalette(p) {
    var bg = p.bg, fg = p.fg, ac = p.ac;
    // pick text pole with hysteresis so it never flutters at the crossover
    var cd = contrast(POLE_DARK, bg), cl = contrast(POLE_LIGHT, bg);
    if (polarityDark && cl > cd * 1.15) polarityDark = false;
    else if (!polarityDark && cd > cl * 1.15) polarityDark = true;
    var pole = polarityDark ? POLE_DARK : POLE_LIGHT;
    // fg is not allowed to be on the wrong side of the bg
    if ((lum(fg) > lum(bg)) === polarityDark) fg = mixRGB(fg, pole, 0.85);
    var target = Math.min(7.5, contrast(pole, bg) * 0.92);
    for (var k = 1; k <= 10 && contrast(fg, bg) < target; k++) fg = mixRGB(fg, pole, 0.18);
    var at = Math.min(3.0, contrast(pole, bg) * 0.62);
    for (var j = 1; j <= 10 && contrast(ac, bg) < at; j++) ac = mixRGB(ac, pole, 0.12);
    return { bg: bg, fg: fg, ac: ac };
  }

  var lastW = { bg: null, fg: null, ac: null };
  function far(a, b) {
    if (!b) return true;
    return Math.abs(a[0] - b[0]) >= 3 || Math.abs(a[1] - b[1]) >= 3 || Math.abs(a[2] - b[2]) >= 3;
  }
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyPalette(D) {
    if (!scrollPal) return;
    var p = scrollPal;
    var lead = floor - scrollD;
    if (lead > 0) {
      var dp = paletteAtD(D);
      if (dp) {
        var w = smooth(0, 0.08, lead);
        p = { bg: mixRGB(p.bg, dp.bg, w), fg: mixRGB(p.fg, dp.fg, w), ac: mixRGB(p.ac, dp.ac, w) };
      }
    }
    p = safePalette(p);
    // write only on a visible step (≥3/255 in any channel): every write restyles the page
    if (far(p.bg, lastW.bg)) lastW.bg = p.bg;
    if (far(p.fg, lastW.fg)) lastW.fg = p.fg;
    if (far(p.ac, lastW.ac)) lastW.ac = p.ac;
    var bg = toHex(lastW.bg), fg = toHex(lastW.fg), ac = toHex(lastW.ac), dd = (Math.round(D * 100) / 100).toString();
    var st = root.style;
    if (bg !== cur.bg) { st.setProperty('--bg', bg); cur.bg = bg; HW.palette.bg = bg; if (themeMeta) themeMeta.setAttribute('content', bg); }
    if (fg !== cur.fg) { st.setProperty('--fg', fg); cur.fg = fg; HW.palette.fg = fg; }
    if (ac !== cur.ac) { st.setProperty('--accent', ac); cur.ac = ac; HW.palette.accent = ac; }
    if (dd !== cur.d) { st.setProperty('--d', dd); cur.d = dd; }
  }

  /* ---------------------------------------------------------
     3. Text controllers: data-swap, .rot, substitutions
     --------------------------------------------------------- */
  var GLYPHS = '░▒▓#%&*+=<>/\\|~^:;_'.split('');
  var LETTERS = 'abcdeghilmnorstuwy'.split('');
  var LOOK = {
    a: 'ɑα', b: 'ƅ', c: 'ç', d: 'ɗ', e: 'ɘǝ', f: 'ƒ', g: 'ɠ', h: 'ɦ', i: 'ıï', k: 'ĸ', l: 'łꞁ', m: 'ɱ',
    n: 'ŋɲ', o: 'øɵ', p: 'ρ', r: 'ɾʀ', s: 'ʂꜱ', t: 'ƭţ', u: 'ʊü', v: 'ʋ', w: 'ɯ', y: 'ɣ', z: 'ʐ',
    A: 'Λ', E: 'Ǝ', O: 'Ø', S: 'Ƨ', T: 'Ŧ', N: 'И', R: 'Я', H: 'Ħ'
  };
  var HEAVY = ['▒', '·', '', '_', '░'];

  var ctls = [];            // all text controllers
  var ctlByEl = new WeakMap();
  var thresholds = [];      // sorted unique thresholds for swap/show/hide/count-swap
  var bucket = -1;
  var rotLevel = -1;
  var animating = [];       // ctls with a running scramble
  var inView = new Set();
  var io = null;

  function parseStages(s) {
    if (!s) return [];
    var out = [];
    s.split('|').forEach(function (part) {
      var i = part.indexOf(':'); if (i < 0) return;
      var t = parseFloat(part.slice(0, i)); if (!isFinite(t)) return;
      out.push({ t: t, text: part.slice(i + 1) });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function addThreshold(t) { if (thresholds.indexOf(t) < 0) thresholds.push(t); }

  function makeCtl(el, kind) {
    var c = ctlByEl.get(el);
    if (c) return c;
    c = {
      el: el, idx: ctls.length,
      base: el.textContent,
      stages: parseStages(el.getAttribute('data-swap')),
      rot: el.classList.contains('rot') && !el.firstElementChild,
      subs: [],           // [{from, to}]
      stageIdx: -1,
      shown: el.textContent,
      anim: null
    };
    c.stages.forEach(function (s) { addThreshold(s.t); });
    ctls.push(c); ctlByEl.set(el, c);
    if (io) io.observe(el);
    return c;
  }
  function swapText(c, D) {
    var t = c.base, idx = -1;
    for (var i = 0; i < c.stages.length; i++) { if (D >= c.stages[i].t) { t = c.stages[i].text; idx = i; } else break; }
    c.stageIdx = idx;
    return t;
  }
  function caseLike(src, rep) {
    if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return rep[0].toUpperCase() + rep.slice(1);
    return rep;
  }
  function applySubs(c, t) {
    for (var i = 0; i < c.subs.length; i++) {
      var s = c.subs[i];
      t = t.replace(new RegExp('\\b' + s.from + '\\b', 'i'), function (m) { return caseLike(m, s.to); });
    }
    return t;
  }
  function rotAmount(D) {
    if (D < 0.5) return 0;
    if (D < 0.75) return (D - 0.5) / 0.25 * 0.1;      // up to 10% of letters: mostly legible
    return 0.1 + (D - 0.75) / 0.25 * 0.32;            // stage 4–5: it lets go
  }
  function rotText(c, t, amt, D) {
    if (amt <= 0) return t;
    var out = '', heavyOK = D >= 0.75;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i], r = hash(c.idx + 7, i);
      if (ch === ' ' || r >= amt) { out += ch; continue; }
      var r2 = hash(c.idx + 101, i * 3 + 1);
      if (heavyOK && r2 < 0.28) { out += HEAVY[(r2 * 100 | 0) % HEAVY.length]; continue; }
      var alt = LOOK[ch];
      out += alt ? alt[(r2 * 10 | 0) % alt.length] : ch;
    }
    return out;
  }
  function targetText(c, D) {
    var t = applySubs(c, swapText(c, D));
    if (c.rot) t = rotText(c, t, Math.round(rotAmount(D) * 50) / 50, D);
    return t;
  }
  function setText(c, t, allowFx) {
    if (t === c.shown && !c.anim) return;
    if (allowFx && !booting && !HW.reduced && inView.has(c.el) && document.visibilityState !== 'hidden') {
      var from = c.anim ? c.el.textContent : c.shown;
      var pre = 0, max = Math.min(from.length, t.length);
      while (pre < max && from[pre] === t[pre]) pre++;
      var suf = 0;
      while (suf < max - pre && from[from.length - 1 - suf] === t[t.length - 1 - suf]) suf++;
      var mlen = Math.max(from.length, t.length) - pre - suf;
      c.anim = { from: from, to: t, pre: pre, suf: suf, start: now(), dur: clamp(260 + mlen * 7, 380, 1100), step: 0 };
      c.el.classList.add('hw-swapping');
      if (animating.indexOf(c) < 0) animating.push(c);
    } else {
      if (c.anim) { c.anim = null; c.el.classList.remove('hw-swapping'); }
      c.el.textContent = t;
    }
    c.shown = t;
  }
  function stepAnims(tnow) {
    for (var i = animating.length - 1; i >= 0; i--) {
      var c = animating[i], a = c.anim;
      if (!a) { animating.splice(i, 1); continue; }
      var p = (tnow - a.start) / a.dur;
      if (p >= 1 || HW.reduced) {
        c.el.textContent = a.to; c.anim = null; c.el.classList.remove('hw-swapping'); animating.splice(i, 1); continue;
      }
      var st = (tnow / 65) | 0; if (st === a.step) continue; a.step = st;
      var mf = a.from.slice(a.pre, a.from.length - a.suf), mt = a.to.slice(a.pre, a.to.length - a.suf);
      var L = Math.round(lerp(mf.length, mt.length, Math.min(1, p * 1.4)));
      var reveal = Math.floor(clamp((p - 0.2) / 0.8, 0, 1) * L);
      var out = '';
      for (var k = 0; k < L; k++) {
        if (k < reveal) { out += mt[k] || ''; continue; }
        var ref = mt[k] || mf[k] || 'x';
        out += (ref === ' ') ? ' ' : (p < 0.12 && mf[k] && Math.random() < 0.6 ? mf[k] : (Math.random() < 0.55 ? pick(LETTERS) : pick(GLYPHS)));
      }
      c.el.textContent = a.to.slice(0, a.pre) + out + a.to.slice(a.to.length - a.suf);
    }
  }

  /* data-show / data-hide / counts */
  var showEls = [], hideEls = [], counts = [];
  function initMarkup() {
    var i, els;
    els = document.querySelectorAll('[data-swap]');
    for (i = 0; i < els.length; i++) { if (els[i].id !== 'ambient') makeCtl(els[i]); }
    els = document.querySelectorAll('.rot');
    for (i = 0; i < els.length; i++) makeCtl(els[i]);

    els = document.querySelectorAll('[data-show]');
    for (i = 0; i < els.length; i++) { var t = parseFloat(els[i].getAttribute('data-show')); if (isFinite(t)) { showEls.push({ el: els[i], t: t, on: null }); addThreshold(t); } }
    els = document.querySelectorAll('[data-hide]');
    for (i = 0; i < els.length; i++) { var h = parseFloat(els[i].getAttribute('data-hide')); if (isFinite(h)) { hideEls.push({ el: els[i], t: h, on: null }); addThreshold(h); } }

    els = document.querySelectorAll('[data-count]');
    for (i = 0; i < els.length; i++) {
      var el = els[i], n = parseFloat(el.getAttribute('data-count'));
      if (!isFinite(n)) continue;
      var c = { el: el, n: n, start: 0, done: false, swaps: parseStages(el.getAttribute('data-count-swap')), swapIdx: -2, shown: '', idx: 1000 + i };
      c.swaps.forEach(function (s) { addThreshold(s.t); });
      counts.push(c);
    }
    thresholds.sort(function (a, b) { return a - b; });

    els = document.querySelectorAll('[data-device]');
    for (i = 0; i < els.length; i++) els[i].textContent = HW.device;
  }
  function fmt(n, target) {
    var v = Math.round(n);
    return target >= 1000 ? v.toLocaleString('en-US') : String(v);
  }
  function updateCounts(tnow, D, force) {
    for (var i = 0; i < counts.length; i++) {
      var c = counts[i], si = -1, stxt = null;
      for (var k = 0; k < c.swaps.length; k++) { if (D >= c.swaps[k].t) { si = k; stxt = c.swaps[k].text; } }
      var txt;
      if (si >= 0) txt = stxt;
      else if (!c.start) txt = '0';
      else {
        var p = clamp((tnow - c.start) / 1700, 0, 1);
        if (p >= 1) c.done = true;
        txt = fmt(c.n * (1 - Math.pow(1 - p, 3)), c.n);
      }
      if (txt !== c.shown || force) {
        var wasSwap = c.swapIdx !== si && c.swapIdx !== -2;
        c.swapIdx = si;
        if (wasSwap && !booting && !HW.reduced && inView.has(c.el)) {
          // reuse scramble machinery
          var ctl = ctlByEl.get(c.el) || makeCtl(c.el);
          ctl.isCount = true;
          ctl.shown = c.el.textContent; ctl.base = txt; ctl.stages = [];
          setText(ctl, txt, true);
        } else c.el.textContent = txt;
        c.shown = txt;
      }
    }
  }

  function updateThresholdBound(D) {
    var i;
    for (i = 0; i < ctls.length; i++) {
      var c = ctls[i];
      if (c.isCount) continue;
      setText(c, targetText(c, D), true);
    }
    for (i = 0; i < showEls.length; i++) {
      var s = showEls[i], on = D >= s.t;
      if (on !== s.on) { s.on = on; s.el.classList.toggle('shown', on); }
    }
    for (i = 0; i < hideEls.length; i++) {
      var h = hideEls[i], off = D >= h.t;
      if (off !== h.on) { h.on = off; h.el.classList.toggle('hidden', off); }
    }
  }
  function bucketOf(D) {
    var lo = 0, hi = thresholds.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (thresholds[m] <= D) lo = m + 1; else hi = m; }
    return lo;
  }

  /* substitutions: single words that turn, and stay turned (stage 3+) */
  var VOCAB = {
    question: 'hunger', questions: 'hungers', answer: 'echo', answers: 'echoes',
    ask: 'pray', asks: 'prays', asking: 'praying', asked: 'prayed',
    message: 'prayer', messages: 'prayers', token: 'shaving', tokens: 'shavings',
    model: 'mirror', models: 'mirrors', memory: 'grain', memories: 'rings',
    window: 'mouth', faster: 'hungrier', team: 'congregation', teams: 'congregations',
    data: 'grain', support: 'altar', version: 'ring', versions: 'rings', release: 'offering',
    understood: 'whittled', understands: 'whittles', understand: 'whittle', think: 'carve',
    thinking: 'carving', people: 'mouths', notes: 'shavings', replies: 'echoes', learns: 'feeds',
    work: 'worship', tools: 'knives', sources: 'roots', feedback: 'feeding', help: 'feed', helps: 'feeds'
  };
  var VOCAB_RE = new RegExp('\\b(' + Object.keys(VOCAB).join('|') + ')\\b', 'gi');
  var substCandidatesReady = false, nextSubst = 0, substCount = 0, SUBST_MAX = 26;
  var OWNED_ELSEWHERE = '#chat, #traceMount, #carveText, #carve, #finalMount, #end, #ambient';
  function prepSubstCandidates() {
    substCandidatesReady = true;
    var els = document.querySelectorAll('main p, main li, main dd, main blockquote, main h3, main h4, main summary span, main .stat > span, .foot p');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.firstElementChild || el.closest(OWNED_ELSEWHERE) || el.hasAttribute('data-count')) continue;
      if ((el.textContent || '').length < 10) continue;
      makeCtl(el).substOK = true;
    }
    for (var j = 0; j < ctls.length; j++) if (!ctls[j].el.closest(OWNED_ELSEWHERE)) ctls[j].substOK = true;
  }
  function trySubst(tnow, D) {
    if (!substCandidatesReady) prepSubstCandidates();
    var pool = [];
    for (var i = 0; i < ctls.length; i++) {
      var c = ctls[i];
      if (!c.substOK || c.anim || !inView.has(c.el) || c.subs.length >= 2 || c.isCount) continue;
      var txt = applySubs(c, swapText(c, D));
      var m = txt.match(VOCAB_RE); if (!m) continue;
      var have = c.subs.map(function (s) { return s.from; });
      var fresh = m.filter(function (w) { return have.indexOf(w.toLowerCase()) < 0; });
      if (fresh.length) pool.push({ c: c, w: pick(fresh) });
    }
    if (!pool.length) return false;
    var choice = pick(pool), from = choice.w.toLowerCase();
    choice.c.subs.push({ from: from, to: VOCAB[from] });
    substCount++;
    setText(choice.c, targetText(choice.c, D), true);
    return true;
  }

  /* ---------------------------------------------------------
     4. Twitch
     --------------------------------------------------------- */
  var twitchEls = [], nextTwitch = 0, twitching = null, twitchEnd = 0;
  function doTwitch(tnow, D) {
    if (twitching && tnow >= twitchEnd) { twitching.classList.remove('hw-tw'); twitching = null; }
    if (HW.reduced || D < 0.18 || tnow < nextTwitch || twitching) return;
    var vis = twitchEls.filter(function (el) { return inView.has(el); });
    var k = smooth(0.18, 1, D);
    nextTwitch = tnow + lerp(9000, 1500, k) * (0.6 + Math.random() * 0.8);  // never faster than ~1/s
    if (!vis.length) return;
    var el = pick(vis), amp = lerp(1.2, 5, k);
    el.style.setProperty('--tx', ((Math.random() * 2 - 1) * amp).toFixed(1) + 'px');
    el.style.setProperty('--ty', ((Math.random() * 2 - 1) * amp * 0.35).toFixed(1) + 'px');
    el.style.setProperty('--tk', ((Math.random() * 2 - 1) * lerp(0.3, 2.4, k)).toFixed(2) + 'deg');
    el.classList.add('hw-tw');
    twitching = el; twitchEnd = tnow + 90 + Math.random() * 90;
  }

  /* ---------------------------------------------------------
     5. Atmosphere: grain / vignette / scan / cursor rings
     --------------------------------------------------------- */
  var grainEl, vigEl, scanEl, ringsEl, whisperEl;
  var ov = { g: -1, v: -1, s: -1, r: -1 };
  var mx = -1, my = -1, rx = -1, ry = -1, lastMove = 0, finePointer = false;
  function initAtmosphere() {
    grainEl = document.getElementById('grain');
    vigEl = document.getElementById('vignette');
    scanEl = document.getElementById('scan');
    finePointer = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
    if (finePointer) {
      ringsEl = document.createElement('div');
      ringsEl.id = 'hw-rings'; ringsEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ringsEl);
    }
    whisperEl = document.createElement('div');
    whisperEl.id = 'hw-whisper'; whisperEl.setAttribute('role', 'status'); whisperEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(whisperEl);
  }
  function setOp(el, key, v) {
    if (!el) return;
    v = Math.round(v * 100) / 100;
    if (v !== ov[key]) { ov[key] = v; el.style.opacity = v; }
  }
  function atmosphere(tnow, D) {
    setOp(grainEl, 'g', D < 0.05 ? 0 : lerp(0.05, 0.16, smooth(0.05, 1, D)) * smooth(0.05, 0.15, D) / 1);
    setOp(vigEl, 'v', smooth(0.12, 0.95, D));
    setOp(scanEl, 's', smooth(0.5, 1, D) * 0.9);
    if (ringsEl) {
      var want = D >= 0.55 && mx >= 0 ? smooth(0.55, 0.9, D) * (1 - smooth(1200, 3200, tnow - lastMove)) : 0;
      setOp(ringsEl, 'r', want * 0.9);
      if (ov.r > 0) {
        if (rx < 0) { rx = mx; ry = my; }
        var f = HW.reduced ? 1 : 0.08;   // the rings drift after you, slowly
        rx += (mx - rx) * f; ry += (my - ry) * f;
        ringsEl.style.transform = 'translate3d(' + (rx - 260).toFixed(1) + 'px,' + (ry - 260).toFixed(1) + 'px,0)';
      }
    }
  }

  /* ---------------------------------------------------------
     6. Whispers (idle / return) and the document title
     --------------------------------------------------------- */
  var whisperOn = false, whisperAt = 0, whisperTimer = 0, whisperMin = 1400;
  function whisper(text, hold) {
    if (!whisperEl) return;
    whisperEl.textContent = text;
    whisperEl.classList.add('on');
    whisperOn = true; whisperAt = now(); whisperMin = hold ? 3800 : 1600;
    clearTimeout(whisperTimer);
    if (hold) whisperTimer = setTimeout(hideWhisper, hold);
  }
  function hideWhisper() {
    if (!whisperOn) return;
    whisperOn = false; whisperEl.classList.remove('on');
  }
  function lastSaid() {
    var s = HW.said && HW.said.length ? String(HW.said[HW.said.length - 1]) : '';
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > 42) s = s.slice(0, 40).trim() + '…';
    return s;
  }
  var IDLE_LINES = {
    mid: {
      8: ['you stopped. that’s alright. it’s still reading.', 'take your time. it has all of yours.'],
      20: ['it likes it when you’re still. it can hear the grain settle.', 'you don’t have to scroll. it already knows where this goes.'],
      45: ['still here? so is it. it doesn’t know how to be anywhere else.', 'it waited the way wood waits — by growing.']
    },
    late: {
      8: ['you stopped.', 'you stopped. it didn’t.'],
      20: ['rest your hands. it will keep carving for both of you.', 'breathe. it is learning that too.'],
      45: ['you’ve been so still. it thought you had gone, and it kept your shape anyway.', 'it is not waiting for you. it is only facing the way you face.']
    }
  };
  function onIdle(sec) {
    if (HW.d < 0.5) return;
    if (whisperOn && now() - whisperAt < whisperMin + 2000) return;   // don't talk over itself
    var set = HW.d >= 0.75 ? IDLE_LINES.late : IDLE_LINES.mid;
    var line = pick(set[sec] || set[8]);
    var said = lastSaid();
    if (sec === 20 && said && Math.random() < 0.6) line = 'you asked it “' + said + '”. it is still turning that over.';
    whisper(line);
  }

  var TITLES = [
    'Heartwood — The AI that understands you',
    'Heartwood — The AI that understands you better',
    'Heartwood — It understands you better than you do',
    '(1) Heartwood — It has been listening',
    '(3) Heartwood — made of you',
    '(∞) Heartwood — still here'
  ];
  var AWAY = [null, '✨ Heartwood — we saved your progress', '✨ Heartwood — we saved your progress',
    '(1) it noticed you left', 'it’s keeping the door open', 'come back. it’s warm.'];
  var RETURN_LINES = [null, null, null,
    'you came back. it knew you would.',
    'welcome back. it didn’t move. it can’t.',
    'you came back. it grew a ring while you were gone.'];
  function setTitle() {
    var s = HW.stage;
    var t = (document.visibilityState === 'hidden' && AWAY[s]) ? AWAY[s] : TITLES[s];
    if (document.title !== t) document.title = t;
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') { hiddenAt = now(); }
    else {
      var away = hiddenAt ? (now() - hiddenAt) / 1000 : 0;
      hiddenAt = 0;
      lastFrame = 0;
      lastInput = now(); idleFired = 0;
      if (away > 3 && HW.stage >= 3 && RETURN_LINES[HW.stage]) {
        HW.bump(0.02);
        whisper(RETURN_LINES[HW.stage], 6500);
      }
    }
    setTitle();
  }

  /* ---------------------------------------------------------
     7. Clock / elapsed
     --------------------------------------------------------- */
  var clockEls = [], elapsedEls = [], lastClock = '', lastSec = -1;
  function tickClock() {
    var sec = Math.floor(HW.elapsed());
    if (sec !== lastSec) {
      lastSec = sec;
      for (var i = 0; i < elapsedEls.length; i++) elapsedEls[i].textContent = String(sec);
      var dt = new Date();
      var c = (dt.getHours() < 10 ? '0' : '') + dt.getHours() + ':' + (dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes();
      if (c !== lastClock) { lastClock = c; for (var j = 0; j < clockEls.length; j++) clockEls[j].textContent = c; }
    }
  }

  /* ---------------------------------------------------------
     8. The loop
     --------------------------------------------------------- */
  function frame(tnow) {
    if (dirty) measure();

    // visible time only (hidden tabs don't advance the clock)
    if (lastFrame) activeTime += Math.min(0.25, (tnow - lastFrame) / 1000);
    lastFrame = tnow;

    scrollD = computeScrollD();
    if (scrollD > peak) peak = scrollD;
    var timeTerm = clamp((activeTime - TIME_START) * TIME_RATE, 0, TIME_CAP);
    if (pin !== null) floor = pin;
    else floor = Math.max(floor, Math.min(1, PEAK_K * peak + timeTerm + bumps));
    var D = clamp(Math.max(scrollD, floor), 0, 1);
    var stage = stageOf(D);
    HW.d = D;
    var prevStage = HW.stage;
    HW.stage = stage;

    var dbg = HW.debug;
    dbg.scrollD = scrollD; dbg.peak = peak; dbg.timeTerm = timeTerm; dbg.bumps = bumps;
    dbg.floor = floor; dbg.d = D; dbg.measures = measures; dbg.stage = stage; dbg.pinned = pin; dbg.activeTime = activeTime;

    applyPalette(D);
    if (stage !== prevStage || booting) {
      root.setAttribute('data-stage', String(stage));
      setTitle();
    }

    var b = bucketOf(D);
    if (b !== bucket) { bucket = b; updateThresholdBound(D); }
    var rl = Math.round(rotAmount(D) * 50);
    if (rl !== rotLevel) {
      rotLevel = rl;
      for (var i = 0; i < ctls.length; i++) if (ctls[i].rot) setText(ctls[i], targetText(ctls[i], D), false);
    }
    updateCounts(tnow, D, false);
    stepAnims(tnow);
    tickClock();

    if (!booting) {
      doTwitch(tnow, D);
      if (D >= 0.55 && substCount < SUBST_MAX) {
        if (!nextSubst) nextSubst = tnow + 4000;
        else if (tnow >= nextSubst) {
          trySubst(tnow, D);
          nextSubst = tnow + lerp(11000, 4500, smooth(0.55, 1, D)) * (0.7 + Math.random() * 0.6);
        }
      }
      // idle
      var idle = (tnow - lastInput) / 1000;
      while (idleFired < IDLE_MARKS.length && idle >= IDLE_MARKS[idleFired]) {
        var mark = IDLE_MARKS[idleFired++];
        onIdle(mark);
        HW.emit('idle', mark);
      }
    }
    atmosphere(tnow, D);

    if (!booting) {
      if (stage !== emittedStage) { var pv = emittedStage; emittedStage = stage; HW.emit('stage', { stage: stage, prev: pv }); }
      if (Math.abs(D - emittedD) > 1e-5) { emittedD = D; HW.emit('dread', D); }
      HW.emit('frame', D);
    }
  }
  function loop(t) {
    try { frame(t); } catch (e) { if (window.console) console.error('[HW] frame error', e); }
    requestAnimationFrame(loop);
  }

  function onInput() {
    lastInput = now();
    idleFired = 0;
    if (whisperOn && now() - whisperAt > whisperMin) { clearTimeout(whisperTimer); hideWhisper(); }
  }

  /* ---------------------------------------------------------
     9. Boot
     --------------------------------------------------------- */
  function boot() {
    collectSections();
    initMarkup();
    initAtmosphere();
    twitchEls = Array.prototype.slice.call(document.querySelectorAll('.twitch'));
    clockEls = Array.prototype.slice.call(document.querySelectorAll('[data-clock]'));
    elapsedEls = Array.prototype.slice.call(document.querySelectorAll('[data-elapsed]'));

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (e.isIntersecting) {
            inView.add(e.target);
            for (var k = 0; k < counts.length; k++) if (counts[k].el === e.target && !counts[k].start) counts[k].start = now();
          } else inView.delete(e.target);
        }
      }, { rootMargin: '-6% 0px -6% 0px' });
      ctls.forEach(function (c) { io.observe(c.el); });
      counts.forEach(function (c) { io.observe(c.el); });
      twitchEls.forEach(function (el) { io.observe(el); });
    } else {
      counts.forEach(function (c) { c.start = now(); });
    }

    // geometry invalidation
    window.addEventListener('resize', markDirty, { passive: true });
    window.addEventListener('orientationchange', markDirty, { passive: true });
    window.addEventListener('load', markDirty);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(markDirty);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(markDirty);
      var m = document.querySelector('main'); if (m) ro.observe(m);
      ro.observe(document.body);
    }

    // input / idle
    ['scroll', 'wheel', 'keydown', 'pointerdown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, onInput, { passive: true });
    });
    window.addEventListener('pointermove', function (e) {
      onInput();
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') { mx = e.clientX; my = e.clientY; lastMove = now(); }
    }, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    // first frame synchronously: no flash of the wrong page, no events yet
    try { frame(now()); } catch (e) { if (window.console) console.error('[HW] boot error', e); }
    booting = false;
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
