/*
  Service worker de Cuaderno.

  Lo justo para que la app abra sin conexión y no se quede en blanco en el metro:
  - Los archivos estáticos se sirven de la caché y se refrescan por detrás.
  - Las páginas van primero a la red; si no hay, se sirve la última vista.
  - Nada de cachear la API, la sesión ni Supabase: los datos siempre frescos.
*/

const VERSION = "cuaderno-v1";
const ESTATICOS = `${VERSION}-estaticos`;
const PAGINAS = `${VERSION}-paginas`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(ESTATICOS).then((cache) => cache.addAll(["/", "/registro", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((clave) => !clave.startsWith(VERSION)).map((clave) => caches.delete(clave))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Páginas: red primero, y la última copia guardada si no hay conexión.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(PAGINAS).then((cache) => cache.put(peticion, copia));
          return respuesta;
        })
        .catch(() => caches.match(peticion).then((guardada) => guardada ?? caches.match("/registro"))),
    );
    return;
  }

  // Estáticos de Next: caché primero, actualizando por detrás.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon")) {
    evento.respondWith(
      caches.match(peticion).then((guardada) => {
        const red = fetch(peticion)
          .then((respuesta) => {
            const copia = respuesta.clone();
            caches.open(ESTATICOS).then((cache) => cache.put(peticion, copia));
            return respuesta;
          })
          .catch(() => guardada);
        return guardada ?? red;
      }),
    );
  }
});
