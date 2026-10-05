"use client";

import { useRef, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { useSesion } from "@/datos/sesion";
import { comprimirImagen } from "@/datos/comprimir";
import { MarcaIA } from "@/components/ui/marca-ia";

/**
 * "Leer de una foto o un PDF": sube el archivo a la carpeta privada de la
 * persona, lo pasa a texto y lo devuelve para rellenar un campo, que se puede
 * revisar y corregir antes de guardar. Sirve para no tener que teclear un
 * enunciado o una resolución de academia que ya está en papel.
 */
export function LeerArchivo({
  carpeta,
  onTexto,
  texto = "Leer de una foto o un PDF",
}: {
  /** Subcarpeta dentro de la de la persona: "supuestos", por ejemplo. */
  carpeta: string;
  onTexto: (texto: string) => void;
  texto?: string;
}) {
  const { usuario, cliente } = useSesion();
  const entrada = useRef<HTMLInputElement>(null);
  const [pasos, setPasos] = useState<{ lista: string[]; actual: number } | null>(null);
  const [error, setError] = useState("");

  async function leer(archivos: FileList) {
    if (!cliente || !usuario) return;
    setError("");
    const lista = Array.from(archivos).slice(0, 10);
    const tandas = Math.ceil(lista.length / 2);
    const nombres = ["subiendo", ...Array.from({ length: tandas }, () => "leyendo")];
    setPasos({ lista: nombres, actual: 0 });

    try {
      const rutas: string[] = [];
      for (const [i, original] of lista.entries()) {
        const archivo = await comprimirImagen(original);
        const ruta = `${usuario.id}/${carpeta}/${Date.now()}-${i}-${archivo.name.replace(/[^\w.-]/g, "_")}`;
        const { error: e } = await cliente.storage
          .from("apuntes")
          .upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream" });
        if (e) throw new Error(e.message);
        rutas.push(ruta);
      }

      const trozos: string[] = [];
      for (let i = 0; i < rutas.length; i += 2) {
        setPasos({ lista: nombres, actual: 1 + i / 2 });
        const r = await fetch("/api/transcribir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rutas: rutas.slice(i, i + 2) }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error ?? "No se ha podido leer el archivo.");
        trozos.push(datos.texto);
      }
      onTexto(trozos.join("\n\n").trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido leer el archivo.");
    } finally {
      setPasos(null);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => e.target.files && void leer(e.target.files)}
      />
      {pasos ? (
        <BarraProgreso
          pasos={pasos.lista}
          actual={pasos.actual}
          aviso="Cuando termine, el texto aparece en el campo para que lo revises."
        />
      ) : (
        <Boton
          tono="fantasma"
          className="self-start"
          onClick={() => entrada.current?.click()}
        >
          {texto}
          <MarcaIA />
        </Boton>
      )}
      {error ? (
        <p role="alert" className="text-[0.88rem] text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}
