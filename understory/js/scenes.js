/* UNDERSTORY v2 — scenes.js (Builder B)
   Pure choreography on top of the director: portal, handshake, status +
   wizard + connectivity check, face-down, false ending, terminal (B11–B12),
   last lookup, coda portal, manifest, disconnected screen, share UI.
   All user text goes in via textContent. Nothing here throws on a missing
   element, content key or sibling module. */
(function () {
  'use strict';
  var US = window.US;
  if (!US || typeof US.on !== 'function') return;
  var D = document, html = D.documentElement;
  var DEBUG = !!US.debug, warned = {};
  function warn(k, m) { if (!DEBUG || warned[k]) return; warned[k] = 1; try { console.warn('[scenes] ' + (m || k)); } catch (e) { /* */ } }
  function $(id) { var e = D.getElementById(id); if (!e) warn('el:' + id, 'missing #' + id); return e; }
  function L(path, extra) { try { return US.line(path, extra); } catch (e) { return null; } }
  function G(path) { try { return US.get(path); } catch (e) { return undefined; } }
  function F(str, extra) { try { return US.fmt(str, extra); } catch (e) { return null; } }
  function R(v, extra) { try { return US.resolve(v, extra); } catch (e) { return null; } }
  function txt(el, s) { if (typeof el === 'string') el = $(el); if (el && s != null) el.textContent = s; }
  function hide(el, on) { if (typeof el === 'string') el = $(el); if (el) el.hidden = !!on; }
  function now() { return US.now(); }
  function after(ms, fn) { return US.after(ms, fn); }
  function arr(path) { var v = G(path); return Array.isArray(v) ? v : []; }
  function name() { return F('{name}') || 'Guest'; }
  function on(id, evt, fn) { var e = D.getElementById(id); if (e) e.addEventListener(evt, fn); else warn('el:' + id, 'missing #' + id); }
  function mk(tag, cls, text) { var e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var S = US.scenes = US.scenes || {};
  S.blanked = false;

  /* ================================================================ portal */
  var portal = { timers: [], connecting: false, noteBase: '', noteHint: '', tagIdx: 0, guests: 4294967294 };
  function portalNote() {
    var n = [portal.noteBase, portal.noteHint].filter(Boolean).join(' ');
    txt('portal-note', n);
  }
  function renderGuests() {
    US.live.portalGuests = US.group(portal.guests);
    txt('portal-guests', L('portal.guests'));
  }
  function driftGuests() {
    portal.timers.push(after(2000 + Math.random() * 4000, function () {
      if (US.state !== 'portal') return;
      portal.guests = Math.min(4294967294, portal.guests + Math.floor(Math.random() * 7) - 3);
      renderGuests();
      driftGuests();
    }));
  }
  function rotate(path, elId, store) {
    var list = arr(path);
    if (!list.length) return null;
    store.tagIdx = 0;
    txt(elId, F(list[0]));
    return US.every(5000, function () {
      store.tagIdx = (store.tagIdx + 1) % list.length;
      var t = F(list[store.tagIdx]);
      if (t != null) txt(elId, t);
    });
  }
  function termsLabel(key) {
    var row = D.getElementById('portal-terms-row');
    var box = row && (row.querySelector('.check-text') || row);
    var s = L(key);
    if (box && s) US.setBracket(box, s);
  }
  function portalBoot() {
    hide('portal-stay', true);
    hide('wizard', true);
    hide('check', true);
    termsLabel('portal.termsLabel');
    var nm = D.getElementById('portal-name');
    if (nm) nm.placeholder = L('portal.namePlaceholder') || nm.placeholder;
    portal.timers.push(rotate('portal.taglines', 'portal-tagline', portal));
    renderGuests();
    driftGuests();
    if (US.isReturn()) {
      var t = L('ret.title'); if (t) txt('portal-title', t);
      txt('portal-return', (US.recall('visits', 1) >= 3 ? L('ret.sub3') : null) || L('ret.sub'));
      var c = D.getElementById('portal-connect'); if (c) { c.setAttribute('data-l-lock', ''); txt(c, L('ret.connect')); }
      var ti = D.getElementById('portal-title'); if (ti) ti.setAttribute('data-l-lock', '');
      if (nm && !US.recall('nameAuto') && US.recall('name')) nm.value = US.recall('name');
      var tb = D.getElementById('portal-terms'); if (tb) tb.checked = true;
    }
    var notes = [];
    if (US.recall('via')) notes.push(L('portal.via'));
    if (US.recall('from')) notes.push(L('portal.from'));
    portal.noteBase = notes.filter(Boolean).join(' ');
    portalNote();
    portal.timers.push(after(20000, function () { if (US.state === 'portal' && !portal.connecting) { portal.noteHint = L('portal.idle20') || ''; portalNote(); } }));
    portal.timers.push(after(40000, function () { if (US.state === 'portal' && !portal.connecting) { portal.noteHint = L('portal.idle40') || ''; portalNote(); } }));
    portal.timers.push(after(60000, function () { if (US.state === 'portal' && !portal.connecting) tryConnect(true); }));
  }
  function portalErr(key) { txt('portal-error', key ? L(key) : ''); }
  function tryConnect(auto) {
    if (portal.connecting || US.connected()) return;
    var nameEl = D.getElementById('portal-name'), termsEl = D.getElementById('portal-terms'), soundEl = D.getElementById('portal-sound');
    var raw = nameEl ? String(nameEl.value || '') : '';
    var first = raw.trim().split(/\s+/)[0] || '';
    var nm = US.cleanName(raw);
    if (!auto) {
      if (!nm) { portalErr('portal.errName'); if (nameEl) nameEl.focus(); return; }
      if (first.length > 24) { portalErr('portal.errLong'); if (nameEl) nameEl.focus(); return; }
      if (termsEl && !termsEl.checked) { portalErr('portal.errTerms'); return; }
    }
    portalErr(null);
    portal.connecting = true;
    var nameAuto = !nm;
    if (auto) {
      if (nameAuto) { portal.noteHint = L('portal.idle60') || ''; portalNote(); }
      if (termsEl && !termsEl.checked) {
        termsEl.checked = true;
        if (US.recall('hesTerms') == null || US.isReturn()) { US.remember('hesTerms', 60); US.remember('hesTermsAuto', true); }
      }
    }
    var sound = !auto && !!(soundEl && soundEl.checked);
    if (sound) US.setSound(true);          // inside the user's gesture
    var btn = D.getElementById('portal-connect');
    if (btn) { btn.setAttribute('data-l-lock', ''); txt(btn, L('portal.connecting')); btn.disabled = true; }
    if (nameEl) nameEl.readOnly = true;
    US.remember('name', nm || 'Guest');
    US.remember('nameAuto', nameAuto);
    if (nameEl && nm) nameEl.value = US.recall('name');
    after(auto ? 900 : 700, function () {
      US.emit('connect', { name: US.recall('name'), nameAuto: nameAuto, sound: sound });
    });
  }
  S.autoConnect = function () { portal.connecting = true; };
  function stopPortal() { portal.timers.forEach(function (id) { if (id) US.cancel(id); }); portal.timers = []; }

  /* --------------------------------------------------------- terms dialog */
  function openTerms() {
    var dlg = D.getElementById('terms'); if (!dlg) return;
    var coda = html.hasAttribute('data-coda');
    var cl = arr('terms.clauses');
    var lis = dlg.querySelectorAll('[data-clause]');
    for (var i = 0; i < lis.length; i++) {
      var n = (+lis[i].getAttribute('data-clause')) - 1, c = cl[n];
      if (c) txt(lis[i], coda ? (c.b || c.a) : c.a);
    }
    hide('terms-accept', coda);
    try { if (dlg.showModal && !dlg.open) dlg.showModal(); else dlg.setAttribute('open', ''); } catch (e) { dlg.setAttribute('open', ''); }
  }
  function closeTerms() {
    var dlg = D.getElementById('terms'); if (!dlg) return;
    try { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } catch (e) { dlg.removeAttribute('open'); }
  }

  /* ============================================================= handshake */
  function handshake() {
    var lines = arr('hs.lines').slice();
    if (US.isReturn()) {
      var r = arr('hs.linesReturn');
      if (r.length) lines.splice.apply(lines, [1, 2].concat(r));
    }
    var ol = D.getElementById('hs-lines'), sp = D.getElementById('hs-spinner');
    if (ol) ol.textContent = '';
    if (sp) { sp.classList.remove('done'); sp.removeAttribute('data-done'); }
    var k = 0;
    lines.forEach(function (l, i) {
      after(150 + i * 700, function () {
        var t = F(l); if (t == null || !ol) return;
        ol.appendChild(mk('li', null, t));
        k++;
      });
    });
    after(150 + lines.length * 700, function () { if (sp) { sp.classList.add('done'); sp.setAttribute('data-done', ''); } });
  }

  /* ================================================================ status */
  var ST_KEYS = ['internet', 'quality', 'ip', 'subnet', 'hosts', 'gateway', 'dns', 'public', 'uptime', 'firmware'];
  function renderStatus() {
    ST_KEYS.forEach(function (k) {
      var el = D.getElementById('st-' + k); if (!el) return;
      var v = L('st.' + k);
      if (v != null && el.textContent !== v) el.textContent = v;
    });
    var ssid = US.mask >= 32 ? F('{NAME}') : L('portal.ssid');
    var ps = D.getElementById('panel-ssid'); if (ps && ssid && ps.textContent !== ssid) ps.textContent = ssid;
  }
  var wiz = { done: false };
  function wizShow(late) {
    var w = D.getElementById('wizard'); if (!w) return;
    if (wiz.done || US.recall('day')) return;
    var q = (US.recall('prevDay') && L('wiz.qReturn')) || L('wiz.q');
    var qEl = D.getElementById('wiz-q'); if (qEl) { qEl.setAttribute('data-l-lock', ''); txt(qEl, q); }
    var inp = D.getElementById('wiz-input'); if (inp) { inp.placeholder = L('wiz.placeholder') || inp.placeholder; inp.disabled = false; }
    txt('wiz-msg', '');
    hide(w, false);
  }
  function wizClose(msgKey, delay, extra) {
    if (wiz.done) return;
    wiz.done = true;
    var m = msgKey ? L(msgKey, extra) : null;
    if (m) txt('wiz-msg', m);
    ['wiz-input', 'wiz-ok', 'wiz-skip'].forEach(function (id) { var e = D.getElementById(id); if (e) e.disabled = true; });
    after(delay, function () { hide('wizard', true); });
  }
  function wizSubmit() {
    if (wiz.done) return;
    var inp = D.getElementById('wiz-input');
    var raw = inp ? String(inp.value || '').trim() : '';
    if (!raw) { wizSkip(); return; }
    var day = US.cleanDay(raw);
    if (!day) { wizSkip(); return; }
    US.remember('day', day);
    US.remember('daySkipped', false);
    US.emit('said', { text: raw, field: 'day' });
    if (/\s/.test(raw)) {
      txt('wiz-msg', L('wiz.oneWord'));
      after(1400, function () { wiz.done = false; wizClose('wiz.thanks', 2600); });
      ['wiz-input', 'wiz-ok', 'wiz-skip'].forEach(function (id) { var e = D.getElementById(id); if (e) e.disabled = true; });
    } else wizClose('wiz.thanks', 2600);
  }
  function wizSkip() { if (wiz.done) return; US.remember('daySkipped', true); wizClose('wiz.skipped', 1600); }
  function check(late) {
    var c = D.getElementById('check'), ol = D.getElementById('check-lines'); if (!c || !ol) return;
    hide(c, false);
    ol.textContent = '';
    var lines = arr('check.lines');
    lines.forEach(function (l, i) {
      var put = function () { var t = F(l); if (t != null) ol.appendChild(mk('li', null, t)); };
      if (late) put(); else after(i * 1200, put);
    });
    if (!late) after(lines.length * 1200, function () { US.toast(L('check.toast')); });
  }

  /* =========================================================== face down */
  var face = null;
  function faceBtns(yesKey, noKey) {
    var y = D.getElementById('face-yes'), n = D.getElementById('face-no');
    if (y) { hide(y, !yesKey); if (yesKey) txt(y, L(yesKey)); y.disabled = false; }
    if (n) { hide(n, !noKey); if (noKey) txt(n, L(noKey)); n.disabled = false; }
  }
  function faceText(titleKey, bodyKey) {
    if (titleKey) txt('face-title', L(titleKey));
    if (bodyKey !== undefined) txt('face-body', bodyKey ? L(bodyKey) : '');
  }
  function faceDark(on) { hide('face-dark', !on); if (!on) txt('face-msg', ''); }
  function faceT(ms, fn) { var id = after(ms, function () { if (face && !face.finished) fn(); }); if (face) face.timers.push(id); return id; }
  function faceClear() { if (!face) return; face.timers.forEach(function (id) { US.cancel(id); }); face.timers = []; }
  function faceOutcome(o) { if (face && !face.outcome) { face.outcome = o; US.remember('faceOutcome', o); } }
  function faceStart() {
    var o = US.sense && US.sense.orientation;
    var path = 'desk';
    try { path = (o && typeof o.path === 'function') ? o.path() : (o && o.available && o.available() ? (o.needsPermission && o.needsPermission() ? 'ios' : 'android') : 'desk'); } catch (e) { path = 'desk'; }
    face = { path: path, step: 'offer', timers: [], outcome: null, finished: false, downAt: null, resets: 0, grace: 0 };
    html.setAttribute('data-relief', '');
    faceDark(false);
    if (path === 'desk') { faceText('face.deskTitle', 'face.deskBody'); faceBtns('face.deskOk', 'face.deskNo'); }
    else { faceText('face.title', 'face.body'); faceBtns('face.yes', 'face.no'); }
    var card = D.getElementById('face-card'); if (card) card.hidden = false;
    US.emit('face', { phase: 'offer', path: path });
    faceT(15000, function () { if (face.step === 'offer' || face.step === 'perm') countPath('face.noFlip', 'eyes'); });
  }
  function faceYes() {
    if (!face || face.finished) return;
    if (face.path === 'desk' && face.step === 'offer') { deskCount(); return; }
    if (face.path === 'ios' && face.step === 'offer') {
      face.step = 'perm';
      faceText('face.permTitle', 'face.permBody'); faceBtns('face.permAsk', 'face.permNo');
      US.emit('face', { phase: 'perm' });
      faceClear();
      faceT(15000, function () { if (face.step === 'perm') countPath('face.noFlip', 'eyes'); });
      return;
    }
    if (face.path === 'ios' && face.step === 'perm') {
      face.step = 'asking';
      faceBtns(null, null);
      var o = US.sense && US.sense.orientation, p;
      try { p = o && o.request ? o.request() : Promise.resolve(false); } catch (e) { p = Promise.resolve(false); }
      Promise.resolve(p).then(function (ok) {
        if (!face || face.finished) return;
        if (ok) startSensing(); else countPath('face.permDenied', 'refused');
      }, function () { if (face && !face.finished) countPath('face.permDenied', 'refused'); });
      return;
    }
    if (face.path === 'android' && face.step === 'offer') startSensing();
  }
  function faceNo() {
    if (!face || face.finished) return;
    if (face.step === 'offer' || face.step === 'perm') countPath('face.noBody', 'refused');
  }
  function startSensing() {
    faceClear();
    face.step = 'waiting';
    faceBtns(null, null);
    faceText(null, 'face.waiting');
    US.emit('face', { phase: 'waiting' });
    var flip = function () { return faceT(15000, function () { if (face.step === 'waiting') countPath('face.noFlip', 'eyes'); }); };
    face.flipTimer = flip();
    var o = US.sense && US.sense.orientation;
    if (!o || typeof o.start !== 'function') { countPath('face.noFlip', 'eyes'); return; }
    try {
      o.start(function (isDown, info) {
        if (!face || face.finished) return;
        if (isDown === null || (info && info.state === 'unavailable')) { if (face.step === 'waiting') countPath('face.noFlip', 'eyes'); return; }
        if (isDown && face.step === 'waiting') {
          US.cancel(face.flipTimer);
          face.step = 'down'; face.downAt = now();
          faceDark(true);
          US.emit('face', { phase: 'down' });
          face.longTimer = faceT(12000, function () {
            if (face.step !== 'down') return;
            faceOutcome('down');
            txt('face-msg', L('face.lifted'));
            faceT(8000, function () { finishFace(); });
          });
        } else if (!isDown && face.step === 'down') {
          var dur = now() - face.downAt;
          faceDark(false);
          if (dur < 4) {
            US.cancel(face.longTimer);
            face.step = 'waiting';
            faceText(null, 'face.early');
            face.flipTimer = flip();
          } else {
            face.step = 'lifted';
            faceOutcome('down');
            faceText(null, 'face.lifted');
            US.emit('face', { phase: 'lifted' });
            faceT(4000, finishFace);
          }
        }
      });
    } catch (e) { countPath('face.noFlip', 'eyes'); }
  }
  // "eyes" and "no" paths: twenty seconds of nothing, then eyesDone
  function countPath(bodyKey, outcome) {
    faceClear();
    try { if (US.sense && US.sense.orientation) US.sense.orientation.stop(); } catch (e) { /* */ }
    face.step = 'count';
    faceOutcome(outcome);
    faceBtns(null, null);
    faceText(null, bodyKey);
    faceDark(false);
    US.emit('face', { phase: outcome === 'refused' ? 'refused' : 'eyes' });
    faceT(3000, function () { faceDark(true); });
    faceT(20000, function () {
      faceDark(false);
      faceText(null, 'face.eyesDone');
      faceT(4000, finishFace);
    });
  }
  function deskCount() {
    faceClear();
    face.step = 'desk';
    faceBtns(null, null);
    faceDark(true);
    face.grace = now() + 0.8;
    face.deskTimer = faceT(20000, deskDone);
  }
  function deskDone() {
    if (face.step !== 'desk') return;
    face.step = 'deskDone';
    faceOutcome('hands');
    faceDark(false);
    faceText(null, 'face.deskDone');
    US.emit('face', { phase: 'hands' });
    faceT(4500, finishFace);
  }
  US.on('input', function () {
    if (!face || face.finished || face.step !== 'desk' || now() < face.grace) return;
    face.resets++;
    if (face.resets === 1) {
      txt('face-msg', L('face.deskReset'));
      US.cancel(face.deskTimer);
      face.grace = now() + 0.8;
      face.deskTimer = faceT(20000, deskDone);
    } else {
      face.step = 'gaveUp';
      US.cancel(face.deskTimer);
      faceOutcome('couldnt');
      faceDark(false);
      faceText(null, 'face.deskGiveUp');
      US.emit('face', { phase: 'couldnt' });
      faceT(4500, finishFace);
    }
  });
  function finishFace() {
    if (!face || face.finished) return;
    face.finished = true;
    faceClear();
    try { if (US.sense && US.sense.orientation) US.sense.orientation.stop(); } catch (e) { /* */ }
    if (!face.outcome) faceOutcome('eyes');
    faceDark(false);
    var card = D.getElementById('face-card'); if (card) card.hidden = true;
    US.toast(L('face.after'));
    US.emit('face', { phase: 'end' });
    after(2600, function () { if (US.beat === 'b09') { US.release('face'); US.goto('b10'); } });
  }
  function faceAbort() {
    if (!face) return;
    if (!face.finished) { if (!face.outcome) faceOutcome('eyes'); face.finished = true; faceClear(); US.emit('face', { phase: 'end' }); }
    faceDark(false);
  }

  /* ========================================================= false ending */
  var done = { close: false, away: false, lineShown: false };
  function doneStart() {
    done = { close: false, away: false, lineShown: false };
    S.blanked = false;
    html.setAttribute('data-relief', '');
    hide('done-card', false);
    hide('done-blank', true);
    txt('done-line', ''); txt('done-line2', '');
  }
  function blankNow() {
    if (S.blanked || US.state !== 'done') return;
    S.blanked = true;
    hide('done-card', true);
    hide('done-blank', false);
    html.removeAttribute('data-relief');
    US.emit('blank', { on: true });
  }
  function doneLine() {
    if (US.state !== 'done') return;
    blankNow();
    done.lineShown = true;
    var key = done.close ? 'done.lineClose' : (done.away ? 'done.lineAway' : 'done.line');
    txt('done-line', L(key));
    US.emit('blank', { on: false, line: true });
  }

  /* ============================================================ terminal */
  var term = null;
  function termReset() {
    term = { q: [], src: [], cur: null, lastDone: now(), inputOn: false, pay: 0, payIdx: 0, nextPayT: 322, hold: null, flood: null, calm: null, said: 0 };
    txt('term-out', '');
    txt('term-flood-rows', ''); txt('term-flood-head', '');
    txt('term-calm-num', ''); txt('term-calm-notes', '');
    txt('term-ssid', L('portal.ssid'));
    txt('term-prompt', L('term.prompt'));
    var inp = D.getElementById('term-input'); if (inp) { inp.disabled = true; inp.value = ''; }
  }
  function tprint(text, opt) {
    if (text == null || text === '') return;
    if (!term) termReset();
    opt = opt || {};
    if (opt.idle && (term.cur || term.q.length || term.src.length)) return;   // idle lines only into silence
    var item = { at: now(), text: String(text), m: !!opt.machine, whole: !!opt.whole, cls: opt.cls || null, pause: opt.pause != null ? opt.pause : (opt.machine ? 200 : 900) };
    if (opt.front) term.q.unshift(item); else if (opt.src) term.src.push(item); else term.q.push(item);
  }
  S.termPrint = tprint;
  function scrollTerm() {
    var out = D.getElementById('term-out'); if (!out) return;
    var sc = out.closest('.term-scroll') || out;
    try { sc.scrollTop = sc.scrollHeight; out.scrollTop = out.scrollHeight; } catch (e) { /* */ }
  }
  function termStep() {
    if (!term || US.state !== 'term') return;
    var t = now(), guard = 0, prevEnd = term.prevEnd || 0;
    // speed-independent: several lines may start and finish inside one tick
    while (guard++ < 60) {
      var c = term.cur;
      if (c) {
        if (c.doneAt == null) {
          var dur = (US.reduced || c.m || c.whole) ? 0 : c.text.length * 0.038;
          var n = dur ? Math.floor((t - c.start) / 0.038) : c.text.length;
          if (n >= c.text.length) { n = c.text.length; c.doneAt = c.start + dur; term.lastDone = c.doneAt; }
          var s = c.text.slice(0, Math.max(0, n));
          if (c.el.textContent !== s) { c.el.textContent = s; scrollTerm(); }
          if (c.doneAt == null) break;
        }
        var end = c.doneAt + c.pause / 1000;
        if (t < end) break;
        term.cur = null; prevEnd = term.prevEnd = end;
      }
      var next = term.q.shift() || term.src.shift();
      if (!next) break;
      var out = D.getElementById('term-out');
      next.el = mk('div', 'tl ' + (next.m ? 'mach' : 'say') + (next.cls ? ' ' + next.cls : ''), '');
      if (out) out.appendChild(next.el);
      next.start = Math.min(t, Math.max(prevEnd, next.at == null ? t : next.at)); next.doneAt = null;
      term.cur = next;
      if (!next.m) US.a11y(next.text);
    }
    var idle = !term.cur && !term.q.length && !term.src.length;
    // payoff interjections, T 320–360, max 6: whenever the terminal has been idle 4 s,
    // and otherwise one every 16 s of story time, slotted in after the current line
    var T = US.T();
    if (T >= 320 && T < 360 && term.pay < 6 && ((idle && t - term.lastDone >= 4) || T >= term.nextPayT)) {
      if (nextPayoff()) term.nextPayT = T + 16; else term.pay = 6;
    }
    if (term.hold === 'drain' && idle) { term.hold = null; US.release('speech'); }
    floodStep(); calmStep();
  }
  function payText(p) {
    if (!p || !US.when(p.when)) return null;
    if (p.t == null) return p.key === 'mash' ? L('mash.payoff') : null;
    return R(p);
  }
  function payAvailable() {
    var list = arr('pay'), n = 0;
    for (var i = term.payIdx; i < list.length; i++) if (payText(list[i])) n++;
    return n;
  }
  function nextPayoff() {
    var list = arr('pay');
    while (term.payIdx < list.length) {
      var p = list[term.payIdx++];
      var s = payText(p);
      if (s) { term.src.unshift({ at: now(), text: s, m: false, pause: 900 }); term.pay++; return true; }
    }
    return false;
  }
  function termStart(jump) {
    termReset();
    var mono = arr('term.monologue');
    mono.forEach(function (m, i) {
      var t = typeof m === 'string' ? F(m) : F(m.t);
      if (t != null) term.src.push({ at: now(), text: t, m: !!(m && m.m), pause: m && m.m ? 400 : 900 });
      if (i === 3) {
        var h = new Date().getHours();
        var tl = L(h < 5 ? 'term.timeNight' : 'term.timeDay');
        if (tl) term.src.push({ at: now(), text: tl, m: false, pause: 900 });
      }
    });
    if (US.isReturn()) { var r = L('term.return'); if (r) term.src.push({ at: now(), text: r, m: false, pause: 900 }); }
    // machine lines from the log and ARP (s30), interleaved with the speech
    var logs = arr('log.s30').slice(1), arps = arr('arp.s30');
    logs.forEach(function (l, i) { termAt(311 + i * 5, function () { tprint(F(l), { machine: true }); }); });
    arps.forEach(function (l, i) { termAt(313.5 + i * 5.5, function () { tprint(F(l), { machine: true }); }); });
  }
  function termAt(T, fn) { US.schedule(T, function (info) { if (!info.late && US.state === 'term') fn(); }); }
  function termReady() {
    if (!term) termReset();
    var r = L('term.ready');
    if (r) term.src.push({ at: now(), text: r, m: false, pause: 900 });   // after the monologue, whenever that is
    term.inputOn = true;
    var inp = D.getElementById('term-input');
    if (inp) { inp.disabled = false; try { inp.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  function termSubmit() {
    var inp = D.getElementById('term-input');
    if (!term || !term.inputOn || !inp) return;
    var raw = String(inp.value || '').trim();
    inp.value = '';
    if (!raw) return;
    var limited = US.sense && US.sense.rateLimitedUntil && (performance.now() < US.sense.rateLimitedUntil);
    tprint((L('term.prompt') || '$') + ' ' + raw, { machine: true, cls: 'echo', front: true, pause: 200 });
    US.push('said', raw);
    US.emit('said', { text: raw, field: 'term' });
    if (limited) return;
    if (US.T() >= 360) { tprint(L('term.ellipsis') || '…'); return; }
    var res = null;
    try { res = (US.tools && US.tools.lookup) ? US.tools.lookup(raw, { stage: 'L4' }) : null; } catch (e) { res = null; }
    if (!res) { res = { records: [F('{q}    A    0.0.0.0    ttl 0    (local)', { q: raw })], say: [] }; US.emit('lookup', { q: raw, bucket: 'fallback', stage: 'L4' }); }
    var items = [];
    (res.records || []).forEach(function (r) { if (r) items.push({ t: r, m: true }); });
    (res.say || []).forEach(function (s) { if (s) items.push({ t: s, m: false }); });
    // keep them in order, ahead of scheduled lines
    for (var i = items.length - 1; i >= 0; i--) tprint(items[i].t, { machine: items[i].m, front: true, pause: items[i].m ? 200 : 900 });
    // the echo must stay first
    var echoIdx = -1; term.q.forEach(function (x, k) { if (x.cls === 'echo' && x.text.indexOf(raw) >= 0 && echoIdx < 0) echoIdx = k; });
    if (echoIdx > 0) { var e = term.q.splice(echoIdx, 1)[0]; term.q.unshift(e); }
  }

  /* --- B12: the copy --- */
  function annotations() {
    var out = [];
    arr('copy.annotations').forEach(function (a) { var s = F(a); if (s) out.push(s); });
    return out.length ? out : ['is reading this'];
  }
  function r255() { return Math.floor(Math.random() * 256); }
  function macish() { var a = ['02']; for (var i = 0; i < 5; i++) a.push(('0' + r255().toString(16)).slice(-2)); return a.join(':'); }
  function floodRow(i, anns) {
    var tpl = G('copy.row') || '{name}    10.{r}.{r}.{r}    {mac-ish}    the one who {annotation}';
    tpl = String(tpl).replace(/\{r\}/g, function () { return String(r255()); });
    return F(tpl, { annotation: anns[i % anns.length], 'mac-ish': macish() });
  }
  function floodHead(shown) { txt('term-flood-head', L('dev.countBig', { shown: US.group(shown), hosts: US.group(US.hosts()) })); }
  function floodStart() {
    if (!term) termReset();
    tprint(L('copy.head'), { machine: true, src: true });
    term.flood = { start: now(), shown: 0, anns: annotations(), done: false };
    floodHead(0);
  }
  function floodStep() {
    var f = term && term.flood; if (!f || f.done) return;
    var rows = D.getElementById('term-flood-rows'); if (!rows) return;
    var due = Math.min(4096, Math.floor((now() - f.start) / 0.06) + 1);
    if (US.reduced) {
      if (!f.shown) { var frag0 = D.createDocumentFragment(); for (var k = 0; k < 40; k++) { var s0 = floodRow(k, f.anns); if (s0) frag0.appendChild(mk('div', null, s0)); } rows.appendChild(frag0); f.shown = 40; }
      var stepped = Math.min(4096, 40 + Math.floor(now() - f.start) * 160);
      if (stepped !== f.shown) { f.shown = stepped; floodHead(f.shown); }
      return;
    }
    if (due <= f.shown) return;
    var frag = D.createDocumentFragment();
    for (var i = f.shown; i < due; i++) { var s = floodRow(i, f.anns); if (s) frag.appendChild(mk('div', null, s)); }
    rows.appendChild(frag);
    while (rows.children.length > 400) rows.removeChild(rows.firstChild);
    f.shown = due;
    floodHead(f.shown);
    try { rows.scrollTop = rows.scrollHeight; } catch (e) { /* */ }
  }
  function bigWords(v) {
    if (v < 1e15) return US.group(Math.round(v));
    var units = [[1e18, 'quintillion'], [1e15, 'quadrillion']];
    for (var i = 0; i < units.length; i++) {
      if (v >= units[i][0]) { var n = v / units[i][0]; var s = n < 1.05 ? 'one' : (Math.round(n * 10) / 10).toString(); return s + ' ' + units[i][1]; }
    }
    return US.group(Math.round(v));
  }
  function calmStart() {
    if (!term) termReset();
    term.calm = { start: now(), dur: 12, lastStep: -1, final: false };
    calmStep();
  }
  function calmStep() {
    var c = term && term.calm; if (!c || c.final) return;
    var steps = arr('copy.calmSteps'); if (!steps.length) steps = [1, 12, 1440, 525600, 52560000, 1e12, 1e18];
    var el = (now() - c.start);
    if (US.reduced) { var whole = Math.floor(el); if (whole === c.lastStep) return; c.lastStep = whole; el = whole; }
    var k = Math.min(1, el / c.dur) * (steps.length - 1);
    var i = Math.min(steps.length - 2, Math.floor(k)), f = k - i;
    var v = Math.exp(Math.log(steps[i]) + (Math.log(steps[i + 1]) - Math.log(steps[i])) * f);
    if (k >= steps.length - 1) v = steps[steps.length - 1];
    US.live.renewalsBig = bigWords(v);
    var s = L('copy.calm') || F('lease renewed ×{renewalsBig}');
    var num = D.getElementById('term-calm-num');
    if (num && s && num.textContent !== s) num.textContent = s;
  }
  function calmNote(i) { var n = arr('copy.calmNotes')[i]; var s = n != null ? F(n) : null; var box = D.getElementById('term-calm-notes'); if (s && box) box.appendChild(mk('p', null, s)); }
  function calmFinal() { if (term && term.calm) term.calm.final = true; txt('term-calm-num', L('copy.calmFinal')); }
  function collapse() {
    if (!term) termReset();
    if (term.flood) term.flood.done = true;
    if (term.calm) term.calm.final = true;
    var rows = D.getElementById('term-flood-rows');
    if (rows) { rows.textContent = ''; var row = L('copy.collapseRow') || F('{name}    {ip}    255.255.255.255    you'); if (row) rows.appendChild(mk('div', null, row)); }
    floodHead(1);
    txt('term-calm-num', ''); txt('term-calm-notes', '');
    var N = F('{NAME}');
    txt('term-ssid', N); txt('panel-ssid', N);
    var s32 = arr('log.s32');
    if (s32[0]) tprint(F(s32[0]), { machine: true, src: true });
    if (s32[1]) tprint(F(s32[1]), { machine: true, src: true });
    arr('copy.collapse').forEach(function (c) { var t = typeof c === 'string' ? F(c) : F(c.t); if (t) tprint(t, { machine: !!(c && c.m), src: true, whole: true, pause: (c && c.m) ? 600 : 2600 }); });
    arr('arp.s32').forEach(function (a) { tprint(F(a), { machine: true, src: true }); });
    if (s32[3]) tprint(F(s32[3]), { machine: true, src: true });
  }

  /* ========================================================== last lookup */
  var last = null;
  function lastStart() {
    last = { answered: false, pass: null };
    txt('last-ask', L('last.ask'));
    txt('last-out', '');
    var inp = D.getElementById('last-input');
    if (inp) { inp.disabled = false; inp.readOnly = false; inp.value = ''; inp.placeholder = L('last.placeholder') || inp.placeholder; }
    var go = D.getElementById('last-go'); if (go) go.disabled = false;
    after(400, function () { if (inp && US.state === 'last' && !last.answered) { try { inp.focus({ preventScroll: true }); } catch (e) { /* */ } } });
    last.pass = after(25000, lastPass);
  }
  function lastLine(text, cls) { var o = D.getElementById('last-out'); if (o && text) o.appendChild(mk('p', cls, text)); }
  function lastPass() {
    if (!last || last.answered || US.state !== 'last') return;
    lastLine(L('last.pass'), 'say');
    var nm = name(), inp = D.getElementById('last-input'), i = 0;
    if (inp) inp.readOnly = true;
    var type = function () {
      if (!last || last.answered) return;
      i++;
      if (inp) inp.value = nm.slice(0, i);
      if (i < nm.length) after(140, type);
      else after(500, function () { lastAnswer(nm, true); });
    };
    after(1200, type);
  }
  function lastAnswer(q, passive) {
    if (!last || last.answered) return;
    q = String(q || '').trim();
    if (!q) return;
    last.answered = true;
    if (last.pass) US.cancel(last.pass);
    var inp = D.getElementById('last-input'); if (inp) inp.disabled = true;
    var go = D.getElementById('last-go'); if (go) go.disabled = true;
    var bucket = 'other';
    try { bucket = (US.tools && US.tools.bucket) ? US.tools.bucket(q) : bucket; } catch (e) { /* */ }
    if (String(q).toLowerCase() === String(name()).toLowerCase()) bucket = 'self';
    if (!passive) {
      US.remember('lastAsk', q);
      US.emit('said', { text: q, field: 'last' });
      try { if (US.tools && US.tools.lookup) US.tools.lookup(q, { stage: 'L4' }); else US.emit('lookup', { q: q, bucket: bucket, stage: 'L4' }); } catch (e) { /* */ }
    }
    var ans = G('last.answer') || {};
    var key = passive ? (ans.passive != null ? 'passive' : 'self') : (ans[bucket] != null ? bucket : 'other');
    lastLine(L('last.record', { q: q }), 'mach');
    after(1000, function () { lastLine(L('last.answer.' + key, { q: q }) || L('last.answer.other', { q: q }), 'say'); });
    arr('last.close').forEach(function (l, i) { after(2000 + i * 2500, function () { lastLine(F(l), 'say'); }); });
    after(1000 + 9000, function () { if (US.beat === 'b13') { US.release('last'); US.goto('b14'); } });
  }

  /* ================================================================= coda */
  var coda = { tagTimer: null };
  function codaStart() {
    closeTerms();
    US.remember('lastEnd', 'complete');
    US.persist();
    txt('portal-ssid', L('coda.ssid'));
    txt('portal-security', L('coda.security'));
    txt('portal-title', L('coda.title'));
    txt('portal-guests', L('coda.guests'));
    txt('portal-return', ''); portal.noteBase = ''; portal.noteHint = ''; txt('portal-note', '');
    txt('portal-error', '');
    txt('portal-fine', L('coda.fine'));
    if (coda.tagTimer) US.cancel(coda.tagTimer);
    coda.tagTimer = rotate('coda.taglines', 'portal-tagline', coda);
    var nm = D.getElementById('portal-name'); if (nm) { nm.value = name(); nm.disabled = true; }
    var tb = D.getElementById('portal-terms'); if (tb) { tb.checked = true; tb.disabled = true; }
    termsLabel('coda.termsLabel');
    hide('portal-connect', true);
    var st = D.getElementById('portal-stay'); if (st) { hide(st, false); st.disabled = false; txt(st, L('coda.stay')); }
    var box = D.getElementById('coda-lines'); if (box) box.textContent = '';
    var lines = arr('coda.lines').slice();
    var h = new Date().getHours();
    if (h >= 5 && h <= 17 && G('coda.goodnightDay')) lines[lines.length - 1] = G('coda.goodnightDay');
    lines.forEach(function (l, i) { after(1200 + i * 2400, function () { var t = F(l); if (t && box && (US.state === 'coda' || US.state === 'manifest')) box.appendChild(mk('p', null, t)); }); });
  }
  function codaStay() {
    if (US.state !== 'coda') return;
    var st = D.getElementById('portal-stay'); if (st) { txt(st, L('coda.stayed')); st.disabled = true; }
    after(3000, function () { if (US.beat === 'b14') US.goto('b15'); });
  }

  /* ============================================================= manifest */
  var MAN_ORDER = ['name', 'day', 'deleted', 'terms', 'device', 'lookups', 'traces', 'said', 'away', 'idle', 'mash', 'hes', 'face', 'env', 'sound', 'ip', 'visits', 'lastVisit'];
  function manItem(key) {
    var items = G('man.items') || {}, v = items[key];
    var rec = function (k) { return US.recall(k); };
    if (key === 'lastVisit' && v == null) v = G('man.lastVisit');
    if (v == null) return null;
    var t = (typeof v === 'object' && v.t != null) ? v.t : v, alt = (typeof v === 'object') ? v.alt : null;
    var C = G('man') || {};
    switch (key) {
      case 'name': return rec('nameAuto') ? F(alt) : F(t);
      case 'day': return rec('day') ? F(t) : (rec('daySkipped') ? F(alt) : null);
      case 'deleted': return rec('deleted') ? F(t) : null;
      case 'terms':
        if (rec('hesTerms') == null || US.termsAuto()) return null;
        var tos = C.termsOpenedSentence || {};
        return F(t, { termsOpenedSentence: rec('termsOpened') ? (tos.yes || 'You opened the terms first.') : (tos.no || 'You didn’t open them.') });
      case 'device': return rec('deviceTapped') ? F(t) : null;
      case 'lookups': return (rec('lookups') || []).length ? F(t) : null;
      case 'traces': return (rec('traces') || []).length ? F(t) : null;
      case 'said': return (rec('said') || []).length ? F(t) : null;
      case 'away': return (rec('awayCount') | 0) >= 1 ? F(t, { awayTotal: Math.max(1, Math.round(rec('awayTotal') || 0)) }) : null;
      case 'idle': return F(t);
      case 'mash': return (rec('mashMax') | 0) >= 3 ? F(t) : null;
      case 'hes': return (+rec('hesMax') || 0) >= 1 ? F(t) : null;
      case 'face':
        var o = rec('faceOutcome'); if (!o) return null;
        var fs = (C.faceSentence || {})[o], fh = C.faceHow || {};
        return F(t, { faceSentence: fs, faceHow: rec('faceSensorUsed') ? fh.sensor : fh.none });
      case 'env': return F(t);
      case 'sound': return F(t, { soundState: ((C.soundState || {})[rec('sound') ? 'on' : 'off']) || (rec('sound') ? 'on' : 'off') });
      case 'ip': return US.ip ? F(t) : null;
      case 'visits': return F(t);
      case 'lastVisit': return US.isReturn() ? F(t) : null;
    }
    return F(t);
  }
  function buildManifest() {
    var ul = D.getElementById('man-list'); if (!ul) return;
    ul.textContent = '';
    if (S.forgotten) { ul.appendChild(mk('li', 'forgot', L('forget.done'))); return; }
    MAN_ORDER.forEach(function (k) { var s = null; try { s = manItem(k); } catch (e) { s = null; } if (s) ul.appendChild(mk('li', null, s)); });
    txt('forget-msg', '');
    var fb = D.getElementById('btn-forget'); if (fb) fb.disabled = false;
    shareSetup();
  }
  function showManifest(base) {
    buildManifest();
    US.setState('manifest', { base: base });
    US.emit('finale', {});
  }
  function doForget(listId, msgId) {
    US.forget();
    S.forgotten = true;
    var ul = D.getElementById('man-list');
    if (ul) { ul.textContent = ''; ul.appendChild(mk('li', 'forgot', L('forget.done'))); }
    if (listId === 'disc') txt('disc-forget-msg', L('forget.done'));
    var fb = D.getElementById('btn-forget'); if (fb) fb.disabled = true;
    var db = D.getElementById('disc-forget'); if (db) db.disabled = true;
    after(2000, function () {
      var a = L('forget.after');
      if (listId === 'disc') { var m = D.getElementById('disc-forget-msg'); if (m && a) m.appendChild(mk('span', 'after', ' ' + a)); }
      else txt(msgId || 'forget-msg', a);
    });
    shareSetup();
  }

  /* ---------------------------------------------------------------- share */
  function shareURL() {
    var base;
    try { base = new URL('./', location.href).href; } catch (e) { base = location.href.split('?')[0]; }
    var cb = D.getElementById('share-name');
    if (cb && cb.checked && !S.forgotten) { var n = F('{name}'); if (n) base += '?from=' + encodeURIComponent(n); }
    return base;
  }
  function shareSetup() {
    var lbl = D.getElementById('share-name-label');
    var n = S.forgotten ? null : L('share.nameToggle');
    var row = D.getElementById('share-name');
    if (lbl) txt(lbl, n || (L('share.nameToggle') || '').replace(/\s*\(\{?name\}?\)/, '').replace(/\s*\([^)]*\)\s*$/, ''));
    if (row && (S.forgotten || US.recall('nameAuto'))) { row.checked = false; row.disabled = !!S.forgotten; }
    shareUpdate();
  }
  function shareUpdate() {
    var link = D.getElementById('share-link'); if (!link) return;
    link.value = shareURL();
    var box = D.getElementById('share-qr');
    try {
      if (box && US.qr && typeof US.qr.render === 'function') { var ok = US.qr.render(box, link.value, { label: 'QR code for ' + link.value }); if (ok === false) box.hidden = true; }
      else if (box && !US.qr) box.hidden = true;
    } catch (e) { if (box) box.hidden = true; }
  }
  function copyLink() {
    var link = D.getElementById('share-link'); if (!link) return;
    var url = link.value || shareURL();
    var okMsg = function () { txt('share-msg', L('share.copied')); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(okMsg, function () { legacyCopy(link) && okMsg(); }); return; }
    } catch (e) { /* */ }
    if (legacyCopy(link)) okMsg();
  }
  function legacyCopy(input) { try { input.select(); return D.execCommand('copy'); } catch (e) { return false; } }
  function share() {
    var url = shareURL();
    var cb = D.getElementById('share-name');
    var text = (cb && cb.checked && !S.forgotten) ? (L('share.textNamed') || L('share.text')) : L('share.text');
    if (navigator.share) {
      try { navigator.share({ title: L('portal.ssid') || 'UNDERSTORY-GUEST', text: text || '', url: url }).catch(function () { /* cancelled */ }); return; } catch (e) { /* */ }
    }
    copyLink();
  }

  /* ========================================================= disconnected */
  function discFill(from) {
    var line = (from === 'portal' || !US.connected()) ? (G('disc.line') && G('disc.line').portal) : null;
    txt('disc-line', line || L('disc.line'));
    var dl = D.getElementById('disc-line'); if (dl) dl.setAttribute('data-l-lock', '');
  }

  /* ================================================================ wiring */
  function bind() {
    on('portal-form', 'submit', function (e) { e.preventDefault(); if (US.state === 'portal') tryConnect(false); });
    on('portal-terms-open', 'click', function (e) { e.preventDefault(); if (US.state === 'portal') US.remember('termsOpened', true); openTerms(); });
    on('terms-accept', 'click', function () {
      var tb = D.getElementById('portal-terms');
      if (tb && US.state === 'portal' && !tb.checked) { tb.checked = true; tb.dispatchEvent(new Event('change', { bubbles: true })); }
      closeTerms();
    });
    on('terms-close', 'click', closeTerms);
    on('portal-stay', 'click', codaStay);
    on('portal-name', 'input', function () { if (D.getElementById('portal-error') && D.getElementById('portal-error').textContent) portalErr(null); });
    on('portal-terms', 'change', function () { var e = D.getElementById('portal-error'); if (e && e.textContent && this.checked) portalErr(null); });
    on('wiz-form', 'submit', function (e) { e.preventDefault(); wizSubmit(); });
    on('wiz-skip', 'click', function (e) { e.preventDefault(); wizSkip(); });
    on('face-yes', 'click', faceYes);
    on('face-no', 'click', faceNo);
    on('done-close', 'click', function () { if (US.state !== 'done' || done.lineShown) return; done.close = true; US.remember('doneClose', true); blankNow(); });
    on('term-form', 'submit', function (e) { e.preventDefault(); termSubmit(); });
    on('last-form', 'submit', function (e) { e.preventDefault(); var i = D.getElementById('last-input'); if (i && !i.readOnly) lastAnswer(i.value, false); });
    on('btn-forget', 'click', function () { doForget('man', 'forget-msg'); });
    on('btn-reconnect', 'click', function () { US.reconnect(); });
    on('btn-share', 'click', share);
    on('btn-copy', 'click', copyLink);
    on('share-name', 'change', shareUpdate);
    on('disc-manifest', 'click', function () { showManifest('disconnected'); });
    on('disc-forget', 'click', function () { doForget('disc'); });
    on('disc-reconnect', 'click', function () { US.reconnect(); });
  }

  function registerCues() {
    var sched = function (T, fn) { US.schedule(T, fn); };
    sched(35, function (i) { if (i.late) return; US.toast(US.isReturn() ? L('ret.toast') : L('toast.welcome')); });
    sched(40, function (i) { if (!i.late || US.T() < 64) wizShow(i.late); });
    sched(46, function (i) { if (!i.late) US.toast(arr('toast.tips')[0] != null ? F(arr('toast.tips')[0]) : null); });
    sched(50, function (i) { if (!i.late && US.isReturn() && US.prev('lastEnd') === 'disconnect') US.toast(L('ret.lastDisconnect')); });
    sched(56, function (i) { check(i.late); });
    sched(64, function (i) {
      if (wiz.done) return;
      if (!US.recall('day')) US.remember('daySkipped', true);
      if (i.late) { wiz.done = true; hide('wizard', true); return; }
      wizClose('wiz.timeout', 2000);
    });
    sched(66, function (i) { if (!i.late) US.toast(F(arr('toast.tips')[1] || '')); });
    sched(76, function (i) { if (!i.late) US.toast(F(arr('toast.tips')[2] || '')); });
    sched(88, function (i) { if (!i.late && !US.recall('deviceTapped') && US.state === 'panel') US.toast(L('dev.tapHint')); });
    // B10
    sched(293, function (i) { if (!i.late) blankNow(); });
    sched(299, function (i) { if (!i.late) doneLine(); });
    sched(302, function (i) { if (!i.late && US.state === 'done') txt('done-line2', L('done.line2')); });
    // B11
    sched(330, function (i) { if (US.state === 'term') termReady(); });
    sched(344.5, function (i) {
      if (i.late || !term || US.state !== 'term') return;
      if (term.q.length || term.src.length || term.cur) { term.hold = 'drain'; US.hold('speech', 8); }
    });
    // B12
    arr('copy.say').forEach(function (s, k) { sched(348 + k * 3.2, function (i) { if (!i.late && US.state === 'term') tprint(F(s), { src: true, whole: true, pause: 3200 }); }); });
    sched(352, function (i) { if (!i.late && US.state === 'term') calmStart(); });
    arr('copy.calmNotes').forEach(function (s, k) { sched(356 + k * 4, function (i) { if (!i.late && US.state === 'term') calmNote(k); }); });
    sched(364, function (i) { if (!i.late && US.state === 'term') calmFinal(); });
    sched(368, function (i) { if (US.state === 'term') collapse(); });
    sched(374.5, function (i) {
      if (i.late || !term || US.state !== 'term') return;
      if (term.q.length || term.src.length || term.cur) { term.hold = 'drain'; US.hold('speech', 14); }
    });
  }

  US.on('boot', function () {
    bind();
    portalBoot();
    registerCues();
    US.every(30, termStep);
  });
  US.on('connect', function () { stopPortal(); portal.connecting = true; });
  US.on('beat', function (d) {
    var id = d.id, jump = !!d.jump;
    if (id !== 'b09' && face && !face.finished) faceAbort();
    if (id !== 'b09' && id !== 'b10') html.removeAttribute('data-relief');
    switch (id) {
      case 'b02': handshake(); break;
      case 'b03': renderStatus(); break;
      case 'b09': faceStart(); break;
      case 'b10': doneStart(); break;
      case 'b11': termStart(jump); break;
      case 'b12': if (!term || jump) termReset(); floodStart(); break;
      case 'b13': lastStart(); break;
      case 'b14': codaStart(); break;
      case 'b15': buildManifest(); US.emit('finale', {}); break;
    }
  });
  US.on('state', function (d) {
    if (d.state === 'panel' || d.state === 'face') renderStatus();
    if (d.state === 'term' && !term) termReset();
  });
  US.on('mask', function () { renderStatus(); if (US.state === 'term') txt('term-prompt', L('term.prompt')); });
  var lastStatusSec = -1;
  US.on('tick', function () {
    var s = Math.floor(US.now());
    if (s !== lastStatusSec && (US.state === 'panel' || US.state === 'face')) { lastStatusSec = s; renderStatus(); }
  });
  US.on('away', function () { if (US.state === 'done' && !done.lineShown) { done.away = true; US.remember('doneAway', true); } });
  US.on('disconnect', function (d) {
    faceAbort();
    if (term) { term.inputOn = false; term.q = []; term.src = []; term.flood = null; term.calm = null; }
    discFill(d && d.from);
  });
  US.on('remember', function (d) {
    if (d && d.key === 'name' && US.state === 'term') txt('term-prompt', L('term.prompt'));
  });
})();
