(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var IDS = { scatter: "plan-scatter", flow: "plan-flow", sizes: "plan-sizes" };

  var CLASSES = [
    { key: "granted", name: "Granted", color: "var(--ink-2)" },
    { key: "refused", name: "Refused", color: "var(--ink-2)" },
    { key: "adjourned", name: "Adjourned", color: "var(--ink)" },
    { key: "other", name: "Other decision", color: "var(--ink-3)" },
    { key: "unknown", name: "Decision not known yet", color: "var(--ink-3)", hollow: true }
  ];
  var CLASS = {};
  CLASSES.forEach(function (c) { CLASS[c.key] = c; });

  function classify(decision) {
    if (decision === "Granted") return "granted";
    if (decision === "Refused") return "refused";
    if (decision === "Adjourned" || decision === "Deferred") return "adjourned";
    if (!decision || decision === "Awaiting minutes" || decision === "Not found") return "unknown";
    return "other";
  }
  function decisionText(d) {
    if (!d || d === "Not found") return "Decision not read";
    if (d === "Awaiting minutes") return "Awaiting minutes";
    return d;
  }
  function emptyCounts() { var o = {}; CLASSES.forEach(function (c) { o[c.key] = 0; }); return o; }

  function money(v) {
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(v >= 1e11 ? 0 : 1) + "B";
    return v >= 1e6 ? "$" + (v / 1e6).toFixed(v >= 1e8 ? 0 : 1) + "M" : "$" + Math.round(v).toLocaleString("en-US");
  }
  function dayNum(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function dateLabel(iso) { var p = iso.split("-"); return (+p[2]) + " " + MONTHS[+p[1] - 1]; }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function key(a) { return a.project || ("?" + a.meeting + "/" + a.item); }

  function prepare(W) {
    var meets = ((W && W.meetings) || []).filter(function (m) { return m && m.date; });
    meets = meets.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (!meets.length) return { year: null, meetings: [], rows: [], latest: new Map(), orphans: 0 };
    var year = meets[meets.length - 1].date.slice(0, 4);
    var yMeets = meets.filter(function (m) { return m.date.slice(0, 4) === year; });
    var known = {};
    yMeets.forEach(function (m) { known[m.id] = true; });
    var rows = ((W && W.applications) || []).filter(function (a) { return a && a.date && a.date.slice(0, 4) === year; });
    rows = rows.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var latest = new Map();
    rows.forEach(function (a) { latest.set(key(a), a); });
    var orphans = rows.filter(function (a) { return !known[a.meeting]; }).length;
    return { year: year, meetings: yMeets, rows: rows, latest: latest, orphans: orphans };
  }

  function valueKind(v) { return !isNum(v) ? "none" : v > 0 ? "scale" : v === 0 ? "zero" : "below"; }
  function scatterData(P) {
    var hear = {};
    P.rows.forEach(function (a) {
      var k = key(a), list = hear[k] = hear[k] || [];
      for (var i = 0; i < list.length; i++) if (list[i].meeting === a.meeting) { list[i] = a; return; }
      list.push(a);
    });
    var counts = emptyCounts(), points = [], lane = [], ghosts = [];
    var noValue = 0, zero = 0, below = 0, pinned = 0, max = 0, repeat = 0;
    P.latest.forEach(function (last, k) {
      var earlier = (hear[k] || []).filter(function (a) { return a.meeting !== last.meeting; });
      var v = last.value, kind = valueKind(v), cls = classify(last.decision);
      var p = { row: last, key: k, cls: cls, value: v, kind: kind, day: dayNum(last.date), meeting: last.meeting,
        earlier: earlier, lane: kind !== "scale", pinned: kind === "scale" && v < 1e3 };
      counts[cls]++;
      if (kind === "none") noValue++; else if (kind === "zero") zero++; else if (kind === "below") below++;
      else { if (p.pinned) pinned++; if (v > max) max = v; }
      (p.lane ? lane : points).push(p);
      if (earlier.length) repeat++;
      earlier.forEach(function (a) {
        var gk = valueKind(a.value);
        if (gk === "scale" && a.value > max) max = a.value;
        ghosts.push({ ghost: true, app: p, row: a, key: k, value: a.value, kind: gk, day: dayNum(a.date), meeting: a.meeting,
          lane: gk !== "scale", pinned: gk === "scale" && a.value < 1e3 });
      });
    });
    return { points: points, lane: lane, ghosts: ghosts, counts: counts, apps: P.latest.size, onScale: points.length,
      listings: P.rows.length, noValue: noValue, zero: zero, below: below, pinned: pinned, max: max, repeatProjects: repeat };
  }

  function flowData(P) {
    var rows = P.meetings.map(function (m) {
      return { id: m.id, date: m.date, counts: emptyCounts(), settled: 0, later: 0, laterBy: emptyCounts(), listed: 0 };
    });
    var byId = {};
    rows.forEach(function (r) { byId[r.id] = r; });
    var lastAt = {};
    P.rows.forEach(function (a) { lastAt[a.meeting + "|" + key(a)] = a; });
    var seen = {}, totals = emptyCounts(), laterBy = emptyCounts(), later = 0, sameDay = 0;
    P.rows.forEach(function (a) {
      var r = byId[a.meeting];
      if (!r) return;
      var k = key(a), sk = a.meeting + "|" + k;
      if (seen[sk]) { sameDay++; return; }
      seen[sk] = true;
      r.listed++;
      var last = P.latest.get(k);
      if (last.meeting === a.meeting) {
        var c = classify(last.decision);
        r.counts[c]++; r.settled++; totals[c]++;
      } else {
        var lc = classify(lastAt[sk].decision);
        r.later++; r.laterBy[lc]++; later++; laterBy[lc]++;
      }
    });
    var settled = 0;
    rows.forEach(function (r) { settled += r.settled; });
    return { rows: rows, totals: totals, settled: settled, later: later, laterBy: laterBy, sameDay: sameDay };
  }
  function laterText(by) {
    return CLASSES.filter(function (c) { return by[c.key]; })
      .sort(function (a, b) { return by[b.key] - by[a.key] || CLASSES.indexOf(a) - CLASSES.indexOf(b); })
      .map(function (c) {
        var n = by[c.key];
        return c.key === "other" ? plural(n, "other decision") : c.key === "unknown" ? n + " decision not known" : n + " " + c.key;
      }).join(", ");
  }

  var BANDS = [
    { lo: 0, hi: 5e4, label: "<$50k", short: "<50k", long: "under CI$50,000" },
    { lo: 5e4, hi: 2.5e5, label: "$50k–250k", short: "50–250k", long: "CI$50,000 to under CI$250,000" },
    { lo: 2.5e5, hi: 1e6, label: "$250k–1M", short: "250k–1M", long: "CI$250,000 to under CI$1 million" },
    { lo: 1e6, hi: 1e7, label: "$1M–10M", short: "1–10M", long: "CI$1 million to under CI$10 million" },
    { lo: 1e7, hi: Infinity, label: "$10M+", short: "10M+", long: "CI$10 million or more" }
  ];
  function sizeData(P) {
    var counts = BANDS.map(function () { return 0; }), noValue = 0, zero = 0, apps = 0;
    P.latest.forEach(function (a) {
      apps++;
      var v = a.value;
      if (!isNum(v)) { noValue++; return; }
      if (v <= 0) { zero++; return; }
      for (var i = 0; i < BANDS.length; i++) if (v >= BANDS[i].lo && v < BANDS[i].hi) { counts[i]++; return; }
    });
    var banded = counts.reduce(function (s, n) { return s + n; }, 0);
    return { counts: counts, apps: apps, banded: banded, noValue: noValue, zero: zero };
  }

  function sv(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function widthOf(box, min, max) {
    var w = Math.round((box && box.clientWidth) || 560);
    return Math.max(min, Math.min(max, w));
  }
  function animate(box) { if (window.CW && window.CW.animate) window.CW.animate(box); }
  function r1(n) { return Math.round(n * 10) / 10; }

  function swatch(kind, color) {
    if (kind === "hatch") {
      var hs = sv("svg", { viewBox: "0 0 10 10", "aria-hidden": "true", focusable: "false" });
      hs.style.cssText = "display:block;flex:none;align-self:center;width:10px;height:10px;max-width:none";
      hs.appendChild(sv("rect", { width: 10, height: 10, fill: color }));
      hs.appendChild(sv("path", { d: "M-1 4L4 -1M-1 9L9 -1M4 11L11 4", stroke: "var(--ground)", "stroke-width": 1.3 }));
      return hs;
    }
    var i = el("i", { "aria-hidden": "true" });
    var s = i.style;
    if (kind === "dot") { s.background = color; s.borderRadius = "50%"; }
    else if (kind === "ring") { s.background = "transparent"; s.border = "1.5px solid " + color; s.borderRadius = "50%"; }
    else if (kind === "diamond") { s.background = color; s.width = "9px"; s.height = "9px"; s.transform = "rotate(45deg)"; }
    else if (kind === "bar") { s.background = color; }
    else if (kind === "hollow") { s.background = "transparent"; s.border = "1.5px solid " + color; }
    else if (kind === "dashed") { s.background = "transparent"; s.border = "1px dashed " + color; }
    else if (kind === "link") { s.background = "transparent"; s.height = "0"; s.width = "16px"; s.borderTop = "1px solid " + color; }
    else if (kind === "tick") { s.background = "transparent"; s.width = "0"; s.height = "10px"; s.borderLeft = "1.5px solid " + color; s.margin = "0 var(--space-2xs)"; }
    return i;
  }
  function legend(items) {
    var ul = el("ul", { class: "legend" });
    ul.style.marginBottom = "var(--space-sm)";
    ul.style.gridTemplateColumns = "repeat(auto-fill,minmax(128px,1fr))";
    items.forEach(function (it) {
      var li = el("li");
      li.appendChild(swatch(it.kind, it.color));
      if (it.n !== undefined) { li.appendChild(el("b", {}, String(it.n))); li.appendChild(document.createTextNode(" " + it.text)); }
      else li.appendChild(document.createTextNode(it.text));
      ul.appendChild(li);
    });
    return ul;
  }
  function empty(box, text) { box.replaceChildren(el("p", { class: "note", "data-chart-empty":"true" }, text)); }

  function mark(p, x, y, r) {
    if (p.ghost) {
      var gh = r * 0.95, top = p.pinned ? y - 2 * gh : y - gh, bot = p.pinned ? y : y + gh;
      return sv("path", { d: "M" + r1(x) + " " + r1(top) + "L" + r1(x) + " " + r1(bot), stroke: "var(--ink-3)", "stroke-width": 1.5, "stroke-linecap": "round" });
    }
    var c = CLASS[p.cls], g;
    if (p.pinned) {
      var s = r * 1.3;
      return sv("path", { d: "M" + r1(x - s) + " " + r1(y - s * 1.7) + "L" + r1(x + s) + " " + r1(y - s * 1.7) + "L" + r1(x) + " " + r1(y) + "Z",
        fill: c.hollow ? "var(--ground)" : c.color, stroke: c.hollow ? c.color : "var(--ground)", "stroke-width": c.hollow ? 1.3 : 0.8 });
    }
    if (p.cls === "refused") {
      var d = r * 1.4;
      g = sv("path", { d: "M" + r1(x) + " " + r1(y - d) + "L" + r1(x + d) + " " + r1(y) + "L" + r1(x) + " " + r1(y + d) + "L" + r1(x - d) + " " + r1(y) + "Z",
        fill: c.color, stroke: "var(--ground)", "stroke-width": 0.8 });
      return g;
    }
    if (p.cls === "adjourned") {
      var q = r * 0.9;
      return sv("rect", { x: r1(x - q), y: r1(y - q), width: r1(2 * q), height: r1(2 * q), fill: c.color, stroke: "var(--ground)", "stroke-width": 0.8 });
    }
    if (c.hollow) return sv("circle", { cx: r1(x), cy: r1(y), r: r1(r - 0.3), fill: "var(--ground)", stroke: c.color, "stroke-width": 1.3 });
    return sv("circle", { cx: r1(x), cy: r1(y), r: r1(r), fill: c.color, stroke: "var(--ground)", "stroke-width": 0.8 });
  }

  function valueText(v) {
    var k = valueKind(v);
    return k === "scale" ? money(v) : k === "none" ? "No value stated" : k === "zero" ? "Declared $0" : "Declared below $0";
  }
  function describe(p) {
    var a = p.row, who = a.applicant_shown || "Applicant not shown";
    if (p.ghost) {
      var L = p.app.row;
      return "Earlier hearing, " + dateLabel(a.date) + " (" + a.meeting + "): " + decisionText(a.decision) + " · " + valueText(p.value) +
        " · " + who + " · latest hearing " + dateLabel(L.date) + ": " + decisionText(L.decision);
    }
    var s = valueText(p.value) + " · " + decisionText(a.decision) + " · " + who + " · " + dateLabel(a.date) + " (" + a.meeting + ")";
    if (a.district) s += " · " + a.district;
    if (p.earlier.length) s += " · heard " + (p.earlier.length + 1) + " times; earlier: " +
      p.earlier.map(function (e) { return dateLabel(e.date) + " " + decisionText(e.decision).toLowerCase(); }).join(", ");
    return s;
  }
  function offScaleText(S) {
    var parts = [];
    if (S.noValue) parts.push(S.noValue + " with no value stated");
    if (S.zero) parts.push(S.zero + " declared at $0");
    if (S.below) parts.push(S.below + " declared below $0");
    return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts.join("");
  }

  function renderScatter(box, P) {
    var S = scatterData(P);
    if (!P.meetings.length || !S.apps) { empty(box, "No planning application has been read yet."); return S; }
    var w = widthOf(box, 280, 1160), narrow = w < 480;
    var hPlot = Math.round(Math.max(240, Math.min(400, w * 0.48)));
    var x0 = 48, x1 = w - 10, y0 = 10, y1 = hPlot - 28, r = narrow ? 2.8 : 3.6;
    var marks = S.points.concat(S.lane, S.ghosts), days = marks.map(function (p) { return p.day; });
    var d0 = Math.min.apply(null, days.concat([dayNum(P.meetings[0].date)])) - 6;
    var d1 = Math.max.apply(null, days.concat([dayNum(P.meetings[P.meetings.length - 1].date)])) + 6;
    if (d1 - d0 < 28) d1 = d0 + 28;
    var X = function (d) { return x0 + ((d - d0) / (d1 - d0)) * (x1 - x0); };
    var lo = 3, hi = S.max > 2e8 ? Math.ceil(Math.log10(S.max)) : Math.log10(2e8);
    var Y = function (v) { return y1 - ((Math.log10(Math.max(v, 1e3)) - lo) / (hi - lo)) * (y1 - y0); };

    var mxs = P.meetings.map(function (m) { return { id: m.id, x: X(dayNum(m.date)) }; });
    var room = {};
    mxs.forEach(function (m, i) {
      var gap = Infinity;
      if (i > 0) gap = Math.min(gap, m.x - mxs[i - 1].x);
      if (i < mxs.length - 1) gap = Math.min(gap, mxs[i + 1].x - m.x);
      room[m.id] = Math.max(0, Math.min(r * 4, gap / 2 - r - 0.5));
    });
    function roomOf(id) { return room[id] !== undefined ? room[id] : r * 2; }

    var RANK = {};
    CLASSES.forEach(function (c, i) { RANK[c.key] = i; });
    function byItem(a, b) { return a.row.item < b.row.item ? -1 : a.row.item > b.row.item ? 1 : 0; }
    var laneMarks = marks.filter(function (p) { return p.lane; });
    var step2 = 2 * r + 1.5, laneRows = 0, laneG = {}, laneOrder = [];
    laneMarks.forEach(function (p) {
      if (!laneG[p.meeting]) { laneG[p.meeting] = { list: [], cols: 1 }; laneOrder.push(p.meeting); }
      laneG[p.meeting].list.push(p);
    });
    laneOrder.forEach(function (id) {
      var G = laneG[id];
      G.list.sort(function (a, b) { return (a.ghost ? 9 : RANK[a.cls]) - (b.ghost ? 9 : RANK[b.cls]) || byItem(a, b); });
      G.cols = 1 + 2 * Math.floor(roomOf(id) / step2);
      laneRows = Math.max(laneRows, Math.ceil(G.list.length / G.cols));
    });
    var laneTop = hPlot + 4, laneY = laneTop + 24 + r;
    var h = laneMarks.length ? Math.round(laneY + (laneRows - 1) * step2 + r + 6) : hPlot;

    var c = S.counts, off = offScaleText(S), laneApps = S.lane.length;
    var aria = "Every " + P.year + " planning application, " + S.apps + " in all, each once at its latest hearing, placed by that meeting's date and by declared value " +
      "on a logarithmic scale from $1,000 to $" + (hi >= 9 ? Math.pow(10, hi - 9) + " billion" : "200 million") +
      ". Granted " + c.granted + ", refused " + c.refused + ", adjourned and not heard again yet " + c.adjourned + ", other decisions " + c.other +
      ", decision not known yet " + c.unknown + ". " + S.onScale + " are on the value scale" +
      (S.pinned ? ", " + S.pinned + " of them under $1,000 on the bottom line" : "") +
      (laneApps ? "; " + off + " sit in a row of their own below the dates, off the scale" : "") + "." +
      (S.ghosts.length ? " " + plural(S.ghosts.length, "small tick is an earlier hearing", "small ticks are earlier hearings") + " of the " +
        plural(S.repeatProjects, "application") + " heard more than once." : "");
    var svg = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": aria, tabindex: "0" });
    svg.style.touchAction = "manipulation";

    var NAMES = { 3: "$1k", 4: "$10k", 5: "$100k", 6: "$1M", 7: "$10M", 8: "$100M", 9: "$1B", 10: "$10B" };
    for (var t = lo; t <= Math.floor(hi); t++) {
      var gy = r1(Y(Math.pow(10, t)));
      svg.appendChild(sv("line", { x1: x0, x2: x1, y1: gy, y2: gy, stroke: "var(--rule)", "stroke-width": 1 }));
      svg.appendChild(sv("text", { x: x0 - 8, y: gy + 4, "text-anchor": "end", class: "axis" }, NAMES[t] || ("$1e" + t)));
    }
    var yr = +P.year, ticks = [];
    for (var mo = 0; mo < 24; mo++) {
      var md = Date.UTC(yr, mo, 1) / 864e5;
      if (md > d1) break;
      if (md >= d0) ticks.push({ x: X(md), label: MONTHS[mo % 12] });
    }
    var every = 1;
    if (ticks.length > 1 && ticks[1].x - ticks[0].x < 27) every = 2;
    ticks.forEach(function (tk, i) {
      svg.appendChild(sv("line", { x1: r1(tk.x), x2: r1(tk.x), y1: y1, y2: y1 + 6, stroke: "var(--ink-3)", "stroke-width": 1 }));
      if (i % every === 0 && tk.x + 22 <= w) svg.appendChild(sv("text", { x: r1(tk.x + 3), y: hPlot - 8, class: "axis" }, tk.label));
    });
    mxs.forEach(function (m) {
      var mx = r1(m.x);
      svg.appendChild(sv("line", { x1: mx, x2: mx, y1: y1 + 1, y2: y1 + 4, stroke: "var(--ink-3)", "stroke-width": 1 }));
    });
    if (laneMarks.length) {
      svg.appendChild(sv("line", { x1: x0, x2: x1, y1: laneTop, y2: laneTop, stroke: "var(--rule)", "stroke-width": 1 }));
      var laneName = (narrow ? "No value stated, or $0" : "Off the value scale: no value stated, or declared $0") + (S.below ? " or less" : "");
      svg.appendChild(sv("text", { x: x0, y: laneTop + 15, class: "axis" }, laneName));
    }

    var groups = {}, order = [];
    marks.forEach(function (p) {
      if (p.lane) return;
      if (!groups[p.meeting]) { groups[p.meeting] = []; order.push(p.meeting); }
      groups[p.meeting].push(p);
    });
    var placed = [];
    order.forEach(function (id) {
      var list = groups[id].slice().sort(function (a, b) { return a.value - b.value || (a.ghost ? 1 : 0) - (b.ghost ? 1 : 0) || byItem(a, b); });
      var maxOff = roomOf(id), step = r * 0.9, here = [];
      list.forEach(function (p) {
        var cx = X(p.day), cy = p.pinned ? y1 : Y(p.value), cands = [0];
        for (var k = 1; k * step <= maxOff; k++) cands.push(k * step, -k * step);
        var best = 0, bestD = -1;
        for (var ci = 0; ci < cands.length; ci++) {
          var minD = Infinity;
          for (var j = 0; j < here.length; j++) {
            var dx = cx + cands[ci] - here[j].x, dy = cy - here[j].y;
            minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy));
          }
          if (minD >= r * 1.9) { best = cands[ci]; bestD = Infinity; break; }
          if (minD > bestD) { bestD = minD; best = cands[ci]; }
        }
        var spot = { x: cx + best, y: cy, p: p };
        here.push(spot);
        placed.push(spot);
      });
    });
    laneOrder.forEach(function (id) {
      var G = laneG[id], n = G.list.length;
      G.list.forEach(function (p, i) {
        var row = Math.floor(i / G.cols), inRow = Math.min(G.cols, n - row * G.cols), j = i % G.cols;
        placed.push({ x: X(p.day) + (j - (inRow - 1) / 2) * step2, y: laneY + row * step2, p: p });
      });
    });

    var byKey = {}, links = {}, appSpot = {};
    placed.forEach(function (s) {
      (byKey[s.p.key] = byKey[s.p.key] || []).push(s);
      if (!s.p.ghost) appSpot[s.p.key] = s;
    });
    var linkG = sv("g", { fill: "none", stroke: "var(--ink-3)", "stroke-width": 1, "stroke-opacity": 0.5 });
    Object.keys(byKey).forEach(function (k) {
      var list = byKey[k];
      if (list.length < 2) return;
      list.sort(function (a, b) { return a.p.day - b.p.day || (a.p.ghost ? 0 : 1) - (b.p.ghost ? 0 : 1); });
      var d = "", len = 0;
      list.forEach(function (s, i) {
        d += (i ? "L" : "M") + r1(s.x) + " " + r1(s.y);
        if (i) len += Math.abs(s.x - list[i - 1].x) + Math.abs(s.y - list[i - 1].y);
      });
      if (len < 1) return;
      var path = sv("path", { d: d, "data-anim": "draw" });
      links[k] = path;
      linkG.appendChild(path);
    });
    svg.appendChild(linkG);

    var dotsG = sv("g", { "data-anim": "rise" }), ghostLayer = sv("g", {}), appLayer = sv("g", {});
    dotsG.appendChild(ghostLayer);
    dotsG.appendChild(appLayer);
    placed.forEach(function (s) {
      var m = mark(s.p, s.x, s.y, r);
      m.appendChild(sv("title", {}, describe(s.p)));
      (s.p.ghost ? ghostLayer : appLayer).appendChild(m);
    });
    svg.appendChild(dotsG);
    var ring = sv("circle", { r: r1(r + 3.5), fill: "none", stroke: "var(--ink)", "stroke-width": 2, visibility: "hidden", "pointer-events": "none" });
    svg.appendChild(ring);

    var hint = narrow ? "Tap a mark to read it." : "Point at a mark, tap it, or focus the chart and use the arrow keys to read one.";
    var readout = el("p", { class: "note", "aria-live": "polite" }, hint);
    readout.style.minHeight = "3em";
    var seq = placed.filter(function (s) { return !s.p.ghost; }).sort(function (a, b) {
      return a.p.day - b.p.day || (a.p.lane ? 1 : 0) - (b.p.lane ? 1 : 0) || (a.p.lane ? 0 : a.p.value - b.p.value) || byItem(a.p, b.p);
    });
    var active = -1, shown = null, lit = null;
    function setActive(i, spot) {
      if (lit) { lit.removeAttribute("stroke"); lit.removeAttribute("stroke-opacity"); lit.removeAttribute("stroke-width"); lit = null; }
      active = i;
      shown = spot || (i >= 0 ? seq[i] : null);
      if (!shown) { ring.setAttribute("visibility", "hidden"); readout.textContent = hint; return; }
      ring.setAttribute("cx", r1(shown.x)); ring.setAttribute("cy", r1(shown.y)); ring.setAttribute("visibility", "visible");
      if (links[shown.p.key]) { lit = links[shown.p.key]; lit.setAttribute("stroke", "var(--ink)"); lit.setAttribute("stroke-opacity", "1"); lit.setAttribute("stroke-width", "1.5"); }
      readout.textContent = describe(shown.p);
    }
    function pick(e, reach) {
      var b = svg.getBoundingClientRect();
      if (!b.width) return;
      var k = w / b.width, px = (e.clientX - b.left) * k, py = (e.clientY - b.top) * k;
      var best = null, bd = reach * k;
      for (var i = 0; i < placed.length; i++) {
        var dx = placed[i].x - px, dy = placed[i].y - py, d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd || (d === bd && best && best.p.ghost && !placed[i].p.ghost)) { bd = d; best = placed[i]; }
      }
      if (best && best !== shown) setActive(seq.indexOf(best.p.ghost ? appSpot[best.p.key] : best), best);
    }
    svg.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") pick(e, 16); });
    svg.addEventListener("pointerdown", function (e) { pick(e, e.pointerType === "mouse" ? 16 : 24); });
    svg.addEventListener("keydown", function (e) {
      var n = seq.length, k = e.key, i = active;
      if (k === "ArrowRight" || k === "ArrowDown") i = active < 0 ? 0 : Math.min(n - 1, active + 1);
      else if (k === "ArrowLeft" || k === "ArrowUp") i = active < 0 ? n - 1 : Math.max(0, active - 1);
      else if (k === "Home") i = 0;
      else if (k === "End") i = n - 1;
      else if (k === "Escape") i = -1;
      else return;
      e.preventDefault();
      setActive(i);
    });
    svg.addEventListener("focus", function () {
      var vis = true;
      try { vis = svg.matches(":focus-visible"); } catch (err) { vis = true; }
      if (vis) { svg.style.outline = "2px solid var(--build)"; svg.style.outlineOffset = "2px"; }
    });
    svg.addEventListener("blur", function () { svg.style.outline = ""; });

    var keyEl = legend([
      { kind: "dot", color: CLASS.granted.color, n: c.granted, text: "granted" },
      { kind: "diamond", color: CLASS.refused.color, n: c.refused, text: "refused" },
      { kind: "bar", color: CLASS.adjourned.color, n: c.adjourned, text: "adjourned, not back yet" },
      { kind: "dot", color: CLASS.other.color, n: c.other, text: "other decision" },
      { kind: "ring", color: CLASS.unknown.color, n: c.unknown, text: "not known yet" }
    ].concat(S.ghosts.length ? [{ kind: "tick", color: "var(--ink-3)", text: "earlier hearing, joined by a line" }] : []));
    var notes = "Each of the " + S.apps + " applications is one mark, at its latest hearing: at that meeting's date, at the value its applicant declared, " +
      "marked by the decision taken there. The value scale is logarithmic: each line is ten times the one below." +
      (S.pinned ? " " + S.pinned + " under $1,000 " + (S.pinned === 1 ? "sits" : "sit") + " on the bottom line as small triangles." : "") +
      (laneApps ? " " + off.charAt(0).toUpperCase() + off.slice(1) + " " + (laneApps === 1 ? "sits" : "sit") + " in the row under the dates, off the scale." : "") +
      (S.ghosts.length ? " The " + plural(S.ghosts.length, "short tick is an earlier hearing", "short ticks are earlier hearings") + " of the " +
        plural(S.repeatProjects, "application") + " heard more than once, joined by a line to the latest; they are not in the counts above." : "");
    box.replaceChildren(keyEl, svg, readout, el("p", { class: "note" }, notes));
    animate(box);
    return S;
  }

  function renderFlow(box, P) {
    var F = flowData(P);
    if (!F.rows.length) { empty(box, "No planning board meeting has been read yet."); return F; }
    var w = widthOf(box, 280, 1160), rowH = 24, barH = 14, labelW = 46, valW = 30;
    var x0 = labelW + 8, x1 = w - valW - 6, h = F.rows.length * rowH + 4;
    var max = Math.max.apply(null, F.rows.map(function (r) { return r.listed; }).concat([1]));
    var t = F.totals;
    var aria = P.year + " planning applications by meeting. Bar length is the applications on each agenda. " +
      "Solid segments are applications whose latest hearing was that meeting, by the decision taken there: " +
      t.granted + " granted, " + t.refused + " refused, " + t.adjourned + " adjourned and not heard again yet, " + t.other + " other decisions, " +
      t.unknown + " not known yet; " + F.settled + " applications in all, each counted once." +
      (F.later ? " Dashed parts are " + plural(F.later, "listing") + " of applications heard again at a later meeting; decided at those listings: " +
        laterText(F.laterBy) + "." : "");
    var svg = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": aria });
    var defs = sv("defs", {}), hatch = sv("pattern", { id: "pv-refused-hatch", patternUnits: "userSpaceOnUse", width: 5, height: 5, patternTransform: "rotate(45)" });
    hatch.appendChild(sv("rect", { width: 5, height: 5, fill: CLASS.refused.color }));
    hatch.appendChild(sv("rect", { width: 1.3, height: 5, fill: "var(--ground)" }));
    defs.appendChild(hatch);
    svg.appendChild(defs);
    var last = F.rows.length - 1;
    F.rows.forEach(function (r, i) {
      var y = i * rowH + 4, by = y + (rowH - 4 - barH) / 2, g = sv("g", {});
      var parts = [];
      CLASSES.forEach(function (c) { if (r.counts[c.key]) parts.push(r.counts[c.key] + " " + c.name.toLowerCase()); });
      if (r.later) parts.push(r.later + " heard again later");
      g.appendChild(sv("title", {}, dateLabel(r.date) + " (" + r.id + "): " + plural(r.listed, "application") + " listed" + (parts.length ? "; " + parts.join(", ") : "")));
      g.appendChild(sv("text", { x: labelW, y: by + barH - 2, "text-anchor": "end", class: i === last ? "val" : "lbl" }, dateLabel(r.date)));
      var x = x0, unit = (x1 - x0) / max, seg = 0;
      function piece(n, fill, stroke, dash, ink, title) {
        var len = n * unit, inset = stroke ? 0.75 : 0;
        var sg = sv("g", {});
        sg.appendChild(sv("title", {}, title));
        sg.appendChild(sv("rect", { x: r1(x + inset), y: r1(by + inset), width: r1(Math.max(1, len - 2 * inset - 1)), height: barH - 2 * inset,
          fill: fill, stroke: stroke || null, "stroke-width": stroke ? 1.5 : null, "stroke-dasharray": dash || null,
          "data-anim": "grow", "data-delay": Math.min(700, i * 30 + seg * 60) }));
        var digits = String(n).length;
        if (len - 1 >= 8 + digits * 7) {
          if (fill.indexOf("url(") === 0)
            sg.appendChild(sv("rect", { x: r1(x + (len - 1) / 2 - digits * 3.5 - 2), y: by + 1.5, width: digits * 7 + 4, height: barH - 3, fill: CLASS.refused.color }));
          var tx = sv("text", { x: r1(x + (len - 1) / 2), y: by + barH - 3, "text-anchor": "middle", class: "val" }, String(n));
          tx.style.fill = ink; tx.style.fontSize = "12px";
          sg.appendChild(tx);
        }
        g.appendChild(sg);
        x += len; seg++;
      }
      CLASSES.forEach(function (c) {
        var n = r.counts[c.key];
        if (!n) return;
        var what = c.key === "adjourned" ? "adjourned and not heard again yet" : c.key === "unknown" ? "decision not known yet" : c.name.toLowerCase();
        piece(n, c.hollow ? "var(--ground)" : c.key === "refused" ? "url(#pv-refused-hatch)" : c.color, c.hollow ? c.color : null, null,
          c.hollow ? "var(--ink-2)" : "var(--ground)",
          dateLabel(r.date) + ": " + n + " " + what);
      });
      if (r.later) piece(r.later, "none", "var(--ink-3)", "3 2", "var(--ink-3)",
        dateLabel(r.date) + ": " + r.later + " heard again at a later meeting; decided here: " + laterText(r.laterBy));
      if (!r.listed) g.appendChild(sv("text", { x: x0, y: by + barH - 2, class: "axis" }, "no applications read"));
      g.appendChild(sv("text", { x: w, y: by + barH - 2, "text-anchor": "end", class: "val" }, String(r.listed)));
      svg.appendChild(g);
    });
    var keyEl = legend([
      { kind: "bar", color: CLASS.granted.color, n: t.granted, text: "granted" },
      { kind: "hatch", color: CLASS.refused.color, n: t.refused, text: "refused" },
      { kind: "bar", color: CLASS.adjourned.color, n: t.adjourned, text: "adjourned, not back yet" },
      { kind: "bar", color: CLASS.other.color, n: t.other, text: "other decision" },
      { kind: "hollow", color: CLASS.unknown.color, n: t.unknown, text: "not known yet" },
      { kind: "dashed", color: "var(--ink-3)", n: F.later, text: "heard again later" }
    ]);
    var note = "Bar length: applications on that agenda; the figure on the right is the count. Solid segments: applications whose latest hearing was that meeting, by the decision taken there, so each of the " +
      F.settled + " applications is counted once." +
      (F.later ? " Dashed: listed there and heard again at a later meeting (decided there: " + laterText(F.laterBy) + ")." : "") +
      (F.sameDay ? " " + plural(F.sameDay, "application was", "applications were") + " listed twice on one agenda and counted once." : "") +
      (F.settled < P.latest.size ? " " + plural(P.latest.size - F.settled, "application is", "applications are") +
        " not drawn: the meeting of its latest hearing is not in the list of meetings yet." : "");
    box.replaceChildren(keyEl, svg, el("p", { class: "note" }, note));
    animate(box);
    return F;
  }

  function renderSizes(box, P) {
    var Z = sizeData(P);
    if (!Z.apps) { empty(box, "No planning application has been read yet."); return Z; }
    var compact = widthOf(box, 280, 1160) < 440;
    var items = BANDS.map(function (b, i) {
      return { label: compact ? b.short : b.label, value: Z.counts[i], title: b.long + ": " + plural(Z.counts[i], "application") };
    });
    var aria = P.year + " planning applications by declared value, each counted once at its latest hearing: " +
      BANDS.map(function (b, i) { return b.long + " " + Z.counts[i]; }).join(", ") + ". " +
      plural(Z.noValue, "application") + " with no declared value and " + Z.zero + " declared at $0 are not in a band.";
    var note = Z.banded + " of " + Z.apps + " applications, each at its latest hearing, by the value declared on the agenda (CI$). " +
      plural(Z.noValue, "application states", "applications state") + " no value and " + Z.zero + (Z.zero === 1 ? " declares" : " declare") +
      " $0; they are not in a band.";
    if (window.CW && window.CW.columns) {
      window.CW.columns(box, items, { label: aria, height: 190 });
    } else {
      var w = widthOf(box, 280, 1160), hh = 190, top = 22, bottom = 28, gap = 8, bw = (w - gap * 4) / 5;
      var mx = Math.max.apply(null, Z.counts.concat([1]));
      var s = sv("svg", { viewBox: "0 0 " + w + " " + hh, role: "img", "aria-label": aria });
      items.forEach(function (d, i) {
        var bh = d.value ? Math.max(2, (d.value / mx) * (hh - top - bottom)) : 0, x = i * (bw + gap), g = sv("g", {});
        g.appendChild(sv("title", {}, d.title));
        g.appendChild(sv("rect", { x: r1(x), y: r1(hh - bottom - bh), width: r1(bw), height: r1(bh), fill: "var(--ink-2)" }));
        g.appendChild(sv("text", { x: r1(x + bw / 2), y: r1(Math.max(12, hh - bottom - bh - 6)), "text-anchor": "middle", class: "val" }, String(d.value)));
        g.appendChild(sv("text", { x: r1(x + bw / 2), y: hh - 9, "text-anchor": "middle", class: "axis" }, d.label));
        s.appendChild(g);
      });
      box.replaceChildren(s);
    }
    box.appendChild(el("p", { class: "note" }, note));
    return Z;
  }

  var lastW = null, prepared = null;
  function render(W) {
    if (W !== lastW) { lastW = W; prepared = prepare(W); }
    var P = prepared, S = scatterData(P), F = flowData(P), Z = sizeData(P);
    var alternatives = {
      scatter:S.apps + " applications; " + S.listings + " hearings. " +
        S.points.concat(S.lane).map(function (p) { return p.row.date + ": " + (p.value === null ? "value not stated" : "CI$" + p.value) + ", " + p.cls; }).join("; ") + ". Earlier hearings: " + S.ghosts.map(function (g) { return g.row.date + ": " + (g.value === null ? "value not stated" : "CI$" + g.value); }).join("; "),
      flow:F.rows.map(function (r) { return r.id + " " + r.date + ": " + r.listed + " listed, " + r.settled + " final hearings, " + r.later + " later heard again. " + CLASSES.map(function (c) { return c.key + " " + r.counts[c.key] + ", earlier " + r.laterBy[c.key]; }).join(", "); }).join("; "),
      sizes:Z.apps + " applications. " + BANDS.map(function (b,i) { return b.long + ": " + Z.counts[i]; }).join("; ") + "; value not stated " + Z.noValue + "; zero or below " + Z.zero
    };
    Object.keys(IDS).forEach(function (name) {
      var box = document.getElementById(IDS[name]);
      if (!box) return;
      CW.defer(box, function () {
        if (name === "scatter") renderScatter(box,P);
        else if (name === "flow") renderFlow(box,P);
        else renderSizes(box,P);
      }, {alternative:alternatives[name],height:name === "scatter" ? 520 : name === "flow" ? P.meetings.length * 34 + 100 : 240});
    });
    return {year:P.year,scatter:S,flow:F,sizes:Z};
  }

  window.PlanningViz = { render: render, prepare: prepare, scatterData: scatterData, flowData: flowData, sizeData: sizeData,
    classify: classify, bands: BANDS, classes: CLASSES };
})();
