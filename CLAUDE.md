# Notas para trabajar en este repositorio

App de estudio para la oposición de Maestro, especialidad Pedagogía Terapéutica, en Andalucía.
Todo el código, los comentarios, los nombres y la interfaz van **en español**.

## Comandos

```bash
npm run dev      # servidor de desarrollo en localhost:3000
npm test         # vitest, lógica de src/nucleo y los filtros de src/ia
npm run build    # compilación (hace también la comprobación de tipos)
npm run temario  # sube a la cuenta los temas de temario-local/ (--seco para probar)
npm run voz      # voz natural de los temas con edge-tts + ffmpeg (--tema=3, --seco)
npm run migrar   # aplica migraciones (necesita SUPABASE_ACCESS_TOKEN)
npx eslint src scripts --max-warnings=0
```

`temario-local/` es material privado y está en `.gitignore`: el repositorio es público y ahí no
entra nada del temario. Antes de cualquier `git add` amplio, mirar `git status`.

## Cómo está partido

- `src/nucleo/` — lógica pura y probada, **sin React ni base de datos**: fechas, repasos, racha,
  hitos (marcar, cambiar fecha, desmarcar), agenda (lo hecho, lo previsto y lo propuesto por día),
  sorteo por rondas, reloj con pausas, cotejo literal, normas y estructura de un tema. Toda regla del
  dominio va aquí. Devuelve códigos, no frases: la pantalla redacta el mensaje.
- `src/datos/almacen.tsx` — estado de la app: store externo sobre `localStorage` leído con
  `useSyncExternalStore`, sincronizado con la cuenta por `src/datos/nube.ts`.
- `src/datos/cache.ts` — `useRecordado`: lo último leído de la cuenta, para que al volver a una
  pantalla se pinte al instante y se ponga al día por detrás, **sin saltos**. Clave con el id del
  usuario. Solo para lecturas que se enseñan; nunca para algo que se edita (el banco de normativa,
  los temas) ni para enlaces firmados que caducan. Si una acción deja viejo lo que otra pantalla
  recuerda, `olvidar(prefijo)` (lo hace el simulacro al entregar).
- `src/contenido/temario-pt.ts` — los 25 títulos oficiales, su fuente y los avisos de literalidad.
- `src/app/(app)/` — la app con sesión y barra lateral. `src/app/(editor)/` — pantallas de trabajo a
  pantalla completa (el tema en su pestaña). `src/app/page.tsx` — portada pública.
- `src/app/api/` — rutas de servidor. **Son las únicas que ven ANTHROPIC_API_KEY.** Todas pasan por
  `prepararLlamada` o `prepararSesion` (`src/ia/guardas.ts`).
- `src/ia/` — un archivo por tarea con su prompt y su esquema de salida.
- `src/components/ui/` — piezas del sistema de diseño (botón, ficha, diálogo, barra de progreso,
  secciones y sus colores, texto largo).
- **Campos de formulario, modales, menús y arrastrar: React Aria Components** (Adobe; elegido el
  04-10-2026 frente a Radix y Base UI porque trae en un solo paquete fecha con calendario en
  español, desplegables, modales y arrastrar y soltar accesible con teclado). Todo pasa por
  `src/components/ui/campos.tsx` (`CampoTexto`, `AreaTexto`, `CampoNumero`, `CampoFecha`,
  `Selector`, `Casilla`, `Opciones`), `ui/dialogo.tsx` y `components/arrastre.tsx`. **No volver a
  escribir `<input>`, `<select>` ni `<textarea>` a mano**: solo quedan los de entrar y crear
  cuenta (con sus propias piezas en `acceso.tsx`) y los selectores de archivo. El borde de los
  campos usa el token `campo` (3:1 con el fondo en los dos temas, WCAG 1.4.11; `linea` daba 1,3).
