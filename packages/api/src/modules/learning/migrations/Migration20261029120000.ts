import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Blog del foro: sección, guía fija y autor de cada artículo.
export class Migration20261029120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "learning_article" add column if not exists "categoria" text null;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "guia" boolean not null default false;`)
    this.addSql(`alter table if exists "learning_article" add column if not exists "autor" text null;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_learning_article_categoria" ON "learning_article" ("categoria") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_learning_article_categoria";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "autor";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "guia";`)
    this.addSql(`alter table if exists "learning_article" drop column if exists "categoria";`)
  }
}
