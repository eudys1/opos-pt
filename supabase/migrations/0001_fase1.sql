-- Fase 1: perfil, temario, registro de estudio y planificador.
-- Cada fila pertenece a una persona y solo ella puede verla (RLS).
-- Los nombres van en español para que coincidan con el código de la app.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- perfiles
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  especialidad text not null default 'Educación Especial: Pedagogía Terapéutica',
  comunidad text not null default 'Andalucía',
  fecha_examen date,
  -- Intervalos de repaso en días: +1, +3, +7, +15, +30 por defecto.
  intervalos_repaso int[] not null default '{1,3,7,15,30}',
  dias_libres_al_mes int not null default 2,
  -- Configuración del examen: bolas, supuestos y duraciones en minutos.
  examen jsonb not null default jsonb_build_object(
    'temasSorteados', 2,
    'supuestosSorteados', 3,
    'minutosSoloTema', 135,
    'minutosSoloSupuesto', 135,
    'minutosExamenCompleto', 270,
    'minimoTemasParaSimulacro', 10
  ),
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------------- temas
do $$ begin
  create type estado_contenido as enum ('sin_contenido', 'borrador_ia', 'parcial', 'completo');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type estado_estudio as enum ('por_estudiar', 'estudiado', 'en_repaso', 'dominado');
exception when duplicate_object then null;
end $$;

create table if not exists public.temas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  numero int not null check (numero between 1 and 100),
  titulo text not null,
  texto text not null default '',
  estado_contenido estado_contenido not null default 'sin_contenido',
  estado_estudio estado_estudio not null default 'por_estudiar',
  vueltas int not null default 0,
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, numero)
);

create index if not exists temas_usuario_idx on public.temas (usuario_id, numero);

-- -------------------------------------------------------- eventos_estudio
do $$ begin
  create type tipo_evento as enum ('estudiado', 'repaso', 'practica', 'supuesto', 'simulacro', 'cantar');
exception when duplicate_object then null;
end $$;

create table if not exists public.eventos_estudio (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid references public.temas (id) on delete cascade,
  tipo tipo_evento not null,
  numero_repaso int check (numero_repaso is null or numero_repaso > 0),
  fecha date not null,
  minutos int,
  nota text,
  creado_en timestamptz not null default now(),
  -- Un tema no puede marcarse dos veces como estudiado ni repetir un repaso.
  unique nulls not distinct (usuario_id, tema_id, tipo, numero_repaso)
);

create index if not exists eventos_usuario_fecha_idx
  on public.eventos_estudio (usuario_id, fecha desc);

-- --------------------------------------------------------------- objetivos
create table if not exists public.objetivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid references public.temas (id) on delete set null,
  fecha date not null,
  texto text not null check (length(trim(texto)) > 0),
  automatico boolean not null default false,
  hecho boolean not null default false,
  aplazado_de date,
  creado_en timestamptz not null default now()
);

create index if not exists objetivos_usuario_fecha_idx
  on public.objetivos (usuario_id, fecha);

-- --------------------------------------------------------------------- RLS
alter table public.perfiles enable row level security;
alter table public.temas enable row level security;
alter table public.eventos_estudio enable row level security;
alter table public.objetivos enable row level security;

drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "temas propios" on public.temas;
create policy "temas propios" on public.temas
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "eventos propios" on public.eventos_estudio;
create policy "eventos propios" on public.eventos_estudio
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "objetivos propios" on public.objetivos;
create policy "objetivos propios" on public.objetivos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Al crearse una cuenta, su perfil nace con ella.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();