- El panel del navegador integrado, oculto, no pinta: las animaciones de salida de los modales no
  acaban y los clics reales fallan. Para probar interacciones, eventos simulados desde JS
  (`.click()`, `DragEvent` con un `DataTransfer`), o Playwright.
- `scripts/` — comandos que corren en el portátil (temario, voz, migrar); usan la clave secreta de
  Supabase y nunca se llaman desde la web.

## Reglas de producto que no se tocan sin hablarlo

1. **El cronómetro de los simulacros no avisa de nada.** Ni alertas, ni sonidos, ni hitos a los 30,
   15 o 5 minutos. Modos: restante, transcurrido, solo la hora u oculto.
2. **Simulacro real o flexible.** El real no se pausa nunca. El flexible sí, y queda marcado como
   flexible en el historial, con sus pausas. Antes de empezar se dice con claridad que el reloj
   arranca al pulsar «Empezar ya». Abandonar cancela: no cuenta para historial ni rondas.
3. **La hora del simulacro la pone el servidor**, también las pausas (`/api/simulacro/reloj`).
   Nunca calcular el reloj con la hora del navegador.
4. **El sorteo va por rondas**: lo desarrollado no vuelve a salir hasta hacer todo lo demás
   (`bomboDeLaRonda`). Los supuestos salen sin etiquetas y variados entre sí.
5. **Nunca se genera ni se ofrece contenido de un tema que no está subido.** La cobertura se ve
   siempre en el lateral; la franja de arriba se puede cerrar y vuelve si cambia el número.
6. **Cada pregunta guarda la cita literal del tema de la que sale**, y `esUtilizable` descarta las que
   no se pueden comprobar. En legislación la respuesta ES el texto literal del tema, y se corrige en
   local con `cotejarLiteral`, sin IA.
7. **El banco de preguntas solo suma.** Generar más no borra lo anterior (cada pregunta costó una
   llamada); borrar es una acción aparte y confirmada. Las variantes de los fallos se crean una vez
   por pregunta y se reutilizan.
8. **Los repasos se cuentan desde el último hecho.** Registro y planificador leen y escriben los
   mismos eventos (`src/nucleo/hitos.ts`, `agenda.ts`): no hay que sincronizarlos. Mover un repaso
   se guarda como objetivo automático con `numero_repaso`.
9. **Las notas se recalculan en local** con `notaPonderada`. Si el supuesto trae resolución de la
   academia, es la referencia principal de la corrección (`puntosClave`).
10. **El cuaderno solo se abre con cuenta** (`Puerta`), y la cuenta tiene que estar en
    `CORREOS_PERMITIDOS` (lo comprueba `/api/acceso`). Como en cualquier web: `/entrar` es para
    quien ya tiene cuenta (Google o correo y contraseña, con enlace al correo si la olvidó) y
    `/crear-cuenta` para darse de alta (Google o correo + contraseña repetida). Las piezas comunes
    están en `src/components/acceso.tsx`; no exportar nada que no sea la página desde un `page.tsx`
    (rompe el build de Next).
11. **Todo lo que edita tiene «Cancelar»**, y todo lo que tarda por la IA enseña `BarraProgreso`.
12. Nada de datos inventados en la interfaz: si no se sabe, se dice.

## Sistema de diseño

- **Cada sección tiene su color, y está en un solo sitio**: los tokens `--color-sec-*` de
  `globals.css` y el mapa `SECCIONES_APP` de `src/components/ui/secciones.ts`. Menú, Mi examen,
  planificador y progreso lo leen de ahí; cambiar un color es cambiarlo ahí y nada más. Fallos es
  rojo; ninguna sección repite color.

La dirección B («Racha») casi tal cual, elegida el 27-09-2026: fondo melocotón claro, texto marrón
oscuro, tarjetas blancas con **borde marrón grueso**, esquinas de 22 px y **sombra desplazada**
melocotón sin difuminar; botones en píldora con relieve abajo; un cuadradito de color por sección
en el menú. Fredoka (titulares y cifras) sobre Nunito (texto). Todo en `src/app/globals.css`.

