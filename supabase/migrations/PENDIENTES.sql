-- Migraciones pendientes.
--
-- Pegar este archivo entero en el SQL Editor de Supabase y pulsar Run. Se puede
-- ejecutar más de una vez sin romper nada.
--
-- Las fases 2 a 5 (0002 a 0006) ya están aplicadas. Esto es solo la 0007:
-- qué pide cada flashcard, variantes para repasar fallos, simulacro real o
-- flexible con pausas, tipo y reprogramación de objetivos del planificador,
-- documentos editables (banco de normativa) y grabaciones de voz.

-- ======================================================= 0007_notas_de_uso.sql

-- Qué pide cada tarjeta.
alter table public.items add column if not exists pide text;

-- Variantes para repasar fallos.
alter table public.items
  add column if not exists variante_de uuid references public.items (id) on delete cascade;
create index if not exists items_variante_idx on public.items (variante_de)
  where variante_de is not null;

-- Simulacro real o flexible, con pausas guardadas en el servidor.
alter table public.simulacros add column if not exists reloj text not null default 'real';
do $$ begin
  alter table public.simulacros
    add constraint simulacros_reloj_check check (reloj in ('real', 'flexible'));
exception when duplicate_object then null;
end $$;
alter table public.simulacros add column if not exists pausado_en timestamptz;
alter table public.simulacros add column if not exists pausado_total_s int not null default 0;
alter table public.simulacros add column if not exists pausas int not null default 0;

-- Tipo de objetivo y reprogramación de repasos.
alter table public.objetivos add column if not exists tipo text not null default 'otro';
do $$ begin
  alter table public.objetivos
    add constraint objetivos_tipo_check
    check (tipo in ('temario', 'repaso', 'supuesto', 'simulacro', 'practica', 'otro'));
exception when duplicate_object then null;
end $$;
alter table public.objetivos add column if not exists numero_repaso int;

-- Documentos editables.
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  clave text not null,
  contenido text not null default '',
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, clave)
);
alter table public.documentos enable row level security;
drop policy if exists "documentos propios" on public.documentos;
create policy "documentos propios" on public.documentos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Grabaciones de voz.
create table if not exists public.grabaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid not null references public.temas (id) on delete cascade,
  ruta text not null unique,
  tipo_mime text not null,
  bytes int not null,
  duracion_s int not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists grabaciones_idx on public.grabaciones (usuario_id, tema_id, creado_en desc);
alter table public.grabaciones enable row level security;
drop policy if exists "grabaciones propias" on public.grabaciones;
create policy "grabaciones propias" on public.grabaciones
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- El cubo de apuntes admite audio.
update storage.buckets
  set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'
  ]
  where id = 'apuntes';

-- Supuestos: la resolución puede venir de la academia. Entonces es la
-- referencia principal al corregir: se comprueba si están sus puntos clave.
alter table public.supuestos
  add column if not exists solucion_de_academia boolean not null default false;

-- Audios de un tema: grabados por la persona o sintetizados con `npm run voz`.
alter table public.grabaciones add column if not exists origen text not null default 'propia';
do $$ begin
  alter table public.grabaciones add constraint grabaciones_origen_check check (origen in ('propia', 'sintetica'));
exception when duplicate_object then null;
end $$;
