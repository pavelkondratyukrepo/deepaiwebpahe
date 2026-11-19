/* UNDERSTORY v2 — qr.js (Builder C)
   Small self-contained QR encoder: byte mode, ECC M (falls back to L if the
   text is too long for M), versions 1–10 (up to 213 bytes at M), with mask
   selection by the standard penalty rules. Renders to <svg>.
   Exposes window.USQR = { encode(text, ecc?) → {size, modules, version, ecc, mask},
   svg(text, opts) → SVGElement,
   render(el, text, opts) → bool }, and US.qr = USQR when US exists. */
(function () {
  "use strict";

  var MAXV = 10;
  // per version (index 0 unused): error-correction codewords per block, number of blocks
  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
  };
  var NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
  };
  var FORMAT_ECL = { L: 1, M: 0 };

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, ecl) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }
  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var res = [6];
    for (var pos = ver * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  /* ---- GF(256) Reed–Solomon ---- */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }
  function rsDivisor(degree) {
    var res = [];
    for (var i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, div) {
    var res = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ res.shift();
      res.push(0);
      div.forEach(function (c, i) { res[i] ^= gfMul(c, f); });
    });
    return res;
  }

  function utf8(text) {
    var out = [], s = String(text);
    if (typeof TextEncoder === "function") {
      var u = new TextEncoder().encode(s);
      for (var i = 0; i < u.length; i++) out.push(u[i]);
      return out;
    }
    s = unescape(encodeURIComponent(s));
    for (var k = 0; k < s.length; k++) out.push(s.charCodeAt(k));
    return out;
  }

  function encode(text, eclWanted) {
    var bytes = utf8(text);
    var order = eclWanted === "L" ? ["L"] : ["M", "L"];
    var ver = 0, ecl = null;
    outer:
    for (var o = 0; o < order.length; o++) {
      for (var v = 1; v <= MAXV; v++) {
        var cc = v < 10 ? 8 : 16;
        var bits = 4 + cc + bytes.length * 8;
        if (bits <= dataCodewords(v, order[o]) * 8) { ver = v; ecl = order[o]; break outer; }
      }
    }
    if (!ver) throw new Error("QR: text too long");

    // data bit stream
    var bb = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
    put(4, 4);
    put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, cap - bb.length));
    put(0, (8 - bb.length % 8) % 8);
    for (var pad = 0xec; bb.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bb.length; i += 8) {
      var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bb[i + j]; data.push(x);
    }

    // split into blocks, add ECC, interleave
    var nb = NUM_BLOCKS[ecl][ver], ecLen = ECC_PER_BLOCK[ecl][ver];
    var raw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = rsDivisor(ecLen), k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - ecLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (j = 0; j < blocks.length; j++) {
        if (i !== shortLen - ecLen || j >= numShort) all.push(blocks[j][i]);
      }
    }

    // matrix
    var size = ver * 4 + 17;
    var mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, d) { mod[y][x] = d; fn[y][x] = true; }

    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(x, y) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPositions(ver), na = ap.length;
    for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function drawFormat(mask) {
      var d = FORMAT_ECL[ecl] << 3 | mask, rem = d;
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = (d << 10 | rem) ^ 0x5412;
      function g(n) { return ((bits >>> n) & 1) !== 0; }
      for (q = 0; q <= 5; q++) setF(8, q, g(q));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for (q = 9; q < 15; q++) setF(14 - q, 8, g(q));
      for (q = 0; q < 8; q++) setF(size - 1 - q, 8, g(q));
      for (q = 8; q < 15; q++) setF(8, size - 15 + q, g(q));
      setF(8, size - 8, true);
    }
    drawFormat(0); // reserve
    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      var vb = ver << 12 | rem;
      for (i = 0; i < 18; i++) {
        var bit = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i / 3);
        setF(a, b, bit); setF(b, a, bit);
      }
    }
    // codewords, zigzag
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var xx = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
          if (!fn[yy][xx] && bi < all.length * 8) {
            mod[yy][xx] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
        }
        if (!fn[y][x] && inv) mod[y][x] = !mod[y][x];
      }
    }
    function penalty() {
      var p = 0, x, y, run, c, dark = 0;
      for (y = 0; y < size; y++) {
        for (run = 1, x = 1; x <= size; x++) {
          if (x < size && mod[y][x] === mod[y][x - 1]) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
      }
      for (x = 0; x < size; x++) {
        for (run = 1, y = 1; y <= size; y++) {
          if (y < size && mod[y][x] === mod[y - 1][x]) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
      function pat(get) {
        // 1:1:3:1:1 finder-like pattern with 4 light modules on either side
        var n = 0;
        for (var i = 0; i + 10 < size + 0; i++) {
          var s = "";
          for (var k = 0; k < 11; k++) s += get(i + k) ? "1" : "0";
          if (s === "10111010000" || s === "00001011101") n++;
        }
        return n;
      }
      for (y = 0; y < size; y++) p += 40 * pat(function (i) { return mod[y][i]; });
      for (x = 0; x < size; x++) p += 40 * pat(function (i) { return mod[i][x]; });
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      var total = size * size;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    var forced = encode._forceMask;
    if (forced != null) best = forced;
    else for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size: size, modules: mod, version: ver, ecc: ecl, mask: best };
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(text, opts) {
    opts = opts || {};
    var q = encode(text, opts.ecc), border = opts.border == null ? 4 : opts.border, n = q.size + border * 2;
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 " + n + " " + n);
    s.setAttribute("shape-rendering", "crispEdges");
    s.setAttribute("role", "img");
    if (opts.label) s.setAttribute("aria-label", opts.label);
    if (opts.size) { s.setAttribute("width", opts.size); s.setAttribute("height", opts.size); }
    var bg = document.createElementNS(SVGNS, "rect");
    bg.setAttribute("width", n); bg.setAttribute("height", n);
    bg.setAttribute("fill", opts.light || "#ffffff");
    s.appendChild(bg);
    var d = [];
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++)
      if (q.modules[y][x]) d.push("M" + (x + border) + " " + (y + border) + "h1v1h-1z");
    var path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", d.join(""));
    path.setAttribute("fill", opts.dark || "#1d2733");
    s.appendChild(path);
    return s;
  }
  // replace el's contents with the code; returns false (and hides el) on failure
  function render(el, text, opts) {
    if (!el) return false;
    try {
      var s = svg(text, opts);
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(s);
      el.hidden = false;
      return true;
    } catch (e) {
      el.hidden = true;
      return false;
    }
  }

  var api = { encode: encode, svg: svg, render: render };
  window.USQR = api;
  if (window.US) {
    window.US.qr = api;
    // Keep #share-qr in step with #share-link if the scenes have not drawn it themselves.
    var last = null;
    var sync = function () {
      var box = document.getElementById("share-qr"), link = document.getElementById("share-link");
      if (!box || !link || !link.value) return;
      if (link.value === last && box.querySelector("svg")) return;
      last = link.value;
      render(box, link.value, { label: "QR code for " + link.value });
    };
    document.addEventListener("input", function (e) { if (e.target && e.target.id === "share-link") sync(); });
    document.addEventListener("change", function (e) { if (e.target && e.target.id === "share-name") setTimeout(sync, 0); });
    if (typeof window.US.on === "function") {
      try { window.US.on("finale", function () { setTimeout(sync, 50); }); } catch (e) {}
      try { window.US.on("state", function (d) { if (d && (d.state === "manifest" || d.state === "disconnected")) setTimeout(sync, 50); }); } catch (e) {}
    }
  }
})();