- Correcciones sobre el croquis de B: Practicar y Fallos en turquesa (no verde), Supuestos en
  índigo (no amarillo), porque **verde, ámbar y rojo son significado** (bien, a medias, mal). Los
  botones naranjas llevan el texto en marrón (`sobre-boton`): el blanco sobre ese naranja no llega
  al contraste mínimo.
- **Tema claro por defecto.** El oscuro solo si se elige con el sol y la luna (`SelectorTema`), que
  está arriba: en la barra lateral junto al nombre, en la barra del móvil, en la portada y en entrar.
  No hay modo «automático».
- Tokens heredados del primer diseño: `papel` = fondos, `tinta` = texto principal, `margen` = error
  y retraso, `visto` = hecho. De B: `borde` (el marrón grueso), `sombra` (el melocotón), `acento`,
  `boton`, `aviso` y `sec-*` con su `-vivo` para rellenos (mapa en `src/components/ui/secciones.ts`).
- Texto encima de un relleno de color: `text-papel-alto` o `text-sobre-boton`, que cambian con el
  tema; `text-white` solo sobre `sec-temario-vivo`, que está comprobado en los dos temas.
- Colores solo por token. Nada de hexadecimales sueltos en componentes: rompen el modo oscuro.
- `Ficha` lleva borde de 2 px y sombra corta; `Ficha destacada`, borde de 3 px y sombra larga, para
  lo principal de cada pantalla.
- Accesibilidad: WCAG 2.2 AA, áreas pulsables de 44 px, `label` en cada campo, foco visible y axe
  sin violaciones (portada y entrar comprobadas en claro, oscuro y móvil, 27-09-2026). Si se toca
  un color, volver a pasar axe.
- Movimiento: `.entra`, `.levanta`, `.regla`, `.trazo`, `.progreso-vivo`. Cola larga, sin rebote,
  y todo se desactiva con `prefers-reduced-motion`.
- **`.levanta` solo en lo que se puede pulsar**: se levanta al pasar y se hunde al pulsar, y
  hundirse promete que algo va a pasar. Lo que solo informa lleva **`.flota`**: se levanta igual
  al pasar, pero al hacer clic no hace nada.
- Portada: el movimiento cuenta la idea del lema, «no perder el hilo». Palabras que suben
  (`.palabra`), el hilo dibujado bajo «hilo» (`.hilo-trazo`), el hilo que une los pasos de «Cómo
  va» al bajar (`.hilo-pasos`, `.nudo`), paralaje del héroe solo en escritorio y cabecera que se
  despega (`.cabecera-viva`). Lo ligado al scroll va dentro de `@supports (animation-timeline:
  view())`: donde no hay soporte, se ve quieto y completo.

## Trampas que ya costaron tiempo

- **27-09-2026: se borró el texto de dos temas en la cuenta.** Un navegador nuevo crea los 25 temas
  vacíos; la fusión decidía «gana el más reciente» comparando solo el día, y además cada guardado
  subía los 25 temas con la hora del momento. El vacío de hoy pisó al subido ayer. Se recuperó desde
  `temario-local/`. Lo que lo impide ahora, y que no se toca sin hablarlo:
  1. `src/nucleo/sincronia.ts`: en una fusión **nunca se pierde contenido** (un tema vacío no pisa
     uno con algo, ni al revés) y las fechas se comparan con hora.
  2. Solo se suben los temas **que han cambiado** (huella), con su propia hora; un tema nunca tocado
     en ese navegador no se sube jamás, y uno vacío con fecha de solo día tampoco.
  3. Nada se sube hasta que la primera fusión **ha terminado** (`puedeSubir`), y los editores de
     temas no dejan guardar hasta estar **al día** con la cuenta (`alDia`).
  4. Vaciar un tema con texto pide confirmación. Varias pestañas se ponen al día entre sí.
  5. `npm run temario` mira la cuenta, no solo su registro, y no pisa textos editados en la app
     sin `--forzar`.
  6. `npm run probar:nube` prueba el caso contra la base real. **Cualquier cambio en
     `nube.ts`, `sesion.tsx` o `almacen.tsx` exige pasarla.**
