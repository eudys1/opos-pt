"use client";

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { TEMARIO_PT } from "@/contenido/temario-pt";
import { hoyISO } from "@/nucleo/fechas";
import { proximoNumeroDeRepaso } from "@/nucleo/repasos";
import {
  cambiarFechaHito,
  desmarcarHito,
  estadoEstudioDe,
  marcarSiguienteHito,
  type CodigoEdicion,
} from "@/nucleo/hitos";
import { esReprogramacion } from "@/nucleo/agenda";
import {
  CONFIGURACION_ANDALUCIA,
  INTERVALOS_POR_DEFECTO,
  type EstadoContenido,
  type EventoEstudio,
  type Objetivo,
  type Perfil,
  type Tema,
  type TipoActividad,
} from "@/nucleo/tipos";

/**
 * Almacén de la fase 1.
 *
 * Guarda en el navegador para que la app se pueda usar desde el primer día, sin
 * cuenta ni servidor. La forma de los datos es ya la de las tablas de Supabase
 * (`supabase/migrations/0001_fase1.sql`), así que el día que se conecte la nube
 * solo cambia este adaptador, no las pantallas.
 *
 * Es un store externo leído con `useSyncExternalStore`: en el servidor devuelve
 * siempre el estado inicial, y el contenido real del navegador entra al
 * suscribirse. Así no hay ni discordancia de hidratación ni renders en cascada.
 */

const CLAVE = "cuaderno:v1";

export type Estado = {
  perfil: Perfil;
  temas: Tema[];
  eventos: EventoEstudio[];
  objetivos: Objetivo[];
};

function estadoInicial(): Estado {
  return {
    perfil: {
      id: "local",
      nombre: "",
      especialidad: "Educación Especial: Pedagogía Terapéutica",
      comunidad: "Andalucía",
      intervalosRepaso: INTERVALOS_POR_DEFECTO,
      diasLibresAlMes: 2,
      examen: CONFIGURACION_ANDALUCIA,
    },
    temas: TEMARIO_PT.map((t) => ({
      id: `tema-${t.numero}`,
      numero: t.numero,
      titulo: t.titulo,
      estadoContenido: "sin_contenido" as EstadoContenido,
      estadoEstudio: "por_estudiar" as const,
      texto: "",
      vueltas: 0,
      actualizadoEn: "",
    })),
    eventos: [],
    objetivos: [],
  };
}

/** Hora exacta de un cambio: la fusión con la cuenta la necesita, no solo el día. */
function ahoraISO(): string {
  return new Date().toISOString();
}

function nuevoId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

// --------------------------------------------------------------- el store

/** Referencia estable para el render del servidor y el primer render del cliente. */
const ESTADO_SERVIDOR: Estado = estadoInicial();

let estado: Estado = ESTADO_SERVIDOR;
let cargado = false;
const escuchas = new Set<() => void>();

function avisar() {
  for (const escucha of escuchas) escucha();
}

function cargarDelNavegador() {
  if (cargado) return;
  cargado = true;
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    if (!guardado) return;
    const datos = JSON.parse(guardado) as Partial<Estado>;
    // Se parte del estado inicial para heredar títulos o campos nuevos.
    estado = { ...estadoInicial(), ...datos };
  } catch {
    // Un almacenamiento bloqueado no impide usar la app: se sigue en memoria.
  }
}

/**
 * Varias pestañas abiertas (Mi temario y el editor del tema, por ejemplo)
 * comparten el mismo guardado del navegador. Cuando otra pestaña lo cambia,
 * esta se pone al día, en vez de seguir con su copia vieja y acabar
 * guardándola encima de lo nuevo.
 */
let escuchandoOtrasPestanas = false;
function escucharOtrasPestanas() {
  if (escuchandoOtrasPestanas || typeof window === "undefined") return;
  escuchandoOtrasPestanas = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== CLAVE || !e.newValue) return;
    try {
      estado = { ...estadoInicial(), ...(JSON.parse(e.newValue) as Partial<Estado>) };
      avisar();
    } catch {
      // Un guardado ilegible de otra pestaña no rompe esta.
    }
  });
}

