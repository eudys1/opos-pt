# Cuaderno

App de estudio para la oposición al Cuerpo de Maestros, especialidad **Educación Especial:
Pedagogía Terapéutica**, en Andalucía. Parte de tu propio temario: registra lo que estudias,
programa los repasos, te pregunta, guarda tus fallos, te pone supuestos y te sienta delante de un
examen cronometrado.

## Arrancar

```bash
npm install
npm run dev
```

La app queda en http://localhost:3000. Sin ninguna clave funciona el registro de estudio, el
planificador y el progreso, guardando en este navegador. Con las claves de Supabase y Anthropic se
desbloquean la cuenta, la lectura de apuntes, las preguntas, los supuestos y los simulacros.

Otros comandos:

```bash
npm test            # 60 pruebas de la lógica: repasos, racha, fallos, sorteo, normas, rúbricas
npm run build       # compilación de producción (comprueba tipos)
npm run probar:nube # prueba la sincronización contra la base de datos real
npx tsx scripts/probar-lectura.mts   # prueba la lectura de apuntes contra la API (unos céntimos)
```

## Qué hace

| Apartado | Qué hace | Necesita |
| --- | --- | --- |
| Mi temario | Los 25 títulos oficiales. Subes fotos o PDF y se leen solos; revisas el texto antes de guardarlo. También escuchar el tema en voz alta. | cuenta + IA para leer |
| Registro de estudio | Temas por repasos, con fechas, colores, vueltas al temario y racha. | nada |
| Practicar | Tests, preguntas cortas, flashcards y legislación, sacados de tus apuntes. | cuenta + IA |
| Repaso de fallos | Cola diaria con intervalos crecientes; un fallo se supera tras tres aciertos seguidos. | cuenta |
| Supuestos | Banco propio, generado con IA o compartido, con rúbrica y corrección. | cuenta + IA |
| Simulacros | Solo tema, solo supuesto o examen completo, con cronómetro sin avisos y corrección por partes. | cuenta + IA |
| Planificador | Objetivos por día, semana a semana, con los repasos que tocan. | nada |
| Mi progreso | Cuenta atrás, racha, actividad, mapa del temario, aciertos, fallos y notas de simulacro. | nada (las últimas, cuenta) |
| Normativa | Detecta las leyes citadas en tus temas y comprueba si siguen vigentes, a botón. | cuenta + IA |

## Conectar la nube (Supabase)

1. Crear una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (plan gratuito).
2. En **Project Settings → API Keys**, copiar el `Project URL` y la **publishable key**
   (`sb_publishable_…`; en proyectos antiguos se llamaba `anon public`). La **secret key** no hace
   falta para la app y no debe acabar en el navegador.
3. Copiar `.env.example` como `.env.local` y pegar esos dos valores, más la clave de Anthropic.
4. En **SQL Editor**, ejecutar **en orden** los archivos de `supabase/migrations/`:
   `0001_fase1.sql`, `0002_apuntes.sql`, `0003_banco.sql`, `0004_supuestos.sql`,
   `0005_simulacros.sql` y `0006_normativa.sql`.
5. En **Authentication → URL Configuration**, poner `http://localhost:3000` como *Site URL* y añadir
   `http://localhost:3000/**` a *Redirect URLs*.
6. Reiniciar `npm run dev` y entrar en `/entrar`.

Todas las tablas llevan **RLS**: cada persona solo lee y escribe sus propias filas. La única
excepción a propósito son los supuestos marcados como compartidos, que otras personas de la misma
especialidad pueden leer, no editar.

La sincronización funciona así: el navegador es quien pinta la pantalla, así que la app va rápida y
aguanta sin conexión; al entrar se fusiona con la cuenta —las marcas y los objetivos se unen por id
y de cada tema se queda la versión modificada más tarde— y después cada cambio sube solo.

## Coste de la IA

Cada llamada queda registrada en la tabla `uso_ia` con su coste estimado, y hay un tope mensual por
persona (`LIMITE_IA_MENSUAL`, 15 $ por defecto) que corta antes de gastar de más.

Medido de verdad, no estimado: **leer una página cuesta unos 0,7 céntimos**, así que un temario de
25 temas sale por unos pocos euros. Los modelos se eligen por tarea en `src/ia/cliente.ts` y se
pueden cambiar por entorno (`MODELO_LECTURA`, `MODELO_BANCO`, `MODELO_CORRECCION`, `MODELO_EXAMEN`).

## Cómo está organizado

```
src/
  app/
    page.tsx            portada pública
    entrar/             acceso por enlace al correo
    (app)/              la app: temario, registro, practicar, fallos, supuestos,
                        simulacros, planificador, progreso y normativa
    api/                rutas de servidor: son las únicas que ven la clave de IA
  components/           piezas de interfaz del sistema de diseño
  contenido/            los 25 títulos oficiales y su procedencia
  datos/                almacén local, sesión, sincronización y cola de fallos
  ia/                   prompts y llamadas a la API, una por tarea
  nucleo/               lógica pura, sin React ni base de datos
supabase/migrations/    esquema de la base de datos
```

La regla que ordena el resto: **`src/nucleo` no sabe nada de React ni de la base de datos**, así que
se puede probar con `npm test` y no cambia al tocar la nube.

## Decisiones que conviene no deshacer sin hablarlo

- **El cronómetro de los simulacros no avisa.** Ni alertas, ni sonidos, ni hitos. Se puede ver el
  tiempo restante, el transcurrido, solo la hora u ocultarlo. En el examen tampoco avisa nadie.
- **La app nunca inventa contenido de un tema que no está subido.** Cada tema tiene su estado y la
  franja de cobertura lo dice siempre. Un borrador generado por IA se marca como tal en todas partes.
- **Cada pregunta guarda la cita literal de los apuntes de la que sale**, y las que no se pueden
  comprobar contra el texto se descartan antes de guardarlas.
- **Los repasos se cuentan desde el último repaso hecho**, no desde la fecha teórica.
- **Los supuestos salen sin etiquetas en los sorteos**, y variados entre sí.
- **Las notas se recalculan en local** ponderando por los pesos de la rúbrica, sin fiarse de la
  media que devuelva el modelo.

## Datos oficiales

- Temario: Orden de 9 de septiembre de 1993 (BOE 21/09/1993), restablecida por la Orden
  ECD/191/2012. Solo fija los títulos, no el contenido. Transcritos de fuentes secundarias porque el
  BOE publica un escaneado; ver los avisos en `src/contenido/temario-pt.ts`.
- Examen en Andalucía (Orden de 21 de febrero de 2025): parte práctica y tema seguidos, 4 h 30 min
  en total sin descanso, 2 temas a elegir uno, sin lectura ante el tribunal.
- En 2026 no hubo convocatoria de Maestros en Andalucía: las plazas se aplazaron a 2027, así que la
  cuenta atrás parte de una fecha estimada que se puede cambiar.
- Andalucía no publica los porcentajes de corrección por especialidad, así que los criterios del
  tema son un reparto razonable (`CRITERIOS_TEMA` en `src/ia/corregir-tema.ts`) y habrá que
  ajustarlos cuando salgan los de la convocatoria.
