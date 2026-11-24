import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261124120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "sim_resultado" ("id" text not null, "customer_id" text not null, "ejercicio_id" text not null, "version" integer not null default 1, "mejor_calificacion" integer not null default 0, "intentos" integer not null default 0, "aprobado_en" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sim_resultado_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sim_resultado_customer_id_ejercicio_id_unique" ON "sim_resultado" ("customer_id", "ejercicio_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sim_resultado_customer_id" ON "sim_resultado" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sim_resultado_deleted_at" ON "sim_resultado" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sim_resultado" cascade;`);
  }

}
