-- Fase 2b: banco de preguntas, intentos y cola de fallos.
-- Vive solo en la cuenta: practicar requiere haber entrado.

do $$ begin
  create type tipo_item as enum ('test', 'corta', 'flashcard', 'ley', 'cloze');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type origen_item as enum ('ia', 'manual');
exception when duplicate_object then null;
end $$;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid not null references public.temas (id) on delete cascade,
  tipo tipo_item not null,
  enunciado text not null,
  -- Solo en las de test: lista de opciones en el orden en que se muestran.
  opciones jsonb,
  -- Índice de la opción correcta (test) o null en el resto.
  correcta int,
  -- Respuesta modelo para cortas, flashcards y leyes.
  respuesta text,
  explicacion text,
  -- Fragmento literal del tema del que sale, para poder comprobarla.
  cita text,
  origen origen_item not null default 'ia',
  -- true cuando sale de un borrador generado, no de los apuntes propios.
  desde_borrador boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists items_usuario_tema_idx on public.items (usuario_id, tema_id, tipo);

create table if not exists public.intentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  respuesta text,
  acierto boolean not null,
  -- Cómo se ha valorado una flashcard: sabia | dude | fallo.
  valoracion text,
  feedback jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists intentos_usuario_idx on public.intentos (usuario_id, creado_en desc);
create index if not exists intentos_item_idx on public.intentos (item_id);

-- Un fallo por pregunta y persona: vuelve hasta que deja de fallarse.
create table if not exists public.fallos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  tema_id uuid not null references public.temas (id) on delete cascade,
  proxima_fecha date not null,
  aciertos_seguidos int not null default 0,
  veces_fallado int not null default 1,
  resuelto_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (usuario_id, item_id)
);

create index if not exists fallos_cola_idx on public.fallos (usuario_id, resuelto_en, proxima_fecha);

alter table public.items enable row level security;
alter table public.intentos enable row level security;
alter table public.fallos enable row level security;

drop policy if exists "items propios" on public.items;
create policy "items propios" on public.items
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "intentos propios" on public.intentos;
create policy "intentos propios" on public.intentos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "fallos propios" on public.fallos;
create policy "fallos propios" on public.fallos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
