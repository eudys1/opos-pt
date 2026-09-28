"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Lo último que se leyó de la cuenta, para no pintar una pantalla vacía cada
 * vez que se vuelve a ella.
 *
 * Sin esto, al ir a otra sección y volver, la pantalla nacía sin datos, se
 * pintaba con ceros y un momento después saltaba al llegar la respuesta: el
 * titular cambiaba, aparecían tarjetas y todo se movía. Ahora se pinta al
 * instante con lo que ya se sabía y se actualiza por detrás; solo cambia algo
 * si de verdad ha cambiado.
 *
 * Vive en memoria (se pierde al recargar la página). Cada pantalla mete el id
 * del usuario en su clave, así que otra cuenta en la misma pestaña nunca ve lo
 * de la anterior.
 */

const recuerdo = new Map<string, unknown>();

/** Lo que haya guardado para esa clave, sin pedir nada. */
export function recordado<T>(clave: string | null): T | undefined {
  return clave ? (recuerdo.get(clave) as T | undefined) : undefined;
}

/**
 * Olvida lo recordado cuyas claves empiezan por `prefijo`. Para cuando se sabe
 * que ha cambiado algo que otra pantalla enseña (entregar un simulacro): así
 * al volver no se ve un instante lo de antes.
 */
export function olvidar(prefijo: string) {
  for (const clave of [...recuerdo.keys()]) if (clave.startsWith(prefijo)) recuerdo.delete(clave);
}

/**
 * Pide los datos con `cargar` y los guarda bajo `clave`. Mientras llegan,
 * devuelve lo recordado de la última vez (o undefined la primera). Con
 * `clave` null no hace nada: sirve para esperar a tener sesión.
 */
export function useRecordado<T>(
  clave: string | null,
  cargar: () => Promise<T>,
  dependencias: unknown[] = [],
): { datos: T | undefined; listo: boolean; error: string; recargar: () => void } {
  const [datos, setDatos] = useState<T | undefined>(() => recordado<T>(clave));
  // Listo en cuanto hay algo que enseñar, o el primer intento ha terminado
  // aunque haya fallado: una pantalla nunca se queda esperando para siempre.
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState("");
  const [claveVista, setClaveVista] = useState(clave);
  const [vuelta, setVuelta] = useState(0);

  // Si cambia la clave (otra cuenta, otro filtro), se enseña lo recordado de
  // la nueva al momento, sin arrastrar lo de la anterior.
  if (clave !== claveVista) {
    setClaveVista(clave);
    setDatos(recordado<T>(clave));
    setIntentado(false);
  }

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    void cargar().then(
      (nuevos) => {
        recuerdo.set(clave, nuevos);
        if (!vivo) return;
        setDatos(nuevos);
        setIntentado(true);
        setError("");
      },
      (fallo: unknown) => {
        // Si falla, se queda lo que había (mejor un dato de hace un rato que
        // una pantalla vacía) y la pantalla recibe el motivo para decirlo.
        if (!vivo) return;
        setIntentado(true);
        setError(fallo instanceof Error ? fallo.message : String(fallo));
      },
    );
    return () => {
      vivo = false;
    };
    // `cargar` cambia en cada render; lo que decide cuándo pedir es la clave,
    // las dependencias que pase cada pantalla y las recargas pedidas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, vuelta, ...dependencias]);

  // Estable entre renders: las pantallas lo pasan a otros useCallback.
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, listo: datos !== undefined || intentado, error, recargar };
}