- Tailwind 4 deja los botones con el cursor normal: el `cursor: pointer` está en `globals.css`
  para todo lo pulsable. Un botón nunca se desactiva sin decir por qué: se deja pulsar y explica qué
  falta.

- **Nunca escribir expresiones regulares ni `\n` a través de la consola** (heredoc, `node -e`,
  `sed`): se comen las barras y `\b` acaba siendo un carácter de retroceso invisible. Para código con
  barras, la herramienta de edición de ficheros.
- `useSearchParams` en una página cliente necesita un `<Suspense>` para poder prerenderizar.
- La base de datos parece estar en EE. UU. (unos 100 ms de ida y vuelta desde España): todo lo que
  se pueda pedir en paralelo, en paralelo.

## Estado

Hecho: temario con lectura de apuntes y carpeta local, editor de tema en pestaña, registro y
planificador editables y unidos, practicar, fallos con variantes y filtros, legislación literal,
supuestos con resolución de academia, simulacros real o flexible por rondas, progreso, banco de
normativa, Mi examen, Mi cuenta, voz natural y grabaciones propias, modo oscuro y PWA.
Supuestos también desde carpeta local (`npm run supuestos`, carpeta `supuestos-local/`).

Tanda del 04-10-2026:
- **Supuestos como los del examen de Andalucía** (visto en los reales de 2019 y 2025 que subió
  Lucía): contexto del centro, alumno, observaciones y una consigna fija al final
  (`CONSIGNA_ANDALUCIA`, la pone el código). **Sin cuestiones**: la columna `cuestiones` sigue en
  la base sin usarse (borrarla es decisión de Eudys) y se vacía al editar un supuesto antiguo.
  Cada supuesto se abre también en su pestaña (`/supuesto/[id]`). La corrección no se ha tocado:
  espera a las guías de Lucía.
- **Registro**: columna «Empezar» (día previsto para empezar cada tema). Es un objetivo
  automático del tema sin número de repaso (`esInicioPrevisto` en `nucleo/agenda.ts`), así que
  sale también en el planificador. Si el registro ya prueba que está empezado (estudiado, algún
  repaso o prácticas en la cuenta), no se ofrece planearlo: se enseña ✔ con el día real
  (`empezadoDesde`), y marcar el estudiado da por cumplido el día previsto. El «+» al final de las
  columnas de repaso (decidido por Eudys: más intuitivo que un botón aparte) añade o quita
  repasos para todos los temas; `cambiarRepasos`
  recalcula el estado de cada tema. «Sin subir» lleva a `/temario?tema=N`.
- **Planificador**: tipos «Plan de apoyo» (petróleo) y «UD» (pizarra), migración 0008. Lo
  pendiente se arrastra a otro día; qué se puede mover lo decide `comoMover` (lo hecho no, un
  repaso no a un día pasado). En el mes, pulsar un día abre un modal con ‹ › para cambiar de día.
- **Fallos**, en dos pestañas: «Repasar» (preparar la sesión: los de hoy o todos los abiertos)
  y «Banco de fallos» (todo lo fallado, abierto y superado, por tema y plegable, con filtros,
  orden y la respuesta de cada uno; «Repasar estos N» repasa lo que se ve). Un superado que se
  vuelve a fallar vuelve a la cola.
- **Normativa**: descarga en Word (`docx`, se carga solo al pedirlo), PDF (imprimir del navegador)
  o texto.

Pendiente (apuntado por Eudys, 27-09-2026): **3.5** revisar la voz natural de los temas.

Pendiente de decidir con los usuarios: criterios oficiales de corrección cuando se publiquen,
segunda prueba (programación didáctica y defensa oral), Pomodoro y retos en grupo.
