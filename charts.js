(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sv(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function widthOf(box, min, max) {
    var w = Math.round((box && box.clientWidth) || 560);
    return Math.max(Math.min(min || 280, w || 280), Math.min(max || 720, w));
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }

  function animate(root) { return root; }


  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.width || 96, h = opts.height || 26, pad = 3;
    var known = values.filter(function (v) { return v !== null && v !== undefined; });
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, role: "img", class: "spark",
      "aria-label": opts.label || ("Price over " + values.length + " weeks") });
    if (known.length < 2) return s;
    var lo = Math.min.apply(null, known), hi = Math.max.apply(null, known), span = (hi - lo) || 0.01;
    var X = function (i) { return pad + (i / (values.length - 1)) * (w - pad * 2); };
    var Y = function (v) { return h - pad - ((v - lo) / span) * (h - pad * 2); };
    var d = "", pen = false;
    values.forEach(function (v, i) {
      if (v === null || v === undefined) { pen = false; return; }
      d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " ";
      pen = true;
    });
    s.appendChild(sv("path", { d: d, fill: "none", stroke: opts.color || "var(--ink-2)", "stroke-width": 1.6, "data-anim": "draw" }));
    var last = values.length - 1;
    if (values[last] !== null && values[last] !== undefined) s.appendChild(sv("circle", { cx: X(last), cy: Y(values[last]), r: 2.4, fill: opts.dot || "var(--ink)" }));
    return s;
  }

  function columns(box, items, opts) {
    opts = opts || {};
    var w = widthOf(box, 280, 720), h = opts.height || 180, top = 22, bottom = 28, n = items.length;
    var gap = n > 14 ? 3 : 8, bw = Math.max(4, (w - gap * (n - 1)) / n);
    var axisWidth = function (label) { return String(label || "").length * 8; };
    var widest = Math.max.apply(null, items.map(function (d) { return axisWidth(d.label); }).concat([0]));
    var labelStride = Math.max(n > 14 ? Math.ceil(n / 7) : 1, Math.ceil((widest + 8) / (bw + gap)));
    var lastLabelLeft = w - axisWidth(n ? items[n - 1].label : "");
    var labelRight = -Infinity;
    var max = Math.max.apply(null, items.map(function (d) { return d.value || 0; }).concat([1]));
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": opts.label || "" });
    items.forEach(function (d, i) {
      var x = i * (bw + gap), bh = d.value ? Math.max(2, (d.value / max) * (h - top - bottom)) : 0, y = h - bottom - bh;
      var g = sv("g", {});
      if (d.title) g.appendChild(sv("title", {}, d.title));
      if (d.value === null || d.value === undefined) {
        g.appendChild(sv("rect", { x: x, y: h - bottom - 2, width: bw, height: 2, fill: "var(--rule)" }));
      } else {
        g.appendChild(sv("rect", { x: x, y: y, width: bw, height: bh, fill: d.highlight ? (opts.accent || "var(--ink)") : (opts.color || "var(--ink-2)"),
          "data-anim": "grow", "data-axis": "y", "data-delay": Math.min(600, i * 25) }));
        if (opts.values !== false && (n <= 14 || d.highlight)) g.appendChild(sv("text", { x: x + bw / 2, y: Math.max(12, y - 6), "text-anchor": "middle", class: "val" }, fmt(d.value)));
      }
      if (d.label && (i % labelStride === 0 || i === n - 1)) {
        var tx = i === 0 ? 2 : i === n - 1 ? w - 2 : x + bw / 2;
        var anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        var labelWidth = axisWidth(d.label), left = anchor === "start" ? tx : anchor === "end" ? tx - labelWidth : tx - labelWidth / 2;
        var right = left + labelWidth;
        if (left >= labelRight + 8 && (i === n - 1 || right <= lastLabelLeft - 8 || n === 1)) {
          g.appendChild(sv("text", { x: tx, y: h - 9, "text-anchor": anchor, class: "axis" }, d.label));
          labelRight = right;
        }
      }
      s.appendChild(g);
    });
    box.replaceChildren(s);
    animate(box);
    return s;
  }

  function pairs(box, items, opts) {
    opts = opts || {};
    var w = widthOf(box, 280, 720), rowH = 40, labelW = Math.min(230, Math.round(w * 0.42)), valW = 64;
    var compact = w < 420;
    var h = items.length * rowH + 6, x0 = compact ? 0 : labelW + 8, x1 = w - valW;
    var max = Math.max.apply(null, items.map(function (d) { return Math.max(d.now || 0, d.before || 0); }).concat([1]));
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": opts.label || "" });
    box.replaceChildren(s);
    if (!compact) {
      var probe = sv("text", { x: 0, y: 0, class: "lbl", "aria-hidden": "true" });
      s.appendChild(probe);
      compact = items.some(function (item) {
        probe.textContent = item.label.length > 34 ? item.label.slice(0, 33) + "…" : item.label;
        return probe.getComputedTextLength() > labelW;
      });
      probe.remove();
    }
    x0 = compact ? 0 : labelW + 8;
    s.setAttribute("data-pair-layout", compact ? "stacked" : "columns");
    var nextY = 4;
    items.forEach(function (d, i) {
      var y = compact ? nextY : i * rowH + 4;
      var group = sv("g", { "data-pair-row": i, "data-pair-label": d.label,
        "data-pair-now": d.now, "data-pair-before": d.before });
      group.appendChild(sv("title", {}, d.label));
      s.appendChild(group);
      var label = sv("text", { x: 0, y: y + 15, class: "lbl" });
      group.appendChild(label);
      var barOffset = 0;
      if (compact) {
        var words = String(d.label).split(/\s+/), line = [], lines = 1;
        var span = sv("tspan", { x: 0, y: y + 15 });
        label.appendChild(span);
        words.forEach(function (word) {
          line.push(word); span.textContent = line.join(" ");
          if (span.getComputedTextLength() > w - 8 && line.length > 1) {
            line.pop(); span.textContent = line.join(" ") + " ";
            line = [word]; lines++;
            span = sv("tspan", { x: 0, y: y + 15 + (lines - 1) * 18 }, word);
            label.appendChild(span);
          }
        });
        barOffset = lines * 18 + 6;
        nextY = y + barOffset + 36;
      } else {
        label.textContent = d.label.length > 34 ? d.label.slice(0, 33) + "…" : d.label;
      }
      var ln = (d.now / max) * (x1 - x0), lb = (d.before / max) * (x1 - x0);
      group.appendChild(sv("rect", { x: x0, y: y + barOffset + 4, width: Math.max(d.now ? 2 : 0, ln), height: 12, fill: opts.color || "var(--work)", "data-anim": "grow", "data-delay": i * 60 }));
      group.appendChild(sv("rect", { x: x0, y: y + barOffset + 20, width: Math.max(d.before ? 2 : 0, lb), height: 6, fill: "var(--ink-3)", "data-anim": "grow", "data-delay": i * 60 + 80 }));
      group.appendChild(sv("text", { x: w, y: y + barOffset + 15, "text-anchor": "end", class: "val" }, fmt(d.now)));
      group.appendChild(sv("text", { x: w, y: y + barOffset + 29, "text-anchor": "end", class: "axis" }, "was " + fmt(d.before)));
    });
    if (compact) s.setAttribute("viewBox", "0 0 " + w + " " + (nextY + 2));
    animate(box);
    return s;
  }

  function heatmap(box, weeks, opts) {
    opts = opts || {};
    var w = widthOf(box, 280, 720), labelW = 58, cols = 7, gap = 3;
    var cw = (w - labelW - gap * (cols - 1)) / cols, ch = Math.min(30, Math.max(18, cw * 0.55)), top = 18;
    var h = top + weeks.length * (ch + gap) + 4;
    var max = 1;
    weeks.forEach(function (wk) { wk.days.forEach(function (d) { if (d && d.passengers > max) max = d.passengers; }); });
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": opts.label || "" });
    ["M", "T", "W", "T", "F", "S", "S"].forEach(function (t, c) {
      s.appendChild(sv("text", { x: labelW + c * (cw + gap) + cw / 2, y: 12, "text-anchor": "middle", class: "axis" }, t));
    });
    weeks.forEach(function (wk, r) {
      var y = top + r * (ch + gap);
      s.appendChild(sv("text", { x: labelW - 8, y: y + ch / 2 + 4, "text-anchor": "end", class: wk.current ? "val" : "axis" }, wk.label));
      wk.days.forEach(function (d, c) {
        var x = labelW + c * (cw + gap);
        var g = sv("g", {});
        if (!d) {
          g.appendChild(sv("rect", { x: x, y: y, width: cw, height: ch, fill: "none", stroke: "var(--rule)", "stroke-dasharray": "2 3" }));
          g.appendChild(sv("title", {}, "not in the stored calendar"));
        } else {
          var p = d.passengers || 0, a = p ? 0.18 + 0.82 * (p / max) : 0;
          g.appendChild(sv("rect", { x: x, y: y, width: cw, height: ch, fill: p ? (opts.color || "var(--port)") : "var(--ground-2)",
            "fill-opacity": p ? a.toFixed(2) : 1, stroke: d.today ? "var(--ink)" : "none", "stroke-width": d.today ? 2 : 0,
            "data-anim": "grow", "data-axis": "y", "data-delay": Math.min(900, r * 40 + c * 15) }));
          g.appendChild(sv("title", {}, d.date + ": " + (p ? fmt(p) + " cruise passengers due" : "no cruise ship listed")));
          if (p >= (opts.mark || 6000) && cw >= 34) g.appendChild(sv("text", { x: x + cw / 2, y: y + ch / 2 + 4, "text-anchor": "middle", class: "cellv" }, (p / 1000).toFixed(1) + "k"));
        }
        s.appendChild(g);
      });
    });
    box.replaceChildren(s);
    animate(box);
    return s;
  }

  function lines(box, labels, series, opts) {
    opts = opts || {};
    var w = widthOf(box, 280, 720), h = opts.height || 220, x0 = 40, x1 = w - 116, y0 = 14, y1 = h - 26;
    var all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null && v !== undefined) all.push(v); }); });
    if (!all.length) return null;
    var lo = Math.floor(Math.min.apply(null, all) * 20) / 20 - 0.05, hi = Math.ceil(Math.max.apply(null, all) * 20) / 20 + 0.05;
    var X = function (i) { return x0 + (labels.length === 1 ? 0 : (i / (labels.length - 1)) * (x1 - x0)); };
    var Y = function (v) { return y1 - ((v - lo) / (hi - lo)) * (y1 - y0); };
    var svg = sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": opts.label || "" });
    var stepV = (hi - lo) > 0.8 ? 0.2 : 0.1;
    for (var t = Math.ceil(lo / stepV) * stepV; t <= hi + 1e-9; t += stepV) {
      svg.appendChild(sv("line", { x1: x0, x2: x1, y1: Y(t), y2: Y(t), stroke: "var(--rule)", "stroke-width": 1 }));
      svg.appendChild(sv("text", { x: x0 - 6, y: Y(t) + 4, "text-anchor": "end", class: "axis" }, t.toFixed(stepV < 0.2 ? 1 : 1)));
    }
    var ends = [];
    series.forEach(function (s) {
      var d = "", pen = false, lastI = -1;
      s.values.forEach(function (v, i) {
        if (v === null || v === undefined) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; pen = true; lastI = i;
      });
      svg.appendChild(sv("path", { d: d, fill: "none", stroke: s.color, "stroke-width": 2.5, "data-anim": "draw" }));
      if (lastI >= 0) ends.push({ y: Y(s.values[lastI]), x: X(lastI), text: s.name + " " + s.values[lastI].toFixed(2), color: s.color });
    });
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(function (e) { svg.appendChild(sv("text", { x: e.x + 6, y: e.y + 4, class: "val" }, e.text)); });
    var dateWidth = function (label) { return String(label || "").length * 8; };
    var firstRight = X(0) + dateWidth(labels[0]);
    var last = labels.length - 1, lastX = X(last), lastAnchor = "end";
    var lastLeft = lastX - dateWidth(labels[last]);
    if (last > 0 && lastLeft < firstRight + 8) {
      lastX = Math.max(lastX, firstRight + 8); lastAnchor = "start"; lastLeft = lastX;
    }
    svg.appendChild(sv("text", { x: X(0), y: h - 6, "text-anchor": "start", class: "axis" }, labels[0]));
    var mid = Math.floor(last / 2), midWidth = dateWidth(labels[mid]);
    if (mid > 0 && mid < last && X(mid) - midWidth / 2 >= firstRight + 8 && X(mid) + midWidth / 2 <= lastLeft - 8) {
      svg.appendChild(sv("text", { x: X(mid), y: h - 6, "text-anchor": "middle", class: "axis" }, labels[mid]));
    }
    if (last > 0) svg.appendChild(sv("text", { x: lastX, y: h - 6, "text-anchor": lastAnchor, class: "axis" }, labels[last]));
    box.replaceChildren(svg);
    animate(box);
    return svg;
  }

