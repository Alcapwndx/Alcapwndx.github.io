/* MediIdenta Alpha 0.21 – network-first fuer UI-Dateien.
   Medizinische Entwuerfe/JSON werden NICHT im Service-Worker gespeichert. */
'use strict';
const CACHE='medidenta-pages-v0.22';
const SHELL=['./','./index.html','./app.js','./data-display.js','./rms-codes.js','./review-ui.js','./review-auth.js','./review-auth-config.js','./identifier.js','./theme.js','./app.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('medidenta-')&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event=>{
  const req=event.request, u=new URL(req.url);
  if(req.method!=='GET'||u.origin!==self.location.origin)return;
  if(u.pathname.includes('/api/')||u.pathname.endsWith('catalog_snapshot.json')||
     u.pathname.endsWith('clinical_review_drafts.json')||
     u.pathname.endsWith('sync_status.json'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  const withinScope=u.pathname.startsWith(new URL(self.registration.scope).pathname);
  if(!withinScope)return;
  event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{
    if(response.ok){
      const cloned=response.clone();
      caches.open(CACHE).then(cache=>cache.put(req,cloned)).catch(()=>{});
    }
    return response;
  }).catch(()=>caches.match(req)));
});
