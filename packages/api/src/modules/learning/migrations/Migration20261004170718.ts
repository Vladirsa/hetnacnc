import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004170718 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "learning_article" drop constraint if exists "learning_article_slug_unique";`);
    this.addSql(`create table if not exists "learning_article" ("id" text not null, "slug" text not null, "title" text not null, "excerpt" text not null, "content_html" text not null, "cover_image_url" text null, "video_url" text null, "external_links" jsonb null, "seo_title" text null, "seo_description" text null, "source" text not null default 'manual', "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "learning_article_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_learning_article_slug_unique" ON "learning_article" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_learning_article_deleted_at" ON "learning_article" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "learning_article" cascade;`);
  }

}
