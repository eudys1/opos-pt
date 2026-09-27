"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { TarjetaPregunta, type Item, type Veredicto } from "@/components/tarjeta-pregunta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { moverEnLaCola } from "@/datos/cola-fallos";
import { ACIERTOS_PARA_SUPERAR } from "@/nucleo/fallos";
import { cuando, hoyISO } from "@/nucleo/fechas";
import { tituloCorto } from "@/contenido/temario-pt";

/**
 * Repaso de fallos.
 *
 * Se puede repasar siempre, no solo lo que vence hoy, y elegir qué: todo, lo de
 * hoy, un tema o un tipo de pregunta. Y cada fallo vuelve reformulado: se usan
 * variantes guardadas de la pregunta, para que no se conteste de memoria a una
 * frase ya vista. Las variantes se crean una vez por pregunta, al empezar.
 */

type FilaFallo = {
  item_id: string;
  tema_id: string;
  proxima_fecha: string;
  aciertos_seguidos: number;
  veces_fallado: number;
  resuelto_en: string | null;
  items: Item | null;
};

type Alcance = "hoy" | "todos";

const CAMPOS_ITEM =
  "id, tema_id, tipo, enunciado, opciones, correcta, respuesta, explicacion, cita, desde_borrador, pide";

const NOMBRE_TIPO: Record<string, string> = {
  test: "Test",
  corta: "Cortas",
  flashcard: "Flashcards",
  ley: "Legislación",
};

