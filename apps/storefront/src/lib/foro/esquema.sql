-- =====================================================================
-- Foro CNC México (hetnacnc.com/mx/foro-cnc) — tablas, reglas y funciones
--
-- Vive en su propio esquema "foro", en la misma base que HetNa Taller
-- (variable HETNA_FORO_DB, o HETNA_TALLER_DB si no existe). No toca Mercur.
-- Se puede correr más de una vez sin perder datos:
--   psql "$HETNA_TALLER_DB" -f apps/storefront/src/lib/foro/esquema.sql
-- =====================================================================

create schema if not exists foro;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists foro.perfiles (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null unique,                 -- id del cliente en la tienda (Medusa)
  usuario text not null unique check (usuario ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  nombre text not null check (char_length(nombre) between 2 and 80),
  tipo text not null default 'aficionado'
    check (tipo in ('cliente', 'taller', 'proveedor', 'profesional', 'aficionado', 'marca')),
  verificado boolean not null default false,
  vendedor_id text,                                -- id del vendedor en el marketplace, si tiene
  bio text not null default '' check (char_length(bio) <= 1000),
  ciudad text not null default '' check (char_length(ciudad) <= 80),
  estado_mx text not null default '' check (char_length(estado_mx) <= 40),
  foto_url text,
  redes jsonb not null default '{}'::jsonb,        -- {facebook, instagram, tiktok, youtube, x, linkedin, web}
  maquinas text[] not null default '{}',
  software text[] not null default '{}',
  reputacion integer not null default 0,
  rol text not null default 'usuario' check (rol in ('usuario', 'moderador', 'admin')),
  suspendido boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists foro.secciones (
  id smallint primary key,
  slug text not null unique,
  nombre text not null,
  descripcion text not null default '',
  orden smallint not null default 0,
  solo_negocios boolean not null default false     -- Novedades y ofertas: solo talleres, proveedores y marcas
);

create table if not exists foro.temas (
  id bigint generated always as identity primary key,
  seccion_id smallint not null references foro.secciones (id),
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  tipo text not null check (tipo in ('pregunta', 'debate', 'trabajo', 'video', 'novedad')),
  titulo text not null check (char_length(titulo) between 10 and 150),
  slug text not null,
  cuerpo text not null check (char_length(cuerpo) between 1 and 20000),
  ligas jsonb not null default '[]'::jsonb,        -- ["https://youtu.be/...", ...]
  fotos text[] not null default '{}',              -- ids de foro.fotos
  encuesta jsonb,                                  -- {pregunta, opciones: [..]} solo en debates
  estado text not null default 'publicado' check (estado in ('publicado', 'revision', 'oculto')),
  mejor_respuesta_id bigint,
  votos integer not null default 0,
  respuestas integer not null default 0,
  vistas integer not null default 0,
  patrocinado boolean not null default false,
  fijado boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  ultima_actividad timestamptz not null default now(),
  busqueda tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(cuerpo, '')), 'B')
  ) stored,
  unique (seccion_id, slug)
);

create table if not exists foro.respuestas (
  id bigint generated always as identity primary key,
  tema_id bigint not null references foro.temas (id) on delete cascade,
  autor_id uuid not null references foro.perfiles (id) on delete cascade,
  padre_id bigint references foro.respuestas (id) on delete cascade,
  cuerpo text not null check (char_length(cuerpo) between 1 and 10000),
  fotos text[] not null default '{}',
  estado text not null default 'publicado' check (estado in ('publicado', 'revision', 'oculto')),
  votos integer not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

do $$ begin
  alter table foro.temas
    add constraint temas_mejor_fk foreign key (mejor_respuesta_id)
    references foro.respuestas (id) on delete set null;
exception when duplicate_object then null; end $$;

-- votos de "útil" (a un tema o a una respuesta, uno por persona)
create table if not exists foro.votos (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  tema_id bigint references foro.temas (id) on delete cascade,
  respuesta_id bigint references foro.respuestas (id) on delete cascade,
  creado timestamptz not null default now(),
  check ((tema_id is null) <> (respuesta_id is null))
);
create unique index if not exists votos_tema_uq on foro.votos (perfil_id, tema_id) where tema_id is not null;
create unique index if not exists votos_resp_uq on foro.votos (perfil_id, respuesta_id) where respuesta_id is not null;

-- votos de encuestas (uno por persona y encuesta, se puede cambiar)
create table if not exists foro.encuesta_votos (
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  tema_id bigint not null references foro.temas (id) on delete cascade,
  opcion smallint not null check (opcion between 0 and 9),
  creado timestamptz not null default now(),
  primary key (perfil_id, tema_id)
);

create table if not exists foro.reportes (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('tema', 'respuesta', 'perfil')),
  objeto_id text not null,
  autor_id uuid references foro.perfiles (id) on delete set null,
  motivo text not null check (char_length(motivo) between 3 and 500),
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto', 'descartado')),
  creado timestamptz not null default now()
);

