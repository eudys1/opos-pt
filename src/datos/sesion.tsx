"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { clienteNavegador, hayNube } from "@/datos/supabase";
import { leerEstado, reemplazarEstado, suscribirAlmacen } from "@/datos/almacen";
import { huellaDeTema } from "@/nucleo/sincronia";
import {
  borrarEventoEnLaNube,
  borrarObjetivoEnLaNube,
  guardarEnLaNube,
  sincronizar,
} from "@/datos/nube";

/**
 * Sesión y sincronización.
 *
 * El almacén local sigue siendo el que pinta la pantalla, para que la app vaya
 * rápida y funcione sin conexión. Cuando hay sesión, al entrar se fusiona con lo
 * de la cuenta y a partir de ahí cada cambio se sube con un respiro de segundo y
 * medio, para no mandar una petición por cada tecla.
 */

const RESPIRO_MS = 1500;

export type EstadoNube =
  | "sin-nube" // no hay claves configuradas
  | "sin-sesion"
  | "sincronizando"
  | "guardado"
  | "error";

type Valor = {
  usuario: User | null;
  /** true mientras aún no se sabe si hay sesión: evita enseñar la puerta y luego la app. */
  comprobando: boolean;
  /**
   * true cuando este navegador ya se ha juntado con la cuenta. Hasta entonces,
   * el texto de un tema en pantalla puede ser viejo o estar vacío: ningún
   * editor debe dejar guardar antes (así se perdieron los temas 3 y 4).
   */
  alDia: boolean;
  estadoNube: EstadoNube;
  mensaje: string;
  salir: () => Promise<void>;
  cliente: SupabaseClient | null;
};

const Contexto = createContext<Valor>({
  usuario: null,
  comprobando: true,
  alDia: false,
  estadoNube: "sin-nube",
  mensaje: "",
  salir: async () => {},
  cliente: null,
});

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const cliente = useMemo(() => (hayNube() ? clienteNavegador() : null), []);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [comprobando, setComprobando] = useState(hayNube());
  const [alDia, setAlDia] = useState(false);
  const [estadoNube, setEstadoNube] = useState<EstadoNube>(hayNube() ? "sin-sesion" : "sin-nube");
  const [mensaje, setMensaje] = useState("");

  // Dos marcas distintas, a propósito. `sincronizado`: ya se ha LANZADO la
  // primera fusión (para no lanzarla dos veces). `puedeSubir`: ya ha
  // TERMINADO. Antes solo existía la primera, y un cambio hecho mientras la
  // fusión seguía en camino subía los temas vacíos del navegador.
  const sincronizado = useRef(false);
  const puedeSubir = useRef(false);
  // Cómo estaba cada tema la última vez que se subió: solo se sube lo que cambie.
  const huellasTemas = useRef<Map<string, string>>(new Map());
  const idsPrevios = useRef<{ eventos: Set<string>; objetivos: Set<string> }>({
    eventos: new Set(),
    objetivos: new Set(),
  });

  // Quién está dentro.
  useEffect(() => {
    if (!cliente) return;
    let vivo = true;

    // Primero la sesión guardada en el navegador: es inmediata y deja pintar
    // la app sin esperar a la red. Luego se confirma con el servidor de
    // Supabase (una ida y vuelta de unos 100 ms); si no la da por buena, se
    // cierra. Los datos están protegidos igual: la RLS y las rutas de la API
    // comprueban la sesión en el servidor, no se fían de esto.
    cliente.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setUsuario(data.session?.user ?? null);
      setComprobando(false);
      cliente.auth.getUser().then(({ data: confirmado }) => {
        if (vivo && !confirmado.user) setUsuario(null);
      });
    });

    const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario(sesion?.user ?? null);
      setComprobando(false);
      if (!sesion?.user) {
        sincronizado.current = false;
        puedeSubir.current = false;
      }
    });

    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [cliente]);

  // Primera fusión al entrar.
  useEffect(() => {
    if (!cliente || !usuario || sincronizado.current) return;
    sincronizado.current = true;
    setEstadoNube("sincronizando");

    sincronizar(cliente, usuario.id, leerEstado())
      .then(({ estado, subidos }) => {
        reemplazarEstado(estado);
        huellasTemas.current = new Map(estado.temas.map((t) => [t.id, huellaDeTema(t)]));
        idsPrevios.current = {
          eventos: new Set(estado.eventos.map((e) => e.id)),
          objetivos: new Set(estado.objetivos.map((o) => o.id)),
        };
        const total = subidos.eventos + subidos.objetivos;
        setMensaje(
          total > 0
            ? `Se subieron ${total} marcas que estaban solo en este dispositivo.`
            : "Al día con tu cuenta.",
        );
        setEstadoNube("guardado");
        puedeSubir.current = true;
        setAlDia(true);
      })
      .catch((error: unknown) => {
        // Sin fusión no se sube nada: se reintenta al recargar.
        sincronizado.current = false;
        setEstadoNube("error");
        setMensaje(error instanceof Error ? error.message : "No se ha podido sincronizar.");
      });
  }, [cliente, usuario]);

  // Cada cambio posterior sube con un respiro.
  useEffect(() => {
    if (!cliente || !usuario) return;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const dejarDeEscuchar = suscribirAlmacen(() => {
      if (!puedeSubir.current) return;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(async () => {
        const estado = leerEstado();
        setEstadoNube("sincronizando");
        try {
          // Lo borrado aquí se borra también en la cuenta.
          const eventosAhora = new Set(estado.eventos.map((e) => e.id));
          const objetivosAhora = new Set(estado.objetivos.map((o) => o.id));
          for (const id of idsPrevios.current.eventos) {
            if (!eventosAhora.has(id)) await borrarEventoEnLaNube(cliente, id);
          }
          for (const id of idsPrevios.current.objetivos) {
            if (!objetivosAhora.has(id)) await borrarObjetivoEnLaNube(cliente, id);
          }

          const cambiados = new Set(
            estado.temas
              .filter((t) => huellasTemas.current.get(t.id) !== huellaDeTema(t))
              .map((t) => t.id),
          );
          await guardarEnLaNube(cliente, usuario.id, estado, cambiados);
          for (const t of estado.temas) {
            if (cambiados.has(t.id)) huellasTemas.current.set(t.id, huellaDeTema(t));
          }
          idsPrevios.current = { eventos: eventosAhora, objetivos: objetivosAhora };
          setMensaje("");
          setEstadoNube("guardado");
        } catch (error: unknown) {
          setEstadoNube("error");
          setMensaje(
            error instanceof Error ? error.message : "No se ha podido guardar en tu cuenta.",
          );
        }
      }, RESPIRO_MS);
    });

    return () => {
      if (temporizador) clearTimeout(temporizador);
      dejarDeEscuchar();
    };
  }, [cliente, usuario]);

  const salir = useCallback(async () => {
    if (!cliente) return;
    await cliente.auth.signOut();
    setUsuario(null);
    setAlDia(false);
    setEstadoNube("sin-sesion");
    setMensaje("");
  }, [cliente]);

  const valor = useMemo(
    () => ({ usuario, comprobando, alDia, estadoNube, mensaje, salir, cliente }),
    [usuario, comprobando, alDia, estadoNube, mensaje, salir, cliente],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}
