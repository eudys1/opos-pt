/**
 * La rúbrica con la que nace un supuesto que no trae la suya. La usan la
 * pantalla de Supuestos y `npm run supuestos`: una sola copia, para que un
 * cambio de pesos valga igual venga el supuesto de donde venga.
 */
export const RUBRICA_POR_DEFECTO = [
  { criterio: "Fundamentación normativa", peso: 25, queSeEspera: "Normativa aplicable y bien citada." },
  { criterio: "Valoración del caso", peso: 20, queSeEspera: "Análisis de las necesidades del alumno." },
  { criterio: "Medidas y recursos", peso: 30, queSeEspera: "Medidas concretas, realistas y justificadas." },
  { criterio: "Evaluación y seguimiento", peso: 15, queSeEspera: "Cómo se evalúa y se revisa lo propuesto." },
  { criterio: "Expresión y estructura", peso: 10, queSeEspera: "Orden, claridad y corrección al escribir." },
];
