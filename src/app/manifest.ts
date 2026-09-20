import type { MetadataRoute } from "next";

/**
 * Manifiesto para poder instalar la app en el móvil y en el escritorio.
 * El trabajo de funcionar sin conexión (service worker) llega en la fase 5,
 * cuando haya contenido que merezca la pena guardar en el dispositivo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuaderno · oposición de Pedagogía Terapéutica",
    short_name: "Cuaderno",
    description:
      "Registra lo que estudias, repasa cuando toca y haz simulacros con el reloj del examen real.",
    lang: "es",
    start_url: "/registro",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f2e7",
    theme_color: "#f7f2e7",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
