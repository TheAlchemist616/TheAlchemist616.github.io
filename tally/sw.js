// Tally service worker — receives Web Push and shows the "live" notification.
//
// Must be served from the SAME origin as live-tally.html (i.e. sitting next to
// it in the GitHub Pages repo root). It runs even when the Tally tab is closed;
// the browser wakes it only when a push arrives.

// Take over as soon as an updated worker is deployed, so notification changes
// (sound/vibration) apply on the next page load instead of waiting for all tabs
// to close.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const channel = data.channel || "";
  const title = data.title || (channel ? `${channel} is live` : "A channel is live");
  const body  = data.body  || (data.detail ? `up ${data.detail}` : "stream just started");
  const url   = channel ? `https://twitch.tv/${channel}` : "https://twitch.tv";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: channel ? `tally-${channel}` : "tally",
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 300],
      requireInteraction: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "https://twitch.tv";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
