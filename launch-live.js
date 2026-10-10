(() => {
  'use strict';
  const TZ = 'America/Cayman';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  const settle = () => document.documentElement.classList.add('live-settled');
  if (document.readyState === 'complete') setTimeout(settle, 1200); else addEventListener('load', () => setTimeout(settle, 1200), { once: true });

  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' });
  const dayNumber = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
  const weekday = n => weekdayFmt.format(new Date(n * 86400000));
  const clock = ms => timeFmt.format(new Date(ms)).replace(':00', '').replace(/ | /g, ' ').toLowerCase();
  function point(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { day: dayNumber(value), ms: null };
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? { day: dayNumber(dayFmt.format(new Date(ms))), ms } : null;
  }
  function when(row, now) {
    if (['expired', 'reference', 'needs-review'].includes(row.dataset.status)) return null;
    const today = dayNumber(dayFmt.format(new Date(now)));
    const start = point(row.dataset.starts), end = point(row.dataset.ends);
    const closes = row.classList.contains('job-row') ? 'closes' : 'ends';
    const over = end && (end.ms != null ? end.ms < now : end.day < today);
    if (over) return null;
    const begun = !start || (start.ms != null ? start.ms <= now : start.day <= today);
    if (!begun) {
      const gap = start.day - today, at = start.ms != null ? `, ${clock(start.ms)}` : '';
      const soon = start.ms != null ? start.ms - now <= 86400000 : gap <= 1;
      if (gap === 0) return { text: `today${at}`, soon: 'starts' };
      if (gap === 1) return { text: `tomorrow${at}`, soon: soon ? 'starts' : '' };
      if (gap <= 6) return { text: `${weekday(start.day)}${at}`, soon: '' };
      return { text: `in ${gap} days`, soon: '' };
    }
    if (!end) return null;
    const left = end.day - today, until = end.ms != null ? ` at ${clock(end.ms)}` : '';
    if (row.classList.contains('job-row')) {
      return { text: left === 0 ? 'last day today' : left === 1 ? 'tomorrow' : left <= 6 ? weekday(end.day) : `${left} days left`, soon: '' };
    }
    const live = start && start.ms != null && end.ms != null;
    if (left === 0) return { text: live ? `on now until ${clock(end.ms)}` : end.ms != null ? `${closes} today${until}` : 'last day today', soon: 'ends' };
    if (left === 1) return { text: `${closes} tomorrow${until}`, soon: 'ends' };
    if (left <= 6) return { text: `${closes} ${weekday(end.day)}`, soon: '' };
    return { text: `${left} days left`, soon: '' };
  }
  const visibleRows=new Set();
  function refreshWhen() {
    const now = Date.now();
    for (const row of visibleRows) {
      const meta = $('.record-meta', row) || (row.classList.contains('job-row') ? $('.source-line', row) : null);
      if (!meta) continue;
      const found = when(row, now);
      let chip = $('.live-when', meta);
      if (!found) { chip?.remove(); row.removeAttribute('data-live-soon'); continue; }
      if (!chip) { chip = make('span', 'live-when'); meta.append(chip); }
      if (chip.textContent !== found.text) chip.textContent = found.text;
      if (found.soon) row.dataset.liveSoon = found.soon; else row.removeAttribute('data-live-soon');
    }
  }
  const leadPages = ['briefing', 'opportunities', 'free'];
  let lead = null;
  function refreshLead() {
    if (!leadPages.includes(document.body.dataset.page)) return;
    const anchor = $('.page-lead');
    if (!anchor) return;
    const now = Date.now();
    let best = null, dated = 0;
    for (const row of $$('.notice-row[data-record]')) {
      if (row.hidden) continue;
      const found = when(row, now);
      if (!found) continue;
      dated++;
      const start = point(row.dataset.starts), end = point(row.dataset.ends);
      const begun = !start || (start.ms != null ? start.ms <= now : start.day <= dayNumber(dayFmt.format(new Date(now))));
      const key = !begun ? (start.ms != null ? start.ms : start.day * 86400000 + 18000000) : end ? (end.ms != null ? end.ms : (end.day + 1) * 86400000 + 18000000) : Infinity;
      if (key - now > 7 * 86400000) continue;
      if (!best || key < best.key) best = { key, row, found };
    }
    if (!best) { lead?.remove(); lead = null; return; }
    const link = $('.record-action a[href]', best.row), title = $('h2', best.row)?.childNodes[0]?.textContent.trim();
    if (!link || !title) { lead?.remove(); lead = null; return; }
    if (!lead) {
      lead = make('div', 'live-next');
      lead.setAttribute('role', 'note');
      lead.append(make('p', 'live-next__when'), make('p', 'live-next__what'), make('p', 'live-next__more'));
      anchor.after(lead);
    }
    const text = best.found.text.charAt(0).toUpperCase() + best.found.text.slice(1);
    const [whenLine, what, more] = lead.children;
    if (whenLine.textContent !== text) whenLine.textContent = text;
    const place = (best.row.dataset.areas || '').split('|').filter(Boolean)[0];
    const a = make('a', '', title); a.href = link.getAttribute('href');
    what.replaceChildren(a, place ? ` · ${place}` : '');
    const rest = dated - 1;
    more.textContent = rest > 0 ? `${rest} more dated ${rest === 1 ? 'item' : 'items'} below.` : '';
  }

  if ($('[data-record]')) {
    const tick = () => { refreshWhen(); refreshLead(); };
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)visibleRows.add(entry.target);else visibleRows.delete(entry.target);}if(!document.hidden)refreshWhen();},{rootMargin:'200px'});$$('[data-record]').forEach(row=>observer.observe(row));}
    tick();
    setInterval(()=>{if(!document.hidden)tick();},60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    const status = $('.filter-status');
    const formatResults=()=>{if(!status)return;const label=document.body.dataset.page==='jobs'?'job posts':document.body.dataset.page==='nearby'?'planning records':'notices';const before=status.textContent,after=before.replace(/^(\d+)(?: of (\d+))? records? shown/,(_,count,total)=>`${Number(count).toLocaleString('en-GB')}${total?` of ${Number(total).toLocaleString('en-GB')}`:''} ${label} shown`);if(before!==after)status.textContent=after;};
    if(status){formatResults();new MutationObserver(()=>{formatResults();refreshLead();}).observe(status,{childList:true,characterData:true,subtree:true});}
  }

  const fuelForm = $('[data-fuel-form]'), fuelResult = $('.fuel-result');
  if (fuelForm && fuelResult) {
    const figure = make('div', 'live-figure');
    const value = make('span', 'live-figure__value');
    const line = make('p', 'live-figure__line'), low = make('p', 'live-figure__low');
    figure.append(value, line, low);
    ($('.page-lead') || fuelForm).after(figure);
    const money = n => n.toFixed(2);
    const paint = n => { value.replaceChildren(make('span', 'unit-prefix', 'CI$'), document.createTextNode(money(n))); };
    function run(to) { paint(to); }
    function readFuel() {
      const gallons = Number(fuelForm.elements.gallons?.value), grade = fuelForm.elements.grade?.value || 'regular';
      const rows = $$('[data-station]').filter(r => !r.hidden).map(r => {
        const cell = $(`[data-grade="${grade}"]`, r), price = cell && cell.dataset.price !== '' ? Number(cell.dataset.price) : NaN;
        return { row: r, total: Number.isFinite(price) && Number.isFinite(gallons) ? price * gallons : null };
      });
      const measured = rows.filter(r => r.total !== null).sort((a, b) => a.total - b.total);
      $$('[data-live-lowest]').forEach(r => r.removeAttribute('data-live-lowest'));
      if(!(gallons>=1&&gallons<=1000)){figure.hidden=true;return;}
      const tableBody=rows[0]?.row.parentNode;if(tableBody){measured.forEach(r=>tableBody.append(r.row));rows.filter(r=>r.total===null).forEach(r=>tableBody.append(r.row));}
      if(measured.length<2){figure.hidden=true;return;}
      figure.hidden = false;
      const lowest = measured[0], gap = measured[measured.length - 1].total - lowest.total;
      run(gap);

      const gradeName = grade.charAt(0).toUpperCase() + grade.slice(1);
      line.replaceChildren('between the lowest and highest reported price for ', make('strong', '', `${gallons} imperial gallons of ${gradeName}`), `, across ${measured.length} matching pumps.`);
      const label = r => { const head = $('th', r.row), name = head?.childNodes[0]?.textContent.trim() || '', place = ($('small', head)?.childNodes[0]?.textContent || '').trim(); return name ? `${name}${place ? ` (${place})` : ''}` : ''; };
      const tied = measured.filter(r => Math.abs(r.total-lowest.total)<0.0000001);
      tied.forEach(r => { r.row.dataset.liveLowest = ''; });
      const names = tied.map(label).filter(Boolean);
      low.textContent = !names.length ? '' : tied.length <= 3 ? `Lowest reported: ${names.join(' and ')} · CI$ ${money(lowest.total)}` : `Lowest reported at ${tied.length} pumps · CI$ ${money(lowest.total)}`;
    }
    new MutationObserver(readFuel).observe(fuelResult, { childList: true, characterData: true, subtree: true });
    readFuel();
  }

  let activeShareStatus=null;const topShareStatus=$('.share-status');if(topShareStatus)new MutationObserver(()=>{if(activeShareStatus)activeShareStatus.textContent=topShareStatus.textContent;}).observe(topShareStatus,{childList:true,subtree:true,characterData:true});
  if (document.body.dataset.page !== 'jobs') {
    for (const row of $$('.notice-row[data-record]')) {
      const link = $('.record-action a[href]', row), title = $('h2', row)?.childNodes[0]?.textContent.trim();
      const actions = $('.record-actions', row);
      if (!link || !title || !actions || $('.live-share', actions)) continue;
      const button = make('button', 'live-share', 'Share this');
      button.type = 'button';
      button.dataset.share = '';
      button.dataset.url = link.href;
      button.dataset.title = `${title} · n4m cayman`;
      const localStatus=make('span','live-share-status');localStatus.setAttribute('role','status');localStatus.setAttribute('aria-live','polite');
      button.addEventListener('click',()=>{activeShareStatus=localStatus;localStatus.textContent='Opening share or copy…';});
      actions.append(localStatus);
      actions.append(button);
    }
  }
})();
