"use client";

import { useRef, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { useSesion } from "@/datos/sesion";

/**
 * Entregar una parte del examen en papel: se suben las fotos y al entregar se
 * leen y se corrigen. Es la vía recomendada si en el examen vas a escribir a
 * mano, que es lo que pasa de verdad.
 */
export function EntregaEnPapel({
  parteId,
  simulacroId,
  fotos,
  onFotos,
}: {
  parteId: string;
  simulacroId: string;
  fotos: string[];
  onFotos: (rutas: string[]) => void;
}) {
  const { usuario, cliente } = useSesion();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function subir(archivos: FileList) {
    if (!cliente || !usuario) return;
    setSubiendo(true);
    setError("");
    const nuevas: string[] = [];
    try {
      for (const [i, archivo] of Array.from(archivos).slice(0, 20).entries()) {
        const ruta = `${usuario.id}/simulacros/${simulacroId}/${parteId}-${Date.now()}-${i}-${archivo.name.replace(/[^\w.-]/g, "_")}`;
        const { error: e } = await cliente.storage
          .from("apuntes")
          .upload(ruta, archivo, { contentType: archivo.type || "image/jpeg" });
        if (e) throw new Error(e.message);
        nuevas.push(ruta);
      }
      onFotos([...fotos, ...nuevas]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido subir las fotos.");
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        id={`fotos-${parteId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void subir(e.target.files);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Boton tono="secundario" onClick={() => entrada.current?.click()} disabled={subiendo}>
          {subiendo ? "Subiendo…" : fotos.length > 0 ? "Añadir más hojas" : "Subir fotos del papel"}
        </Boton>
        <span className="text-[0.85rem] text-apagado">
          {fotos.length > 0
            ? `${fotos.length} ${fotos.length === 1 ? "hoja subida" : "hojas subidas"}, en el orden en que las subes`
            : "Una foto por hoja, en orden. Se leerán al entregar."}
        </span>
        {fotos.length > 0 ? (
          <button
            type="button"
            onClick={() => onFotos([])}
            className="regla text-[0.85rem] text-texto"
          >
            Quitar todas
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[0.88rem] text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}
