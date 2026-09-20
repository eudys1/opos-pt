"use client";

import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { TEMARIO_PT } from "@/contenido/temario-pt";
import { hoyISO } from "@/nucleo/fechas";
import { proximoNumeroDeRepaso } from "@/nucleo/repasos";
import {
  CONFIGURACION_ANDALUCIA,
  INTERVALOS_POR_DEFECTO,
  type EstadoContenido,
  type EventoEstudio,
  type Objetivo,
  type Perfil,
  type Tema,
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
      actualizadoEn: hoyISO(),
    })),
    eventos: [],
    objetivos: [],
  };
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

function suscribir(escucha: () => void) {
  const eraPrimera = !cargado;
  cargarDelNavegador();
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
          t.id === temaId ? { ...t, estadoEstudio: "estudiado", actualizadoEn: fecha } : t,
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
                actualizadoEn: fecha,
              }
            : t,
        ),
      };
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
          t.id === temaId ? { ...t, texto, estadoContenido, actualizadoEn: hoyISO() } : t,
        ),
      }));
    },
    [],
  );

  const renombrarTema = useCallback((temaId: string, titulo: string) => {
    actualizar((prev) => ({
      ...prev,
      temas: prev.temas.map((t) => (t.id === temaId ? { ...t, titulo } : t)),
    }));
  }, []);

  const anadirObjetivo = useCallback((fecha: string, texto: string, temaId?: string) => {
    actualizar((prev) => ({
      ...prev,
      objetivos: [...prev.objetivos, { id: nuevoId(), fecha, texto, temaId, hecho: false }],
    }));
  }, []);

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
      deshacerUltimoHito,
      guardarTexto,
      renombrarTema,
      anadirObjetivo,
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
      deshacerUltimoHito,
      guardarTexto,
      renombrarTema,
      anadirObjetivo,
      alternarObjetivo,
      borrarObjetivo,
      aplazarObjetivo,
      guardarPerfil,
    ],
  );
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
