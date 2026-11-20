/* UNDERSTORY v2 — sense.js (Builder C)
   Input feed, typed-then-deleted capture (memory only — never persisted),
   hesitation, terms hesitation/scroll, masher detection, device class,
   name blocklist, and the B09 orientation API (US.sense.orientation).
   Nothing here writes to storage or inserts HTML. */
(function () {
  "use strict";
  var US = window.US;
  if (!US || typeof US.on !== "function") return;
  var DEBUG = !!US.debug;

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function $(id) { return document.getElementById(id); }
  function recall(k, d) { try { return typeof US.recall === "function" ? US.recall(k, d) : d; } catch (e) { return d; } }
  function remember(k, v) { try { if (typeof US.remember === "function") US.remember(k, v); } catch (e) {} }
  function emit(e, d) { try { US.emit(e, d); } catch (err) { if (DEBUG) try { console.warn(err); } catch (x) {} } }
  function input(kind) { try { if (typeof US.input === "function") US.input(kind); } catch (e) {} }
  function sec1(ms) { var s = ms / 1000; return s < 10 ? Math.round(s * 10) / 10 : Math.round(s); }
  function content() { return US.content || window.US_CONTENT || {}; }
  US.sense = US.sense || {};
  US.sense.rateLimitedUntil = 0;

  /* ==== Device class ==== */
  function classify() {
    var coarse = false;
    try { coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch (e) {}
    var w = (window.screen && screen.width) || window.innerWidth, h = (window.screen && screen.height) || window.innerHeight;
    var d = coarse ? (Math.min(w, h) < 600 ? "phone" : "tablet") : "desktop";
    US.device = d;
    try { document.documentElement.setAttribute("data-device", d); } catch (e) {}
    return d;
  }
  classify();
  US.sense.classify = classify;

  /* ==== Name blocklist (orchestrator decision 2) ==== */
  function fold(s) {
    return String(s || "").toLowerCase()
      .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a")
      .replace(/5/g, "s").replace(/7/g, "t").replace(/@/g, "a").replace(/\$/g, "s").replace(/!/g, "i");
  }
  function isBlocked(raw) {
    var nb = content().nameBlock; if (!nb || !raw) return false;
    var f = fold(raw), joined = f.replace(/[^a-z]/g, "");
    var words = f.split(/[^a-z]+/).filter(Boolean);
    var c = nb.contains || [], x = nb.exact || [];
    for (var i = 0; i < c.length; i++) if (joined.indexOf(c[i]) >= 0) return true;
    for (var j = 0; j < x.length; j++) { if (joined === x[j] || words.indexOf(x[j]) >= 0) return true; }
    return false;
  }
  US.sense.isBlocked = isBlocked;
  US.sense.cleanName = function (raw) { return isBlocked(raw) ? "Guest" : raw; };
  // Swap before the portal's own submit handler reads the field (capture phase runs first).
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f && f.id === "portal-form") {
      var n = $("portal-name");
      if (n && isBlocked(n.value)) n.value = "Guest";
    }
  }, true);
  US.on("remember", function (d) {
    if (d && d.key === "name" && d.val && d.val !== "Guest" && isBlocked(d.val)) remember("name", "Guest");
  });

  /* ==== Input feed + masher ==== */
  var downs = [], lastMove = 0, lastMashEmit = -1e9, burstMax = 0;
  function speed() { return +US.speed || 1; }
  function down(kind) {
    var now = nowMs();
    downs.push(now);
    while (downs.length && now - downs[0] > 1000) downs.shift();
    var rate = downs.length;
    if (rate >= 13) {   // fast typists reach 10/s; only a real burst counts as mashing
      if (rate > burstMax) burstMax = rate;
      if (rate > (+recall("mashMax", 0) || 0)) remember("mashMax", rate);
      if (now - lastMashEmit > 5000) {
        lastMashEmit = now;
        remember("mashCount", (+recall("mashCount", 0) || 0) + 1);
        US.sense.rateLimitedUntil = now + 2000 / speed();
        emit("mash", { rate: rate });
      }
    }
    input(kind);
  }
  document.addEventListener("keydown", function (e) { if (!e.repeat) down("key"); else input("key"); }, { passive: true, capture: true });
  document.addEventListener("pointerdown", function () { down("pointer"); }, { passive: true, capture: true });
  document.addEventListener("touchstart", function () { input("touch"); }, { passive: true, capture: true });
  document.addEventListener("wheel", function () { input("wheel"); }, { passive: true, capture: true });
  document.addEventListener("pointermove", function () {
    var now = nowMs();
    if (now - lastMove >= 500) { lastMove = now; input("move"); }
  }, { passive: true, capture: true });
  document.addEventListener("scroll", function (e) {
    var t = e.target;
    if (t && t.id === "terms-list") {
      var max = t.scrollHeight - t.clientHeight;
      if (max > 0) {
        var f = Math.min(1, Math.max(0, t.scrollTop / max));
        if (f > (+recall("termsScroll", 0) || 0)) remember("termsScroll", Math.round(f * 100) / 100);
      }
    }
    // scroll itself is not counted as input: pages scroll programmatically (log auto-scroll);
    // real scrolling already arrives as wheel / touch / key input.
  }, { passive: true, capture: true });

  /* ==== Typed-then-deleted + hesitation on [data-sense] fields ==== */
  var fields = (typeof WeakMap === "function") ? new WeakMap() : null;
  function st(el) {
    if (!fields) return el.__usSense || (el.__usSense = {});
    var s = fields.get(el); if (!s) { s = {}; fields.set(el, s); } return s;
  }
  function senseEl(t) { return t && t.getAttribute && t.hasAttribute("data-sense") ? t : null; }

  document.addEventListener("focusin", function (e) {
    var el = senseEl(e.target); if (!el) return;
    var s = st(el);
    s.focusAt = nowMs(); s.typed = false; s.peak = String(el.value || ""); s.lastLen = s.peak.length;
    var field = el.getAttribute("data-sense");
    s.field = field;
  });
  document.addEventListener("input", function (e) {
    var el = senseEl(e.target); if (!el) return;
    var s = st(el), field = el.getAttribute("data-sense"), v = String(el.value || "");
    if (s.focusAt == null) { s.focusAt = nowMs(); s.peak = ""; }
    if (!s.typed) {
      s.typed = true;
      var ms = nowMs() - s.focusAt, secs = sec1(ms);
      if (ms >= 1000) {
        var by = recall("hesByField", {}) || {}, copy = {};
        for (var k in by) copy[k] = by[k];
        if (!(copy[field] >= secs)) copy[field] = secs;
        remember("hesByField", copy);
        if (secs > (+recall("hesMax", 0) || 0)) remember("hesMax", secs);
      }
      if (ms >= 6000) emit("hesitate", { field: field, seconds: secs });
    }
    // A deletion run lasts until typing resumes, the form is submitted, the field loses focus,
    // or 1.2 s pass; then the whole span that disappeared is recorded once.
    var prevLen = s.lastLen == null ? (s.peak || "").length : s.lastLen;
    s.lastLen = v.length;
    clearTimeout(s.delTimer);
    if (v.length > prevLen) {
      finalize(el, v.slice(0, prevLen));
      if (v.length > (s.peak || "").length || (s.peak || "").indexOf(v) !== 0) s.peak = v;
    } else if (v.length < (s.peak || "").length) {
      s.delTimer = setTimeout(function () { finalize(el, String(el.value || "")); }, 1200);
    }
  });
  function finalize(el, v) {
    var s = st(el), peak = s.peak || "";
    clearTimeout(s.delTimer);
    if (v.length <= peak.length - 3) {
      var del = (peak.indexOf(v) === 0 ? peak.slice(v.length) : peak).trim();
      if (del.length >= 3 && /\p{L}/u.test(del) && !isBlocked(del)) {
        del = del.slice(0, 32).trim();
        // the director keeps the longest as `deleted` and appends to `deletedAll` (memory only)
        emit("deleted", { text: del, field: el.getAttribute("data-sense") });
      }
    }
    s.peak = v;
  }
  document.addEventListener("focusout", function (e) {
    var el = senseEl(e.target); if (el) finalize(el, String(el.value || ""));
  });
  // a submit closes any open deletion run, then starts a fresh peak for that form's fields
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f || !f.querySelectorAll) return;
    Array.prototype.forEach.call(f.querySelectorAll("[data-sense]"), function (el) {
      finalize(el, String(el.value || ""));
      var s = st(el); s.peak = ""; s.lastLen = 0; s.typed = false; s.focusAt = nowMs();
    });
  }, true);

  /* ==== Terms hesitation ==== */
  var portalShownAt = nowMs(), termsMeasured = false;
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.id === "portal-terms" && t.checked && !termsMeasured && US.state !== "coda" && US.state !== "manifest") {
      termsMeasured = true;
      remember("hesTerms", sec1(nowMs() - portalShownAt));
    }
  });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("#portal-terms-open") && (US.state === "portal" || !US.state)) remember("termsOpened", true);
  });
  US.on("state", function (d) {
    if (d && d.state === "portal" && d.prev && d.prev !== "portal") { portalShownAt = nowMs(); termsMeasured = false; }
    if (d && d.state !== "face") orientation.stop();
  });
  US.on("connect", function (d) {
    // auto-Guest: the 60 s value (flagged); a return visit with the box pre-ticked keeps the last value
    if (!termsMeasured && d && d.nameAuto) { termsMeasured = true; remember("hesTerms", 45); remember("termsAuto", true); }
  });

  /* ==== Orientation (B09 only) ==== */
  function forced() {
    try { var m = location.search.match(/[?&]face=(desk|ios|android|none)\b/); return m ? m[1] : null; } catch (e) { return null; }
  }
  var orientation = {
    _on: false, _cb: null, _down: false, _since: 0, _cand: null, _got: false, _zSign: 0, _timer: null, _sim: null,
    available: function () {
      var f = forced();
      if (f === "android" || f === "ios") return true;
      if (f === "desk" || f === "none") return false;
      return ("DeviceOrientationEvent" in window) && US.device !== "desktop";
    },
    needsPermission: function () {
      var f = forced();
      if (f === "ios") return true;
      if (f) return false;
      if (typeof window.DeviceOrientationEvent === "undefined" || typeof window.DeviceOrientationEvent.requestPermission !== "function") return false;
      // Some Chromium builds expose requestPermission but never prompt; only iOS/iPadOS Safari asks the visitor.
      var ua = navigator.userAgent || "";
      return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
    },
    // 'ios' | 'android' | 'desk' — which B09 path to show
    path: function () {
      if (!orientation.available()) return "desk";
      return orientation.needsPermission() ? "ios" : "android";
    },
    // must be called from the button's click handler
    request: function () {
      var f = forced();
      if (f === "ios") return Promise.resolve(true);
      if (!orientation.needsPermission()) return Promise.resolve(orientation.available());
      try {
        return window.DeviceOrientationEvent.requestPermission()
          .then(function (r) { return r === "granted"; })
          .catch(function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
    isDown: function () { return orientation._down; },
    // cb(isDown:boolean, info) on every change; cb(null, {state:"unavailable"}) if no sensor data arrives in 2 s
    start: function (cb) {
      orientation.stop();
      orientation._on = true; orientation._cb = cb; orientation._down = false; orientation._cand = null; orientation._got = false; orientation._zSign = 0; orientation._oriSeen = false;
      var f = forced();
      if (f === "android" || f === "ios") {
        // simulated face-down after 3 s (debug ?face=)
        orientation._got = true;
        orientation._sim = setTimeout(function () { orientation._set(true); }, 3000 / (+US.speed || 1));
        return;
      }
      window.addEventListener("deviceorientation", orientation._onOri);
      window.addEventListener("devicemotion", orientation._onMot);
      orientation._timer = setTimeout(function () {
        if (orientation._on && !orientation._got) {
          var c = orientation._cb; orientation.stop();
          if (c) try { c(null, { state: "unavailable" }); } catch (e) {}
        }
      }, 2000);
    },
    stop: function () {
      orientation._on = false;
      clearTimeout(orientation._timer); clearTimeout(orientation._sim);
      window.removeEventListener("deviceorientation", orientation._onOri);
      window.removeEventListener("devicemotion", orientation._onMot);
    },
    _first: function () {
      if (!orientation._got) { orientation._got = true; remember("faceSensorUsed", true); }
    },
    _cand_: function (isDown) {
      var now = nowMs();
      if (orientation._cand === null || orientation._cand.v !== isDown) orientation._cand = { v: isDown, t: now };
      if (isDown !== orientation._down && now - orientation._cand.t >= 600) orientation._set(isDown);
    },
    _set: function (v) {
      if (!orientation._on) return;
      orientation._down = v; orientation._since = nowMs();
      if (orientation._cb) try { orientation._cb(v, { state: v ? "down" : "up" }); } catch (e) {}
    },
    _onOri: function (e) {
      if (!orientation._on || e.beta == null) return;
      orientation._first();
      orientation._oriSeen = true;
      var b = +e.beta, g = +(e.gamma || 0);
      var isDown = Math.abs(b) > 150 || (Math.abs(Math.abs(b) - 180) < 35 && Math.abs(g) < 30);
      orientation._cand_(isDown);
    },
    _onMot: function (e) {
      if (!orientation._on) return;
      if (orientation._oriSeen) return; // orientation events win when both exist
      var a = e.accelerationIncludingGravity; if (!a || a.z == null) return;
      orientation._first();
      var z = +a.z;
      // sign conventions differ between browsers: remember the sign while held, face down is the opposite ±9.8
      if (!orientation._zSign && Math.abs(z) > 3) orientation._zSign = z > 0 ? 1 : -1;
      var ref = orientation._zSign || 1;
      if (Math.abs(z) > 8.3 && (z > 0 ? 1 : -1) === -ref) orientation._cand_(true);
      else if (Math.abs(z) < 7 || (z > 0 ? 1 : -1) === ref) orientation._cand_(false);
    }
  };
  US.sense.orientation = orientation;
  US.on("beat", function (d) { if (d && d.id !== "b09") orientation.stop(); });
  US.on("disconnect", function () { orientation.stop(); });
})();
