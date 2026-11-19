/* UNDERSTORY v2 — audio.js (Builder C)
   Opt-in synthesised Web Audio. Off by default; no files. The AudioContext
   is only created inside a user gesture (Connect with "Play connection
   sounds" ticked, or the header Sound button). Compressor on the output,
   master ≤ 0.22 with 2 s fades, suspended while the tab is hidden. */
(function () {
  "use strict";
  var US = window.US;
  if (!US || typeof US.on !== "function") return;
  var AC = window.AudioContext || window.webkitAudioContext;

  var MASKS = [0, 8, 16, 24, 30, 32];
  var MASTER = 0.22, HUM = 0.03, PACKET = 0.012, ARP = 0.025, S32 = 0.02;
  var PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33]; // C major pentatonic

  var ctx = null, master = null, comp = null, bus = null, humGain = null, humLP = null, osc1 = null, osc2 = null;
  var s32 = null, on = false, wanted = false, blanked = false, faceLow = false, packets = [], noiseBuf = null;

  function mask() { var m = +US.mask; return MASKS.indexOf(m) >= 0 ? m : 0; }
  function gestureOK() {
    var ua = navigator.userActivation;
    return !ua || ua.isActive;
  }
  function ramp(param, v, secs) {
    if (!ctx || !param) return;
    var t = ctx.currentTime;
    try {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(v, t + Math.max(0.02, secs));
    } catch (e) {}
  }
  function humFreqs() {
    var idx = Math.max(0, MASKS.indexOf(mask()));
    return { detune: -100 * idx, lp: 600 - (420 * mask() / 32) };
  }
  function build() {
    if (ctx) return true;
    if (!AC || !gestureOK()) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(master); master.connect(comp); comp.connect(ctx.destination);

    humLP = ctx.createBiquadFilter(); humLP.type = "lowpass"; humLP.Q.value = 0.5;
    humGain = ctx.createGain(); humGain.gain.value = 0;
    osc1 = ctx.createOscillator(); osc1.type = "sine"; osc1.frequency.value = 55;
    osc2 = ctx.createOscillator(); osc2.type = "sine"; osc2.frequency.value = 110.4;
    var f = humFreqs();
    osc1.detune.value = f.detune; osc2.detune.value = f.detune; humLP.frequency.value = f.lp;
    osc1.connect(humLP); osc2.connect(humLP); humLP.connect(humGain); humGain.connect(bus);
    osc1.start(); osc2.start();

    var len = Math.floor(ctx.sampleRate * 0.03);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function humTarget() { return blanked ? 0 : (faceLow ? HUM * 0.08 : (mask() >= 32 ? HUM * 0.5 : HUM)); }

  function enable() {
    wanted = true;
    if (!build()) return false;
    on = true;
    try { if (ctx.state === "suspended" && !document.hidden) ctx.resume(); } catch (e) {}
    ramp(master.gain, MASTER, 2);
    ramp(humGain.gain, humTarget(), 2);
    if (mask() >= 32) startS32();
    return true;
  }
  function disable() {
    wanted = false; on = false;
    if (!ctx) return;
    ramp(master.gain, 0, 2);
    var c = ctx;
    setTimeout(function () { if (!on && ctx === c && c.state === "running") { try { c.suspend(); } catch (e) {} } }, 2100);
  }
  function shutdown() {
    on = false; wanted = false;
    if (!ctx) return;
    var c = ctx;
    ramp(master.gain, 0, 0.3);
    setTimeout(function () { try { c.close(); } catch (e) {} }, 350);
    ctx = null; master = comp = bus = humGain = humLP = osc1 = osc2 = s32 = null;
  }

  function tone(freq, startIn, dur, gain, type) {
    if (!ctx || !on) return;
    var t = ctx.currentTime + (startIn || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.25, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(blanked ? master : bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function packet() {
    if (!ctx || !on || blanked || !noiseBuf) return;
    var now = ctx.currentTime;
    packets = packets.filter(function (t) { return now - t < 1; });
    if (packets.length >= 3) return;
    packets.push(now);
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(PACKET, now + 0.001);
    g.gain.linearRampToValueAtTime(0, now + 0.004);
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start(now); src.stop(now + 0.02);
  }
  function arp() {
    if (mask() < 16 || blanked) return;
    tone(PENTA[Math.floor(Math.random() * PENTA.length)], 0, 1.4, ARP);
  }
  function drop() {
    if (blanked) return;
    tone(392, 0, 0.6, 0.02); tone(293.66, 0.32, 0.9, 0.018);
  }
  function startS32() {
    if (!ctx || !on || s32) return;
    var g = ctx.createGain(); g.gain.value = 0;
    var a = ctx.createOscillator(), b = ctx.createOscillator();
    a.frequency.value = 220; b.frequency.value = 220.6;
    a.connect(g); b.connect(g); g.connect(bus);
    a.start(); b.start();
    s32 = { g: g, a: a, b: b };
    ramp(g.gain, S32 / 2, 4); // two oscillators summed: keep the pair at ≤ .02
  }
  function stopS32(secs) {
    if (!s32 || !ctx) return;
    var s = s32; s32 = null;
    ramp(s.g.gain, 0, secs || 3);
    var c = ctx;
    setTimeout(function () { try { s.a.stop(); s.b.stop(); } catch (e) {} }, ((secs || 3) + 0.2) * 1000);
  }
  function onMask() {
    if (!ctx) return;
    var f = humFreqs(), t = 3;
    ramp(osc1.detune, f.detune, t); ramp(osc2.detune, f.detune, t);
    ramp(humLP.frequency, f.lp, t);
    if (on) ramp(humGain.gain, humTarget(), 2);
    if (mask() >= 32) startS32();
  }
  function setBlank(v) {
    blanked = !!v;
    if (!ctx) return;
    ramp(bus.gain, blanked ? 0 : 1, blanked ? 0.4 : 2);
    if (on) ramp(humGain.gain, humTarget(), blanked ? 0.4 : 2);
  }

  function cue(name, data) {
    try {
      switch (name) {
        case "packet": packet(); break;
        case "arp": arp(); break;
        case "drop": drop(); break;
        case "doneLine": if (on) { var w = blanked; blanked = true; tone(330, 0, 3, 0.03); blanked = w; } break;
        case "s32": startS32(); break;
        default: break;
      }
    } catch (e) {}
  }

  US.audio = {
    enable: enable,
    disable: disable,
    stop: shutdown,
    cue: cue,
    isOn: function () { return on; },
    state: function () { return ctx ? ctx.state : "none"; },
    _ctx: function () { return ctx; }
  };

  /* ---------- gestures that may start sound ---------- */
  function soundTicked() { var b = document.getElementById("portal-sound"); return !!(b && b.checked); }
  // Connect click / portal submit with the box ticked (capture: runs inside the gesture, before scenes)
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("#portal-connect") && soundTicked() && US.state !== "coda" && US.state !== "manifest") enable();
  }, true);
  document.addEventListener("submit", function (e) {
    if (e.target && e.target.id === "portal-form" && soundTicked() && US.state !== "coda" && US.state !== "manifest") enable();
  }, true);
  // header button: the director flips the state and emits `sound`; we also catch the click itself
  document.addEventListener("click", function (e) {
    var t = e.target;
    var b = t && t.closest && t.closest("#btn-sound");
    if (!b) return;
    // Decide after the director's handler has updated the attribute (same gesture, microtask later).
    Promise.resolve().then(function () {
      var s = document.documentElement.getAttribute("data-sound");
      var pressed = b.getAttribute("aria-pressed");
      var want = s ? s === "on" : (pressed ? pressed === "true" : !on);
      if (want && !on) enable(); else if (!want && on) disable();
    });
  });

  /* ---------- events ---------- */
  US.on("sound", function (d) {
    if (!d) return;
    if (d.on) { if (US.state !== "portal") enable(); else wanted = true; }
    else disable();
  });
  US.on("connect", function (d) { if (d && d.sound && !on) enable(); });
  US.on("mask", onMask);
  US.on("drop", function () { cue("drop"); });
  US.on("face", function (d) {
    var p = d && d.phase;
    if (!ctx || !on) return;
    if (p === "down") {
      // swell over 3 s, then fall almost silent
      ramp(humGain.gain, HUM * 1.0, 0.05);
      try {
        var t = ctx.currentTime;
        humGain.gain.cancelScheduledValues(t);
        humGain.gain.setValueAtTime(humGain.gain.value, t);
        humGain.gain.linearRampToValueAtTime(HUM, t + 3);
        humGain.gain.linearRampToValueAtTime(HUM * 0.08, t + 6);
        ramp(humLP.frequency, 900, 3);
      } catch (e) {}
      faceLow = true;
    } else if (p === "end" || p === "lifted" || p === "refused") {
      faceLow = false;
      ramp(humGain.gain, humTarget(), 2);
      ramp(humLP.frequency, humFreqs().lp, 2);
    }
  });
  var doneToneTimer = null;
  US.on("blank", function (d) {
    var v = !!(d && d.on);
    setBlank(v);
    if (v) {
      // the first done line (T=299) gets a single 330 Hz sine, 3 s
      if (typeof US.schedule === "function") { try { US.schedule(299, function () { cue("doneLine"); }); } catch (e) {} }
    }
  });
  US.on("state", function (d) {
    var s = d && d.state;
    if (s === "term" && blanked) setBlank(false);
    if (s === "portal" && d.prev && d.prev !== "portal") { setBlank(false); stopS32(0.5); }
  });
  US.on("finale", function () { stopS32(4); if (ctx && on) ramp(humGain.gain, 0, 4); });
  US.on("disconnect", shutdown);
  US.on("forget", function () { /* nothing stored by audio */ });

  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    try {
      if (document.hidden) { if (ctx.state === "running") ctx.suspend(); }
      else if (on && ctx.state === "suspended") ctx.resume();
    } catch (e) {}
  });
  window.addEventListener("pagehide", function () { if (ctx) try { ctx.suspend(); } catch (e) {} });
})();
