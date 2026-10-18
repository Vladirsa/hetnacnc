import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261018225924 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cotizador_cotizacion" drop constraint if exists "cotizador_cotizacion_token_publico_unique";`);
    this.addSql(`alter table if exists "cotizador_perfil" drop constraint if exists "cotizador_perfil_customer_id_unique";`);
    this.addSql(`create table if not exists "cotizador_perfil" ("id" text not null, "customer_id" text not null, "nombre_comercial" text not null, "razon_social" text null, "rfc" text null, "direccion" text null, "ciudad" text null, "estado" text null, "cp" text null, "pais" text not null default 'México', "telefono" text null, "whatsapp" text null, "correo" text null, "sitio_web" text null, "logo_url" text null, "moneda" text check ("moneda" in ('MXN', 'USD')) not null default 'MXN', "iva_pct" real not null default 16, "vigencia_dias" integer not null default 15, "costo_hora_taller" real not null default 0, "costo_hora_maquina" real not null default 0, "costo_hora_operador" real not null default 0, "margen_minimo" real not null default 0, "margen_recomendado" real not null default 0, "tarifas" jsonb null, "folio_prefijo" text not null default 'QT', "folio_consecutivo" integer not null default 0, "terminos_estandar" text null, "condiciones_pago_default" text null, "dias_entrega_default" integer null, "firma_nombre" text null, "firma_puesto" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cotizador_perfil_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_perfil_deleted_at" ON "cotizador_perfil" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cotizador_perfil_customer_id_unique" ON "cotizador_perfil" ("customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cotizador_cotizacion" ("id" text not null, "folio" text not null, "revision" text not null default 'A', "moneda" text check ("moneda" in ('MXN', 'USD')) not null default 'MXN', "fecha" timestamptz not null, "vigencia_hasta" timestamptz null, "proyecto_referencia" text null, "cliente_nombre" text not null, "cliente_empresa" text null, "cliente_correo" text null, "cliente_telefono" text null, "cliente_rfc" text null, "cliente_direccion" text null, "resumen_ejecutivo" text null, "alcance_incluye" jsonb null, "alcance_no_incluye" jsonb null, "supuestos" text null, "tecnico" jsonb null, "adjuntos" jsonb null, "condiciones_pago" text null, "anticipo_pct" integer null, "dias_entrega" integer null, "incoterm" text null, "calidad" text null, "subtotal" numeric not null default 0, "descuento" numeric not null default 0, "iva" numeric not null default 0, "envio" numeric not null default 0, "total" numeric not null default 0, "estatus" text check ("estatus" in ('borrador', 'enviada', 'vista', 'aceptada', 'rechazada', 'vencida')) not null default 'borrador', "enviada_en" timestamptz null, "vista_en" timestamptz null, "respondida_en" timestamptz null, "aceptada_por" text null, "aceptada_firma" text null, "pdf_storage_key" text null, "token_publico" text null, "notas_internas" text null, "perfil_id" text not null, "raw_subtotal" jsonb not null default '{"value":"0","precision":20}', "raw_descuento" jsonb not null default '{"value":"0","precision":20}', "raw_iva" jsonb not null default '{"value":"0","precision":20}', "raw_envio" jsonb not null default '{"value":"0","precision":20}', "raw_total" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cotizador_cotizacion_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_cotizacion_perfil_id" ON "cotizador_cotizacion" ("perfil_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_cotizacion_deleted_at" ON "cotizador_cotizacion" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_cotizacion_folio" ON "cotizador_cotizacion" ("folio") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cotizador_cotizacion_token_publico_unique" ON "cotizador_cotizacion" ("token_publico") WHERE deleted_at IS NULL AND token_publico IS NOT NULL;`);

    this.addSql(`create table if not exists "cotizador_partida" ("id" text not null, "posicion" integer not null default 0, "concepto" text not null, "descripcion" text null, "cantidad" real not null default 1, "unidad" text not null default 'pza', "precio_unitario" numeric not null default 0, "subtotal" numeric not null default 0, "desglose" jsonb null, "material" text null, "proceso" text null, "tolerancia" text null, "acabado" text null, "setups" integer null, "cotizacion_id" text not null, "raw_precio_unitario" jsonb not null default '{"value":"0","precision":20}', "raw_subtotal" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cotizador_partida_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_partida_cotizacion_id" ON "cotizador_partida" ("cotizacion_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cotizador_partida_deleted_at" ON "cotizador_partida" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "cotizador_cotizacion" add constraint "cotizador_cotizacion_perfil_id_foreign" foreign key ("perfil_id") references "cotizador_perfil" ("id") on update cascade;`);

    this.addSql(`alter table if exists "cotizador_partida" add constraint "cotizador_partida_cotizacion_id_foreign" foreign key ("cotizacion_id") references "cotizador_cotizacion" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cotizador_cotizacion" drop constraint if exists "cotizador_cotizacion_perfil_id_foreign";`);

    this.addSql(`alter table if exists "cotizador_partida" drop constraint if exists "cotizador_partida_cotizacion_id_foreign";`);

    this.addSql(`drop table if exists "cotizador_perfil" cascade;`);

    this.addSql(`drop table if exists "cotizador_cotizacion" cascade;`);

    this.addSql(`drop table if exists "cotizador_partida" cascade;`);
  }

}
