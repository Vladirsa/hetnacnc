import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010181050 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course" drop constraint if exists "course_slug_unique";`);
    this.addSql(`create table if not exists "course" ("id" text not null, "title" text not null, "slug" text not null, "description" text null, "thumbnail_url" text null, "level" text check ("level" in ('principiante', 'intermedio', 'avanzado')) not null default 'principiante', "language" text not null default 'es', "status" text check ("status" in ('draft', 'published')) not null default 'draft', "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "course_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_course_slug_unique" ON "course" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_deleted_at" ON "course" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "course_section" ("id" text not null, "title" text not null, "position" integer not null default 0, "course_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "course_section_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_section_course_id" ON "course_section" ("course_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_section_deleted_at" ON "course_section" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lesson" ("id" text not null, "title" text not null, "description" text null, "position" integer not null default 0, "video_provider" text null, "video_asset_id" text null, "duration_seconds" integer null, "is_preview" boolean not null default false, "section_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lesson_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lesson_section_id" ON "lesson" ("section_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lesson_deleted_at" ON "lesson" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "course_section" add constraint "course_section_course_id_foreign" foreign key ("course_id") references "course" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "lesson" add constraint "lesson_section_id_foreign" foreign key ("section_id") references "course_section" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_section" drop constraint if exists "course_section_course_id_foreign";`);

    this.addSql(`alter table if exists "lesson" drop constraint if exists "lesson_section_id_foreign";`);

    this.addSql(`drop table if exists "course" cascade;`);

    this.addSql(`drop table if exists "course_section" cascade;`);

    this.addSql(`drop table if exists "lesson" cascade;`);
  }

}
