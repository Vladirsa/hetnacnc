import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025190000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "producto_vista" ("id" text not null, "product_id" text not null, "seller_id" text null, "dia" text not null, "total" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "producto_vista_pkey" primary key ("id"));`);
    // Única por producto y día: es lo que hace que el conteo se pueda sumar sin
    // duplicar filas, y lo que permite un UPSERT en vez de leer-y-escribir.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_producto_vista_producto_dia" ON "producto_vista" ("product_id", "dia") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_producto_vista_seller_dia" ON "producto_vista" ("seller_id", "dia") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_producto_vista_dia" ON "producto_vista" ("dia") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_producto_vista_deleted_at" ON "producto_vista" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "producto_vista" cascade;`);
  }

}
