(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const canonical = $('link[rel="canonical"]')?.href || location.href;
  const currentDate = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cayman',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const currentTimestamp = Date.now();
  const currentStatus = row => {
    const original=row.dataset.status;
    if(['reference','needs-review','expired'].includes(original))return original;
    const end=row.dataset.ends || '',start=row.dataset.starts || '';
    const ended=/^\d{4}-\d{2}-\d{2}$/.test(end) ? end < currentDate : Number.isFinite(Date.parse(end)) && Date.parse(end)<currentTimestamp;
    if(ended)return 'expired';
    if(start&&Number.isFinite(Date.parse(start))&&Date.parse(start)>currentTimestamp)return 'upcoming';
    return original || 'reference';
  };
  const filteredURL = () => {
    const url=new URL(canonical);
    if(document.body.dataset.page==='jobs')for(const key of ['area','query','pay','closing']){const value=$(`[data-filter="${key}"]`)?.value;if(value)url.searchParams.set(key,value);}
    return url.href;
  };
  const output = (node, text) => { if (node) node.textContent = text; };
  const eventNames=new Set(['share_opened','copy_completed','source_clicked','calendar_download_started','print_requested','fuel_comparison']);
  const eventTopics=new Set(['briefing','opportunities','fuel','jobs','nearby','free','fine-print','essentials','archive','item','job']);
  const eventTopic=document.body.dataset.page==='planning'?'nearby':document.body.dataset.page;
  function track(name) {
    if(!$('#cayman-analytics') || !eventNames.has(name) || !eventTopics.has(eventTopic) || navigator.doNotTrack==='1' || window.doNotTrack==='1' || navigator.globalPrivacyControl===true)return;
    if(typeof window.umami?.track==='function'){try{window.umami.track(name,{topic:eventTopic});}catch{}}
  }
  window.addEventListener('load',()=>{if($('#cayman-analytics')&&navigator.doNotTrack!=='1'&&window.doNotTrack!=='1'&&navigator.globalPrivacyControl!==true&&typeof window.umami?.track==='function'){try{window.umami.track();}catch{}}},{once:true});
  const state = (node, value) => { node.dataset.state = value; node.setAttribute('aria-busy', String(value === 'loading')); node.disabled = value === 'loading'; };
  const safeLink = (value) => { try { const u = new URL(value, location.origin); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  if ('serviceWorker' in navigator && window.isSecureContext) {
    let lastController;
    const saveVisitedPage = () => {
      const controller=navigator.serviceWorker.controller;
      if(!controller || controller===lastController)return;
      lastController=controller;
      const channel=new MessageChannel();
      const timer=setTimeout(()=>channel.port1.close(),10000);
      channel.port1.onmessage=event=>{if(event.data?.saved===true)document.body.dataset.offlineSaved='true';clearTimeout(timer);channel.port1.close();};
      controller.postMessage({type:'SAVE_VISITED_PAGE',url:location.href},[channel.port2]);
    };
    navigator.serviceWorker.addEventListener('controllerchange',saveVisitedPage);
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(saveVisitedPage).catch(() => {  }); }, {once:true});
  }
  $$('.enhancement').forEach(n => n.hidden = false);
  window.addEventListener('load', () => { const strip=$('.topic-strip'), current=strip&&strip.querySelector('[aria-current]'); if(current&&strip.scrollWidth>strip.clientWidth) strip.scrollLeft+=current.getBoundingClientRect().left-strip.getBoundingClientRect().left-(strip.clientWidth-current.offsetWidth)/2; }, {once:true});
  document.addEventListener('focusin', event => {
    const target=event.target;
    if (!(target instanceof HTMLElement) || !target.matches('a,button,input,select,summary')) return;
    requestAnimationFrame(() => { if (document.activeElement===target) target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}); });
  });
  if(document.body.dataset.edition && document.body.dataset.edition < currentDate)output($('.archive-age'),`This is the ${document.body.dataset.edition} edition. Today is ${currentDate} in Cayman. Check the source before acting; the original dates are retained.`);
  document.addEventListener('click', async ev => {
    const button = ev.target.closest('button[data-share],button[data-copy],button[data-print]');
    if (!button) return;
    const status = $('.share-status');
    if (button.hasAttribute('data-print')) { track('print_requested');window.print(); return; }
    const url = safeLink(document.body.dataset.page==='jobs' ? filteredURL() : button.dataset.url || canonical);
    if (!url) { output(status, 'This link is unavailable. Use the page address in your browser.'); state(button,'error'); return; }
    state(button,'loading');
    try {
      if (button.hasAttribute('data-share') && navigator.share) {
        track('share_opened');
        await navigator.share({title:button.dataset.title || document.title, text: $('.deck')?.textContent || '', url});
        output(status, 'Share sheet closed. Delivery is handled by the app you choose.');
      } else if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        track('copy_completed');
        output(status, 'Link copied. Paste it wherever it helps.');
      } else { output(status, `Copy this address: ${url}`); }
      state(button,'success');
    } catch (error) {
      output(status, error.name === 'AbortError' ? 'Share cancelled. The link is still here.' : `Could not copy or share. Copy this address: ${url}`);
      state(button,error.name === 'AbortError' ? 'default' : 'error');
    }
  });
  document.addEventListener('click',ev=>{const a=ev.target.closest('a[href]');if(!a)return;try{const u=new URL(a.href);if(u.pathname==='/calendar.ics'&&u.origin===location.origin)track('calendar_download_started');else if(u.origin!==location.origin&&/^https?:$/.test(u.protocol))track('source_clicked');}catch{}});
  const records = $$('[data-record]');
  const pagedList=$('.records[data-page-size]'), more=$('[data-show-more]');
  const pageSize=Number(pagedList?.dataset.pageSize) || 50;
  let shownLimit=pageSize;
  const area = $('[data-filter="area"]');
  if (area) { try { const stored = localStorage.getItem('cayman-watch-area'); if ([...area.options].some(o=>o.value===stored)) area.value=stored; } catch {} }
  const params=new URLSearchParams(location.search);
  if(document.body.dataset.page==='jobs')for(const key of ['area','query','pay','closing']){const control=$(`[data-filter="${key}"]`),value=params.get(key);if(control&&value!==null&&value.length<=120){if(control.tagName!=='SELECT'||[...control.options].some(o=>o.value===value))control.value=value;}}
  records.forEach(row=>{const value=currentStatus(row),status=$('.current-status',row);if(value==='expired')output(status,'Past the stated end or closing date. Check the source before acting.');else if(value!==row.dataset.status)output(status,`Status now: ${value.replace('-',' ')}. Original source dates are retained.`);else if(status)status.hidden=true;});
  function updateRecords() {
    const district = area?.value || '';
    const query = $('[data-filter="query"]')?.value.trim().toLowerCase() || '';
    const payField = $('[data-filter="pay"]');
    const minimum = payField?.value === '' ? null : Number(payField?.value);
    const closing = $('[data-filter="closing"]')?.value;
    const status = $('[data-filter="status"]')?.value;
    const refine=$('.refine-search');
    if(refine && ((payField?.value || '')!=='' || (closing || '')!=='' || query))refine.open=true;
    let unknownPay=0;
    let matched=0;
    let shown = 0;
    records.forEach(row => {
      const areas = (row.dataset.areas || '').split('|');
      const low = row.dataset.low === '' ? null : Number(row.dataset.low);
      const ends = row.dataset.ends || '';
      const state = currentStatus(row);
      let visible = !district || areas.includes(district) || areas.includes('Cayman Islands') || areas.includes('All Cayman') || areas.includes('All islands') || (areas.includes('Grand Cayman') && !['Cayman Brac','Little Cayman'].includes(district));
      if (query && !(row.dataset.search || '').toLowerCase().includes(query)) visible = false;
      if (payField && payField.value !== '' && (!Number.isFinite(minimum) || minimum < 0 || low === null || low < minimum)) {if(low===null)unknownPay++;visible = false;}
      if (closing === 'open' && state==='expired') visible=false;
      if (status && (status === 'current' ? !['active','upcoming'].includes(state) : state !== status)) visible=false;
      if (visible) matched++;
      const inPage=visible && (!pagedList || matched<=shownLimit);
      row.hidden=!inPage;
      if (inPage) shown++;
    });
    if(more){more.hidden=matched<=shownLimit;more.textContent=`Show ${Math.min(pageSize,Math.max(0,matched-shown))} more`;}
    output($('.filter-status'), (shown ? `${shown}${pagedList?` of ${matched}`:''} ${matched===1?'record':'records'} shown${district?` for ${district}`:''}.` : 'No records match. Try another district or clear a filter.')+(unknownPay?` ${unknownPay} posts have no annual comparison and are excluded by the pay filter.`:''));
    if (payField) { const invalid = payField.value !== '' && (!Number.isFinite(minimum) || minimum<0); payField.setAttribute('aria-invalid',String(invalid)); if (invalid) output($('.filter-status'),'Enter an annual amount of zero or more, or leave pay blank.'); }
    const list=$('.records'); if(list){list.dataset.changing='true';setTimeout(()=>delete list.dataset.changing,160);}
  }
  more?.addEventListener('click',()=>{shownLimit+=pageSize;updateRecords();});
  $$('[data-filter]').forEach(input => input.addEventListener(input.tagName==='INPUT'?'input':'change', () => { shownLimit=pageSize; if(input===area){try{localStorage.setItem('cayman-watch-area',area.value);}catch{}} updateRecords(); }));
  $('[data-jobs-form]')?.addEventListener('submit',ev=>ev.preventDefault());
  $('[data-jobs-form]')?.addEventListener('reset',()=>setTimeout(()=>{shownLimit=pageSize;try{localStorage.removeItem('cayman-watch-area');}catch{} updateRecords();},0));
  if(records.length) updateRecords();
  const fuelForm=$('[data-fuel-form]');
  function calculateFuel(ev) {
    ev?.preventDefault();
    const amount = Number(fuelForm.elements.gallons.value);
    const result=$('.fuel-result');
    if(!Number.isFinite(amount)||amount<1||amount>1000){fuelForm.elements.gallons.setAttribute('aria-invalid','true');output(result,'Enter between 1 and 1,000 imperial gallons.');return;}
    fuelForm.elements.gallons.setAttribute('aria-invalid','false');
    const grade=fuelForm.elements.grade.value, island=fuelForm.elements.island.value, service=fuelForm.elements.service.value, e10=fuelForm.elements.e10.value;
    fuelForm.elements.e10.disabled=grade==='diesel';
    fuelForm.elements.e10.setAttribute('aria-disabled',String(grade==='diesel'));
    output($('.fuel-basis'),`${island} · ${grade} · ${service} · ${grade==='diesel'?'Diesel: gasoline ethanol classification does not apply':e10==='yes'?'E10':'Not marked E10'}.`);
    const measured=[];
    $$('[data-station]').forEach(row=>{
      const matches=row.dataset.island===island&&row.dataset.service===service&&(grade==='diesel'||row.dataset.e10===e10);
      row.hidden=!matches;
      const cell=$(`[data-grade="${grade}"]`,row);
      const price=cell?.dataset.price===''?null:Number(cell?.dataset.price);
      const total=$('.fuel-total',row);
      if(matches&&price!==null&&Number.isFinite(price)){const value=price*amount;measured.push(value);output(total,`CI$ ${value.toFixed(2)}`);}else output(total,'Not measured');
    });
    const range=measured.length ? Math.max(...measured)-Math.min(...measured) : 0;
    if(ev?.isTrusted)track('fuel_comparison');
    output(result,measured.length>1 ? `${amount} imperial gallons: CI$ ${Math.min(...measured).toFixed(2)} to ${Math.max(...measured).toFixed(2)}. Difference CI$ ${range.toFixed(2)} across ${measured.length} matching pumps. Verify price and classification at the pump.` : measured.length===1 ? `One matching pump: CI$ ${measured[0].toFixed(2)}. No comparable price difference is measured.` : 'No measured pumps match this combination. Change the island, service or fuel type.');
  }
  if(fuelForm){fuelForm.addEventListener('submit',calculateFuel);fuelForm.addEventListener('change',calculateFuel);calculateFuel();}
  let search;
  const form=$('[data-search-form]');
  form?.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const query=form.elements.search.value.trim();
    const status=$('.search-status'),list=$('.search-results'),button=$('button',form);
    list.replaceChildren();
    if(!query){output(status,'Enter a word or phrase to search.');return;}
    state(button,'loading');output(status,'Searching the public record…');
    try {
      search ||= await import('/pagefind/pagefind.js');
      const result=await search.search(query);
      for(const entry of result.results.slice(0,20)){
        const data=await entry.data();
        const url=safeLink(data.url);
        if(!url)continue;
        const li=document.createElement('li'),title=document.createElement('p'),a=document.createElement('a');
        title.textContent=data.meta?.title||data.url;
        a.href=url;a.textContent='Read result';li.append(title,a);list.append(li);
      }
      output(status,result.results.length ? `${result.results.length} results; showing ${list.children.length}.` : 'No results. Try another phrase or browse the archive.');state(button,'success');
    } catch {output(status,'Search is unavailable for this capture. Use browser Find or the dated archive.');state(button,'error');}
  });
})();
