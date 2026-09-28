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

La app queda en http://localhost:3000. **Hace falta cuenta para entrar**, así que lo primero es
configurar Supabase (más abajo); la clave de Anthropic desbloquea además la lectura de apuntes, las
preguntas, los supuestos y las correcciones. El navegador guarda una copia de trabajo para ir rápido
y aguantar sin conexión, pero lo que manda es la cuenta.

Otros comandos:

```bash
npm test            # 60 pruebas de la lógica: repasos, racha, fallos, sorteo, normas, rúbricas
npm run build       # compilación de producción (comprueba tipos)
npm run migrar      # aplica a Supabase las migraciones que falten (npm run migrar -- --ver para mirar)
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
4. Aplicar las migraciones. Dos formas:
   - **Por comando** (recomendado): sacar un token en
     [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), pegarlo
     en `.env.local` como `SUPABASE_ACCESS_TOKEN` y ejecutar `npm run migrar`. Lleva la cuenta de
     lo aplicado en una tabla `migraciones`, así que se puede repetir sin miedo.
   - **A mano**: pegar en el **SQL Editor** de Supabase, en orden, los archivos de
     `supabase/migrations/` que falten. Al hacer push a `main`, el workflow de GitHub los aplica
     solo si tiene los secretos.
5. En **Authentication → URL Configuration**, poner `http://localhost:3000` como *Site URL* y añadir
   `http://localhost:3000/**` a *Redirect URLs*.
6. Reiniciar `npm run dev` y entrar en `/entrar`.

### Entrar con Google

El código ya está puesto (`signInWithOAuth`); lo que falta es la configuración, que es toda por
consola web. Consultado el 21/09/2026 en la
[documentación de Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).

1. En [console.cloud.google.com](https://console.cloud.google.com) crear un proyecto.
2. En **Google Auth Platform → Branding**, rellenar nombre de la app, correo de soporte y correo de
   contacto. En **Audience**, tipo *External*. En **Data Access**, los tres permisos básicos:
   `openid`, `userinfo.email` y `userinfo.profile`. **Dejarla en *Testing*** y, en **Audience →
   Test users**, añadir los dos correos: para dos personas basta. *Publish app* se queda gris hasta
   tener página principal, política de privacidad y dominio autorizado, y no hace falta.
3. En **Clients → Create client → Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3000` y la URL de Vercel.
   - *Authorized redirect URIs*: la URL de retorno de Supabase, que aparece en el panel del
     proveedor y tiene la forma `https://<ref-del-proyecto>.supabase.co/auth/v1/callback`. Copiarla
     de ahí en vez de escribirla a mano.
4. Copiar el **Client ID** y el **Client secret**.
5. En Supabase, **Authentication → Sign In / Providers → Google**: activarlo, pegar las dos claves y
   guardar.
6. En **Authentication → URL Configuration**, comprobar que la URL de Vercel está en *Redirect URLs*
   además de la de localhost.

No hay nada que tocar en `.env.local`: el secreto vive en Supabase, no en la app.

Quien entra con Google llega con el mismo correo, así que la lista de `CORREOS_PERMITIDOS` vale
igual para los tres caminos. Cuando las dos personas hayan entrado una vez, conviene apagar
**Allow new users to sign up** en Supabase: a partir de ahí nadie más puede crearse cuenta, ni por
Google ni por enlace.

Todas las tablas llevan **RLS**: cada persona solo lee y escribe sus propias filas. La única
excepción a propósito son los supuestos marcados como compartidos, que otras personas de la misma
especialidad pueden leer, no editar.

La sincronización funciona así: el navegador es quien pinta la pantalla, así que la app va rápida y
aguanta sin conexión; al entrar se fusiona con la cuenta —las marcas y los objetivos se unen por id
y de cada tema se queda la versión modificada más tarde— y después cada cambio sube solo.

## Meter temario desde el disco (`npm run temario`)

Cuarta vía de entrada, además de las fotos, el PDF desde la web y el texto pegado: dejas los
archivos en `temario-local/` y un comando los sube a la cuenta.

```bash
npm run temario                      # a todos los correos de CORREOS_PERMITIDOS
npm run temario -- --seco            # dice qué haría, sin escribir nada
npm run temario -- --cuenta=a@b.com  # solo a esa cuenta
npm run temario -- --sin-archivo     # sube el texto, el PDF no sale del disco
npm run temario -- --rehacer         # ignora el registro y lo repite todo
```

- **La carpeta no va al repositorio.** Está en `.gitignore` porque el repositorio es público. Lo
  que viaja es el contenido, y va a un cubo **privado** con RLS: solo lo ve la cuenta a la que se
  sube. Comprobado contra la base real: un cliente anónimo no puede descargar el PDF ni leer una
  sola fila de `temas`.
- **El número de tema sale del nombre del archivo** (`tema 3 oposiciones.pdf` → tema 3) y se
  contrasta con los 25 títulos oficiales. Lo que no se reconozca se queda fuera y se avisa.
- **Los PDF con capa de texto se leen aquí, gratis y exactos**, sin gastar IA. Si un archivo sale
  con menos de 200 caracteres es que está escaneado: ese va por la pantalla de "Mi temario", que lo
  lee con visión.
- **Es repetible.** Lleva un registro local (`temario-local/.procesado.json`) con la huella de cada
  archivo y por cuenta, así que solo sube lo que ha cambiado.
- Usa la `SUPABASE_SECRET_KEY`, que salta la RLS para poder escribir en la cuenta de otra persona.
  Por eso se ejecuta a mano desde el portátil y nunca desde una ruta de la web.
- Si un correo de `CORREOS_PERMITIDOS` no ha entrado nunca, **se le crea la cuenta** con el correo
  ya confirmado y se le sube todo: al entrar por primera vez (con Google o con el enlace al correo)
  se encuentra el temario puesto. Supabase une el inicio con Google a esa cuenta porque el correo
  está verificado ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking),
  consultado el 27-09-2026). Con `--seco` solo dice que la crearía. Vale igual para
  `npm run supuestos`.

