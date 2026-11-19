import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Biblioteca de recursos de la Academia (ligas externas con crédito).
export class Migration20261119120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "learning_resource" (
      "id" text not null,
      "titulo" text not null,
      "descripcion" text not null default '',
      "url" text not null,
      "fuente" text not null,
      "categoria" text not null,
      "tipo" text not null default 'guia',
      "imagen_url" text null,
      "destacado" boolean not null default false,
      "orden" integer not null default 0,
      "publicado" boolean not null default true,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "learning_resource_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_learning_resource_deleted_at" ON "learning_resource" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_learning_resource_url_unique" ON "learning_resource" ("url") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "learning_resource" cascade;`)
  }
}
