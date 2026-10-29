-- Foro CNC: avisos (campana y correo), mensajes directos, eventos y lo de
-- Quora (seguir un tema, pedir respuesta, titular profesional).
-- Correr UNA vez en el editor SQL de Supabase (la base de HETNA_FORO_DB),
-- después de migracion-2026-10-30-red.sql. Se puede correr más de una vez.
--
-- Mientras no se corra, el foro funciona igual: la campana sale vacía y los
-- botones nuevos responden "La red todavía no está activa".

-- Titular profesional (sale junto al nombre, como las credenciales de Quora)
-- y cómo quiere cada quien sus correos del foro.
alter table foro.perfiles add column if not exists titular text not null default '' check (char_length(titular) <= 100);
alter table foro.perfiles add column if not exists correo_avisos text not null default 'al_momento'
  check (correo_avisos in ('al_momento', 'diario', 'nunca'));
alter table foro.perfiles add column if not exists resumen_semanal boolean not null default true;

-- Avisos: la campana del foro. El backend manda por correo los que siguen sin
-- leer (agrupados) y marca correo_at; los demás sólo se ven en la campana.
create table if not exists foro.avisos (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  actor_id uuid references foro.perfiles (id) on delete cascade,
  tipo text not null check (tipo in ('seguidor', 'respuesta', 'mejor', 'aval', 'recomendacion', 'postulacion',
    'solicitud', 'mensaje', 'evento', 'tema_seguido')),
  texto text not null default '' check (char_length(texto) <= 300),
  url text not null default '' check (url = '' or url ~ '^/foro-cnc[A-Za-z0-9/#?=&_.-]*$'),
  leido boolean not null default false,
  correo_at timestamptz,
  creado timestamptz not null default now()
);
create index if not exists avisos_perfil_idx on foro.avisos (perfil_id, creado desc);
create index if not exists avisos_correo_idx on foro.avisos (creado) where correo_at is null and leido = false;

-- Temas que alguien sigue para enterarse de nuevas respuestas
create table if not exists foro.temas_seguidos (
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  tema_id bigint not null references foro.temas (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (perfil_id, tema_id)
);
create index if not exists temas_seguidos_tema_idx on foro.temas_seguidos (tema_id);

-- "Pedir respuesta": a quién se le pidió que contestara un tema
create table if not exists foro.solicitudes (
  tema_id bigint not null references foro.temas (id) on delete cascade,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (tema_id, perfil_id),
  check (perfil_id <> autor_id)
);
create index if not exists solicitudes_perfil_idx on foro.solicitudes (perfil_id, creado desc);
create index if not exists solicitudes_autor_idx on foro.solicitudes (autor_id, creado desc);

-- Mensajes directos entre dos perfiles (a_id < b_id: una sola conversación por pareja)
create table if not exists foro.conversaciones (
  id bigint generated always as identity primary key,
  a_id uuid not null references foro.perfiles (id) on delete cascade,
  b_id uuid not null references foro.perfiles (id) on delete cascade,
  ultimo timestamptz not null default now(),
  a_leido timestamptz not null default now(),
  b_leido timestamptz not null default now(),
  creado timestamptz not null default now(),
  check (a_id < b_id),
  unique (a_id, b_id)
);
create index if not exists conversaciones_a_idx on foro.conversaciones (a_id, ultimo desc);
create index if not exists conversaciones_b_idx on foro.conversaciones (b_id, ultimo desc);

create table if not exists foro.mensajes (
  id bigint generated always as identity primary key,
  conversacion_id bigint not null references foro.conversaciones (id) on delete cascade,
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  creado timestamptz not null default now()
);
create index if not exists mensajes_conversacion_idx on foro.mensajes (conversacion_id, creado);
create index if not exists mensajes_autor_idx on foro.mensajes (autor_id, creado desc);

-- Quién no quiere recibir mensajes de quién
create table if not exists foro.bloqueos (
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  bloqueado_id uuid not null references foro.perfiles (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (perfil_id, bloqueado_id)
);

-- Eventos: un tema de tipo "evento" con fecha, lugar y quién va
alter table foro.temas add column if not exists evento jsonb;
create index if not exists temas_evento_idx on foro.temas (((evento ->> 'inicio'))) where evento is not null;
create table if not exists foro.asistencias (
  tema_id bigint not null references foro.temas (id) on delete cascade,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (tema_id, perfil_id)
);

alter table foro.temas drop constraint if exists temas_tipo_check;
alter table foro.temas add constraint temas_tipo_check
  check (tipo in ('pregunta', 'debate', 'trabajo', 'video', 'novedad', 'busco', 'ofrezco', 'vacante', 'evento'));

alter table foro.avisos enable row level security;
alter table foro.temas_seguidos enable row level security;
alter table foro.solicitudes enable row level security;
alter table foro.conversaciones enable row level security;
alter table foro.mensajes enable row level security;
alter table foro.bloqueos enable row level security;
alter table foro.asistencias enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema foro from anon, authenticated;
  end if;
end $$;

-- Comunidad para anunciar eventos (expos, cursos, reuniones de talleres)
insert into foro.secciones (id, slug, nombre, descripcion, orden, solo_negocios) values
  (13, 'eventos', 'Eventos y cursos', 'Expos, cursos, talleres prácticos y reuniones de la comunidad CNC en México.', 13, false)
on conflict (id) do nothing;
