"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { useSesion } from "@/datos/sesion";

/**
 * Crea (o rehace) el banco de preguntas de un tema.
 *
 * Rehacerlo borra las preguntas generadas antes para ese tema: si los apuntes
 * han cambiado, las viejas ya no se corresponden con nada. Se avisa antes.
 */
export function GeneradorBanco({
  temaId,
  hayTexto,
}: {
  temaId: string;
  hayTexto: boolean;
}) {
  const { usuario, cliente } = useSesion();
  const [existentes, setExistentes] = useState<number | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [paso, setPaso] = useState("");
  const [resultado, setResultado] = useState<{
    creadas: number;
    descartadas: number;
    porTipo: Record<string, number>;
    gastoMes: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    cliente
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("tema_id", temaId)
      .then(({ count }) => {
        if (vivo) setExistentes(count ?? 0);
      });
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, temaId, resultado]);

  if (!usuario || !hayTexto) return null;

  // Dos llamadas cortas en vez de una larga: así cada una cabe de sobra en el
  // límite de tiempo del servidor y se puede ir contando lo que lleva hecho.
  const GRUPOS = [
    { grupo: "escritas", texto: "tests y preguntas cortas" },
    { grupo: "tarjetas", texto: "flashcards y legislación" },
  ] as const;

  async function generar() {
    setTrabajando(true);
    setError("");
    setResultado(null);
    try {
      const total = { creadas: 0, descartadas: 0, porTipo: {} as Record<string, number>, gastoMes: 0 };

      for (const { grupo, texto } of GRUPOS) {
        setPaso(`Escribiendo ${texto}…`);
        const respuesta = await fetch("/api/generar-banco", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temaId, grupo, cuantas: 10 }),
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

      setResultado(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido crear las preguntas.");
    } finally {
      setPaso("");
      setTrabajando(false);
    }
  }

  const yaHabia = (existentes ?? 0) > 0;

  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-linea-suave pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton tono="secundario" onClick={() => void generar()} disabled={trabajando}>
          {trabajando
            ? "Creando preguntas…"
            : yaHabia
              ? "Rehacer las preguntas"
              : "Crear preguntas de este tema"}
        </Boton>
        <span className="max-w-[44ch] text-[0.85rem] leading-snug text-apagado" aria-live="polite">
          {trabajando
            ? paso || "Tarda un par de minutos en total."
            : yaHabia
              ? `Este tema tiene ${existentes} preguntas. Rehacerlas borra las anteriores y las escribe otra vez desde el texto de arriba.`
              : "Tests, preguntas cortas, flashcards y una por cada ley citada, todas sacadas de este texto."}
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-3 py-2 text-[0.88rem]">
          {error}
        </p>
      ) : null}

      {resultado ? (
        <div aria-live="polite" className="text-[0.88rem] text-texto">
          <p className="text-visto">
            {resultado.creadas} preguntas creadas
            {resultado.descartadas > 0
              ? ` · ${resultado.descartadas} descartadas por no poder comprobarse contra tus apuntes`
              : ""}
            .
          </p>
          <p className="text-apagado">
            {Object.entries(resultado.porTipo)
              .map(([tipo, n]) => `${n} de ${tipo}`)
              .join(" · ")}{" "}
            · llevas {resultado.gastoMes.toFixed(2)} $ de IA este mes
          </p>
        </div>
      ) : null}
    </div>
  );
}