## Meter supuestos desde el disco (`npm run supuestos`)

Igual que el temario, con la carpeta `supuestos-local/` (también fuera de git; dentro hay un
`LEEME.txt`). Una carpeta por supuesto, con su nombre como título:

```
supuestos-local/
  Alumno con TEA en 2.º de Primaria/
    enunciado.pdf        obligatorio (.pdf, .txt o .md)
    resolucion.pdf       la de la academia (opcional); "resolucion propia.txt" si es tuya
    cuestiones.txt       una pregunta por línea (opcional)
  Dislexia en 4.º.pdf    archivo suelto = supuesto sin resolución
```

```bash
npm run supuestos -- --seco    # qué haría, sin escribir nada
npm run supuestos              # subir
```

Entran siempre como **privados**. No pisa lo editado en la app (salvo `--forzar`) ni vuelve a
subir lo que borraste allí (salvo `--rehacer`). Lo común con `npm run temario` (leer PDF, cuentas,
registro) está en `scripts/comun.mts`.

Pendiente: guardar el tema **por epígrafes** en vez de como un bloque de texto. La estructura está
ahí (`INTRODUCCIÓN`, `1.`, `1.1`…), pero la tabla `temas` hoy tiene una sola columna de texto.

## Voz natural para escuchar los temas (`npm run voz`)

La voz del navegador suena a robot. `npm run voz` genera el audio de cada tema con las voces
neurales de Microsoft Edge (el CLI `edge-tts`), lo pasa a Opus mono a 24 kbps con ffmpeg y lo sube a
la cuenta. En la app aparece en «Escuchar el tema».

