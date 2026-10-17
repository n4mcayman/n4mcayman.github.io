'use strict';

const BUILD = 'dev';
const PREFIX = 'cayman-watch-';
const LIVE = PREFIX + 'live-v1';
const STATIC = PREFIX + 'static-v2-' + BUILD;
const FONTS = PREFIX + 'fonts-v1';
const KEEP = [LIVE, STATIC, FONTS];
const NETWORK_WAIT_MS = 4000;
const SAME_VISIT_WAIT_MS = 12000;
const EXTEND_MAX_MS = 30000;
const NAV_WINDOW_MS = 10000;
const FONT_ENTRIES = 16;
const SOURCE_ENTRIES = 32;

const HERE = new URL('./', self.location.href);
const BASE_PATH = HERE.pathname;
const HOME = HERE.href;
const OWN_PATH = /^(?:[\w.-]+|(?:icons|data|fonts)\/[\w.-]+|og\/(?:launch\/)?[\w.-]+|pagefind\/(?:[\w.-]+\/)*[\w.-]+|(?:briefing|opportunities|fuel|jobs|nearby|free|fine-print|essentials|archive)\/(?:index\.html)?|editions\/index\.json|editions\/\d{4}-\d{2}-\d{2}\/(?:briefing|opportunities|fuel|jobs|nearby|free|fine-print|essentials|archive)\/(?:index\.html)?|editions\/\d{4}-\d{2}-\d{2}\/(?:jobs|planning|items)\/[a-z0-9-]+\/(?:index\.html)?)?$/;
const MEDIA = /\.(?:mp4|m4v|webm|mov|mp3|m4a|aac|ogg|oga|wav)$/i;
const DATA = /\.(?:json|csv|txt|xml|ics|jpe?g)$/i;
const STATIC_FILES = /\.(?:js|mjs|css|png|svg|ico|webp|gif|avif|woff2?|webmanifest|wasm|pf_fragment|pf_index|pf_meta)$/i;

const FALLBACK = [
  'charts.js', 'glance.js', 'notices.js', 'planning-viz.js', 'manifest.webmanifest',
  'runway.js', 'runway.css', 'tokens.css', 'broadcast.css', 'broadcast.js', 'launch.css', 'launch.js', 'launch-live.css', 'launch-live.js',
  'fonts/newsreader-latin.woff2',
  'fonts/geist-latin.woff2',
  'fonts/dela-gothic-one-latin.woff2',
  'fonts/OFL-DelaGothicOne.txt',
  'fonts/OFL-Newsreader.txt',
  'fonts/OFL-Geist.txt',
  'fonts/OFL-GeistMono.txt',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon-180.png'
];

const pageSource = new Map();
let lastNav = { source: null, at: 0 };


self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const live = await caches.open(LIVE);
    let html = '';
    try {
      const res = await fetch(new Request(HOME, { cache: 'no-cache', credentials: 'same-origin' }));
      if (cacheable(res)) html = await keepPage(live, pageKey(HOME), res);
    } catch (e) {  }
    await Promise.all(withFallback(assetsIn(html)).map((href) => saveAsset(href, 'no-cache', false)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith(PREFIX) && !KEEP.includes(n))
      .map((n) => caches.delete(n)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (e) {  }
    }
    await self.clients.claim();
  })());
});


self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SAVE_VISITED_PAGE' || !event.source || !event.source.url) return;
  let url, sender;
  try {
    url = new URL(event.data.url);
    sender = new URL(event.source.url);
  } catch (_) { return; }
  for (const value of [url, sender]) { value.search = ''; value.hash = ''; }
  if (url.href !== sender.href || url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  const rel = url.pathname.slice(BASE_PATH.length);
  if (!OWN_PATH.test(rel) || !(rel === '' || rel.endsWith('/') || /\.html$/i.test(rel)) || MEDIA.test(rel)) return;
  event.waitUntil((async () => {
    try {
      const response = await fetch(new Request(url.href, {cache: 'no-cache', credentials: 'same-origin'}));
      if (!cacheable(response)) return;
      const html = await keepPage(await caches.open(LIVE), pageKey(url.href), response);
      await Promise.all(assetsIn(html).map(href => saveAsset(href, 'no-cache', false)));
      if (event.ports && event.ports[0]) event.ports[0].postMessage({saved: true});
    } catch (_) {  }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  if (req.headers.has('range') || req.destination === 'video' || req.destination === 'audio') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE_PATH)) return;
    const rel = url.pathname.slice(BASE_PATH.length);
    if (!OWN_PATH.test(rel)) return;
    if (MEDIA.test(rel)) return;
    if (url.pathname === self.location.pathname) return;
    if (req.mode === 'navigate') {
      if (rel === '' || rel.endsWith('/') || /\.html$/i.test(rel)) event.respondWith(page(event));
      return;
    }
    if (DATA.test(rel)) { event.respondWith(networkFirst(event)); return; }
    if (STATIC_FILES.test(rel)) { event.respondWith(asset(event)); return; }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fonts(event, url.hostname === 'fonts.googleapis.com'));
  }
});


