/* UNDERSTORY v2 — audio.js
   Opt-in synthesised Web Audio. Off by default; no files, nothing fetched.
   The AudioContext is only ever created synchronously inside a user gesture
   (the portal's sound switch, Connect, or a Sound button). On iOS the audio
   session is set to "playback" so the silent switch does not mute it.

   Mixing: everything that matters sits in the 300 Hz – 3 kHz band so phone
   and laptop speakers reproduce it; the sub hum is only a bonus for
   headphones. Output chain: bus → master (2 s fades) → compressor → limiter.
   Every envelope is ramped; nothing starts at full level. Suspended while the
   tab is hidden. Disconnect fades out in 0.3 s and closes the context. */
(function () {
  "use strict";
  var US = window.US;
  if (!US || typeof US.on !== "function") return;
  var AC = window.AudioContext || window.webkitAudioContext;

  var MASKS = [0, 8, 16, 24, 30, 32];
  var MASTER = 0.9;
  // bed chords per mask stage (Hz): bright → minor → hollow → one note
  var CHORDS = {
    0: [220.0, 277.18, 329.63],
    8: [220.0, 277.18, 329.63],
    16: [220.0, 261.63, 329.63],
    24: [185.0, 220.0, 261.63],
    30: [110.0, 164.81, 220.0],
    32: [220.0, 220.0, 220.0]
  };
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  var ctx = null, master = null, bus = null, comp = null, lim = null, tapNode = null;
  var bed = null, watch = null, flood = null, s32 = null, noiseBuf = null;
  var on = false, blanked = false, faceLow = false, packets = [], lastTone = {};

  function mask() { var m = +US.mask; return MASKS.indexOf(m) >= 0 ? m : 0; }
  function now() { return ctx ? ctx.currentTime : 0; }
  function ramp(param, v, secs, at) {
    if (!ctx || !param) return;
    var t = at || ctx.currentTime;
    try {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(v, t + Math.max(0.02, secs));
    } catch (e) {}
  }
  function glide(param, v, secs) {
    if (!ctx || !param) return;
    var t = ctx.currentTime;
    try { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.exponentialRampToValueAtTime(Math.max(1, v), t + Math.max(0.05, secs)); } catch (e) {}
  }

  /* ==== build: only ever called synchronously from a gesture handler ==== */
  function build() {
    if (ctx) return true;
    if (!AC) return false;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return false; } }
    // unlock (iOS): a one-sample silent buffer started inside the gesture
    try { var sb = ctx.createBuffer(1, 1, ctx.sampleRate), ss = ctx.createBufferSource(); ss.buffer = sb; ss.connect(ctx.destination); ss.start(0); } catch (e) {}
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.35;
    lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    master = ctx.createGain(); master.gain.value = 0;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(master); master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);

    var len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    buildBed();
    return true;
  }

  function noiseSrc(loop) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s;
  }

  // the room: sub hum (headphones), a soft triad pad (speakers), a fan of filtered noise
  function buildBed() {
    var b = { out: ctx.createGain(), sub: ctx.createGain(), pad: ctx.createGain(), fan: ctx.createGain(), oscs: [], subs: [] };
    b.out.gain.value = 0; b.out.connect(bus);
    b.sub.gain.value = 0.05; b.sub.connect(b.out);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500; lp.Q.value = 0.4;
    b.lp = lp;
    b.pad.gain.value = 0.045; lp.connect(b.pad); b.pad.connect(b.out);
    [55, 110.4].forEach(function (f) { var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(b.sub); o.start(); b.subs.push(o); });
    var ch = CHORDS[mask()];
    ch.forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = (i - 1) * 4;
      var g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.33;
      o.connect(g); g.connect(lp); o.start(); b.oscs.push(o);
    });
    // slow breathing tremolo on the pad
    var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 0.015; lfo.connect(lfoG); lfoG.connect(b.pad.gain); lfo.start(); b.lfo = lfo;
    var fan = noiseSrc(true), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 650; bp.Q.value = 0.8;
    b.fan.gain.value = 0.010; fan.connect(bp); bp.connect(b.fan); b.fan.connect(b.out); fan.start();
    b.fanSrc = fan; b.fanBp = bp;
    bed = b;
  }
  function bedTarget() {
    if (blanked) return 0;
    var st = US.state;
    if (st === "manifest" || st === "disconnected") return 0;
    if (faceLow) return 0.35;
    if (mask() >= 32) return 0;
    return 1;
  }
  function bedForMask(secs) {
    if (!bed) return;
    var m = mask(), ch = CHORDS[m];
    bed.oscs.forEach(function (o, i) { glide(o.frequency, ch[i], secs); });
    bed.subs.forEach(function (o, i) { ramp(o.detune, -100 * MASKS.indexOf(m), secs); });
    ramp(bed.lp.frequency, 1500 - m * 25, secs);
    // the fan gets audible as it gets quieter everywhere else (s16–s24), gone in the terminal
    ramp(bed.fan.gain, m >= 30 ? 0.0 : (m >= 16 ? 0.02 : 0.010), secs);
    ramp(bed.pad.gain, m >= 30 ? 0.03 : 0.045, secs);
    ramp(bed.out.gain, bedTarget(), Math.min(secs, 2));
  }

  /* ==== voices ==== */
  // a bell-ish tone: sine + soft octave partial, ramped in and exponentially out
  function bell(freq, at, dur, gain, opt) {
    if (!ctx || !on) return;
    opt = opt || {};
    var t = ctx.currentTime + (at || 0);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + (opt.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(opt.dest || bus);
    var parts = opt.partials || [[1, 1], [2, 0.25], [3.01, 0.08]];
    parts.forEach(function (p) {
      var o = ctx.createOscillator(); o.type = opt.type || "sine";
      o.frequency.setValueAtTime(freq * p[0], t);
      if (opt.slide) o.frequency.exponentialRampToValueAtTime(freq * p[0] * opt.slide, t + dur * 0.6);
      if (opt.detune) o.detune.value = opt.detune;
      var pg = ctx.createGain(); pg.gain.value = p[1];
      o.connect(pg); pg.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function click(at, gain, freq, dur) {
    if (!ctx || !on || !noiseBuf) return;
    var t = ctx.currentTime + (at || 0);
    var s = noiseSrc(false), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = freq || 2500; bp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.03));
    s.connect(bp); bp.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + (dur || 0.03) + 0.02);
  }
  // simple feedback echo, for the ARP calls
  var echo = null;
  function echoIn() {
    if (echo || !ctx) return echo && echo.input;
    var input = ctx.createGain(), dl = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.42; fb.gain.value = 0.38; wet.gain.value = 0.5; lp.type = "lowpass"; lp.frequency.value = 2200;
    input.connect(bus); input.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(bus);
    echo = { input: input };
    return input;
  }
  function limited(name, ms) {
    var t = Date.now();
    if (lastTone[name] && t - lastTone[name] < ms) return true;
    lastTone[name] = t; return false;
  }

  // one recognisable cue per event
  var CUES = {
    // the portal's switch: a short "connected" chime so the visitor knows sound works
    test: function () { bell(880, 0, 0.5, 0.11); bell(1318.5, 0.14, 0.9, 0.10); },
    connect: function () { bell(659.25, 0, 0.5, 0.09); bell(880, 0.12, 0.5, 0.09); bell(1318.5, 0.24, 1.1, 0.09); },
    // product UI pop for toasts, fades out of the product as the mask narrows
    toast: function () {
      if (blanked || limited("toast", 900)) return;
      var m = mask();
      if (m >= 24) return;
      if (m >= 16) { bell(392, 0, 0.35, 0.05, { partials: [[1, 1]] }); return; }
      bell(1046.5, 0, 0.12, 0.06, { partials: [[1, 1]] }); bell(1318.5, 0.07, 0.22, 0.06, { partials: [[1, 1]] });
    },
    // each mask step: a chime that loses notes and drops in pitch
    mask: function (m) {
      if (blanked) return;
      if (m === 8) { bell(1318.5, 0, 0.9, 0.10); bell(1046.5, 0.22, 0.9, 0.10); bell(880, 0.44, 1.6, 0.10); }
      else if (m === 16) { bell(880, 0, 1.2, 0.10, { detune: -8 }); bell(659.25, 0.35, 2.2, 0.10, { detune: 6 }); }
      else if (m === 24) { bell(523.25, 0, 1.8, 0.11, { detune: -12 }); bell(392, 0.6, 3.2, 0.11, { detune: 10 }); }
      else if (m === 30) { bell(329.63, 0, 4.5, 0.13, { partials: [[1, 1], [1.5, 0.3], [2.01, 0.15]] }); }
      else if (m === 32) { bell(440, 0, 6, 0.10, { partials: [[1, 1], [1.003, 0.8]] }); }
    },
    // a host leaving: a falling "unplugged" figure
    drop: function () {
      if (blanked || limited("drop", 600)) return;
      bell(783.99, 0, 0.45, 0.08, { type: "triangle", partials: [[1, 1]], slide: 0.667 });
      bell(523.25, 0.3, 0.9, 0.06, { type: "triangle", partials: [[1, 1]] });
      click(0.02, 0.03, 1200, 0.12);
    },
    // a lookup: a question pip and the same flat answer every time (0.0.0.0)
    lookup: function (d) {
      if (blanked || limited("lookup", 250)) return;
      var low = mask() >= 30 ? 0.5 : 1;
      bell(1568 * low, 0, 0.09, 0.05, { partials: [[1, 1]] });
      bell(784 * low, 0.11, 0.5, 0.08, { partials: [[1, 1], [2, 0.15]] });
    },
    // ARP who-has: a two-note rising question, with an echo that never gets an answer
    arp: function () {
      if (blanked || limited("arp", 1500)) return;
      var m = mask(), i = Math.floor(Math.random() * (PENTA.length - 1));
      var g = m >= 16 ? 0.07 : 0.045, inp = echoIn();
      bell(PENTA[i], 0, 0.6, g, { dest: inp, partials: [[1, 1], [2, 0.1]] });
      bell(PENTA[i + 1], 0.22, 0.9, g * 0.9, { dest: inp, partials: [[1, 1], [2, 0.1]] });
    },
    packet: function () {
      if (blanked) return;
      var t = now(); packets = packets.filter(function (x) { return t - x < 1; });
      if (packets.length >= 3) return; packets.push(t);
      click(0, mask() >= 16 ? 0.025 : 0.04, 2600, 0.012);
    },
    lease: function (big) {
      if (blanked) return;
      if (big) { [392, 493.88, 587.33, 783.99].forEach(function (f, i) { bell(f, i * 0.18, 3.5 - i * 0.3, 0.07); }); return; }
      if (limited("lease", 3000)) return;
      bell(987.77, 0, 0.6, 0.04, { partials: [[1, 1]] });
    },
    // one soft key per terminal line, so the voice has a body
    termline: function (d) {
      if (blanked || limited("termline", 120)) return;
      if (d && d.machine) click(0, 0.03, 3200, 0.015);
      else click(0, 0.035, 900, 0.05);
    },
    doneLine: function () { bell(329.63, 0, 4, 0.12, { partials: [[1, 1], [2, 0.2]], dest: master }); },
    face: function () { bell(587.33, 0, 1.4, 0.07); bell(440, 0.5, 2.4, 0.07); }
  };
  // during the false ending and the face-down overlay only their own sounds play
  var QUIET_OK = { done: { doneLine: 1 }, face: { face: 1, test: 1 } };
  function cue(name, data) {
    if (!ctx || !on) return;
    var q = QUIET_OK[US.state];
    if (q && !q[name]) return;
    try { if (CUES[name]) CUES[name](data); } catch (e) {}
  }

  /* ==== the face-down stretch: the screen is dark, so it must be heard ==== */
  function watchStart(count) {
    if (!ctx || !on || watch) return;
    var w = { out: ctx.createGain(), timers: [] };
    w.out.gain.value = 0; w.out.connect(bus);
    // breathing: low noise swelling at ~7 s per breath
    var n = noiseSrc(true), lp = ctx.createBiquadFilter(), bg = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 0.3;
    bg.gain.value = 0.03; lfo.frequency.value = 0.14; lfoG.gain.value = 0.028;
    lfo.connect(lfoG); lfoG.connect(bg.gain);
    n.connect(lp); lp.connect(bg); bg.connect(w.out);
    n.start(); lfo.start();
    // a low held note under it
    var o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle"; o.frequency.value = 220; og.gain.value = 0.03;
    o.connect(og); og.connect(w.out); o.start();
    w.nodes = [n, lfo, o];
    ramp(w.out.gain, 1, 2.5);
    // counting: one soft wooden tock per second (twenty when it is counting for you)
    var i = 0, max = count ? 20 : 45;
    var tick = function () {
      if (watch !== w || !on) return;
      i++;
      if (!blanked) { bell(i % 5 === 0 ? 523.25 : 440, 0, 0.18, 0.06, { partials: [[1, 1], [2.76, 0.2]], attack: 0.003 }); click(0, 0.02, 1500, 0.02); }
      if (i < max) w.timers.push(setTimeout(tick, 1000));
    };
    w.timers.push(setTimeout(tick, 1200));
    watch = w;
  }
  function watchStop(secs) {
    if (!watch || !ctx) return;
    var w = watch; watch = null;
    w.timers.forEach(clearTimeout);
    ramp(w.out.gain, 0, secs || 1.5);
    setTimeout(function () { w.nodes.forEach(function (x) { try { x.stop(); } catch (e) {} }); try { w.out.disconnect(); } catch (e) {} }, ((secs || 1.5) + 0.3) * 1000);
  }

  /* ==== B12 flood: a rustle that thickens; B12 collapse: one beating note ==== */
  function floodStart() {
    if (!ctx || !on || flood) return;
    var n = noiseSrc(true), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 1.2; g.gain.value = 0;
    n.connect(bp); bp.connect(g); g.connect(bus); n.start();
    ramp(g.gain, 0.06, 14);
    glide(bp.frequency, 2400, 18);
    flood = { n: n, g: g };
  }
  function floodStop(secs) {
    if (!flood || !ctx) return;
    var f = flood; flood = null;
    ramp(f.g.gain, 0, secs || 0.2);
    setTimeout(function () { try { f.n.stop(); } catch (e) {} }, ((secs || 0.2) + 0.2) * 1000);
  }
  function startS32() {
    if (!ctx || !on || s32) return;
    var g = ctx.createGain(); g.gain.value = 0; g.connect(bus);
    var oscs = [[220, 0.5], [220.6, 0.5], [440, 0.35], [440.7, 0.35]].map(function (p) {
      var o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = p[0]; og.gain.value = p[1];
      o.connect(og); og.connect(g); o.start(); return o;
    });
    s32 = { g: g, oscs: oscs };
    ramp(g.gain, 0.07, 4);
  }
  function stopS32(secs) {
    if (!s32 || !ctx) return;
    var s = s32; s32 = null;
    ramp(s.g.gain, 0, secs || 3);
    setTimeout(function () { s.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, ((secs || 3) + 0.2) * 1000);
  }

  /* ==== on / off ==== */
  function enable(opt) {
    if (!build()) return false;
    on = true;
    try { if (ctx.state === "suspended" && !document.hidden) ctx.resume(); } catch (e) {}
    ramp(master.gain, MASTER, 2);
    if (US.state !== "portal" && US.state !== "manifest" && US.state !== "disconnected") bedForMask(0.5);
    if (mask() >= 32 && (US.state === "term" || US.state === "last" || US.state === "coda")) startS32();
    if (opt && opt.test) { var p = master.gain; ramp(p, MASTER, 0.08); cue("test"); }
    return true;
  }
  function disable() {
    on = false;
    if (!ctx) return;
    ramp(master.gain, 0, 0.6);
    watchStop(0.3); floodStop(0.3);
    var c = ctx;
    setTimeout(function () { if (!on && ctx === c && c.state === "running") { try { c.suspend(); } catch (e) {} } }, 900);
  }
  function shutdown() {
    on = false;
    if (!ctx) return;
    var c = ctx;
    ramp(master.gain, 0, 0.3);
    setTimeout(function () { try { c.close(); } catch (e) {} }, 380);
    ctx = null; master = bus = comp = lim = tapNode = null; bed = watch = flood = s32 = echo = null;
  }
  function setBlank(v) {
    blanked = !!v;
    if (!ctx) return;
    ramp(bus.gain, blanked ? 0 : 1, blanked ? 0.4 : 1.5);
    if (bed) ramp(bed.out.gain, bedTarget(), blanked ? 0.4 : 2);
  }

  US.audio = {
    enable: enable,
    disable: disable,
    stop: shutdown,
    cue: cue,
    isOn: function () { return on; },
    state: function () { return ctx ? ctx.state : "none"; },
    _ctx: function () { return ctx; },
    // test hook: an AnalyserNode on the output (created on demand, harmless)
    analyser: function () {
      if (!ctx) return null;
      if (!tapNode) { tapNode = ctx.createAnalyser(); tapNode.fftSize = 2048; lim.connect(tapNode); }
      return tapNode;
    }
  };

  /* ==== events ==== */
  US.on("sound", function (d) { if (d && !d.on) disable(); });
  US.on("connect", function (d) { if (d && d.sound) { if (!on) enable(); cue("connect"); } });
  US.on("state", function (d) {
    var s = d && d.state;
    if (!ctx) return;
    if (s === "panel" && d.prev === "handshake") bedForMask(2.5);
    if (s === "term" && blanked) setBlank(false);
    if (s === "term" || s === "last") bedForMask(2);
    if (s === "manifest" || s === "disconnected") { if (bed) ramp(bed.out.gain, 0, 3); }
    if (s === "portal" && d.prev && d.prev !== "portal") { setBlank(false); stopS32(0.5); if (bed) ramp(bed.out.gain, 0, 0.5); }
  });
  US.on("mask", function (d) {
    if (!ctx) return;
    bedForMask(d && d.jump ? 0.1 : 3);
    if (d && !d.jump) cue("mask", d.mask);
    if (mask() >= 32) { floodStop(0.15); startS32(); }
  });
  US.on("toast", function () { cue("toast"); });
  US.on("drop", function () { cue("drop"); });
  US.on("lookup", function (d) { if (d && d.q) cue("lookup", d); });
  US.on("lease", function (d) { cue("lease", !!(d && d.big)); });
  US.on("logline", function (d) { cue(d && d.arp ? "arp" : "packet"); });
  US.on("termline", function (d) { cue("termline", d); });
  US.on("flood", function () { floodStart(); });
  US.on("face", function (d) {
    var p = d && d.phase;
    if (!ctx || !on) return;
    if (p === "offer") { faceLow = true; if (bed) ramp(bed.out.gain, bedTarget(), 2); cue("face"); }
    else if (p === "dark") watchStart(!!(d && d.count));
    else if (p === "light") watchStop(1.5);
    else if (p === "end") { faceLow = false; watchStop(1); if (bed) ramp(bed.out.gain, bedTarget(), 2); }
  });
  US.on("blank", function (d) {
    var v = !!(d && d.on);
    if (d && d.line) { setBlank(false); if (bed) ramp(bed.out.gain, 0, 0.1); cue("doneLine"); return; }
    setBlank(v);
  });
  US.on("finale", function () { stopS32(4); floodStop(1); if (ctx && bed) ramp(bed.out.gain, 0, 4); });
  US.on("disconnect", shutdown);

  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    try {
      if (document.hidden) { if (ctx.state === "running") ctx.suspend(); }
      else if (on && ctx.state === "suspended") ctx.resume();
    } catch (e) {}
  });
  window.addEventListener("pagehide", function () { if (ctx) try { ctx.suspend(); } catch (e) {} });
})();
