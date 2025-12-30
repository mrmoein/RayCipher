const VERSION = "v2.0.1";

const CACHE_NAME = `cipher-ray-${VERSION}`;

const APP_STATIC_RESOURCES = [
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
	"./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(APP_STATIC_RESOURCES);
		})
	);
});
