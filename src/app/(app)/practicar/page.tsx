"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { TarjetaPregunta, type Item, type Veredicto } from "@/components/tarjeta-pregunta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { useRecordado } from "@/datos/cache";
import { moverEnLaCola } from "@/datos/cola-fallos";
import { tituloCorto } from "@/contenido/temario-pt";

type Tipo = "test" | "corta" | "flashcard" | "ley";

const TIPOS: { valor: Tipo; texto: string; ayuda: string }[] = [
  { valor: "test", texto: "Test", ayuda: "cuatro opciones, corrección al momento" },
  { valor: "corta", texto: "Preguntas cortas", ayuda: "escribes y te corrige la IA" },
  { valor: "flashcard", texto: "Flashcards", ayuda: "das la vuelta y te puntúas" },
  { valor: "ley", texto: "Legislación", ayuda: "escribes la cita literal y se coteja con tu tema" },
];

export default function PaginaPracticar() {
  // useSearchParams necesita un límite de Suspense para poder prerenderizar.
  return (
    <Suspense fallback={<p className="text-apagado">Buscando tus preguntas…</p>}>
      <Practicar />
    </Suspense>
  );
}

function Practicar() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();
  // Desde un tema, "Practicar las de este tema" llega con ?tema=<id>.
  const temaDelEnlace = useSearchParams().get("tema");

  const [temasElegidos, setTemasElegidos] = useState<string[]>(() =>
    temaDelEnlace ? [temaDelEnlace] : [],
  );
  const [tiposElegidos, setTiposElegidos] = useState<Tipo[]>(["test", "flashcard", "ley"]);
  const [cuantas, setCuantas] = useState(10);

  const [sesion, setSesion] = useState<Item[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  // Cómo fue cada respuesta de la tanda, en orden: se pinta en el panel.
  const [resultados, setResultados] = useState<("bien" | "mal" | "dudada")[]>([]);
  const [error, setError] = useState("");

  // Cuántas preguntas hay de cada tema y tipo. Recordado entre visitas
  // (src/datos/cache.ts): al volver, las cifras están ya y no saltan.
  const {
    datos: recuentoLeido,
    listo: datosPedidos,
    error: errorCarga,
  } = useRecordado<Record<string, Record<string, number>>>(
    cliente && usuario ? `practicar:${usuario.id}` : null,
    async () => {
      const { data, error: e } = await cliente!
        .from("items")
        .select("tema_id, tipo")
        .eq("activo", true)
        .is("variante_de", null);
      if (e) throw new Error(e.message);
      const mapa: Record<string, Record<string, number>> = {};
      for (const fila of data ?? []) {
        mapa[fila.tema_id] ??= {};
        mapa[fila.tema_id][fila.tipo] = (mapa[fila.tema_id][fila.tipo] ?? 0) + 1;
      }
      return mapa;
    },
  );
  const recuento = useMemo(() => recuentoLeido ?? {}, [recuentoLeido]);

  const temasConBanco = useMemo(
    () => temas.filter((t) => recuento[t.id] && Object.keys(recuento[t.id]).length > 0),
    [temas, recuento],
  );

  const disponibles = useMemo(() => {
    const ids = temasElegidos.length > 0 ? temasElegidos : temasConBanco.map((t) => t.id);
    return ids.reduce((acc, id) => {
      const porTipo = recuento[id] ?? {};
      return acc + tiposElegidos.reduce((s, tipo) => s + (porTipo[tipo] ?? 0), 0);
    }, 0);
  }, [temasElegidos, temasConBanco, recuento, tiposElegidos]);

  const empezar = useCallback(async () => {
    if (!cliente) return;
    setError("");
    const ids = temasElegidos.length > 0 ? temasElegidos : temasConBanco.map((t) => t.id);
    const { data, error: e } = await cliente
      .from("items")
      .select(
        "id, tema_id, tipo, enunciado, opciones, correcta, respuesta, explicacion, cita, desde_borrador, pide",
      )
      .eq("activo", true)
      .is("variante_de", null)
      .in("tema_id", ids)
      .in("tipo", tiposElegidos);

    if (e) {
      setError(e.message);
      return;
    }

    const barajadas = barajar((data ?? []) as Item[]).slice(0, cuantas);
    if (barajadas.length === 0) {
      setError("No hay preguntas con esos filtros.");
      return;
    }
    setSesion(barajadas);
    setIndice(0);
    setAciertos(0);
    setResultados([]);
  }, [cliente, temasElegidos, temasConBanco, tiposElegidos, cuantas]);

  const anotar = useCallback(
    async (item: Item, veredicto: Veredicto) => {
      if (veredicto.acierto) setAciertos((a) => a + 1);
      setResultados((r) => [
        ...r,
        veredicto.acierto ? "bien" : veredicto.valoracion === "dude" ? "dudada" : "mal",
      ]);
      if (!cliente || !usuario) return;
      // Las cortas ya las ha registrado la ruta que las corrige.
      if (veredicto.feedback) return;

      await cliente.from("intentos").insert({
        usuario_id: usuario.id,
        item_id: item.id,
        respuesta: veredicto.respuesta ?? null,
        acierto: veredicto.acierto,
        valoracion: veredicto.valoracion ?? null,
      });
      await moverEnLaCola(cliente, usuario.id, item.id, item.tema_id, veredicto.acierto);
    },
    [cliente, usuario],
  );

  if (!usuario) {
    return (
      <Aviso titulo="Practicar necesita tu cuenta">
        Las preguntas salen de tus apuntes y se guardan en la cuenta, junto con lo que aciertas y lo
        que fallas.{" "}
        <Link href="/entrar" className="regla font-semibold text-tinta">
          Entrar
        </Link>
      </Aviso>
    );
  }

  if (!datosPedidos) return <p className="text-apagado">Buscando tus preguntas…</p>;

  if (temasConBanco.length === 0) {
    return (
      <Aviso titulo="Todavía no hay preguntas">
        Las preguntas se crean desde un tema que ya tenga texto: entra en{" "}
        <Link href="/temario" className="regla font-semibold text-tinta">
          Mi temario
        </Link>
        , abre un tema y pulsa «Crear preguntas».
      </Aviso>
    );
  }

  // --- sesión en marcha -------------------------------------------------
  if (sesion) {
    const item = sesion[indice];
    const terminada = indice >= sesion.length;

    if (terminada) {
      const porcentaje = Math.round((aciertos / sesion.length) * 100);
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <h1 className="text-[2.1rem]">Tanda terminada</h1>
          <Ficha className="px-6 py-6">
            <p className="font-display text-[2.4rem] leading-none" data-numerico>
              {aciertos} de {sesion.length}
            </p>
            <p className="mt-2 text-[0.98rem] text-texto">
              {porcentaje >= 80
                ? "Buen nivel. Lo que has fallado ya está en la cola para volver."
                : porcentaje >= 50
                  ? "Vas por buen camino. Los fallos vuelven en unos días."
                  : "Toca repasar este tema antes de seguir. Los fallos ya están en la cola."}
            </p>
          </Ficha>
          <div className="flex flex-wrap gap-3">
            <Boton onClick={() => setSesion(null)}>Otra tanda</Boton>
            <Link href="/fallos" className="regla self-center text-[0.95rem] text-tinta">
              Ver mis fallos
            </Link>
          </div>
        </div>
      );
    }

    const racha = (() => {
      let n = 0;
      for (let i = resultados.length - 1; i >= 0 && resultados[i] === "bien"; i -= 1) n += 1;
      return n;
    })();
    const cuenta = (r: "bien" | "mal" | "dudada") => resultados.filter((x) => x === r).length;
    const tiposDeLaTanda = [...new Set(sesion.map((i) => i.tipo))];
    const temaDe = (id: string) => temas.find((t) => t.id === id)?.numero;

    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSesion(null)}
            className="min-h-11 rounded-full px-2 text-[0.9rem] font-extrabold text-apagado hover:text-tinta"
          >
            Dejarlo
          </button>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-borde bg-linea-suave">
            <div
              className="h-full bg-visto-vivo transition-[width] duration-300"
              style={{ width: `${(indice / sesion.length) * 100}%` }}
            />
          </div>
          <span className="font-display text-[1.05rem] font-semibold text-tinta" data-numerico>
            {indice + 1} / {sesion.length}
          </span>
          {racha >= 2 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-acento-vivo bg-acento-fondo px-3 py-1 text-[0.8rem] font-extrabold text-acento">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-acento-vivo" />
              {racha} seguidas
            </span>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <TarjetaPregunta
            key={item.id}
            item={item}
            numero={indice + 1}
            total={sesion.length}
            tema={temaDe(item.tema_id)}
            onResuelto={(v) => void anotar(item, v)}
            onSiguiente={() => setIndice((i) => i + 1)}
          />

          <aside aria-label="Esta tanda" className="flex flex-col gap-4">
            <Ficha className="flex flex-col gap-3 px-5 py-4">
              <h2 className="text-[1.05rem]">Esta tanda</h2>
              <ol className="grid grid-cols-5 gap-1.5" aria-hidden="true">
                {sesion.map((_, i) => (
                  <li
                    key={i}
                    className={clsx(
                      "aspect-square rounded-[10px] border-2 border-borde",
                      resultados[i] === "bien"
                        ? "bg-visto-vivo"
                        : resultados[i] === "mal"
                          ? "bg-margen"
                          : resultados[i] === "dudada"
                            ? "bg-aviso-vivo"
                            : i === indice
                              ? "bg-linea ring-2 ring-sec-practica"
                              : "bg-linea-suave",
                    )}
                  />
                ))}
              </ol>
              <dl className="flex gap-4 text-[0.85rem]">
                <div>
                  <dd className="font-display text-[1.3rem] font-bold text-visto" data-numerico>
                    {cuenta("bien")}
                  </dd>
                  <dt className="text-apagado">bien</dt>
                </div>
                <div>
                  <dd className="font-display text-[1.3rem] font-bold text-margen" data-numerico>
                    {cuenta("mal")}
                  </dd>
                  <dt className="text-apagado">mal</dt>
                </div>
                <div>
                  <dd className="font-display text-[1.3rem] font-bold text-aviso" data-numerico>
                    {cuenta("dudada")}
                  </dd>
                  <dt className="text-apagado">dudadas</dt>
                </div>
              </dl>
            </Ficha>

            <Ficha className="flex flex-col gap-2 bg-sec-practica-fondo px-5 py-4">
              <h2 className="text-[1.05rem] text-sec-practica">Modo</h2>
              <ul className="flex flex-wrap gap-1.5">
                {tiposDeLaTanda.map((t) => (
                  <li
                    key={t}
                    className={clsx(
                      "rounded-full px-3 py-1 text-[0.8rem] font-semibold",
                      t === item.tipo
                        ? "bg-sec-practica text-papel-alto"
                        : "bg-papel-alto text-sec-practica",
                    )}
                  >
                    {TIPOS.find((x) => x.valor === t)?.texto ?? t}
                  </li>
                ))}
              </ul>
            </Ficha>

            <Ficha className="flex flex-col gap-1.5 bg-margen-fondo px-5 py-4">
              <h2 className="text-[1.05rem] text-margen">Lo que fallas</h2>
              <p className="text-[0.85rem] leading-relaxed text-margen">
                Va a la cola de fallos y vuelve, preguntado de otra forma. Con tres aciertos
                seguidos, desaparece.
              </p>
            </Ficha>
          </aside>
        </div>
      </div>
    );
  }

  // --- elegir qué practicar ---------------------------------------------
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Practicar</h1>
        <p className="mt-1 text-[0.98rem] text-texto">
          Solo aparecen los temas que ya tienen preguntas creadas a partir de tus apuntes.
        </p>
      </header>

      {error || errorCarga ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error || `No se han podido contar tus preguntas (${errorCarga}). Recarga la página.`}
        </p>
      ) : null}

      <Ficha className="flex flex-col gap-4 px-6 py-5">
        <fieldset>
          <legend className="text-[0.95rem] font-semibold text-tinta">Temas</legend>
          <p className="mb-3 text-[0.85rem] text-apagado">
            Si no marcas ninguno, entran todos los que tienen preguntas.
          </p>
          <div className="flex flex-wrap gap-2">
            {temasConBanco.map((tema) => {
              const elegido = temasElegidos.includes(tema.id);
              const total = Object.values(recuento[tema.id] ?? {}).reduce((a, b) => a + b, 0);
              return (
                <button
                  key={tema.id}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() =>
                    setTemasElegidos((previos) =>
                      previos.includes(tema.id)
                        ? previos.filter((id) => id !== tema.id)
                        : [...previos, tema.id],
                    )
                  }
                  className={clsx(
                    "min-h-11 rounded-pliegue border px-3 py-2 text-left text-[0.88rem]",
                    elegido
                      ? "border-acento-vivo bg-acento-fondo font-extrabold text-acento"
                      : "border-linea bg-papel-alto hover:border-borde",
                  )}
                >
                  <span className="text-tenue" data-numerico>
                    {String(tema.numero).padStart(2, "0")}
                  </span>{" "}
                  {tituloCorto(tema.titulo, 34)}{" "}
                  <span className="text-apagado" data-numerico>
                    ({total})
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[0.95rem] font-semibold text-tinta">Tipo de práctica</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TIPOS.map((tipo) => {
              const activo = tiposElegidos.includes(tipo.valor);
              return (
                <button
                  key={tipo.valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    setTiposElegidos((previos) =>
                      previos.includes(tipo.valor)
                        ? previos.filter((t) => t !== tipo.valor)
                        : [...previos, tipo.valor],
                    )
                  }
                  className={clsx(
                    "flex min-h-14 flex-col items-start justify-center rounded-pliegue border px-4 py-2 text-left transition-colors",
                    activo
                      ? "border-sec-practica bg-sec-practica-fondo"
                      : "border-linea bg-papel-alto hover:border-borde",
                  )}
                >
                  <span className={clsx("text-[0.95rem] font-semibold", activo ? "text-sec-practica" : "text-tinta")}>
                    {tipo.texto}
                  </span>
                  <span className="text-[0.8rem] text-apagado">{tipo.ayuda}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="cuantas" className="block text-[0.95rem] font-semibold text-tinta">
            Cuántas preguntas
          </label>
          <input
            id="cuantas"
            type="number"
            min={3}
            max={50}
            value={cuantas}
            onChange={(e) => setCuantas(Math.min(50, Math.max(3, Number(e.target.value) || 10)))}
            className="mt-1.5 w-24 rounded-pliegue border border-linea bg-papel-alto px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-linea-suave pt-4">
          <Boton onClick={() => void empezar()} tamano="grande" disabled={disponibles === 0}>
            Empezar
          </Boton>
          <span className="text-[0.9rem] text-apagado">
            {disponibles === 0
              ? "No hay preguntas con esos filtros."
              : `${disponibles} preguntas disponibles`}
          </span>
        </div>
      </Ficha>
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-[2.1rem]">{titulo}</h1>
      <Ficha className="px-6 py-5">
        <p className="text-[0.98rem] leading-relaxed text-texto">{children}</p>
      </Ficha>
    </div>
  );
}

/** Baraja sin modificar el original. */
function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
