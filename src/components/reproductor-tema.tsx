"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Boton } from "@/components/ui/boton";
import { textoParaEscuchar } from "@/nucleo/estructura";
import { Selector } from "@/components/ui/campos";

/**
 * Escuchar un tema mientras vas en el coche o andando.
 *
 * La voz del propio dispositivo: gratis, sin conexión y al momento, aunque
 * suene a robot. Es el respaldo: la voz natural (generada con `npm run voz`)
 * y las grabaciones propias están en AudiosTema.
 */
export function ReproductorTema({ texto }: { texto: string }) {
  // Se calcula en el primer render del cliente, no en un efecto: así no hay
  // un render de más ni discordancia con lo pintado en el servidor.
  const [soportado] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [hablando, setHablando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [vozElegida, setVozElegida] = useState("");
  const locucion = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!soportado) return;

    const cargarVoces = () => {
      const enEspanol = window.speechSynthesis
        .getVoices()
        .filter((voz) => voz.lang.toLowerCase().startsWith("es"));
      setVoces(enEspanol);
      setVozElegida((previa) => previa || enEspanol[0]?.name || "");
    };

    cargarVoces();
    window.speechSynthesis.addEventListener("voiceschanged", cargarVoces);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", cargarVoces);
      window.speechSynthesis.cancel();
    };
  }, [soportado]);

  function leer() {
    if (!texto.trim()) return;
    window.speechSynthesis.cancel();

    const nueva = new SpeechSynthesisUtterance(limpiarParaLeer(textoParaEscuchar(texto)));
    nueva.lang = "es-ES";
    nueva.rate = velocidad;
    const voz = voces.find((v) => v.name === vozElegida);
    if (voz) nueva.voice = voz;
    nueva.onend = () => {
      setHablando(false);
      setPausado(false);
    };
    nueva.onerror = () => {
      setHablando(false);
      setPausado(false);
    };

    locucion.current = nueva;
    window.speechSynthesis.speak(nueva);
    setHablando(true);
    setPausado(false);
  }

  function alternarPausa() {
    if (pausado) {
      window.speechSynthesis.resume();
      setPausado(false);
    } else {
      window.speechSynthesis.pause();
      setPausado(true);
    }
  }

  function parar() {
    window.speechSynthesis.cancel();
    setHablando(false);
    setPausado(false);
  }

  if (!soportado) {
    return (
      <p className="text-[0.85rem] text-apagado">
        Este navegador no puede leer los temas en voz alta. En el móvil suele funcionar.
      </p>
    );
  }

  const minutos = Math.max(1, Math.round(contarPalabras(texto) / (150 * velocidad)));

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!hablando ? (
        <Boton tono="secundario" onClick={leer} disabled={!texto.trim()}>
          Escuchar el tema
        </Boton>
      ) : (
        <>
          <Boton tono="secundario" onClick={alternarPausa}>
            {pausado ? "Seguir" : "Pausa"}
          </Boton>
          <Boton tono="fantasma" onClick={parar}>
            Parar
          </Boton>
        </>
      )}

      <Selector
        etiqueta="Velocidad"
        etiquetaOculta
        className="w-24"
        valor={String(velocidad)}
        onCambio={(v) => {
          setVelocidad(Number(v));
          if (hablando) parar();
        }}
        opciones={[0.8, 1, 1.2, 1.5, 1.8].map((v) => ({ valor: String(v), texto: `${String(v).replace(".", ",")}×` }))}
      />

      {voces.length > 1 ? (
        <>
          <Selector
            etiqueta="Voz"
            etiquetaOculta
            className="w-52"
            valor={vozElegida}
            onCambio={(v) => {
              setVozElegida(v);
              if (hablando) parar();
            }}
            opciones={voces.map((voz) => ({ valor: voz.name, texto: voz.name }))}
          />
        </>
      ) : null}

      <span className={clsx("text-[0.82rem] text-apagado")} data-numerico>
        unos {minutos} min
      </span>
    </div>
  );
}

/** Quita marcas de markdown para que no se lean los almohadillas y asteriscos. */
export function limpiarParaLeer(texto: string): string {
  return texto
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[ilegible\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contarPalabras(texto: string): number {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}
