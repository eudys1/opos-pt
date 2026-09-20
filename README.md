# Cuaderno

App de estudio para la oposición al Cuerpo de Maestros, especialidad **Educación Especial:
Pedagogía Terapéutica**, en Andalucía. Registra lo que estudias, programa los repasos, guarda los
fallos y, más adelante, genera preguntas y simulacros a partir de tus propios apuntes.

## Arrancar

```bash
npm install
npm run dev
```

La app queda en http://localhost:3000. **No hace falta ninguna clave para usarla**: de momento los
datos se guardan en el navegador (`localStorage`).

Otros comandos:

```bash
npm test          # pruebas de la lógica de repasos y rachas
npm run build     # compilación de producción
```

## En qué punto está

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 0 | Dirección visual «Cuaderno», sistema de diseño y modo oscuro | hecho |
| 1 | Temario, registro de estudio con repasos, planificador, progreso | hecho, sobre almacén local |
| 2 | Lectura de fotos y PDF, banco de preguntas, practicar, cola de fallos | pendiente |
| 3 | Banco de supuestos prácticos y su corrección | pendiente |
| 4 | Simulacros con cronómetro sin avisos y corrección por partes | pendiente |
| 5 | Audio de los temas, revisión de normativa, PWA y despliegue | pendiente |

Las pantallas de las fases 2 a 4 existen ya en el menú y explican qué harán y qué falta, en vez de
aparecer vacías.

Además está hecho: modo claro, oscuro y automático con selector; la app es instalable en el móvil
(el funcionamiento sin conexión llega en la fase 5); y la revisión de accesibilidad con axe pasa sin
ninguna violación en todas las páginas.

## Conectar la nube (Supabase)

Mientras no se haga esto, todo se guarda solo en este navegador.

1. Crear una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (plan gratuito).
2. En **Project Settings → API Keys**, copiar el `Project URL` y la **publishable key**
   (`sb_publishable_…`; en proyectos antiguos se llamaba `anon public`). La **secret key** no hace
   falta y no debe acabar en el navegador.
3. Copiar `.env.example` como `.env.local` y pegar esos dos valores.
4. En **SQL Editor**, pegar y ejecutar el contenido de `supabase/migrations/0001_fase1.sql`.
5. En **Authentication → URL Configuration**, poner `http://localhost:3000` como *Site URL* y añadir
   `http://localhost:3000/**` a *Redirect URLs*. Sin esto, el enlace del correo no vuelve a la app.
6. Reiniciar `npm run dev` y entrar en `/entrar`.

La migración crea las tablas con **RLS**: cada persona solo puede leer y escribir sus propias filas.

Cómo funciona la sincronización: el navegador sigue siendo quien pinta la pantalla, así que la app
va rápida y aguanta sin conexión. Al entrar se fusiona con la cuenta —las marcas y los objetivos se
unen por id y de cada tema se queda la versión modificada más tarde, así que no se pierde nada— y
después cada cambio sube solo.

Para comprobar que todo eso sigue funcionando contra la base de datos real:

```bash
npm run probar:nube
```

Crea dos usuarios de prueba, verifica la fusión, el guardado y que una cuenta no ve ni toca los
datos de la otra, y los borra al terminar.

## Cómo está organizado

```
src/
  app/
    page.tsx            portada pública
    (app)/              la app: temario, registro, planificador, progreso…
  components/           piezas de interfaz (botón, ficha, etiqueta, navegación)
  contenido/
    temario-pt.ts       los 25 títulos oficiales y su procedencia
  datos/
    almacen.tsx         estado de la app, hoy sobre localStorage
    supabase.ts         cliente de la nube cuando haya claves
  nucleo/               lógica pura, sin React: fechas, repasos, racha
supabase/migrations/    esquema de la base de datos
```

La regla que ordena el resto: **`src/nucleo` no sabe nada de React ni de la base de datos**, así que
se puede probar con `npm test` y no cambia al conectar Supabase.

## Decisiones que conviene no deshacer sin hablarlo

- **El cronómetro de los simulacros no avisa.** Ni alertas, ni sonidos, ni hitos. Se puede ver el
  tiempo restante, el transcurrido, solo la hora u ocultarlo. En el examen tampoco avisa nadie.
- **La app nunca inventa contenido de un tema que no está subido.** Cada tema tiene su estado
  (`sin_contenido`, `borrador_ia`, `parcial`, `completo`) y la franja de cobertura lo dice siempre.
  Un borrador generado por IA se marca como tal en todas partes.
- **Los repasos se cuentan desde el último repaso hecho**, no desde la fecha teórica, para que un
  retraso no arrastre toda la cadena.
- **Los supuestos salen sin etiquetas en los sorteos**, variados entre sí, como en el examen.

## Datos oficiales

- Temario: Orden de 9 de septiembre de 1993 (BOE 21/09/1993), restablecida por la Orden
  ECD/191/2012. Solo fija los títulos, no el contenido. Transcritos de fuentes secundarias porque el
  BOE publica un escaneado; ver los avisos en `src/contenido/temario-pt.ts`.
- Examen en Andalucía (Orden de 21 de febrero de 2025): parte práctica y tema seguidos, 4 h 30 min
  en total sin descanso, 2 temas a elegir uno, sin lectura ante el tribunal.
- En 2026 no hubo convocatoria de Maestros en Andalucía: las plazas se aplazaron a 2027, así que la
  cuenta atrás parte de una fecha estimada que se puede cambiar.