export default function PaginaFallos() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();
  const hoy = hoyISO();

  const [filas, setFilas] = useState<FilaFallo[]>([]);
  const [datosPedidos, setDatosPedidos] = useState(false);
  const [error, setError] = useState("");

  const [alcance, setAlcance] = useState<Alcance>("hoy");
  const [temaFiltro, setTemaFiltro] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");

  const [preparando, setPreparando] = useState<{ hechas: number; total: number } | null>(null);
  const [cola, setCola] = useState<{ fila: FilaFallo; item: Item }[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [superados, setSuperados] = useState(0);

  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const { data, error: e } = await cliente
        .from("fallos")
        .select(
          `item_id, tema_id, proxima_fecha, aciertos_seguidos, veces_fallado, resuelto_en, items(${CAMPOS_ITEM})`,
        )
        .order("proxima_fecha");
      if (!vivo) return;
      if (e) setError(e.message);
      setFilas((data ?? []) as unknown as FilaFallo[]);
      setDatosPedidos(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, version]);

  const abiertos = useMemo(() => filas.filter((f) => !f.resuelto_en && f.items), [filas]);
  const tocanHoy = abiertos.filter((f) => f.proxima_fecha <= hoy);
  const masFallados = [...abiertos].sort((a, b) => b.veces_fallado - a.veces_fallado).slice(0, 6);

  const temasConFallos = useMemo(() => {
    const ids = new Set(abiertos.map((f) => f.tema_id));
    return temas.filter((t) => ids.has(t.id));
  }, [abiertos, temas]);
  const tiposConFallos = useMemo(
    () => [...new Set(abiertos.map((f) => f.items!.tipo))],
    [abiertos],
  );

  const seleccion = useMemo(
    () =>
      (alcance === "hoy" ? tocanHoy : abiertos)
        .filter((f) => !temaFiltro || f.tema_id === temaFiltro)
        .filter((f) => !tipoFiltro || f.items?.tipo === tipoFiltro),
    [alcance, tocanHoy, abiertos, temaFiltro, tipoFiltro],
  );

  const empezar = useCallback(async () => {
    if (!cliente || seleccion.length === 0) return;
    setError("");
    const ids = seleccion.map((f) => f.item_id);

    // 1. Variantes de las que aún no tienen. En tandas, con progreso a la vista.
    //    Si algo falla, se repasa con la pregunta original: no se bloquea nada.
    try {
      setPreparando({ hechas: 0, total: 1 });
      let pendientes = Infinity;
      let vueltas = 0;
      while (pendientes > 0 && vueltas < 6) {
        const r = await fetch("/api/variantes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: ids }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error);
        pendientes = datos.pendientes ?? 0;
        vueltas += 1;
        setPreparando({ hechas: vueltas, total: vueltas + Math.ceil(pendientes / 6) });
      }
    } catch {
      // Sin variantes se repasa igual, con la pregunta de siempre.
    }

    // 2. Para cada fallo, una versión distinta cada vez que vuelve.
    const { data: variantes } = await cliente
      .from("items")
      .select(`${CAMPOS_ITEM}, variante_de`)
      .in("variante_de", ids);
    const porOriginal = new Map<string, Item[]>();
    for (const v of (variantes ?? []) as (Item & { variante_de: string })[]) {
      const lista = porOriginal.get(v.variante_de) ?? [];
      lista.push(v);
      porOriginal.set(v.variante_de, lista);
    }

    const montada = seleccion.map((fila) => {
      const versiones = [fila.items!, ...(porOriginal.get(fila.item_id) ?? [])];
      // Se rota según cuántas veces ha vuelto: nunca la misma dos veces seguidas.
      const turno = fila.veces_fallado + fila.aciertos_seguidos;
      const item = versiones.length > 1 ? versiones[1 + (turno % (versiones.length - 1))] : versiones[0];
      return { fila, item };
    });

    setPreparando(null);
    setCola(montada);
    setIndice(0);
    setSuperados(0);
  }, [cliente, seleccion]);

  const anotar = useCallback(
    async (fila: FilaFallo, veredicto: Veredicto) => {
      if (!cliente || !usuario) return;
      if (veredicto.acierto && fila.aciertos_seguidos + 1 >= ACIERTOS_PARA_SUPERAR) {
        setSuperados((s) => s + 1);
      }
      if (veredicto.feedback) return; // la ruta de corrección ya lo ha movido
      await cliente.from("intentos").insert({
        usuario_id: usuario.id,
        item_id: fila.item_id,
        respuesta: veredicto.respuesta ?? null,
        acierto: veredicto.acierto,
        valoracion: veredicto.valoracion ?? null,
      });
      await moverEnLaCola(cliente, usuario.id, fila.item_id, fila.tema_id, veredicto.acierto);
    },
    [cliente, usuario],
  );

  if (!usuario) return null;
  if (!datosPedidos) return <p className="text-apagado">Mirando qué has fallado…</p>;

  // --- preparando variantes ------------------------------------------------
  if (preparando) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <h1 className="text-[2.1rem]">Preparando el repaso</h1>
        <BarraProgreso
          pasos={Array.from({ length: preparando.total }, () => "reformulando las preguntas")}
          actual={preparando.hechas}
          aviso="Solo la primera vez que repasas cada fallo: después las versiones ya están guardadas."
        />
      </div>
    );
  }

  // --- cola en marcha ------------------------------------------------------
  if (cola) {
    const actual = cola[indice];
    if (!actual) {
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <h1 className="text-[2.1rem]">Repaso terminado</h1>
          <Ficha className="px-6 py-6">
            <p className="text-[0.98rem] leading-relaxed text-texto">
              Has repasado {cola.length} {cola.length === 1 ? "fallo" : "fallos"}.
              {superados > 0
                ? ` ${superados} ${superados === 1 ? "ha salido" : "han salido"} de la cola por ${ACIERTOS_PARA_SUPERAR}.º acierto seguido.`
                : " Los que sigues fallando vuelven en unos días."}
            </p>
          </Ficha>
          <Boton
            onClick={() => {
              setCola(null);
              recargar();
            }}
            className="self-start"
          >
            Volver a mis fallos
          </Boton>
        </div>
      );
    }

    const tema = temas.find((t) => t.id === actual.fila.tema_id);
    const reformulada = actual.item.id !== actual.fila.item_id;

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="flex items-center gap-4">
          <h1 className="flex-1 text-[1.6rem]">Repasando fallos</h1>
          <button
            type="button"
            onClick={() => {
              setCola(null);
              recargar();
            }}
            className="regla text-[0.9rem] text-texto"
          >
            Dejarlo aquí
          </button>
        </div>

        <p className="text-[0.88rem] text-apagado">
          {tema ? `Tema ${tema.numero} · ` : ""}fallado {actual.fila.veces_fallado}{" "}
          {actual.fila.veces_fallado === 1 ? "vez" : "veces"} · {actual.fila.aciertos_seguidos} de{" "}
          {ACIERTOS_PARA_SUPERAR} aciertos seguidos
          {reformulada ? " · te la preguntamos de otra forma" : ""}
        </p>

        <TarjetaPregunta
          key={`${actual.fila.item_id}-${indice}`}
          item={actual.item}
          tema={tema?.numero}
          numero={indice + 1}
          total={cola.length}
          onResuelto={(v) => void anotar(actual.fila, v)}
          onSiguiente={() => setIndice((i) => i + 1)}
        />

        <button
          type="button"
          onClick={() => {
            setCola(null);
            recargar();
          }}
          className="regla self-start text-[0.9rem] text-texto"
        >
          ← Volver a mis fallos
        </button>
      </div>
    );
  }

  // --- portada del apartado -----------------------------------------------
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Repaso de fallos</h1>
        <p className="mt-1 max-w-[65ch] text-[0.98rem] text-texto">
          Lo que fallas vuelve, cada vez más espaciado y preguntado de otra forma, hasta que lo
          aciertas {ACIERTOS_PARA_SUPERAR} veces seguidas.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-[0.92rem] text-margen">
          {error}
        </p>
      ) : null}

      <dl className="grid grid-cols-3 gap-3">
        <Dato titulo="Tocan hoy" valor={tocanHoy.length} alerta={tocanHoy.length > 0} />
        <Dato titulo="Abiertos" valor={abiertos.length} />
        <Dato titulo="Superados" valor={filas.length - filas.filter((f) => !f.resuelto_en).length} />
      </dl>

      {abiertos.length === 0 ? (
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            No tienes ningún fallo pendiente. Aparecerán solos en cuanto falles algo{" "}
            <Link href="/practicar" className="regla font-semibold text-tinta">
              practicando
            </Link>
            .
          </p>
        </Ficha>
      ) : (
        <Ficha className="flex flex-col gap-5 px-6 py-5">
          <h2 className="text-xl">Qué quieres repasar</h2>

          <fieldset>
            <legend className="mb-2 text-[0.9rem] font-semibold text-tinta">Cuáles</legend>
            <div className="flex flex-wrap gap-2">
              <Pildora activa={alcance === "hoy"} onClick={() => setAlcance("hoy")}>
                Los que tocan hoy ({tocanHoy.length})
              </Pildora>
              <Pildora activa={alcance === "todos"} onClick={() => setAlcance("todos")}>
                Todos los abiertos ({abiertos.length})
              </Pildora>
            </div>
            {alcance === "hoy" && tocanHoy.length === 0 ? (
              <p className="mt-2 text-[0.85rem] text-apagado">
                Hoy no vence ninguno; el siguiente vuelve {cuando(abiertos[0].proxima_fecha, hoy)}.
                Puedes repasar todos igualmente.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filtro-tema" className="block text-[0.9rem] font-semibold text-tinta">
                Tema
              </label>
              <select
                id="filtro-tema"
                value={temaFiltro}
                onChange={(e) => setTemaFiltro(e.target.value)}
                className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2.5 text-[0.95rem]"
              >
                <option value="">Todos los temas</option>
                {temasConFallos.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tema {t.numero} · {tituloCorto(t.titulo, 40)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtro-tipo" className="block text-[0.9rem] font-semibold text-tinta">
                Tipo de pregunta
              </label>
              <select
                id="filtro-tipo"
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="mt-1.5 w-full rounded-pliegue border border-linea bg-papel-alto px-3 py-2.5 text-[0.95rem]"
              >
                <option value="">Todos los tipos</option>
                {tiposConFallos.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_TIPO[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-linea-suave pt-4">
            <Boton tamano="grande" onClick={() => void empezar()} disabled={seleccion.length === 0}>
              Repasar {seleccion.length} {seleccion.length === 1 ? "fallo" : "fallos"}
            </Boton>
            {seleccion.length === 0 ? (
              <span className="text-[0.88rem] text-apagado">Ninguno con esos filtros.</span>
            ) : null}
          </div>
        </Ficha>
      )}

      {masFallados.length > 0 ? (
        <section>
          <h2 className="text-xl">Lo que más se te resiste</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {masFallados.map((fila) => {
              const tema = temas.find((t) => t.id === fila.tema_id);
              const ancho = Math.min(100, (fila.veces_fallado / masFallados[0].veces_fallado) * 100);
              return (
                <li key={fila.item_id}>
                  <Ficha className="relative overflow-hidden px-4 py-3">
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 bg-margen-fondo"
                      style={{ width: `${ancho}%` }}
                    />
                    <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {tema ? (
                        <span className="rounded-pliegue bg-papel-alto px-2 py-0.5 text-[0.78rem] font-semibold text-tinta">
                          Tema {tema.numero}
                        </span>
                      ) : null}
                      <span className="flex-1 text-[0.95rem] text-tinta">{fila.items?.enunciado}</span>
                      <span className="text-[0.82rem] font-semibold text-margen" data-numerico>
                        {fila.veces_fallado} {fila.veces_fallado === 1 ? "fallo" : "fallos"}
                      </span>
                    </div>
                  </Ficha>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Pildora({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={clsx(
        "min-h-11 rounded-pliegue border px-4 text-[0.9rem]",
        activa
          ? "border-acento-vivo bg-acento-fondo font-extrabold text-acento"
          : "border-linea bg-papel-alto text-texto hover:border-borde",
      )}
    >
      {children}
    </button>
  );
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <Ficha className={alerta ? "border-margen-hilo px-4 py-3" : "px-4 py-3"}>
      <dt className={alerta ? "text-[0.8rem] text-margen" : "text-[0.8rem] text-apagado"}>{titulo}</dt>
      <dd
        className={clsx("font-display text-[1.7rem] leading-tight", alerta && "text-margen")}
        data-numerico
      >
        {valor}
      </dd>
    </Ficha>
  );
}
