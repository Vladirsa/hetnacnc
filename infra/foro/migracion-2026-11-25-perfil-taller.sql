-- Foro CNC: perfil tipo LinkedIn para talleres (25 nov 2026).
-- Correr UNA vez en el editor SQL de Supabase (la base de HETNA_FORO_DB).
-- Se puede correr más de una vez sin problema. No borra nada.
--
-- Mientras no se corra, el perfil sigue funcionando como antes; las secciones
-- nuevas (portada, zonas, máquinas, materiales y portafolio) avisan que
-- todavía no están activas.

-- Foto de portada y zonas que atiende ("Todo México" o una lista de estados)
alter table foro.perfiles add column if not exists portada_url text;
alter table foro.perfiles add column if not exists zonas text[] not null default '{}';

-- Máquinas con detalle, materiales con espesores y portafolio de trabajos.
-- Se guardan como listas JSON en el mismo perfil (igual que la trayectoria):
--   equipos:    [{tipo, modelo, largo, ancho, alto, potencia, unidad, foto}]
--   materiales: [{material, min, max}]
--   portafolio: [{id, titulo, material, espesor, maquina, detalle, fotos[]}]
alter table foro.perfiles add column if not exists equipos jsonb not null default '[]'::jsonb;
alter table foro.perfiles add column if not exists materiales jsonb not null default '[]'::jsonb;
alter table foro.perfiles add column if not exists portafolio jsonb not null default '[]'::jsonb;

-- "Acerca de" usa la misma columna bio: de 1,000 a 2,000 caracteres
alter table foro.perfiles drop constraint if exists perfiles_bio_check;
alter table foro.perfiles add constraint perfiles_bio_check check (char_length(bio) <= 2000);

-- El usuario (la liga del perfil) pasa de 30 a 60 letras: ya no se corta el nombre
alter table foro.perfiles drop constraint if exists perfiles_usuario_check;
alter table foro.perfiles add constraint perfiles_usuario_check check (usuario ~ '^[a-z0-9][a-z0-9-]{2,59}$');

-- Ligas viejas del perfil: cuando alguien cambia su usuario, la liga anterior
-- se guarda aquí y redirige a la nueva (nadie más puede tomarla).
create table if not exists foro.usuarios_anteriores (
  usuario text primary key,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  creado timestamptz not null default now()
);
create index if not exists usuarios_anteriores_perfil on foro.usuarios_anteriores (perfil_id);
alter table foro.usuarios_anteriores enable row level security;