```bash
npm run voz                        # todos los temas con texto, todas las cuentas
npm run voz -- --tema=3            # solo ese tema
npm run voz -- --seco              # dice qué haría, sin generar nada
VOZ=es-ES-AlvaroNeural npm run voz # otra voz (por defecto, es-ES-ElviraNeural)
```

- Gratis y sin clave, pero va desde el portátil: `edge-tts` y `ffmpeg` no existen en Vercel. Se
  instalan una vez: `pip install edge-tts` y `winget install ffmpeg`.
- Se lee el tema sin su índice inicial, sin la bibliografía y sin direcciones web.
- Solo regenera lo que ha cambiado: la huella del texto, la voz y el ritmo va en el nombre del
  archivo. La versión anterior se borra.
- Medido el 27-09-2026: 85 palabras son 36 s de audio; en Opus ocupan 105 KB (en MP3, 212 KB). Un
  tema de unas 2.000 palabras son unos 14 minutos y unos 2,5 MB.
- El texto del tema va al servicio de voz de Microsoft para sintetizarlo. Si eso no conviene para
  algún tema, la alternativa es grabarlo uno mismo desde la app.

Las grabaciones propias se hacen en la app, en el mismo sitio: el navegador graba en Opus a 24 kbps
(en iPhone puede ser AAC), unos 3 MB por cuarto de hora, y se escuchan antes de guardarlas.

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
    (app)/              la app: mi examen, temario, registro, planificador, practicar,
                        fallos, supuestos, simulacros, progreso, normativa y mi cuenta
    (editor)/           el tema a pantalla completa, en su propia pestaña
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
- **Simulacro real o flexible.** El real no se para; el flexible se puede pausar y queda marcado
  como tal. Las pausas, igual que la hora de inicio, las pone el servidor.
- **El sorteo va por rondas**: lo ya desarrollado no vuelve a salir hasta hacer todo lo demás.
- **El banco de preguntas solo suma**: generar más no borra nada, porque cada pregunta costó dinero.
- **Registro y planificador son el mismo dato**: cambiar una fecha en uno la cambia en el otro.
- **La legislación se corrige en local, palabra a palabra**, contra el texto literal del tema.
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

## Publicar en Vercel

1. `npx vercel` en la carpeta del proyecto (o importar el repositorio desde vercel.com).
2. En **Settings → Environment Variables** del proyecto, añadir las mismas variables que hay en
   `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `ANTHROPIC_API_KEY` y `CORREOS_PERMITIDOS`. Las dos últimas son privadas y no salen nunca al
   navegador.
3. En Supabase, **Authentication → URL Configuration**, añadir la URL de Vercel como *Site URL* y
   `https://<tu-dominio>.vercel.app/**` a *Redirect URLs*, o el enlace del correo no volverá a la app.
4. En Supabase, **Authentication → Sign In / Providers**, desactivar el registro de nuevos usuarios
   una vez hayan entrado las personas que la van a usar. Si quieres entrar con Google, actívalo ahí
   mismo antes.
5. Opcional: en GitHub, **Settings → Secrets and variables → Actions**, añadir
   `SUPABASE_ACCESS_TOKEN` y `NEXT_PUBLIC_SUPABASE_URL`. Con eso, cada vez que llegue una migración
   nueva a `main` se aplica sola (`.github/workflows/migraciones.yml`). Si prefieres no dejar el
   token en GitHub, borra ese archivo y usa `npm run migrar`.

**Cuidado con el límite de tiempo.** En el plan gratuito de Vercel ninguna función puede declarar un
`maxDuration` mayor de 300 segundos: si se pasa, el despliegue falla entero con `invalid_max_duration`.
Además, el trabajo va troceado a propósito —los apuntes se leen de tres en tres, el banco se crea en
dos llamadas y cada parte del simulacro se corrige por separado, con las fotos transcritas de dos en
dos—, porque una petición de varios minutos es frágil y deja a quien la usa mirando un botón
bloqueado. Si algo deja de caber, se trocea más; no se sube el número.
