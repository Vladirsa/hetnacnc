-- Foro CNC: tipos de publicación "Busco maquinado" y "Ofrezco capacidad".
-- Correr UNA vez en el editor SQL de Supabase (la base de HETNA_FORO_DB).
-- Se puede correr más de una vez sin problema.
--
-- Mientras no se corra, el foro funciona igual; sólo al elegir esos dos
-- tipos sale "Este tipo de publicación todavía no está activo".

alter table foro.temas drop constraint if exists temas_tipo_check;
alter table foro.temas add constraint temas_tipo_check
  check (tipo in ('pregunta', 'debate', 'trabajo', 'video', 'novedad', 'busco', 'ofrezco'));

-- "Ofrezco capacidad" es sólo para talleres, proveedores y marcas, como "Novedad".
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
  if (s.solo_negocios or p_tipo in ('novedad', 'ofrezco')) and p.tipo not in ('taller', 'proveedor', 'marca') and p.rol = 'usuario' then
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