function page(event) {
  const req = event.request;
  const key = pageKey(req.url);
  let answered = null;
  const network = fetch(req).then((res) => {
    if (cacheable(res)) {
      const copy = res.clone();
      extend(event, caches.open(LIVE)
        .then((live) => keepPage(live, key, copy))
        .then((html) => {
          const late = answered === 'saved';
          return Promise.all(assetsIn(html).map((href) => saveAsset(href, late ? 'no-cache' : 'default', !late)));
        }));
    }
    return res;
  });
  extend(event, network);

  return (async () => {
    const saved = await lastPage(key);
    if (!saved) {
      try {
        const res = await network;
        answered = noteSource(event, 'network');
        return res;
      } catch (e) { return offlinePage(); }
    }
    try {
      const res = await Promise.race([network, wait(NETWORK_WAIT_MS)]);
      if (res && res.status < 500) { answered = noteSource(event, 'network'); return res; }
    } catch (e) {  }
    answered = noteSource(event, 'saved');
    return saved;
  })();
}

function networkFirst(event) {
  const req = event.request;
  const network = fetch(req).then((res) => {
    if (cacheable(res)) extend(event, store(LIVE, req.url, res.clone()));
    return res;
  });
  extend(event, network);

  return (async () => {
    const cache = await caches.open(LIVE);
    const saved = (await cache.match(req, { ignoreVary: true })) ||
                  (await cache.match(req, { ignoreVary: true, ignoreSearch: true }));
    if (!saved) return network;
    try {
      const res = await Promise.race([network, wait(NETWORK_WAIT_MS)]);
      if (res && res.status < 500) return res;
    } catch (e) {  }
    return saved;
  })();
}

function asset(event) {
  const req = event.request;
  const versioned = new URL(req.url).search !== '';
  return (async () => {
    const cache = await caches.open(STATIC);
    const exact = await cache.match(req, { ignoreVary: true });
    if (exact && versioned) return exact;
    const saved = exact || (await cache.match(req, { ignoreVary: true, ignoreSearch: true }));
    const source = sourceFor(event);
    if (saved && source === 'saved') return saved;
    const network = fetch(req).then((res) => {
      if (cacheable(res)) extend(event, putStatic(cache, req.url, res.clone()));
      return res;
    });
    extend(event, network);
    if (!saved) return network;
    try {
      const res = await Promise.race([network, wait(source === 'network' ? SAME_VISIT_WAIT_MS : NETWORK_WAIT_MS)]);
      if (res && res.ok) return res;
    } catch (e) {  }
    return saved;
  })();
}

function fonts(event, isStylesheet) {
  const req = event.request;
  return (async () => {
    const cache = await caches.open(FONTS);
    const hit = await cache.match(req, { ignoreVary: true });
    const fetchAndSave = () => fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        extend(event, cache.put(req, res.clone()).then(() => trim(cache, FONT_ENTRIES)));
      }
      return res;
    });
    if (hit) {
      if (isStylesheet) extend(event, fetchAndSave());
      return hit;
    }
    return fetchAndSave();
  })();
}


function noteSource(event, source) {
  lastNav = { source, at: Date.now() };
  const id = event.resultingClientId;
  if (id) {
    pageSource.delete(id);
    pageSource.set(id, source);
    while (pageSource.size > SOURCE_ENTRIES) pageSource.delete(pageSource.keys().next().value);
  }
  return source;
}

function sourceFor(event) {
  const known = event.clientId && pageSource.get(event.clientId);
  if (known) return known;
  if (lastNav.source && Date.now() - lastNav.at < NAV_WINDOW_MS) return lastNav.source;
  return null;
}


