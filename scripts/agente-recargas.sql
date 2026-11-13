-- ════════════════════════════════════════════════════════════════════
-- Agente de recargas — funciones de solo lectura para el Supabase de la app
-- del taller (Cotizador). Pegar una vez en Supabase → SQL Editor → Run.
-- Se puede correr dos veces. No cambia ni borra datos.
--
--   hetna_uso()        espacio de la base y de los archivos (vs. el plan)
--   hetna_consultas()  cuántas consultas lleva la API: el agente compara cada
--                      revisión con la anterior y avisa si hay un bucle
--
-- Sólo las puede llamar la llave de servicio del servidor de HETNA.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.hetna_uso() returns json
language sql security definer set search_path = public, storage as $$
  select json_build_object(
    'bd_bytes', pg_database_size(current_database()),
    'archivos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0))
$$;
revoke all on function public.hetna_uso() from public, anon, authenticated;
grant execute on function public.hetna_uso() to service_role;

create or replace function public.hetna_consultas() returns json
language sql security definer set search_path = public, extensions as $$
  select json_build_object(
    -- cada petición a la API de Supabase empieza con un "select set_config(...)"
    'total', coalesce((select sum(calls) from extensions.pg_stat_statements
                       where query ilike 'select set_config(%'), 0),
    'top', coalesce((select json_agg(x) from (
        select calls as veces, left(query, 300) as consulta
        from extensions.pg_stat_statements
        where query ilike '%pgrst_source%'
        order by calls desc limit 5) x), '[]'::json))
$$;
revoke all on function public.hetna_consultas() from public, anon, authenticated;
grant execute on function public.hetna_consultas() to service_role;

-- Prueba (debe salir un JSON con total y top):
select public.hetna_consultas();
