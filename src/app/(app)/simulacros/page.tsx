"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { fechaCorta } from "@/nucleo/fechas";
import { probabilidadDeDominado } from "@/nucleo/sorteo";

type Modalidad = "tema" | "supuesto" | "completo";

type Simulacro = {
  id: string;
  modalidad: Modalidad;
  estado: "en_curso" | "entregado" | "corregido" | "abandonado";
  trampa: boolean;
  nota: number | null;
  creado_en: string;
  duracion_s: number;
};

export default function PaginaSimulacros() {
  const router = useRouter();
  const { temas, perfil } = useCuaderno();
  const { usuario, cliente } = useSesion();

  const [historial, setHistorial] = useState<Simulacro[]>([]);
  const [supuestosDisponibles, setSupuestos] = useState(0);
  const [dominados, setDominados] = useState(0);
  const [pedidos, setPedidos] = useState(false);
  const [trampa, setTrampa] = useState(false);
  const [creando, setCreando] = useState<Modalidad | null>(null);
  const [error, setError] = useState("");

  const estudiados = temas.filter((t) => t.estadoEstudio !== "por_estudiar").length;
  const minimo = perfil.examen.minimoTemasParaSimulacro;
  const desbloqueado = estudiados >= Math.min(2, minimo) && estudiados >= 2;

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const [{ data: sims }, { count }, { data: dominio }] = await Promise.all([
        cliente
          .from("simulacros")
          .select("id, modalidad, estado, trampa, nota, creado_en, duracion_s")
          .order("creado_en", { ascending: false })
          .limit(20),
        cliente.from("supuestos").select("id", { count: "exact", head: true }),
        cliente.from("dominio_por_tema").select("tema_id, dominio, intentos"),
      ]);
      if (!vivo) return;
      setHistorial((sims ?? []) as Simulacro[]);
      setSupuestos(count ?? 0);
      setDominados(
        (dominio ?? []).filter((d) => Number(d.dominio ?? 0) >= 0.8 && Number(d.intentos) >= 5).length,
      );
      setPedidos(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario]);

  async function empezar(modalidad: Modalidad) {
    setCreando(modalidad);
    setError("");
    try {
      const respuesta = await fetch("/api/simulacro/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalidad, trampa }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se ha podido empezar el simulacro.");
      router.push(`/simulacros/${datos.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido empezar el simulacro.");
      setCreando(null);
    }
  }

  if (!usuario) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-[2.1rem]">Simulacros</h1>
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            Los simulacros y sus correcciones se guardan en tu cuenta.{" "}
            <Link href="/entrar" className="regla font-semibold text-tinta">
              Entrar
            </Link>
          </p>
        </Ficha>
      </div>
    );
  }

  const enCurso = historial.find((s) => s.estado === "en_curso");
  const probabilidad = probabilidadDeDominado(estudiados, dominados, perfil.examen.temasSorteados);

  const modalidades: { valor: Modalidad; titulo: string; que: string; minutos: number; listo: boolean; falta?: string }[] = [
    {
      valor: "tema",
      titulo: "Solo tema",
      que: `${perfil.examen.temasSorteados} temas al azar, eliges 1`,
      minutos: perfil.examen.minutosSoloTema,
      listo: estudiados >= 2,
      falta: "Marca al menos dos temas como estudiados.",
    },
    {
      valor: "supuesto",
      titulo: "Solo supuesto",
      que: `${perfil.examen.supuestosSorteados} supuestos variados, eliges 1`,
      minutos: perfil.examen.minutosSoloSupuesto,
      listo: supuestosDisponibles > 0,
      falta: "Necesitas supuestos en el banco.",
    },
    {
      valor: "completo",
      titulo: "Examen completo",
      que: "Las dos partes seguidas, repartiendo tú el tiempo",
      minutos: perfil.examen.minutosExamenCompleto,
      listo: estudiados >= 2 && supuestosDisponibles > 0,
      falta: "Hacen falta temas estudiados y algún supuesto.",
    },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Simulacros</h1>
        <p className="mt-1 max-w-[64ch] text-[0.98rem] leading-relaxed text-texto">
          Como el examen de Andalucía: las dos partes seguidas, cuatro horas y media en total y un
          reloj que no avisa de nada.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-2 text-[0.92rem]">
          {error}
        </p>
      ) : null}

      {enCurso ? (
        <Ficha className="flex flex-wrap items-center gap-4 border-tinta px-5 py-4">
          <p className="flex-1 text-[0.97rem]">
            Tienes un simulacro empezado. El reloj sigue corriendo desde que lo abriste.
          </p>
          <Boton onClick={() => router.push(`/simulacros/${enCurso.id}`)}>Volver a él</Boton>
        </Ficha>
      ) : null}

      {!desbloqueado ? (
        <Ficha className="border-dashed px-6 py-5">
          <p className="text-[0.97rem] leading-relaxed text-texto">
            Todavía no tiene sentido sortear: llevas {estudiados}{" "}
            {estudiados === 1 ? "tema estudiado" : "temas estudiados"}. El plan pone el listón en{" "}
            {minimo}, pero con dos ya puedes probar cómo va.
          </p>
        </Ficha>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {modalidades.map((modalidad) => (
          <Ficha key={modalidad.valor} className="flex flex-col gap-2 px-5 py-5">
            <h2 className="text-xl">{modalidad.titulo}</h2>
            <p className="text-[0.92rem] leading-relaxed text-texto">{modalidad.que}</p>
            <p className="font-display text-[1.5rem]" data-numerico>
              {Math.floor(modalidad.minutos / 60)} h {String(modalidad.minutos % 60).padStart(2, "0")} min
            </p>
            <div className="mt-auto pt-3">
              {modalidad.listo ? (
                <Boton
                  onClick={() => void empezar(modalidad.valor)}
                  disabled={creando !== null}
                  className="w-full"
                >
                  {creando === modalidad.valor ? "Sorteando…" : "Empezar"}
                </Boton>
              ) : (
                <p className="text-[0.85rem] text-apagado">{modalidad.falta}</p>
              )}
            </div>
          </Ficha>
        ))}
      </div>

      <Ficha className={clsx("px-5 py-4", trampa && "border-margen-hilo bg-margen-fondo")}>
        <label htmlFor="trampa" className="flex cursor-pointer items-start gap-3">
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
      </Ficha>

      {estudiados > 0 ? (
        <p className="text-[0.9rem] leading-relaxed text-apagado">
          Con {estudiados} temas estudiados y {dominados} dominados, la probabilidad de que al menos
          uno de los {perfil.examen.temasSorteados} que salgan sea de los que dominas es del{" "}
          <span data-numerico>{Math.round(probabilidad * 100)} %</span>.
        </p>
      ) : null}

      {pedidos && historial.filter((s) => s.estado === "corregido").length > 0 ? (
        <section>
          <h2 className="text-xl">Historial</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {historial
              .filter((s) => s.estado === "corregido")
              .map((simulacro) => (
                <li key={simulacro.id}>
                  <Ficha className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="text-[0.95rem] font-semibold">
                      {simulacro.modalidad === "completo"
                        ? "Examen completo"
                        : simulacro.modalidad === "tema"
                          ? "Solo tema"
                          : "Solo supuesto"}
                    </span>
                    {simulacro.trampa ? <Etiqueta tono="aviso">trampa</Etiqueta> : null}
                    <span className="text-[0.85rem] text-apagado" data-numerico>
                      {fechaCorta(simulacro.creado_en.slice(0, 10))}
                    </span>
                    <span className="ml-auto font-display text-[1.3rem]" data-numerico>
                      {simulacro.nota !== null ? simulacro.nota.toFixed(1) : "—"}
                    </span>
                    <Link
                      href={`/simulacros/${simulacro.id}`}
                      className="regla text-[0.9rem] text-tinta"
                    >
                      Ver
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
