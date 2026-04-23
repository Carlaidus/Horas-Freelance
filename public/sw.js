// Service worker mínimo requerido para instalación PWA.
// No cachea nada — la app siempre usa datos en tiempo real.
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));
