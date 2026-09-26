// 离线缓存与更新：页面网络优先（4 秒超时、断网、网站出错或返回的不是本应用时回退缓存），其他资源缓存优先；新版本等待用户点击「刷新」后启用
const VERSION = '6d59f8d4';
const CACHE = 'gaokao-tracker-' + VERSION;
const SHELL = ['./', './index.html'];
const EXTRA = ['./manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png']; // 图标取不到（如镜像地址被重定向）不影响离线使用
// 只缓存真正的应用页面：Wi-Fi 登录页、镜像的「外部内容提示」页等虽然返回 200，也不能覆盖已缓存的应用
const isApp = t => t.indexOf('gaokao-tracker-v1') >= 0;
// 操作手册（./manual/）单独缓存：版本不变就不重新下载；安装时顺带存好，离线也能看
const MCACHE = 'gaokao-manual-14029f04';
const MANUAL = ["./manual/", "./manual/img/cover-a.jpg", "./manual/img/cover-b.jpg", "./manual/img/doc-a2hs-0.jpg", "./manual/img/doc-alloc-0.jpg", "./manual/img/doc-backup-0.jpg", "./manual/img/doc-backup-reminder-0.jpg", "./manual/img/doc-clear-0.jpg", "./manual/img/doc-dark-0.jpg", "./manual/img/doc-dashboard-0.jpg", "./manual/img/doc-dashboard-1.jpg", "./manual/img/doc-diag-form-0.jpg", "./manual/img/doc-diag-form-1.jpg", "./manual/img/doc-diag-form2-0.jpg", "./manual/img/doc-flash-ask-0.jpg", "./manual/img/doc-flashcard-0.jpg", "./manual/img/doc-guide-0.jpg", "./manual/img/doc-help-0.jpg", "./manual/img/doc-list-0.jpg", "./manual/img/doc-list-1.jpg", "./manual/img/doc-list-prio-0.jpg", "./manual/img/doc-plan-0.jpg", "./manual/img/doc-plan-week-0.jpg", "./manual/img/doc-point-0.jpg", "./manual/img/doc-point-1.jpg", "./manual/img/doc-pref-0.jpg", "./manual/img/doc-pref-1.jpg", "./manual/img/doc-recall-0.jpg", "./manual/img/doc-review-due-0.jpg", "./manual/img/doc-review-due-1.jpg", "./manual/img/doc-settings-0.jpg", "./manual/img/doc-settings2-0.jpg", "./manual/img/doc-setup-0.jpg", "./manual/img/doc-snapshots-0.jpg", "./manual/img/doc-stats-0.jpg", "./manual/img/doc-timer-pick-0.jpg", "./manual/img/doc-today-0.jpg", "./manual/img/doc-today-tasks-0.jpg", "./manual/img/doc-weekly-0.jpg", "./manual/img/doc-weekly-form-0.jpg", "./manual/img/doc-weekly-form-1.jpg", "./manual/img/qr.png"];
const isManual = t => t.indexOf('gaokao-manual-v1') >= 0;
function cacheManual() {
  return caches.open(MCACHE).then(c => Promise.all(MANUAL.map(u => c.match(u).then(hit => hit || fetch(new Request(u, { cache: 'reload' })).then(r => {
    if (!r.ok) throw new Error(r.status);
    if (u === './manual/') return r.clone().text().then(t => { if (!isManual(t)) throw new Error('not manual'); return c.put(u, r); });
    return c.put(u, r);
  })).catch(() => {}))));
}
function manualPage(req) {
  return caches.open(MCACHE).then(cache => new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const fromCache = () => cache.match('./manual/');
    const timer = setTimeout(() => fromCache().then(finish), 4000);
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res && res.ok) return res.clone().text().then(t => {
        if (isManual(t)) { cache.put('./manual/', res); clearTimeout(timer); finish(new Response(t, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); return; }
        return fromCache().then(r => { clearTimeout(timer); finish(r || res); });
      });
      return fromCache().then(r => { clearTimeout(timer); finish(r || res); });
    }).catch(() => fromCache().then(r => { clearTimeout(timer); finish(r || Response.error()); }));
  }));
}
function putPage(c, u, res) { return res.clone().text().then(t => { if (!isApp(t)) throw new Error('not app'); return c.put(u, res); }); }
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(r.status); return putPage(c, u, r); })))
    .then(() => Promise.all(EXTRA.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))).then(cacheManual));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.indexOf('gaokao-tracker-') === 0 && k !== CACHE) || (k.indexOf('gaokao-manual-') === 0 && k !== MCACHE)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function pageFromCache(cache) { return cache.match('./index.html').then(r => r || cache.match('./')); }
function networkFirst(req) {
  return caches.open(CACHE).then(cache => new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => pageFromCache(cache).then(finish), 4000);
    const direct = new URL(req.url).searchParams.has('net'); // ?net：直接显示网络返回的页面（如镜像的确认页）
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res && res.ok) {
        return res.clone().text().then(t => {
          if (isApp(t)) { cache.put('./index.html', res); clearTimeout(timer); finish(new Response(t, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); return; }
          if (direct) { clearTimeout(timer); finish(res); return; }
          // 返回的不是应用（登录页 / 提示页）：用缓存的应用，没有缓存才显示它
          return pageFromCache(cache).then(r => { clearTimeout(timer); finish(r || res); });
        });
      }
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
  if (url.pathname.indexOf(scope.pathname + 'manual/') === 0) {
    const mp = url.pathname === scope.pathname + 'manual/' || url.pathname === scope.pathname + 'manual/index.html';
    if (mp || req.mode === 'navigate') { e.respondWith(manualPage(req)); return; }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(MCACHE).then(c => c.put(req, cp)); }
      return res;
    })));
    return;
  }
  const isPage = req.mode === 'navigate' || url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
  if (isPage) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
