export function setupPWA({ window, navigator, installButton }) {
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  async function configureServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        const scriptURL = new URL('./service-worker.js', window.location.href).href;
        const registrations = await navigator.serviceWorker.getRegistrations();
        let removed = false;
        for (const registration of registrations) {
          const workers = [registration.active, registration.waiting, registration.installing];
          if (workers.some(worker => worker?.scriptURL === scriptURL)) {
            removed = await registration.unregister() || removed;
          }
        }
        // Reload once to release the old controller and obtain current files.
        if (removed && navigator.serviceWorker.controller?.scriptURL === scriptURL) {
          window.location.reload();
        }
      } else {
        await navigator.serviceWorker.register('./service-worker.js');
      }
    } catch {
      // Offline support is optional; registration errors must not affect play.
    }
  }

  window.addEventListener('load', configureServiceWorker);
  return { configureServiceWorker };
}
