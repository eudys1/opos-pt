import { EnConstruccion } from "@/components/en-construccion";

export const metadata = { title: "Practicar" };

export default function PaginaPracticar() {
  return (
    <EnConstruccion
      titulo="Practicar"
      resumen="Tests, preguntas cortas y flashcards salidas de tus propios apuntes, tema a tema."
      hara={[
        "Eliges los temas y el tipo de práctica; solo aparecen los temas que tienen contenido.",
        "Los tests se corrigen al momento, con la explicación y la parte de tu tema de la que salen.",
        "Las preguntas cortas las corrige la IA: qué está bien, qué falta y qué está mal.",
        "Las flashcards de legislación te dan el nombre de la norma y tú completas de qué va y qué regula.",
        "Todo lo que falles entra solo en la cola de repaso de fallos.",
      ]}
      necesita="Conectar la lectura de tus apuntes y la generación del banco de preguntas, que es la fase 2 del plan. Hace falta la clave de la API y tener al menos un tema subido."
    />
  );
}