function suscribir(escucha: () => void) {
  const eraPrimera = !cargado;
  cargarDelNavegador();
  escucharOtrasPestanas();
  escuchas.add(escucha);
  if (eraPrimera) escucha();
  return () => {
    escuchas.delete(escucha);
  };
}

function leer(): Estado {
  return estado;
}

function leerEnServidor(): Estado {
  return ESTADO_SERVIDOR;
}

function actualizar(cambio: (previo: Estado) => Estado) {
  const nuevo = cambio(estado);
  if (nuevo === estado) return;
  estado = nuevo;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Sin persistencia, pero la sesión sigue funcionando.
  }
  avisar();
}

/** Para las pruebas y para el botón de empezar de cero. */
export function reiniciarAlmacen() {
  actualizar(() => estadoInicial());
}

// -------------------------------------------------------------- el acceso

export function ProveedorCuaderno({ children }: { children: ReactNode }) {
  // El store vive fuera de React; el proveedor solo marca el límite de cliente.
  return <>{children}</>;
}

export function useCuaderno() {
  const estadoActual = useSyncExternalStore(suscribir, leer, leerEnServidor);
  const listo = useSyncExternalStore(
    suscribir,
    () => cargado,
    () => false,
  );

  const marcarEstudiado = useCallback((temaId: string, fecha = hoyISO()) => {
    actualizar((prev) => {
      if (prev.eventos.some((e) => e.temaId === temaId && e.tipo === "estudiado")) return prev;
      return {
        ...prev,
        eventos: [...prev.eventos, { id: nuevoId(), temaId, tipo: "estudiado", fecha }],
        temas: prev.temas.map((t) =>
          t.id === temaId ? { ...t, estadoEstudio: "estudiado", actualizadoEn: ahoraISO() } : t,
        ),
      };
    });
  }, []);

  const marcarRepaso = useCallback((temaId: string, fecha = hoyISO()) => {
    actualizar((prev) => {
      const numeroRepaso = proximoNumeroDeRepaso(prev.eventos, temaId);
      if (numeroRepaso > prev.perfil.intervalosRepaso.length) return prev;
      const vueltaCompleta = numeroRepaso >= prev.perfil.intervalosRepaso.length;
      return {
        ...prev,
        eventos: [
          ...prev.eventos,
          { id: nuevoId(), temaId, tipo: "repaso", numeroRepaso, fecha },
        ],
        temas: prev.temas.map((t) =>
          t.id === temaId
            ? {
                ...t,
                estadoEstudio: vueltaCompleta ? "dominado" : "en_repaso",
                vueltas: vueltaCompleta ? t.vueltas + 1 : t.vueltas,
                actualizadoEn: ahoraISO(),
              }
            : t,
        ),
      };
    });
  }, []);

  /**
   * Marca el siguiente hito de un tema en la fecha dada. Devuelve el código de
   * error si no se puede, para que la pantalla lo explique.
   */
  const marcarHito = useCallback((temaId: string, fecha: string): CodigoEdicion | null => {
    const r = marcarSiguienteHito(estado.eventos, temaId, fecha, {
      hoy: hoyISO(),
      totalRepasos: estado.perfil.intervalosRepaso.length,
      nuevoId,
    });
    if (!r.ok) return r.codigo;
    actualizar((prev) => conHitos(prev, temaId, r.eventos, { limpiarReprogramacion: true }));
    return null;
  }, []);

  const cambiarFechaDeHito = useCallback(
    (temaId: string, indice: number, fecha: string): CodigoEdicion | null => {
      const r = cambiarFechaHito(estado.eventos, temaId, indice, fecha, hoyISO());
      if (!r.ok) return r.codigo;
      actualizar((prev) => conHitos(prev, temaId, r.eventos));
      return null;
    },
    [],
  );

  const desmarcar = useCallback((temaId: string, indice: number) => {
    actualizar((prev) => conHitos(prev, temaId, desmarcarHito(prev.eventos, temaId, indice)));
  }, []);

  /** Mueve el próximo repaso de un tema a otro día, sin marcarlo como hecho. */
  const reprogramarRepaso = useCallback((temaId: string, numeroRepaso: number, fecha: string) => {
    actualizar((prev) => {
      const existente = prev.objetivos.find(
        (o) => esReprogramacion(o) && o.temaId === temaId && o.numeroRepaso === numeroRepaso,
      );
      const objetivos = existente
        ? prev.objetivos.map((o) => (o.id === existente.id ? { ...o, fecha } : o))
        : [
            ...prev.objetivos,
            {
              id: nuevoId(),
              fecha,
              texto: `Repaso ${numeroRepaso}`,
              temaId,
              automatico: true,
              hecho: false,
              tipo: "repaso" as const,
              numeroRepaso,
            },
          ];
      return { ...prev, objetivos };
    });
  }, []);

  const deshacerUltimoHito = useCallback((temaId: string) => {
    actualizar((prev) => {
      const propios = prev.eventos
        .filter((e) => e.temaId === temaId && (e.tipo === "estudiado" || e.tipo === "repaso"))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      const ultimo = propios[propios.length - 1];
      if (!ultimo) return prev;
      const eventos = prev.eventos.filter((e) => e.id !== ultimo.id);
      const quedanRepasos = eventos.some((e) => e.temaId === temaId && e.tipo === "repaso");
      const sigueEstudiado = eventos.some((e) => e.temaId === temaId && e.tipo === "estudiado");
      return {
        ...prev,
        eventos,
        temas: prev.temas.map((t) =>
          t.id === temaId
            ? {
                ...t,
                estadoEstudio: quedanRepasos
                  ? "en_repaso"
                  : sigueEstudiado
                    ? "estudiado"
                    : "por_estudiar",
              }
            : t,
        ),
      };
    });
  }, []);

  const guardarTexto = useCallback(
    (temaId: string, texto: string, estadoContenido: EstadoContenido) => {
      actualizar((prev) => ({
        ...prev,
        temas: prev.temas.map((t) =>
          t.id === temaId ? { ...t, texto, estadoContenido, actualizadoEn: ahoraISO() } : t,
        ),
      }));
    },
    [],
  );

  const renombrarTema = useCallback((temaId: string, titulo: string) => {
    actualizar((prev) => ({
      ...prev,
      temas: prev.temas.map((t) => (t.id === temaId ? { ...t, titulo, actualizadoEn: ahoraISO() } : t)),
    }));
  }, []);

  const anadirObjetivo = useCallback(
    (fecha: string, texto: string, tipo: TipoActividad = "otro", temaId?: string) => {
      actualizar((prev) => ({
        ...prev,
        objetivos: [
          ...prev.objetivos,
          { id: nuevoId(), fecha, texto, temaId, tipo, hecho: false },
        ],
      }));
    },
    [],
  );

  const editarObjetivo = useCallback(
    (id: string, cambios: Partial<Pick<Objetivo, "texto" | "fecha" | "tipo" | "temaId">>) => {
      actualizar((prev) => ({
        ...prev,
        objetivos: prev.objetivos.map((o) => (o.id === id ? { ...o, ...cambios } : o)),
      }));
    },
    [],
  );

  const alternarObjetivo = useCallback((id: string) => {
    actualizar((prev) => ({
      ...prev,
      objetivos: prev.objetivos.map((o) => (o.id === id ? { ...o, hecho: !o.hecho } : o)),
    }));
  }, []);

  const borrarObjetivo = useCallback((id: string) => {
    actualizar((prev) => ({ ...prev, objetivos: prev.objetivos.filter((o) => o.id !== id) }));
  }, []);

  const aplazarObjetivo = useCallback((id: string, aFecha: string) => {
    actualizar((prev) => ({
      ...prev,
      objetivos: prev.objetivos.map((o) =>
        o.id === id ? { ...o, fecha: aFecha, aplazadoDe: o.fecha } : o,
      ),
    }));
  }, []);

  const guardarPerfil = useCallback((cambios: Partial<Perfil>) => {
    actualizar((prev) => ({ ...prev, perfil: { ...prev.perfil, ...cambios } }));
  }, []);

  return useMemo(
    () => ({
      ...estadoActual,
      cargado: listo,
      marcarEstudiado,
      marcarRepaso,
      marcarHito,
      cambiarFechaDeHito,
      desmarcar,
      reprogramarRepaso,
      deshacerUltimoHito,
      guardarTexto,
      renombrarTema,
      anadirObjetivo,
      editarObjetivo,
      alternarObjetivo,
      borrarObjetivo,
      aplazarObjetivo,
      guardarPerfil,
      reiniciar: reiniciarAlmacen,
    }),
    [
      estadoActual,
      listo,
      marcarEstudiado,
      marcarRepaso,
      marcarHito,
      cambiarFechaDeHito,
      desmarcar,
      reprogramarRepaso,
      deshacerUltimoHito,
      guardarTexto,
      renombrarTema,
      anadirObjetivo,
      editarObjetivo,
      alternarObjetivo,
      borrarObjetivo,
      aplazarObjetivo,
      guardarPerfil,
    ],
  );
}

