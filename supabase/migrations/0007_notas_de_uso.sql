-- Fase 6: lo que salió de las notas de uso de septiembre de 2026.
--
-- Se puede ejecutar más de una vez: todo va con "if not exists" o atrapando el
-- duplicado.

-- ------------------------------------------------------------ banco de preguntas

-- Qué pide cada tarjeta ("Definición", "Quién la realiza"…). Sin esto, una
-- flashcard era un concepto suelto y no se sabía qué había que contestar.
alter table public.items add column if not exists pide text;

-- Variantes de una pregunta, para que al repasar un fallo no salga siempre la
-- misma frase. Se crean una vez y se reutilizan: no se paga IA en cada repaso.
alter table public.items
  add column if not exists variante_de uuid references public.items (id) on delete cascade;
create index if not exists items_variante_idx on public.items (variante_de)
  where variante_de is not null;

-- ------------------------------------------------------------------- simulacros

-- Real: como el examen, sin pausas. Flexible: se puede pausar. Las pausas se
-- guardan aquí, en el servidor, igual que la hora de inicio, para que el reloj
-- siga siendo fiable aunque se cierre la página.
alter table public.simulacros add column if not exists reloj text not null default 'real';
do $$ begin
  alter table public.simulacros
    add constraint simulacros_reloj_check check (reloj in ('real', 'flexible'));
exception when duplicate_object then null;
end $$;
alter table public.simulacros add column if not exists pausado_en timestamptz;
alter table public.simulacros add column if not exists pausado_total_s int not null default 0;
alter table public.simulacros add column if not exists pausas int not null default 0;

-- ------------------------------------------------------------------ planificador

-- De qué es cada objetivo, para pintarlo con el color de su sección.
alter table public.objetivos add column if not exists tipo text not null default 'otro';
do $$ begin
  alter table public.objetivos
    add constraint objetivos_tipo_check
    check (tipo in ('temario', 'repaso', 'supuesto', 'simulacro', 'practica', 'otro'));
exception when duplicate_object then null;
end $$;

-- Un repaso que la app propone solo se puede mover a otro día. Ese cambio se
-- guarda como un objetivo automático con el número de repaso que reprograma.
alter table public.objetivos add column if not exists numero_repaso int;

-- -------------------------------------------------------- documentos editables

-- Textos largos que la persona puede retocar a mano, como el banco de
-- normativa. Uno por clave y persona.
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

-- ------------------------------------------------------------------- grabaciones

-- Temas leídos en voz alta por la propia persona. El audio va al cubo privado
-- de apuntes, comprimido en el navegador antes de subirlo.
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

-- El cubo de apuntes admite ahora audio además de imágenes y PDF.
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
