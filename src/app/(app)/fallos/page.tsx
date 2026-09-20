"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Ficha } from "@/components/ui/ficha";
import { TarjetaPregunta, type Item, type Veredicto } from "@/components/tarjeta-pregunta";
import { useCuaderno } from "@/datos/almacen";
import { useSesion } from "@/datos/sesion";
import { moverEnLaCola } from "@/datos/cola-fallos";
import { ACIERTOS_PARA_SUPERAR } from "@/nucleo/fallos";
import { cuando, hoyISO } from "@/nucleo/fechas";
import { tituloCorto } from "@/contenido/temario-pt";

type FilaFallo = {
  item_id: string;
  tema_id: string;
  proxima_fecha: string;
  aciertos_seguidos: number;
  veces_fallado: number;
  resuelto_en: string | null;
  items: Item | null;
};

export default function PaginaFallos() {
  const { temas } = useCuaderno();
  const { usuario, cliente } = useSesion();
  const hoy = hoyISO();

  const [filas, setFilas] = useState<FilaFallo[]>([]);
  const [datosPedidos, setDatosPedidos] = useState(false);
  const [error, setError] = useState("");
  const [cola, setCola] = useState<FilaFallo[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [superados, setSuperados] = useState(0);

  // Se recarga subiendo la versión, que es lo que dispara el efecto.
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;

    void (async () => {
      const { data, error: e } = await cliente
        .from("fallos")
        .select(
          "item_id, tema_id, proxima_fecha, aciertos_seguidos, veces_fallado, resuelto_en, items(id, tema_id, tipo, enunciado, opciones, correcta, respuesta, explicacion, cita, desde_borrador)",
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

  const abiertos = filas.filter((f) => !f.resuelto_en);
  const tocanHoy = abiertos.filter((f) => f.proxima_fecha <= hoy);
  const masFallados = [...abiertos].sort((a, b) => b.veces_fallado - a.veces_fallado).slice(0, 5);

  const anotar = useCallback(
    async (fila: FilaFallo, veredicto: Veredicto) => {
      if (!cliente || !usuario || !fila.items) return;
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

  if (!usuario) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-[2.1rem]">Repaso de fallos</h1>
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            Tus fallos se guardan en la cuenta.{" "}
            <Link href="/entrar" className="regla font-semibold text-tinta">
              Entrar
            </Link>
          </p>
        </Ficha>
      </div>
    );
  }

  if (!datosPedidos) return <p className="text-apagado">Mirando qué has fallado…</p>;

  // --- cola en marcha ----------------------------------------------------
  if (cola) {
    const fila = cola[indice];
    if (!fila || indice >= cola.length) {
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <h1 className="text-[2.1rem]">Cola terminada</h1>
          <Ficha className="px-6 py-6">
            <p className="text-[0.98rem] leading-relaxed text-texto">
              Has repasado {cola.length} {cola.length === 1 ? "fallo" : "fallos"}.
              {superados > 0
                ? ` ${superados} ${superados === 1 ? "ha salido" : "han salido"} de la cola por tercer acierto seguido.`
                : " Los que sigues fallando vuelven mañana."}
            </p>
          </Ficha>
          <Boton
            onClick={() => {
              setCola(null);
              setSuperados(0);
              recargar();
            }}
            className="self-start"
          >
            Volver
          </Boton>
        </div>
      );
    }

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
            Dejarlo
          </button>
        </div>

        <p className="text-[0.88rem] text-apagado">
          Fallado {fila.veces_fallado} {fila.veces_fallado === 1 ? "vez" : "veces"} · llevas{" "}
          {fila.aciertos_seguidos} de {ACIERTOS_PARA_SUPERAR} aciertos seguidos
        </p>

        {fila.items ? (
          <TarjetaPregunta
            key={fila.item_id}
            item={fila.items}
            numero={indice + 1}
            total={cola.length}
            onResuelto={(v) => void anotar(fila, v)}
            onSiguiente={() => setIndice((i) => i + 1)}
          />
        ) : null}
      </div>
    );
  }

  // --- portada del apartado ---------------------------------------------
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-[2.1rem]">Repaso de fallos</h1>
        <p className="mt-1 text-[0.98rem] text-texto">
          Lo que fallas vuelve, cada vez más espaciado, hasta que lo aciertas{" "}
          {ACIERTOS_PARA_SUPERAR} veces seguidas.
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
        <Dato titulo="Superados" valor={filas.length - abiertos.length} />
      </dl>

      {tocanHoy.length > 0 ? (
        <Boton
          tamano="grande"
          className="self-start"
          onClick={() => {
            setCola(tocanHoy.filter((f) => f.items));
            setIndice(0);
            setSuperados(0);
          }}
        >
          Repasar {tocanHoy.length} {tocanHoy.length === 1 ? "fallo" : "fallos"}
        </Boton>
      ) : (
        <Ficha className="px-6 py-5">
          <p className="text-[0.98rem] leading-relaxed text-texto">
            {abiertos.length === 0
              ? "No tienes ningún fallo pendiente. Aparecerán solos en cuanto falles algo practicando."
              : `Hoy no toca ninguno. El siguiente vuelve ${cuando(abiertos[0].proxima_fecha, hoy)}.`}
          </p>
        </Ficha>
      )}

      {masFallados.length > 0 ? (
        <section>
          <h2 className="text-xl">Lo que más se te resiste</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {masFallados.map((fila) => {
              const tema = temas.find((t) => t.id === fila.tema_id);
              return (
                <li key={fila.item_id}>
                  <Ficha className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                    <span className="flex-1 text-[0.95rem] text-tinta">
                      {fila.items?.enunciado ?? "Pregunta borrada"}
                    </span>
                    {tema ? (
                      <span className="text-[0.82rem] text-apagado">
                        tema {tema.numero} · {tituloCorto(tema.titulo, 28)}
                      </span>
                    ) : null}
                    <span className="text-[0.82rem] font-semibold text-margen" data-numerico>
                      {fila.veces_fallado} fallos
                    </span>
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

function Dato({ titulo, valor, alerta }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <Ficha className={alerta ? "border-margen-hilo px-4 py-3" : "px-4 py-3"}>
      <dt className={alerta ? "text-[0.8rem] text-margen" : "text-[0.8rem] text-apagado"}>
        {titulo}
      </dt>
      <dd
        className={
          alerta
            ? "font-display text-[1.7rem] leading-tight text-margen"
            : "font-display text-[1.7rem] leading-tight"
        }
        data-numerico
      >
        {valor}
      </dd>
    </Ficha>
  );
}
