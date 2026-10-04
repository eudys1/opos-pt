"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { CampoFecha } from "@/components/ui/campos";
import { useCuaderno } from "@/datos/almacen";
import {
  desmarcarHito,
  hitosDelTema,
  hitosQueSeQuitan,
  limitesDeFecha,
  type CodigoEdicion,
} from "@/nucleo/hitos";
import { reprogramadosPorTema } from "@/nucleo/agenda";
import { progresoDelTema } from "@/nucleo/repasos";
import { fechaLarga, hoyISO } from "@/nucleo/fechas";

/**
 * Editar un paso del estudio de un tema: estudiado, repaso 1, repaso 2…
 *
 * Lo abren igual el registro y el planificador, y escribe en el mismo sitio:
 * por eso lo que se cambia en uno aparece cambiado en el otro. Se puede
 * cambiar tantas veces como se quiera.
 *
 *   - Si el paso está hecho: cambiar el día, o desmarcarlo.
 *   - Si es el siguiente por hacer: marcarlo hecho en un día (hoy o antes), o
 *     moverlo a otro día sin hacerlo.
 */

export type HitoAEditar = { temaId: string; indice: number };

function nombrePaso(indice: number): string {
  return indice === 0 ? "Estudiado" : `Repaso ${indice}`;
}

export function EditorHito({ hito, onCerrar }: { hito: HitoAEditar | null; onCerrar: () => void }) {
  const { temas } = useCuaderno();
  const tema = hito ? temas.find((t) => t.id === hito.temaId) : undefined;

  return (
    <Dialogo
      abierto={Boolean(hito && tema)}
      onCerrar={onCerrar}
      titulo={hito && tema ? `${nombrePaso(hito.indice)} · tema ${tema.numero}` : ""}
    >
      {hito && tema ? (
        <Contenido key={`${hito.temaId}-${hito.indice}`} hito={hito} onCerrar={onCerrar} />
      ) : null}
    </Dialogo>
  );
}

