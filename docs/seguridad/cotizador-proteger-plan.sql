-- Cotizador: que un taller no pueda cambiar su propio plan ni sus datos de cobro.
-- Auditoría de seguridad del 18 nov 2026.
--
-- DÓNDE SE CORRE: en Supabase, en el proyecto del COTIZADOR (no en el de la
-- tienda) → SQL Editor → pegar todo → Run. Se puede correr más de una vez.
--
-- QUÉ ARREGLA: la función proteger_plan_negocio() se volvió a crear en cinco
-- archivos (suscripciones_y_correos, suscripciones_paypal, seguridad_rls,
-- arranque, referidos), cada vez con una lista distinta de columnas. La última
-- que se corrió es la que vale, y las más nuevas ya no protegen plan_estado,
-- plan_vence, plan_renueva ni los datos de Mercado Pago y PayPal. Con eso, el
-- administrador de un taller podía, con su propia sesión, ponerse
-- plan_vence = '2099-01-01' y conservar el plan de pago sin pagar.
--
-- Esta versión protege la UNIÓN de todas las columnas. Compara por nombre, así
-- que no falla si alguna columna todavía no existe en tu base.

-- 1) Antes de cambiar nada: mira qué versión tienes hoy (opcional)
-- select pg_get_functiondef('public.proteger_plan_negocio'::regproc);

create or replace function public.proteger_plan_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text;
  antes jsonb := to_jsonb(old);
  ahora jsonb := to_jsonb(new);
begin
  -- El bono de arranque lo aplica completar_arranque() con esta marca
  if coalesce(current_setting('hetna.bono_arranque', true), '') = '1' then
    return new;
  end if;
  -- auth.role() es 'authenticated' o 'anon' cuando viene de la app; es null
  -- desde el SQL Editor y 'service_role' desde el servidor de HETNA.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    foreach c in array array[
      'plan', 'trial_hasta', 'activo', 'slug',
      'plan_estado', 'plan_renueva', 'plan_vence',
      'mp_suscripcion_id', 'mp_suscripcion_pendiente', 'mp_correo_pago',
      'pago_proveedor', 'pp_suscripcion_id', 'pp_suscripcion_pendiente',
      'meses_a_favor', 'referido_por', 'referido_codigo', 'referido_premio',
      'codigo_referido', 'arranque_bonus'
    ] loop
      if (antes -> c) is distinct from (ahora -> c) then
        raise exception 'Ese dato del taller no se puede cambiar desde la app';
      end if;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists tr_proteger_plan on public.negocios;
create trigger tr_proteger_plan before update on public.negocios
  for each row execute function public.proteger_plan_negocio();

-- 2) Llaves viejas de facturación en una tabla que la app lee (OPCIONAL).
--    Hoy las llaves viven en negocios_facturapi (sólo servidor), pero puede
--    quedar una copia vieja en configuracion_empresa.factura_api_key. Borrarla
--    no tiene vuelta atrás, así que NO se hace sola. Primero mira cuántas hay:
--
--      select count(*) from public.configuracion_empresa where factura_api_key is not null;
--
--    Si salen, confirma que todos tus talleres ya usan la versión actual de la
--    app (la que factura a través de hetnacnc.com) y entonces corre:
--
--      create table if not exists public._respaldo_factura_api_key as
--        select negocio_id, factura_api_key from public.configuracion_empresa where factura_api_key is not null;
--      alter table public._respaldo_factura_api_key enable row level security;
--      update public.configuracion_empresa set factura_api_key = null where factura_api_key is not null;

-- 3) REVISIÓN (sólo lee). Corre cada consulta y revisa el resultado:

-- 3a) Tablas SIN seguridad por renglón (RLS). No debería salir ninguna con
--     datos de talleres o clientes: con el repositorio público y la llave
--     pública dentro de la app, una tabla sin RLS se lee con una sola petición.
select c.relname as tabla
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;

-- 3b) Políticas que dejan pasar a cualquiera (using true / with check true)
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname in ('public', 'storage') and (qual = 'true' or with_check = 'true');

-- 3c) Funciones con permisos elevados que puede ejecutar alguien sin sesión
select p.proname as funcion
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
 order by 1;

-- 3d) Carpetas de archivos públicas
select id, public from storage.buckets order by 1;
