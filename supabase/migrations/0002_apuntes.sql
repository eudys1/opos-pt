-- Fase 2: archivos de apuntes, lectura automática y control de gasto de IA.

-- ------------------------------------------------------- almacén de archivos
-- Cubo privado: cada persona solo entra en su propia carpeta, que es su uuid.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'apuntes',
  'apuntes',
  false,
  26214400, -- 25 MB por archivo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "apuntes propios: ver" on storage.objects
  for select using (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "apuntes propios: subir" on storage.objects
  for insert with check (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "apuntes propios: borrar" on storage.objects
  for delete using (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------- archivos de un tema
create type estado_lectura as enum ('subido', 'leyendo', 'leido', 'error');

create table if not exists public.archivos_tema (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid not null references public.temas (id) on delete cascade,
  -- Ruta dentro del cubo: <usuario>/<tema>/<archivo>
  ruta text not null unique,
  nombre text not null,
  tipo_mime text not null,
  bytes int not null,
  -- Orden de las páginas dentro del tema, para que el texto salga seguido.
  orden int not null default 0,
  estado estado_lectura not null default 'subido',
  texto text,
  error text,
  creado_en timestamptz not null default now()
);

create index if not exists archivos_tema_idx on public.archivos_tema (usuario_id, tema_id, orden);

alter table public.archivos_tema enable row level security;

create policy "archivos propios" on public.archivos_tema
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ----------------------------------------------------------- gasto de la IA
create table if not exists public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  -- 'lectura', 'banco', 'correccion'…
  tarea text not null,
  modelo text not null,
  tokens_entrada int not null default 0,
  tokens_salida int not null default 0,
  tokens_cache_lectura int not null default 0,
  coste_estimado numeric(10, 5) not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists uso_ia_idx on public.uso_ia (usuario_id, creado_en desc);

alter table public.uso_ia enable row level security;

-- La persona puede ver su gasto; escribir solo lo hace el servidor.
create policy "gasto propio: ver" on public.uso_ia
  for select using (auth.uid() = usuario_id);

create policy "gasto propio: registrar" on public.uso_ia
  for insert with check (auth.uid() = usuario_id);

-- Gasto del mes en curso, para el aviso de límite.
create or replace function public.gasto_del_mes()
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(coste_estimado), 0)
  from public.uso_ia
  where usuario_id = auth.uid()
    and creado_en >= date_trunc('month', now());
$$;
