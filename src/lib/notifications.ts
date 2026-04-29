export async function showRadiusNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch {
      // Fall through to the browser constructor for environments that allow it.
    }
  }

  try {
    new Notification(title, options);
  } catch {
    // Some mobile/PWA contexts disallow the Notification constructor.
  }
}
