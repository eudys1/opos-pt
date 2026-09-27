"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { fechaCorta } from "@/nucleo/fechas";
import { hechosEnLaRonda, probabilidadDeDominado } from "@/nucleo/sorteo";

type Modalidad = "tema" | "supuesto" | "completo";
type Reloj = "real" | "flexible";

type Simulacro = {
  id: string;
  modalidad: Modalidad;
  estado: "en_curso" | "entregado" | "corregido" | "abandonado";
  trampa: boolean;
  nota: number | null;
  creado_en: string;
  iniciado_en: string;
  duracion_s: number;
  reloj?: Reloj;
  pausas?: number;
};

const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  tema: "Solo tema",
  supuesto: "Solo supuesto",
  completo: "Examen completo",
};

const RELOJES: { valor: Reloj; titulo: string; texto: string }[] = [
  {
    valor: "real",
    titulo: "Simulacro real",
    texto:
      "Como el día del examen. El reloj no se para nunca: si cierras la página o se apaga el móvil, sigue contando. Sin pausas.",
  },
  {
    valor: "flexible",
    titulo: "Simulacro flexible",
    texto:
      "El reloj también arranca al entrar, pero puedes pausarlo cuando lo necesites. Las pausas quedan apuntadas y en el historial sale como «flexible», para que sus notas no se mezclen con las de los reales.",
  },
];

function duracion(minutos: number): string {
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
}

