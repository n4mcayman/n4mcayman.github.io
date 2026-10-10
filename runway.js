(function () {
  'use strict';
  var data, observer, jobsRendered, noticesRendered, jobsPromise, jobsObserver;
  var number = function (n) { return n == null ? 'Not measured' : Number(n).toLocaleString('en-US'); };
  function fill(id, text) { var node = document.getElementById(id); if (node) node.textContent = text; }
  function currencyPrefix(id) {
    var node = document.getElementById(id), match = node && node.textContent.match(/^(CI\$|\$)([\s\S]+)$/);
    if (!match) return;
    var prefix = document.createElement('span'); prefix.className = 'hero-currency'; prefix.textContent = 'CI$';
    node.replaceChildren(prefix, document.createTextNode(match[2]));
  }
  function courtSource(text) {
    var node = document.getElementById('courts-source-date'); if (!node) return;
    var link = document.createElement('a'); link.href = 'https://judicial.ky/hearing-list/summary-court/';
    link.rel = 'noopener'; link.textContent = "Today's official court list";
    node.replaceChildren(document.createTextNode(text + ' · '), link);
  }
  function figure(id, value, unit) {
    var node = document.getElementById(id);
    if (!node) return;
    node.textContent = number(value);
    if (value != null) node.dataset.value = String(value);
    if (unit) { var label = document.createElement('span'); label.className = 'hero-unit'; label.textContent = ' ' + unit; node.appendChild(label); }
  }
  function cell(value, label) {
    var td = document.createElement('td'); td.dataset.k = label;
    td.textContent = value == null || value === '' ? 'Not stated' : String(value);
    return td;
  }
  function jobsState(state) {
    var table = document.getElementById('all-jobs'); if (!table) return;
    var summary = table.closest('details').querySelector('summary');
    table.querySelector('caption').hidden = state !== 'loaded';
    summary.textContent = state === 'loaded' ? 'All ' + number(table.tBodies[0].rows.length) + ' job posts' :
      state === 'loading' ? 'Loading job posts' : state === 'failed' ? 'Job posts unavailable' : 'Load all job posts';
  }
  function inventories(W) {
    var allJobs = document.getElementById('all-jobs'), packet = window.CWJobs;
    if (allJobs && packet && Array.isArray(packet.posts) && jobsRendered !== packet) {
      var fragment = document.createDocumentFragment();
      var fields = [['title','Job'],['employer','Employer'],['pay','Pay as posted'],['positions','Positions'],['applicants','Applicants'],['approved','Approved'],['ends','Closes'],['place','Where'],['occupation','Occupation'],['work','Work']];
      packet.posts.forEach(function (post) {
        var tr = document.createElement('tr');
        fields.forEach(function (field) { tr.appendChild(cell(post[field[0]], field[1])); });
        fragment.appendChild(tr);
      });
      allJobs.tBodies[0].replaceChildren(fragment); jobsRendered = packet; jobsState('loaded');
      fill('all-jobs-note','WORC public board · snapshot ' + String(packet.taken || 'not dated').replace('T',' ') + ' · ' + number(packet.posts.length) + ' posts.');
    }
    var N = W.notices, allNotices = document.getElementById('all-notices');
    if (N && allNotices && noticesRendered !== N) {
      var sources = {};
      (N.sources || []).forEach(function (source) { sources[source.id] = source.name || source.id; });
      var docs = document.createDocumentFragment();
      (N.items || []).forEach(function (item) {
        var tr = document.createElement('tr');
        tr.appendChild(cell(item.title,'Document')); tr.appendChild(cell(sources[item.source] || item.source,'Source'));
        tr.appendChild(cell(item.date,'Dated')); tr.appendChild(cell(item.first_seen,'First seen'));
        var open = cell(null,'Open');
        try {
          var url = new URL(item.url);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            var a = document.createElement('a'); a.href = url.href; a.rel = 'noopener'; a.textContent = 'Document';
            a.setAttribute('aria-label','Open ' + (item.title || 'official document')); open.replaceChildren(a);
          }
        } catch (error) {  }
        tr.appendChild(open); docs.appendChild(tr);
      });
      allNotices.tBodies[0].replaceChildren(docs); noticesRendered = N;
    }
  }
  function loadJobs(W) {
    if (jobsPromise) return jobsPromise;
    jobsState('loading');
    var retry = document.getElementById('jobs-retry');
    if (retry) retry.hidden = true;
    fill('all-jobs-note','Loading the complete WORC snapshot…');
    jobsPromise = new Promise(function (resolve,reject) {
      var script = document.createElement('script'), timer;
      function finish(error) {
        clearTimeout(timer); script.remove();
        if (error) { reject(error); return; }
        var packet = window.CWJobs;
        var expectedTaken = (W.jobs && W.jobs.taken) || null;
        if (!packet || !Array.isArray(packet.posts) || packet.taken !== expectedTaken ||
            packet.count !== packet.posts.length || packet.posts.length !== W.job_inventory_count) {
          reject(new Error('The job snapshot differs from this edition. Reload the page.')); return;
        }
        inventories(W); resolve(packet);
      }
      script.src = 'jobs-data.js'; script.async = true;
      script.onload = function () { finish(); };
      script.onerror = function () { finish(new Error('The job snapshot could not be loaded.')); };
      timer = setTimeout(function () { finish(new Error('The job snapshot took too long to load.')); },12000);
      document.head.appendChild(script);
    }).catch(function (error) {
      jobsPromise = null; jobsState('failed');
      fill('all-jobs-note',error.message + ' Use the Jobs page for the complete current records.');
      if (retry) retry.hidden = false;
      throw error;
    });
    return jobsPromise;
  }
  function lazyJobs(W) {
    var table = document.getElementById('all-jobs'); if (!table) return;
    var fold = table.closest('details'), retry = document.getElementById('jobs-retry'), print = document.getElementById('jobs-print');
    jobsState(jobsRendered ? 'loaded' : 'empty');
    function demand() { loadJobs(W).catch(function () {  }); }
    fold.addEventListener('toggle',function () { if (fold.open && !printSnapshot) demand(); });
    if (retry) retry.addEventListener('click',demand);
    if (print) {
      print.hidden = false;
      print.addEventListener('click',function () {
        print.disabled = true;
        loadJobs(W).then(function () { window.print(); }).catch(function () {}).finally(function () { print.disabled = false; });
      });
    }
    fill('all-jobs-note','The complete WORC snapshot loads when this list opens. Load it before printing all posts, or print the Jobs page.');
    fold.hidden = false;
    var fallback = document.getElementById('jobs-fallback');
    if (fallback) fallback.hidden = true;
    if ('IntersectionObserver' in window) {
      jobsObserver = new IntersectionObserver(function (entries) {
        if (!printSnapshot && entries.some(function (entry) { return entry.isIntersecting; })) {
          jobsObserver.disconnect(); demand();
        }
      },{rootMargin:'300px 0px'});
      jobsObserver.observe(fold);
    }
    if (fold.open) demand();
  }
  function lazyRecap() {
    var video = document.getElementById('recap');
    if (!video || !video.dataset.poster) return;
    function loadPoster() {
      if (!video.dataset.poster) return;
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
    video.addEventListener('play', loadPoster, {once:true});
    if ('IntersectionObserver' in window) {
      var posterObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          posterObserver.disconnect(); loadPoster();
        }
      }, {rootMargin:'300px 0px', threshold:0});
      posterObserver.observe(video.closest('figure') || video);
    } else {
      loadPoster();
    }
  }
  function newLooks(W) {
    var S = W.ships, C = W.courts, N = W.notices;
    if (S && S.this) {
      figure('port-pax',S.this.passengers);
      fill('ships-source-date','Port Authority schedule · week of ' + S.this.start);
    }
    if (C && C.last && C.this) {
      var current = !!C.this.lists, week = current ? C.this : C.last;
      figure('court-matters',week.matters,'matters');
      fill('court-period','Matters listed ' + (current ? 'this week' : 'last week'));
      courtSource('Summary Court daily cause lists · week of ' + week.start);
    }
    if (N) {
      figure('notices-total',(N.items || []).length);
      fill('notices-source-date','Government public websites · scan ' + String(N.scan_date || N.generated || '').slice(0,10));
      var groups = {}, names = {};
      (N.sources || []).forEach(function (s) { names[s.id] = s.name || s.id; });
      (N.items || []).forEach(function (item) { var key = item.source || 'Not stated'; groups[key] = (groups[key] || 0) + 1; });
      var entries = Object.keys(groups), max = Math.max.apply(null,entries.map(function (key) { return groups[key]; }).concat([0]));
      var marked = false;
      if (window.CW) CW.lazyColumns(document.getElementById('notices-chart'),entries.map(function (key,i) {
        var highlight = !marked && groups[key] === max; if (highlight) marked = true;
        return {label:String(i+1),value:groups[key],highlight:highlight,title:(names[key] || key) + ': ' + groups[key] + ' documents'};
      }),{label:'Official documents on file, by source',accent:'var(--color-accent)',color:'var(--ink-2)',height:200});
      fill('notices-chart-note',entries.map(function (key,i) { return (i+1) + ' ' + (names[key] || key); }).join(' · '));
    }
    var planning = document.getElementById('ytd-value'), meetings = W.meetings || [];
    if (planning && planning.dataset.value) planning.setAttribute('aria-label','CI$' + number(Number(planning.dataset.value)) + ' declared this year');
    currencyPrefix('ytd-value');
    if (meetings.length) {
      var year = meetings[meetings.length - 1].date.slice(0,4);
      fill('planning-period','Declared in ' + year + ' · CI$');
      fill('planning-source-date','Central Planning Authority · ' + year + ' agendas and minutes');
    }
    var rows = Array.from(document.querySelectorAll('#wow tbody tr:not(.grp)'));
    figure('ledger-total',rows.length);
    var directions = [0,0,0,0];
    rows.forEach(function (row) {
      var span = row.querySelector('.chg'), text = span ? span.textContent.trim().toLowerCase() : '';
      directions[text.indexOf('up ') === 0 ? 0 : text.indexOf('down ') === 0 ? 1 : text === 'no change' ? 2 : 3]++;
    });
    if (window.CW) CW.lazyColumns(document.getElementById('ledger-chart'),['Up','Down','Same','Other'].map(function (label,i) { return {label:label,value:directions[i],title:label + ': ' + directions[i] + ' measures'}; }),{label:'Direction of ledger measures: up, down, same or other comparison',color:'var(--ink-2)',height:200});
    var video = document.getElementById('recap');
    if (video) {
      function durationFigure() {
        var saved = Number(video.dataset.durationSeconds);
        var seconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : saved;
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        figure('film-duration',Math.round(seconds));
        document.getElementById('film-duration').title = seconds.toFixed(2) + ' seconds';
        fill('film-kind','Seconds · silent');
      }
      durationFigure();
      if (!video.__durationBound) {
        video.__durationBound = true;
        video.addEventListener('loadedmetadata',durationFigure);
      }
    }
  }
  var m4Packets = {}, m4FilterBound = false;
  function known(value) { return typeof value === 'number' && Number.isFinite(value); }
  function items(value) { return Array.isArray(value) ? value : []; }
  function readState(state) { return state === 'read' || state === 'parsed' || state === 'partial'; }
  function stateText(state) { return ['read','parsed','empty','partial','missing','refused','unverified'].indexOf(state) >= 0 ? state : 'unverified'; }
  function captured(value) {
    if (!value) return 'not dated';
    var stamp = String(value);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(stamp) ? stamp.slice(0,16).replace('T',' ') + ' UTC' : stamp.replace('T',' ').replace(/Z$/,' UTC');
  }
  function packetNotes(packet) { return (packet.method_text ? ' ' + String(packet.method_text) : '') + items(packet.notes).map(function (note) { return ' ' + String(note); }).join(''); }
  function compactCI(value) {
    if (!known(value)) return 'Not stated';
    return 'CI$' + (value >= 1e6 ? (value / 1e6).toFixed(value >= 1e8 ? 0 : 1) + 'M' : number(value));
  }
  function m4Figure(id, value, unit, missing) {
    var node = document.getElementById(id);
    if (!node) return;
    ['data-value','data-min','data-max','data-index','aria-label','title'].forEach(function (key) { node.removeAttribute(key); });
    if (known(value)) figure(id,value,unit);
    else node.textContent = missing || 'Not measured';
  }
  function m4Table(id, rows, fields) {
    var table = document.getElementById(id);
    if (!table) return;
    var fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      fields.forEach(function (field) { tr.appendChild(cell(typeof field[0] === 'function' ? field[0](row) : row[field[0]],field[1])); });
      fragment.appendChild(tr);
    });
    table.tBodies[0].replaceChildren(fragment);
  }
  function m4Source(url, label, context) {
    var td = cell(null,label);
    try {
      var parsed = new URL(url), hosts = ['weather.gov.ky','www.weather.gov.ky','careers.gov.ky','gov.ky','planning.ky','www.planning.ky','publicconsultation.gov.ky'];
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || hosts.indexOf(parsed.hostname) < 0 || Array.from(parsed.searchParams.keys()).some(function (key) { return /token|auth|csrf|email|password|session/i.test(key); })) return td;
      var anchor = document.createElement('a'); anchor.href = parsed.href; anchor.rel = 'noopener'; anchor.textContent = label;
      anchor.setAttribute('aria-label',label + ' · ' + context); td.replaceChildren(anchor);
    } catch (error) {  }
    return td;
  }
  function m4LinkColumn(id, rows, links) {
    var table = document.getElementById(id);
    if (!table) return;
    Array.from(table.tBodies[0].children).forEach(function (tr,i) {
      links.forEach(function (link) { tr.appendChild(m4Source(rows[i][link[0]],link[1],String(rows[i][link[2]] || 'official source'))); });
    });
  }
  function m4MeetingSupplements(meetings) {
    var table = document.getElementById('dcb-meetings');
    if (!table) return;
    Array.from(table.tBodies[0].children).forEach(function (tr,i) {
      var agendaCell = tr.children[4];
      items(meetings[i].supplements).forEach(function (supplement) {
        var source = m4Source(supplement.url,'Addendum',String(meetings[i].date || meetings[i].key) + ' · ' + String(supplement.label || 'agenda supplement'));
        var anchor = source.querySelector('a'), label = document.createElement('span');
        label.textContent = ' · ' + String(supplement.label || 'Agenda supplement') + ': ';
        agendaCell.appendChild(label);
        if (anchor) agendaCell.appendChild(anchor);
        else agendaCell.appendChild(document.createTextNode('Source link not verified'));
      });
    });
  }
  function m4DcbItem(row) {
    var agenda = String(row.item_ref || 'Not stated'), minutes = row.minutes_item_ref == null ? null : String(row.minutes_item_ref);
    var refs = minutes && minutes !== agenda ? 'Agenda ' + agenda + ' · minutes ' + minutes : agenda;
    return refs + ' · ' + (row.join_basis ? String(row.join_basis) : 'Minutes match not verified') + (row.source_kind === 'minutes_only' ? ' · Agenda match not verified' : '');
  }
  function m4Chart(id, values, label, caption) {
    var host = document.getElementById(id);
    if (!host) return;
    if (!window.CW || !values.length || !values.some(function (row) { return known(row.value); })) {
      var note = document.createElement('p'); note.className = 'note chart-unavailable'; note.textContent = 'No comparable verified readings are available.';
      host.replaceChildren(note); host.dataset.state = 'unavailable';
    } else {
      var max = Math.max.apply(null,values.filter(function (row) { return known(row.value); }).map(function (row) { return row.value; })), marked = false;
      values.forEach(function (row) { row.highlight = !marked && known(row.value) && row.value === max; if (row.highlight) marked = true; });
      CW.lazyColumns(host,values,{label:label,color:'var(--ink-2)',accent:'var(--color-accent)',height:120,values:false});
      host.dataset.state = 'drawn';
    }
    fill(id + '-note',caption);
  }
  function dcbFilter() {
    var select = document.getElementById('dcb-meeting-filter'), table = document.getElementById('dcb-applications');
    if (!select || !table) return;
    var visible = 0;
    Array.from(table.tBodies[0].children).forEach(function (tr) { tr.hidden = !!select.value && tr.dataset.meeting !== select.value; if (!tr.hidden) visible++; });
    table.querySelector('caption').textContent = number(visible) + ' listings shown · ' + number(table.tBodies[0].children.length) + ' stored. ' + (select.value ? 'Selected meeting; ' : 'All meetings; ') + 'printing includes every stored listing.';
  }
  function m4Inventories(W) {
    var weather = W.weather || {}, service = W.public_service || {}, cabinet = W.cabinet || {}, dcb = W.dcb || {};
    if (m4Packets.weather !== weather) {
      var forecasts = items(weather.forecasts), warnings = items(weather.warnings);
      m4Table('weather-readings',items(weather.readings),[['date','Printed date'],['updated_text','Updated'],[function (row) { return String(row.item || 'Not stated') + ' · ' + String(row.verification || 'Not verified'); },'Metric'],['observed_text','Observed'],['record_text','Record / year'],['normal_text','Normal'],['extra_text','More information']]);
      m4Table('weather-forecasts',forecasts,[['issued_text','Issued'],['valid_text','Valid'],['waves_text','Waves'],['wind_text','Wind'],['synopsis_text','Synopsis']]);
      m4LinkColumn('weather-forecasts',forecasts,[['source_url','Source','issued_text']]);
      m4Table('weather-warnings',warnings,[['issued_text','Date as recorded'],['title','Title'],['text','Statement']]);
      m4LinkColumn('weather-warnings',warnings,[['source_url','Source','title']]); m4Packets.weather = weather;
    }
    if (m4Packets.service !== service) {
      var coverage = items(service.by_source);
      m4Table('public-posts',items(service.posts),[['title','Job'],['body','Public body'],['pay_text','Pay as posted'],['closes','Closes']]);
      m4LinkColumn('public-posts',items(service.posts),[['source_url','Source','title']]);
      m4Table('public-source-coverage',coverage,[[function (r) { return r.name || r.key; },'Source'],['taken','Captured'],[function (r) { return known(r.recorded_count) ? number(r.recorded_count) : 'Not measured'; },'Recorded posts'],[function (r) { return stateText(r.state) + (r.coverage_complete === true ? ' · complete listing coverage' : ' · incomplete listing coverage'); },'Coverage']]);
      m4LinkColumn('public-source-coverage',coverage,[['url','Source','name']]);
      var method = document.querySelector('#public-service .public-method'), agency = document.querySelector('#public-service .public-agencies');
      if (method) method.textContent = (known(service.median_annual_ci) ? 'Median advertised annual pay: CI$' + number(service.median_annual_ci) + ' across ' + number(service.pay_denominator) + ' parsed salaries.' : 'Median advertised annual pay is not measured.') + ' ' + (known(service.pay_missing) ? number(service.pay_missing) + ' posts lack a parsed salary. ' : '') + (known(service.closing_next7) ? number(service.closing_next7) + ' posts close within seven days of the source snapshot. ' : 'Closing-within-seven-days is not measured. ') + (service.new == null ? 'New-post comparisons are unavailable on this first snapshot. ' : 'Comparable-history measures retain their source period. ') + 'Original pay and closing text remain in the full listing; annual CI conversions and their denominator are recounted upstream.' + packetNotes(service);
      if (agency) agency.textContent = items(service.by_agency).length ? 'Recorded posts by public body: ' + service.by_agency.map(function (row) { return String(row.body) + ': ' + (known(row.count) ? number(row.count) : 'Not measured'); }).join(' · ') : 'Public-body counts are not measured.';
      m4Packets.service = service;
    }
    if (m4Packets.cabinet !== cabinet) {
      var summaries = items(cabinet.summaries), categories = [];
      m4Table('cabinet-summaries',summaries,[['meeting_date','Meeting'],[function (r) { return r.published_date || 'Not verified'; },'Published / proxy'],['published_basis','Date basis'],[function (r) { return known(r.decision_count) ? number(r.decision_count) : 'Not measured'; },'Decision items'],[function (r) { return stateText(r.parse_state); },'Parse state'],[function (r) { return known(r.lag_days) ? number(r.lag_days) + ' days' : 'Not measured'; },'Publication lag']]);
      m4LinkColumn('cabinet-summaries',summaries,[['url','Source','meeting_date']]);
      summaries.forEach(function (summary) { if (!readState(summary.parse_state)) return; items(summary.categories).forEach(function (category) { categories.push({date:summary.meeting_date,kind:category.kind,count:category.count}); }); });
      m4Table('cabinet-category-counts',categories,[['date','Meeting'],['kind','Category'],[function (r) { return known(r.count) ? number(r.count) : 'Not measured'; },'Decision items']]); m4Packets.cabinet = cabinet;
    }
    if (m4Packets.dcb !== dcb) {
      var meetings = items(dcb.meetings), applications = items(dcb.applications), outcomes = new Map();
      m4Table('dcb-meetings',meetings,[['key','Meeting'],['date','Date'],[function (r) { return stateText(r.agenda_state); },'Agenda'],[function (r) { return stateText(r.minutes_state); },'Minutes']]);
      m4LinkColumn('dcb-meetings',meetings,[['agenda_url','Agenda','date'],['minutes_url','Minutes','date']]);
      m4MeetingSupplements(meetings);
      m4Table('dcb-applications',applications,[['meeting_date','Meeting date'],[m4DcbItem,'Item'],[function (r) { return r.source_kind === 'agenda' ? 'Agenda' : r.source_kind === 'minutes_only' ? 'Minutes only' : 'Not stated'; },'Source kind'],['island','Island'],['district','District'],['applicant_masked','Applicant'],['description_safe','Proposal'],[function (r) { return r.value_text || (known(r.value) ? 'CI$' + number(r.value) : 'Not stated'); },'Declared value'],[function (r) { return r.outcome || 'Not verified'; },'Outcome']]);
      var table = document.getElementById('dcb-applications'), select = document.getElementById('dcb-meeting-filter');
      Array.from(table.tBodies[0].children).forEach(function (tr,i) { tr.dataset.meeting = String(applications[i].meeting_key || ''); });
      var selected = select.value, fragment = document.createDocumentFragment(), all = document.createElement('option'); all.value = ''; all.textContent = 'All meetings'; fragment.appendChild(all);
      var keys = new Map(); meetings.forEach(function (meeting) { keys.set(String(meeting.key),meeting.date || meeting.key); });
      applications.forEach(function (app) { if (app.meeting_key && !keys.has(String(app.meeting_key))) keys.set(String(app.meeting_key),app.meeting_date || app.meeting_key); });
      keys.forEach(function (date,key) { var option = document.createElement('option'); option.value = key; option.textContent = String(date) + ' · ' + key; fragment.appendChild(option); });
      select.replaceChildren(fragment); select.value = keys.has(selected) ? selected : '';
      if (!m4FilterBound) { select.addEventListener('change',dcbFilter); m4FilterBound = true; } dcbFilter();
      applications.forEach(function (app) {
        if (!app.outcome) return;
        var key = JSON.stringify([app.meeting_key,app.island,app.outcome]), row = outcomes.get(key);
        if (!row) { row = {date:app.meeting_date,island:app.island || 'Not stated',outcome:app.outcome,count:0}; outcomes.set(key,row); } row.count++;
      });
      m4Table('dcb-outcomes',Array.from(outcomes.values()),[['date','Meeting'],['island','Island'],['outcome','Outcome'],['count','Listings']]); m4Packets.dcb = dcb;
    }
  }
  function additionalLooks(W) {
    m4Inventories(W);
    var weather = W.weather || {}, daily = weather.daily || {}, forecast = weather.forecast || {}, weatherValues = [], weatherCaption = 'No comparable verified readings are available.';
    var dailyRead = readState(daily.state), heat = dailyRead && known(daily.max_heat_index_f), temp = dailyRead && known(daily.max_temp_c);
    var lastAvailable = daily.last_available === true;
    var waves = readState(forecast.state) && known(forecast.wave_min_ft) && known(forecast.wave_max_ft) && forecast.wave_min_ft >= 0 && forecast.wave_max_ft >= forecast.wave_min_ft;
    var weatherDeck = document.querySelector('#weather .look-deck'), weatherHeading = document.querySelector('#weather .look-chart h3');
    if (weatherDeck) weatherDeck.textContent = heat || temp ? 'The latest verified daily reading, with forecasts kept distinct.' : waves ? 'The latest printed forecast, with daily readings kept distinct.' : 'Published weather records, with missing readings kept explicit.';
    if (weatherHeading) weatherHeading.textContent = heat || temp ? 'Observed temperature and reference' : waves ? 'Forecast wave range' : 'No comparable reading';
    m4Figure('weather-hero',null,null,'No reading');
    var weatherHero = document.getElementById('weather-hero');
    if (heat || temp) {
      m4Figure('weather-hero',heat ? daily.max_heat_index_f : daily.max_temp_c,heat ? '°F' : '°C');
      fill('weather-kind',(lastAvailable ? 'Last available ' : '') + (heat ? 'maximum heat index' : 'maximum temperature') + ' · observed ' + (daily.date || 'date not printed'));
      weatherHero.dataset.index = (heat ? 'Observed heat index' : 'Observed maximum temperature') + (lastAvailable ? ' · last available' : '');
      fill('weather-source','CINWS · observed ' + (daily.date || 'date not printed') + ' · ' + (daily.updated_text || 'update not printed') + ' · captured ' + captured(daily.taken || weather.taken));
      if (temp && known(daily.normal_max_temp_c)) {
        weatherCaption = number(daily.max_temp_c) + ' °C observed · ' + number(daily.normal_max_temp_c) + ' °C published normal. Source daily cutoff: ' + (daily.updated_text || 'not printed') + '.';
        weatherValues = [{label:'Observed',value:daily.max_temp_c,title:weatherCaption},{label:'Normal',value:daily.normal_max_temp_c,title:weatherCaption}];
      }
    } else if (waves) {
      weatherHero.textContent = number(forecast.wave_min_ft) + '–' + number(forecast.wave_max_ft);
      var waveUnit = document.createElement('span'); waveUnit.className = 'hero-unit'; waveUnit.textContent = ' ft'; weatherHero.appendChild(waveUnit);
      weatherHero.dataset.min = String(forecast.wave_min_ft); weatherHero.dataset.max = String(forecast.wave_max_ft); weatherHero.dataset.index = 'Forecast waves';
      weatherHero.setAttribute('aria-label','Forecast waves: ' + forecast.wave_min_ft + ' to ' + forecast.wave_max_ft + ' feet');
      fill('weather-kind','Forecast waves · ' + (forecast.valid_text || 'validity not printed'));
      fill('weather-source','CINWS forecast · ' + (forecast.issued_text ? 'issued ' + forecast.issued_text : 'issue not printed') + ' · captured ' + captured(forecast.taken || weather.taken));
      weatherCaption = 'Forecast range endpoints: ' + forecast.wave_min_ft + '–' + forecast.wave_max_ft + ' ft. ' + (forecast.issued_text ? 'Issued ' + forecast.issued_text + '. ' : '') + (forecast.valid_text || 'Validity not printed.') + ' These are forecast endpoints, not observations.';
      weatherValues = [{label:'From',value:forecast.wave_min_ft,title:weatherCaption},{label:'To',value:forecast.wave_max_ft,title:weatherCaption}];
    } else { fill('weather-kind','No reading'); weatherHero.dataset.index = 'No reading'; fill('weather-source','CINWS · source state ' + stateText(weather.state) + ' · captured ' + captured(weather.taken)); }
    var weatherQualification = lastAvailable ? 'Last available observation: ' + (daily.date || 'not dated') + ', cutoff ' + (daily.updated_text || 'not printed') + '; no verified new daily reading.' : heat || temp ? 'Observed only over the printed daily source period.' : waves ? 'Daily reading unverified; the figure is a printed forecast.' : 'No verified daily reading or forecast range is available.';
    fill('weather-note',weatherQualification);
    var weatherMethod = document.querySelector('#weather .weather-method');
    if (weatherMethod) weatherMethod.textContent = (daily.state === 'empty' ? 'No daily reading was published in the captured report.' : 'Daily source: ' + stateText(daily.state) + '. Available readings cover only the printed source period; forecasts and warnings retain separate issue dates.') + ' ' + weatherQualification + ' Weekly weather comparisons are unavailable on this first snapshot.' + packetNotes(weather);
    m4Chart('weather-chart',weatherValues,'Published weather reading and reference; forecasts kept distinct',weatherCaption);

    var service = W.public_service || {}, posts = items(service.posts), sourceCounts = items(service.by_source);
    m4Figure('public-service-hero',readState(service.state) || posts.length ? posts.length : null);
    fill('public-service-kind',service.coverage_complete === true && service.open_date_valid === true ? 'Open public job posts' : 'Public job posts recorded');
    fill('public-service-note',(service.coverage_complete === true ? 'Both captured source lists have complete coverage.' : 'Source coverage is incomplete or unverified.') + (service.new == null ? ' First-snapshot new-post comparisons are unavailable.' : ' Comparisons use the stated source period.'));
    fill('public-service-source','Government public vacancy lists · latest capture ' + captured(service.taken));
    var sourceRows = ['civil_service','sagc'].map(function (key,i) { var row = sourceCounts.find(function (source) { return source.key === key; }); return {label:i ? 'SAGC' : 'Civil',value:row && known(row.recorded_count) ? row.recorded_count : null,title:(i ? 'SAGC' : 'Civil service') + ': ' + (row && known(row.recorded_count) ? number(row.recorded_count) + ' recorded posts, ' + stateText(row.state) : 'not measured')}; });
    m4Chart('public-service-chart',sourceRows,'Recorded posts by Civil service and SAGC source',sourceRows.map(function (row) { return row.title; }).join(' · ') + '. Counts are posts, not positions.');

    var cabinet = W.cabinet || {}, summaries = items(cabinet.summaries), parsed = summaries.filter(function (summary) { return readState(summary.parse_state) && known(summary.decision_count); }).sort(function (a,b) { return String(a.meeting_date).localeCompare(String(b.meeting_date)); });
    var selectedSummary = parsed.find(function (summary) { return summary.meeting_date === cabinet.latest_parsed_date; }) || parsed[parsed.length - 1];
    m4Figure('cabinet-hero',selectedSummary ? selectedSummary.decision_count : null);
    fill('cabinet-kind',selectedSummary ? 'Decision items · meeting ' + selectedSummary.meeting_date : 'Decision items · no parsed summary');
    var newest = summaries.slice().sort(function (a,b) { return String(a.meeting_date).localeCompare(String(b.meeting_date)); }).pop();
    var cabinetWindow = items(cabinet.notes).map(function (note) { return String(note).match(/^Index window ([0-9]+[–-][0-9]+ of [0-9]+ entries)/); }).find(function (match) { return match; });
    fill('cabinet-note',(newest && selectedSummary && newest.meeting_date > selectedSummary.meeting_date ? 'Latest parsed meeting; the newest indexed summary is unverified.' : selectedSummary ? 'Lettered decision items in the selected meeting.' : 'No verified decision count is available.') + (cabinetWindow ? ' Index window ' + cabinetWindow[1] + '.' : ' Captured index coverage: ' + summaries.length + ' stored summaries.'));
    var cabinetMethod = document.querySelector('#cabinet .cabinet-method');
    if (cabinetMethod) cabinetMethod.textContent = 'Counts refer to lettered items in the selected published summary. Publication dates and uploaded proxies remain distinct; missing or inconsistent lags are not measured.' + packetNotes(cabinet);
    fill('cabinet-source','Cabinet published summaries · ' + (selectedSummary ? 'meeting ' + selectedSummary.meeting_date : 'source ' + stateText(cabinet.state)) + ' · index captured ' + captured(cabinet.taken));
    var categoryRows = selectedSummary ? items(selectedSummary.categories).map(function (category,i) { return {label:String(i+1),value:known(category.count) ? category.count : null,title:String(category.kind) + ': ' + number(category.count) + ' decision items'}; }) : [];
    m4Chart('cabinet-chart',categoryRows,'Decision items by aggregate category in the selected Cabinet summary',selectedSummary ? items(selectedSummary.categories).map(function (category,i) { return (i+1) + ' ' + category.kind + ': ' + number(category.count); }).join(' · ') : 'No parsed summary is available.');

    var dcb = W.dcb || {}, meeting = items(dcb.meetings).find(function (row) { return row.key === dcb.latest_agenda_key; });
    var applications = meeting ? items(dcb.applications).filter(function (app) { return app.meeting_key === meeting.key && (app.source_kind === 'agenda' || app.source_kind === undefined); }) : [];
    var valued = applications.filter(function (app) { return known(app.value); });
    var sum = meeting && known(meeting.declared_total) ? meeting.declared_total : null;
    if (!meeting || !readState(meeting.agenda_state)) sum = null;
    m4Figure('dcb-hero',sum,null,'Not stated');
    var dcbHero = document.getElementById('dcb-hero');
    if (known(sum)) { dcbHero.textContent = compactCI(sum); dcbHero.dataset.value = String(sum); dcbHero.setAttribute('aria-label','CI$' + number(sum) + ' stated declared value'); dcbHero.title = 'CI$' + number(sum); }
    currencyPrefix('dcb-hero');
    fill('dcb-kind','Declared value as stated' + (meeting ? ' · meeting ' + meeting.date : ' · no verified agenda'));
    fill('dcb-note',meeting ? number(known(meeting.values_count) ? meeting.values_count : valued.length) + ' listings state a value; ' + number(known(meeting.values_missing) ? meeting.values_missing : applications.length - valued.length) + ' lack one. ' + (sum == null ? 'No stated sum is available.' : 'The sum includes stated values only.') : 'No verified agenda reading is available; stored inventories retain their source states.');
    var dcbMethod = document.querySelector('#sister-islands .dcb-method'), measures = dcb.measures || {};
    if (dcbMethod) dcbMethod.textContent = 'Rolling source window: ' + (measures.window_start || 'not measured') + ' to ' + (measures.window_end || 'not measured') + '. ' + (known(measures.applications) ? number(measures.applications) + ' eligible application listings. ' : 'Application count not measured. ') + (known(measures.declared_total) ? 'Stated declared total CI$' + number(measures.declared_total) + '. ' : 'Stated declared total not measured. ') + (known(measures.values_missing) ? number(measures.values_missing) + ' listings lack declared values. ' : 'Missing-value count not measured. ') + (items(measures.districts).length ? 'Listings by district: ' + measures.districts.map(function (row) { return String(row.name || 'Not stated') + ': ' + (known(row.count) ? number(row.count) : 'Not measured'); }).join(' · ') + '.' : 'District counts not measured.') + packetNotes(dcb);
    fill('dcb-source','Development Control Board · ' + (meeting ? 'agenda ' + meeting.date : 'source ' + stateText(dcb.state)) + ' · index captured ' + captured(dcb.taken));
    var islandRows = meeting && readState(meeting.agenda_state) && meeting.coverage_complete === true ? ['Cayman Brac','Little Cayman','Not stated'].map(function (island,i) { var count = applications.filter(function (app) { var classified = app.island === 'Cayman Brac' || app.island === 'Little Cayman' ? app.island : 'Not stated'; return classified === island; }).length; return {label:['Brac','Little Cayman','Unstated'][i],value:count,title:island + ': ' + count + ' listings in agenda ' + meeting.date}; }) : [];
    m4Chart('dcb-chart',islandRows,'Application listings by island in the selected Development Control Board agenda',meeting ? 'Agenda ' + meeting.date + '. Island is read from verified registration or district evidence; unknown classifications remain in the inventory. ' + islandRows.map(function (row) { return row.title; }).join(' · ') : 'No verified agenda is available.');
  }

  function change(now, before, money) {
    if (now == null || before == null) return 'Previous reading unavailable';
    var diff = now - before;
    if (Math.abs(diff) < .000001) return 'No change on the previous reading';
    return (diff > 0 ? '▲ Up ' : '▼ Down ') + (money ? 'CI$' + Math.abs(diff).toFixed(2) : number(Math.abs(diff))) + ' on the previous reading';
  }
  function refresh(W) {
    data = W;
    var weeks = (W.fuel || []).filter(function (f) { return f.averages && f.averages.regular; });
    var fuel = weeks[weeks.length - 1];
    if (fuel) {
      fill('fuel-hero', 'CI$' + fuel.averages.regular.current.toFixed(2));
      currencyPrefix('fuel-hero');
      document.getElementById('fuel-hero').setAttribute('data-value', String(fuel.averages.regular.current));
      fill('fuel-change', change(fuel.averages.regular.current, fuel.averages.regular.previous, true));
      fill('fuel-source-date', 'URCO weekly report · week to ' + fuel.week);
    } else {
      fill('fuel-hero', 'Not measured');
      fill('fuel-source-date', 'URCO weekly report · no reading available');
    }
    var J = W.jobs;
    if (J) {
      fill('jobs-open', number(J.open_posts));
      var hero = document.getElementById('jobs-open'), unit = document.createElement('span');
      unit.className = 'hero-unit'; unit.textContent = ' jobs'; hero.appendChild(unit);
      hero.setAttribute('data-value', String(J.open_posts));
      fill('jobs-source-date', 'WORC public job board · snapshot ' + String(J.taken || '').slice(0,10));
    }
    inventories(W);
    newLooks(W);
    additionalLooks(W);
    document.querySelectorAll('[data-count-target]').forEach(function (summary) {
      var target = document.querySelector(summary.dataset.countTarget);
      if (target && target.id === 'all-jobs') return;
      var count = target && target.id === 'all-jobs' ? W.job_inventory_count : target ? target.querySelectorAll(summary.dataset.countRows || 'tbody tr').length : 0;
      summary.textContent = summary.dataset.countPrefix + ' ' + number(count) + ' ' + summary.dataset.countNoun;
    });
    var averages = document.querySelector('#board');
    if (averages) fill('fuel-averages-summary', 'All ' + averages.children.length + ' fuel averages');
    ['cheap','occ','agents'].forEach(function (id) {
      var table = document.getElementById(id);
      if (!table) return;
      var labels = Array.from(table.querySelectorAll('thead th')).map(function (th) { return th.textContent; });
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        Array.from(tr.children).forEach(function (td,i) { td.setAttribute('data-k', labels[i] || ''); });
      });
    });
    if (window.Glance) window.Glance.render(W);
  }
  var printSnapshot = null;
  function beginPrintState() {
    if (printSnapshot) return;
    var tables = ['apps','dcb-applications'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    printSnapshot = {
      closed:Array.from(document.querySelectorAll('details:not([open])')),
      rows:tables.flatMap(function (table) { return Array.from(table.querySelectorAll('tbody tr')).map(function (row) { return {node:row,hidden:row.hidden}; }); }),
      captions:tables.map(function (table) { var caption = table.querySelector('caption'); return {table:table,node:caption,text:caption ? caption.textContent : null}; }),
      filters:['meeting','dcb-meeting-filter'].map(function (id) { var node = document.getElementById(id); return node ? {node:node,value:node.value} : null; }).filter(Boolean),
      jobsNote:document.getElementById('all-jobs-note') ? document.getElementById('all-jobs-note').textContent : null
    };
    printSnapshot.closed.forEach(function (fold) { fold.open = true; });
    printSnapshot.rows.forEach(function (row) { row.node.hidden = false; });
    printSnapshot.captions.forEach(function (caption) {
      if (!caption.node) return;
      var count = caption.table.querySelectorAll('tbody tr').length;
      caption.node.textContent = number(count) + (caption.table.id === 'apps' ? ' stored CPA agenda listings across all meetings; repeat hearings are retained.' : ' stored DCB listings across all meetings, including minutes-only records.');
    });
  }
  function endPrintState() {
    if (!printSnapshot) return;
    var state = printSnapshot; printSnapshot = null;
    state.closed.forEach(function (fold) { fold.open = false; });
    state.rows.forEach(function (row) { row.node.hidden = row.hidden; });
    state.filters.forEach(function (filter) { filter.node.value = filter.value; });
    state.captions.forEach(function (caption) { if (caption.node) caption.node.textContent = caption.text; });
    if (!jobsRendered && state.jobsNote !== null) fill('all-jobs-note',state.jobsNote);
  }

  function init(W) {
    refresh(W);
    lazyJobs(W);
    lazyRecap();
    document.querySelectorAll('.look-fold').forEach(function (fold) {
      fold.addEventListener('toggle', function () {
        if (fold.open) { var look = fold.closest('.runway-look'); if (look) look.classList.add('is-visible'); }
        if (fold.open && !printSnapshot && window.CW) CW.flushCharts(fold, false);
      });
    });
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduce.matches && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
        });
      }, { threshold:0, rootMargin:'0px 0px -24px 0px' });
      document.querySelectorAll('.runway-look').forEach(function (look) { look.classList.add('reveal-once'); observer.observe(look); });
      reduce.addEventListener('change', function () {
        if (reduce.matches) {
          observer.disconnect();
          document.querySelectorAll('.runway-look').forEach(function (look) { look.classList.add('is-visible'); });
        }
      });
    }
    window.addEventListener('beforeprint', function () {
      beginPrintState();
      if (!jobsRendered) fill('all-jobs-note','The full WORC snapshot has not been loaded in this print. Use Print all job posts below, or print the complete Jobs page.');
      if (window.CW) CW.printCharts();
    });
    window.addEventListener('afterprint', function () {
      endPrintState();
      if (window.CW) { CW.afterPrintCharts(); CW.flushCharts(null, false); }
    });
  }
  window.Runway = { init:init, refresh:refresh };
})();
