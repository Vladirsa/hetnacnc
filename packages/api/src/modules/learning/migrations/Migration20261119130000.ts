import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Blog: artículos escritos por instructores (talleres) con revisión de HETNA.
export class Migration20261119130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "learning_article" add column if not exists "seller_id" text null;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "revision" text null;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "motivo_revision" text null;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "aprobado_at" timestamptz null;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "texto_original" text null;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_learning_article_seller_id" ON "learning_article" ("seller_id") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_learning_article_seller_id";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "texto_original";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "aprobado_at";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "motivo_revision";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "revision";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "seller_id";`)
  }
}
