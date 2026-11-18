// Columnas de Publicidad 2.0 (solo servidor). Se agregan solas la primera vez
// que el sitio las necesita, así el despliegue no depende de correr SQL a mano.
// Todo es "add column if not exists": se puede correr mil veces sin dañar nada.
//
//   piezas.vistas_objetivo   paquete de vistas: el anuncio sale hasta llegar a esa cifra
//   piezas.pedido_id         el pedido pagado que lo creó
//   piezas.tipo_anunciante   'hetna' (de la casa), 'cnc' (taller/proveedor) o 'marca' (otro giro)
//   pedidos.modalidad        'periodo' (días) o 'vistas' (paquete de vistas)
//   pedidos.vistas_compradas cuántas vistas compró (sólo modalidad 'vistas')
//   pedidos.tipo_anunciante  'cnc' o 'marca'
//   pedidos.token            llave del panel del anunciante (/anunciate/mi-anuncio)
//   pedidos.dias             ahora 7, 30, 90 o 365 (y 365 como plazo máximo de un paquete de vistas)
import { db } from "@/lib/foro/db"

const g = globalThis as unknown as { __hetnaPubEsquema?: Promise<void> }

const SQL = `
alter table publicidad.piezas add column if not exists vistas_objetivo int;
alter table publicidad.piezas add column if not exists pedido_id uuid;
alter table publicidad.piezas add column if not exists tipo_anunciante text not null default 'hetna';
alter table publicidad.pedidos add column if not exists modalidad text not null default 'periodo';
alter table publicidad.pedidos add column if not exists vistas_compradas int;
alter table publicidad.pedidos add column if not exists tipo_anunciante text not null default 'cnc';
alter table publicidad.pedidos add column if not exists token text;
do $$ begin
  if exists (select 1 from pg_constraint where conrelid = 'publicidad.pedidos'::regclass
             and conname = 'pedidos_dias_check' and pg_get_constraintdef(oid) not like '%365%') then
    alter table publicidad.pedidos drop constraint pedidos_dias_check;
    alter table publicidad.pedidos add constraint pedidos_dias_check check (dias in (7, 30, 90, 365));
  end if;
end $$;
`

/** Deja la base lista para Publicidad 2.0. Una sola vez por proceso; si falla, se vuelve a intentar después. */
export function asegurarEsquema(): Promise<void> {
  if (g.__hetnaPubEsquema) return g.__hetnaPubEsquema
  const nuevo: Promise<void> = db()
    .query(SQL)
    .then(() => undefined)
    .catch((e: unknown) => {
      g.__hetnaPubEsquema = undefined
      console.error("[publicidad] esquema", e instanceof Error ? e.message : e)
      throw e
    })
  g.__hetnaPubEsquema = nuevo
  return nuevo
}
