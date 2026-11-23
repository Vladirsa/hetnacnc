import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261123120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ml_cuenta" ("id" text not null, "seller_id" text not null, "ml_user_id" text not null, "apodo" text null, "access_token" text not null, "refresh_token" text not null, "expira_en" timestamptz not null, "user_products" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ml_cuenta_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ml_cuenta_seller_id_unique" ON "ml_cuenta" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ml_cuenta_deleted_at" ON "ml_cuenta" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ml_publicacion" ("id" text not null, "seller_id" text not null, "product_id" text not null, "offer_id" text null, "ml_item_id" text null, "permalink" text null, "categoria_id" text null, "estado" text not null default 'active', "precio" numeric null, "existencia" integer null, "raw_precio" jsonb null, "ultimo_error" text null, "sincronizado_en" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ml_publicacion_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ml_publicacion_seller_id_product_id_unique" ON "ml_publicacion" ("seller_id", "product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ml_publicacion_ml_item_id" ON "ml_publicacion" ("ml_item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ml_publicacion_deleted_at" ON "ml_publicacion" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ml_publicacion" cascade;`);
    this.addSql(`drop table if exists "ml_cuenta" cascade;`);
  }

}