/**
 * Aplica unos eventos nuevos y recalcula el estado del tema a partir de sus
 * hitos, para que la tabla, el planificador y el sorteo digan siempre lo mismo.
 */
function conHitos(
  prev: Estado,
  temaId: string,
  eventos: EventoEstudio[],
  opciones: { limpiarReprogramacion?: boolean } = {},
): Estado {
  const total = prev.perfil.intervalosRepaso.length;
  const estadoEstudio = estadoEstudioDe(eventos, temaId, total);
  const antes = prev.temas.find((t) => t.id === temaId);
  // Completar la vuelta suma una; deshacer el último repaso la resta.
  const delta =
    antes?.estadoEstudio !== "dominado" && estadoEstudio === "dominado"
      ? 1
      : antes?.estadoEstudio === "dominado" && estadoEstudio !== "dominado"
        ? -1
        : 0;

  // Un repaso ya hecho no necesita su reprogramación: se limpia.
  const hechos = new Set(
    eventos.filter((e) => e.temaId === temaId && e.tipo === "repaso").map((e) => e.numeroRepaso),
  );
  const objetivos = opciones.limpiarReprogramacion
    ? prev.objetivos.filter(
        (o) => !(esReprogramacion(o) && o.temaId === temaId && hechos.has(o.numeroRepaso)),
      )
    : prev.objetivos;

  return {
    ...prev,
    eventos,
    objetivos,
    temas: prev.temas.map((t) =>
      t.id === temaId
        ? { ...t, estadoEstudio, vueltas: Math.max(0, t.vueltas + delta), actualizadoEn: ahoraISO() }
        : t,
    ),
  };
}

/** Temas que pueden entrar en prácticas y sorteos: los que tienen contenido. */
export function temasConContenido(temas: Tema[]): Tema[] {
  return temas.filter((t) => t.estadoContenido !== "sin_contenido");
}

// --- Puentes para la sincronización con la nube (src/datos/nube.ts) -------

/** Lee el estado actual fuera de React. */
export function leerEstado(): Estado {
  return estado;
}

/** Reemplaza el estado entero, por ejemplo al fusionar con lo de la cuenta. */
export function reemplazarEstado(nuevo: Estado) {
  actualizar(() => nuevo);
}

/** Avisa de cada cambio del almacén. Devuelve la función para dejar de escuchar. */
export function suscribirAlmacen(escucha: () => void) {
  return suscribir(escucha);
}
