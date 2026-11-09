/* Nur App-Shell. Keine API-Antworten oder klinischen Fakten offline cachen. */
const CACHE='medidenta-pages-v0.6.0';
const SHELL=['./','./index.html','./app.js','./identifier.js','./review-ui.js','./app.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/api/')||u.pathname.endsWith('catalog_snapshot.json')||u.pathname.endsWith('clinical_review_drafts.json'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});
