const CACHE_NAME = 'my-classroom-app-cache-v1'; // 缓存版本号，每次您更新网站文件时，建议更改此号
const urlsToCache = [
  '/', // 应用程序的起始路径，通常指向 index.html
  'index.html', // 主页面文件
  'background.jpg', // 背景图片
  'manifest.json', // PWA 清单文件
  'lbxx1.png', // PWA 图标
  'words/index.json', // 词库列表文件 (位于 words 目录下)
  // 您可以在这里预缓存其他您希望在首次加载时就离线可用的具体词库文件，例如：
  'words/688_第一天.json',
  'words/unit1_happy_holiday.json'
  // 如果词库文件很多或经常更新，可以依赖 fetch 事件的动态缓存
];

// Service Worker 的安装事件
// 在这个事件中，我们将打开一个缓存，并把所有需要预缓存的资源添加到其中
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching core assets...');
        return cache.addAll(urlsToCache); // 添加所有预定义的文件到缓存
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache core assets:', error);
      })
  );
  // 强制新的 Service Worker 立即激活，跳过等待
  self.skipWaiting();
});

// Service Worker 的激活事件
// 在这个事件中，我们将清理旧版本的缓存，确保用户始终使用最新版本的缓存资源
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // 只保留当前版本的缓存

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName); // 删除不在白名单中的旧缓存
          }
        })
      );
    })
  );
  // 确保 Service Worker 立即控制所有客户端（页面）
  event.waitUntil(self.clients.claim());
  console.log('Service Worker: Activated and controlling clients.');
});

// Service Worker 的 fetch 事件
// 每当浏览器请求资源时，这个事件就会被触发。Service Worker 会拦截请求并决定如何响应
self.addEventListener('fetch', event => {
  // 对于 POST 请求或其他非 GET 请求，或跨域请求，通常不缓存，直接走网络
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request) // 尝试从缓存中查找请求的资源
      .then(cachedResponse => {
        // 如果缓存中找到了资源，则直接返回缓存的响应
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // 如果缓存中没有找到，则尝试从网络获取
        return fetch(event.request).then(networkResponse => {
          // 检查网络响应是否有效（例如，状态码为 200，且是基本请求类型）
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            console.log('Service Worker: Network request failed or invalid response for:', event.request.url);
            return networkResponse;
          }

          // 克隆网络响应。因为响应流只能被读取一次，我们需要克隆一份来存储到缓存中
          const responseToCache = networkResponse.clone();

          // 将新的网络响应添加到缓存中
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
            console.log('Service Worker: Caching new response:', event.request.url);
          });

          return networkResponse; // 返回原始的网络响应给浏览器
        }).catch(error => {
          // 如果网络请求失败（例如，用户离线），且缓存中也没有该资源
          console.error('Service Worker: Fetch failed and no cache for:', event.request.url, error);
          // 在这里可以返回一个离线页面，例如：
          // if (event.request.mode === 'navigate') {
          //   return caches.match('/offline.html');
          // }
          // 否则，返回一个空响应或拒绝，让浏览器处理
          return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
        });
      })
  );
});