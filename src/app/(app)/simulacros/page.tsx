import { EnConstruccion } from "@/components/en-construccion";

export const metadata = { title: "Simulacros" };

export default function PaginaSimulacros() {
  return (
    <EnConstruccion
      titulo="Simulacros"
      resumen="El examen ensayado tal y como es en Andalucía: cuatro horas y media seguidas y sin avisos."
      hara={[
        "Tres modalidades: solo tema, solo supuesto o examen completo con las dos partes.",
        "Sorteo al azar entre los temas que ya has estudiado: te salen dos y eliges uno.",
        "Cronómetro sin alertas de ningún tipo, que sigue corriendo aunque cierres la página.",
        "Entregas escribiendo en la app o haciendo fotos de tus folios.",
        "Corrección por partes, con nota orientativa, lo que falta, los errores y las faltas de ortografía.",
        "Modo trampa opcional: el sorteo prioriza tus temas más flojos.",
      ]}
      necesita="La fase 4 del plan, y tener al menos diez temas estudiados para que el sorteo tenga sentido. También el banco de supuestos, para la parte práctica."
    />
  );
}
