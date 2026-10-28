import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028190000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "descarga_gratis" ("id" text not null, "customer_id" text not null, "product_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "descarga_gratis_pkey" primary key ("id"));`);
    // El cupo se cuenta por cliente en los últimos 7 días: es la única
    // consulta que corre en cada descarga.
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_descarga_gratis_customer_id_created_at" ON "descarga_gratis" ("customer_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_descarga_gratis_deleted_at" ON "descarga_gratis" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "descarga_gratis" cascade;`);
  }

}