function installRunwayChartScheduler(CW) {
  'use strict';
  var entries = new Map(), margin = 400, printing = false, resizeTimer;
  function ancestorsOpen(box) {
    for (var parent = box.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open) return false;
    }
    return true;
  }
  function eligible(entry) {
    if (!entry.box.isConnected || !ancestorsOpen(entry.box)) return false;
    var rect = entry.box.getBoundingClientRect();
    return rect.width > 0 && rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }
  function draw(entry, force) {
    if (!entry) return;
    if ((!force && !eligible(entry)) || entry.drawing) return;
    var width = Math.round(entry.box.clientWidth);
    if (entry.state === 'rendered' && width === entry.width) return;
    entry.drawing = true;
    try {
      entry.callback();
      if (!entry.box.querySelector('svg') && !entry.box.querySelector('[data-chart-empty]')) {
        throw new Error('Registered chart did not produce an SVG or explicit empty state: ' + entry.box.id);
      }
      entry.box.appendChild(entry.alternative);
      entry.state = 'rendered'; entry.width = width; entry.draws++;
      entry.box.dataset.chartState = 'rendered';
      entry.box.style.removeProperty('min-height');
      entry.error = null;
    } catch (error) {
      entry.state = 'failed'; entry.error = error.message;
      entry.box.dataset.chartState = 'failed';
      console.error(error);
    } finally { entry.drawing = false; }
  }
  var observer = 'IntersectionObserver' in window ? new IntersectionObserver(function (records) {
    records.forEach(function (record) { if (record.isIntersecting) draw(entries.get(record.target), false); });
  }, { rootMargin: margin + 'px 0px' }) : null;

  function defer(box, callback, options) {
    if (!box || !box.id || typeof callback !== 'function') throw new Error('Named chart container and draw callback required');
    options = options || {};
    var entry = entries.get(box);
    if (!entry) {
      if (!options.alternative || typeof options.alternative !== 'string') throw new Error('Source-derived chart alternative required: ' + box.id);
      entry = {box:box, callback:callback, state:'pending', width:null, draws:0, error:null, drawing:false};
      entries.set(box, entry);
      var alternative = document.createElement('p');
      alternative.className = 'sr-only'; alternative.textContent = options.alternative;
      entry.alternative = alternative;
      box.replaceChildren(alternative);
      box.dataset.chartRegistered = 'true'; box.dataset.chartState = 'pending';
      box.style.minHeight = (options.height || 240) + 'px';
      if (observer) observer.observe(box);
    } else { entry.callback = callback; }
    draw(entry, printing);
  }
  function flush(root, force) {
    entries.forEach(function (entry) { if (!root || root.contains(entry.box)) draw(entry, !!force); });
  }
  var printGeometry = null;
  function printAll() {
    if (printGeometry) return;
    printing = true; flush(null, true);
    var state = {style:null, attributes:[], plates:[]};
    printGeometry = state;
    function remember(node, names) {
      state.attributes.push({node:node, values:names.map(function (name) { return [name,node.getAttribute(name)]; })});
    }
    var rules = [];
    Array.from(document.styleSheets).forEach(function (sheet) {
      if (!sheet.href || !/\/runway\.css(?:\?|$)/.test(sheet.href)) return;
      Array.from(sheet.cssRules).forEach(function (rule) {
        if (rule.type === 4 && rule.conditionText === 'print') {
          Array.from(rule.cssRules).forEach(function (child) { rules.push(child.cssText); });
        }
      });
    });
    var style = document.createElement('style');
    style.textContent = rules.join('\n') + '\n.page{width:186mm!important;max-width:186mm!important;}';
    document.head.appendChild(style); state.style = style;
    entries.forEach(function (entry) {
      Array.from(entry.box.querySelectorAll('svg[role="img"]')).filter(function (svg) { return !svg.closest('defs'); }).forEach(function (svg) {
        if (!svg.viewBox.baseVal.width) return;
        remember(svg,['style','viewBox']);
        var vb = svg.viewBox.baseVal, width = vb.width, height = vb.height;
        svg.style.setProperty('width','186mm','important');
        svg.style.setProperty('max-width','100%','important');
        svg.style.setProperty('height','auto','important');
        var scale = svg.getBoundingClientRect().width / width;
        if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid paper chart width');
        var font = Math.max(16,16.1 / scale);
        if (entry.box.id === 'plan-flow') {
          var rowGroups = Array.from(svg.children).filter(function (node) { return node.tagName.toLowerCase() === 'g'; });
          var extra = Math.max(0, 36 / scale - 24);
          rowGroups.forEach(function (group,index) {
            remember(group,['transform']);
            group.setAttribute('transform',(group.getAttribute('transform') || '') + ' translate(0 ' + index * extra + ')');
          });
          height += Math.max(0,rowGroups.length - 1) * extra;
        }
        Array.from(svg.querySelectorAll('text')).forEach(function (text) {
          remember(text,['style','x']);
          text.style.setProperty('font-size',font + 'px','important');
          var bounds = text.getBBox(), x = Number(text.getAttribute('x'));
          if (Number.isFinite(x)) {
            var inset = 3 / scale, dx = bounds.x < vb.x + inset ? vb.x + inset - bounds.x : 0;
            if (bounds.x + dx + bounds.width > vb.x + width - inset) dx = vb.x + width - inset - bounds.x - bounds.width;
            text.setAttribute('x',x + dx);
          }
          bounds = text.getBBox();
          var plate = document.createElementNS('http://www.w3.org/2000/svg','rect');
          plate.setAttribute('x',bounds.x - 1 / scale); plate.setAttribute('y',bounds.y - 1 / scale);
          plate.setAttribute('width',bounds.width + 2 / scale); plate.setAttribute('height',bounds.height + 2 / scale);
          var white = entry.box.id === 'plan-flow' && (text.getAttribute('style') || '').includes('var(--ground)');
          plate.style.setProperty('fill',white ? 'var(--print-ink)' : 'var(--print-paper)','important');
          plate.style.setProperty('stroke','none','important');
          text.parentNode.insertBefore(plate,text); state.plates.push(plate);
        });
        svg.setAttribute('viewBox',[vb.x,vb.y,width,height].join(' '));
      });
    });
  }
  function afterPrint() {
    if (printGeometry) {
      var state = printGeometry; printGeometry = null;
      state.plates.forEach(function (node) { node.remove(); });
      state.attributes.reverse().forEach(function (entry) {
        entry.values.forEach(function (pair) { if (pair[1] === null) entry.node.removeAttribute(pair[0]); else entry.node.setAttribute(pair[0],pair[1]); });
      });
      if (state.style) state.style.remove();
    }
    printing = false;
  }
  function status() {
    return Array.from(entries.values()).map(function (entry) {
      return {id:entry.box.id,state:entry.state,width:entry.width,draws:entry.draws,error:entry.error,eligible:eligible(entry)};
    });
  }
  document.addEventListener('toggle', function (event) {
    if (event.target.tagName === 'DETAILS' && event.target.open && !printing) flush(event.target, false);
  }, true);
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (!printing) flush(null, false); }, 60);
  });
  if (!observer) window.addEventListener('scroll', function () { flush(null, false); }, {passive:true});
  CW.defer = defer; CW.flushCharts = flush; CW.printCharts = printAll;
  CW.afterPrintCharts = afterPrint; CW.chartStatus = status;
}

