"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Cronometro, type ModoReloj } from "@/components/cronometro";
import { CorreccionDetallada } from "@/components/correccion-detallada";
import { EntregaEnPapel } from "@/components/entrega-en-papel";
import { useSesion } from "@/datos/sesion";
import { CRITERIOS_TEMA } from "@/ia/corregir-tema";
import type { CorreccionSupuesto } from "@/ia/supuestos";

/**
 * La sala de examen.
 *
 * Primero se eligen las bolas, después se escribe. El reloj no avisa de nada y
 * el borrador se guarda solo en este navegador cada pocos segundos, para que un
 * cierre accidental no se lleve cuatro horas de trabajo.
 */

type Opcion = { id: string; titulo: string; numero?: number };

type Parte = {
  id: string;
  tipo: "tema" | "supuesto";
  opciones: Opcion[];
  elegido_id: string | null;
  elegido_titulo: string | null;
  texto: string;
  transcripcion: string | null;
  correccion: CorreccionSupuesto | null;
  nota: number | null;
};

type Simulacro = {
  id: string;
  modalidad: "tema" | "supuesto" | "completo";
  iniciado_en: string;
  duracion_s: number;
  estado: "en_curso" | "entregado" | "corregido" | "abandonado";
  trampa: boolean;
  nota: number | null;
};

