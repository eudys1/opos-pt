"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { useSesion } from "@/datos/sesion";
import { lanzarTarea, useTarea } from "@/datos/tareas";

/**
 * Crea preguntas de un tema a partir de su texto.
 *
 * Va como tarea en segundo plano (`src/datos/tareas.ts`): puedes irte a otra
 * sección y sigue, con su aviso flotante. Generar más SUMA al banco: lo creado
 * antes no se borra, porque cada pregunta ya costó una llamada a la IA, y la
 * IA recibe la lista de lo que ya hay para no repetirlo. Borrar el banco del
 * tema es una acción aparte, escondida y con confirmación.
 */

const GRUPOS = [
  { grupo: "escritas", texto: "escribiendo tests y preguntas cortas" },
  { grupo: "tarjetas", texto: "escribiendo flashcards y legislación" },
] as const;

const NOMBRE_TIPO: Record<string, string> = {
  test: "de test",
  corta: "cortas",
  flashcard: "flashcards",
  ley: "de legislación",
};

type Resultado = { creadas: number; descartadas: number; porTipo: Record<string, number>; gastoMes: number };

export function GeneradorBanco({
  temaId,
  numero,
  hayTexto,
}: {
  temaId: string;
  numero: number;
  hayTexto: boolean;
}) {
  const { usuario, cliente } = useSesion();
  const idTarea = `banco:${temaId}`;
  const tarea = useTarea(idTarea);
  const trabajando = tarea?.estado === "en_marcha";
  const [existentes, setExistentes] = useState<number | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  // Se vuelve a contar al terminar la tarea, esté esta pantalla abierta o no.
  const terminadaEn = tarea?.estado === "hecha" ? tarea.empezada : 0;
  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    cliente
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("tema_id", temaId)
      .is("variante_de", null)
      .then(({ count }) => {
        if (vivo) setExistentes(count ?? 0);
      });
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, temaId, terminadaEn]);

  if (!usuario || !hayTexto) return null;

  const enlacePracticar = `/practicar?tema=${encodeURIComponent(temaId)}`;

  function generar(reemplazar: boolean) {
    setConfirmarBorrado(false);
    lanzarTarea(
      idTarea,
      {
        titulo: `Creando preguntas del tema ${numero}`,
        enlace: enlacePracticar,
        pasos: GRUPOS.map((g) => g.texto),
      },
      async ({ paso }) => {
        const total: Resultado = { creadas: 0, descartadas: 0, porTipo: {}, gastoMes: 0 };
        for (const [i, { grupo }] of GRUPOS.entries()) {
          paso(i);
          const respuesta = await fetch("/api/generar-banco", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Solo el primer grupo reemplaza, si se pidió: el segundo suma a él.
            body: JSON.stringify({ temaId, grupo, cuantas: 10, reemplazar: reemplazar && i === 0 }),
          });
          const datos = await respuesta.json();
          if (!respuesta.ok) throw new Error(datos.error ?? "No se han podido crear las preguntas.");
          total.creadas += datos.creadas;
          total.descartadas += datos.descartadas;
          total.gastoMes = datos.gastoMes;
          for (const [tipo, n] of Object.entries(datos.porTipo as Record<string, number>)) {
            total.porTipo[tipo] = (total.porTipo[tipo] ?? 0) + n;
          }
        }
        return {
          mensaje: `${total.creadas} preguntas nuevas del tema ${numero}.`,
          resultado: total,
        };
      },
    );
  }

  const yaHabia = (existentes ?? 0) > 0;
  const resultado = tarea?.estado === "hecha" ? (tarea.resultado as Resultado) : null;

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-linea-suave pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton tono="secundario" onClick={() => generar(false)} disabled={trabajando}>
          {trabajando ? "Creando preguntas…" : yaHabia ? "Crear más preguntas" : "Crear preguntas de este tema"}
        </Boton>
        {yaHabia && !trabajando ? (
          <Link href={enlacePracticar} className="regla text-[0.92rem] font-extrabold text-tinta">
            Practicar las {existentes} de este tema →
          </Link>
        ) : null}
      </div>

      {trabajando && tarea ? (
        <BarraProgreso
          pasos={tarea.pasos}
          actual={tarea.paso}
          aviso="Suele tardar entre uno y dos minutos. Puedes ir a otra sección: sigue en segundo plano y te avisa al terminar."
        />
      ) : (
        <p className="max-w-[60ch] text-[0.85rem] leading-snug text-apagado">
          {yaHabia
            ? "Las nuevas se suman a las que ya tienes, sin repetirlas. Nada se borra."
            : "Tests, preguntas cortas, flashcards y una de legislación por cada norma que cites, todas sacadas de este texto."}
        </p>
      )}

      {tarea?.estado === "error" ? (
        <p role="alert" className="rounded-pliegue border-2 border-margen bg-margen-fondo px-3 py-2 text-[0.88rem] font-bold text-margen">
          {tarea.mensaje}
        </p>
      ) : null}

      {resultado ? (
        <div
          aria-live="polite"
          className="flex flex-col gap-1 rounded-[16px] border-2 border-visto-vivo bg-visto-fondo px-4 py-3 text-[0.9rem]"
        >
          <p className="font-extrabold text-visto">
            {resultado.creadas} preguntas nuevas
            {Object.keys(resultado.porTipo).length > 0
              ? `: ${Object.entries(resultado.porTipo)
                  .map(([tipo, n]) => `${n} ${NOMBRE_TIPO[tipo] ?? tipo}`)
                  .join(", ")}`
              : ""}
            .
          </p>
          <p className="text-texto">
            Están en <strong className="font-extrabold">Practicar</strong>, con este tema ya elegido.{" "}
            <Link href={enlacePracticar} className="regla font-extrabold text-tinta">
              Ir a practicarlas →
            </Link>
          </p>
          <p className="text-[0.82rem] text-apagado">
            {resultado.descartadas > 0
              ? `${resultado.descartadas} descartadas por repetidas o por no poder comprobarse contra tus apuntes · `
              : ""}
            llevas {resultado.gastoMes.toFixed(2)} $ de IA este mes
          </p>
        </div>
      ) : null}

      {yaHabia && !trabajando ? (
        <details className="text-[0.82rem]" open={confirmarBorrado}>
          <summary
            className="regla w-fit text-apagado"
            onClick={(e) => {
              e.preventDefault();
              setConfirmarBorrado((v) => !v);
            }}
          >
            ¿Has cambiado mucho los apuntes?
          </summary>
          <div className="mt-2 flex max-w-[60ch] flex-col gap-2 rounded-[16px] border-2 border-linea px-3 py-3">
            <p className="text-texto">
              Puedes borrar las {existentes} preguntas creadas con IA de este tema y escribirlas de nuevo
              desde el texto actual. Las que borres no se recuperan, y volver a crearlas cuesta otra vez.
            </p>
            <div className="flex flex-wrap gap-2">
              <Boton tono="secundario" onClick={() => generar(true)}>
                Borrar y rehacer
              </Boton>
              <Boton tono="fantasma" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