function installRunwayLazyHelpers(CW) {
  'use strict';
  function value(v) { return v === null || v === undefined ? 'not stated' : String(v); }
  function empty(box) {
    var note = document.createElement('p'); note.className = 'empty';
    note.dataset.chartEmpty = 'true'; note.textContent = 'No comparable readings in the stored source.';
    box.replaceChildren(note);
  }
  function schedule(box, render, alternative, height) {
    CW.defer(box, function () {
      if (!render()) empty(box);
    }, {alternative:alternative, height:height || 240});
  }
  CW.lazyColumns = function (box, rows, options) {
    options = options || {};
    schedule(box, function () { return rows.length ? CW.columns(box, rows, options) : null; },
      (options.label || 'Stored values') + '. ' + rows.map(function (r) { return r.label + ': ' + value(r.value); }).join('; '), options.height);
  };
  CW.lazyPairs = function (box, rows, options) {
    options = options || {};
    schedule(box, function () { return rows.length ? CW.pairs(box, rows, options) : null; },
      (options.label || 'Stored comparison') + '. ' + rows.map(function (r) { return r.label + ': current ' + value(r.now) + ', previous ' + value(r.before); }).join('; '), rows.length * 34 + 30);
  };
  CW.lazyLines = function (box, labels, series, options) {
    options = options || {};
    schedule(box, function () { return labels.length ? CW.lines(box, labels, series, options) : null; },
      (options.label || 'Stored series') + '. ' + series.map(function (s) { return s.name + ': ' + labels.map(function (label, i) { return label + ' ' + value(s.values[i]); }).join(', '); }).join('; '), options.height);
  };
  CW.lazyHeatmap = function (box, weeks, options) {
    options = options || {};
    schedule(box, function () { return weeks.length ? CW.heatmap(box, weeks, options) : null; },
      (options.label || 'Stored weekly values') + '. ' + weeks.map(function (week) { return week.label + ': ' + week.days.map(function (day) { return day ? day.date + ' ' + value(day.passengers) + ' passengers due' : 'outside stored calendar'; }).join(', '); }).join('; '), options.height);
  };
}

  window.CW = { sv: sv, sparkline: sparkline, columns: columns, pairs: pairs, heatmap: heatmap, lines: lines, animate: animate, reduce: reduce };
  installRunwayChartScheduler(window.CW);
  installRunwayLazyHelpers(window.CW);
})();
