const MANIFEST_URL = "./manifest.json";

let VERSION = "dev";

self.addEventListener("install", event => {
	event.waitUntil(
		fetch(MANIFEST_URL)
			.then(res => res.json())
			.then(manifest => {
				VERSION = `v${manifest.version}`;
				const CACHE_NAME = `cipher-ray-${VERSION}`;

				return caches.open(CACHE_NAME).then(cache => {
					return cache.addAll([
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
					]);
				});
			})
	);
});
