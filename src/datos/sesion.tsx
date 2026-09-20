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
  estadoNube: EstadoNube;
  mensaje: string;
  salir: () => Promise<void>;
  cliente: SupabaseClient | null;
};

const Contexto = createContext<Valor>({
  usuario: null,
  estadoNube: "sin-nube",
  mensaje: "",
  salir: async () => {},
  cliente: null,
});

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const cliente = useMemo(() => (hayNube() ? clienteNavegador() : null), []);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [estadoNube, setEstadoNube] = useState<EstadoNube>(hayNube() ? "sin-sesion" : "sin-nube");
  const [mensaje, setMensaje] = useState("");

  const sincronizado = useRef(false);
  const idsPrevios = useRef<{ eventos: Set<string>; objetivos: Set<string> }>({
    eventos: new Set(),
    objetivos: new Set(),
  });

  // Quién está dentro.
  useEffect(() => {
    if (!cliente) return;
    let vivo = true;

    cliente.auth.getUser().then(({ data }) => {
      if (vivo) setUsuario(data.user ?? null);
    });

    const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario(sesion?.user ?? null);
      if (!sesion?.user) sincronizado.current = false;
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
      })
      .catch((error: unknown) => {
        setEstadoNube("error");
        setMensaje(error instanceof Error ? error.message : "No se ha podido sincronizar.");
      });
  }, [cliente, usuario]);

  // Cada cambio posterior sube con un respiro.
  useEffect(() => {
    if (!cliente || !usuario) return;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const dejarDeEscuchar = suscribirAlmacen(() => {
      if (!sincronizado.current) return;
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

          await guardarEnLaNube(cliente, usuario.id, estado);
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
    setEstadoNube("sin-sesion");
    setMensaje("");
  }, [cliente]);

  const valor = useMemo(
    () => ({ usuario, estadoNube, mensaje, salir, cliente }),
    [usuario, estadoNube, mensaje, salir, cliente],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}
