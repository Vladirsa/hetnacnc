-- Foro CNC: red profesional (seguir talleres y personas, currículum, avales,
-- recomendaciones, vacantes y postulaciones).
-- Correr UNA vez en el editor SQL de Supabase (la base de HETNA_FORO_DB).
-- Se puede correr más de una vez sin problema.
--
-- Mientras no se corra, el foro funciona igual: los botones de "Seguir",
-- "Avalar" y "Postularme" responden "La red todavía no está activa".

-- Currículum del perfil: aptitudes (lo que sabe hacer), trayectoria
-- (experiencia, estudios, certificaciones y proyectos) y si está abierto a
-- trabajo o proyectos.
alter table foro.perfiles add column if not exists aptitudes text[] not null default '{}';
alter table foro.perfiles add column if not exists trayectoria jsonb not null default '[]'::jsonb;
alter table foro.perfiles add column if not exists abierto boolean not null default false;

-- A quién sigue cada perfil. Un solo renglón por cosa seguida:
--   p:<id de perfil>   una persona
--   t:<id de vendedor> un taller del directorio (sus productos y publicaciones)
--   s:<slug>           una sección del foro (comunidad)
create table if not exists foro.seguimientos (
  seguidor_id uuid not null references foro.perfiles (id) on delete cascade,
  objetivo text not null check (objetivo ~ '^(p:[0-9a-f-]{36}|t:[A-Za-z0-9_]{3,60}|s:[a-z0-9-]{2,60})$'),
  creado timestamptz not null default now(),
  primary key (seguidor_id, objetivo)
);
create index if not exists seguimientos_objetivo_idx on foro.seguimientos (objetivo, creado desc);

-- Avales: "sí sabe hacer esto". Uno por persona y aptitud; nadie se avala solo.
create table if not exists foro.avales (
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  aptitud text not null check (char_length(aptitud) between 2 and 40),
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (perfil_id, aptitud, autor_id),
  check (perfil_id <> autor_id)
);
create index if not exists avales_autor_idx on foro.avales (autor_id, creado desc);

-- Recomendaciones escritas. Salen en el perfil sólo cuando el dueño las acepta.
create table if not exists foro.recomendaciones (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  relacion text not null check (relacion in ('cliente', 'proveedor', 'companero', 'jefe', 'alumno', 'otro')),
  texto text not null check (char_length(texto) between 30 and 1500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'publicada', 'oculta')),
  creado timestamptz not null default now(),
  unique (perfil_id, autor_id),
  check (perfil_id <> autor_id)
);
create index if not exists recomendaciones_perfil_idx on foro.recomendaciones (perfil_id, estado, creado desc);

-- Postulaciones a una vacante. Sólo las ve quien publicó la vacante.
create table if not exists foro.postulaciones (
  tema_id bigint not null references foro.temas (id) on delete cascade,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  mensaje text not null check (char_length(mensaje) between 10 and 1500),
  creado timestamptz not null default now(),
  primary key (tema_id, perfil_id)
);
create index if not exists postulaciones_perfil_idx on foro.postulaciones (perfil_id, creado desc);

alter table foro.seguimientos enable row level security;
alter table foro.avales enable row level security;
alter table foro.recomendaciones enable row level security;
alter table foro.postulaciones enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema foro from anon, authenticated;
  end if;
end $$;

-- Tipo de publicación "Vacante" (sólo talleres, proveedores y marcas).
alter table foro.temas drop constraint if exists temas_tipo_check;
alter table foro.temas add constraint temas_tipo_check
  check (tipo in ('pregunta', 'debate', 'trabajo', 'video', 'novedad', 'busco', 'ofrezco', 'vacante'));

create or replace function foro.crear_tema(
  p_autor uuid, p_seccion text, p_tipo text, p_titulo text, p_cuerpo text,
  p_ligas jsonb default '[]'::jsonb, p_fotos text[] default '{}', p_encuesta jsonb default null,
  p_estado text default 'publicado'
) returns table (id bigint, slug text, seccion text)
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  s foro.secciones;
  p foro.perfiles;
  base text;
  final text;
  n integer := 1;
  nuevo bigint;
begin
  select * into p from foro.perfiles where perfiles.id = p_autor;
  if p.id is null then raise exception 'perfil_no_existe'; end if;
  if p.suspendido then raise exception 'perfil_suspendido'; end if;
  select * into s from foro.secciones where secciones.slug = p_seccion;
  if s.id is null then raise exception 'seccion_no_existe'; end if;
  if (s.solo_negocios or p_tipo in ('novedad', 'ofrezco', 'vacante')) and p.tipo not in ('taller', 'proveedor', 'marca') and p.rol = 'usuario' then
    raise exception 'solo_negocios';
  end if;
  if p.rol = 'usuario' and (select count(*) from foro.temas t where t.autor_id = p_autor and t.creado > now() - interval '1 day') >= 8 then
    raise exception 'limite_diario';
  end if;
  base := foro.slug(p_titulo);
  final := base;
  while exists (select 1 from foro.temas t where t.seccion_id = s.id and t.slug = final) loop
    n := n + 1;
    final := left(base, 75) || '-' || n;
  end loop;
  insert into foro.temas (seccion_id, autor_id, tipo, titulo, slug, cuerpo, ligas, fotos, encuesta, estado)
    values (s.id, p_autor, p_tipo, trim(p_titulo), final, p_cuerpo, coalesce(p_ligas, '[]'::jsonb),
            coalesce(p_fotos, '{}'), p_encuesta, p_estado)
    returning temas.id into nuevo;
  return query select nuevo, final, s.slug;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema foro from public, anon, authenticated;
  end if;
end $$;

-- Comunidad de empleos y proyectos
insert into foro.secciones (id, slug, nombre, descripcion, orden, solo_negocios) values
  (12, 'empleos-proyectos', 'Empleos y proyectos', 'Vacantes de talleres, operadores y programadores que buscan trabajo, y proyectos que buscan quién los haga.', 12, false)
on conflict (id) do nothing;
