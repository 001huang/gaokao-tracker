// 离线缓存与更新：页面网络优先（4 秒超时、断网或网站出错时回退缓存），其他资源缓存优先；新版本等待用户点击「刷新」后启用
const VERSION = '6a559825';
const CACHE = 'gaokao-tracker-' + VERSION;
const SHELL = ['./', './index.html'];
const EXTRA = ['./manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png']; // 图标取不到（如镜像地址被重定向）不影响离线使用
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))
    .then(() => Promise.all(EXTRA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('gaokao-tracker-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function pageFromCache(cache) { return cache.match('./index.html').then(r => r || cache.match('./')); }
function networkFirst(req) {
  return caches.open(CACHE).then(cache => new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => pageFromCache(cache).then(finish), 4000);
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res && res.ok) { cache.put('./index.html', res.clone()); clearTimeout(timer); finish(res); return; }
      // 网站返回 404/5xx（如网址失效、服务故障）时用缓存的页面，保证从主屏幕图标仍能打开
      pageFromCache(cache).then(r => { clearTimeout(timer); finish(r || res); });
    }).catch(() => pageFromCache(cache).then(r => { clearTimeout(timer); finish(r || Response.error()); }));
  }));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  const isPage = req.mode === 'navigate' || url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
  if (isPage) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
