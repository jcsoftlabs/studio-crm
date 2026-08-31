/*
 * Mode dégradé (§5). Le studio a une connexion instable : on garde de quoi
 * consulter l'agenda du jour et les fiches clientes quand le réseau tombe.
 *
 * Rien de ce qui touche à l'argent n'est mis en cache : une facture exige le
 * serveur, le NCF ne peut pas être attribué hors ligne.
 */
const CACHE = 'studio-crm-v1';

const NEVER_CACHE = [/\/caisse/, /\/api\/auth/, /\/rapports\/export/, /\/ticket\//];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Réseau d'abord : hors ligne on sert la dernière version vue, jamais plus vieux.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === 'navigate' || url.pathname.startsWith('/_next/'))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      }),
  );
});
