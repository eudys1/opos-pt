-- Fase 5: normas citadas en los temas y comprobaciones de si han cambiado.
-- La comprobación es manual, a botón: no hay ningún proceso automático.

create table if not exists public.normas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  -- Nombre tal y como aparece en los apuntes, ya normalizado.
  nombre text not null,
  -- Temas en los que se cita.
  temas int[] not null default '{}',
  -- Resultado de la última comprobación.
  estado text not null default 'sin_comprobar',
  resumen text,
  enlace text,
  comprobada_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (usuario_id, nombre)
);

create index if not exists normas_usuario_idx on public.normas (usuario_id, nombre);

create table if not exists public.revisiones_normativa (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  -- [{nombre, estado, resumen, enlace, temas}]
  hallazgos jsonb not null default '[]'::jsonb,
  normas_revisadas int not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists revisiones_idx on public.revisiones_normativa (usuario_id, creado_en desc);

alter table public.normas enable row level security;
alter table public.revisiones_normativa enable row level security;

drop policy if exists "normas propias" on public.normas;
create policy "normas propias" on public.normas
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "revisiones propias" on public.revisiones_normativa;
create policy "revisiones propias" on public.revisiones_normativa
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