-- lo que decidió el filtro automático con cada publicación
create table if not exists foro.revisiones (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('tema', 'respuesta')),
  objeto_id bigint not null,
  resultado text not null check (resultado in ('publicar', 'revisar')),
  motivo text not null default '',
  creado timestamptz not null default now()
);

-- fotos de temas, respuestas y perfiles (ya reducidas en el navegador, máx. 1 MB)
create table if not exists foro.fotos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references foro.perfiles (id) on delete cascade,
  tipo text not null check (tipo in ('image/webp', 'image/jpeg', 'image/png')),
  ancho integer not null check (ancho between 1 and 4000),
  alto integer not null check (alto between 1 and 4000),
  datos bytea not null check (octet_length(datos) <= 1048576),
  creado timestamptz not null default now()
);

create index if not exists temas_lista_idx on foro.temas (seccion_id, estado, fijado desc, ultima_actividad desc);
create index if not exists temas_recientes_idx on foro.temas (estado, ultima_actividad desc);
create index if not exists temas_autor_idx on foro.temas (autor_id, creado desc);
create index if not exists temas_busqueda_idx on foro.temas using gin (busqueda);
create index if not exists respuestas_tema_idx on foro.respuestas (tema_id, creado);
create index if not exists respuestas_autor_idx on foro.respuestas (autor_id, creado desc);
create index if not exists reportes_estado_idx on foro.reportes (estado, creado desc);
create index if not exists fotos_perfil_idx on foro.fotos (perfil_id, creado desc);

-- ---------------------------------------------------------------------
-- Si esta base es de Supabase: cerrado al público (solo el servidor entra)
-- ---------------------------------------------------------------------

alter table foro.perfiles enable row level security;
alter table foro.secciones enable row level security;
alter table foro.temas enable row level security;
alter table foro.respuestas enable row level security;
alter table foro.votos enable row level security;
alter table foro.encuesta_votos enable row level security;
alter table foro.reportes enable row level security;
alter table foro.revisiones enable row level security;
alter table foro.fotos enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema foro from anon, authenticated;
    revoke all on all tables in schema foro from anon, authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------

