/* UNDERSTORY v2 — audio.js
   Opt-in synthesised Web Audio. Off by default; no files, nothing fetched.
   The AudioContext is only ever created synchronously inside a user gesture
   (the portal's sound switch, Connect, or a Sound button). On iOS the audio
   session is set to "playback" so the silent switch does not mute it.

   Sound design: everything is pitched. The room is a held chord in a glassy
   additive voice (each note a pair of oscillators a fraction of a hertz
   apart, so it beats; each breathing on its own slow cycle) that narrows
   with the subnet: bright, minor, diminished, hollow, then one beating
   interval at /32. Fundamentals sit at 185–440 Hz with harmonics above so
   phone speakers carry it; a quiet sub is only support for headphones.
   There is no continuous noise. Events are short and specific: a connect
   chime, a notification blip, a lookup "resolve", a falling two-note drop,
   one step-down motif per mask (the same motif, lower, narrower and slower
   each time), the ARP question that never resolves, relay ticks. Space comes
   from a small feedback-delay network. The face-down stretch is a clock that
   slowly loses time over a held tone; the false ending is silence.

   Output chain: bus → master (2 s fades) → compressor → limiter. Every
   envelope is ramped; nothing starts at full level. Suspended while the tab
   is hidden. Disconnect fades out in 0.3 s and closes the context. */
