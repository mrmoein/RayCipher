const VERSION = "2.0.9";
const CACHE_NAME = `cipher-ray-${VERSION}`;

self.addEventListener("install", event => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache =>
			cache.addAll([
				"./",
				"./index.html",
				"./style.css",
				"./script.js",
				"./manifest.json",
				"./sw.js",
				"./assets/favicon.ico",
				"./assets/Vazirmatn-Bold.woff2",
				"./assets/Vazirmatn-Regular.woff2",
				"./assets/icon-180.png",
				"./assets/icon-192.png",
				"./assets/icon-512.png",
				"./assets/github.svg"
			])
		)
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(
				keys
					.filter(k => k !== CACHE_NAME)
					.map(k => caches.delete(k))
			)
		)
	);
});

self.addEventListener("message", event => {
	if (event.data === "GET_VERSION") {
		event.source.postMessage({ version: VERSION });
	}
});
