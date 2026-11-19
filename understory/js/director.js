/* UNDERSTORY v2 — director.js (Builder B)
   Creates window.US synchronously: story clock, holds, the single scheduler,
   state machine, mask dial + HUD, memory + persistence, visibility, idle,
   mashers, toasts, titles, tabs, data-l swaps, formatting, Disconnect, Forget.
   Never throws on a missing element, content key or sibling module. */
(function () {
  'use strict';

  var W = window, D = document;
  var prior = W.US || {};
  var US = W.US = prior;

  /* ------------------------------------------------------------------ params */
  var Q;
  try { Q = new URLSearchParams(W.location.search); } catch (e) { Q = { get: function () { return null; }, has: function () { return false; } }; }
  function qnum(k, d) { var n = parseFloat(Q.get(k)); return isFinite(n) ? n : d; }
  var DEBUG = Q.get('debug') === '1';
  var SPEED = Math.max(0.1, Math.min(64, qnum('speed', 1)));
  var JUMP_T = null;
  (function () {
    var t = Q.get('t'), b = Q.get('beat');
    if (t != null && isFinite(parseFloat(t))) JUMP_T = Math.max(30, parseFloat(t));
    else if (b) JUMP_T = 'beat:' + String(b).toLowerCase();
  })();
  var TESTING = JUMP_T != null;

  var warned = {};
  function warn(key, msg) {
    if (!DEBUG || warned[key]) return;
    warned[key] = 1;
    try { console.warn('[understory] ' + (msg || key)); } catch (e) { /* */ }
  }
  function $(id) { return D.getElementById(id); }
  function nowMs() { return (W.performance && performance.now) ? performance.now() : Date.now(); }

  /* -------------------------------------------------------------- constants */
  var BEATS = [
    { id: 'b01', state: 'portal', T: 0 },
    { id: 'b02', state: 'handshake', T: 30 },
    { id: 'b03', state: 'panel', T: 34, tab: 'status' },
    { id: 'b04', state: 'panel', T: 70, tab: 'devices' },
    { id: 'b05', state: 'panel', T: 105, tab: 'lookup' },
    { id: 'b06', state: 'panel', T: 150, tab: 'log' },
    { id: 'b07', state: 'panel', T: 185, tab: 'diag' },
    { id: 'b08', state: 'panel', T: 220, tab: 'routing' },
    { id: 'b09', state: 'face', T: 245, hold: 'face', holdMax: 45, next: 'b10' },
    { id: 'b10', state: 'done', T: 285 },
    { id: 'b11', state: 'term', T: 305 },
    { id: 'b12', state: 'term', T: 345 },
    { id: 'b13', state: 'last', T: 375, hold: 'last', holdMax: 60, next: 'b14' },
    { id: 'b14', state: 'coda', T: 400 },
    { id: 'b15', state: 'manifest', T: 420 }
  ];
  var MASKS = [[0, 0], [80, 8], [150, 16], [220, 24], [305, 30], [368, 32]];
  var TABS_AT = [[34, 'status'], [70, 'devices'], [105, 'lookup'], [150, 'log'], [185, 'diag'], [220, 'routing'], [230, 'dhcp']];
  var TAB_SLUGS = ['status', 'devices', 'dhcp', 'lookup', 'diag', 'log', 'routing'];
  var SCREENS = {
    portal: ['portal'], handshake: ['handshake'], panel: ['panel'], face: ['panel', 'face'],
    done: ['done'], term: ['term'], last: ['last'], coda: ['portal'], manifest: ['portal', 'manifest'],
    disconnected: ['disconnected']
  };
  var HUD_STATES = { panel: 1, face: 1, term: 1, last: 1 };
  var TOAST_STATES = { panel: 1, face: 1 };
  var IDLE_STATES = { panel: 1, term: 1 };
  var STORE_KEY = 'understory:v2';

  /* -------------------------------------------------------------- event bus */
  var handlers = {};
  US.on = function (evt, fn) { if (typeof fn !== 'function') return fn; (handlers[evt] = handlers[evt] || []).push(fn); return fn; };
  US.off = function (evt, fn) { var a = handlers[evt]; if (!a) return; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  US.emit = function (evt, data) {
    var a = handlers[evt]; data = data || {};
    if (!a || !a.length) return;
    a.slice().forEach(function (fn) {
      try { fn(data, evt); } catch (err) { warn('h:' + evt + ':' + (err && err.message), 'handler for "' + evt + '" threw: ' + (err && err.stack || err)); }
    });
  };

  /* ------------------------------------------------------------------ clocks */
  var clock = { T: 0, P: 0, last: nowMs(), running: false, stopped: false, hidden: false };
  var loadMs = nowMs();
  var connectP = null, connected = false;
  US.version = '2.0';
  US.speed = SPEED;
  US.debug = DEBUG;
  US.state = 'portal';
  US.beat = 'b01';
  US.mask = 0;
  US.device = US.device || 'desktop';
  US.ip = null; US.mac = null;
  US.live = US.live || {};
  US.tools = US.tools || {};
  US.sense = US.sense || {};
  US.audio = US.audio || {};
  US.scenes = US.scenes || {};
  US.currentTab = 'status';
  US.T = function () { return clock.T; };
  US.now = function () { return clock.P; };                     // play-clock seconds (scaled, paused while hidden)
  US.elapsed = function () { return (nowMs() - loadMs) / 1000; };
  US.sinceConnect = function () { return connectP == null ? 0 : Math.max(0, clock.P - connectP); };
  US.connected = function () { return connected; };

  /* ----------------------------------------------------- single scheduler */
  var timers = [], scheds = [], seq = 0;
  US.after = function (ms, fn) {
    var id = ++seq;
    timers.push({ id: id, at: clock.P + Math.max(0, +ms || 0) / 1000, fn: fn, every: 0 });
    return id;
  };
  US.every = function (ms, fn) {
    var id = ++seq, s = Math.max(16, +ms || 16) / 1000;
    timers.push({ id: id, at: clock.P + s, fn: fn, every: s });
    return id;
  };
  US.cancel = function (id) {
    var i;
    for (i = timers.length - 1; i >= 0; i--) if (timers[i].id === id) timers.splice(i, 1);
    for (i = scheds.length - 1; i >= 0; i--) if (scheds[i].id === id) scheds.splice(i, 1);
  };
  US.schedule = function (T, fn) {
    var id = ++seq;
    var s = { id: id, T: +T || 0, fn: fn, late: clock.running && (+T || 0) < clock.T - 0.001 };
    var i = scheds.length;
    while (i > 0 && scheds[i - 1].T > s.T) i--;
    scheds.splice(i, 0, s);
    return id;
  };
  function call(fn, arg, tag) {
    try { fn(arg); } catch (err) { warn('cb:' + tag + ':' + (err && err.message), tag + ' callback threw: ' + (err && err.stack || err)); }
  }
  function runTimers() {
    var guard = 0;
    while (guard++ < 500) {
      var best = -1, i;
      for (i = 0; i < timers.length; i++) if (timers[i].at <= clock.P && (best < 0 || timers[i].at < timers[best].at)) best = i;
      if (best < 0) return;
      var t = timers[best];
      if (t.every) { t.at += t.every; if (t.at <= clock.P) t.at = clock.P + t.every; }
      else timers.splice(best, 1);
      call(t.fn, undefined, 'timer');
    }
  }
  function runScheds() {
    var guard = 0;
    while (clock.running && !clock.stopped && scheds.length && scheds[0].T <= clock.T && guard++ < 500) {
      var s = scheds.shift();
      call(s.fn, { T: s.T, late: !!s.late }, 'schedule@' + s.T);
    }
  }
  function fireLate(target) {
    var guard = 0;
    while (scheds.length && scheds[0].T < target && guard++ < 2000) {
      var s = scheds.shift();
      call(s.fn, { T: s.T, late: true }, 'late@' + s.T);
    }
  }

  /* ------------------------------------------------------------------- holds */
  var holds = {};
  US.hold = function (reason, maxSec) {
    reason = String(reason || 'hold');
    var until = (maxSec == null || !isFinite(maxSec)) ? Infinity : clock.P + Math.max(0, maxSec);
    holds[reason] = { until: until, onExpire: holds[reason] && holds[reason].onExpire };
  };
  US.release = function (reason) { delete holds[reason]; };
  US.holds = function () { return Object.keys(holds); };
  function isHeld() {
    var any = false;
    Object.keys(holds).forEach(function (k) {
      var h = holds[k];
      if (h.until <= clock.P) {
        delete holds[k];
        if (h.onExpire) call(h.onExpire, k, 'holdExpire');
      } else any = true;
    });
    return any;
  }

  // typing soft-hold: any [data-sense] input in the last 3 s; ≤ 12 s per beat
  var lastSenseP = -99, typingUsed = {};
  function typingNow() { return clock.P - lastSenseP < 3; }

  /* ------------------------------------------------------------------ memory */
  var mem;
  function freshMemory() {
    return {
      deletedAll: [], hesByField: {}, devicesTapped: [], lookups: [], traces: [], said: [], tabsVisited: [],
      awayCount: 0, awayTotal: 0, awayLongest: 0, idleTotal: 0, idleLongest: 0, mashMax: 0, mashCount: 0,
      lookupCount: 0, renewals: 0, visits: 1, sound: false
    };
  }
  mem = freshMemory();
  var prevInfo = {};            // previous visit's persisted record (lastVisit, lastEnd, deviceTapped)
  var forgotten = false, storageOk = true;

  US.remember = function (key, val) {
    mem[key] = val;
    if (key === 'name' && val) identity(val);
    US.emit('remember', { key: key, val: val });
    return val;
  };
  US.recall = function (key, fallback) { var v = mem[key]; return v === undefined ? fallback : v; };
  US.push = function (key, val) {
    if (!Array.isArray(mem[key])) mem[key] = [];
    mem[key].push(val);
    US.emit('remember', { key: key, val: mem[key] });
    return mem[key];
  };
  US.memory = function () { return mem; };

  function lsGet(k) { try { return W.localStorage.getItem(k); } catch (e) { storageOk = false; return null; } }
  function lsSet(k, v) { try { W.localStorage.setItem(k, v); return true; } catch (e) { storageOk = false; return false; } }
  function lsClearAll() {
    try {
      var ks = [], i;
      for (i = 0; i < W.localStorage.length; i++) { var k = W.localStorage.key(i); if (k && k.indexOf('understory:') === 0) ks.push(k); }
      ks.forEach(function (k) { W.localStorage.removeItem(k); });
      W.localStorage.removeItem(STORE_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  US.persist = function () {
    if (forgotten || !connected) return false;
    var data = {
      name: mem.name, nameAuto: !!mem.nameAuto,
      day: mem.day || prevInfo.day || undefined,
      visits: mem.visits, firstVisit: mem.firstVisit || Date.now(), lastVisit: Date.now(),
      lastEnd: mem.lastEnd || undefined, renewals: mem.renewals || 0,
      prevLookup: mem.lastQuery || mem.prevLookup || undefined,
      deviceTapped: mem.deviceTapped || prevInfo.deviceTapped || undefined
    };
    var s; try { s = JSON.stringify(data); } catch (e) { return false; }
    return lsSet(STORE_KEY, s);
  };

  US.forget = function () {
    lsClearAll();
    forgotten = true;
    var keep = { visits: 1 };
    mem = freshMemory();
    mem.visits = keep.visits;
    prevInfo = {};
    US.emit('forget', {});
  };

  function loadStorage() {
    if (Q.get('reset') === '1') lsClearAll();
    var v = parseInt(Q.get('visit'), 10);
    if (v >= 2) {
      var seed = {
        name: Q.get('name') || 'Ada', nameAuto: false, day: Q.get('day') || 'tired',
        visits: v - 1, firstVisit: Date.now() - 86400000 * 3, lastVisit: Date.now() - 86400000,
        lastEnd: Q.get('lastEnd') || 'complete', renewals: 37, prevLookup: 'weather tomorrow', deviceTapped: 'kitchen-speaker'
      };
      lsSet(STORE_KEY, JSON.stringify(seed));
    }
    var raw = lsGet(STORE_KEY), st = null;
    if (raw) { try { st = JSON.parse(raw); } catch (e) { st = null; } }
    if (st && typeof st === 'object' && (st.visits | 0) >= 1) {
      prevInfo = st;
      mem.visits = (st.visits | 0) + 1;
      mem.firstVisit = st.firstVisit || Date.now();
      mem.lastVisit = st.lastVisit;
      mem.lastEnd = st.lastEnd;
      mem.renewals = +st.renewals || 0;
      if (st.day) mem.prevDay = st.day;
      if (st.prevLookup) mem.prevLookup = st.prevLookup;
      if (st.name) { mem.name = st.name; mem.nameAuto = !!st.nameAuto; }
    } else {
      mem.visits = 1;
      mem.firstVisit = Date.now();
    }
  }
  US.isReturn = function () { return (mem.visits | 0) >= 2; };
  US.prev = function (k) { return prevInfo[k]; };

  /* ---------------------------------------------------------------- identity */
  var ids = { a: 1, b: 1, c: 5, h: 0 };
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function hex2(n) { return ('0' + (n & 255).toString(16)).slice(-2); }
  function identity(name) {
    var h = fnv(String(name || 'guest').toLowerCase());
    ids.h = h;
    ids.a = 1 + ((h >>> 16) & 0xff) % 253;
    ids.b = 1 + ((h >>> 8) & 0xff) % 253;
    ids.c = 4 * (1 + (h & 0x3f) % 62) + 1;
    var h2 = Math.imul(h, 31) >>> 0;
    US.ip = '10.' + ids.a + '.' + ids.b + '.' + ids.c;
    US.mac = '02:' + [h >>> 24, h >>> 16, h >>> 8, h, h2 >>> 8].map(hex2).join(':');
  }
  identity('guest'); US.ip = null; US.mac = null;
  US.ids = function () { return { a: ids.a, b: ids.b, c: ids.c, a2: ids.a % 253 + 1, b2: ids.b % 253 + 1 }; };
  US.hosts = function (m) {
    m = (m == null) ? US.mask : m;
    if (m >= 32) return 1;
    return Math.pow(2, 32 - m) - 2;
  };
  US.netmask = function (m) {
    m = (m == null) ? US.mask : m;
    var out = [];
    for (var i = 0; i < 4; i++) { var bits = Math.max(0, Math.min(8, m - i * 8)); out.push(bits ? (256 - Math.pow(2, 8 - bits)) : 0); }
    return out.join('.');
  };
  US.cidr = function (m) { return '/' + ((m == null) ? US.mask : m); };
  US.network = function (m) {
    m = (m == null) ? US.mask : m;
    if (m >= 32) return '10.' + ids.a + '.' + ids.b + '.' + ids.c;
    if (m >= 30) return '10.' + ids.a + '.' + ids.b + '.' + (ids.c - 1);
    if (m >= 24) return '10.' + ids.a + '.' + ids.b + '.0';
    if (m >= 16) return '10.' + ids.a + '.0.0';
    if (m >= 8) return '10.0.0.0';
    return '0.0.0.0';
  };
  US.gw = function (m) {
    m = (m == null) ? US.mask : m;
    if (m >= 32) return '—';
    if (m >= 30) return '10.' + ids.a + '.' + ids.b + '.' + (ids.c + 1);
    return '10.' + ids.a + '.' + ids.b + '.1';
  };

  /* ------------------------------------------------------- name cleaning */
  US.cleanName = function (raw) {
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    s = s.split(' ')[0];
    s = s.replace(/[^\p{L}\p{M}'’\-]/gu, '');
    if (!s) return '';
    s = s.slice(0, 24);
    s = s.charAt(0).toLocaleUpperCase() + s.slice(1);
    var blocked = false;
    try {
      var f = (US.sense && (US.sense.cleanName || US.sense.isBlocked || US.sense.blocked)) || (US.tools && US.tools.cleanName);
      if (US.sense && typeof US.sense.cleanName === 'function') { var r = US.sense.cleanName(s); if (typeof r === 'string') return r || 'Guest'; }
      else if (US.sense && typeof US.sense.isBlocked === 'function') blocked = !!US.sense.isBlocked(s);
      else if (US.sense && typeof US.sense.blockedName === 'function') blocked = !!US.sense.blockedName(s);
      else if (typeof f === 'function') { var r2 = f(s); if (typeof r2 === 'string') return r2 || 'Guest'; blocked = !!r2; }
      else blocked = localBlocked(s);
    } catch (e) { blocked = localBlocked(s); }
    return blocked ? 'Guest' : s;
  };
  function localBlocked(s) {
    var nb = (US.content && US.content.nameBlock) || {};
    var n = String(s).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a')
      .replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's').replace(/[^a-z]/g, '');
    if (!n) return false;
    var c = nb.contains || [], x = nb.exact || [];
    for (var i = 0; i < c.length; i++) if (n.indexOf(c[i]) >= 0) return true;
    return x.indexOf(n) >= 0;
  }

  /* ---------------------------------------------------------- content access */
  US.content = W.US_CONTENT || {};
  function isStaged(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    for (var k in v) if (/^s\d+$/.test(k)) return true;
    return false;
  }
  function pickStage(v, m) {
    m = (m == null) ? US.mask : m;
    var best = -1;
    for (var k in v) {
      var mm = /^s(\d+)$/.exec(k);
      if (mm) { var n = +mm[1]; if (n <= m && n > best) best = n; }
    }
    return best < 0 ? undefined : v['s' + best];
  }
  US.get = function (path) {
    if (!path) return undefined;
    var parts = String(path).split('.'), v = US.content;
    for (var i = 0; i < parts.length; i++) {
      if (v == null || typeof v !== 'object') return undefined;
      v = v[parts[i]];
    }
    return v;
  };
  US.staged = function (path, m) {
    var v = US.get(path);
    if (v === undefined) { warn('miss:' + path, 'missing content key ' + path); return undefined; }
    return isStaged(v) ? pickStage(v, m) : v;
  };
  US.stage = function () { return 's' + US.mask; };
  function resolveVal(v, extra) {
    if (v == null) return null;
    if (typeof v === 'string') return US.fmt(v, extra);
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return null;
    if (typeof v === 'object') {
      if (isStaged(v)) return resolveVal(pickStage(v), extra);
      if ('t' in v) {
        var r = US.fmt(v.t, extra);
        if (r == null && v.alt != null) r = US.fmt(v.alt, extra);
        return r;
      }
    }
    return null;
  }
  US.line = function (path, extra) {
    var v = US.get(path);
    if (v === undefined) { warn('miss:' + path, 'missing content key ' + path); return null; }
    return resolveVal(v, extra);
  };
  US.resolve = resolveVal;       // resolve an already-fetched value ({t,alt}, staged, string)
  var poolUsed = {};
  US.pick = function (path, extra) {
    var v = US.get(path);
    if (v === undefined) { warn('miss:' + path, 'missing content key ' + path); return null; }
    if (isStaged(v)) v = pickStage(v);
    if (!Array.isArray(v)) return resolveVal(v, extra);
    if (!v.length) return null;
    var key = path + '|' + US.mask;
    var used = poolUsed[key] = poolUsed[key] || [];
    if (used.length >= v.length) used.length = 0;
    var tries = v.length * 2;
    while (tries-- > 0) {
      var avail = [];
      for (var i = 0; i < v.length; i++) if (used.indexOf(i) < 0) avail.push(i);
      if (!avail.length) { used.length = 0; continue; }
      var idx = avail[Math.floor(Math.random() * avail.length)];
      used.push(idx);
      var r = resolveVal(v[idx], extra);
      if (r != null) return r;
    }
    return null;
  };

  /* -------------------------------------------------------------- formatting */
  var SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function words(n) { return n <= 20 ? SMALL[n] : String(n); }
  function grp(n) { try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); } }
  US.group = grp;
  US.hes = function (s) { s = +s; if (!isFinite(s)) return null; return s < 10 ? (Math.round(s * 10) / 10).toFixed(1) : String(Math.round(s)); };
  US.slug = function (x) {
    if (x == null) return null;
    var s = String(x).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24);
    return s || null;
  };
  US.listify = function (arr) {
    if (!arr || !arr.length) return null;
    var a = arr.slice(0, 8).map(function (x) { return '“' + String(x) + '”'; });
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  };
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function pad2(n) { return ('0' + n).slice(-2); }
  function hhmm(d) { d = d || new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  US.clock = hhmm;
  function elapsedWords(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return 'under a minute';
    var m = Math.floor(sec / 60), r = sec - m * 60;
    if (m >= 60) { var h = Math.round(m / 60); return h <= 1 ? 'about an hour' : 'about ' + words(h) + ' hours'; }
    if (r < 20) return m === 1 ? 'one minute' : words(m) + ' minutes';
    if (r >= 40) return 'about ' + words(m + 1) + ' minutes';
    return m === 1 ? 'over a minute' : 'over ' + words(m) + ' minutes';
  }
  US.elapsedWords = function () { return elapsedWords(US.sinceConnect()); };
  function elapsedShort(sec) { var m = Math.floor(sec / 60); return m < 1 ? 'under 1 min' : m + ' min'; }
  function uptimeStr() {
    if (US.mask >= 24) return US.line('st.uptimeS24') || '41,206 days';
    var s = 3 * 86400 + 4 * 3600 + 11 * 60 + 52 + Math.floor(US.sinceConnect());
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    return d + ' days, ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  }
  function leaseLeftStr() {
    var s = Math.max(0, 86399 - Math.floor(US.sinceConnect()));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s % 60);
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dateStr(ts) { var d = new Date(ts); if (isNaN(d)) return null; return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function displayName() {
    if (mem.nameAuto && !mem.name) return 'Guest';
    return mem.name || (mem.nameAuto ? 'Guest' : null);
  }
  function sanitizeFrom(s) {
    if (!s) return null;
    s = String(s).replace(/[^\p{L}\s\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return s || null;
  }
  function editLastQuery() {
    var q = mem.lastQuery; if (!q) return null;
    var map = US.get('lk.edit') || {};
    var b = mem.lastBucket;
    var tpl = (b && map[b] != null) ? map[b] : (map.other || '{lastQuery} please');
    return US.fmt(tpl);
  }

  function val(key, extra) {
    if (extra && Object.prototype.hasOwnProperty.call(extra, key)) {
      var e = extra[key];
      if (key === 'q' && e != null) return trunc(e, 48);
      if (key === 't' && e != null) return trunc(e, 32);
      if (/^hes/.test(key) && typeof e === 'number') return US.hes(e);
      return e;
    }
    if (key.indexOf('slug:') === 0) return US.slug(val(key.slice(5), extra));
    if (key === 'edit:lastQuery') return editLastQuery();
    var n;
    switch (key) {
      case 'name': return displayName();
      case 'NAME': n = displayName(); return n ? n.toLocaleUpperCase() : null;
      case 'ip': return US.ip;
      case 'mac': return US.mac;
      case 'gw': return US.gw();
      case 'a': return ids.a; case 'b': return ids.b;
      case 'a2': return ids.a % 253 + 1; case 'b2': return ids.b % 253 + 1;
      case 'mask': return US.netmask();
      case 'cidr': return US.cidr();
      case 'network': return US.network();
      case 'hosts': return grp(US.hosts());
      case 'hesTerms': case 'hesMax': case 'hesNow': return mem[key] == null ? null : US.hes(mem[key]);
      case 'device': return US.device === 'desktop' ? 'computer' : (US.device || 'computer');
      case 'q': case 't': return null;
      case 'lookupList': return US.listify(mem.lookups);
      case 'traceList': return US.listify(mem.traces);
      case 'saidList': return US.listify(mem.said);
      case 'lookupCount': return (mem.lookups || []).length;
      case 'away': return mem.lastAway == null ? null : Math.round(mem.lastAway);
      case 'awayTotal': return Math.round(mem.awayTotal || 0);
      case 'times': return (mem.awayCount | 0) === 1 ? 'time' : 'times';
      case 'idle': return Math.round(currentIdle());
      case 'idleTotal': return Math.round((mem.idleTotal || 0) + (currentIdle() >= 12 ? currentIdle() : 0));
      case 'idleLongest': return Math.round(Math.max(mem.idleLongest || 0, currentIdle() >= 12 ? currentIdle() : 0)) || null;
      case 'mash': return mem.lastMash == null ? null : mem.lastMash;
      case 'clock': return hhmm();
      case 'lastVisitDate': return prevInfo.lastVisit ? dateStr(prevInfo.lastVisit) : null;
      case 'elapsedWords': return elapsedWords(US.sinceConnect());
      case 'elapsedShort': return elapsedShort(US.sinceConnect());
      case 'uptime': return US.live.uptime || uptimeStr();
      case 'leaseLeft': return US.live.leaseLeft || leaseLeftStr();
      case 'from': return sanitizeFrom(mem.from);
      case 'tabSlug': return US.currentTab;
      case 'tabLabel': return US.line('nav.' + US.currentTab);
      case 'tz': try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
      case 'w': return W.screen ? W.screen.width : W.innerWidth;
      case 'h': return W.screen ? W.screen.height : W.innerHeight;
      case 'sinceSelf': return US.sinceConnect() < 60 ? (US.line('dev.sinceSelfStart') || 'just now') : elapsedShort(US.sinceConnect());
      case 'on|off': case 'soundState': return mem.sound ? 'on' : 'off';
      case 'renewals': return mem.renewals == null ? 0 : mem.renewals;
    }
    if (US.live[key] != null) return US.live[key];
    var m = mem[key];
    if (Array.isArray(m)) return m.length ? m.join(', ') : null;
    if (m != null && typeof m === 'object') return null;
    return m;
  }
  US.fmt = function (str, extra) {
    if (str == null) return null;
    if (typeof str !== 'string') str = String(str);
    var bad = false;
    var out = str.replace(/\{([^{}\s][^{}]*)\}/g, function (all, key) {
      var v;
      try { v = val(key, extra); } catch (e) { v = null; }
      if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) { bad = true; return ''; }
      return String(v);
    });
    return bad ? null : out;
  };

  /* -------------------------------------------------------------- predicates */
  US.when = function (pred) {
    pred = String(pred || '');
    if (pred.indexOf('face:') === 0) return mem.faceOutcome === pred.slice(5);
    switch (pred) {
      case 'deleted': return !!mem.deleted;
      case '!deleted': return !mem.deleted;
      case 'day': return !!mem.day;
      case 'daySkipped': return !mem.day && !!mem.daySkipped;
      case 'hesLong': return typeof mem.hesTerms === 'number' && mem.hesTerms >= 8 && !termsAuto();
      case 'hesShort': return typeof mem.hesTerms === 'number' && mem.hesTerms < 8 && !mem.termsOpened && !termsAuto();
      case 'termsOpened': return !!mem.termsOpened;
      case 'deviceTapped': return !!mem.deviceTapped;
      case '!deviceTapped': return !mem.deviceTapped;
      case 'away': return (mem.awayCount | 0) >= 1;
      case 'mash': return (mem.mashMax | 0) >= 10;
      case 'sound': return !!mem.sound;
      case 'nameAuto': return !!mem.nameAuto;
      case 'lookups2': return (mem.lookups || []).length >= 2;
      case 'passive': return !(mem.lookups || []).length && !(mem.traces || []).length && !(mem.devicesTapped || []).length && !mem.deviceTapped;
      case 'via': return !!mem.via;
    }
    return false;
  };

  function termsAuto() { return !!(mem.termsAuto || mem.hesTermsAuto); }
  US.termsAuto = termsAuto;

  /* ------------------------------------------------------------- DOM helpers */
  var html = D.documentElement;
  function setText(el, text) { if (el && text != null && el.textContent !== text) el.textContent = text; }
  US.setText = function (id, text) { var el = typeof id === 'string' ? $(id) : id; if (!el) { warn('el:' + id, 'missing element #' + id); return; } setText(el, text); };
  // "pre [link] post" into an element that contains one button/a child
  US.setBracket = function (el, str) {
    if (!el || str == null) return false;
    var m = /^([\s\S]*?)\[([^\]]*)\]([\s\S]*)$/.exec(str);
    var btn = el.querySelector('button, a');
    if (!m || !btn) { if (!btn) setText(el, str.replace(/[\[\]]/g, '')); return false; }
    setText(btn, m[2]);
    var pre = m[1].replace(/\s+$/, ''), post = m[3];
    var nodes = Array.prototype.slice.call(el.childNodes);
    var before = nodes.filter(function (n) { return n !== btn && (n.compareDocumentPosition(btn) & 4); });
    var after = nodes.filter(function (n) { return n !== btn && (n.compareDocumentPosition(btn) & 2); });
    // put "pre" into the first element/text before the button (a <label> in A's markup)
    var lbl = before.filter(function (n) { return n.nodeType === 1; })[0];
    if (lbl) setText(lbl, pre); else if (before[0]) before[0].textContent = pre + ' ';
    if (post && post.trim()) { if (after[0] && after[0].nodeType === 3) after[0].textContent = post; else el.appendChild(D.createTextNode(post)); }
    return true;
  };
  function inCoda(el) { return html.hasAttribute('data-coda') && el.closest && el.closest('#portal'); }
  US.applyL = function (root) {
    var els = (root || D).querySelectorAll('[data-l]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (inCoda(el) || el.hasAttribute('data-l-lock')) continue;
      var key = el.getAttribute('data-l');
      var v = US.line(key);
      if (v == null) continue;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { if (el.placeholder !== v) el.placeholder = v; continue; }
      if (v.indexOf('[') >= 0 && el.querySelector('button, a')) { US.setBracket(el, v); continue; }
      if (!el.children.length) { setText(el, v); continue; }
      // element with children: replace its first non-empty text node only
      var tn = null;
      for (var j = 0; j < el.childNodes.length; j++) { var c = el.childNodes[j]; if (c.nodeType === 3 && c.nodeValue.trim()) { tn = c; break; } }
      if (tn) tn.nodeValue = v;
    }
  };

  /* ------------------------------------------------------------ state machine */
  var manifestBase = null;
  US.setState = function (state, opt) {
    opt = opt || {};
    if (!SCREENS[state]) { warn('state:' + state, 'unknown state ' + state); return; }
    var prev = US.state;
    US.state = state;
    if (state === 'manifest') manifestBase = opt.base || (prev === 'disconnected' ? 'disconnected' : (manifestBase || 'portal'));
    var list = SCREENS[state].slice();
    if (state === 'manifest' && manifestBase === 'disconnected') list = ['disconnected', 'manifest'];
    var screens = D.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      var on = list.indexOf(screens[i].id) >= 0;
      if (screens[i].hidden === on) screens[i].hidden = !on;
    }
    list.forEach(function (id) { if (!$(id)) warn('screen:' + id, 'missing screen #' + id); });
    html.setAttribute('data-state', state);
    if ((state === 'coda' || state === 'manifest') && manifestBase !== 'disconnected') html.setAttribute('data-coda', '');
    else if (state !== 'manifest') html.removeAttribute('data-coda');
    var hud = $('hud'); if (hud) hud.hidden = !HUD_STATES[state];
    if (!TOAST_STATES[state]) { var tb = $('toasts'); if (tb) tb.textContent = ''; }
    // focus the topmost visible screen's [data-focus]
    var top = $(list[list.length - 1]);
    if (top && !opt.noFocus) {
      var f = top.hasAttribute('data-focus') ? top : top.querySelector('[data-focus]');
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) { /* */ } } }
    }
    updateTitle();
    if (prev !== state) US.emit('state', { state: state, prev: prev });
  };

  function beatById(id) { for (var i = 0; i < BEATS.length; i++) if (BEATS[i].id === id) return BEATS[i]; return null; }
  function beatAt(T) { var b = BEATS[0]; for (var i = 0; i < BEATS.length; i++) if (BEATS[i].T <= T) b = BEATS[i]; return b; }
  function maskAt(T) { var m = 0; MASKS.forEach(function (x) { if (x[0] <= T) m = x[1]; }); return m; }
  function tabAt(T) { var t = 'status'; TABS_AT.forEach(function (x) { if (x[0] <= T) t = x[1]; }); return t; }
  US.beats = BEATS;

  function enterBeat(b, opt) {
    opt = opt || {};
    if (!b || (US.beat === b.id && !opt.force)) return;
    var prev = US.beat;
    US.beat = b.id;
    typingUsed[b.id] = 0;
    if (b.hold) {
      US.hold(b.hold, b.holdMax);
      holds[b.hold].onExpire = function () { if (US.beat === b.id && !clock.stopped) US.goto(b.next); };
    }
    if (b.state === 'manifest') US.setState('manifest', { base: 'portal' });
    else US.setState(b.state);
    if (b.tab) US.tab(b.tab, { auto: !opt.jump && b.id !== 'b03', silent: !!opt.jump || b.id === 'b03' });
    US.emit('beat', { id: b.id, prev: prev, jump: !!opt.jump });
  }

  function jumpTo(T) {
    clock.T = T;
    var b = beatAt(T);
    setMask(maskAt(T), { jump: true });
    fireLate(T);
    enterBeat(b, { jump: true, force: US.beat !== b.id });
    if (b.state === 'panel') US.tab(tabAt(T), { auto: false, silent: true, force: true });
  }

  US.goto = function (beatId) {
    var b = beatById(String(beatId || '').toLowerCase());
    if (!b) { warn('goto:' + beatId, 'unknown beat ' + beatId); return; }
    if (clock.stopped) return;
    if (b.id === 'b01') { reloadWith({ beat: null, t: null }); return; }
    if (!connected) autoConnect();
    if (b.T < clock.T - 0.01) { reloadWith({ beat: b.id, t: null }); return; }
    ['face', 'last'].forEach(function (h) { if (h !== b.hold) delete holds[h]; });
    jumpTo(b.T);
  };
  function reloadWith(changes) {
    try {
      var u = new URL(W.location.href);
      Object.keys(changes).forEach(function (k) { if (changes[k] == null) u.searchParams.delete(k); else u.searchParams.set(k, changes[k]); });
      W.location.href = u.toString();
    } catch (e) { W.location.reload(); }
  }
  US.reconnect = function () {
    US.persist();
    try {
      var u = new URL(W.location.href), keep = ['speed', 'debug'];
      var nu = new URL(u.pathname, u.origin);
      keep.forEach(function (k) { if (u.searchParams.get(k) != null) nu.searchParams.set(k, u.searchParams.get(k)); });
      W.location.href = nu.toString();
    } catch (e) { W.location.reload(); }
  };

  /* -------------------------------------------------------------- mask dial */
  var hudAnim = null, maskLineTimer = null;
  function setMask(m, opt) {
    opt = opt || {};
    if (m === US.mask && !opt.force) return;
    var prev = US.mask;
    US.mask = m;
    html.setAttribute('data-mask', String(m));
    [8, 16, 24, 30, 32].forEach(function (n) { html.classList.toggle('ge' + n, m >= n); });
    html.style.setProperty('--mask', String(m));
    html.style.setProperty('--decay', String(Math.round(m / 32 * 1000) / 1000));
    var instant = opt.jump || US.reduced || prev === m;
    hudSet(prev, m, instant);
    if (!opt.jump && m > 0) {
      var ml = US.line('maskLine.s' + m);
      var hl = $('hud-line');
      if (hl && ml) {
        setText(hl, ml); hl.classList.add('show');
        if (maskLineTimer) US.cancel(maskLineTimer);
        maskLineTimer = US.after(6000, function () { hl.classList.remove('show'); hl.textContent = ''; });
      }
      if (m === 16) US.toast(US.line('toast.mask16'));
      if (m === 24) US.toast(US.line('toast.mask24'));
    }
    US.applyL();
    updateTitle();
    US.persist();
    US.emit('mask', { mask: m, prev: prev, hosts: US.hosts(m), jump: !!opt.jump });
  }
  US.setMask = function (m) { setMask(m, {}); };

  function hudSet(prevM, m, instant) {
    var hud = $('hud');
    if (hud) { var t = US.line('hud.title'); if (t) hud.title = t; }
    var cidrEl = $('hud-cidr'), hostsEl = $('hud-hosts');
    var unit = hud && hud.querySelector('.hud-unit');
    var cidrTxt = US.cidr(m), unitTxt = ' hosts';
    var tpl = US.get(m >= 32 ? 'hud.value1' : 'hud.value');
    if (typeof tpl === 'string') {
      var parts = tpl.split(' · ');
      if (m >= 32) { cidrTxt = parts[0]; unitTxt = parts.length > 2 ? ' ' + parts[1].replace(/^\d[\d,]*\s*/, '') + ' · ' + parts.slice(2).join(' · ') : ' host'; }
      else if (parts[1]) unitTxt = ' ' + parts[1].replace('{hosts}', '').trim();
    }
    setText(cidrEl, cidrTxt);
    if (unit) setText(unit, unitTxt);
    var from = US.hosts(prevM), to = US.hosts(m);
    if (instant || !hostsEl) { hudAnim = null; setText(hostsEl, grp(to)); return; }
    hudAnim = { from: from, to: to, start: clock.P, dur: 3 };
  }
  function hudStep() {
    if (!hudAnim) return;
    var el = $('hud-hosts'); if (!el) { hudAnim = null; return; }
    var k = Math.min(1, (clock.P - hudAnim.start) / hudAnim.dur);
    if (US.reduced) k = 1;
    var e = 1 - Math.pow(1 - k, 3);
    var lf = Math.log(hudAnim.from), lt = Math.log(Math.max(1, hudAnim.to));
    var v = Math.round(Math.exp(lf + (lt - lf) * e));
    if (k >= 1) { v = hudAnim.to; hudAnim = null; }
    setText(el, grp(v));
  }

  /* ------------------------------------------------------------------ toasts */
  var lastToast = { text: '', at: -99 };
  US.toast = function (text) {
    if (text == null || text === '') return;
    if (!TOAST_STATES[US.state] || clock.stopped) return;
    if (text === lastToast.text && clock.P - lastToast.at < 4) return;
    lastToast = { text: text, at: clock.P };
    var box = $('toasts'); if (!box) { warn('el:toasts', 'missing #toasts'); return; }
    var el = D.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 2) box.removeChild(box.firstChild);
    US.after(5500, function () {
      el.classList.add('out');
      US.after(US.reduced ? 0 : 400, function () { if (el.parentNode) el.parentNode.removeChild(el); });
    });
  };
  US.say = function (text, opt) {
    if (text == null || text === '') return;
    opt = opt || {};
    if (US.state === 'term') {
      if (US.scenes && typeof US.scenes.termPrint === 'function') US.scenes.termPrint(text, opt);
      return;
    }
    if (US.state === 'last' || US.state === 'done' || US.state === 'coda' || US.state === 'manifest') return;
    if (US.mask >= 30) return;
    US.toast(text);
  };

  // a11y live region: one line per 2 s
  var a11yQ = [], a11yNext = 0;
  US.a11y = function (text) { if (text) a11yQ.push(text); if (a11yQ.length > 6) a11yQ.splice(0, a11yQ.length - 6); };
  function a11yStep() {
    if (!a11yQ.length) return;
    var t = nowMs(); if (t < a11yNext) return;
    a11yNext = t + 2000;
    setText($('a11y-live'), a11yQ.shift());
  }

  /* ----------------------------------------------------------------- titles */
  var baseTitle = D.title;
  var awayTitleIdx = 0, awayTitleAt = 0;
  function updateTitle() {
    if (clock.hidden) return;
    var t = null;
    if (US.state === 'disconnected' || (US.state === 'manifest' && manifestBase === 'disconnected')) t = US.line('title.disconnected');
    else if (US.state === 'portal' || !connected) t = baseTitle;
    else t = US.line('title.normal');
    if (t && D.title !== t) D.title = t;
  }
  US.updateTitle = updateTitle;
  function awayTitles(now) {
    if (!connected || clock.stopped || US.state === 'portal') return;
    if (now - awayTitleAt < 4000 && awayTitleAt) return;
    awayTitleAt = now;
    var t = null;
    if (US.state === 'done' && US.scenes && US.scenes.blanked) t = US.line('title.awayDone');
    else {
      var arr = US.staged('title.away');
      if (Array.isArray(arr) && arr.length) {
        for (var k = 0; k < arr.length && t == null; k++) { t = US.fmt(arr[awayTitleIdx % arr.length]); awayTitleIdx++; }
      }
    }
    if (t) D.title = t;
  }

  /* ------------------------------------------------------------------- tabs */
  var pendingTab = null;
  US.tab = function (slug, opt) {
    opt = opt || {};
    if (TAB_SLUGS.indexOf(slug) < 0) { warn('tab:' + slug, 'unknown tab ' + slug); return; }
    if (opt.auto && typingNow()) { pendingTab = { slug: slug, since: clock.P, opt: opt }; return; }
    pendingTab = null;
    doTab(slug, opt);
  };
  function doTab(slug, opt) {
    var prev = US.currentTab;
    US.currentTab = slug;
    html.setAttribute('data-tab', slug);
    var btns = D.querySelectorAll('#tabs [data-tab]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-tab') === slug;
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
      btns[i].setAttribute('tabindex', on ? '0' : '-1');
      if (on && opt.auto && btns[i].scrollIntoView) { try { btns[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* */ } }
    }
    var panes = D.querySelectorAll('#panes [data-pane]');
    for (var j = 0; j < panes.length; j++) { var p = panes[j].getAttribute('data-pane') === slug; if (panes[j].hidden === p) panes[j].hidden = !p; }
    setText($('panel-url'), US.line('panel.url'));
    if ((mem.tabsVisited || []).indexOf(slug) < 0) US.push('tabsVisited', slug);
    updateTitle();
    US.emit('tab', { tab: slug, auto: !!opt.auto, prev: prev });
    if (opt.auto && !opt.silent && prev !== slug) US.toast(US.line('toast.tabAuto'));
  }
  function tabDeferStep() {
    if (!pendingTab) return;
    if (!typingNow() || clock.P - pendingTab.since > 12) {
      var p = pendingTab; pendingTab = null;
      if (US.state === 'panel' || US.state === 'face') doTab(p.slug, p.opt);
    }
  }

  /* ------------------------------------------------------------------ sound */
  US.setSound = function (on) {
    on = !!on;
    try {
      if (on && US.audio && typeof US.audio.enable === 'function') US.audio.enable();
      if (!on && US.audio && typeof US.audio.disable === 'function') US.audio.disable();
    } catch (e) { warn('audio', 'audio toggle failed: ' + e); }
    html.setAttribute('data-sound', on ? 'on' : 'off');
    var b = $('btn-sound');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); setText(b, US.line(on ? 'panel.soundOn' : 'panel.soundOff')); }
    var changed = !!mem.sound !== on;
    US.remember('sound', on);
    if (changed || on) US.emit('sound', { on: on });
  };

  /* ------------------------------------------------------------------- input */
  var lastInputP = 0, idleStage = 0, downs = [], lastMashEmit = -1e9, lastMashSay = -1e9, lastNoticeP = -1e9;
  function currentIdle() { return connected && !clock.stopped ? Math.max(0, clock.P - lastInputP) : 0; }
  US.input = function (kind) {
    kind = kind || 'key';
    var idle = currentIdle();
    if (connected && idle >= 12) {
      mem.idleTotal = (mem.idleTotal || 0) + idle;
      mem.idleLongest = Math.max(mem.idleLongest || 0, idle);
      US.emit('active', { idleFor: Math.round(idle) });
    }
    lastInputP = clock.P;
    idleStage = 0;
    if (kind === 'key' || kind === 'pointer') {
      var t = nowMs();
      downs.push(t);
      while (downs.length && t - downs[0] > 1000) downs.shift();
      var rate = downs.length;
      if (rate > (mem.mashMax | 0)) mem.mashMax = rate;
      if (rate >= 10 && t - lastMashEmit > 5000 && !senseRemarks()) { lastMashEmit = t; US.emit('mash', { rate: rate, from: 'director' }); }
    }
    US.emit('input', { kind: kind });
  };
  function senseRemarks() { return !!(US.sense && US.sense.remarks); }
  function toolsHere() { return !!(US.tools && typeof US.tools.resolve === 'function'); }
  US.limited = function () { return clock.P < (US._limitUntil || 0); };

  function idleStep() {
    if (!connected || clock.stopped) return;
    var idle = currentIdle();
    var next = idleStage < 3 ? [12, 25, 45][idleStage] : 45 + 30 * (idleStage - 2);
    if (idle < next) return;
    var stage = idleStage;
    idleStage++;
    US.emit('idle', { seconds: next });
    if (!IDLE_STATES[US.state]) return;
    var arr = US.staged('idle');
    if (!Array.isArray(arr) || !arr.length) return;
    var idx = stage < 3 ? stage : (stage - 3) % arr.length;
    var txt = US.fmt(arr[idx % arr.length], { idle: Math.round(idle) });
    if (txt) US.say(txt, { idle: true });
  }

  /* --------------------------------------------- event-driven memory keeping */
  US.on('mash', function (d) {
    var rate = +d.rate || 10;
    mem.lastMash = rate;
    mem.mashMax = Math.max(mem.mashMax | 0, rate);
    var t = nowMs();
    if (t - lastMashSay < 5000) return;
    lastMashSay = t;
    US._limitUntil = clock.P + 2;
    if (senseRemarks()) return;            // sense.js counts and speaks the masher line itself
    mem.mashCount = (mem.mashCount | 0) + 1;
    if (connected && (US.state === 'panel' || US.state === 'term')) US.say(US.line('mash'));
  });
  US.on('deleted', function (d) {
    var txt = String(d.text || '').trim().slice(0, 32);
    if (txt.length < 3) return;
    if (!mem.deleted || txt.length > String(mem.deleted).length) mem.deleted = txt;
    if (!Array.isArray(mem.deletedAll)) mem.deletedAll = [];
    if (mem.deletedAll[mem.deletedAll.length - 1] !== txt) mem.deletedAll.push(txt);
    notice('notice.deleted', { deleted: txt });
  });
  US.on('hesitate', function (d) {
    var s = +d.seconds; if (!isFinite(s)) return;
    mem.hesNow = s;
    if (!mem.hesByField || typeof mem.hesByField !== 'object') mem.hesByField = {};
    if (d.field) mem.hesByField[d.field] = Math.max(mem.hesByField[d.field] || 0, s);
    mem.hesMax = Math.max(mem.hesMax || 0, s);
    if (s >= 6) notice('notice.hesitate', { hesNow: US.hes(s) });
  });
  function notice(path, extra) {
    if (US.mask < 16 || !connected || clock.stopped || senseRemarks()) return;
    if (!(US.state === 'panel' || US.state === 'term')) return;
    if (clock.P - lastNoticeP < 40) return;
    var t = US.line(path, extra);
    if (!t) return;
    lastNoticeP = clock.P;
    US.say(t);
  }
  US.on('lookup', function (d) {
    if (!d || d.auto || d.q == null) return;
    var q = String(d.q).trim(); if (!q) return;
    if (d.bucket) mem.lastBucket = d.bucket;
    if (toolsHere() || d.recorded) return;  // tools.js records lookups in memory itself
    mem.lookups = mem.lookups || [];
    mem.lookups.push(q);
    mem.lastQuery = q;
    if (d.bucket) mem.lastBucket = d.bucket;
    if (!mem.firstLookup) mem.firstLookup = q;
    mem.lookupCount = mem.lookups.length;
  });
  US.on('trace', function (d) {
    if (!d || d.auto || d.target == null || d.recorded || toolsHere()) return;
    mem.traces = mem.traces || [];
    mem.traces.push(String(d.target));
  });
  US.on('device', function (d) {
    if (!d || d.auto || toolsHere()) return;
    var n = d.name || d.id; if (!n) return;
    if (!mem.deviceTapped) mem.deviceTapped = n;
    mem.devicesTapped = mem.devicesTapped || [];
    if (mem.devicesTapped.indexOf(n) < 0) mem.devicesTapped.push(n);
  });
  US.on('lease', function (d) { if (d && typeof d.renewals === 'number' && d.renewals >= (mem.renewals | 0)) mem.renewals = d.renewals; });
  US.on('drop', function () {
    if (US.mask === 8 && !mem._droppedToast) { mem._droppedToast = true; US.toast(US.line('toast.dropped')); }
  });

  /* ------------------------------------------------------------- visibility */
  var awayStartMs = 0;
  function isHidden() { return D.visibilityState === 'hidden'; }
  function onVisibility() {
    var h = isHidden();
    if (h === clock.hidden) return;
    clock.hidden = h;
    if (h) {
      awayStartMs = nowMs();
      awayTitleAt = 0; awayTitleIdx = 0;
      if (clock.stopped) return;
      mem.awayCount = (mem.awayCount | 0) + 1;
      US.hold('away');
      US.emit('away', {});
      awayTitles(nowMs());
    } else {
      var away = (nowMs() - awayStartMs) / 1000;
      US.release('away');
      clock.last = nowMs();
      updateTitle();
      if (clock.stopped) return;
      mem.lastAway = away;
      mem.awayTotal = (mem.awayTotal || 0) + away;
      mem.awayLongest = Math.max(mem.awayLongest || 0, away);
      var awayRenewals = 0;
      if (connected && away >= 45) { awayRenewals = Math.max(1, Math.round(away / 45)); mem.renewals = (mem.renewals | 0) + awayRenewals; }
      US.emit('back', { away: Math.round(away) });
      if (!connected || away < 2) return;
      if (US.state === 'done' || US.state === 'face' || US.state === 'portal') return;
      var line = null, extra = { away: Math.round(away), awayRenewals: awayRenewals };
      if (US.mask >= 8 && US.mask < 30 && away > 60) line = US.line('back.long', extra);
      if (!line && US.mask >= 8 && US.mask < 30 && (mem.awayCount | 0) >= 3) line = US.line('back.often', extra);
      if (!line) line = US.line('back', extra);
      US.say(line);
    }
  }

  /* ------------------------------------------------------------- disconnect */
  US.disconnect = function () {
    if (US.state === 'disconnected') return;
    var from = US.state;
    clock.stopped = true;
    clock.running = false;
    timers.length = 0;
    scheds.length = 0;
    holds = {};
    pendingTab = null;
    hudAnim = null;
    mem.lastEnd = 'disconnect';
    US.persist();
    US.emit('disconnect', { from: from });
    try { if (US.audio && typeof US.audio.stop === 'function') US.audio.stop(); } catch (e) { /* */ }
    US.setState('disconnected');
  };

  /* ----------------------------------------------------------------- connect */
  US.on('connect', function (d) {
    if (connected) return;
    d = d || {};
    if (d.name && !mem.name) US.remember('name', d.name);
    if (!mem.name) { mem.name = 'Guest'; mem.nameAuto = true; }
    if (typeof d.nameAuto === 'boolean') mem.nameAuto = d.nameAuto;
    identity(mem.name);
    connected = true;
    connectP = clock.P;
    lastInputP = clock.P;
    idleStage = 0;
    mem.connectClock = hhmm();
    mem.connectAt = Date.now();
    clock.T = 30;
    clock.running = true;
    US.persist();
  });

  function autoConnect() {
    if (connected) return;
    var nm = Q.get('name');
    var clean = nm ? US.cleanName(nm) : '';
    US.remember('name', clean || 'Guest');
    US.remember('nameAuto', !clean);
    if (mem.hesTerms == null) { mem.hesTerms = clean ? 9.4 : 60; if (!clean) mem.termsAuto = true; }
    if (Q.get('day')) US.remember('day', US.cleanDay ? US.cleanDay(Q.get('day')) : String(Q.get('day')).toLowerCase());
    if (Q.get('deleted')) US.remember('deleted', String(Q.get('deleted')).slice(0, 32));
    if (Q.get('tapped')) { US.remember('deviceTapped', Q.get('tapped')); mem.devicesTapped = [Q.get('tapped')]; }
    if (US.scenes && typeof US.scenes.autoConnect === 'function') { try { US.scenes.autoConnect(); } catch (e) { warn('sc:auto', String(e)); } }
    US.emit('connect', { name: mem.name, nameAuto: !!mem.nameAuto, sound: !!mem.sound, auto: true });
  }
  US.cleanDay = function (raw) {
    var s = String(raw || '').trim().split(/\s+/)[0] || '';
    s = s.slice(0, 24);
    if (!s) return '';
    return (s === s.toUpperCase() && /\p{L}/u.test(s) && s.length > 1) ? s : s.toLowerCase();
  };

  /* ------------------------------------------------------------------- debug */
  var dbgEl = null;
  function debugStep() {
    if (!DEBUG) return;
    dbgEl = dbgEl || $('debug');
    if (!dbgEl) return;
    dbgEl.hidden = false;
    var summary = ['name', 'day', 'deleted', 'hesTerms', 'deviceTapped', 'lookupCount', 'awayCount', 'mashMax', 'faceOutcome', 'renewals', 'visits']
      .map(function (k) { var v = k === 'lookupCount' ? (mem.lookups || []).length : mem[k]; return v == null ? null : k + '=' + v; }).filter(Boolean).join(' ');
    dbgEl.textContent = 'T ' + clock.T.toFixed(1) + '  P ' + clock.P.toFixed(1) + '  ×' + SPEED + '\n' +
      US.beat + ' · ' + US.state + ' · /' + US.mask + ' · tab ' + US.currentTab + '\n' +
      'holds: ' + (Object.keys(holds).join(',') || '-') + (typingNow() ? ' typing' : '') + '  idle ' + Math.round(currentIdle()) + 's\n' + summary;
  }

  /* -------------------------------------------------------------------- loop */
  var lastTickMs = 0;
  function loop() {
    var now = nowMs();
    var dtr = Math.min(2, Math.max(0, (now - clock.last) / 1000));
    clock.last = now;
    var hidden = isHidden();
    if (hidden !== clock.hidden) onVisibility();
    if (hidden) { awayTitles(now); return; }
    var d = dtr * SPEED;
    clock.P += d;
    if (clock.running && !clock.stopped && !isHeld()) {
      var st = US.state;
      if ((st === 'panel' || st === 'term') && typingNow() && (typingUsed[US.beat] || 0) < 12) typingUsed[US.beat] = (typingUsed[US.beat] || 0) + d;
      else clock.T += d;
    }
    runTimers();
    runScheds();
    idleStep();
    hudStep();
    tabDeferStep();
    a11yStep();
    if (now - lastTickMs >= 250) { lastTickMs = now; US.emit('tick', { T: clock.T }); debugStep(); }
  }

  /* -------------------------------------------------------------------- boot */
  var booted = false;
  function registerCues() {
    BEATS.forEach(function (b) {
      if (b.id === 'b01') return;
      US.schedule(b.T, function (info) { if (!info.late) enterBeat(b); });
    });
    MASKS.forEach(function (x) {
      if (!x[1]) return;
      US.schedule(x[0], function (info) { if (!info.late) setMask(x[1]); });
    });
    TABS_AT.forEach(function (x) {
      var isBeatStart = BEATS.some(function (b) { return b.T === x[0]; });
      if (isBeatStart) return;
      US.schedule(x[0], function (info) { if (!info.late && US.state === 'panel') US.tab(x[1], { auto: true }); });
    });
  }
  function installFallbackInput() {
    var lastMove = 0;
    D.addEventListener('keydown', function () { US.input('key'); }, { passive: true, capture: true });
    D.addEventListener('pointerdown', function () { US.input('pointer'); }, { passive: true, capture: true });
    D.addEventListener('wheel', function () { US.input('wheel'); }, { passive: true, capture: true });
    D.addEventListener('pointermove', function () { var t = nowMs(); if (t - lastMove > 500) { lastMove = t; US.input('move'); } }, { passive: true, capture: true });
  }
  function boot() {
    if (booted) return;
    booted = true;
    US.content = W.US_CONTENT || US.content || {};
    if (!W.US_CONTENT) warn('content', 'US_CONTENT missing — running on inline fallbacks');
    loadStorage();
    var via = Q.get('via') === 'heartwood';
    if (!via) {
      try {
        var r = D.referrer ? new URL(D.referrer) : null;
        if (r && r.host === W.location.host) {
          var root = W.location.pathname.replace(/understory\/(index\.html)?$/, '');
          var rp = r.pathname.replace(/index\.html$/, '');
          if (rp === root) via = true;
        }
      } catch (e) { /* */ }
    }
    if (via) mem.via = true;
    if (Q.get('from')) mem.from = sanitizeFrom(Q.get('from'));

    // reduced motion, live
    try {
      var mq = W.matchMedia('(prefers-reduced-motion: reduce)');
      var setR = function () { US.reduced = !!mq.matches; html.toggleAttribute('data-reduced', US.reduced); };
      setR();
      if (mq.addEventListener) mq.addEventListener('change', setR); else if (mq.addListener) mq.addListener(setR);
    } catch (e) { US.reduced = false; }

    if (!html.hasAttribute('data-device')) html.setAttribute('data-device', US.device || 'desktop');
    html.setAttribute('data-sound', 'off');
    html.setAttribute('data-mask', '0');
    html.setAttribute('data-tab', 'status');
    html.style.setProperty('--mask', '0');
    html.style.setProperty('--decay', '0');
    US.applyL();
    hudSet(0, 0, true);
    var sb = $('btn-sound'); if (sb) setText(sb, US.line('panel.soundOff'));

    var senseHere = US.sense && Object.keys(US.sense).some(function (k) { return k !== 'orientation' || US.sense.orientation; });
    if (!senseHere) { warn('sense', 'sense.js not present — director installs a minimal input feed'); installFallbackInput(); }

    D.addEventListener('input', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-sense]')) lastSenseP = clock.P;
    }, true);
    D.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var dc = t.closest('.disconnect');
      if (dc) { e.preventDefault(); US.disconnect(); return; }
      var tb = t.closest('#tabs [data-tab]');
      if (tb) { US.tab(tb.getAttribute('data-tab'), { auto: false }); return; }
      if (t.closest('#btn-sound')) { US.setSound(!mem.sound); }
    });
    var tabsEl = $('tabs');
    if (tabsEl) tabsEl.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var i = TAB_SLUGS.indexOf(US.currentTab);
      i = (i + ((e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : TAB_SLUGS.length - 1)) % TAB_SLUGS.length;
      US.tab(TAB_SLUGS[i], { auto: false });
      var b = D.querySelector('#tabs [data-tab="' + TAB_SLUGS[i] + '"]'); if (b) b.focus();
      e.preventDefault();
    });
    D.addEventListener('visibilitychange', onVisibility);
    W.addEventListener('pagehide', function () { US.persist(); });

    clock.hidden = isHidden();
    clock.last = nowMs();
    US.setState('portal', { noFocus: true });
    US.beat = 'b01';
    registerCues();
    setInterval(loop, 33);
    US.emit('boot', {});

    if (TESTING) {
      autoConnect();
      var T = typeof JUMP_T === 'number' ? JUMP_T : (beatById(JUMP_T.slice(5)) || BEATS[1]).T;
      if (T > 30) jumpTo(T);
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
  US._boot = boot;
  US.param = function (k) { return (TESTING || DEBUG || k === 'via' || k === 'from' || k === 'speed') ? Q.get(k) : null; };
})();
