/* UNDERSTORY v2 — guide.js
   The router's "Setup assistant": one bar at the bottom of the panel that
   always says what is happening, what (if anything) to do, and how long until
   the next thing happens by itself. It also owns the small affordances around
   it: badge dots on tabs with new activity, a slow pulse on the one control
   that matters right now, and tappable suggestions in Lookup and Diagnostics.
   Early it is bland firmware help; as the mask narrows the same bar is where
   the voice takes over ("You don't need the other tabs.").
   All visitor text goes in through textContent. Never throws. */
(function () {
  'use strict';
  var US = window.US;
  if (!US || typeof US.on !== 'function') return;
  var D = document, html = D.documentElement;
  function $(id) { return D.getElementById(id); }
  function L(path, extra) { try { return US.line(path, extra); } catch (e) { return null; } }
  function G(path) { try { return US.get(path); } catch (e) { return undefined; } }
  function rec(k, d) { try { return US.recall(k, d); } catch (e) { return d; } }
  function vis(el) { return !!(el && !el.hidden && el.offsetParent !== null); }

  var bar = null, txtEl = null, eyeEl = null, actEl = null, nextEl = null, secsEl = null, ringEl = null;
  var cur = { key: null, text: null, act: null };
  var aside = null;                  // a short-lived remark that overrides the step text
  var pulsed = [];                   // elements this module is pulsing
  var BEAT_TS = [70, 105, 150, 185, 220, 245];

  /* ==== which step is it ==== */
  function lookups() { return (rec('lookups', []) || []).length; }
  function traces() { return (rec('traces', []) || []).length; }
  function wizardOpen() { var w = $('wizard'), i = $('wiz-input'); return !!(w && !w.hidden && i && !i.disabled); }
  function firstDevice() {
    var rows = D.querySelectorAll('#dev-list li.device:not([data-self]):not(.dropping)');
    for (var i = 0; i < rows.length; i++) if (!/understory/.test(rows[i].textContent)) return rows[i];
    return rows[0] || null;
  }
  var lkFocusAt = null;
  function lookupHesitating() {
    var i = $('lk-input');
    return !!(i && D.activeElement === i && !i.value && lkFocusAt != null && US.now() - lkFocusAt >= 6 && US.mask < 16);
  }
  function step(T) {
    var s = null;
    var add = function (from, to, o) { if (T >= from && T < to && (!o.cond || o.cond())) s = o; };
    var soundOff = !rec('sound', false) && !!(US.audio && US.audio.enable);
    add(34, 40, { key: 'hello', act: soundOff ? { label: L('guide.steps.soundAct') || 'Turn on', sound: true } : null });
    add(36, 40, { key: 'sound', cond: function () { return soundOff; }, act: { label: L('guide.steps.soundAct') || 'Turn on', sound: true } });
    add(40, 56, { key: 'settling' });
    add(40, 64, { key: 'wizard', tab: 'status', cond: wizardOpen, pulse: function () { return $('wiz-input'); }, act: { show: 'wizard' } });
    add(56, 61, { key: 'check', tab: 'status', cond: function () { return !wizardOpen(); } });
    add(61, 70, { key: 'checked', tab: 'status', cond: function () { return !wizardOpen(); } });
    add(64, 70, { key: 'nextDevices', next: true, act: { tab: 'devices' } });
    add(70, 84, { key: rec('deviceTapped') ? 'devicesTapped' : 'devices', tab: 'devices', pulse: function () { return rec('deviceTapped') ? null : firstDevice(); } });
    add(84, 99, { key: 'drops', tab: 'devices', pulse: function () { return rec('deviceTapped') ? null : firstDevice(); } });
    add(99, 105, { key: 'nextLookup', next: true, act: { tab: 'lookup' } });
    add(105, 150, { key: 'lookup', tab: 'lookup', pulse: function () { return lookups() ? null : $('lk-input'); } });
    add(105, 144, { key: 'lookupHes', tab: 'lookup', cond: lookupHesitating });
    add(122, 130, { key: 'lookupAuto', tab: 'lookup', cond: function () { return !lookups(); } });
    add(105, 150, { key: 'lookupDone', tab: 'lookup', cond: function () { return lookups() > 0; } });
    add(144, 150, { key: 'nextLog', next: true });
    add(150, 185, { key: 'log', tab: 'log' });
    add(156, 168, { key: 'logDay', tab: 'log', cond: function () { return !!rec('day') && rec('day') !== 'fine'; } });
    add(168, 180, { key: 'logQuery', tab: 'log', cond: function () { return !!rec('lastQuery'); } });
    add(180, 185, { key: 'nextTrace', next: true, act: { tab: 'diag' } });
    add(185, 220, { key: 'trace', tab: 'diag', pulse: function () { return traces() ? null : $('dg-run'); } });
    add(195, 207, { key: 'traceAuto', tab: 'diag', cond: function () { return !traces(); } });
    add(207, 215, { key: 'traceDone', tab: 'diag' });
    add(185, 215, { key: 'traceDone', tab: 'diag', cond: function () { return traces() > 0 && !traceBusy(); } });
    add(185, 220, { key: 'tracing', tab: 'diag', cond: traceBusy });
    add(215, 220, { key: 'nextRoutes', next: true });
    add(220, 230, { key: 'routing', tab: 'routing' });
    add(230, 238, { key: 'dhcp', tab: 'dhcp' });
    add(238, 241, { key: 'renewed', tab: 'dhcp' });
    add(241, 246, { key: US.device === 'desktop' ? 'nextFaceDesk' : 'nextFace', next: true });
    return s;
  }
  function traceBusy() { var r = $('dg-run'); return !!(r && r.getAttribute('aria-busy') === 'true'); }
  function nextBeatT(T) { for (var i = 0; i < BEAT_TS.length; i++) if (BEAT_TS[i] > T + 0.01) return BEAT_TS[i]; return null; }
  function prevBeatT(T) { var p = 34; for (var i = 0; i < BEAT_TS.length; i++) if (BEAT_TS[i] <= T) p = BEAT_TS[i]; return p; }
  function tabLabel(slug) { return L('nav.' + slug) || slug; }

  /* ==== render ==== */
  function setPulse(els) {
    pulsed.forEach(function (e) { if (els.indexOf(e) < 0) e.removeAttribute('data-pulse'); });
    els.forEach(function (e) { if (e && !e.hasAttribute('data-pulse')) e.setAttribute('data-pulse', ''); });
    pulsed = els.filter(Boolean);
  }
  function render() {
    if (!bar) return;
    var show = US.state === 'panel' && US.T() >= 34;
    if (bar.hidden === show) bar.hidden = !show;
    html.toggleAttribute('data-guide', show);
    if (!show) { setPulse([]); return; }
    var T = US.T(), s = step(T), text = null, act = null, pulseEls = [];
    if (s) {
      var key = s.key, tab = s.tab;
      if (tab && tab !== US.currentTab) {
        text = L('guide.steps.elsewhere', { tabLabel: tabLabel(tab) });
        act = { label: L('guide.open') || 'Open', tab: tab };
      } else {
        text = L('guide.steps.' + key, key === 'drops' ? { shown: String(D.querySelectorAll('#dev-list li.device:not(.dropping)').length) } : null);
        act = s.act || null;
        if (act && act.tab && act.tab === US.currentTab) act = null;
        if (s.pulse) { var p = s.pulse(); if (p && vis(p)) pulseEls.push(p); }
      }
    }
    if (aside && US.now() < aside.until) { text = aside.text; act = null; }
    else aside = null;
    if (text == null) text = cur.text || '';
    setPulse(pulseEls);
    if (text !== cur.text) { txtEl.textContent = text; cur.text = text; bar.classList.remove('turn'); void bar.offsetWidth; bar.classList.add('turn'); }
    var eb = L('guide.eyebrow') || '';
    if (eyeEl.textContent !== eb) eyeEl.textContent = eb;
    var actKey = act ? (act.label + '|' + (act.tab || '') + '|' + (act.sound ? 's' : '') + '|' + (act.show || '')) : '';
    if (actKey !== (cur.actKey || '')) {
      cur.actKey = actKey; cur.act = act;
      actEl.hidden = !act;
      if (act) actEl.textContent = act.label || (act.tab ? L('guide.open') : L('guide.show')) || 'Open';
    }
    // the next thing that will happen by itself
    var nT = nextBeatT(T);
    if (nT != null) {
      var secs = Math.max(0, Math.ceil(nT - T)), from = prevBeatT(T);
      var frac = Math.max(0, Math.min(1, (T - from) / Math.max(1, nT - from)));
      var lbl = L('guide.next', { secs: secs }) || '';
      if (secsEl.textContent !== lbl) secsEl.textContent = lbl;
      if (ringEl) ringEl.style.strokeDashoffset = String(Math.round((1 - frac) * 1000) / 10);
      nextEl.hidden = false;
    } else nextEl.hidden = true;
  }
  function doAct() {
    var a = cur.act; if (!a) return;
    if (a.sound) { try { if (US.audio && US.audio.enable) US.audio.enable({ test: true }); } catch (e) { /* */ } US.setSound(true); }
    if (a.tab) US.tab(a.tab, { auto: false, reveal: true });
    if (a.show) {
      var el = $(a.show);
      if (el) { try { el.scrollIntoView({ block: 'center', behavior: US.reduced ? 'auto' : 'smooth' }); } catch (e) { /* */ } var f = el.querySelector('input'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* */ } }
    }
    render();
  }
  US.guideAside = function (text, secs) { if (!text) return; aside = { text: text, until: US.now() + (secs || 7) }; render(); };

  /* ==== badges: activity on tabs the visitor isn't looking at ==== */
  function badge(slug) {
    if (US.state !== 'panel' || slug === US.currentTab) return;
    var b = D.querySelector('#tabs [data-tab="' + slug + '"]');
    if (b && !b.hasAttribute('data-new')) b.setAttribute('data-new', '');
  }
  function observe(id, slug, filter) {
    var el = $(id); if (!el || typeof MutationObserver !== 'function') return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1 && (!filter || filter(added[j]))) { badge(slug); return; }
      }
    }).observe(el, { childList: true });
  }

  /* ==== suggestions (tap to try) ==== */
  function submitWith(inputId, formId, q) {
    var i = $(inputId), f = $(formId); if (!i || !f) return;
    i.value = q;
    try { i.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* */ }
    try { if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch (e) { /* */ }
  }
  function chips(boxId, labelId, labelPath, chipsPath, inputId, formId) {
    var box = $(boxId), lab = $(labelId); if (!box) return;
    var list = US.staged ? US.staged(chipsPath) : G(chipsPath);
    if (!Array.isArray(list)) list = [];
    var l = L(labelPath); if (lab && l != null) lab.textContent = l;
    box.textContent = '';
    list.forEach(function (c) {
      var q = US.fmt(c); if (!q) return;
      var b = D.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = q;
      b.addEventListener('click', function () { submitWith(inputId, formId, q); });
      box.appendChild(b);
    });
  }
  function renderTools() {
    chips('lk-chips', 'lk-try-label', 'lk.tryLabel', 'lk.tryChips', 'lk-input', 'lk-form');
    chips('dg-chips', 'dg-try-label', 'dg.tryLabel', 'dg.tryChips', 'dg-target', 'dg-form');
    var li = $('lk-input'); var ph = L('lk.placeholderTry'); if (li && ph) li.placeholder = ph;
    var di = $('dg-target'); var dp = L('dg.placeholderTrace'); if (di && dp && US.T() >= 185) di.placeholder = dp;
  }

  /* ==== noticing: the visitor keeps going back to one tab ==== */
  var manual = {}, revisitSaid = 0, revisitDone = {};
  function onTab(d) {
    if (!d || d.auto) return;
    manual[d.tab] = (manual[d.tab] || 0) + 1;
    if (US.mask >= 16 && manual[d.tab] >= 3 && !revisitDone[d.tab] && revisitSaid < 2) {
      revisitDone[d.tab] = true; revisitSaid++;
      US.guideAside(L('guide.steps.revisit', { tabLabel: tabLabel(d.tab) }), 7);
    }
  }

  /* ==== wiring ==== */
  US.on('boot', function () {
    bar = $('guide'); txtEl = $('guide-text'); eyeEl = $('guide-eyebrow'); actEl = $('guide-act');
    nextEl = $('guide-next'); secsEl = $('guide-secs'); ringEl = D.querySelector('#guide .gn-ring');
    if (!bar || !txtEl || !eyeEl || !actEl || !nextEl || !secsEl) { bar = null; return; }
    actEl.addEventListener('click', doAct);
    observe('lk-out', 'lookup');
    observe('dg-out', 'diag');
    observe('check-lines', 'status');
    observe('log-out', 'log', function (li) { var k = li.getAttribute('data-kind') || ''; return (/^ev-|drop/.test(k) && k !== 'ev-tab') || (US.mask >= 8 && /\barp\b/.test(li.className)); });
    renderTools();
    var lk = $('lk-input');
    if (lk) { lk.addEventListener('focus', function () { lkFocusAt = US.now(); }); lk.addEventListener('blur', function () { lkFocusAt = null; }); lk.addEventListener('input', function () { lkFocusAt = US.now(); }); }
    US.every(250, render);
  });
  US.on('state', function () { render(); });
  US.on('tab', function (d) { onTab(d); if (d && (d.tab === 'lookup' || d.tab === 'diag')) renderTools(); render(); });
  US.on('mask', function (d) {
    renderTools();
    if (d && !d.jump && US.state === 'panel') {
      if (d.mask >= 16) badge('routing');
      if (d.mask === 16) badge('status');
    }
  });
  US.on('remember', function (d) { if (d && d.key === 'name') renderTools(); });
  US.on('drop', function () { badge('devices'); });
  US.on('lease', function (d) { if (d && (d.big || US.T() >= 230)) badge('dhcp'); });
  US.on('sound', function () { render(); });
})();
