/* =========================================================
   Service Worker（オフライン対応）
   アプリを更新したら、下の CACHE の番号を v1 → v2 と上げること
   ========================================================= */
const CACHE = "hiragana-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (e)=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter((k)=> k!==CACHE).map((k)=> caches.delete(k)));
    await self.clients.claim();
  })());
});

/* 画面本体は「まずネット（3秒だけ待つ）→ ダメならキャッシュ」。
   こうしておくと、アプリを更新したとき古い画面が残らない。 */
async function fromNetworkFirst(req){
  const cached = (await caches.match(req)) || (await caches.match("./index.html"));
  try{
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej)=> setTimeout(()=> rej(new Error("timeout")), 3000))
    ]);
    if(res && res.ok){
      const copy = res.clone();
      caches.open(CACHE).then((c)=> c.put(req, copy));
    }
    return res;
  }catch(err){
    if(cached) return cached;
    throw err;
  }
}

/* アイコンなどは「まずキャッシュ」。速いし通信も使わない。 */
async function fromCacheFirst(req){
  const hit = await caches.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.ok){
    const copy = res.clone();
    caches.open(CACHE).then((c)=> c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  if(new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(req.mode === "navigate" ? fromNetworkFirst(req) : fromCacheFirst(req));
});