-- texto -> dirección web: minúsculas, sin acentos, solo letras, números y guiones
create or replace function foro.slug(t text) returns text
language sql immutable set search_path = pg_catalog, pg_temp as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(t, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', '-', 'g')), 80), ''), 'tema')
$$;

-- fechas de cambio
create or replace function foro.tocar() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists perfiles_tocar on foro.perfiles;
create trigger perfiles_tocar before update on foro.perfiles for each row execute function foro.tocar();
drop trigger if exists temas_tocar on foro.temas;
create trigger temas_tocar before update of titulo, cuerpo, ligas, fotos, encuesta on foro.temas for each row execute function foro.tocar();
drop trigger if exists respuestas_tocar on foro.respuestas;
create trigger respuestas_tocar before update of cuerpo, fotos on foro.respuestas for each row execute function foro.tocar();

-- contador de respuestas y última actividad del tema
create or replace function foro.contar_respuestas() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update foro.temas
      set respuestas = respuestas + (case when new.estado = 'publicado' then 1 else 0 end),
          ultima_actividad = case when new.estado = 'publicado' then now() else ultima_actividad end
      where id = new.tema_id;
  elsif tg_op = 'DELETE' then
    if old.estado = 'publicado' then
      update foro.temas set respuestas = greatest(respuestas - 1, 0) where id = old.tema_id;
    end if;
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    update foro.temas
      set respuestas = greatest(respuestas
        + (case when new.estado = 'publicado' then 1 else 0 end)
        - (case when old.estado = 'publicado' then 1 else 0 end), 0)
      where id = new.tema_id;
  end if;
  return null;
end $$;

drop trigger if exists respuestas_contar on foro.respuestas;
create trigger respuestas_contar after insert or delete or update of estado on foro.respuestas
  for each row execute function foro.contar_respuestas();

-- votos: suben el contador de la publicación y la reputación de su autor
create or replace function foro.contar_votos() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  d integer := case when tg_op = 'INSERT' then 1 else -1 end;
  r foro.votos := case when tg_op = 'INSERT' then new else old end;
  autor uuid;
begin
  if r.tema_id is not null then
    update foro.temas set votos = votos + d where id = r.tema_id returning autor_id into autor;
  else
    update foro.respuestas set votos = votos + d where id = r.respuesta_id returning autor_id into autor;
  end if;
  if autor is not null and autor <> r.perfil_id then
    update foro.perfiles set reputacion = reputacion + d where id = autor;
  end if;
  return null;
end $$;

drop trigger if exists votos_contar on foro.votos;
create trigger votos_contar after insert or delete on foro.votos
  for each row execute function foro.contar_votos();

-- publicar un tema con dirección única dentro de su sección
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
  if (s.solo_negocios or p_tipo = 'novedad') and p.tipo not in ('taller', 'proveedor', 'marca') and p.rol = 'usuario' then
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

-- responder un tema (o a otra respuesta del mismo tema)
create or replace function foro.responder(
  p_autor uuid, p_tema bigint, p_cuerpo text, p_padre bigint default null,
  p_fotos text[] default '{}', p_estado text default 'publicado'
) returns bigint
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  p foro.perfiles;
  nuevo bigint;
begin
  select * into p from foro.perfiles where id = p_autor;
  if p.id is null then raise exception 'perfil_no_existe'; end if;
  if p.suspendido then raise exception 'perfil_suspendido'; end if;
  if not exists (select 1 from foro.temas where id = p_tema and estado = 'publicado') then
    raise exception 'tema_no_existe';
  end if;
  if p_padre is not null and not exists (select 1 from foro.respuestas where id = p_padre and tema_id = p_tema) then
    raise exception 'respuesta_no_existe';
  end if;
  if p.rol = 'usuario' and (select count(*) from foro.respuestas r where r.autor_id = p_autor and r.creado > now() - interval '1 day') >= 60 then
    raise exception 'limite_diario';
  end if;
  insert into foro.respuestas (tema_id, autor_id, padre_id, cuerpo, fotos, estado)
    values (p_tema, p_autor, p_padre, p_cuerpo, coalesce(p_fotos, '{}'), p_estado)
    returning id into nuevo;
  return nuevo;
end $$;

-- dar o quitar un voto de "útil"; devuelve true si quedó votado
create or replace function foro.votar(p_perfil uuid, p_tema bigint default null, p_respuesta bigint default null)
returns boolean
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if (p_tema is null) = (p_respuesta is null) then raise exception 'voto_invalido'; end if;
  if p_tema is not null then
    delete from foro.votos where perfil_id = p_perfil and tema_id = p_tema;
    if found then return false; end if;
    insert into foro.votos (perfil_id, tema_id) values (p_perfil, p_tema);
  else
    delete from foro.votos where perfil_id = p_perfil and respuesta_id = p_respuesta;
    if found then return false; end if;
    insert into foro.votos (perfil_id, respuesta_id) values (p_perfil, p_respuesta);
  end if;
  return true;
end $$;

-- votar en una encuesta (se puede cambiar el voto)
create or replace function foro.votar_encuesta(p_perfil uuid, p_tema bigint, p_opcion smallint)
returns void
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  opciones integer;
begin
  select jsonb_array_length(encuesta -> 'opciones') into opciones from foro.temas where id = p_tema;
  if opciones is null or p_opcion < 0 or p_opcion >= opciones then raise exception 'opcion_invalida'; end if;
  insert into foro.encuesta_votos (perfil_id, tema_id, opcion) values (p_perfil, p_tema, p_opcion)
    on conflict (perfil_id, tema_id) do update set opcion = excluded.opcion, creado = now();
end $$;

-- marcar la mejor respuesta (solo el autor del tema); da 15 puntos al que respondió
create or replace function foro.marcar_mejor(p_perfil uuid, p_tema bigint, p_respuesta bigint)
returns void
language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  t foro.temas;
  anterior uuid;
  nuevo uuid;
begin
  select * into t from foro.temas where id = p_tema;
  if t.id is null then raise exception 'tema_no_existe'; end if;
  if t.autor_id <> p_perfil then raise exception 'solo_el_autor'; end if;
  if p_respuesta is not null then
    select autor_id into nuevo from foro.respuestas where id = p_respuesta and tema_id = p_tema;
    if nuevo is null then raise exception 'respuesta_no_existe'; end if;
  end if;
  if t.mejor_respuesta_id is not null then
    select autor_id into anterior from foro.respuestas where id = t.mejor_respuesta_id;
    if anterior is not null and anterior <> t.autor_id then
      update foro.perfiles set reputacion = reputacion - 15 where id = anterior;
    end if;
  end if;
  update foro.temas set mejor_respuesta_id = p_respuesta where id = p_tema;
  if nuevo is not null and nuevo <> t.autor_id then
    update foro.perfiles set reputacion = reputacion + 15 where id = nuevo;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema foro from public, anon, authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Secciones de arranque
-- ---------------------------------------------------------------------

insert into foro.secciones (id, slug, nombre, descripcion, orden, solo_negocios) values
  (1, 'router-cnc', 'Router CNC', 'Fresas, velocidades, avances, sujeción y problemas del router CNC en madera, MDF, acrílico y aluminio.', 1, false),
  (2, 'corte-laser', 'Corte láser', 'Láser de CO2, diodo y fibra: potencia, velocidad, grabado y corte en madera, acrílico, piel y metal.', 2, false),
  (3, 'plasma', 'Plasma CNC', 'Corte por plasma: consumibles, amperaje, altura de antorcha, THC y calidad de corte en acero.', 3, false),
  (4, 'torno-fresadora', 'Torno y fresadora CNC', 'Maquinado de metales en torno y fresadora CNC: herramientas, insertos, G-code y acabados.', 4, false),
  (5, 'impresion-3d', 'Impresión 3D', 'Impresoras 3D, filamentos, resinas, litofanías y configuraciones de impresión.', 5, false),
  (6, 'diseno-cam', 'Diseño y CAM', 'Vectric, Aspire, Fusion, ArtCAM, LightBurn y más: diseño, trayectorias y postprocesadores.', 6, false),
  (7, 'controladores-electronica', 'Controladores y electrónica', 'Mach3, GRBL, DSP, drivers, motores a pasos y servos, cableado y fallas eléctricas.', 7, false),
  (8, 'materiales-herramientas', 'Materiales y herramientas', 'Dónde comprar, qué material conviene y qué herramienta usar para cada trabajo.', 8, false),
  (9, 'precios-negocio', 'Precios y negocio', 'Cuánto cobrar, cómo cotizar, conseguir clientes y hacer crecer tu taller.', 9, false),
  (10, 'muestra-tu-trabajo', 'Muestra tu trabajo', 'Presume tus piezas terminadas: fotos, material, máquina y cómo las hiciste.', 10, false),
  (11, 'novedades-ofertas', 'Novedades y ofertas', 'Productos, servicios y promociones de talleres, proveedores y marcas.', 11, true)
on conflict (id) do nothing;