(function () {
  "use strict";
  var US = window.US;
  if (!US || typeof US.on !== "function") return;
  var AC = window.AudioContext || window.webkitAudioContext;

  var MASKS = [0, 8, 16, 24, 30, 32];
  var MASTER = 0.9;
  // bed chords per mask stage (Hz): bright → minor → diminished → hollow → (one beating interval)
  var CHORDS = {
    0: [220.0, 277.18, 329.63, 440.0],
    8: [220.0, 277.18, 329.63, 415.3],
    16: [220.0, 261.63, 329.63, 392.0],
    24: [185.0, 220.0, 261.63, 311.13],
    30: [220.0, 329.63, 440.0, 466.16],
    32: [220.0, 220.0, 220.0, 220.0]
  };
  // how fast each note beats against its twin (Hz), and how loud the room is, per mask
  var BEAT = { 0: 0.18, 8: 0.25, 16: 0.45, 24: 0.8, 30: 1.6, 32: 2 };
  var BEDLVL = { 0: 1, 8: 1, 16: 0.95, 24: 0.9, 30: 0.8, 32: 0 };
  // the mask motif: three falling notes from a start pitch by a fixed step;
  // each narrowing starts lower, steps narrower (fourth → major third →
  // minor third → tone → semitone) and is played slower
  var MOTIF = {
    8: { f: 1318.5, r: 4 / 3, gap: 0.2, dc: 0.9 },
    16: { f: 1046.5, r: 5 / 4, gap: 0.28, dc: 1.3 },
    24: { f: 830.6, r: 6 / 5, gap: 0.38, dc: 1.8 },
    30: { f: 659.26, r: 9 / 8, gap: 0.52, dc: 2.6 },
    32: { f: 523.25, r: 16 / 15, gap: 0.72, dc: 3.6 }
  };
  var ARPF = [587.33, 659.25, 698.46, 783.99];

  var ctx = null, master = null, bus = null, comp = null, lim = null, tapNode = null, room = null, glassW = null;
  var bed = null, watch = null, flood = null, s32 = null;
  var on = false, blanked = false, faceLow = false, packets = [], lastTone = {};

  function mask() { var m = +US.mask; return MASKS.indexOf(m) >= 0 ? m : 0; }
  function now() { return ctx ? ctx.currentTime : 0; }
  function rnd() { return Math.random(); }
  function semi(n) { return Math.pow(2, n / 12); }
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
  function G(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
  function O(type, f) { var o = ctx.createOscillator(); if (type === "glass") o.setPeriodicWave(glassW); else o.type = type; o.frequency.value = f; return o; }

  /* a small room: two allpass diffusers into six damped feedback combs (each a
     single loop with a one-pole damper, so its gain never exceeds one), slowly
     modulated; returns its input, its output goes through the bus */
  function makeRoom(rt, damp, scale) {
    function allpass(dt, g) {
      var inp = G(1), sum = G(1), dl = ctx.createDelay(0.1), fb = G(g), ff = G(-g), out = G(1);
      dl.delayTime.value = dt; inp.connect(sum); sum.connect(dl); dl.connect(fb); fb.connect(sum);
      sum.connect(ff); ff.connect(out); dl.connect(out);
      return { input: inp, output: out };
    }
    var a = Math.exp(-2 * Math.PI * damp / ctx.sampleRate);
    var input = G(1), hp = ctx.createBiquadFilter(), ap1 = allpass(0.0051, 0.6), ap2 = allpass(0.0017, 0.6), out = ctx.createChannelMerger(2);
    hp.type = "highpass"; hp.frequency.value = 200;
    input.connect(hp); hp.connect(ap1.input); ap1.output.connect(ap2.input);
    [0.0297, 0.0371, 0.0411, 0.0437, 0.0503, 0.0571].forEach(function (d0, i) {
      var d = d0 * scale, s = G(1), dl = ctx.createDelay(0.5), lp = ctx.createIIRFilter([1 - a], [1, -a]), fb = G(Math.pow(10, -3 * d / rt)), o = G(i % 2 ? -0.3 : 0.3);
      var m = O("sine", 0.08 + i * 0.047), mg = G(0.0003);
      dl.delayTime.value = d; m.connect(mg); mg.connect(dl.delayTime); m.start();
      ap2.output.connect(s); s.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(s); lp.connect(o); o.connect(out, 0, i % 2);
    });
    var og = G(1.4); out.connect(og); og.connect(bus);   // tails go through the bus, so blanking silences them too
    return input;
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

    var a = [0, 1, 0.4, 0.22, 0.12, 0.07, 0.04, 0.022];
    glassW = ctx.createPeriodicWave(new Float32Array(a.length), new Float32Array(a));
    room = makeRoom(1.8, 3600, 1.2);

    buildBed();
    return true;
  }

  // the room tone: four glass voices (each a beating pair, each breathing) and a quiet sub
  // open voicing: the root where written, the upper three notes an octave higher (phone speakers)
  function vf(ch, i) { return ch[i] * (i ? 2 : 1); }
  function buildBed() {
    var b = { out: G(0), sub: G(0.012), pad: G(0.085), oscs: [], twins: [], subs: [] };
    b.out.connect(bus);
    b.sub.connect(b.out);
    var send = G(0.25); b.pad.connect(b.out); b.out.connect(send); send.connect(room);
    [55, 110.4].forEach(function (f) { var o = O("sine", f); o.connect(b.sub); o.start(); b.subs.push(o); });
    var ch = CHORDS[mask()], bt = BEAT[mask()];
    ch.forEach(function (f0, i) {
      var f = vf(ch, i), o = O("glass", f), o2 = O("glass", f + bt * (1 + i * 0.3)), ag = G(0.5), g = G([0.36, 0.34, 0.3, 0.17][i]);
      var l = O("sine", 0.031 + i * 0.019), lg = G(0.2); l.connect(lg); lg.connect(ag.gain); l.start();
      o.connect(ag); o2.connect(ag); ag.connect(g); g.connect(b.pad); o.start(); o2.start();
      b.oscs.push(o); b.twins.push(o2);
    });
    bed = b;
  }
  function bedTarget() {
    if (blanked) return 0;
    var st = US.state;
    if (st === "manifest" || st === "disconnected" || st === "done") return 0;   // the false ending is silence
    if (faceLow) return 0.35;
    if (mask() >= 32) return 0;
    return BEDLVL[mask()];
  }
  function bedForMask(secs) {
    if (!bed) return;
    var m = mask(), ch = CHORDS[m], bt = BEAT[m];
    bed.oscs.forEach(function (o, i) { glide(o.frequency, vf(ch, i), secs); glide(bed.twins[i].frequency, vf(ch, i) + bt * (1 + i * 0.3), secs); });
    bed.subs.forEach(function (o) { ramp(o.detune, -100 * MASKS.indexOf(m), secs); });
    ramp(bed.out.gain, bedTarget(), Math.min(secs, 2));
  }

  /* ==== voices ==== */
  // a struck/bell tone: partials [ratio, amp], ramped in and exponentially out
  function bell(freq, at, dur, gain, opt) {
    if (!ctx || !on) return;
    opt = opt || {};
    var t = ctx.currentTime + 0.01 + (at || 0);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + (opt.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(opt.dest || bus);
    if (opt.wet) { var w = G(opt.wet); g.connect(w); w.connect(room); }
    var parts = opt.partials || [[1, 1], [2, 0.25], [3.01, 0.08]];
    parts.forEach(function (p) {
      var o = ctx.createOscillator(); o.type = opt.type || "sine";
      o.frequency.setValueAtTime(freq * p[0], t);
      if (opt.slide) o.frequency.exponentialRampToValueAtTime(freq * p[0] * opt.slide, t + dur * (opt.slideAt || 0.6));
      if (opt.detune) o.detune.value = opt.detune;
      var pg = ctx.createGain(); pg.gain.value = p[1];
      o.connect(pg); pg.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }
  var GLASS = [[1, 1], [2, 0.3], [3.01, 0.1], [4.2, 0.03]];
  var BELLP = [[1, 1], [2, 0.32], [2.76, 0.12], [5.4, 0.04]];
  // a relay/LED tick: a tiny struck object, no noise
  function tick(at, gain, freq, dur, dest) {
    if (!ctx || !on) return;
    bell(freq || 3000, at, dur || 0.03, gain, { partials: [[1, 1], [1.58, 0.5], [2.37, 0.25]], attack: 0.0015, dest: dest });
  }
  // simple feedback echo, for the ARP calls
  var echo = null;
  function echoIn() {
    if (echo || !ctx) return echo && echo.input;
    var input = ctx.createGain(), dl = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.42; fb.gain.value = 0.42; wet.gain.value = 0.5; lp.type = "lowpass"; lp.frequency.value = 2400;
    input.connect(bus); input.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(bus);
    var rs = G(0.3); wet.connect(rs); rs.connect(room);
    echo = { input: input };
    return input;
  }
  function limited(name, ms) {
    var t = Date.now();
    if (lastTone[name] && t - lastTone[name] < ms) return true;
    lastTone[name] = t; return false;
  }
  function motif(m) {
    var M = MOTIF[m]; if (!M) return;
    for (var i = 0; i < 3; i++) {
      bell(M.f / Math.pow(M.r, i), i * M.gap, M.dc * (i === 2 ? 1.6 : 1), 0.1, { partials: BELLP, wet: 0.5 });
    }
  }

  // one recognisable cue per event
  var CUES = {
    // the portal's switch: a short "connected" chime so the visitor knows sound works
    test: function () { bell(880, 0.05, 0.7, 0.14, { partials: GLASS, wet: 0.3 }); bell(1318.5, 0.2, 1.1, 0.13, { partials: GLASS, wet: 0.3 }); },
    connect: function () { [659.25, 880, 1318.5].forEach(function (f, i) { bell(f, i * 0.12, i === 2 ? 1.3 : 0.55, 0.09, { partials: GLASS, wet: 0.3 }); }); },
    // product UI blip for toasts, fades out of the product as the mask narrows
    toast: function () {
      if (blanked || limited("toast", 900)) return;
      var m = mask();
      if (m >= 24) return;
      if (m >= 16) { bell(392, 0, 0.4, 0.06, { partials: GLASS }); return; }
      bell(1046.5, 0, 0.12, 0.055, { partials: [[1, 1], [2, 0.15]] }); bell(1318.5, 0.07, 0.25, 0.055, { partials: [[1, 1], [2, 0.15]], wet: 0.2 });
    },
    // each mask step: the same falling motif, lower, narrower, slower
    mask: function (m) { if (!blanked) motif(m); },
    // a host leaving: a relay click, then a falling two-note figure that sags
    drop: function () {
      if (blanked || limited("drop", 600)) return;
      tick(0, 0.045, 2200, 0.025);
      bell(783.99, 0.03, 0.4, 0.085, { partials: GLASS });
      bell(523.25, 0.27, 1.1, 0.075, { partials: GLASS, slide: semi(-0.6), slideAt: 0.9, wet: 0.35 });
    },
    // a lookup: a quick rising query pip and the same flat "resolved" answer every time (0.0.0.0)
    lookup: function () {
      if (blanked || limited("lookup", 250)) return;
      var low = mask() >= 30 ? 0.5 : 1;
      bell(1174.66 * low, 0, 0.07, 0.04, { partials: [[1, 1]] });
      bell(1567.98 * low, 0.06, 0.08, 0.04, { partials: [[1, 1]] });
      bell(783.99 * low, 0.16, 0.6, 0.08, { partials: GLASS, wet: 0.25 });
    },
    // ARP who-has: a rising tritone that bends up like a question, and an echo that never gets an answer
    arp: function () {
      if (blanked || limited("arp", 1500)) return;
      var m = mask(), f = ARPF[Math.floor(rnd() * ARPF.length)];
      var g = m >= 16 ? 0.07 : 0.05, inp = echoIn();
      bell(f, 0, 0.35, g, { dest: inp, partials: [[1, 1], [2, 0.12]] });
      bell(f * semi(6), 0.2, 0.75, g * 0.9, { dest: inp, partials: [[1, 1], [2, 0.12]], slide: semi(0.6), slideAt: 0.5 });
    },
    // a packet in the log: one soft relay tick
    packet: function () {
      if (blanked) return;
      var t = now(); packets = packets.filter(function (x) { return t - x < 1; });
      if (packets.length >= 3) return; packets.push(t);
      tick(0, mask() >= 16 ? 0.022 : 0.032, 2900 + rnd() * 300, 0.018);
    },
    lease: function (big) {
      if (blanked) return;
      if (big) { [392, 493.88, 587.33, 783.99].forEach(function (f, i) { bell(f, i * 0.18, 3.5 - i * 0.3, 0.07, { partials: GLASS, wet: 0.4 }); }); return; }
      if (limited("lease", 3000)) return;
      bell(987.77, 0, 0.6, 0.045, { partials: [[1, 1], [2, 0.12]], wet: 0.25 });
    },
    // one soft key per terminal line, so the voice has a body
    termline: function (d) {
      if (blanked || limited("termline", 120)) return;
      if (d && d.machine) tick(0, 0.03, 3300, 0.015);
      else { tick(0, 0.035, 1900, 0.012); bell(240, 0, 0.05, 0.06, { partials: [[1, 1], [2.4, 0.3]], attack: 0.002 }); }
    },
    doneLine: function () { bell(329.63, 0, 4, 0.12, { partials: GLASS, dest: master }); },
    face: function () { bell(587.33, 0, 1.4, 0.07, { partials: GLASS, wet: 0.4 }); bell(440, 0.5, 2.4, 0.07, { partials: GLASS, wet: 0.4 }); }
  };
  // during the false ending and the face-down overlay only their own sounds play
  var QUIET_OK = { done: { doneLine: 1 }, face: { face: 1, test: 1 } };
  function cue(name, data) {
    if (!ctx || !on) return;
    var q = QUIET_OK[US.state];
    if (q && !q[name]) return;
    try { if (CUES[name]) CUES[name](data); } catch (e) {}
  }

  /* ==== the face-down stretch: the screen is dark, so it must be heard ====
     A held tone (D, beating slowly against its twin) and a clock: tick, tock,
     in time at first, then each beat a little late, until it is plainly
     not keeping time any more. */
  function watchStart(count) {
    if (!ctx || !on || watch) return;
    var w = { out: G(0), timers: [] };
    w.out.connect(bus);
    var hg = G(0.05), hs = G(0.3); hg.connect(w.out); hg.connect(hs); hs.connect(room);
    var o1 = O("glass", 293.66), o2 = O("glass", 294.11), o3 = O("sine", 587.9), o3g = G(0.25);
    o1.connect(hg); o2.connect(hg); o3.connect(o3g); o3g.connect(hg);
    o1.start(); o2.start(); o3.start();
    w.nodes = [o1, o2, o3];
    ramp(w.out.gain, 1, 2.5);
    var i = 0, max = count ? 20 : 45, late = 0;
    var step = function () {
      if (watch !== w || !on) return;
      i++;
      if (!blanked) {
        var acc = i % 5 === 0;
        tick(0, acc ? 0.075 : 0.06, i % 2 ? 1250 : 1040, 0.05, w.out);
        bell(i % 2 ? 420 : 350, 0, 0.07, acc ? 0.05 : 0.035, { partials: [[1, 1], [2.31, 0.4]], attack: 0.002, dest: w.out });
      }
      // in time for the first six; then it starts to drag, a little more each beat, and wobbles
      if (i > 6) late += 14 + (i - 6) * 3.2;
      var next = 1000 + late * 0.35 + (i > 6 ? (rnd() - 0.5) * 60 : 0);
      if (i < max) w.timers.push(setTimeout(step, next));
    };
    w.timers.push(setTimeout(step, 1200));
    watch = w;
  }
  function watchStop(secs) {
    if (!watch || !ctx) return;
    var w = watch; watch = null;
    w.timers.forEach(clearTimeout);
    ramp(w.out.gain, 0, secs || 1.5);
    setTimeout(function () { w.nodes.forEach(function (x) { try { x.stop(); } catch (e) {} }); try { w.out.disconnect(); } catch (e) {} }, ((secs || 1.5) + 0.3) * 1000);
  }

  /* ==== B12 flood: a thickening swarm of tiny packet pips; B12 collapse: one beating interval ==== */
  function floodStart() {
    if (!ctx || !on || flood) return;
    var f = { g: G(0), t0: now(), next: now() + 0.1, timer: 0 };
    f.g.connect(bus); var fs = G(0.3); f.g.connect(fs); fs.connect(room);
    ramp(f.g.gain, 1, 6);
    var POOL = [880, 987.77, 1108.73, 1174.66, 1318.51, 1479.98, 1661.22, 1760];
    f.timer = setInterval(function () {
      if (!ctx || flood !== f || !on) return;
      var el = now() - f.t0, rate = 2 + Math.min(1, el / 16) * 22, horizon = now() + 0.25;
      while (f.next < horizon) {
        var k = Math.floor(rnd() * POOL.length), lift = semi(Math.min(1, el / 18) * 3);
        bell(POOL[k] * lift, f.next - now(), 0.06 + rnd() * 0.05, 0.02 + 0.012 * rnd(), { partials: [[1, 1], [2, 0.15]], attack: 0.003, dest: f.g });
        f.next += (0.4 + rnd() * 1.2) / rate;
      }
    }, 100);
    flood = f;
  }
  function floodStop(secs) {
    if (!flood || !ctx) return;
    var f = flood; flood = null;
    clearInterval(f.timer);
    ramp(f.g.gain, 0, secs || 0.2);
  }
  function startS32() {
    if (!ctx || !on || s32) return;
    var g = G(0); g.connect(bus); var sg = G(0.3); g.connect(sg); sg.connect(room);
    var oscs = [["glass", 440, 0.5], ["glass", 442.6, 0.5], ["sine", 220.3, 0.35], ["sine", 880.9, 0.08]].map(function (p) {
      var o = O(p[0], p[1]), og = G(p[2]);
      o.connect(og); og.connect(g); o.start(); return o;
    });
    s32 = { g: g, oscs: oscs };
    ramp(g.gain, 0.085, 4);
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
    if (opt && opt.test) { ramp(master.gain, MASTER, 0.04); cue("test"); }
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
    if (flood) clearInterval(flood.timer);
    if (watch) watch.timers.forEach(clearTimeout);
    ramp(master.gain, 0, 0.3);
    setTimeout(function () { try { c.close(); } catch (e) {} }, 380);
    ctx = null; master = bus = comp = lim = tapNode = room = null; bed = watch = flood = s32 = echo = null;
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
    if (s === "done" && bed) ramp(bed.out.gain, 0, 2.5);
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
