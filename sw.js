const CACHE='fuel-lab-v01';
const ASSETS=['./','./index.html','./styles.css','./app.js','./food-core.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(found=>found||fetch(e.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return response})));});
