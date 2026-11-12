// Service worker for the installed HEURIAL tracker (scope /admin). It only shows notifications.
// It caches nothing: the tracker's data is private and always comes fresh from the server after sign-in.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "HEURIAL tracker";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Something new in the tracker.",
    tag: data.tag || undefined,
    icon: "/admin/icons/icon-192.png",
    badge: "/admin/icons/icon-192.png",
    data: { url: typeof data.url === "string" && data.url.startsWith("/admin") ? data.url : "/admin" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).pathname.startsWith("/admin")) {
        await w.focus();
        w.postMessage({ type: "open", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
