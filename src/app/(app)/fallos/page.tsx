"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { TarjetaPregunta, type Item, type Veredicto } from "@/components/tarjeta-pregunta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";
import { moverEnLaCola } from "@/datos/cola-fallos";
import { ACIERTOS_PARA_SUPERAR } from "@/nucleo/fallos";
import { cuando, fechaCorta, hoyISO } from "@/nucleo/fechas";
import type { Tema } from "@/nucleo/tipos";
import { tituloCorto } from "@/contenido/temario-pt";
import { CampoTexto, Selector } from "@/components/ui/campos";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";

/**
 * Fallos, en dos pestañas: Repasar (preparar la sesión de ahora) y el Banco
 * (todo lo fallado, abierto o superado, organizado para consultarlo).
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
type Pestana = "repasar" | "banco";

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


  const [alcance, setAlcance] = useState<Alcance>("hoy");
  const [pestanaElegida, setPestana] = useState<Pestana | null>(null);
  const [temaFiltro, setTemaFiltro] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");

  const [preparando, setPreparando] = useState<{ hechas: number; total: number } | null>(null);
  const [cola, setCola] = useState<{ fila: FilaFallo; item: Item }[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [superados, setSuperados] = useState(0);

  // Recordado entre visitas (src/datos/cache.ts): al volver se ve al momento y
  // se pone al día por detrás. Tras repasar, `recargar` lo vuelve a pedir.
  const {
    datos: filasLeidas,
    listo: datosPedidos,
    error,
    recargar,
  } = useRecordado<FilaFallo[]>(cliente && usuario ? `fallos:${usuario.id}` : null, async () => {
    const { data, error: e } = await cliente!
      .from("fallos")
      .select(
        `item_id, tema_id, proxima_fecha, aciertos_seguidos, veces_fallado, resuelto_en, items(${CAMPOS_ITEM})`,
      )
      .order("proxima_fecha");
    if (e) throw new Error(e.message);
    return (data ?? []) as unknown as FilaFallo[];
  });
  const filas = useMemo(() => filasLeidas ?? [], [filasLeidas]);

  const abiertos = useMemo(() => filas.filter((f) => !f.resuelto_en && f.items), [filas]);
  const tocanHoy = abiertos.filter((f) => f.proxima_fecha <= hoy);
  const masFallados = [...abiertos].sort((a, b) => b.veces_fallado - a.veces_fallado).slice(0, 6);
  const superadosTodos = useMemo(() => filas.filter((f) => f.resuelto_en && f.items), [filas]);
  const lote = alcance === "hoy" ? tocanHoy : abiertos;

  // En el filtro salen todos los temas subidos, no solo los que tienen fallos:
  // si uno no aparecía, parecía que la app no lo conocía. Cada uno dice cuántos
  // fallos tiene en lo que se está mirando (hoy o todos los abiertos).
  const temasDelFiltro = useMemo(() => {
    const base = lote;
    const cuantos = new Map<string, number>();
    for (const f of base) cuantos.set(f.tema_id, (cuantos.get(f.tema_id) ?? 0) + 1);
    const conFallosAbiertos = new Set(abiertos.map((f) => f.tema_id));
    return temas
      .filter((t) => t.estadoContenido !== "sin_contenido" || conFallosAbiertos.has(t.id))
      .map((t) => ({ tema: t, fallos: cuantos.get(t.id) ?? 0 }));
  }, [lote, abiertos, temas]);
  const temaElegido = temasDelFiltro.find((t) => t.tema.id === temaFiltro);
  const tiposConFallos = useMemo(
    () => [...new Set(abiertos.map((f) => f.items!.tipo))],
    [abiertos],
  );

  const seleccion = useMemo(
    () =>
      lote
        .filter((f) => !temaFiltro || f.tema_id === temaFiltro)
        .filter((f) => !tipoFiltro || f.items?.tipo === tipoFiltro),
    [lote, temaFiltro, tipoFiltro],
  );

  /** Monta la sesión con la lista que se le dé: la elegida en Repasar o la vista en el banco. */
  const empezar = useCallback(async (seleccion: FilaFallo[]) => {
    if (!cliente || seleccion.length === 0) return;
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
  }, [cliente]);

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

  const pestana: Pestana = pestanaElegida ?? (abiertos.length === 0 && filas.length > 0 ? "banco" : "repasar");

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
        <h1 className="text-[2.1rem]">Fallos</h1>
        <p className="mt-1 max-w-[65ch] text-[0.98rem] text-texto">
          Lo que fallas vuelve, cada vez más espaciado y preguntado de otra forma, hasta que lo
          aciertas {ACIERTOS_PARA_SUPERAR} veces seguidas. Entonces pasa a superado, y se queda
          guardado en tu banco.
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
        <Dato titulo="Superados" valor={superadosTodos.length} />
      </dl>

      {filas.length === 0 ? (
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            Todavía no has fallado nada. Lo que falles{" "}
            <Link href="/practicar" className="regla font-semibold text-tinta">
              practicando
            </Link>{" "}
            aparecerá aquí solo.
          </p>
        </Ficha>
      ) : (
        <Tabs selectedKey={pestana} onSelectionChange={(k) => setPestana(k as Pestana)}>
          <TabList aria-label="Fallos" className="flex gap-2 border-b-2 border-linea">
            {(
              [
                ["repasar", "Repasar", tocanHoy.length ? `${tocanHoy.length} hoy` : null],
                ["banco", "Banco de fallos", `${filas.length}`],
              ] as const
            ).map(([id, texto, cifra]) => (
              <Tab
                key={id}
                id={id}
                className="-mb-[2px] flex min-h-11 cursor-pointer items-center gap-2 rounded-t-[12px] border-2 border-b-0 border-transparent px-4 text-[0.95rem] font-extrabold text-apagado outline-none hover:text-tinta data-[selected]:border-linea data-[selected]:bg-papel-alto data-[selected]:text-tinta data-[focus-visible]:ring-2 data-[focus-visible]:ring-acento"
              >
                {texto}
                {cifra ? (
                  <span className="rounded-full bg-sec-fallos-fondo px-2 py-0.5 text-[0.75rem] text-sec-fallos" data-numerico>
                    {cifra}
                  </span>
                ) : null}
              </Tab>
            ))}
          </TabList>

          {/* ---------------- Repasar: preparar la sesión de ahora ---------------- */}
          <TabPanel id="repasar" className="flex flex-col gap-6 pt-5 outline-none">
            {abiertos.length === 0 ? (
              <Ficha className="px-6 py-5">
                <p className="text-[0.98rem] leading-relaxed text-texto">
                  No tienes ningún fallo abierto: todos están superados. Si quieres volver sobre
                  ellos, en el{" "}
                  <button type="button" onClick={() => setPestana("banco")} className="regla font-semibold text-tinta">
                    banco de fallos
                  </button>{" "}
                  puedes repasarlos.
                </p>
              </Ficha>
            ) : (
              <Ficha className="flex flex-col gap-5 px-6 py-5">
                <h2 className="text-xl">Qué quieres repasar ahora</h2>

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
                    <Selector
                      etiqueta="Tema"
                      valor={temaFiltro || "todos"}
                      onCambio={(v) => setTemaFiltro(v === "todos" ? "" : v)}
                      opciones={[
                        { valor: "todos", texto: "Todos los temas" },
                        ...temasDelFiltro.map(({ tema: t, fallos }) => ({
                          valor: t.id,
                          texto: `Tema ${t.numero} · ${fallos === 0 ? "sin fallos" : fallos === 1 ? "1 fallo" : `${fallos} fallos`}`,
                          detalle: tituloCorto(t.titulo, 60),
                        })),
                      ]}
                    />
                    {temaElegido && temaElegido.fallos === 0 ? (
                      <p className="mt-1.5 text-[0.84rem] leading-snug text-apagado">
                        El tema {temaElegido.tema.numero} no tiene fallos{" "}
                        {alcance === "hoy" ? "que toquen hoy" : "abiertos"}: o lo que has respondido de él
                        está bien, o aún no has practicado con él.{" "}
                        <Link href={`/practicar?tema=${temaElegido.tema.id}`} className="regla font-bold text-tinta">
                          Practicar ese tema
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <Selector
                    etiqueta="Tipo de pregunta"
                    valor={tipoFiltro || "todos"}
                    onCambio={(v) => setTipoFiltro(v === "todos" ? "" : v)}
                    opciones={[
                      { valor: "todos", texto: "Todos los tipos" },
                      ...tiposConFallos.map((t) => ({ valor: t, texto: NOMBRE_TIPO[t] ?? t })),
                    ]}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-linea-suave pt-4">
                  <Boton tamano="grande" onClick={() => void empezar(seleccion)} disabled={seleccion.length === 0}>
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
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl">Lo que más se te resiste</h2>
                  <button type="button" onClick={() => setPestana("banco")} className="regla text-[0.88rem] font-bold text-tinta">
                    Ver todos en el banco →
                  </button>
                </div>
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
          </TabPanel>

          {/* ---------------- Banco: todos, organizados ---------------- */}
          <TabPanel id="banco" className="pt-5 outline-none">
            <BancoFallos filas={filas.filter((f) => f.items)} temas={temas} hoy={hoy} onRepasar={(l) => void empezar(l)} />
          </TabPanel>
        </Tabs>
      )}
    </div>
  );
}

type Orden = "tema" | "fallados" | "recientes";
type Estado = "todos" | "abiertos" | "superados";

/**
 * El banco de fallos: todo lo que has fallado alguna vez, abierto o superado,
 * para consultarlo como un archivo. Se filtra por estado, tipo y texto, se
 * ordena, y por tema se agrupa en bloques plegables. Lo que se ve, se puede
 * repasar de una vez.
 */
function BancoFallos({
  filas,
  temas,
  hoy,
  onRepasar,
}: {
  filas: FilaFallo[];
  temas: Tema[];
  hoy: string;
  onRepasar: (lista: FilaFallo[]) => void;
}) {
  const [estado, setEstado] = useState<Estado>("todos");
  const [tipo, setTipo] = useState("");
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<Orden>("tema");

  const numeroDe = (temaId: string) => temas.find((t) => t.id === temaId)?.numero ?? 99;
  const aguja = buscar.trim().toLowerCase();
  const tipos = [...new Set(filas.map((f) => f.items!.tipo))];
  const abiertosN = filas.filter((f) => !f.resuelto_en).length;

  const vistos = filas
    .filter((f) => (estado === "abiertos" ? !f.resuelto_en : estado === "superados" ? Boolean(f.resuelto_en) : true))
    .filter((f) => !tipo || f.items!.tipo === tipo)
    .filter((f) => !aguja || (f.items!.enunciado + " " + (f.items!.respuesta ?? "")).toLowerCase().includes(aguja))
    .sort((a, b) =>
      orden === "fallados"
        ? b.veces_fallado - a.veces_fallado
        : orden === "recientes"
          ? (b.resuelto_en ?? b.proxima_fecha).localeCompare(a.resuelto_en ?? a.proxima_fecha)
          : numeroDe(a.tema_id) - numeroDe(b.tema_id) || Number(Boolean(a.resuelto_en)) - Number(Boolean(b.resuelto_en)),
    );

  // Por tema: un bloque plegable por tema, con sus cifras en la cabecera.
  const grupos = new Map<string, FilaFallo[]>();
  for (const f of vistos) grupos.set(f.tema_id, [...(grupos.get(f.tema_id) ?? []), f]);

  return (
    <div className="flex flex-col gap-5">
      <Ficha className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">
          <Pildora activa={estado === "todos"} onClick={() => setEstado("todos")}>
            Todos ({filas.length})
          </Pildora>
          <Pildora activa={estado === "abiertos"} onClick={() => setEstado("abiertos")}>
            Abiertos ({abiertosN})
          </Pildora>
          <Pildora activa={estado === "superados"} onClick={() => setEstado("superados")}>
            Superados ({filas.length - abiertosN})
          </Pildora>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoTexto etiqueta="Buscar" tipo="search" valor={buscar} onCambio={setBuscar} placeholder="Una palabra de la pregunta…" />
          <Selector
            etiqueta="Tipo"
            valor={tipo || "todos"}
            onCambio={(v) => setTipo(v === "todos" ? "" : v)}
            opciones={[{ valor: "todos", texto: "Todos los tipos" }, ...tipos.map((t) => ({ valor: t, texto: NOMBRE_TIPO[t] ?? t }))]}
          />
          <Selector
            etiqueta="Ordenar"
            valor={orden}
            onCambio={(v) => setOrden(v as Orden)}
            opciones={[
              { valor: "tema", texto: "Por tema" },
              { valor: "fallados", texto: "Los más fallados primero" },
              { valor: "recientes", texto: "Los más recientes primero" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-linea-suave pt-3">
          <Boton onClick={() => onRepasar(vistos)} disabled={vistos.length === 0}>
            Repasar estos {vistos.length}
          </Boton>
          <span className="max-w-[52ch] text-[0.84rem] leading-snug text-apagado">
            {vistos.length === 0
              ? "Nada con esos filtros."
              : "Si vuelves a fallar uno superado, vuelve a la cola; si lo aciertas, sigue superado."}
          </span>
        </div>
      </Ficha>

      {orden === "tema" ? (
        <div className="flex flex-col gap-2">
          {[...grupos.entries()].map(([temaId, lista]) => {
            const tema = temas.find((t) => t.id === temaId);
            const abiertos = lista.filter((f) => !f.resuelto_en).length;
            return (
              <details key={temaId} open={grupos.size <= 2 || Boolean(aguja)} className="acordeon group rounded-[14px] border-2 border-linea bg-papel-alto open:border-sec-fallos-vivo">
                <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                  <span className="font-display text-[1.05rem] font-semibold">
                    {tema ? `Tema ${tema.numero}` : "Sin tema"}
                  </span>
                  {tema ? <span className="min-w-0 flex-1 truncate text-[0.85rem] text-apagado">{tituloCorto(tema.titulo, 60)}</span> : <span className="flex-1" />}
                  <span className="text-[0.8rem] font-bold text-sec-fallos" data-numerico>
                    {abiertos} {abiertos === 1 ? "abierto" : "abiertos"}
                  </span>
                  <span className="text-[0.8rem] font-bold text-visto" data-numerico>
                    {lista.length - abiertos} {lista.length - abiertos === 1 ? "superado" : "superados"}
                  </span>
                  <span aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <ul className="flex flex-col gap-2 border-t-2 border-linea-suave px-3 pb-3 pt-3">
                  {lista.map((f) => (
                    <FichaFallo key={f.item_id} fila={f} hoy={hoy} />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {vistos.map((f) => (
            <FichaFallo key={f.item_id} fila={f} hoy={hoy} tema={temas.find((t) => t.id === f.tema_id)?.numero} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Un fallo del banco: en qué punto está, la pregunta y, al desplegar, la respuesta. */
function FichaFallo({ fila, hoy, tema }: { fila: FilaFallo; hoy: string; tema?: number }) {
  const item = fila.items!;
  const superado = Boolean(fila.resuelto_en);
  const respuesta =
    item.tipo === "test" && item.opciones && item.correcta !== null
      ? item.opciones[item.correcta]
      : item.respuesta;
  return (
    <li className={clsx("rounded-[12px] border-l-[4px] bg-papel px-3 py-2.5", superado ? "border-visto-vivo" : "border-sec-fallos-vivo")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] font-bold">
        {superado ? (
          <span className="rounded-full bg-visto-fondo px-2 py-0.5 text-visto">
            ✔ superado el {fechaCorta((fila.resuelto_en ?? "").slice(0, 10))}
          </span>
        ) : (
          <span className="rounded-full bg-sec-fallos-fondo px-2 py-0.5 text-sec-fallos" data-numerico>
            {fila.proxima_fecha <= hoy ? "toca hoy" : `vuelve ${cuando(fila.proxima_fecha, hoy)}`} ·{" "}
            {fila.aciertos_seguidos} de {ACIERTOS_PARA_SUPERAR} aciertos
          </span>
        )}
        {tema ? <span className="text-apagado">Tema {tema}</span> : null}
        <span className="text-apagado">{NOMBRE_TIPO[item.tipo] ?? item.tipo}</span>
        <span className="ml-auto text-apagado" data-numerico>
          falló {fila.veces_fallado} {fila.veces_fallado === 1 ? "vez" : "veces"}
        </span>
      </div>
      <p className="mt-1.5 text-[0.95rem] leading-snug text-tinta">{item.enunciado}</p>
      {respuesta || item.explicacion ? (
        <details className="acordeon mt-1.5">
          <summary className="regla w-fit cursor-pointer list-none text-[0.84rem] font-bold text-texto">Ver la respuesta</summary>
          <div className="mt-1.5 flex flex-col gap-1 text-[0.9rem] leading-relaxed text-texto">
            {respuesta ? <p className="font-semibold text-tinta">{respuesta}</p> : null}
            {item.explicacion ? <p>{item.explicacion}</p> : null}
            {item.cita ? <p className="text-[0.84rem] text-apagado">Tus apuntes: «{item.cita}»</p> : null}
          </div>
        </details>
      ) : null}
    </li>
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
