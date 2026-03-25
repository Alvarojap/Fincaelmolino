self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (e) => {
  let d = { title: "Finca El Molino", body: "Nueva notificación" };
  try { if (e.data) d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: "/icon-192.png",
    tag: d.tag || "molino", vibrate: [200, 100, 200],
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then((cs) => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow("/");
  }));
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "NOTIFY") {
    self.registration.showNotification(e.data.title || "Finca El Molino", {
      body: e.data.body || "", tag: e.data.tag || "molino",
      icon: "/icon-192.png", vibrate: [150, 75, 150],
    });
  }
});
