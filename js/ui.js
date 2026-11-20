/* =========================================================
   HEARTWOOD — ui.js
   Controls and product chrome:
   · notifications (HW.notify) — the product's own toasts
   · the "best with sound" invitation
   · the mobile menu
   · one router for every CTA, so each button does what its
     current label says (labels change with dread)
   · pricing toggle, privacy "forget", return-visit resume
   Nothing here sends anything anywhere.
   ========================================================= */
(function () {
  'use strict';

  function H() { return window.HW || null; }
  function d() { var h = H(); return h && isFinite(h.d) ? h.d : 0; }
  function reduced() {
    var h = H(); if (h && typeof h.reduced === 'boolean') return h.reduced;
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function emit(e, x) { var h = H(); try { if (h) h.emit(e, x); } catch (er) {} }
  function on(e, fn) { var h = H(); try { if (h) h.on(e, fn); } catch (er) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function $(s) { return document.querySelector(s); }
  function navH() { var n = $('#nav'); return n ? n.getBoundingClientRect().height : 64; }
  function stagesOf(s) {
    var out = [];
    String(s || '').split('|').forEach(function (p) { var i = p.indexOf(':'); if (i > 0) out.push({ t: parseFloat(p.slice(0, i)), v: p.slice(i + 1) }); });
    return out.sort(function (a, b) { return a.t - b.t; });
  }
  function pickStage(base, s) { var v = base, st = stagesOf(s), D = d(); for (var i = 0; i < st.length; i++) if (D >= st[i].t) v = st[i].v; return v; }

  /* ---------- scrolling helpers ---------- */
  function scrollToY(y) {
    y = Math.max(0, Math.round(y));
    try { window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); }
  }
  function topOf(node) { return node.getBoundingClientRect().top + (window.scrollY || 0); }
  var goSeq = 0;
  function wantY(node, opts) {
    if (opts.progress != null && node.offsetHeight > innerHeight) return topOf(node) + (node.offsetHeight - innerHeight) * opts.progress;
    if (node.classList && node.classList.contains('tall')) return topOf(node);
    return topOf(node) - navH() - (opts.pad == null ? 8 : opts.pad);
  }
  function goTo(target, opts) {
    opts = opts || {};
    var node = typeof target === 'string' ? document.querySelector(target) : target;
    if (!node) return false;
    scrollToY(wantY(node, opts));
    // text above can change length while we travel (fonts arriving, labels
    // rewriting themselves as dread rises): when the scroll settles, correct it
    var seq = ++goSeq, last = -1, still = 0, tries = 0, fixes = 0;
    (function check() {
      if (seq !== goSeq) return;
      var y = window.scrollY;
      still = Math.abs(y - last) < 1 ? still + 1 : 0; last = y;
      if (still >= 2) {
        var want = Math.max(0, Math.min(wantY(node, opts), document.documentElement.scrollHeight - innerHeight));
        if (Math.abs(want - y) > 6 && fixes < 3) { fixes++; still = 0; scrollToY(want); }
        else return;
      }
      if (++tries < 60) setTimeout(check, 110);
    })();
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, function cancel() { if (seq === goSeq) goSeq++; window.removeEventListener(t, cancel, true); }, { passive: true, capture: true, once: true }); });
    // move focus for keyboard / screen-reader users without a second jump
    if (opts.focus !== false) {
      var f = node.matches && node.matches('section, footer, div, li') ? (node.querySelector('h1, h2, h3') || node) : node;
      if (f && !f.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SUMMARY)$/.test(f.tagName)) f.setAttribute('tabindex', '-1');
      try { f.focus({ preventScroll: true }); } catch (e) {}
    }
    return true;
  }
  function nextSection() {
    var secs = document.querySelectorAll('main > section'), y = (window.scrollY || 0) + navH() + 40;
    for (var i = 0; i < secs.length; i++) if (topOf(secs[i]) > y) return secs[i];
    return null;
  }
  function chat() { var h = H(); return h && h.chat ? h.chat : null; }
  function focusChat(opts) {
    var c = chat();
    if (c && c.focus) { c.focus(opts || {}); return true; }
    return goTo('#chat');
  }

  /* =========================================================
     1. Notifications — the product's own toasts
     ========================================================= */
  var stack = null, live = [];
  var RING = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="16" cy="16" r="13"/><circle cx="16.6" cy="15.8" r="8.6"/><circle cx="17.1" cy="15.6" r="4.4"/></g><circle cx="17.3" cy="15.5" r="1.6" fill="currentColor"/></svg>';
  var SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function ensureStack() {
    if (stack) return stack;
    stack = el('div', 'hw-toasts');
    stack.setAttribute('role', 'region');
    stack.setAttribute('aria-label', 'Notifications');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
    return stack;
  }
  function dismiss(t, why) {
    if (!t || t._gone) return;
    t._gone = true;
    clearTimeout(t._timer);
    t.classList.remove('on');
    t.classList.add('off');
    live = live.filter(function (x) { return x !== t; });
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reduced() ? 0 : 420);
    if (t._onClose) try { t._onClose(why || 'dismiss'); } catch (e) {}
  }
  /* opts: {id, kind:'chat'|'sys'|'sound'|'away', title, meta, body, quote, actions:[{label, primary, fn, keep}], ttl, force, onClose} */
  function notify(opts) {
    opts = opts || {};
    var h = H();
    if (h && h.hush && !opts.force) return null;
    ensureStack();
    if (opts.id) { for (var i = 0; i < live.length; i++) if (live[i]._id === opts.id) dismiss(live[i], 'replace'); }
    var max = innerWidth > 720 ? 3 : 2;
    while (live.length >= max) dismiss(live[0], 'overflow');
    var t = el('div', 'hw-toast hw-toast-' + (opts.kind || 'sys'));
    t._id = opts.id || '';
    t._onClose = opts.onClose;
    var ic = el('span', 'hw-toast-ic'); ic.innerHTML = opts.kind === 'sound' ? SPEAKER : RING;
    var main = el('div', 'hw-toast-main');
    var top = el('div', 'hw-toast-top');
    top.appendChild(el('b', 'hw-toast-title', opts.title || 'Heartwood'));
    if (opts.meta !== '') top.appendChild(el('span', 'hw-toast-meta mono', opts.meta || 'now'));
    main.appendChild(top);
    if (opts.body) main.appendChild(el('p', 'hw-toast-body', opts.body));
    if (opts.quote) main.appendChild(el('p', 'hw-toast-quote', opts.quote));
    if (opts.actions && opts.actions.length) {
      var row = el('div', 'hw-toast-acts');
      opts.actions.forEach(function (a) {
        var b = el('button', 'hw-toast-btn' + (a.primary ? ' is-primary' : ''), a.label);
        b.type = 'button';
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          try { if (a.fn) a.fn(); } catch (e) { if (window.console) console.error('[ui] toast action', e); }
          if (!a.keep) dismiss(t, 'action');
        });
        row.appendChild(b);
      });
      main.appendChild(row);
    }
    var x = el('button', 'hw-toast-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss notification');
    x.addEventListener('click', function () { dismiss(t, 'close'); });
    t.appendChild(ic); t.appendChild(main); t.appendChild(x);
    stack.appendChild(t);
    live.push(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('on'); }); });
    if (opts.ttl !== 0) t._timer = setTimeout(function () { dismiss(t, 'timeout'); }, opts.ttl || 9000);
    if (opts.kind !== 'sound') emit('sfx', { k: 'notify', kind: opts.kind });
    return t;
  }
  function hushAll() { live.slice().forEach(function (t) { dismiss(t, 'hush'); }); }

  /* =========================================================
     2. Sound: an honest invitation, early and hard to miss
     ========================================================= */
  var soundAsked = 0, soundToast = null;
  function sound() { var h = H(); return h && h.sound ? h.sound : null; }
  function soundOn() { var s = sound(); if (s) s.on(); }
  function rememberPref(v) { var h = H(); if (h) { h.soundPref = v; if (h.memory) h.memory.save(); } }
  function offerSound(late) {
    var s = sound();
    if (!s || s.isOn() || soundToast) return;
    soundAsked++;
    var prevOn = H() && H().seen && H().seen.prev && H().seen.prev.sound === 'on';
    soundToast = notify({
      id: 'sound', kind: 'sound', force: late, ttl: 0, meta: '',
      title: late ? 'It would like you to hear this' : (prevOn ? 'Pick up where you left off — with sound' : 'Heartwood is best with sound'),
      body: late ? 'Only for the end. Headphones, or the volume up. You can switch it off at any time from the top bar.'
                 : 'Headphones on, or turn your volume up. It reacts to how you read. Switch it off any time with the speaker at the top.',
      actions: [
        { label: late ? 'Listen' : 'Turn on sound', primary: true, fn: function () { soundOn(); rememberPref('on'); } },
        { label: late ? 'No' : 'Not now', fn: function () { rememberPref('off'); } }
      ],
      onClose: function () { soundToast = null; }
    });
  }
  function initSoundOffer() {
    var fired = false;
    function first() {
      if (fired) return; fired = true;
      ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.removeEventListener(t, first, true); });
      setTimeout(function () { offerSound(false); }, 900);
    }
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.addEventListener(t, first, { passive: true, capture: true }); });
    // even a visitor who only reads gets asked, once
    setTimeout(first, 7000);
    // a second, in-fiction offer before the end, if they said not now
    var lateDone = false;
    on('frame', function () {
      if (lateDone) return;
      var h = H(); if (!h) return;
      var w = h.where;
      if (h.d >= 0.72 && (w === 'faq' || w === 'changelog')) {
        lateDone = true;
        var s = sound();
        if (s && !s.isOn() && soundAsked >= 1 && !soundToast) offerSound(true);
      }
    });
  }

  /* =========================================================
     3. Mobile menu
     ========================================================= */
  function initMenu() {
    var nav = $('#nav'), burger = $('.nav-burger'), links = $('#navLinks');
    if (!nav || !burger || !links) return;
    function set(open) {
      nav.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    burger.addEventListener('click', function () { set(!nav.classList.contains('menu-open')); });
    links.addEventListener('click', function (ev) { if (ev.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && nav.classList.contains('menu-open')) { set(false); burger.focus(); } });
    document.addEventListener('click', function (ev) { if (nav.classList.contains('menu-open') && !nav.contains(ev.target)) set(false); });
    window.addEventListener('resize', function () { if (innerWidth > 1080) set(false); });
  }

  /* =========================================================
     4. One router for every CTA
     ========================================================= */
  function device() { var h = H(); return (h && h.device) || 'a screen'; }
  function arrival() { var h = H(); return h && h.seen ? h.hm(h.seen.arrival) : ''; }
  function elapsedDur() { var h = H(); return h ? h.dur(h.elapsed()) : ''; }

  var ACTS = {
    go: function (a) {
      var href = a.getAttribute('href') || '';
      var to = pickStage(href, a.getAttribute('data-to'));
      if (to.charAt(0) !== '#') return false;
      return goTo(to);
    },
    signin: function () {
      var D = d();
      if (D < 0.56) {
        focusChat({ say: 'No account needed — this is a live demo. Ask me anything, right here.' });
        notify({ id: 'signin', title: 'No sign-in needed', body: 'Heartwood runs as a demo on this page. There is no account to create.', ttl: 6000 });
      } else if (D < 0.9) {
        notify({ id: 'signin', title: 'You’re already signed in', meta: 'session',
          body: 'Signed in as the visitor on ' + device() + ', since ' + arrival() + ' (' + elapsedDur() + '). Your session ends when you close the tab. It will keep your place either way.' });
      } else {
        goTo('#end');
        var h = H(); if (h && h.whisper) h.whisper('thank you.', 4000);
      }
      return true;
    },
    getstarted: function () {
      var D = d();
      if (D < 0.36) return goTo('#pricing');
      if (D < 0.6) { var n = nextSection(); return n ? goTo(n) : false; }
      if (D < 0.9) return focusChat({ say: 'Go on. Anything. I’m hungry for anything.' });
      return goTo('#carve');
    },
    start: function () {
      var D = d();
      if (D < 0.9) return focusChat({ say: D < 0.3 ? null : D < 0.7 ? 'Free. Type anything. I’ll take it from there.' : 'Give me something. A word is enough.' });
      return goTo('#carve');
    },
    demo: function () {
      return d() < 0.9 ? goTo('#trace', { progress: 0.14 }) : goTo('#trace', { progress: 0.8 });
    },
    tier1: function () {
      if (d() < 0.85) return focusChat({ say: d() < 0.55 ? 'You’re on Seedling — it’s free. Ask me anything to begin.' : 'Begin. Anything you like. It all goes to the same place.' });
      return goTo('#end');
    },
    tier2: function () {
      var D = d();
      if (D < 0.55) notify({ id: 'trial', title: 'Your 14-day trial has started', body: 'Grove is unlocked for this demo — no card, no account. Try it in the chat.' });
      else if (D < 0.85) notify({ id: 'trial', title: 'Trial started', meta: 'ends —', body: 'Grove is unlocked. There is no end date on file.' });
      return focusChat({ say: D < 0.55 ? 'Grove unlocked. What should we start with?' : D < 0.85 ? 'Started. There’s no stopping point. Ask.' : 'Thank you. Keep going.' });
    },
    tier3: function () {
      var D = d();
      if (D < 0.5) return focusChat({ say: 'Hi — sales here. Well, me. How big is your team, and what would you want a model of your own to do?' });
      if (D < 0.8) return focusChat({ say: 'I’m here. I’m always the one on the other end. Talk.' });
      var c = chat();
      if (c && c.submit) { goTo('#chat', { focus: false }); c.submit('Yes.'); return true; }
      return focusChat();
    },
    forget: function (a) {
      var h = H(); if (h && h.memory) h.memory.forget();
      var st = $('.foot-forget-st');
      if (st) st.textContent = 'Done. This browser no longer remembers your visits.';
      a.textContent = 'Forgotten';
      a.disabled = true;
      return true;
    }
  };

  function initRouter() {
    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button > 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!a) return;
      var f = ACTS[a.getAttribute('data-act')];
      if (!f) return;
      var done = false;
      try { done = f(a, ev); } catch (e) { if (window.console) console.error('[ui] action', e); }
      if (done !== false) ev.preventDefault();
    });
  }

  /* pricing: monthly / annual actually switches */
  function initBilling() {
    var btns = document.querySelectorAll('.toggle [data-bill]'), note = $('.bill-note');
    if (!btns.length) return;
    function set(mode) {
      for (var i = 0; i < btns.length; i++) {
        var onB = btns[i].getAttribute('data-bill') === mode;
        btns[i].classList.toggle('on', onB);
        btns[i].setAttribute('aria-pressed', onB ? 'true' : 'false');
      }
      var els = document.querySelectorAll('.tiers [data-m]');
      for (var j = 0; j < els.length; j++) els[j].textContent = els[j].getAttribute(mode === 'y' ? 'data-y' : 'data-m');
      if (note) {
        var D = d();
        note.textContent = mode === 'y'
          ? (D < 0.55 ? 'Annual billing: $228 a year for Grove — you save $60.' : D < 0.8 ? 'Billed yearly. Collected nightly.' : 'Billed once a year, in rings.')
          : '';
      }
    }
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () { set(this.getAttribute('data-bill')); });
  }

  /* privacy / terms anchors: highlight the honest note they land on */
  function initFootNotes() {
    function flash() {
      var id = (location.hash || '').slice(1);
      if (id !== 'privacy' && id !== 'terms') return;
      var n = document.getElementById(id); if (!n) return;
      n.classList.remove('is-lit'); void n.offsetWidth; n.classList.add('is-lit');
    }
    window.addEventListener('hashchange', flash);
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href="#privacy"], a[href="#terms"]');
      if (a) setTimeout(flash, 30);
    });
  }

  /* =========================================================
     5. Return visit: it kept your place
     ========================================================= */
  var NAMES = { hero: 'the top', logos: 'the top', features: 'Features', bench: 'Benchmarks', how: 'How it works', voices: 'Customers',
    trace: 'Watch it think', pricing: 'Pricing', card: 'the model card', changelog: 'the changelog', faq: 'the questions',
    carve: 'the carving', end: 'the end', exit: 'the very end', foot: 'the very end' };
  function initReturn() {
    var h = H(); if (!h || !h.seen || !h.seen.prev) return;
    var p = h.seen.prev, where = p.section && document.getElementById(p.section) ? p.section : null;
    var ago = p.last ? h.dur((Date.now() - p.last) / 1000) : '';
    setTimeout(function () {
      var late = h.stage >= 2;
      var acts = [];
      if (where && where !== 'hero' && where !== 'logos') {
        acts.push({ label: late ? 'Go back to where you were' : 'Resume where you left off', primary: true, fn: function () { goTo('#' + where); } });
      }
      acts.push({ label: 'Stay at the top' });
      notify({
        id: 'return', kind: 'away', ttl: 16000, meta: 'visit ' + h.seen.visit,
        title: late ? 'It kept your place' : 'Welcome back',
        body: (late ? 'You were here ' + ago + ' ago. You left at ' + (p.leftHM || '—') + ', from ' + (NAMES[p.section] || 'the page') + '.'
                    : 'You were last here ' + ago + ' ago. Pick up from ' + (NAMES[p.section] || 'where you were') + '?'),
        actions: acts
      });
    }, 2600);
  }

  /* =========================================================
     boot
     ========================================================= */
  function boot() {
    var h = H();
    if (h) { h.notify = notify; h.goTo = goTo; h.hushToasts = hushAll; }
    try { initMenu(); } catch (e) { if (window.console) console.error('[ui] menu', e); }
    try { initRouter(); } catch (e) { if (window.console) console.error('[ui] router', e); }
    try { initBilling(); } catch (e) { if (window.console) console.error('[ui] billing', e); }
    try { initFootNotes(); } catch (e) {}
    try { initSoundOffer(); } catch (e) { if (window.console) console.error('[ui] sound offer', e); }
    try { initReturn(); } catch (e) { if (window.console) console.error('[ui] return', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
