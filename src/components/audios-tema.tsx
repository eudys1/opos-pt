"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { BarraProgreso } from "@/components/ui/barra-progreso";
import { useSesion } from "@/datos/sesion";
import { BITS_POR_SEGUNDO_VOZ, formatoDeGrabacion } from "@/datos/comprimir";
import { fechaCorta } from "@/nucleo/fechas";

/**
 * Escuchar un tema: la voz natural generada y las grabaciones propias.
 *
 * Grabarse leyendo el tema es a la vez estudiar ("cantar el tema") y tener un
 * audio con tu propia voz para repasar andando. Se graba en Opus, mono, a
 * 24 kbps: es voz, no música, y así un tema de un cuarto de hora ocupa unos
 * 3 MB. La compresión la hace el propio navegador al grabar.
 */

type Grabacion = {
  id: string;
  ruta: string;
  tipo_mime: string;
  bytes: number;
  duracion_s: number;
  origen: "propia" | "sintetica";
  creado_en: string;
};

function minutos(s: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(Math.round(s % 60)).padStart(2, "0")} s` : `${Math.round(s)} s`;
}

export function AudiosTema({ temaId, numero }: { temaId: string; numero: number }) {
  const { usuario, cliente } = useSesion();
  const [grabaciones, setGrabaciones] = useState<(Grabacion & { url?: string })[]>([]);
  const [version, setVersion] = useState(0);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente || !usuario) return;
    let vivo = true;
    void (async () => {
      const { data } = await cliente
        .from("grabaciones")
        .select("id, ruta, tipo_mime, bytes, duracion_s, origen, creado_en")
        .eq("tema_id", temaId)
        .order("creado_en", { ascending: false });
      const lista = (data ?? []) as Grabacion[];
      // URLs firmadas: el cubo es privado y caducan en una hora.
      const conUrl = await Promise.all(
        lista.map(async (g) => {
          const { data: firmada } = await cliente.storage.from("apuntes").createSignedUrl(g.ruta, 3600);
          return { ...g, url: firmada?.signedUrl };
        }),
      );
      if (vivo) setGrabaciones(conUrl);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, usuario, temaId, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  async function borrar(g: Grabacion) {
    if (!cliente) return;
    await cliente.storage.from("apuntes").remove([g.ruta]);
    await cliente.from("grabaciones").delete().eq("id", g.id);
    setABorrar(null);
    recargar();
  }

  const natural = grabaciones.find((g) => g.origen === "sintetica");
  const propias = grabaciones.filter((g) => g.origen === "propia");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[0.9rem] font-semibold text-tinta">Voz natural</p>
        {natural?.url ? (
          <>
            <audio controls preload="none" src={natural.url} className="w-full max-w-xl">
              Tu navegador no puede reproducir este audio.
            </audio>
            <p className="text-[0.8rem] text-apagado">
              {minutos(natural.duracion_s)} · generada el {fechaCorta(natural.creado_en.slice(0, 10))}
            </p>
          </>
        ) : (
          <p className="text-[0.85rem] leading-relaxed text-apagado">
            Todavía no hay voz natural para este tema. Se genera desde el portátil con{" "}
            <code className="rounded bg-papel-franja px-1 text-[0.8rem]">npm run voz -- --tema={numero}</code>;
            mientras, puedes grabarte tú o usar la voz del dispositivo.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-linea-suave pt-4">
        <p className="text-[0.9rem] font-semibold text-tinta">Tu voz</p>
        {propias.map((g) => (
          <div key={g.id} className="flex flex-col gap-1.5">
            {g.url ? (
              <audio controls preload="none" src={g.url} className="w-full max-w-xl">
                Tu navegador no puede reproducir este audio.
              </audio>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-apagado">
              <span>
                Grabada el {fechaCorta(g.creado_en.slice(0, 10))} · {minutos(g.duracion_s)} ·{" "}
                {(g.bytes / 1024 / 1024).toFixed(1)} MB
              </span>
              {aBorrar === g.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-margen">¿Borrarla?</span>
                  <Boton tono="fantasma" onClick={() => void borrar(g)}>
                    Sí, borrar
                  </Boton>
                  <Boton tono="fantasma" onClick={() => setABorrar(null)}>
                    No
                  </Boton>
                </span>
              ) : (
                <button type="button" onClick={() => setABorrar(g.id)} className="regla min-h-11 text-texto">
                  Borrar
                </button>
              )}
            </div>
          </div>
        ))}
        <Grabadora temaId={temaId} onGuardada={recargar} />
      </div>
    </div>
  );
}

type EstadoGrabadora = "quieta" | "grabando" | "pausada" | "revisando" | "subiendo";

function Grabadora({ temaId, onGuardada }: { temaId: string; onGuardada: () => void }) {
  const { usuario, cliente } = useSesion();
  const [estado, setEstado] = useState<EstadoGrabadora>("quieta");
  const [segundos, setSegundos] = useState(0);
  const [audio, setAudio] = useState<{ blob: Blob; url: string; tipo: string } | null>(null);
  const [error, setError] = useState("");
  const grabador = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const flujo = useRef<MediaStream | null>(null);

  const pararReloj = () => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
  };
  const arrancarReloj = () => {
    pararReloj();
    reloj.current = setInterval(() => setSegundos((s) => s + 1), 1000);
  };

  useEffect(
    () => () => {
      pararReloj();
      flujo.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function empezar() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      flujo.current = stream;
      const { tipo } = formatoDeGrabacion();
      const mr = new MediaRecorder(stream, { mimeType: tipo, audioBitsPerSecond: BITS_POR_SEGUNDO_VOZ });
      trozos.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(trozos.current, { type: mr.mimeType || tipo });
        setAudio({ blob, url: URL.createObjectURL(blob), tipo: mr.mimeType || tipo });
        stream.getTracks().forEach((t) => t.stop());
        setEstado("revisando");
      };
      grabador.current = mr;
      mr.start(1000);
      setSegundos(0);
      arrancarReloj();
      setEstado("grabando");
    } catch {
      setError("No se ha podido usar el micrófono. Revisa que el navegador tenga permiso.");
    }
  }

  function pausar() {
    grabador.current?.pause();
    pararReloj();
    setEstado("pausada");
  }
  function reanudar() {
    grabador.current?.resume();
    arrancarReloj();
    setEstado("grabando");
  }
  function terminar() {
    pararReloj();
    grabador.current?.stop();
  }
  function descartar() {
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio(null);
    setSegundos(0);
    setEstado("quieta");
  }

  async function guardar() {
    if (!cliente || !usuario || !audio) return;
    setEstado("subiendo");
    setError("");
    const tipoLimpio = audio.tipo.split(";")[0];
    const extension = tipoLimpio.includes("ogg") ? "ogg" : tipoLimpio.includes("mp4") ? "m4a" : "webm";
    const ruta = `${usuario.id}/voz/${temaId}/propia-${Date.now()}.${extension}`;
    const { error: e1 } = await cliente.storage
      .from("apuntes")
      .upload(ruta, audio.blob, { contentType: tipoLimpio });
    if (e1) {
      setError(e1.message);
      setEstado("revisando");
      return;
    }
    const { error: e2 } = await cliente.from("grabaciones").insert({
      usuario_id: usuario.id,
      tema_id: temaId,
      ruta,
      tipo_mime: tipoLimpio,
      bytes: audio.blob.size,
      duracion_s: segundos,
      origen: "propia",
    });
    if (e2) {
      setError(e2.message);
      setEstado("revisando");
      return;
    }
    descartar();
    onGuardada();
  }

  const reloj_ = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-2">
      {estado === "quieta" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Boton tono="secundario" onClick={() => void empezar()}>
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-margen" />
            Grabarme leyendo el tema
          </Boton>
          <span className="text-[0.8rem] text-apagado">Unos 3 MB por cada cuarto de hora.</span>
        </div>
      ) : null}

      {estado === "grabando" || estado === "pausada" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-pliegue border border-margen-hilo bg-margen-fondo px-4 py-3">
          <span aria-hidden="true" className={estado === "grabando" ? "h-3 w-3 animate-pulse rounded-full bg-margen" : "h-3 w-3 rounded-full bg-apagado"} />
          <span className="font-display text-[1.3rem] font-bold text-tinta" data-numerico role="timer">
            {reloj_}
          </span>
          <span className="text-[0.85rem] text-texto">{estado === "grabando" ? "Grabando…" : "En pausa"}</span>
          <span className="ml-auto flex gap-2">
            {estado === "grabando" ? (
              <Boton tono="secundario" onClick={pausar}>
                Pausar
              </Boton>
            ) : (
              <Boton tono="secundario" onClick={reanudar}>
                Seguir
              </Boton>
            )}
            <Boton onClick={terminar}>Terminar</Boton>
          </span>
        </div>
      ) : null}

      {estado === "revisando" && audio ? (
        <div className="flex flex-col gap-2 rounded-pliegue border border-linea px-4 py-3">
          <p className="text-[0.88rem] text-texto">
            Escúchala antes de guardarla · {reloj_} · {(audio.blob.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <audio controls src={audio.url} className="w-full max-w-xl" />
          <div className="flex gap-2">
            <Boton onClick={() => void guardar()}>Guardarla</Boton>
            <Boton tono="secundario" onClick={descartar}>
              Descartar
            </Boton>
          </div>
        </div>
      ) : null}

      {estado === "subiendo" ? <BarraProgreso pasos={["subiendo tu grabación"]} actual={0} /> : null}

      {error ? (
        <p role="alert" className="text-[0.88rem] text-margen">
          {error}
        </p>
      ) : null}
    </div>
  );
}
