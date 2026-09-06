'use strict';

// Bump VERSION whenever a deployed HTML, script, stylesheet, table, or icon changes.
// Scope-qualified names prevent one GitHub Pages project from deleting another's cache.
const VERSION = 'pwa-2026-09-06-1';
const BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `roux-block-lab@${BASE.pathname}@`;
const CACHE_NAME = CACHE_PREFIX + VERSION;
const INDEX = new URL('index.html', BASE).href;
const ASSETS = [
  'index.html', 'manifest.json', 'style.css', 'app.mjs', 'cube.mjs',
  'solver.worker.mjs', 'fb-distance.bin.gz', 'fb-distance.bin', 'icon.svg',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-512.png'
].map(path => new URL(path, BASE).href);
const ASSET_URLS = new Set(ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll commits atomically: a failed asset must not activate an incomplete app.
    // Do not cache redirects to authentication pages or missing-asset substitutes.
    await cache.addAll(ASSETS.map(url => new Request(url, {
      cache: 'reload', credentials: 'same-origin', redirect: 'error'
    })));
    // Initial installation activates naturally. Updates wait for the user's action.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'CACHE_STATUS' && event.ports?.[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const responses = await Promise.all(ASSETS.map(url => cache.match(url)));
      event.ports[0].postMessage({type: 'CACHE_STATUS', ready: responses.every(Boolean), version: VERSION});
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  // Only the application's own entry points and explicit assets are intercepted.
  // Other repositories on username.github.io retain their own routing and caches.
  const isEntry = request.mode === 'navigate' && (url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname);
  const key = isEntry ? INDEX : url.origin + url.pathname;
  if (!isEntry && !ASSET_URLS.has(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    if (cached) return cached;
    // Cache-first keeps the HTML and modules on the same installed release.
    // If the OS evicts storage, allow online recovery without caching an error page.
    try {
      const response = await fetch(new Request(key, {credentials: 'same-origin', redirect: 'error'}));
      if (response.ok && !response.redirected) {
        try { await cache.put(key, response.clone()); } catch { /* Storage may be unavailable. */ }
      }
      return response;
    } catch {
      if (!isEntry) return Response.error();
      return new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>接続を確認してください</title><body style="font:16px/1.8 sans-serif;padding:calc(24px + env(safe-area-inset-top,0px)) calc(24px + env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) calc(24px + env(safe-area-inset-left,0px))"><h1>接続を確認してください</h1><p>オフライン用データがありません。一度オンラインで起動し、準備が完了するまでお待ちください。</p><a href="./">もう一度開く</a></body></html>', {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
    }
  })());
});
