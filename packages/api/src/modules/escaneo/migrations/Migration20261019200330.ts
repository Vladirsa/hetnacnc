import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261019200330 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "escaneo_3d" ("id" text not null, "customer_id" text not null, "modo" text check ("modo" in ('preview', 'scan')) not null, "titulo" text null, "estatus" text check ("estatus" in ('pendiente', 'procesando', 'listo', 'fallido')) not null default 'pendiente', "fotos" jsonb not null, "n_fotos" integer not null default 0, "job_externo" text null, "obj_storage_key" text null, "stl_storage_key" text null, "vertices" integer null, "caras" integer null, "watertight" boolean null, "bounding_box" jsonb null, "creditos_cobrados" integer not null default 0, "error" text null, "iniciado_en" timestamptz null, "terminado_en" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "escaneo_3d_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_escaneo_3d_deleted_at" ON "escaneo_3d" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_escaneo_3d_customer_id" ON "escaneo_3d" ("customer_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "escaneo_3d" cascade;`);
  }

}
