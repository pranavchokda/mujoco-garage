/* coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT
 * https://github.com/gzuidhof/coi-serviceworker
 * Injects Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers
 * so that SharedArrayBuffer and WASM threads work on GitHub Pages.
 */

if (typeof window === 'undefined') {
  // Service worker scope
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  async function handleFetch(request) {
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
      return;
    }
    const response = await fetch(request);
    if (response.status === 0) {
      return response;
    }
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  self.addEventListener('fetch', (event) => {
    event.respondWith(handleFetch(event.request));
  });
} else {
  // Main thread: register the service worker
  (async function() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register(
        window.document.currentScript.src
      );

      // If there's a waiting worker (new version installed), activate it
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Reload the page if the service worker is new and not yet controlling the page
      if (!navigator.serviceWorker.controller) {
        // Page was loaded before service worker was active — reload to get headers
        window.location.reload();
        return;
      }

      // If an update is found, reload once the new service worker takes over
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    }
  })();
}
