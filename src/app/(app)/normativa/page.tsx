"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { detectarNormas } from "@/nucleo/normas";
import { fechaLarga } from "@/nucleo/fechas";

type Hallazgo = {
  nombre: string;
  estado: "vigente" | "modificada" | "derogada" | "no_encontrada";
  resumen: string;
  enlace: string;
  temas: number[];
};

type NormaGuardada = {
  nombre: string;
  temas: number[];
  estado: string;
  resumen: string | null;
  enlace: string | null;
  comprobada_en: string | null;
};

const ESTADOS: Record<Hallazgo["estado"], { texto: string; tono: "neutra" | "hecha" | "aviso" }> = {
  vigente: { texto: "vigente", tono: "hecha" },
  modificada: { texto: "modificada", tono: "aviso" },
  derogada: { texto: "derogada", tono: "aviso" },
  no_encontrada: { texto: "sin confirmar", tono: "neutra" },
};

export default function PaginaNormativa() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();

  const [guardadas, setGuardadas] = useState<NormaGuardada[]>([]);
  const [hallazgos, setHallazgos] = useState<Hallazgo[] | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  // Detectadas en local: no hace falta la nube para saber qué leyes citas.
  const detectadas = detectarNormas(
    temas.filter((t) => t.texto).map((t) => ({ numero: t.numero, texto: t.texto })),
  );

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const { data } = await cliente
        .from("normas")
        .select("nombre, temas, estado, resumen, enlace, comprobada_en")
        .order("comprobada_en", { ascending: false });
      if (vivo) setGuardadas((data ?? []) as NormaGuardada[]);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, version]);

  async function comprobar() {
    setComprobando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/comprobar-normativa", { method: "POST" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido comprobar.");
      setHallazgos(datos.hallazgos);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido comprobar.");
    } finally {
      setComprobando(false);
    }
  }

  const aMostrar: Hallazgo[] =
    hallazgos ??
    guardadas.map((n) => ({
      nombre: n.nombre,
      estado: (n.estado as Hallazgo["estado"]) ?? "no_encontrada",
      resumen: n.resumen ?? "",
      enlace: n.enlace ?? "",
      temas: n.temas ?? [],
    }));

  const ultimaComprobacion = guardadas.find((n) => n.comprobada_en)?.comprobada_en;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Normativa</h1>
        <p className="mt-1 max-w-[62ch] text-[0.98rem] leading-relaxed text-texto">
          Las leyes que citas en tus temas, y si siguen vigentes. Se comprueba cuando tú lo pides:
          no hay nada mirando el BOE por su cuenta.
        </p>
      </header>

      <Ficha className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex-1">
          <p className="text-[0.95rem] text-tinta">
            <strong className="font-semibold" data-numerico>
              {detectadas.length}
            </strong>{" "}
            normas detectadas en tus temas.
          </p>
          {ultimaComprobacion ? (
            <p className="text-[0.85rem] text-apagado">
              Última comprobación: {fechaLarga(ultimaComprobacion.slice(0, 10))}
            </p>
          ) : (
            <p className="text-[0.85rem] text-apagado">Todavía no has comprobado ninguna.</p>
          )}
        </div>
        {usuario ? (
          <Boton onClick={() => void comprobar()} disabled={comprobando || detectadas.length === 0}>
            {comprobando ? "Buscando en el BOE…" : "Comprobar normativa"}
          </Boton>
        ) : (
          <Link href="/entrar" className="regla text-[0.95rem] font-semibold text-tinta">
            Entrar para comprobar
          </Link>
        )}
      </Ficha>

      {comprobando ? (
        <p aria-live="polite" className="text-[0.92rem] text-texto">
          Buscando cada norma en fuentes oficiales. Suele tardar un par de minutos.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error}
        </p>
      ) : null}

      {aMostrar.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {aMostrar.map((hallazgo) => {
            const estado = ESTADOS[hallazgo.estado] ?? ESTADOS.no_encontrada;
            return (
              <li key={hallazgo.nombre}>
                <Ficha
                  className={clsx(
                    "flex flex-col gap-2 px-5 py-4",
                    (hallazgo.estado === "modificada" || hallazgo.estado === "derogada") &&
                      "border-margen-hilo",
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="flex-1 font-display text-[1.1rem]">{hallazgo.nombre}</h2>
                    <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                  </div>
                  {hallazgo.resumen ? (
                    <p className="text-[0.93rem] leading-relaxed text-texto">{hallazgo.resumen}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-[0.83rem] text-apagado">
                    {hallazgo.temas.length > 0 ? (
                      <span>
                        {hallazgo.temas.length === 1 ? "Tema" : "Temas"} {hallazgo.temas.join(", ")}
                      </span>
                    ) : null}
                    {hallazgo.enlace ? (
                      <a
                        href={hallazgo.enlace}
                        target="_blank"
                        rel="noreferrer"
                        className="regla text-texto"
                      >
                        Ver la norma
                      </a>
                    ) : null}
                  </div>
                </Ficha>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {detectadas.slice(0, 20).map((norma) => (
            <li key={norma.nombre} className="flex flex-wrap items-baseline gap-2 text-[0.93rem]">
              <span className="text-tinta">{norma.nombre}</span>
              <span className="text-apagado">
                · {norma.temas.length === 1 ? "tema" : "temas"} {norma.temas.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[0.85rem] leading-relaxed text-apagado">
        La comprobación consulta fuentes oficiales, pero no sustituye a mirar el BOE: si algo es
        importante para tu tema, confírmalo con el enlace antes de reescribirlo.
      </p>
    </div>
  );
}