export default function PaginaSimulacros() {
  const router = useRouter();
  const { temas, perfil } = useCuaderno();
  const { usuario, cliente } = useSesion();

  const [historial, setHistorial] = useState<Simulacro[]>([]);
  const [elegidos, setElegidos] = useState<{ simulacro_id: string; tipo: string; elegido_id: string }[]>([]);
  const [supuestosDisponibles, setSupuestos] = useState<string[]>([]);
  const [dominados, setDominados] = useState(0);
  const [pedidos, setPedidos] = useState(false);

  const [reloj, setReloj] = useState<Reloj>("real");
  const [trampa, setTrampa] = useState(false);
  const [aConfirmar, setAConfirmar] = useState<Modalidad | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar");
  const minimo = perfil.examen.minimoTemasParaSimulacro;

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const [{ data: sims }, { data: sups }, { data: dominio }, { data: partes }] =
        await Promise.all([
          cliente
            .from("simulacros")
            .select("*")
            .order("creado_en", { ascending: false })
            .limit(60),
          cliente.from("supuestos").select("id"),
          cliente.from("dominio_por_tema").select("tema_id, dominio, intentos"),
          cliente
            .from("simulacro_partes")
            .select("simulacro_id, tipo, elegido_id")
            .not("elegido_id", "is", null),
        ]);
      if (!vivo) return;
      setHistorial((sims ?? []) as Simulacro[]);
      setSupuestos((sups ?? []).map((s) => s.id as string));
      setElegidos((partes ?? []) as { simulacro_id: string; tipo: string; elegido_id: string }[]);
      setDominados(
        (dominio ?? []).filter((d) => Number(d.dominio ?? 0) >= 0.8 && Number(d.intentos) >= 5)
          .length,
      );
      setPedidos(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario]);

  // La ronda: qué temas y supuestos quedan por hacer antes de que vuelvan todos.
  const ronda = useMemo(() => {
    const validos = new Map(
      historial.filter((s) => s.estado !== "abandonado").map((s) => [s.id, s.iniciado_en]),
    );
    const orden = (tipo: string) =>
      elegidos
        .filter((e) => e.tipo === tipo && validos.has(e.simulacro_id))
        .sort((a, b) => validos.get(a.simulacro_id)!.localeCompare(validos.get(b.simulacro_id)!))
        .map((e) => e.elegido_id);
    const idsTemas = estudiados.map((t) => t.id);
    const hechosTema = hechosEnLaRonda(orden("tema"), idsTemas);
    const hechosSupuesto = hechosEnLaRonda(orden("supuesto"), supuestosDisponibles);
    return {
      temasHechos: estudiados.filter((t) => hechosTema.has(t.id)).map((t) => t.numero).sort((a, b) => a - b),
      temasQuedan: idsTemas.length - hechosTema.size,
      temasTotal: idsTemas.length,
      supuestosQuedan: supuestosDisponibles.length - hechosSupuesto.size,
      supuestosTotal: supuestosDisponibles.length,
    };
  }, [historial, elegidos, estudiados, supuestosDisponibles]);

  async function empezar(modalidad: Modalidad) {
    setCreando(true);
    setError("");
    try {
      const respuesta = await fetch("/api/simulacro/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalidad, trampa, reloj }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido empezar el simulacro.");
      router.push(`/simulacros/${datos.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido empezar el simulacro.");
      setCreando(false);
    }
  }

  if (!usuario) return null;

  const enCurso = historial.find((s) => s.estado === "en_curso");
  const probabilidad = probabilidadDeDominado(
    estudiados.length,
    dominados,
    perfil.examen.temasSorteados,
  );

  const modalidades: {
    valor: Modalidad;
    que: string;
    minutos: number;
    listo: boolean;
    falta: string;
  }[] = [
    {
      valor: "tema",
      que: `${perfil.examen.temasSorteados} temas al azar, eliges 1`,
      minutos: perfil.examen.minutosSoloTema,
      listo: estudiados.length >= 2,
      falta: "Marca al menos dos temas como estudiados en el registro.",
    },
    {
      valor: "supuesto",
      que: `${perfil.examen.supuestosSorteados} supuestos variados, eliges 1`,
      minutos: perfil.examen.minutosSoloSupuesto,
      listo: supuestosDisponibles.length > 0,
      falta: "Necesitas algún supuesto en el banco.",
    },
    {
      valor: "completo",
      que: "Las dos partes seguidas, repartiendo tú el tiempo",
      minutos: perfil.examen.minutosExamenCompleto,
      listo: estudiados.length >= 2 && supuestosDisponibles.length > 0,
      falta: "Hacen falta temas estudiados y algún supuesto.",
    },
  ];

  const corregidos = historial.filter((s) => s.estado === "corregido");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <header>
        <h1 className="text-[2.1rem]">Simulacros</h1>
        <p className="mt-1 max-w-[64ch] text-[0.98rem] leading-relaxed text-texto">
          Como el examen de Andalucía: las dos partes seguidas, cuatro horas y media en total y un
          reloj que no avisa de nada.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]"
        >
          {error}
        </p>
      ) : null}

      {enCurso ? (
        <Ficha className="flex flex-wrap items-center gap-4 bg-acento-fondo px-5 py-4">
          <p className="flex-1 text-[0.97rem]">
            Tienes un simulacro empezado. El reloj sigue corriendo desde que lo abriste.
          </p>
          <Boton onClick={() => router.push(`/simulacros/${enCurso.id}`)}>Volver a él</Boton>
        </Ficha>
      ) : null}

      {estudiados.length < minimo ? (
        <p className="max-w-[70ch] text-[0.92rem] leading-relaxed text-apagado">
          Llevas {estudiados.length} {estudiados.length === 1 ? "tema estudiado" : "temas estudiados"}.
          El plan pone el listón en {minimo} para que el sorteo se parezca al del examen, pero con dos
          ya puedes probar.
        </p>
      ) : null}

      {/* 1. Qué tipo de reloj */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">1. Cómo quieres el reloj</h2>
        <div role="radiogroup" aria-label="Cómo quieres el reloj" className="grid gap-3 sm:grid-cols-2">
          {RELOJES.map((r) => (
            <TarjetaEleccion
              key={r.valor}
              titulo={r.titulo}
              elegida={reloj === r.valor}
              onElegir={() => setReloj(r.valor)}
            >
              <span className="text-[0.9rem] leading-relaxed text-texto">{r.texto}</span>
            </TarjetaEleccion>
          ))}
        </div>
      </section>

      {/* 2. Qué examen */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">2. Qué quieres hacer</h2>
        <p className="text-[0.88rem] text-apagado">
          Toca una tarjeta para elegirla. Las que están en gris aún no se pueden hacer: debajo
          dice qué te falta.
        </p>
        <div role="radiogroup" aria-label="Qué quieres hacer" className="grid gap-3 sm:grid-cols-3">
          {modalidades.map((m) => (
            <TarjetaEleccion
              key={m.valor}
              titulo={NOMBRE_MODALIDAD[m.valor]}
              elegida={aConfirmar === m.valor}
              onElegir={() => {
                setAConfirmar(m.valor);
                // El paso 3 aparece debajo: se acerca a la vista para que no pase desapercibido.
                requestAnimationFrame(() =>
                  document.getElementById("confirmar-titulo")?.scrollIntoView({
                    block: "nearest",
                    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  }),
                );
              }}
              motivo={m.listo ? undefined : m.falta}
              deshabilitada={creando}
            >
              <span className="text-[0.9rem] leading-relaxed text-texto">{m.que}</span>
              <span className="font-display text-[1.4rem] text-tinta" data-numerico>
                {duracion(m.minutos)}
              </span>
            </TarjetaEleccion>
          ))}
        </div>
      </section>

      {/* 3. Confirmación: aquí se dice claro que el reloj arranca al pulsar */}
      {aConfirmar ? (
        <Ficha
          role="region"
          aria-labelledby="confirmar-titulo"
          className="entra flex flex-col gap-4 px-6 py-5"
        >
          <h2 id="confirmar-titulo" className="text-xl">
            3. Cuando quieras empezar
          </h2>
          <p className="text-[1rem] leading-relaxed text-tinta">
            {NOMBRE_MODALIDAD[aConfirmar]}, simulacro <strong className="font-semibold">{reloj}</strong>,{" "}
            {duracion(modalidades.find((m) => m.valor === aConfirmar)!.minutos)}.
          </p>
          <p className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-3 text-[0.95rem] leading-relaxed text-tinta">
            <strong className="font-semibold">Al pulsar «Empezar ya», se hace el sorteo y el reloj
            arranca en ese momento.</strong>{" "}
            {reloj === "real"
              ? "A partir de ahí no se para, aunque cierres la página."
              : "Podrás pausarlo desde el propio examen."}{" "}
            Mientras no pulses, puedes leer esto con calma.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Boton tamano="grande" onClick={() => void empezar(aConfirmar)} disabled={creando}>
              {creando ? "Sorteando…" : "Empezar ya"}
            </Boton>
            <Boton tono="secundario" onClick={() => setAConfirmar(null)} disabled={creando}>
              Todavía no
            </Boton>
          </div>
        </Ficha>
      ) : null}

      <details className={clsx("rounded-ficha border px-5 py-4", trampa ? "border-margen-hilo bg-margen-fondo" : "border-linea")}>
        <summary className="cursor-pointer text-[0.95rem] font-semibold text-tinta">
          Opciones del sorteo
        </summary>
        <label htmlFor="trampa" className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            id="trampa"
            checked={trampa}
            onChange={(e) => setTrampa(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[color:var(--color-margen)]"
          />
          <span>
            <span className="text-[0.97rem] font-semibold text-tinta">Simulacro trampa</span>
            <span className="block text-[0.9rem] leading-relaxed text-texto">
              El sorteo se carga a favor de tus temas más flojos. Sirve para practicar lo que menos
              te sabes; los sorteos normales siguen siendo al azar de verdad.
            </span>
          </span>
        </label>
      </details>

      {pedidos && ronda.temasTotal > 0 ? (
        <Ficha className="flex flex-col gap-2 px-5 py-4">
          <h2 className="text-lg">Ronda de temas</h2>
          <p className="text-[0.93rem] leading-relaxed text-texto">
            Lo que ya has desarrollado no vuelve a salir hasta que hagas todo lo demás. Te quedan{" "}
            <strong className="font-semibold" data-numerico>
              {ronda.temasQuedan} de {ronda.temasTotal}
            </strong>{" "}
            temas
            {ronda.supuestosTotal > 0 ? (
              <>
                {" "}y{" "}
                <strong className="font-semibold" data-numerico>
                  {ronda.supuestosQuedan} de {ronda.supuestosTotal}
                </strong>{" "}
                supuestos
              </>
            ) : null}
            . Cuando los acabes, vuelven todos al bombo.
          </p>
          {ronda.temasHechos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Temas ya hechos en esta ronda">
              {ronda.temasHechos.map((n) => (
                <span
                  key={n}
                  className="rounded-pliegue bg-papel-franja px-2 py-0.5 text-[0.8rem] text-apagado line-through"
                  data-numerico
                >
                  Tema {n}
                </span>
              ))}
            </div>
          ) : null}
          {estudiados.length > 0 ? (
            <p className="text-[0.85rem] text-apagado">
              Con {estudiados.length} temas estudiados y {dominados} dominados, la probabilidad de
              que al menos uno de los {perfil.examen.temasSorteados} que salgan sea de los que
              dominas es del <span data-numerico>{Math.round(probabilidad * 100)} %</span>.
            </p>
          ) : null}
        </Ficha>
      ) : null}

      {corregidos.length > 0 ? (
        <section>
          <h2 className="text-xl">Historial</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {corregidos.map((s) => (
              <li key={s.id}>
                <Ficha className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="text-[0.95rem] font-semibold">{NOMBRE_MODALIDAD[s.modalidad]}</span>
                  <Etiqueta tono={s.reloj === "flexible" ? "aviso" : undefined}>
                    {s.reloj === "flexible"
                      ? `flexible${s.pausas ? ` · ${s.pausas} ${s.pausas === 1 ? "pausa" : "pausas"}` : ""}`
                      : "real"}
                  </Etiqueta>
                  {s.trampa ? <Etiqueta tono="aviso">trampa</Etiqueta> : null}
                  <span className="text-[0.85rem] text-apagado" data-numerico>
                    {fechaCorta(s.creado_en.slice(0, 10))}
                  </span>
                  <span className="ml-auto font-display text-[1.3rem]" data-numerico>
                    {s.nota !== null ? Number(s.nota).toFixed(1) : "—"}
                  </span>
                  <Link href={`/simulacros/${s.id}`} className="regla text-[0.9rem] text-tinta">
                    Ver corrección
                  </Link>
                </Ficha>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Una opción a elegir entre varias, como tarjeta entera pulsable. La elegida
 * se rellena con el color de Simulacros y lleva su punto marcado. Si no se
 * puede elegir, sigue a la vista (para que se sepa que existe) pero apagada,
 * con el motivo escrito: nunca un botón gris sin explicación.
 */
function TarjetaEleccion({
  titulo,
  elegida,
  onElegir,
  motivo,
  deshabilitada,
  children,
}: {
  titulo: string;
  elegida: boolean;
  onElegir: () => void;
  motivo?: string;
  deshabilitada?: boolean;
  children: React.ReactNode;
}) {
  const bloqueada = Boolean(motivo);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      aria-disabled={bloqueada || deshabilitada ? true : undefined}
      onClick={() => {
        if (!bloqueada && !deshabilitada) onElegir();
      }}
      className={clsx(
        "flex flex-col gap-1.5 rounded-ficha border-2 px-5 py-4 text-left transition-[transform,box-shadow,background-color] duration-150",
        bloqueada
          ? "cursor-not-allowed border-dashed border-linea bg-papel"
          : elegida
            ? "border-sec-simulacro-vivo bg-sec-simulacro-fondo shadow-ficha"
            : "levanta border-borde bg-papel-alto",
      )}
    >
      <span className={clsx("flex items-center gap-2 text-[1.05rem] font-extrabold", bloqueada ? "text-apagado" : "text-tinta")}>
        <span
          aria-hidden="true"
          className={clsx(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
            elegida ? "border-sec-simulacro bg-sec-simulacro-vivo" : "border-linea",
          )}
        >
          {elegida ? <span className="h-2 w-2 rounded-full bg-papel-alto" /> : null}
        </span>
        {titulo}
      </span>
      <span className={clsx("flex flex-col gap-1.5", bloqueada && "opacity-60")}>{children}</span>
      {bloqueada ? (
        <span className="mt-1 rounded-[10px] bg-papel-franja px-3 py-2 text-[0.84rem] leading-snug text-texto">
          <strong className="font-extrabold">No disponible todavía.</strong> {motivo}
        </span>
      ) : null}
    </button>
  );
}
