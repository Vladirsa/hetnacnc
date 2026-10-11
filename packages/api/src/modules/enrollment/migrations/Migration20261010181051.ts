import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010181051 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "lesson_progress" drop constraint if exists "lesson_progress_enrollment_id_lesson_id_unique";`);
    this.addSql(`alter table if exists "enrollment" drop constraint if exists "enrollment_customer_id_course_id_unique";`);
    this.addSql(`create table if not exists "enrollment" ("id" text not null, "customer_id" text not null, "course_id" text not null, "order_id" text null, "enrolled_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "enrollment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_enrollment_deleted_at" ON "enrollment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_enrollment_customer_id_course_id_unique" ON "enrollment" ("customer_id", "course_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "lesson_progress" ("id" text not null, "lesson_id" text not null, "completed_at" timestamptz null, "last_position_seconds" integer not null default 0, "enrollment_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "lesson_progress_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lesson_progress_enrollment_id" ON "lesson_progress" ("enrollment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_lesson_progress_deleted_at" ON "lesson_progress" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lesson_progress_enrollment_id_lesson_id_unique" ON "lesson_progress" ("enrollment_id", "lesson_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "lesson_progress" add constraint "lesson_progress_enrollment_id_foreign" foreign key ("enrollment_id") references "enrollment" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "lesson_progress" drop constraint if exists "lesson_progress_enrollment_id_foreign";`);

    this.addSql(`drop table if exists "enrollment" cascade;`);

    this.addSql(`drop table if exists "lesson_progress" cascade;`);
  }

}
