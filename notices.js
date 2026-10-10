(function () {
  "use strict";
  var RECENT_DAYS = 7, EARLIER_DAYS = 30, SHOW_PER_SOURCE = 5, SHOW_EARLIER = 8;

  var CSS = [
    ".nt{margin-top:16px}",
    ".nt .nt-lead{margin:0;max-width:60ch}",
    ".nt-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:24px 32px;margin-top:var(--space-notice-groups)}",
    ".nt-g{min-width:0}",
    ".nt .nt-src{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:0 0 8px;font-family:var(--mono);font-weight:500;font-size:12px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}",
    ".nt-n{color:var(--ink-3);letter-spacing:.04em}",
    ".nt .list>li{display:block;padding:0;font-size:15px;line-height:1.4}",
    ".nt-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-2xs) var(--space-sm);align-items:baseline;min-height:44px;padding:12px 0;color:var(--ink);text-decoration:none}",
    ".nt-t{min-width:0;overflow-wrap:anywhere;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;text-decoration-color:var(--ink-3)}",
    ".nt-nolink .nt-t{text-decoration:none}",
    "a.nt-row:hover .nt-t{text-decoration-thickness:2px;text-decoration-color:var(--ink)}",
    "a.nt-row:hover .nt-d{color:var(--ink-2)}",
    "a.nt-row:active .nt-t{color:var(--ink-2)}",
    ".nt-d{white-space:nowrap;font-size:13px;color:var(--ink-3)}",
    ".nt-s2{grid-column:1/-1;font-size:12px;color:var(--ink-3);overflow-wrap:anywhere;min-width:0}",
    ".nt-more>summary{display:block;min-height:44px;padding:12px 0;line-height:20px;font-size:13px;font-weight:600;color:var(--ink-2);white-space:nowrap;cursor:pointer;list-style:none;border-bottom:1px solid var(--rule)}",
    ".nt-more>summary::-webkit-details-marker{display:none}",
    ".nt-more>summary::before{content:\"+\";display:inline-block;width:1.25em;color:var(--ink-3)}",
    ".nt-more[open]>summary::before{content:\"\\2212\"}",
    ".nt-more>summary:hover{color:var(--ink)}",
    ".nt-more>summary:active{color:var(--ink-3)}",
    ".nt-more>summary:focus-visible{outline:2px solid var(--build);outline-offset:1px}",
    ".nt-more[open]>summary .nt-sh,.nt-more:not([open])>summary .nt-hd{display:none}",
    ".nt-more>.list{border-top:0}",
    ".nt-early{margin-top:32px}",
    ".nt-early>.nt-list,.nt-early>.nt-more>.nt-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));column-gap:32px}",
    ".nt-early .list>li{font-size:14px}",
    ".nt .nt-foot{margin-top:24px;padding-top:8px;border-top:1px solid var(--rule)}",
    ".nt-foot a{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:var(--ink-2)}",
    ".nt-foot a:active{color:var(--ink)}",
    ".nt-bad{color:var(--up);font-weight:600}",
    ".nt-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}"
  ].join("\n");

  function injectStyle() {
    if (document.getElementById("nt-style")) return;
    var s = document.createElement("style");
    s.id = "nt-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function pageData() {
    try { if (typeof W !== "undefined" && W) return W; } catch (e) {  }
    return window.W || null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
  function clean(s) { return typeof s === "string" ? s.replace(/\s+/g, " ").replace(/^ | $/g, "") : ""; }

  function dayNum(s) {
    var m = typeof s === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var t = Date.UTC(y, mo - 1, d);
    if (new Date(t).getUTCDate() !== d) return null;
    return Math.round(t / 864e5);
  }
  function todayNum() { var n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 864e5); }
  function asDate(n) { return new Date(n * 864e5 + 432e5); }
  function yearOf(n) { return asDate(n).getUTCFullYear(); }
  function monthKey(n) { var d = asDate(n); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  function fmtDay(n, opts) { opts.timeZone = "UTC"; return asDate(n).toLocaleDateString("en-GB", opts); }
  function shortDay(n, refYear) {
    var o = { day: "numeric", month: "short" };
    if (yearOf(n) !== refYear) o.year = "numeric";
    return fmtDay(n, o);
  }
  function longDay(n) { return fmtDay(n, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function clockOf(s) { var m = typeof s === "string" ? /T(\d{2}):(\d{2})/.exec(s) : null; return m ? m[1] + ":" + m[2] : null; }

  function safeUrl(u) {
    u = clean(u).replace(/ /g, "%20");
    return /^https?:\/\/[^\s"<>]+$/i.test(u) ? u : null;
  }
  function isPdf(u) { return !!u && /\.pdf(?:$|[?#])/i.test(u); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function render(data, root) {
    root = root || document.getElementById("notices");
    if (!root) return false;
    injectStyle();
    var P = pageData();
    if (data === undefined) data = P ? P.notices : null;
    clear(root);
    if (root.classList) root.classList.add("nt"); else root.className += " nt";

    var sources = isObj(data) && Array.isArray(data.sources) ? data.sources.filter(isObj) : [];
    var raw = isObj(data) && Array.isArray(data.items) ? data.items.filter(isObj) : [];
    if (!sources.length && !raw.length) {
      root.appendChild(el("p", "empty", "The weekly scan has not run yet."));
      return true;
    }

    var ref = dayNum(data.scan_date);
    if (ref === null) ref = dayNum(data.generated);
    if (ref === null && P) ref = dayNum(P.generated);
    if (ref === null) ref = todayNum();
    var refYear = yearOf(ref);

    var firstScan = null, inferred = false;
    if (data.baseline === true) firstScan = ref;
    else if (dayNum(data.first_scan) !== null) firstScan = dayNum(data.first_scan);
    else if (data.baseline === false) {
      var minFs = null;
      raw.forEach(function (it) { var f = dayNum(it.first_seen); if (f !== null && (minFs === null || f < minFs)) minFs = f; });
      var markedNew = raw.some(function (it) { return it.new === true && dayNum(it.first_seen) === minFs; });
      if (minFs !== null && !markedNew) { firstScan = minFs; inferred = true; }
    }
    var firstView = firstScan === ref;

    var byId = {}, order = {};
    sources.forEach(function (s, i) {
      var id = s.id === undefined || s.id === null ? "" : String(s.id);
      if (id && !(id in byId)) { byId[id] = s; order[id] = i; }
      var nm = clean(s.name);
      if (nm && !(("name:" + nm) in byId)) { byId["name:" + nm] = s; order["name:" + nm] = i; }
    });
    function sourceOf(it) {
      var k = it.source === undefined || it.source === null ? "" : String(it.source);
      var s = byId[k] || byId["name:" + clean(k)];
      var name = s ? (clean(s.name) || k) : (clean(k) || "Other official source");
      return { key: s ? (s.id !== undefined && s.id !== null ? "id:" + s.id : "name:" + name) : "x:" + name,
        name: name, rank: s ? order[byId[k] ? k : "name:" + clean(k)] : 1e6 };
    }

    var recent = [], earlier = [], undated = 0, held = 0;
    raw.forEach(function (it) {
      var fs = dayNum(it.first_seen);
      if (fs === null) { undated++; return; }
      var age = ref - fs, src = sourceOf(it), url = safeUrl(it.url);
      var row = { title: clean(it.title) || "Untitled document", url: url, fs: fs, dn: dayNum(it.date), src: src };
      if (firstView) { recent.push(row); return; }
      var backlog = fs === firstScan && it.new !== true;
      if (age < RECENT_DAYS) { if (backlog) held++; else recent.push(row); }
      else if (age <= EARLIER_DAYS) { if (backlog) held++; else earlier.push(row); }
    });
    var newestFirst = function (a, b) {
      return (b.fs - a.fs) || ((b.dn === null ? -1e9 : b.dn) - (a.dn === null ? -1e9 : a.dn)) || a.title.localeCompare(b.title);
    };
    recent.sort(newestFirst);
    earlier.sort(newestFirst);

    function metaOf(r) {
      var bits = [];
      if (r.dn !== null) bits.push(shortDay(r.dn, refYear));
      else bits.push("seen " + shortDay(r.fs, refYear));
      if (isPdf(r.url)) bits.push("PDF");
      return bits.join(" · ");
    }
    function rowEl(r, withSource) {
      var li = el("li"), meta = metaOf(r);
      var a = el("div", "nt-row nt-nolink"), info = el("span", "nt-d", meta);
      if (r.url) {
        var open = el("a", "nt-open", "Open");
        open.setAttribute("href", r.url);
        open.setAttribute("rel", "noopener");
        open.setAttribute("aria-label", "Open " + r.title + ", " + meta.replace(/ · /g, ", ") + (withSource ? ", " + r.src.name : ""));
        info.appendChild(document.createTextNode(" · ")); info.appendChild(open);
      }
      if (r.dn !== null && r.dn !== r.fs) a.setAttribute("title", "Dated " + longDay(r.dn) + "; first seen by the scan " + longDay(r.fs));
      a.appendChild(el("span", "nt-t", r.title));
      a.appendChild(info);
      if (withSource) a.appendChild(el("span", "nt-s2", r.src.name));
      li.appendChild(a);
      return li;
    }
    function listEl(rows, withSource) {
      var ul = el("ul", "list nt-list");
      rows.forEach(function (r) { ul.appendChild(rowEl(r, withSource)); });
      return ul;
    }
    function block(box, rows, cap, withSource, context) {
      box.appendChild(listEl(rows.slice(0, cap), withSource));
      if (rows.length <= cap) return;
      var rest = rows.slice(cap), d = el("details", "nt-more"), s = el("summary");
      var sh = el("span", "nt-sh", rest.length + " more"), hd = el("span", "nt-hd", "Hide " + rest.length);
      sh.appendChild(el("span", "nt-vh", " " + context));
      hd.appendChild(el("span", "nt-vh", " " + context));
      s.appendChild(sh); s.appendChild(hd);
      d.appendChild(s);
      d.appendChild(listEl(rest, withSource));
      box.appendChild(d);
    }

    var groups = [], seen = {};
    recent.forEach(function (r) {
      if (!seen[r.src.key]) { seen[r.src.key] = { name: r.src.name, rank: r.src.rank, rows: [] }; groups.push(seen[r.src.key]); }
      seen[r.src.key].rows.push(r);
    });
    groups.sort(function (a, b) { return (a.rank - b.rank) || a.name.localeCompare(b.name); });
    var lead, nSrc = plural(groups.length, "source", "sources");
    if (firstView) {
      if (!recent.length) lead = "First scan, " + longDay(ref) + ": nothing to list.";
      else lead = (inferred
          ? "Everything on file was first seen by the scan on " + longDay(ref) + ": " + plural(recent.length, "item", "items") + " from " + nSrc + "."
          : "First scan, " + longDay(ref) + ": " + plural(recent.length, "item is", "items are") + " listed across " + nSrc + ".") +
        " From the next weekly scan, this list shows only what is new.";
    } else {
      var span = "the 7 days to " + longDay(ref);
      lead = recent.length
        ? plural(recent.length, "new document", "new documents") + " from " + nSrc + ", first seen by the weekly scan in " + span + "."
        : "Nothing new was first seen by the weekly scan in " + span + ".";
      if (held) lead += " " + plural(held, "item", "items") +
        (inferred ? " first seen by the earliest scan on file, " : " already listed at the first scan, ") + longDay(firstScan) +
        ", " + (held === 1 ? "is" : "are") + " not counted as new.";
    }
    if (undated) lead += " " + plural(undated, "more item has", "more items have") + " no date the scan could read and " + (undated === 1 ? "is" : "are") + " not listed.";
    root.appendChild(el("p", "sub nt-lead", lead));

    if (groups.length) {
      var wrap = el("div", "nt-groups");
      groups.forEach(function (g) {
        var box = el("div", "nt-g"), h = el("h3", "nt-src", g.name);
        h.appendChild(el("span", "nt-n", g.rows.length + (firstView ? " listed" : " new")));
        box.appendChild(h);
        block(box, g.rows, SHOW_PER_SOURCE, false, "from " + g.name);
        wrap.appendChild(box);
      });
      root.appendChild(wrap);
    }

    if (earlier.length) {
      var allThisMonth = earlier.every(function (r) { return monthKey(r.fs) === monthKey(ref); });
      var eb = el("div", "nt-early");
      var eh = el("h3", "nt-src", allThisMonth ? "Earlier this month" : "Earlier, in the last 30 days");
      eh.appendChild(el("span", "nt-n", String(earlier.length)));
      eb.appendChild(eh);
      block(eb, earlier, SHOW_EARLIER, true, "seen earlier");
      root.appendChild(eb);
    }

    if (sources.length) {
      var f = el("p", "note nt-foot"), clock = clockOf(data.generated), gd = dayNum(data.generated);
      var okN = sources.filter(function (s) { return s.ok === true; }).length;
      f.appendChild(document.createTextNode("Sources checked" + (gd !== null ? " " + shortDay(gd, refYear) + (clock ? " at " + clock : "") : "") +
        ", " + okN + " of " + sources.length + " read: "));
      sources.forEach(function (s, i) {
        if (i) f.appendChild(document.createTextNode(" · "));
        var name = clean(s.name) || clean(String(s.id === undefined || s.id === null ? "" : s.id)) || "Unnamed source";
        var url = safeUrl(s.url), e = el("span", "nt-e");
        if (url) { var a = el("a", null, name); a.setAttribute("href", url); a.setAttribute("rel", "noopener"); e.appendChild(a); }
        else e.appendChild(el("span", null, name));
        if (s.ok === true) {
          var c = typeof s.count === "number" && isFinite(s.count) ? ", " + plural(s.count, "item", "items") : "";
          e.appendChild(document.createTextNode(" ok" + c));
        } else if (s.ok === false) {
          e.appendChild(document.createTextNode(" "));
          e.appendChild(el("span", "nt-bad", "failed"));
        } else e.appendChild(document.createTextNode(" not reported"));
        f.appendChild(e);
      });
      root.appendChild(f);
    }
    return true;
  }

  function boot() {
    try { render(); }
    catch (err) {
      var root = document.getElementById("notices");
      if (root) { clear(root); root.appendChild(el("p", "empty", "This list could not be drawn.")); }
      if (window.console && console.error) console.error("notices.js:", err);
    }
  }

  window.CWNotices = { render: render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
