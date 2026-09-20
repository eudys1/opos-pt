/** Tipos del dominio. No dependen de React ni de la base de datos. */

/** Qué contenido tiene un tema. Gobierna lo que la app puede y no puede ofrecer. */
export type EstadoContenido = "sin_contenido" | "borrador_ia" | "parcial" | "completo";

/** Por dónde va el estudio de un tema. */
export type EstadoEstudio = "por_estudiar" | "estudiado" | "en_repaso" | "dominado";

export type Tema = {
  id: string;
  numero: number;
  /** Título oficial, editable por si la transcripción del BOE no cuadra. */
  titulo: string;
  estadoContenido: EstadoContenido;
  estadoEstudio: EstadoEstudio;
  /** Texto de los apuntes ya revisado. Vacío mientras no haya contenido. */
  texto: string;
  /** Vueltas completas al temario en las que este tema ya se ha trabajado. */
  vueltas: number;
  actualizadoEn: string;
};

export type TipoEvento =
  | "estudiado"
  | "repaso"
  | "practica"
  | "supuesto"
  | "simulacro"
  | "cantar";

export type EventoEstudio = {
  id: string;
  temaId?: string;
  tipo: TipoEvento;
  /** Número de repaso (1, 2, 3…) cuando `tipo` es "repaso". */
  numeroRepaso?: number;
  /** Fecha en formato AAAA-MM-DD, hora local. */
  fecha: string;
  minutos?: number;
  nota?: string;
};

export type Objetivo = {
  id: string;
  fecha: string;
  texto: string;
  temaId?: string;
  /** Lo genera la app a partir de los repasos que tocan ese día. */
  automatico?: boolean;
  hecho: boolean;
  aplazadoDe?: string;
};

export type ConfiguracionExamen = {
  /** Cuántos temas salen en el sorteo. En Andalucía, 2. */
  temasSorteados: number;
  supuestosSorteados: number;
  minutosSoloTema: number;
  minutosSoloSupuesto: number;
  minutosExamenCompleto: number;
  /** Temas estudiados necesarios para desbloquear los simulacros. */
  minimoTemasParaSimulacro: number;
};

export type Perfil = {
  id: string;
  nombre: string;
  especialidad: string;
  comunidad: string;
  /** Fecha estimada del examen, en AAAA-MM-DD. Ajustable al salir la convocatoria. */
  fechaExamen?: string;
  intervalosRepaso: number[];
  diasLibresAlMes: number;
  examen: ConfiguracionExamen;
};

export const CONFIGURACION_ANDALUCIA: ConfiguracionExamen = {
  temasSorteados: 2,
  supuestosSorteados: 3,
  minutosSoloTema: 135,
  minutosSoloSupuesto: 135,
  minutosExamenCompleto: 270,
  minimoTemasParaSimulacro: 10,
};

export const INTERVALOS_POR_DEFECTO = [1, 3, 7, 15, 30];
