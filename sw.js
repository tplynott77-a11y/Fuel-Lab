// Network-first for app code; offline diary remains in IndexedDB.
const CACHE='fuel-lab-v05-cloud-blue';
const ASSETS=['./','./index.html','./styles.css','./app.js','./sync.js','./food-core.js','./progress.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 const u=new URL(e.request.url),code=/\.(?:js|css|html)$/.test(u.pathname)||e.request.mode==='navigate'||u.pathname.endsWith('/');
 if(code)e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>caches.match(e.request)));
 else e.respondWith(caches.match(e.request).then(found=>found||fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res})));
});