export default function SalaDeExamen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { usuario, cliente } = useSesion();

  const [simulacro, setSimulacro] = useState<Simulacro | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [version, setVersion] = useState(0);
  const [pedido, setPedido] = useState(false);
  const [modo, setModo] = useState<ModoReloj>("restante");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [entregando, setEntregando] = useState(false);
  // Cada parte se entrega escrita aquí o con fotos del papel.
  const [modoEntrega, setModoEntrega] = useState<Record<string, "pantalla" | "papel">>({});
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [supuestosEnunciados, setEnunciados] = useState<Record<string, { enunciado: string; cuestiones: string[]; rubrica: { criterio: string; peso: number }[] }>>({});

  const claveBorrador = `cuaderno:simulacro:${id}`;
  const guardado = useRef<number>(0);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const [{ data: sim }, { data: filas }] = await Promise.all([
        cliente.from("simulacros").select("*").eq("id", id).maybeSingle(),
        cliente.from("simulacro_partes").select("*").eq("simulacro_id", id).order("tipo"),
      ]);
      if (!vivo) return;
      setSimulacro(sim as Simulacro | null);
      const listaPartes = (filas ?? []) as Parte[];
      setPartes(listaPartes);

      // Enunciados de los supuestos que han salido en el sorteo.
      const idsSupuestos = listaPartes
        .filter((p) => p.tipo === "supuesto")
        .flatMap((p) => p.opciones.map((o) => o.id));
      if (idsSupuestos.length > 0) {
        const { data: sups } = await cliente
          .from("supuestos")
          .select("id, enunciado, cuestiones, rubrica")
          .in("id", idsSupuestos);
        if (!vivo) return;
        setEnunciados(
          Object.fromEntries(
            (sups ?? []).map((s) => [
              s.id,
              {
                enunciado: s.enunciado,
                cuestiones: (s.cuestiones ?? []) as string[],
                rubrica: (s.rubrica ?? []) as { criterio: string; peso: number }[],
              },
            ]),
          ),
        );
      }

      // Borrador guardado en el navegador, por si se cerró la página.
      try {
        const local = window.localStorage.getItem(claveBorrador);
        if (local) setTextos(JSON.parse(local));
      } catch {
        // Sin borrador local: se sigue con lo que haya en la cuenta.
      }
      setPedido(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, id, version, claveBorrador]);

  function escribir(parteId: string, texto: string) {
    setTextos((previos) => {
      const siguiente = { ...previos, [parteId]: texto };
      const ahora = Date.now();
      if (ahora - guardado.current > 3000) {
        guardado.current = ahora;
        try {
          window.localStorage.setItem(claveBorrador, JSON.stringify(siguiente));
        } catch {
          // El borrador local es un extra: si falla, se sigue escribiendo.
        }
      }
      return siguiente;
    });
  }

  async function elegir(parte: Parte, opcion: Opcion) {
    if (!cliente) return;
    await cliente
      .from("simulacro_partes")
      .update({ elegido_id: opcion.id, elegido_titulo: opcion.titulo })
      .eq("id", parte.id);
    setVersion((v) => v + 1);
  }

  async function entregar() {
    setEntregando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/simulacro/entregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulacroId: id,
          partes: partes
            .filter((p) => p.elegido_id)
            .map((p) => ({
              parteId: p.id,
              texto: textos[p.id] ?? "",
              fotos: modoEntrega[p.id] === "papel" ? (fotos[p.id] ?? []) : [],
            })),
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido entregar.");
      try {
        window.localStorage.removeItem(claveBorrador);
      } catch {
        // Da igual: el examen ya está entregado y corregido en la cuenta.
      }
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido entregar.");
    } finally {
      setEntregando(false);
    }
  }

  if (!usuario) {
    return (
      <p className="text-[0.98rem]">
        Entra con tu cuenta para hacer simulacros.{" "}
        <Link href="/entrar" className="regla font-semibold text-tinta">
          Entrar
        </Link>
      </p>
    );
  }

  if (!pedido) return <p className="text-apagado">Abriendo el examen…</p>;
  if (!simulacro) return <p className="text-apagado">Ese simulacro no existe.</p>;

  // --- corregido: se enseña la corrección --------------------------------
  if (simulacro.estado === "corregido") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <header className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <h1 className="text-[2.1rem]">Simulacro corregido</h1>
            <p className="mt-1 text-[0.95rem] text-texto">
              {simulacro.modalidad === "completo"
                ? "Examen completo"
                : simulacro.modalidad === "tema"
                  ? "Solo tema"
                  : "Solo supuesto"}
              {simulacro.trampa ? " · sorteo cargado hacia tus temas flojos" : ""}
            </p>
          </div>
          {simulacro.nota !== null ? (
            <p className="font-display text-[2.6rem] leading-none" data-numerico>
              {simulacro.nota.toFixed(1)}
              <span className="text-[1.1rem] text-apagado"> / 10</span>
            </p>
          ) : null}
        </header>

        {partes.map((parte) => (
          <section key={parte.id} className="flex flex-col gap-4">
            <h2 className="text-xl">
              {parte.tipo === "tema" ? "Parte de tema" : "Parte práctica"}
              <span className="ml-2 font-sans text-[0.95rem] font-normal text-apagado">
                {parte.elegido_titulo}
              </span>
            </h2>
            {parte.correccion ? (
              <CorreccionDetallada
                correccion={parte.correccion}
                rubrica={
                  parte.tipo === "tema"
                    ? CRITERIOS_TEMA
                    : supuestosEnunciados[parte.elegido_id ?? ""]?.rubrica ?? []
                }
              />
            ) : (
              <p className="text-[0.95rem] text-apagado">Esta parte no se entregó.</p>
            )}
            {parte.transcripcion ? (
              <details className="text-[0.9rem]">
                <summary className="regla cursor-pointer text-texto">
                  Ver lo que se leyó de tus fotos
                </summary>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-apagado">
                  {parte.transcripcion}
                </p>
              </details>
            ) : null}
          </section>
        ))}

        <Link href="/simulacros" className="regla self-start text-[0.95rem] text-tinta">
          Volver a simulacros
        </Link>
      </div>
    );
  }

  // --- examen en marcha --------------------------------------------------
  const sinElegir = partes.filter((p) => !p.elegido_id);
  const listasParaEntregar = partes.filter(
    (p) =>
      p.elegido_id &&
      (modoEntrega[p.id] === "papel"
        ? (fotos[p.id] ?? []).length > 0
        : (textos[p.id] ?? "").trim().length > 100),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-linea pb-5">
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-margen">
            Examen en marcha
          </p>
          <h1 className="mt-1 text-[1.8rem]">
            {simulacro.modalidad === "completo"
              ? "Examen completo"
              : simulacro.modalidad === "tema"
                ? "Solo tema"
                : "Solo supuesto"}
          </h1>
          {simulacro.modalidad === "completo" ? (
            <p className="mt-1 max-w-[52ch] text-[0.9rem] text-apagado">
              Las dos partes van seguidas y el tiempo lo repartes tú, igual que en Andalucía.
            </p>
          ) : null}
        </div>

        <Cronometro
          iniciadoEn={simulacro.iniciado_en}
          duracionSegundos={simulacro.duracion_s}
          modo={modo}
          onCambiarModo={setModo}
        />
      </div>

      {sinElegir.length > 0 ? (
        <div className="flex flex-col gap-6">
          <p className="text-[0.98rem] text-texto">
            Han salido estas bolas. Elige una de cada parte: no se puede cambiar después.
          </p>
          {sinElegir.map((parte) => (
            <section key={parte.id} className="flex flex-col gap-3">
              <h2 className="text-xl">
                {parte.tipo === "tema" ? "Elige tema" : "Elige supuesto"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {parte.opciones.map((opcion) => (
                  <Ficha key={opcion.id} className="flex flex-col gap-3 px-5 py-4">
                    {parte.tipo === "tema" ? (
                      <>
                        <span className="font-display text-[1.6rem] leading-none" data-numerico>
                          {opcion.numero}
                        </span>
                        <p className="text-[0.95rem] leading-relaxed text-tinta">{opcion.titulo}</p>
                      </>
                    ) : (
                      <p className="line-clamp-6 text-[0.93rem] leading-relaxed text-tinta">
                        {supuestosEnunciados[opcion.id]?.enunciado ?? opcion.titulo}
                      </p>
                    )}
                    <Boton className="mt-auto" onClick={() => void elegir(parte, opcion)}>
                      Desarrollar este
                    </Boton>
                  </Ficha>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {partes
        .filter((p) => p.elegido_id)
        .map((parte) => {
          const supuesto = parte.tipo === "supuesto" ? supuestosEnunciados[parte.elegido_id!] : null;
          const texto = textos[parte.id] ?? "";
          return (
            <section key={parte.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl">
                  {parte.tipo === "tema" ? "Tema elegido" : "Supuesto elegido"}
                </h2>
                <Etiqueta>{parte.elegido_titulo}</Etiqueta>
              </div>

              {supuesto ? (
                <Ficha className="flex flex-col gap-3 px-5 py-4">
                  <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-tinta">
                    {supuesto.enunciado}
                  </p>
                  <ol className="flex flex-col gap-1.5 border-t border-linea-suave pt-3">
                    {supuesto.cuestiones.map((cuestion, i) => (
                      <li key={cuestion} className="flex gap-2 text-[0.93rem] text-texto">
                        <span className="font-semibold text-margen">{i + 1}.</span>
                        {cuestion}
                      </li>
                    ))}
                  </ol>
                </Ficha>
              ) : null}

              <fieldset className="flex flex-wrap items-center gap-4">
                <legend className="sr-only">Cómo entregas esta parte</legend>
                {(["pantalla", "papel"] as const).map((valor) => (
                  <label
                    key={valor}
                    htmlFor={`modo-${parte.id}-${valor}`}
                    className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.92rem]"
                  >
                    <input
                      type="radio"
                      id={`modo-${parte.id}-${valor}`}
                      name={`modo-${parte.id}`}
                      checked={(modoEntrega[parte.id] ?? "pantalla") === valor}
                      onChange={() => setModoEntrega((m) => ({ ...m, [parte.id]: valor }))}
                      className="h-4 w-4 accent-[color:var(--color-tinta)]"
                    />
                    {valor === "pantalla" ? "Lo escribo aquí" : "Lo escribo en papel y subo fotos"}
                  </label>
                ))}
              </fieldset>

              {(modoEntrega[parte.id] ?? "pantalla") === "papel" ? (
                <EntregaEnPapel
                  parteId={parte.id}
                  simulacroId={id}
                  fotos={fotos[parte.id] ?? []}
                  onFotos={(rutas) => setFotos((f) => ({ ...f, [parte.id]: rutas }))}
                />
              ) : (
                <>
                  <label htmlFor={`texto-${parte.id}`} className="sr-only">
                    Desarrollo de {parte.elegido_titulo}
                  </label>
                  <textarea
                    id={`texto-${parte.id}`}
                    value={texto}
                    onChange={(e) => escribir(parte.id, e.target.value)}
                    rows={20}
                    spellCheck={false}
                    className="w-full rounded-pliegue border border-linea bg-papel-alto px-5 py-4 text-[1rem] leading-[1.8] text-tinta"
                  />
                  <p className="text-[0.85rem] text-apagado" data-numerico>
                    {texto.trim() ? texto.trim().split(/\s+/).length : 0} palabras · se guarda solo
                    en este navegador mientras escribes
                  </p>
                </>
              )}
            </section>
          );
        })}

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error}
        </p>
      ) : null}

      {partes.every((p) => p.elegido_id) ? (
        <div className={clsx("flex flex-wrap items-center gap-4 border-t border-linea pt-5")}>
          <Boton
            tamano="grande"
            onClick={() => void entregar()}
            disabled={entregando || listasParaEntregar.length === 0}
          >
            {entregando ? "Corrigiendo… puede tardar un par de minutos" : "Entregar y corregir"}
          </Boton>
          <p className="max-w-[46ch] text-[0.88rem] leading-snug text-apagado">
            Se acepta la entrega aunque se haya pasado el tiempo, pero queda registrado cuánto has
            tardado de verdad.
          </p>
        </div>
      ) : null}
    </div>
  );
}
