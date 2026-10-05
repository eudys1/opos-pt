-- Apartados: un repaso (o el estudiado) y un objetivo pueden ser de solo unos
-- apartados del tema. Se guardan sus ids ("2.1", "introduccion"); vacío o nulo
-- es el tema entero. Solo añade columnas: repetible sin peligro.
alter table public.eventos_estudio add column if not exists apartados text[];
alter table public.objetivos add column if not exists apartados text[];
