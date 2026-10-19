import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261019003244 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cotizador_cotizacion" drop constraint if exists "cotizador_cotizacion_perfil_id_folio_revision_unique";`);
    this.addSql(`alter table if exists "cotizador_perfil" add column if not exists "nombre_contacto" text null, add column if not exists "plan" text check ("plan" in ('gratis', 'taller', 'pro', 'industrial')) not null default 'gratis', add column if not exists "plan_hasta" timestamptz null, add column if not exists "prueba_hasta" timestamptz null, add column if not exists "uso_mes" text null, add column if not exists "uso_n" integer not null default 0;`);

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cotizador_cotizacion_perfil_id_folio_revision_unique" ON "cotizador_cotizacion" ("perfil_id", "folio", "revision") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cotizador_perfil" drop column if exists "nombre_contacto", drop column if exists "plan", drop column if exists "plan_hasta", drop column if exists "prueba_hasta", drop column if exists "uso_mes", drop column if exists "uso_n";`);

    this.addSql(`drop index if exists "IDX_cotizador_cotizacion_perfil_id_folio_revision_unique";`);
  }

}
