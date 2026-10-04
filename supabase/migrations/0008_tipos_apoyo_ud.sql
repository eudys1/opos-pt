-- Planificador: dos tipos de objetivo nuevos, "plan de apoyo" y "UD" (unidad
-- didáctica). La restricción de 0007 solo admitía seis: se cambia por una que
-- también los admite. Repetible sin peligro.
alter table public.objetivos drop constraint if exists objetivos_tipo_check;
alter table public.objetivos
  add constraint objetivos_tipo_check
  check (tipo in ('temario', 'repaso', 'supuesto', 'simulacro', 'practica', 'apoyo', 'ud', 'otro'));
