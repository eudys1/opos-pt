"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { leerEstado } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";

/**
 * Descargar todo en un archivo JSON.
 *
 * Es la garantía de que los datos son suyos: apuntes, marcas de estudio,
 * preguntas, fallos, supuestos y simulacros salen en un archivo legible, sin
 * pedir permiso a nadie.
 */
export function ExportarDatos() {
  const { usuario, cliente } = useSesion();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  async function exportar() {
    setTrabajando(true);
    setError("");
    try {
      const datos: Record<string, unknown> = {
        exportado_en: new Date().toISOString(),
        origen: usuario ? "cuenta" : "solo este navegador",
        local: leerEstado(),
      };

      if (cliente && usuario) {
        const tablas = [
          "temas",
          "eventos_estudio",
          "objetivos",
          "items",
          "intentos",
          "fallos",
          "supuestos",
          "respuestas_supuesto",
          "simulacros",
          "simulacro_partes",
          "normas",
          "uso_ia",
        ];
        const nube: Record<string, unknown> = {};
        for (const tabla of tablas) {
          const { data } = await cliente.from(tabla).select("*");
          nube[tabla] = data ?? [];
        }
        datos.nube = nube;
      }

      const enlace = document.createElement("a");
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `cuaderno-${new Date().toISOString().slice(0, 10)}.json`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido exportar los datos.");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Boton tono="secundario" onClick={() => void exportar()} disabled={trabajando}>
        {trabajando ? "Preparando el archivo…" : "Exportar mis datos"}
      </Boton>
      <span className="max-w-[46ch] text-[0.85rem] leading-snug text-apagado">
        Un archivo JSON con tus apuntes, tus marcas, tus preguntas y tus exámenes. Tuyo, sin
        depender de esta app.
      </span>
      {error ? (
        <p role="alert" className="text-[0.88rem] text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}
