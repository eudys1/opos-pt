import { describe, expect, it } from "vitest";
import {
  apartadosDelTema,
  estructuraDelTema,
  indiceDelTema,
  mapaDeApartados,
  nombreDeApartado,
  textoParaEscuchar,
  ubicarCita,
} from "./estructura";

const TEXTO = `TEMA 3: EL PROCESO DE IDENTIFICACIÓN Y VALORACIÓN DE LAS NECESIDADES
EDUCATIVAS ESPECIALES DE LOS ALUMNOS Y ALUMNAS.
INTRODUCCIÓN
1. EL PROCESO DE IDENTIFICACIÓN
1.1 CONCEPTO Y ENFOQUE
2. DECISIONES DE ESCOLARIZACIÓN

INTRODUCCIÓN
La igualdad de oportunidades supone garantizar una respuesta educativa inclusiva
que respete la diversidad del alumnado.
Desde esta perspectiva, el maestro de Pedagogía Terapéutica
desempeña un papel fundamental.
1 EL PROCESO DE IDENTIFICACIÓN
La identificación es un paso previo.
1.1 CONCEPTO Y ENFOQUE
La evaluación psicopedagógica es el conjunto de actuaciones.
2. DECISIONES DE ESCOLARIZACIÓN
Texto de la parte dos.`;

