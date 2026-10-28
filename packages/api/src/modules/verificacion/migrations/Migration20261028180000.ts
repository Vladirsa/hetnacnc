import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "verificacion_taller" ("id" text not null, "seller_id" text not null, "estado" text not null default 'borrador', "archivos" jsonb null, "motivo" text null, "enviado_en" timestamptz null, "revisado_en" timestamptz null, "revisado_por" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "verificacion_taller_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_verificacion_taller_seller_id_unique" ON "verificacion_taller" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_verificacion_taller_estado" ON "verificacion_taller" ("estado") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_verificacion_taller_deleted_at" ON "verificacion_taller" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "verificacion_taller" cascade;`);
  }

}
