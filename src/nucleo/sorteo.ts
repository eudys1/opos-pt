/**
 * El sorteo del examen.
 *
 * Dos reglas que vienen del plan y no se tocan sin hablarlo:
 *   - Solo entran en el bombo los temas que ya se han estudiado.
 *   - Los supuestos salen VARIADOS entre sí y sin etiquetas a la vista, como en
 *     el examen: quien se examina no sabe de qué va cada uno hasta leerlo.
 *
 * El "modo trampa" es la única excepción declarada: pondera a favor de los temas
 * más flojos para practicar justo lo que menos se sabe. Se avisa antes de usarlo.
 */

export type TemaSorteable = {
  id: string;
  numero: number;
  titulo: string;
  /** 0 a 1. Cuanto más bajo, peor se lleva el tema. */
  dominio?: number;
};

export type SupuestoSorteable = {
  id: string;
  titulo: string;
  necesidad?: string | null;
  curso?: string | null;
  temas?: number[];
};

/** Azar inyectable: en las pruebas se pasa uno determinista. */
export type Azar = () => number;

export function sortearTemas(
  disponibles: TemaSorteable[],
  cuantos: number,
  opciones: { trampa?: boolean; azar?: Azar } = {},
): TemaSorteable[] {
  const azar = opciones.azar ?? Math.random;
  if (disponibles.length <= cuantos) return [...disponibles];

  if (!opciones.trampa) {
    return elegirSinRepetir(disponibles, cuantos, azar);
  }

  // Modo trampa: el peso crece cuanto peor se lleva el tema. Un tema sin datos
  // de dominio se considera flojo, porque no se ha practicado.
  const pesos = disponibles.map((tema) => 1 + 3 * (1 - (tema.dominio ?? 0)));
  return elegirPorPeso(disponibles, pesos, cuantos, azar);
}

/**
 * Tres supuestos lo más distintos posible: primero uno al azar y después los que
 * más lejos quedan de los ya elegidos (necesidad, curso y temas que tocan).
 */
export function sortearSupuestos(
  disponibles: SupuestoSorteable[],
  cuantos: number,
  opciones: { azar?: Azar } = {},
): SupuestoSorteable[] {
  const azar = opciones.azar ?? Math.random;
  if (disponibles.length <= cuantos) return [...disponibles];

  const restantes = [...disponibles];
  const elegidos: SupuestoSorteable[] = [];

  const primero = Math.floor(azar() * restantes.length);
  elegidos.push(restantes.splice(primero, 1)[0]);

  while (elegidos.length < cuantos && restantes.length > 0) {
    let mejor = 0;
    let mejorDistancia = -1;
    restantes.forEach((candidato, i) => {
      const distancia = Math.min(...elegidos.map((e) => distanciaEntre(e, candidato)));
      if (distancia > mejorDistancia) {
        mejorDistancia = distancia;
        mejor = i;
      }
    });
    elegidos.push(restantes.splice(mejor, 1)[0]);
  }

  // Se barajan para que el orden no delate cómo se han elegido.
  return elegirSinRepetir(elegidos, elegidos.length, azar);
}

/** 0 = iguales, 3 = no se parecen en nada. */
export function distanciaEntre(a: SupuestoSorteable, b: SupuestoSorteable): number {
  let distancia = 0;
  if (normalizar(a.necesidad) !== normalizar(b.necesidad)) distancia += 1.5;
  if (normalizar(a.curso) !== normalizar(b.curso)) distancia += 1;
  const temasA = new Set(a.temas ?? []);
  const comunes = (b.temas ?? []).filter((t) => temasA.has(t)).length;
  if (comunes === 0) distancia += 0.5;
  return distancia;
}

/**
 * Probabilidad de que al menos uno de los `cuantos` temas sorteados sea de los
 * que se dominan. Sirve para saber cuánto falta para ir con red.
 */
export function probabilidadDeDominado(
  totalEstudiados: number,
  dominados: number,
  cuantos: number,
): number {
  if (totalEstudiados <= 0 || cuantos <= 0) return 0;
  if (dominados >= totalEstudiados) return 1;
  const sinDominar = totalEstudiados - dominados;
  if (sinDominar < cuantos) return 1;
  const probabilidadDeNinguno =
    combinaciones(sinDominar, cuantos) / combinaciones(totalEstudiados, cuantos);
  return Math.round((1 - probabilidadDeNinguno) * 1000) / 1000;
}

function combinaciones(n: number, k: number): number {
  if (k > n) return 0;
  let resultado = 1;
  for (let i = 1; i <= k; i += 1) {
    resultado = (resultado * (n - k + i)) / i;
  }
  return resultado;
}

function elegirSinRepetir<T>(lista: T[], cuantos: number, azar: Azar): T[] {
  const copia = [...lista];
  const elegidos: T[] = [];
  while (elegidos.length < cuantos && copia.length > 0) {
    const i = Math.floor(azar() * copia.length);
    elegidos.push(copia.splice(i, 1)[0]);
  }
  return elegidos;
}

function elegirPorPeso<T>(lista: T[], pesos: number[], cuantos: number, azar: Azar): T[] {
  const restantes = lista.map((elemento, i) => ({ elemento, peso: pesos[i] }));
  const elegidos: T[] = [];

  while (elegidos.length < cuantos && restantes.length > 0) {
    const total = restantes.reduce((suma, r) => suma + r.peso, 0);
    let tirada = azar() * total;
    let indice = restantes.length - 1;
    for (let i = 0; i < restantes.length; i += 1) {
      tirada -= restantes[i].peso;
      if (tirada <= 0) {
        indice = i;
        break;
      }
    }
    elegidos.push(restantes.splice(indice, 1)[0].elemento);
  }

  return elegidos;
}

function normalizar(valor?: string | null): string {
  return (valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
