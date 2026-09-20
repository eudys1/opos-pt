import { EnConstruccion } from "@/components/en-construccion";

export const metadata = { title: "Supuestos prácticos" };

export default function PaginaSupuestos() {
  return (
    <EnConstruccion
      titulo="Supuestos prácticos"
      resumen="Un banco de supuestos para practicar sueltos y para que salgan en los simulacros."
      hara={[
        "Los tuyos: subes enunciados de academia o de convocatorias anteriores, por foto o como texto.",
        "Los que crea la IA a partir de tu temario y de la normativa, con sus cuestiones y su rúbrica.",
        "Los compartidos, si en algún momento lo usa más gente de tu especialidad.",
        "Puedes practicar uno sin cronómetro y comparar después con una respuesta modelo.",
        "En los simulacros salen sin etiquetas ni pistas, variados entre sí, como en el examen.",
      ]}
      necesita="La fase 3 del plan. Necesita tu temario subido para generar supuestos que encajen con lo que estudias."
    />
  );
}
