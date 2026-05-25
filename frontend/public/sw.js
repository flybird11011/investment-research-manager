/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'invest-research-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// 安装：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先，离线回退缓存
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API 请求不缓存
  if (request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 成功获取后缓存
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败时回退缓存
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果是导航请求，返回 index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('离线不可用', { status: 503 });
        });
      })
  );
});
