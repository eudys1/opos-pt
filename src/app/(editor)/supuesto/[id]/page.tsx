"use client";

import { use, useState } from "react";
import Link from "next/link";
import { BotonEnlace } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";

/**
 * Un supuesto a pantalla completa, en su propia pestaña, como los temas: para
 * leerlo con calma, tenerlo al lado mientras se escribe en papel o compararlo
 * con otro. Desde aquí se va a practicarlo o a editarlo en el cuaderno.
 */

type Supuesto = {
  id: string;
  usuario_id: string;
  titulo: string;
  enunciado: string;
  solucion: string | null;
  solucion_de_academia: boolean | null;
  necesidad: string | null;
  curso: string | null;
  origen: "propio" | "ia" | "compartido";
};

export default function PaginaSupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { usuario, cliente } = useSesion();
  const [verSolucion, setVerSolucion] = useState(false);

  const { datos: supuesto, listo, error } = useRecordado<Supuesto | null>(
    cliente && usuario ? `supuesto:${usuario.id}:${id}` : null,
    async () => {
      const { data, error: e } = await cliente!
        .from("supuestos")
        .select("id, usuario_id, titulo, enunciado, solucion, solucion_de_academia, necesidad, curso, origen")
        .eq("id", id)
        .maybeSingle();
      if (e) throw new Error(e.message);
      return (data as Supuesto | null) ?? null;
    },
  );

  if (!listo) return <p className="p-8 text-apagado">Abriendo el supuesto…</p>;
  if (!supuesto) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-8">
        <p className="text-texto">
          {error
            ? `No se ha podido abrir el supuesto (${error}). Recarga la página.`
            : "Este supuesto no existe o ya no está en tu cuenta."}
        </p>
        <Link href="/supuestos" className="regla self-start text-tinta">
          ← Todos los supuestos
        </Link>
      </div>
    );
  }

  const esMio = supuesto.usuario_id === usuario?.id;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-linea bg-papel-alto/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/supuestos" className="regla text-[0.9rem] text-texto">
            ← Supuestos
          </Link>
          <p className="min-w-0 flex-1 truncate font-display text-[1.1rem] font-bold text-tinta">
            {supuesto.titulo}
          </p>
          {esMio ? (
            <BotonEnlace href={`/supuestos?editar=${supuesto.id}`} tono="secundario">
              Editar
            </BotonEnlace>
          ) : null}
          <BotonEnlace href={`/supuestos?practicar=${supuesto.id}`}>Practicarlo</BotonEnlace>
        </div>
      </header>

      <main id="contenido" className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta>
            {supuesto.origen === "ia" ? "creado con IA" : esMio ? "mío" : "compartido"}
          </Etiqueta>
          {supuesto.necesidad ? <Etiqueta>{supuesto.necesidad}</Etiqueta> : null}
          {supuesto.curso ? <Etiqueta>{supuesto.curso}</Etiqueta> : null}
        </div>

        <article className="max-w-[72ch] whitespace-pre-line text-[1.06rem] leading-[1.85] text-tinta">
          {supuesto.enunciado}
        </article>

        {supuesto.solucion ? (
          <section className="max-w-[72ch] border-t-2 border-linea pt-5">
            <button
              type="button"
              onClick={() => setVerSolucion((v) => !v)}
              aria-expanded={verSolucion}
              className="regla text-[0.95rem] font-extrabold text-sec-supuesto"
            >
              {verSolucion ? "Ocultar" : "Ver"}{" "}
              {supuesto.solucion_de_academia ? "la resolución de la academia" : "la solución orientativa"}
            </button>
            {verSolucion ? (
              <p className="entra mt-4 whitespace-pre-line text-[1rem] leading-[1.8] text-texto">
                {supuesto.solucion}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
