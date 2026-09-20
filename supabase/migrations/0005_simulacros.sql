-- Fase 4: simulacros de examen.
-- El reloj lo lleva el servidor: iniciado_en no lo pone el navegador, así que
-- cerrar la página o cambiar la hora del ordenador no regala tiempo.

do $$ begin
  create type modalidad_simulacro as enum ('tema', 'supuesto', 'completo');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type estado_simulacro as enum ('en_curso', 'entregado', 'corregido', 'abandonado');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type tipo_parte as enum ('tema', 'supuesto');
exception when duplicate_object then null;
end $$;

create table if not exists public.simulacros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  modalidad modalidad_simulacro not null,
  iniciado_en timestamptz not null default now(),
  duracion_s int not null,
  estado estado_simulacro not null default 'en_curso',
  -- true cuando el sorteo se cargó a favor de los temas flojos.
  trampa boolean not null default false,
  entregado_en timestamptz,
  nota numeric(4, 2),
  creado_en timestamptz not null default now()
);

create index if not exists simulacros_usuario_idx on public.simulacros (usuario_id, creado_en desc);

create table if not exists public.simulacro_partes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  simulacro_id uuid not null references public.simulacros (id) on delete cascade,
  tipo tipo_parte not null,
  -- Lo que salió en el sorteo: [{id, titulo, numero?}]. Se guarda entero para
  -- poder revisar después qué bolas salieron.
  opciones jsonb not null default '[]'::jsonb,
  elegido_id uuid,
  elegido_titulo text,
  texto text not null default '',
  -- Rutas en el cubo 'apuntes' cuando se entrega en papel.
  fotos text[] not null default '{}',
  transcripcion text,
  correccion jsonb,
  nota numeric(4, 2),
  minutos int,
  entregado_en timestamptz
);

create index if not exists simulacro_partes_idx on public.simulacro_partes (simulacro_id);

alter table public.simulacros enable row level security;
alter table public.simulacro_partes enable row level security;

drop policy if exists "simulacros propios" on public.simulacros;
create policy "simulacros propios" on public.simulacros
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "partes propias" on public.simulacro_partes;
create policy "partes propias" on public.simulacro_partes
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Cómo se lleva cada tema, a partir de lo practicado. La usa el modo trampa
-- para cargar el sorteo hacia lo más flojo, y el progreso para pintar el mapa.
create or replace view public.dominio_por_tema
with (security_invoker = on)
as
select
  it.usuario_id,
  it.tema_id,
  count(*) as intentos,
  count(*) filter (where i.acierto)::numeric / nullif(count(*), 0) as dominio
from public.intentos i
join public.items it on it.id = i.item_id
group by it.usuario_id, it.tema_id;