describe("estructura del tema", () => {
  const bloques = estructuraDelTema(TEXTO);

  it("junta el título que el PDF partió en dos líneas", () => {
    expect(bloques[0]).toMatchObject({ tipo: "titulo" });
    expect(bloques[0].texto).toContain("NECESIDADES EDUCATIVAS ESPECIALES");
  });

  it("vuelve a unir las líneas cortadas a mitad de frase", () => {
    const parrafos = bloques.filter((b) => b.tipo === "parrafo").map((b) => b.texto);
    expect(parrafos).toContain(
      "La igualdad de oportunidades supone garantizar una respuesta educativa inclusiva que respete la diversidad del alumnado.",
    );
    expect(parrafos).toContain(
      "Desde esta perspectiva, el maestro de Pedagogía Terapéutica desempeña un papel fundamental.",
    );
  });

  it("reconoce epígrafes y subepígrafes, con o sin punto tras el número", () => {
    expect(bloques.filter((b) => b.tipo === "subepigrafe").map((b) => b.texto)).toEqual([
      "1.1 CONCEPTO Y ENFOQUE",
      "1.1 CONCEPTO Y ENFOQUE",
    ]);
    expect(bloques.some((b) => b.tipo === "epigrafe" && b.texto === "1 EL PROCESO DE IDENTIFICACIÓN")).toBe(true);
  });

  it("el índice se queda con los epígrafes del cuerpo, no con los del índice inicial", () => {
    const indice = indiceDelTema(bloques);
    const introducciones = indice.filter((b) => b.texto === "INTRODUCCIÓN");
    expect(introducciones).toHaveLength(1);
    const posicion = bloques.findIndex((b) => b.id === introducciones[0].id);
    expect(bloques[posicion + 1].tipo).toBe("parrafo");
  });

  it("los ids no se repiten", () => {
    const ids = bloques.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("una frase que empieza por número no es un epígrafe", () => {
    const b = estructuraDelTema(
      "Texto previo.\n3 de cada 10 alumnos con necesidades educativas especiales están escolarizados en centros ordinarios con apoyos.",
    );
    expect(b.every((x) => x.tipo === "parrafo")).toBe(true);
  });
});

describe("otras formas de numerar", () => {
  it("reconoce 1.-, 1), numeración romana, Markdown y títulos en mayúsculas sin número", () => {
    const b = estructuraDelTema(
      [
        "I. MARCO LEGISLATIVO",
        "Texto del marco.",
        "1.- LA EVALUACIÓN",
        "Texto uno.",
        "1.1) Concepto de evaluación",
        "Texto uno uno.",
        "## Momentos de la evaluación",
        "Texto de los momentos.",
        "ORIENTACIONES METODOLÓGICAS",
        "Texto final.",
      ].join("\n"),
    );
    const titulos = b.filter((x) => x.tipo !== "parrafo").map((x) => `${x.tipo}:${x.texto}`);
    expect(titulos).toEqual([
      "epigrafe:I. MARCO LEGISLATIVO",
      "epigrafe:1.- LA EVALUACIÓN",
      "subepigrafe:1.1) Concepto de evaluación",
      "subepigrafe:Momentos de la evaluación",
      "epigrafe:ORIENTACIONES METODOLÓGICAS",
    ]);
  });

  it("una frase en mayúsculas dentro de un párrafo sin acabar no se convierte en título", () => {
    const b = estructuraDelTema("La ley establece que\nTODOS LOS ALUMNOS TIENEN DERECHO\na una educación de calidad.");
    expect(b.every((x) => x.tipo === "parrafo")).toBe(true);
  });
});

describe("apartados", () => {
  it("cada apartado lleva su número como id y su nivel", () => {
    const apartados = apartadosDelTema(TEXTO);
    expect(apartados.map((a) => `${a.id}|${a.nivel}|${a.titulo}`)).toEqual([
      "introduccion|1|INTRODUCCIÓN",
      "1|1|EL PROCESO DE IDENTIFICACIÓN",
      "1.1|2|CONCEPTO Y ENFOQUE",
      "2|1|DECISIONES DE ESCOLARIZACIÓN",
    ]);
  });

  it("una cita pertenece a su subapartado y al apartado que lo contiene", () => {
    const { deCita } = mapaDeApartados(TEXTO);
    expect(deCita("La evaluación psicopedagógica es el conjunto de actuaciones")).toEqual(["1.1", "1"]);
    expect(deCita("garantizar una respuesta educativa inclusiva")).toEqual(["introduccion"]);
    expect(deCita("los dinosaurios vivieron en el cretácico")).toEqual([]);
  });

  it("nombra lo guardado aunque el apartado ya no exista", () => {
    const apartados = apartadosDelTema(TEXTO);
    expect(nombreDeApartado(apartados, "1.1")).toBe("1.1 CONCEPTO Y ENFOQUE");
    expect(nombreDeApartado(apartados, "7.3")).toBe("7.3");
  });
});

describe("texto para escuchar", () => {
  it("empieza por el título, se salta el índice y deja fuera bibliografía y webs", () => {
    const texto = `${TEXTO}
5.2 REFERENCIAS BIBLIOGRÁFICAS
Ainscow, M. (2001). Desarrollo de escuelas inclusivas. Madrid: Narcea.
5.3 REFERENCIAS DE MEDIOS DIGITALES
https:// www.juntadeandalucia.es`;
    const oido = textoParaEscuchar(texto);
    expect(oido.startsWith("TEMA 3:")).toBe(true);
    // El índice inicial no se lee: "DECISIONES DE ESCOLARIZACIÓN" solo una vez.
    expect(oido.match(/DECISIONES DE ESCOLARIZACIÓN/g)).toHaveLength(1);
    expect(oido).toContain("La igualdad de oportunidades");
    expect(oido).not.toContain("Ainscow");
    expect(oido).not.toContain("juntadeandalucia");
  });
});

describe("ubicarCita", () => {
  const bloques = estructuraDelTema(TEXTO);

  it("encuentra el párrafo aunque cambien tildes y signos", () => {
    const sitio = ubicarCita(bloques, "la evaluacion psicopedagogica es el conjunto de actuaciones");
    expect(sitio?.bloque.texto).toContain("La evaluación psicopedagógica");
    expect(sitio?.epigrafe?.texto).toContain("1.1 CONCEPTO");
  });

  it("vale con un trozo cuando la cita viene recortada con puntos suspensivos", () => {
    const sitio = ubicarCita(bloques, "…garantizar una respuesta educativa inclusiva…");
    expect(sitio?.bloque.texto).toContain("La igualdad de oportunidades");
    expect(sitio?.epigrafe?.texto).toBe("INTRODUCCIÓN");
  });

  it("no manda a ningún sitio si la cita no se parece a nada", () => {
    expect(ubicarCita(bloques, "los dinosaurios vivieron en el cretácico superior")).toBeNull();
  });
});
