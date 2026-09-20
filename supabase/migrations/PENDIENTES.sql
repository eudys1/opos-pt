-- Migraciones pendientes de las fases 2 a 5, en orden.
--
-- Pegar este archivo entero en el SQL Editor de Supabase y pulsar Run. Se puede
-- ejecutar más de una vez sin romper nada: los tipos y las políticas que ya
-- existan se saltan o se reemplazan.
--
-- Lo que crea: el cubo privado de apuntes, los archivos de cada tema, el
-- registro de gasto de IA, el banco de preguntas, los intentos, la cola de
-- fallos, los supuestos con sus respuestas, los simulacros con sus partes y la
-- normativa detectada. Todo con RLS: cada persona solo ve lo suyo.

-- ============================================================ 0002_apuntes.sql

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

drop policy if exists "apuntes propios: ver" on storage.objects;
create policy "apuntes propios: ver" on storage.objects
  for select using (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "apuntes propios: subir" on storage.objects;
create policy "apuntes propios: subir" on storage.objects
  for insert with check (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "apuntes propios: borrar" on storage.objects;
create policy "apuntes propios: borrar" on storage.objects
  for delete using (
    bucket_id = 'apuntes' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------- archivos de un tema
do $$ begin
  create type estado_lectura as enum ('subido', 'leyendo', 'leido', 'error');
exception when duplicate_object then null;
end $$;

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

drop policy if exists "archivos propios" on public.archivos_tema;
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
drop policy if exists "gasto propio: ver" on public.uso_ia;
create policy "gasto propio: ver" on public.uso_ia
  for select using (auth.uid() = usuario_id);

drop policy if exists "gasto propio: registrar" on public.uso_ia;
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


-- ============================================================ 0003_banco.sql

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


-- ============================================================ 0004_supuestos.sql

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


-- ============================================================ 0005_simulacros.sql

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


-- ============================================================ 0006_normativa.sql

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