function assetsIn(html) {
  const found = new Set();
  if (!html) return [];
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, '');
  for (const m of html.matchAll(/<(?:script|link|img|video)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/^<link/i.test(tag) &&
        !/\brel\s*=\s*["']?[^"'>]*\b(?:manifest|icon|apple-touch-icon|stylesheet|preload|modulepreload)\b/i.test(tag)) continue;
    for (const a of tag.matchAll(/\s(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      const href = ownAsset(a[1] !== undefined ? a[1] : a[2] !== undefined ? a[2] : a[3]);
      if (href) found.add(href);
    }
  }
  return [...found];
}

function ownAsset(raw) {
  if (!raw) return null;
  let url;
  try { url = new URL(raw.trim().replace(/&amp;/g, '&'), HOME); } catch (e) { return null; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return null;
  if (url.pathname === self.location.pathname) return null;
  const rel = url.pathname.slice(BASE_PATH.length);
  if (!OWN_PATH.test(rel) || MEDIA.test(rel) || !(STATIC_FILES.test(rel) || DATA.test(rel))) return null;
  url.hash = '';
  return url.href;
}

function withFallback(listed) {
  const paths = new Set(listed.map((h) => new URL(h).pathname));
  const extra = FALLBACK.map((p) => new URL(p, HOME).href).filter((h) => !paths.has(new URL(h).pathname));
  return [...listed, ...extra];
}

async function saveAsset(href, mode, onlyMissing) {
  try {
    const rel = new URL(href).pathname.slice(BASE_PATH.length);
    const name = DATA.test(rel) ? LIVE : STATIC;
    const cache = await caches.open(name);
    if (onlyMissing && (await cache.match(href, { ignoreVary: true }))) return;
    const res = await fetch(new Request(href, { cache: mode, credentials: 'same-origin' }));
    if (!cacheable(res)) return;
    if (name === STATIC) await putStatic(cache, href, res);
    else await cache.put(href, await clean(res));
  } catch (e) {  }
}


function extend(event, work) {
  const settled = Promise.race([Promise.resolve(work).catch(() => undefined), wait(EXTEND_MAX_MS)]);
  try { event.waitUntil(settled); } catch (e) {  }
  return settled;
}

function cacheable(res) {
  return !!res && res.status === 200 && res.type === 'basic';
}

async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function store(cacheName, key, res) {
  const cache = await caches.open(cacheName);
  await cache.put(key, await clean(res));
}

async function keepPage(cache, key, res) {
  const copy = res.clone();
  await cache.put(key, await clean(res));
  return copy.text();
}

async function putStatic(cache, href, res) {
  const url = new URL(href);
  await cache.put(href, await clean(res));
  const keys = await cache.keys();
  await Promise.all(keys
    .filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; })
    .map((k) => cache.delete(k)));
}

function pageKey(href) {
  const u = new URL(href);
  u.search = '';
  u.hash = '';
  if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.slice(0, -'index.html'.length);
  return u.href;
}

async function lastPage(key) {
  const cache = await caches.open(LIVE);
  return (await cache.match(key, { ignoreVary: true })) || (await cache.match(HOME, { ignoreVary: true }));
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

function offlinePage() {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="theme-color" content="#0f2622"><title>n4m cayman</title><style>' +
    'body{margin:0;background:#0f2622;color:#efe6d2;font:16px/1.5 "Geist",system-ui,sans-serif}' +
    'main{max-width:36rem;margin:0 auto;padding:48px 16px}' +
    'h1{font-family:"Newsreader",Georgia,serif;font-weight:700;font-size:44px;line-height:1;letter-spacing:-.02em;' +
    'margin:0 0 16px;padding-bottom:14px;border-bottom:1px solid #24443d}' +
    'p{color:#b9c3b6;margin:0 0 12px}a{color:#efe6d2;text-underline-offset:3px}' +
    '</style></head><body><main><h1>n4m cayman</h1>' +
    '<p>This device is offline, and no copy of the page has been saved on it yet.</p>' +
    '<p>Once you are connected, <a href="' + HOME + '">open the page again</a>. After one visit the latest ' +
    'edition stays readable offline.</p></main></body></html>';
  return new Response(html, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
