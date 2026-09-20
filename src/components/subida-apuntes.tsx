"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { useSesion } from "@/datos/sesion";

/**
 * Subir fotos o PDF de un tema y pasarlos a texto.
 *
 * El texto leído NO se guarda solo: aparece en el editor para que se revise
 * antes de darlo por bueno. Es la regla de la app, y además el sitio donde
 * falla la competencia.
 */

type Estado = "quieto" | "subiendo" | "leyendo" | "hecho" | "error";

type Resultado = {
  nombre: string;
  estado: "leido" | "error";
  error?: string;
  palabras?: number;
};

const TIPOS = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAXIMO_BYTES = 25 * 1024 * 1024;

export function SubidaApuntes({
  temaId,
  numeroTema,
  onTextoLeido,
}: {
  temaId: string;
  numeroTema: number;
  onTextoLeido: (texto: string) => void;
}) {
  const { usuario, cliente } = useSesion();
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("quieto");
  const [progreso, setProgreso] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [gasto, setGasto] = useState<{ mes: number } | null>(null);
  const [error, setError] = useState("");

  const disponible = Boolean(usuario && cliente);

  async function procesar(archivos: FileList) {
    if (!cliente || !usuario) return;
    setError("");
    setResultados([]);
    setEstado("subiendo");

    const lista = Array.from(archivos).slice(0, 20);
    const demasiadoGrandes = lista.filter((a) => a.size > MAXIMO_BYTES);
    if (demasiadoGrandes.length > 0) {
      setEstado("error");
      setError(
        `${demasiadoGrandes.map((a) => a.name).join(", ")} pasa de 25 MB. Haz la foto con menos resolución o parte el PDF.`,
      );
      return;
    }

    const subidos: { id: string; nombre: string }[] = [];

    try {
      for (const [i, archivo] of lista.entries()) {
        setProgreso(`Subiendo ${i + 1} de ${lista.length}: ${archivo.name}`);
        const ruta = `${usuario.id}/${temaId}/${crypto.randomUUID()}-${archivo.name.replace(/[^\w.-]/g, "_")}`;

        const { error: errorSubida } = await cliente.storage
          .from("apuntes")
          .upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream" });
        if (errorSubida) throw new Error(errorSubida.message);

        const { data, error: errorFila } = await cliente
          .from("archivos_tema")
          .insert({
            usuario_id: usuario.id,
            tema_id: temaId,
            ruta,
            nombre: archivo.name,
            tipo_mime: archivo.type || "application/octet-stream",
            bytes: archivo.size,
            orden: i,
          })
          .select("id")
          .single();
        if (errorFila) throw new Error(errorFila.message);

        subidos.push({ id: data.id, nombre: archivo.name });
      }

      setEstado("leyendo");

      // Por tandas de tres: cada petición tiene que caber en el límite de
      // tiempo del servidor, y de paso se ve avanzar el trabajo.
      const POR_TANDA = 3;
      const crudos: { id: string; estado: "leido" | "error"; texto?: string; error?: string }[] = [];
      let gastoFinal = 0;

      for (let i = 0; i < subidos.length; i += POR_TANDA) {
        const tanda = subidos.slice(i, i + POR_TANDA);
        setProgreso(
          `Leyendo ${Math.min(i + tanda.length, subidos.length)} de ${subidos.length}. Cada página tarda unos segundos.`,
        );
        const respuesta = await fetch("/api/leer-apuntes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivoIds: tanda.map((s) => s.id) }),
        });
        const datosTanda = await respuesta.json();
        if (!respuesta.ok) throw new Error(datosTanda.error ?? "No se ha podido leer los apuntes.");
        crudos.push(...datosTanda.resultados);
        gastoFinal = datosTanda.gastoMes ?? gastoFinal;
      }

      const datos = { resultados: crudos, gastoMes: gastoFinal };

      const textos: string[] = [];
      const resumen: Resultado[] = datos.resultados.map(
        (r: { id: string; estado: "leido" | "error"; texto?: string; error?: string }) => {
          const nombre = subidos.find((s) => s.id === r.id)?.nombre ?? "archivo";
          if (r.estado === "leido" && r.texto && r.texto !== "[página sin contenido]") {
            textos.push(r.texto);
            return { nombre, estado: "leido" as const, palabras: contarPalabras(r.texto) };
          }
          if (r.estado === "leido") {
            return { nombre, estado: "leido" as const, palabras: 0 };
          }
          return { nombre, estado: "error" as const, error: r.error };
        },
      );

      setResultados(resumen);
      setGasto({ mes: datos.gastoMes });
      if (textos.length > 0) onTextoLeido(textos.join("\n\n"));
      setEstado("hecho");
      setProgreso("");
    } catch (e: unknown) {
      setEstado("error");
      setProgreso("");
      setError(e instanceof Error ? e.message : "Algo ha fallado al subir los apuntes.");
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  if (!disponible) {
    return (
      <Ficha className="border-dashed px-4 py-4">
        <p className="text-[0.9rem] leading-relaxed text-texto">
          Para subir fotos o PDF hace falta entrar con tu cuenta: los archivos se guardan ahí, no en
          este navegador.{" "}
          <Link href="/entrar" className="regla font-semibold text-tinta">
            Entrar
          </Link>
        </p>
      </Ficha>
    );
  }

  const trabajando = estado === "subiendo" || estado === "leyendo";

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          id={`archivos-${temaId}`}
          accept={TIPOS}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void procesar(e.target.files);
          }}
        />
        <Boton
          tono="secundario"
          onClick={() => entrada.current?.click()}
          disabled={trabajando}
        >
          {trabajando ? "Trabajando…" : "Subir fotos o PDF"}
        </Boton>
        <p className="max-w-[46ch] text-[0.85rem] leading-snug text-apagado">
          Hasta 20 archivos del tema {numeroTema}, de 25 MB cada uno. El texto aparecerá abajo para
          que lo revises antes de guardarlo.
        </p>
      </div>

      <p aria-live="polite" className="text-[0.88rem] text-texto">
        {progreso}
      </p>

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-3 py-2 text-[0.88rem] text-tinta">
          {error}
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[0.88rem]">
          {resultados.map((r) => (
            <li key={r.nombre} className="flex flex-wrap items-baseline gap-2">
              <span className={r.estado === "error" ? "text-margen" : "text-visto"}>
                {r.estado === "error" ? "✕" : "✓"}
              </span>
              <span className="text-texto">{r.nombre}</span>
              {r.estado === "leido" ? (
                <span className="text-apagado">
                  {r.palabras === 0 ? "sin texto legible" : `${r.palabras} palabras`}
                </span>
              ) : (
                <span className="text-margen">{r.error}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {gasto ? (
        <p className="text-[0.82rem] text-apagado" data-numerico>
          Llevas {gasto.mes.toFixed(2)} $ de IA este mes.
        </p>
      ) : null}
    </div>
  );
}

function contarPalabras(texto: string): number {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}
