# Notas para trabajar en este repositorio

App de estudio para la oposición de Maestro, especialidad Pedagogía Terapéutica, en Andalucía.
Todo el código, los comentarios, los nombres y la interfaz van **en español**.

## Comandos

```bash
npm run dev      # servidor de desarrollo en localhost:3000
npm test         # vitest, lógica de src/nucleo
npm run build    # compilación (hace también la comprobación de tipos)
npx eslint src --max-warnings=0
```

## Cómo está partido

- `src/nucleo/` — lógica pura: fechas, repasos, racha. **Sin React y sin base de datos**, para que se
  pueda probar sola. Todo lo que sea una regla del dominio va aquí, no dentro de un componente.
- `src/datos/almacen.tsx` — estado de la app. Hoy es un store externo sobre `localStorage` leído con
  `useSyncExternalStore`; su forma es la de las tablas de `supabase/migrations/`, así que conectar la
  nube debe ser cambiar este adaptador y nada más.
- `src/contenido/temario-pt.ts` — los 25 títulos oficiales, su fuente y los avisos de literalidad.
- `src/app/(app)/` — la app con sesión; `src/app/page.tsx` es la portada pública.
- `src/app/api/` — rutas de servidor. **Son las únicas que ven ANTHROPIC_API_KEY.** Todas pasan por
  `prepararLlamada` o `prepararSesion` (`src/ia/guardas.ts`), que resuelven sesión, tope de gasto,
  registro del consumo y traducción de los errores de la API.
- `src/ia/` — un archivo por tarea (leer apuntes, banco, correcciones, supuestos, normativa) con su
  prompt y su esquema de salida.
- `src/components/ui/` — piezas de interfaz del sistema de diseño.

## Reglas de producto que no se tocan sin hablarlo

1. **El cronómetro de los simulacros no avisa de nada.** Ni alertas, ni sonidos, ni hitos a los 30,
   15 o 5 minutos. Modos: restante, transcurrido, solo la hora u oculto.
2. **Nunca se genera ni se ofrece contenido de un tema que no está subido.** La franja de cobertura
   dice siempre con cuánto temario se trabaja. Un borrador de IA se marca como tal en todas partes.
3. **Los repasos se cuentan desde el último repaso hecho**, no desde la fecha teórica.
4. **Los supuestos salen sin etiquetas en los sorteos**, y variados entre sí.
5. **Cada pregunta guarda la cita literal del tema de la que sale**, y `esUtilizable` descarta las que
   no se pueden comprobar contra los apuntes. No quitar ese filtro.
6. **Las notas se recalculan en local** con `notaPonderada`, no se usa la media que devuelva el modelo.
7. **La hora de inicio de un simulacro la pone el servidor.** Nunca calcular el reloj desde el cliente.
8. Nada de datos inventados en la interfaz: si no se sabe, se dice.

## Sistema de diseño "Cuaderno"

Papel hueso, tinta azul, margen rojo. Fraunces (display, variable) sobre Karla (texto).

- Colores solo por token (`bg-papel`, `text-tinta`, `border-linea`…), definidos en `globals.css`.
  Nada de hexadecimales sueltos en los componentes: rompen el modo oscuro.
- La elevación se hace con **filete de 1 px**, nunca con sombras difusas. Radios de 3–4 px.
- El modo oscuro redefine los mismos tokens; se elige con el selector y se aplica antes del primer
  pintado con el script de `layout.tsx`.
- Accesibilidad: objetivo WCAG 2.2 AA. Áreas pulsables de 44 px como mínimo, `label` en cada campo,
  foco visible, y contraste comprobado con axe (0 violaciones en todas las páginas, septiembre 2026).
  Si se toca un color gris, hay que volver a pasar axe.
- Movimiento: trazos que se escriben (`.trazo`), entradas suaves (`.entra`), subrayado de regla
  (`.regla`). Todo se desactiva con `prefers-reduced-motion`.

## Estado

Fases 1 a 5 hechas: temario con lectura de apuntes, registro, practicar, fallos, supuestos,
simulacros, planificador, progreso, normativa, audio, modo oscuro y PWA. Requiere las claves de
Supabase y Anthropic en `.env.local` y las migraciones de `supabase/migrations/` ejecutadas en orden.

Pendiente de decidir con los usuarios: criterios oficiales de corrección cuando se publiquen,
preparación de la segunda prueba (programación didáctica y defensa oral), "cantar temas",
cronómetro tipo Pomodoro y retos en grupo.
