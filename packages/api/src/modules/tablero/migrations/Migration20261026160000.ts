import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261026160000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "taller_meta" ("id" text not null, "seller_id" text not null, "mes" text not null, "meta_ingresos" numeric not null default 0, "raw_meta_ingresos" jsonb not null, "moneda" text not null default 'mxn', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "taller_meta_pkey" primary key ("id"));`);
    // Única por taller y mes: es lo que permite guardar la meta con un upsert
    // en vez de leer-y-escribir, y lo que evita dos metas del mismo mes si el
    // taller le da dos veces a guardar.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_taller_meta_seller_mes" ON "taller_meta" ("seller_id", "mes") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_taller_meta_deleted_at" ON "taller_meta" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taller_meta" cascade;`);
  }

}
