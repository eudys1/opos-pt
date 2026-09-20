-- Fase 3: banco de supuestos prácticos y sus respuestas.

do $$ begin
  create type origen_supuesto as enum ('propio', 'ia', 'compartido');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type visibilidad_supuesto as enum ('privado', 'especialidad');
exception when duplicate_object then null;
end $$;

create table if not exists public.supuestos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  enunciado text not null,
  -- Preguntas que plantea el supuesto, en orden.
  cuestiones jsonb not null default '[]'::jsonb,
  -- Metadatos INTERNOS: sirven para que los tres del sorteo salgan variados.
  -- No se enseñan al sortear, igual que en el examen no viene etiquetado.
  necesidad text,
  curso text,
  temas int[] not null default '{}',
  -- Criterios de corrección: [{criterio, peso, queSeEspera}]
  rubrica jsonb not null default '[]'::jsonb,
  solucion text,
  origen origen_supuesto not null default 'propio',
  visibilidad visibilidad_supuesto not null default 'privado',
  especialidad text not null default 'Educación Especial: Pedagogía Terapéutica',
  creado_en timestamptz not null default now()
);

create index if not exists supuestos_usuario_idx on public.supuestos (usuario_id, creado_en desc);
create index if not exists supuestos_compartidos_idx
  on public.supuestos (especialidad, visibilidad)
  where visibilidad = 'especialidad';

create table if not exists public.respuestas_supuesto (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  supuesto_id uuid not null references public.supuestos (id) on delete cascade,
  texto text not null default '',
  -- Rutas en el cubo 'apuntes' cuando se entrega en papel.
  fotos text[] not null default '{}',
  transcripcion text,
  -- {notaGlobal, porCriterio, bien, falta, errores, ortografia, consejo}
  correccion jsonb,
  nota numeric(4, 2),
  minutos int,
  creado_en timestamptz not null default now()
);

create index if not exists respuestas_supuesto_idx
  on public.respuestas_supuesto (usuario_id, creado_en desc);

alter table public.supuestos enable row level security;
alter table public.respuestas_supuesto enable row level security;

-- Los propios, siempre. Los de otras personas, solo si los han compartido con
-- la especialidad, y solo para leerlos.
drop policy if exists "supuestos propios" on public.supuestos;
create policy "supuestos propios" on public.supuestos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "supuestos compartidos: leer" on public.supuestos;
create policy "supuestos compartidos: leer" on public.supuestos
  for select using (visibilidad = 'especialidad');

drop policy if exists "respuestas propias" on public.respuestas_supuesto;
create policy "respuestas propias" on public.respuestas_supuesto
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
