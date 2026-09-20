import { EnConstruccion } from "@/components/en-construccion";

export const metadata = { title: "Repaso de fallos" };

export default function PaginaFallos() {
  return (
    <EnConstruccion
      titulo="Repaso de fallos"
      resumen="Lo que fallas vuelve a aparecer, cada vez más espaciado, hasta que deja de fallarse."
      hara={[
        "Cada fallo se guarda solo, venga de un test, una flashcard, un supuesto o un simulacro.",
        "Cada día tienes una cola con los fallos que vuelven a tocar.",
        "Un fallo se da por superado tras tres aciertos seguidos; si vuelves a fallarlo, empieza de cero.",
        "Lista de fallos más repetidos por tema, para saber qué parte reescribir.",
      ]}
      necesita="Que exista el banco de preguntas, porque la cola se alimenta de lo que fallas practicando. Llega junto con la pantalla de Practicar."
    />
  );
}
