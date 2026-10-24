// Kill switch for the old n4m cayman service worker: delete its caches, unregister, send open tabs to the new address.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("https://n4mu.com/cayman/");
})()));
