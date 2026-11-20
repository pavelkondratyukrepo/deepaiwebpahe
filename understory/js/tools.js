/* UNDERSTORY v2 — tools.js (Builder C)
   Router panel behaviours: Devices, DHCP/Lease, DNS Lookup, Diagnostics,
   System Log (+ARP), Routing, NAT card. Exposes US.tools.resolve().
   All user-provided text is inserted with textContent only. */
(function () {
  "use strict";
  var US = window.US;
  if (!US || typeof US.on !== "function") return;
  var C = function () { return US.content || window.US_CONTENT || {}; };
  var DEBUG = !!US.debug;
  var warned = {};
  function warn(k) { if (DEBUG && !warned[k]) { warned[k] = 1; try { console.warn("[tools] missing: " + k); } catch (e) {} } }

  /* ==== helpers ==== */
  var MASKS = [0, 8, 16, 24, 30, 32];
  var MASK_T = { 0: 30, 8: 80, 16: 150, 24: 220, 30: 305, 32: 368 };
  function $(id) { return document.getElementById(id); }
  function mask() { var m = +US.mask; return MASKS.indexOf(m) >= 0 ? m : 0; }
  function T() { return +US.T() || 0; }
  function recall(k, d) { return US.recall(k, d); }
  function remember(k, v) { US.remember(k, v); }
  function push(k, v) { US.push(k, v); }
  function emit(e, d) { US.emit(e, d); }
  function get(path) {
    var o = C(), parts = path.split(".");
    for (var i = 0; i < parts.length; i++) { if (o == null) break; o = o[parts[i]]; }
    if (o == null) warn(path);
    return o;
  }
  function stageKey(m) { return "s" + (m == null ? mask() : m); }
  function staged(obj, m) {
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return obj;
    if (!("s0" in obj) && !("s8" in obj) && !("s16" in obj) && !("s24" in obj) && !("s30" in obj) && !("s32" in obj)) return obj;
    m = m == null ? mask() : m;
    for (var i = MASKS.indexOf(m); i >= 0; i--) { var k = "s" + MASKS[i]; if (k in obj) return obj[k]; }
    return null;
  }
  function slug(x, max) {
    return String(x == null ? "" : x).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, max || 24);
  }
  function cut(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) + "…" : s; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function ascii(s) { return String(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[—–]/g, "-").replace(/→/g, "->"); }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock() { var d = new Date(); return two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()); }

  function octets() {
    var ip = String(US.ip || recall("ip", "") || ""), m = ip.match(/^10\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return {};
    var a = +m[1], b = +m[2];
    return { a: a, b: b, a2: (a % 253) + 1, b2: (b % 253) + 1 };
  }
  function gw() { return US.gw(); }

  // last-lookup edit rule (§3.9.3), resolved here so it does not depend on the director knowing buckets
  function editLastQuery() {
    var lq = recall("lastQuery", null);
    if (lq == null || lq === "") return null;
    var b = bucketOf(String(lq)), e = get("lk.edit") || {};
    var rule = e[b] != null ? e[b] : e.other;
    if (rule == null) return null;
    return fmtRaw(rule, { lastQuery: cut(lq, 48) });
  }

  // fill placeholders; returns null if any are unresolved (caller then skips)
  function fmtRaw(s, extra) {
    if (s == null) return null;
    s = String(s);
    extra = extra || {};
    var unresolved = false;
    // pre-resolve directives that tools knows best
    s = s.replace(/\{edit:lastQuery\}/g, function () { var v = editLastQuery(); if (v == null) { unresolved = true; return ""; } return v; });
    s = s.replace(/\{slug:([a-zA-Z]+)\}/g, function (all, k) {
      var v = extra[k] != null ? extra[k] : recall(k, null);
      if (k === "name" && v == null) v = US.name || null;
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) { unresolved = true; return ""; }
      var sl = slug(v); if (!sl) { unresolved = true; return ""; } return sl;
    });
    if (unresolved) return null;
    var ex = {}, o = octets(), k;
    for (k in o) ex[k] = o[k];
    var g = gw(); if (g != null) ex.gw = g;
    for (k in extra) ex[k] = extra[k];
    var r = US.fmt(s, ex);
    return r == null ? null : String(r);
  }
  // value → string: handles {t,alt} and staged objects
  function fmt(v, extra, m) {
    v = staged(v, m);
    if (v == null) return null;
    if (typeof v === "object" && !Array.isArray(v)) {
      var r = fmt(v.t, extra, m);
      return r != null ? r : (v.alt != null ? fmt(v.alt, extra, m) : null);
    }
    return fmtRaw(v, extra);
  }
  function line(path, extra, m) { return fmt(get(path), extra, m); }
  var localPools = {};
  function pick(path, extra) {
    var arr = get(path);
    if (!Array.isArray(arr) || !arr.length) return fmt(arr, extra);
    var pool = localPools[path];
    if (!pool || !pool.length) { pool = localPools[path] = arr.map(function (_, i) { return i; }); }
    for (var tries = 0; tries < arr.length && pool.length; tries++) {
      var i = Math.floor(Math.random() * pool.length), idx = pool.splice(i, 1)[0];
      var s = fmt(arr[idx], extra); if (s != null) return s;
    }
    return null;
  }
  function toast(t) { US.toast(t); }
  function after(ms, fn) { return US.after(ms, fn); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function inPanel() { return US.state === "panel" || US.state === "face"; }
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  /* ==== rate limit (≥5 submits in 8 s → 2 s of 429, submit ignored) ==== */
  var submits = [], limitedUntil = 0;
  function rateLimited() {
    var now = nowMs(), sp = US.speed || 1;
    if (US.sense && US.sense.rateLimitedUntil && now < US.sense.rateLimitedUntil) return true;
    try { if (typeof US.limited === "function" && US.limited()) return true; } catch (e) {}
    if (now < limitedUntil) return true;
    submits = submits.filter(function (t) { return now - t < 8000 / sp; });
    submits.push(now);
    if (submits.length >= 5) { limitedUntil = now + 2000 / sp; submits = []; return true; }
    return false;
  }

  /* ==== DNS lookup — bucket selection and resolve() ==== */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  // whole-word matcher: dots and digits count as part of a word, so "112" does not match "10.0.0.112"
  function wordRe(kw) { return new RegExp("(^|[^a-z0-9.])" + escRe(kw) + "s?($|[^a-z0-9.])"); }
  function matchKw(q, kw, word) {
    if (word || (kw.length <= 4 && /^[a-z0-9]+$/.test(kw))) return wordRe(kw).test(q);
    return q.indexOf(kw) >= 0;
  }
  function bucketOf(raw, nameOverride) {
    var q = String(raw == null ? "" : raw).trim().toLowerCase().replace(/’/g, "'");
    if (!q) return "empty";
    var buckets = get("lk.buckets") || [];
    var name = String(nameOverride || recall("name", "") || US.name || "").trim().toLowerCase();
    for (var i = 0; i < buckets.length; i++) {
      var b = buckets[i];
      if (b.rule === "name") {
        if (name && (q === name || wordRe(name).test(q))) return "self";
        continue;
      }
      if (b.rule === "question") { if (q.indexOf("?") >= 0 || q.split(/\s+/).length >= 4) return "question"; continue; }
      if (b.rule === "any") return b.id;
      if (b.regex) { try { if (new RegExp(b.regex).test(q)) return b.id; } catch (e) {} continue; }
      if (b.match) for (var j = 0; j < b.match.length; j++) if (matchKw(q, String(b.match[j]).toLowerCase(), b.word)) return b.id;
    }
    return "fallback";
  }

  function lstage(opt) {
    var s = opt && opt.stage;
    if (typeof s === "string" && /^L[1-4]$/.test(s)) return s;
    var m = typeof s === "number" ? s : (typeof s === "string" && /^s\d+$/.test(s) ? +s.slice(1) : mask());
    if (m >= 30) return "L4";
    if (m >= 24) return "L3";
    if (m >= 8) return "L2";
    return "L1";
  }

  var unaskedShown = {}, unaskedNoted = false;
  function unasked(L) {
    var list = get("lk.unasked") || [], out = [], max = L === "L3" ? 3 : 99;
    for (var i = 0; i < list.length && out.length < max; i++) {
      if ((unaskedShown[i] || 0) >= 2) continue;
      var s = fmtRaw(list[i], { awayCount: recall("awayCount", 0) || null });
      if (s == null) continue;
      unaskedShown[i] = (unaskedShown[i] || 0) + 1;
      var mm = ascii(s).match(/^(\S+)\s+(A\s+.*)$/);
      out.push(mm ? pad(mm[1], 28) + " " + mm[2] : ascii(s));
    }
    return out;
  }

  // resolve(q, {stage}) → { bucket, records:[string], say:[string], note }
  function resolve(q, opt) {
    opt = opt || {};
    var L = lstage(opt), raw = String(q == null ? "" : q).trim();
    var bucket = bucketOf(raw, opt.name);
    var res = { bucket: bucket, stage: L, records: [], say: [], note: null };
    var qx = { q: cut(raw, 48), lookupCount: Math.max(1, +recall("lookupCount", 0) || 0) };
    if (bucket === "empty") {
      var e = line("lk.say.empty." + L, qx) || (L === "L1" || L === "L2" ? line("lk.empty") : null);
      if (e) res.say.push(e);
      return res;
    }
    var rec = fmtRaw(get("lk.record") || "{q}    A    0.0.0.0    ttl 0    (local)", qx);
    if (rec != null) res.records.push(rec);
    if (L === "L1") { res.note = line("lk.l1note"); return res; }
    var say = null;
    if (opt.auto && get("lk.auto.say")) say = line("lk.auto.say", qx);
    else {
      var cell = get("lk.say." + bucket + "." + L);
      say = Array.isArray(cell) ? pick("lk.say." + bucket + "." + L, qx) : fmt(cell, qx);
      if (say == null && bucket !== "fallback") say = pick("lk.say.fallback." + L, qx);
    }
    if (say) res.say.push(say);
    if (L === "L3" || L === "L4") {
      var un = unasked(L);
      if (un.length) {
        res.records = res.records.concat(un);
        if (!unaskedNoted) { unaskedNoted = true; var n = line("lk.unaskedNote"); if (n) res.say.push(n); }
      }
    }
    return res;
  }

  // a visitor lookup: tools records it in memory (the director defers to tools.js when present)
  function recordLookup(q, bucket, L) {
    var qq = cut(String(q).trim(), 48);
    if (!qq) return;
    push("lookups", qq);
    remember("lastQuery", qq);
    remember("lastBucket", bucket);
    if (recall("firstLookup", null) == null) remember("firstLookup", qq);
    remember("lookupCount", (recall("lookups", []) || []).length);
    emit("lookup", { q: qq, bucket: bucket, stage: L, recorded: true });
  }

  /* ==== lookup UI ==== */
  var lkBusy = false, lkAutoDone = false, lkLastInputAt = 0;
  function lkOut(items) {
    var out = $("lk-out"); if (!out) return;
    var frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(el("li", it.cls, it.text)); });
    out.insertBefore(frag, out.firstChild);
    while (out.children.length > 80) out.removeChild(out.lastChild);
    try { out.scrollTop = 0; } catch (e) {}
  }
  function showResult(res) {
    var items = [];
    res.records.forEach(function (r, i) { items.push({ cls: "rec" + (i ? " unasked" : ""), text: r }); });
    if (res.note) items.push({ cls: "say note", text: res.note });
    res.say.forEach(function (s) { items.push({ cls: "say", text: s }); });
    lkOut(items);
  }
  function lkSubmit(q, auto) {
    var go = $("lk-go");
    if (!auto && rateLimited()) { var rl = line("lk.rateLimited"); if (rl) lkOut([{ cls: "say limited", text: rl }]); return; }
    if (lkBusy) return;
    var L = lstage({}), raw = String(q || "").trim();
    lkBusy = true;
    var goText = go ? go.textContent : null;
    if (go) { go.textContent = line("lk.busy") || "Looking up…"; go.setAttribute("aria-busy", "true"); }
    if (!auto && raw) emit("said", { text: raw, field: "lookup" });
    var delay = raw ? (L === "L1" ? rand(350, 700) : (mask() >= 16 ? rand(120, 260) : rand(450, 900))) : 150;
    after(delay, function () {
      lkBusy = false;
      if (go) { go.textContent = goText || line("lk.go") || "Look up"; go.removeAttribute("aria-busy"); }
      var res = resolve(raw, { stage: L, auto: auto });
      showResult(res);
      if (raw) {
        if (auto) emit("lookup", { q: cut(raw, 48), bucket: res.bucket, stage: L, auto: true });
        else recordLookup(raw, res.bucket, L);
      }
      var early = $("lk-early"); if (early) early.textContent = "";
      setGhost("");
    });
  }
  // ghost completion (s16+): previous query or the visitor's name matching the prefix
  function suggestions() {
    var s = [], n = recall("name", null), l = recall("lookups", []) || [];
    for (var i = l.length - 1; i >= 0; i--) s.push(String(l[i]));
    if (n) s.push(String(n));
    return s;
  }
  function setGhost(typed, rest) {
    var g = $("lk-ghost"); if (!g) return;
    g.textContent = "";
    if (!rest) { g.removeAttribute("data-on"); return; }
    var a = el("span", "ghost-typed", typed), b = el("span", "ghost-rest", rest);
    a.style.visibility = "hidden";
    g.appendChild(a); g.appendChild(b);
    g.setAttribute("data-on", "");
    g.setAttribute("aria-hidden", "true");
  }
  var ghostRest = "";
  function lkInput() {
    var inp = $("lk-input"); if (!inp) return;
    lkLastInputAt = nowMs();
    var v = inp.value, early = $("lk-early");
    if (mask() >= 16 && v.trim().length >= 2) {
      if (early) early.textContent = line("lk.early") || "→ 0.0.0.0  (answered early)";
      ghostRest = "";
      var lv = v.toLowerCase(), sug = suggestions();
      for (var i = 0; i < sug.length; i++) {
        if (sug[i].toLowerCase().indexOf(lv) === 0 && sug[i].length > v.length) { ghostRest = sug[i].slice(v.length); break; }
      }
      setGhost(v, ghostRest);
    } else {
      if (early) early.textContent = "";
      ghostRest = ""; setGhost("");
    }
  }
  function lkKey(e) {
    if (!ghostRest) return;
    if (e.key === "Tab" || e.key === "ArrowRight") {
      var inp = e.target;
      if (inp.selectionStart != null && inp.selectionStart < inp.value.length) return;
      e.preventDefault();
      inp.value = inp.value + ghostRest; ghostRest = ""; setGhost("");
      try { inp.dispatchEvent(new Event("input", { bubbles: true })); } catch (x) {}
    }
  }
  function renderRecent() {
    var box = $("lk-recent"); if (!box) return;
    var ul = box.querySelector("ul"); if (!ul) return;
    var list = staged(get("lk.recent")) || [];
    ul.textContent = "";
    list.forEach(function (r) { var s = fmtRaw(r); if (s != null && s.trim()) ul.appendChild(el("li", null, s)); });
  }
  function lkAutoplay() {
    if (lkAutoDone === true) return;
    var inp = $("lk-input");
    var typing = inp && document.activeElement === inp && inp.value && nowMs() - lkLastInputAt < 3000;
    if (typing && T() < 142) { after(1500, lkAutoplay); return; }
    lkAutoDone = true;
    var a = get("lk.auto") || {}, q = a.q || "anyone";
    if (!inp) { lkSubmit(q, true); return; }
    inp.value = "";
    var i = 0, step = US.reduced ? 0 : 120;
    (function type() {
      if (i < q.length) { inp.value += q[i++]; if (step) { after(step, type); return; } type(); return; }
      after(300, function () { lkSubmit(q, true); inp.value = ""; });
    })();
  }

  /* ==== Devices ==== */
  var dropped = {}, dropping = {}, firstDropToast = false;
  function selfSince() {
    var s = typeof US.sinceConnect === "function" ? US.sinceConnect() : 0;
    if (!s || s < 60) return line("dev.sinceSelfStart") || "just now";
    return fmtRaw("{elapsedShort}") || (Math.round(s / 60) + " min");
  }
  function devExtra() {
    return { sinceSelf: selfSince(), device: US.device === "desktop" ? "computer" : (US.device || "computer") };
  }
  function devName(d) {
    if (d.id === "self" && mask() >= 24) { var nm = fmtRaw("{name}"); if (nm) return nm; }
    return fmtRaw(d.name, devExtra()) || (d.id === "self" ? (line("dev.thisDevice") || "This device") : d.name);
  }
  function devList() { return get("dev.list") || []; }
  function visibleDevices() { return devList().filter(function (d) { return !dropped[d.id]; }); }
  function renderDevCount() {
    var c = $("dev-count"); if (!c) return;
    var s = line("dev.count", { shown: visibleDevices().length });
    if (s != null) c.textContent = s;
  }
  function renderDevices() {
    var ul = $("dev-list"); if (!ul) return;
    ul.textContent = "";
    devList().forEach(function (d) {
      if (dropped[d.id]) return;
      var li = el("li", "device");
      li.setAttribute("data-id", d.id);
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      if (d.id === "self") li.setAttribute("data-self", "");
      li.appendChild(el("span", "dev-name", devName(d)));
      li.appendChild(el("span", "dev-ip", fmtRaw(d.ip, devExtra()) || ""));
      li.appendChild(el("span", "dev-tag", d.id === "self" ? (line("dev.thisDevice") || "This device") : ""));
      var dl = d.line || "", tp = recall("deviceTapped", null);
      if (tp && tp === devName(d)) dl = line("dev.tappedLine") || dl;
      li.appendChild(el("span", "dev-line", dropping[d.id] ? dl : ""));
      if (dropping[d.id]) li.classList.add("dropping");
      ul.appendChild(li);
    });
    renderDevCount();
    renderDhcp();
  }
  function dropDevice(d, silent) {
    if (dropped[d.id] || dropping[d.id]) return;
    if (silent) { dropped[d.id] = true; renderDevices(); return; }
    dropping[d.id] = true;
    var tapped = recall("deviceTapped", null);
    if (tapped && tapped === devName(d)) { var tl = line("dev.tappedLine"); if (tl) d = Object.assign({}, d, { line: tl }); }
    var li = document.querySelector('#dev-list li.device[data-id="' + d.id + '"]');
    if (li) { li.classList.add("dropping"); var l = li.querySelector(".dev-line"); if (l) l.textContent = d.line || ""; }
    if (d.line) logWrite("wlan0", ascii(d.line), { kind: "drop" });
    emit("drop", { id: d.id, line: d.line });
    after(5000, function () { dropping[d.id] = false; dropped[d.id] = true; renderDevices(); });
  }
  // polled from tick: each host leaves at its mask's start + dropAt (story time)
  function scheduleDrops() {
    var m = mask(), now = T();
    devList().forEach(function (d) {
      if (d.drop == null || dropped[d.id] || dropping[d.id] || d.drop > m) return;
      var due = (MASK_T[d.drop] || 0) + (d.dropAt || 0);
      if (d.drop < m || now > due + 4) { dropDevice(d, true); return; }
      if (now >= due && inPanel()) dropDevice(d, false);
    });
  }
  function openDetail(id) {
    var d = null; devList().forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    var name = devName(d), ex = devExtra();
    var set = function (i, v) { var e = $(i); if (e) e.textContent = v == null ? "" : v; };
    set("dd-name", name);
    set("dd-ip", fmtRaw(d.ip, ex) || "");
    set("dd-mac", fmtRaw(d.mac, ex) || "");
    set("dd-since", fmtRaw(d.since, ex) || "");
    set("dd-note", fmtRaw(d.note, ex) || d.note);
    var dlg = $("dev-detail");
    if (dlg) {
      try { if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", ""); }
      catch (e) { dlg.setAttribute("open", ""); }
    }
    if (d.id !== "self") {
      if (!recall("deviceTapped", null)) remember("deviceTapped", name);
      var dt = recall("devicesTapped", []) || [];
      if (dt.indexOf(name) < 0) push("devicesTapped", name);
      emit("device", { id: d.id, name: name, recorded: true });
    }
  }
  var tappedThisRun = false;
  function closeDetail() {
    var dlg = $("dev-detail"); if (!dlg) return;
    try { if (typeof dlg.close === "function" && dlg.open) dlg.close(); else dlg.removeAttribute("open"); } catch (e) { dlg.removeAttribute("open"); }
  }

  /* ==== DHCP / Lease ==== */
  var lastRenewT = 30, renewSlots = -1, bigDone = false, expiring = null, renewIdx = 0;
  function hms(s) { s = Math.max(0, Math.floor(s)); return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60); }
  function leaseLeftSecs() {
    if (expiring) {
      // B08: jumps to 30 s at T=232 and runs out by the big renewal at T=238
      var f = Math.min(1, Math.max(0, (T() - expiring.t0) / Math.max(0.5, expiring.dur)));
      return Math.max(0, Math.ceil(30 * (1 - f)));
    }
    return 86400 - Math.max(0, T() - lastRenewT);
  }
  function renderLease() {
    var set = function (i, v) { var e = $(i); if (e && v != null) e.textContent = v; };
    set("lease-ip", US.ip || recall("ip", null));
    var never = bigDone && mask() >= 24;
    var left = leaseLeftSecs();
    if (US.live) US.live.leaseLeft = never ? null : hms(left);
    set("lease-remaining", never ? line("lease.expiresCol") : (expiring ? line("lease.expiring", { leaseSecs: left }) : line("lease.remaining", { leaseLeft: hms(left) })));
    set("lease-renewals", line("lease.renewals", { renewals: recall("renewals", 0) || 0 }));
    set("lease-note", line("lease.note"));
    var big = $("lease-big"); if (big && !bigDone) big.textContent = "";
  }
  var dhcpOffsets = {};
  function renderDhcp() {
    var tb = document.querySelector("#dhcp-table tbody"); if (!tb) return;
    tb.textContent = "";
    var never = mask() >= 24, ex = devExtra();
    visibleDevices().forEach(function (d) {
      if (dhcpOffsets[d.id] == null) dhcpOffsets[d.id] = d.id === "self" ? 0 : Math.floor(rand(1800, 80000));
      var exp;
      if (d.id === "self") exp = never && bigDone ? line("lease.expiresCol") : (never ? hms(leaseLeftSecs()) : hms(leaseLeftSecs()));
      else if (d.id === "gw") exp = "—";
      else exp = never ? line("lease.expiresCol") : hms(dhcpOffsets[d.id] - Math.max(0, T() - 30));
      var tr = el("tr");
      if (d.id === "self") tr.setAttribute("data-self", "");
      [devName(d), fmtRaw(d.ip, ex) || "", fmtRaw(d.mac, ex) || "", exp || ""].forEach(function (v, i) {
        var td = el("td", null, v);
        var cols = get("dhcp.cols"); if (cols && cols[i]) td.setAttribute("data-label", cols[i]);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }
  function renew(n, opts) {
    var r = (+recall("renewals", 0) || 0) + n;
    remember("renewals", r);
    lastRenewT = T();
    emit("lease", { renewals: r, big: !!(opts && opts.big) });
    renderLease();
  }
  function leaseTick() {
    var t = T();
    if (t < 34) return;
    var slots = Math.floor((t - 34) / 45);
    if (renewSlots < 0) renewSlots = 0;
    if (slots > renewSlots) {
      var n = slots - renewSlots; renewSlots = slots;
      renew(n);
      if (US.tab && currentTab() === "dhcp" && mask() < 24) {
        var list = get("lease.renew") || [];
        if (list.length) { toast(fmtRaw(list[Math.min(renewIdx, list.length - 1)])); renewIdx++; }
      }
    }
    if (!expiring && !bigDone && t >= 232 && t < 238 && mask() >= 24) {
      expiring = { t0: t, dur: 238 - t };
      toast(line("lease.expiring", { leaseSecs: 30 }));
    }
    if (!bigDone && t >= 238 && mask() >= 24) {
      bigDone = true; expiring = null;
      var b = line("lease.big");
      var big = $("lease-big"); if (big && b) big.textContent = b;
      if (t < 245) toast(b);
      renew(1, { big: true });
      renderDhcp();
    }
  }
  function currentTab() { return document.documentElement.getAttribute("data-tab") || ""; }

  /* ==== Diagnostics ==== */
  var dgMode = "ping", dgBusy = false, dgRuns = {}, dgAutoDone = false;
  function dgSetMode(m) {
    dgMode = m === "trace" ? "trace" : "ping";
    var box = $("dg-modes"); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll("[data-mode]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-mode") === dgMode ? "true" : "false");
    });
  }
  function dgWrite(text, cls) {
    var pre = $("dg-out"); if (!pre) return;
    var span = el("span", cls || null, text + "\n");
    pre.appendChild(span);
    try { pre.scrollTop = pre.scrollHeight; } catch (e) {}
  }
  function alignHop(l) {
    var m = l.match(/^(\s?\d+)\s{2}(.+?)\s{2,}([\d.]+ ms)$/);
    if (!m) return l;
    if ((window.innerWidth || 0) < 600) return m[1] + "  " + m[2] + "  " + m[3];   // phones: no column padding, so lines wrap cleanly
    return m[1] + "  " + pad(m[2], 40) + " " + m[3];
  }
  function dgRun(target, auto) {
    if (!auto && dgBusy) { rateLimited(); return; }
    if (dgBusy) return;
    if (!auto && rateLimited()) { var rl = line("lk.rateLimited"); if (rl) dgWrite(rl, "say limited"); return; }
    var raw = String(target || "").trim() || "example.com";
    var tShown = String(raw).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9.\-]/g, "").slice(0, 32) || "0.0.0.0";
    var pre = $("dg-out"); if (pre) pre.textContent = "";
    var run = $("dg-run"), runText = run ? run.textContent : null;
    if (run) { run.textContent = line("dg.running") || "Running…"; run.setAttribute("aria-busy", "true"); }
    dgBusy = true;
    var my = runId;
    var ex = { t: tShown };
    var lines = [], tail = [];
    if (!auto) emit("said", { text: raw, field: "diag" });
    if (dgMode === "trace") {
      var m = mask(), sk = stageKey(m), base = m >= 30 ? 3 : (m >= 24 ? 2 : 1);
      dgRuns[sk] = (dgRuns[sk] || 0) + 1;
      var n = Math.min(3, base + dgRuns[sk] - 1), script = "TR" + n;
      (get("tr." + script) || []).forEach(function (l) { var s = fmtRaw(l, ex); if (s != null) lines.push({ t: alignHop(ascii(s)), mach: true }); });
      if (n === 1) { var n1 = line("tr.note1"); if (n1) tail.push(n1); }
      if (n === 2) { var n2 = line("tr.note2"); if (n2) tail.push(n2); }
      if (!auto) push("traces", tShown);
      emit("trace", { recorded: !auto, target: tShown, script: script, auto: !!auto });
    } else {
      var isIp = bucketOf(raw) === "ip" && raw !== String(US.ip || "");
      var pl = get("ping.lines") || [];
      if (pl.length) { var h = fmtRaw(pl[0], ex); if (h) lines.push({ t: h, mach: true, wait: 300 }); }
      if (isIp && mask() >= 24) {
        (get("ping.timeout.lines") || []).forEach(function (l) { lines.push({ t: l, mach: true, wait: 1000 }); });
        var ts = line("ping.timeout.say"); if (ts) tail.push(ts);
      } else {
        pl.slice(1).forEach(function (l, i) { var s = fmtRaw(l, ex); if (s != null) lines.push({ t: s, mach: true, wait: i < 4 ? 1000 : 400 }); });
        var tl = line("ping.tail"); if (tl) tail.push(tl);
      }
    }
    var i = 0;
    (function next() {
      if (my !== runId) { dgBusy = false; return; }
      if (i < lines.length) {
        var L = lines[i++];
        dgWrite(L.t, "mach");
        var wait = L.wait != null ? L.wait : (/\*\s\*\s\*/.test(L.t) ? 1600 : rand(350, 900));
        if (i >= lines.length) wait = 500;
        after(wait, next);
        return;
      }
      tail.forEach(function (s) { dgWrite(s, "say"); });
      dgBusy = false;
      if (run) { run.textContent = runText || line("dg.run") || "Run"; run.removeAttribute("aria-busy"); }
    })();
  }
  function dgAutoplay() {
    if (dgAutoDone === true) return;
    if (dgBusy) { after(2000, dgAutoplay); return; }
    dgAutoDone = true;
    var a = get("dg.auto") || {};
    dgSetMode(a.mode === "ping" ? "ping" : "trace");
    var inp = $("dg-target"), t = a.t || "outside";
    if (inp) inp.value = t;
    dgRun(t, true);
  }

  /* ==== System log + ARP ==== */
  var logIdx = {}, nextLogT = null, nextArpT = null, arpIdx = {}, logStarted = false, recentLines = [], logStage = null;
  function logBox() { return $("log-out"); }
  function logWrite(fac, msg, opt) {
    opt = opt || {};
    var box = logBox(); if (!box) return;
    var stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    var li = el("li", "log" + (opt.arp ? " arp" : ""));
    li.appendChild(el("span", "ts", opt.ts || clock()));
    li.appendChild(document.createTextNode("  "));
    li.appendChild(el("span", "fac", fac + ":"));
    li.appendChild(document.createTextNode(" "));
    li.appendChild(el("span", "msg", msg));
    if (opt.kind) li.setAttribute("data-kind", opt.kind);
    if (!opt.silent) li.className += " fresh";
    if (opt.q != null) li.setAttribute("data-q", "1"), li._q = opt.q;
    box.appendChild(li);
    while (box.children.length > 200) box.removeChild(box.firstChild);
    if (stick) try { box.scrollTop = box.scrollHeight; } catch (e) {}
    if (!opt.silent) emit("logline", { arp: !!opt.arp, kind: opt.kind || null });
    return li;
  }
  function logLine(s, opt) {
    if (s == null) return null;
    s = ascii(s);
    var i = s.indexOf(": ");
    if (i < 0) return logWrite("sys", s, opt);
    return logWrite(s.slice(0, i), s.slice(i + 2), opt);
  }
  function logEvent(key, extra) {
    if (!logStarted) return;
    var s = fmtRaw(get("log.events." + key), extra);
    if (s == null) return;
    var now = nowMs();
    recentLines = recentLines.filter(function (r) { return now - r.t < 10000; });
    for (var i = 0; i < recentLines.length; i++) if (recentLines[i].s === s) return;
    recentLines.push({ s: s, t: now });
    return logLine(s, { kind: "ev-" + key, q: extra && extra.q });
  }
  function kindOf(raw) {
    if (/survey answer recorded \("\{day\}"\)/.test(raw)) return "day";
    return null;
  }
  function scriptedNext(stage, silent, ts) {
    var list = get("log." + stage) || [];
    while ((logIdx[stage] || 0) < list.length) {
      var at = logIdx[stage] || 0;
      logIdx[stage] = at + 1;
      var raw = list[at];
      var s = fmtRaw(raw);
      if (s != null) { logLine(s, { kind: kindOf(raw), silent: silent, ts: ts }); return true; }
    }
    return false;
  }
  function arpNext(stage, silent) {
    var list = get("arp." + stage) || [];
    if (!list.length) return;
    for (var tries = 0; tries < list.length; tries++) {
      var i = (arpIdx[stage] || 0) % list.length; arpIdx[stage] = i + 1;
      var s = fmtRaw(list[i]);
      if (s != null) { logLine(s, { arp: true, silent: silent || mask() < 16 }); return; }
    }
  }
  // the log quietly edits earlier entries at /16 (§3.9.3): the day answer and the last lookup
  var edited = false;
  function editEarlier() {
    if (edited) return; edited = true;
    var box = logBox(); if (!box) return;
    var n = 0;
    Array.prototype.forEach.call(box.querySelectorAll('li[data-kind="day"] .msg'), function (m) {
      if (recall("day", null) && recall("day") !== "fine") n++;
      m.textContent = 'guest survey answer recorded ("fine")';
    });
    var e = editLastQuery(), lq = recall("lastQuery", null);
    if (e != null && lq != null) {
      Array.prototype.forEach.call(box.querySelectorAll('li[data-kind="ev-lookup"]'), function (li) {
        if (li._q !== lq) return;
        var m = li.querySelector(".msg");
        if (m) { m.textContent = ascii("query[A] " + e + " from " + (US.ip || "") + " -> 0.0.0.0"); n++; }
      });
    }
    if (n) after(7000, function () { if (inPanel()) logEvent("tidied", { n: n }); });
  }
  // at /24 the visitor's own lookups are re-filed: "(local)" becomes "(you)"
  function refileLookups() {
    var out = $("lk-out"); if (!out) return;
    Array.prototype.forEach.call(out.querySelectorAll("li.rec"), function (li) { if (/\(local\)/.test(li.textContent)) li.textContent = li.textContent.replace("(local)", "(you)"); });
  }
  function startLog() {
    if (logStarted) return;
    logStarted = true;
    var t = T(), m = mask();
    // reconstruct earlier stages when started mid-run (?t= / ?beat=)
    MASKS.forEach(function (mm) {
      if (mm > m || mm >= 30) return;
      var sk = "s" + mm, list = get("log." + sk) || [];
      var start = MASK_T[mm], end = mm === m ? t : MASK_T[MASKS[MASKS.indexOf(mm) + 1]];
      var n = mm === m ? Math.floor(Math.max(0, end - start) / 4.5) : list.length;
      for (var k = 0; k < n && (logIdx[sk] || 0) < list.length; k++) scriptedNext(sk, true);
      if (mm >= 8) { var arps = Math.floor(Math.max(0, end - start) / 8.5); for (var j = 0; j < arps; j++) arpNext(sk, true); }
    });
    logStage = stageKey(m);
    if (recall("via", null)) logEvent("via", {});
    nextLogT = t + (t < 31 ? 0.4 : rand(3, 6));
    nextArpT = t + rand(7, 10);
  }
  function logTick() {
    if (!logStarted) return;
    var t = T(), m = mask(), sk = stageKey(m);
    if (m >= 30) return; // s30/s32 log and ARP lines are printed in the terminal by the scenes
    if (sk !== logStage) { logStage = sk; nextLogT = t + 0.6; nextArpT = t + rand(4, 8); }
    if (nextLogT != null && t >= nextLogT) {
      scriptedNext(sk);
      nextLogT = t + rand(3, 6);
    }
    if (m >= 8 && nextArpT != null && t >= nextArpT) {
      arpNext(sk);
      nextArpT = t + rand(7, 10);
    }
  }

  /* ==== Routing + NAT ==== */
  function renderRouting() {
    var tb = document.querySelector("#rt-table tbody");
    if (tb) {
      tb.textContent = "";
      var rows = staged(get("rt.rows")) || [], cols = get("rt.cols") || [];
      rows.forEach(function (r) {
        var tr = el("tr");
        if (r[5]) { tr.setAttribute("data-label", r[5]); tr.className = "rt-" + r[5]; }
        for (var i = 0; i < 5; i++) {
          var v = fmtRaw(r[i]);
          var td = el("td", null, v == null ? "" : v);
          if (cols[i]) td.setAttribute("data-label", cols[i]);
          tr.appendChild(td);
        }
        tb.appendChild(tr);
      });
    }
    var note = $("rt-note");
    if (note && !note.hasAttribute("data-l")) {
      var n = mask() >= 30 ? line("rt.noteS30") : line("rt.note");
      if (n) note.textContent = n;
    }
  }
  function renderNat() {
    var card = $("st-nat"); if (!card) return;
    var k = card.querySelector(".k"), v = card.querySelector(".v");
    var title = line("st.nat.title"), val = mask() >= 16 ? fmt(get("st.nat")) : null;
    if (k && !k.hasAttribute("data-l") && title) k.textContent = title;
    if (v && !v.hasAttribute("data-l")) v.textContent = val || "";
  }

  /* ==== run lifecycle ==== */
  var runId = 0;
  function resetRun() {
    runId++;
    dropped = {}; dropping = {}; firstDropToast = false; tappedThisRun = false;
    lastRenewT = Math.max(30, T()); renewSlots = -1; bigDone = false; expiring = null; renewIdx = 0;
    dgRuns = {}; dgAutoDone = false; dgBusy = false; lkBusy = false; lkAutoDone = false;
    logIdx = {}; arpIdx = {}; logStarted = false; nextLogT = null; nextArpT = null; edited = false; logStage = null;
    unaskedShown = {}; unaskedNoted = false; dhcpOffsets = {}; recentLines = [];
    var box = logBox(); if (box) box.textContent = "";
    var o = $("lk-out"); if (o) o.textContent = "";
    var d = $("dg-out"); if (d) d.textContent = "";
    var b = $("lease-big"); if (b) b.textContent = "";
  }
  function renderAll() {
    renderDevices(); renderLease(); renderRecent(); renderRouting(); renderNat();
  }
  function connected() { return (typeof US.sinceConnect === "function" && US.sinceConnect() > 0) || (US.state && US.state !== "portal"); }
  function ensureStarted() {
    if (!connected()) return;
    if (US.state === "portal" || US.state === "disconnected") return;
    startLog();
    scheduleDrops();
    if (renewSlots < 0) renewSlots = Math.max(0, Math.floor((T() - 34) / 45));
  }
  function boot() {
    renderAll();
    dgSetMode(dgMode);
  }

  /* ==== DOM wiring (delegated, so markup can arrive in any order) ==== */
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.id) return;
    if (f.id === "lk-form") { e.preventDefault(); var i = $("lk-input"); var v = i ? i.value : ""; lkSubmit(v, false); if (i) i.value = ""; }
    else if (f.id === "dg-form") { e.preventDefault(); var t = $("dg-target"); dgRun(t ? t.value : "", false); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var dev = t.closest("#dev-list li.device");
    if (dev) { openDetail(dev.getAttribute("data-id")); return; }
    if (t.closest("#dd-close")) { closeDetail(); return; }
    var mode = t.closest("#dg-modes [data-mode]");
    if (mode) { dgSetMode(mode.getAttribute("data-mode")); return; }
    var dlg = $("dev-detail");
    if (dlg && t === dlg) closeDetail(); // backdrop click
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (!t) return;
    if (t.id === "lk-input") { lkKey(e); return; }
    if ((e.key === "Enter" || e.key === " ") && t.matches && t.matches("#dev-list li.device")) {
      e.preventDefault(); openDetail(t.getAttribute("data-id"));
    }
  });
  document.addEventListener("input", function (e) { if (e.target && e.target.id === "lk-input") lkInput(); });

  /* ==== events ==== */
  var lastSecond = -1;
  US.on("boot", boot);
  US.on("connect", function () { resetRun(); renderAll(); });
  US.on("state", function (d) {
    var s = d && d.state;
    if (s === "portal") return;
    if (s === "disconnected") { runId++; return; }
    ensureStarted();
    renderAll();
  });
  US.on("mask", function (d) {
    var m = d && d.mask;
    renderAll();
    scheduleDrops();
    if (m === 16) editEarlier();
    if (m === 24) refileLookups();
  });
  US.on("tick", function () {
    if (!logStarted) ensureStarted();
    if (logStarted) scheduleDrops();
    var tt = T();
    // autoplays (a mid-run start past their moment does not fire them)
    if (!lkAutoDone && tt >= 122 && tt < 136 && inPanel()) { lkAutoDone = "queued"; lkAutoplay(); }
    if (!dgAutoDone && tt >= 195 && tt < 208 && inPanel()) { dgAutoDone = "queued"; dgAutoplay(); }
    logTick();
    leaseTick();
    var s = Math.floor(T());
    if (s !== lastSecond) {
      lastSecond = s;
      if (inPanel()) {
        renderLease();
        var tab = currentTab();
        if (tab === "dhcp") renderDhcp();
        if (tab === "devices" && s % 5 === 0) {
          var self = document.querySelector('#dev-list li.device[data-id="self"] .dev-name');
          if (self) { var d = null; devList().forEach(function (x) { if (x.id === "self") d = x; }); if (d) self.textContent = devName(d); }
        }
      }
    }
  });
  function logToBottom() { var box = logBox(); if (box) try { box.scrollTop = box.scrollHeight; } catch (e) {} }
  US.on("tab", function (d) {
    var tab = d && d.tab; logEvent("tab", { tabSlug: tab });
    if (tab === "dhcp") renderDhcp(); if (tab === "lookup") renderRecent();
    if (tab === "log") { logToBottom(); after(60, logToBottom); }
    if (tab === "diag" && T() >= 185) dgSetMode("trace");
  });
  US.on("lookup", function (d) { if (d && d.q) logEvent("lookup", { q: ascii(cut(d.q, 48)) }); });
  US.on("trace", function (d) { if (d) logEvent("trace", { t: d.target }); });
  US.on("device", function (d) { if (d) logEvent("device", { deviceName: ascii(d.name || "") }); });
  US.on("deleted", function (d) { if (mask() >= 16 && d && d.text) logEvent("deleted", { deleted: ascii(d.text) }); });
  US.on("hesitate", function (d) { if (d && d.seconds != null) logEvent("hesitate", { hesNow: d.seconds < 10 ? (Math.round(d.seconds * 10) / 10).toFixed(1) : Math.round(d.seconds) }); });
  var lastMashLog = -1e9;
  US.on("mash", function (d) { var n = nowMs(); if (d && n - lastMashLog > 5000) { lastMashLog = n; logEvent("mash", { mash: d.rate }); } });
  US.on("away", function () { logEvent("away", {}); });
  US.on("back", function (d) { logEvent("back", { away: d && d.away != null ? Math.round(d.away) : 0 }); });
  US.on("idle", function (d) { if (d && d.seconds >= 25 && d.seconds < 26) logEvent("idle", { idle: Math.round(d.seconds) }); });
  US.on("lease", function (d) { logEvent("lease", { renewals: d && d.renewals }); });
  US.on("face", function (d) { var p = d && d.phase; if (p === "down") logEvent("faceDown", {}); if (p === "refused") logEvent("faceRefused", {}); });
  US.on("sound", function (d) { if (d && d.on) logEvent("soundOn", {}); });
  US.on("disconnect", function () { runId++; dgBusy = false; lkBusy = false; });
  US.on("forget", function () { unaskedShown = {}; unaskedNoted = false; });
  US.on("remember", function (d) {
    if (!d) return;
    if (d.key === "name" || d.key === "day") { renderRecent(); if (d.key === "name") renderDevices(); }
  });

  /* ==== public ==== */
  US.tools = US.tools || {};
  US.tools.resolve = resolve;
  US.tools.bucket = function (q) { return bucketOf(q); };
  US.tools.lookup = function (q, opt) {
    var r = resolve(q, opt);
    if (String(q || "").trim()) recordLookup(q, r.bucket, r.stage);
    return r;
  };
  US.tools.slug = slug;
  US.tools.editLastQuery = editLastQuery;
  US.tools.renderAll = renderAll;

  if (document.readyState !== "loading") { try { boot(); } catch (e) {} }
})();