function Contenido({ hito, onCerrar }: { hito: HitoAEditar; onCerrar: () => void }) {
  const {
    eventos,
    objetivos,
    perfil,
    marcarHito,
    cambiarFechaDeHito,
    desmarcar,
    reprogramarRepaso,
  } = useCuaderno();
  const hoy = hoyISO();

  const hecho = hitosDelTema(eventos, hito.temaId).find((h) => h.indice === hito.indice);
  const { min, max } = limitesDeFecha(eventos, hito.temaId, hito.indice, hoy);
  const { siguiente } = progresoDelTema(eventos, hito.temaId, {
    intervalos: perfil.intervalosRepaso,
    hoy,
    reprogramados: reprogramadosPorTema(objetivos)[hito.temaId],
  });

  const [fecha, setFecha] = useState(hecho?.evento.fecha ?? hoy);
  const [fechaMover, setFechaMover] = useState(siguiente?.tocaEn && siguiente.tocaEn > hoy ? siguiente.tocaEn : hoy);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [error, setError] = useState("");

  const explicar = (codigo: CodigoEdicion) => {
    const mensajes: Record<CodigoEdicion, string> = {
      "en-el-futuro": "No puede ser un día futuro: es algo que ya has hecho. Para planearlo, usa «Mover a otro día».",
      "antes-del-anterior": `Tiene que ser el mismo día o después del paso anterior${min ? ` (${fechaLarga(min)})` : ""}.`,
      "despues-del-siguiente": `No puede quedar después del paso siguiente, que hiciste el ${fechaLarga(max)}.`,
      "vuelta-completa": "Ya has hecho todos los repasos de este tema.",
      "no-existe": "Ese paso ya no existe. Cierra y vuelve a abrirlo.",
      "sin-estudiar": "Primero hay que marcar el tema como estudiado.",
    };
    setError(mensajes[codigo]);
  };

  // --- ya hecho: cambiar el día o desmarcar --------------------------------
  if (hecho) {
    const seQuitan = hitosQueSeQuitan(eventos, hito.temaId, hito.indice);
    // Cómo queda el tema si se desmarca: se calcula igual que lo hará la app.
    const trasDesmarcar = progresoDelTema(desmarcarHito(eventos, hito.temaId, hito.indice), hito.temaId, {
      intervalos: perfil.intervalosRepaso,
      hoy,
      reprogramados: reprogramadosPorTema(objetivos)[hito.temaId],
    }).siguiente;
    const despues =
      hito.indice === 0
        ? "El tema volverá a «sin estudiar» y no tendrá repasos hasta que lo marques de nuevo."
        : trasDesmarcar?.tocaEn
          ? `Después, lo siguiente será el ${nombrePaso(trasDesmarcar.indice).toLowerCase()}, que tocará el ${fechaLarga(trasDesmarcar.tocaEn)}.`
          : "";
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[0.95rem] text-texto">
          Lo marcaste el <strong className="font-semibold text-tinta">{fechaLarga(hecho.evento.fecha)}</strong>.
        </p>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fecha) return setError("Elige un día.");
            if (fecha === hecho.evento.fecha) {
              return setError("Es el mismo día que ya tenía. Elige otro para cambiarlo.");
            }
            const codigo = cambiarFechaDeHito(hito.temaId, hito.indice, fecha);
            if (codigo) explicar(codigo);
            else onCerrar();
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <CampoFecha
              etiqueta="Cambiar el día"
              valor={fecha}
              minimo={min}
              maximo={max}
              onCambio={(f) => {
                setFecha(f);
                setError("");
              }}
            />
            <Boton type="submit">
              Guardar el día
            </Boton>
          </div>
        </form>

        {error ? (
          <p role="alert" className="text-[0.9rem] text-margen">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-linea-suave pt-4">
          <p className="text-[0.9rem] font-semibold text-tinta">Desmarcar</p>
          {confirmarQuitar ? (
            <div className="flex flex-col gap-3 rounded-pliegue border-2 border-margen bg-margen-fondo px-4 py-3">
              <p className="text-[0.92rem] font-bold text-margen">
                {seQuitan.length > 1 ? "Se quitarán estas marcas:" : "Se quitará esta marca:"}
              </p>
              <ul className="flex flex-col gap-0.5 text-[0.92rem] text-tinta">
                {seQuitan.map((h) => (
                  <li key={h.evento.id}>
                    · {nombrePaso(h.indice)}, hecho el {fechaLarga(h.evento.fecha)}
                  </li>
                ))}
              </ul>
              <p className="text-[0.88rem] leading-relaxed text-texto">
                {despues}
                {seQuitan.length > 1
                  ? " Los posteriores también se quitan porque cada repaso se cuenta desde el anterior."
                  : ""}{" "}
                Lo verás igual en el registro y en el planificador.
              </p>
              <div className="flex flex-wrap gap-2">
                <Boton
                  onClick={() => {
                    desmarcar(hito.temaId, hito.indice);
                    onCerrar();
                  }}
                >
                  Sí, desmarcar
                </Boton>
                <Boton tono="secundario" onClick={() => setConfirmarQuitar(false)}>
                  No, dejarlo como está
                </Boton>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[0.85rem] leading-relaxed text-apagado">
                Quita esta marca
                {seQuitan.length > 1
                  ? ` y las ${seQuitan.length - 1} posteriores (${seQuitan
                      .slice(1)
                      .map((h) => nombrePaso(h.indice).toLowerCase())
                      .join(", ")})`
                  : ""}
                , por si te equivocaste. Antes de hacerlo te dice exactamente qué cambia.
              </p>
              <Boton tono="secundario" className="self-start" onClick={() => setConfirmarQuitar(true)}>
                Desmarcar…
              </Boton>
            </>
          )}
        </div>

        <Boton tono="secundario" className="self-end" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    );
  }

  // --- por hacer: marcarlo o moverlo -----------------------------------------
  const esElSiguiente = !siguiente || siguiente.indice === hito.indice;
  if (!esElSiguiente) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[0.95rem] leading-relaxed text-texto">
          Antes toca {nombrePaso(siguiente!.indice).toLowerCase()}: los repasos van en orden, y la
          fecha de este depende de cuándo hagas aquel.
        </p>
        <Boton tono="secundario" className="self-end" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {siguiente?.tocaEn ? (
        <p className="text-[0.95rem] text-texto">
          Toca el <strong className="font-semibold text-tinta">{fechaLarga(siguiente.tocaEn)}</strong>
          {siguiente.estado === "atrasado" ? " · va con retraso" : ""}.
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fecha) return setError("Elige el día en que lo hiciste.");
          const codigo = marcarHito(hito.temaId, fecha);
          if (codigo) explicar(codigo);
          else onCerrar();
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <CampoFecha
            etiqueta="Marcar como hecho el día"
            valor={fecha}
            minimo={min}
            maximo={hoy}
            onCambio={(f) => {
              setFecha(f);
              setError("");
            }}
          />
          <Boton type="submit">
            Marcar hecho
          </Boton>
        </div>
        <p className="text-[0.82rem] text-apagado">Si lo hiciste otro día y se te olvidó marcarlo, pon ese día.</p>
      </form>

      {hito.indice > 0 ? (
        <form
          className="flex flex-col gap-2 border-t border-linea-suave pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fechaMover) return setError("Elige el día al que quieres moverlo.");
            reprogramarRepaso(hito.temaId, hito.indice, fechaMover);
            onCerrar();
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <CampoFecha
              etiqueta="O moverlo a otro día, sin hacerlo aún"
              valor={fechaMover}
              minimo={hoy}
              onCambio={setFechaMover}
            />
            <Boton type="submit" tono="secundario">
              Mover
            </Boton>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-[0.9rem] text-margen">
          {error}
        </p>
      ) : null}

      <Boton tono="secundario" className="self-end" onClick={onCerrar}>
        Cancelar
      </Boton>
    </div>
  );
}
