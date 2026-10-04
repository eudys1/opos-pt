/**
 * La consigna con la que acaban los supuestos del examen de PT en Andalucía
 * (convocatorias de 2019 y 2025). Es siempre la misma: el examen no plantea
 * cuestiones sueltas, pide una intervención completa. La añade el código al
 * final de cada supuesto generado, para que salga idéntica, sin depender de
 * que la IA la copie bien.
 */
export const CONSIGNA_ANDALUCIA =
  "PLANTEE UNA INTERVENCIÓN RAZONADA Y FUNDAMENTADA DENTRO DEL MARCO TEÓRICO EN RELACIÓN CON EL CURRÍCULO VIGENTE DE LA ESPECIALIDAD DE LA COMUNIDAD AUTÓNOMA DE ANDALUCÍA, ASÍ COMO UNA PROPUESTA DIDÁCTICA Y ORGANIZATIVA, QUE PERMITA AL TRIBUNAL COMPROBAR SU FORMACIÓN CIENTÍFICA Y EL DOMINIO DE LAS ESTRATEGIAS DOCENTES COMO MAESTRO/A DE PEDAGOGÍA TERAPÉUTICA.";

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
