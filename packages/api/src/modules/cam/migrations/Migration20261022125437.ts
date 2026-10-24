import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261022125437 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cam_job" ("id" text not null, "status" text check ("status" in ('received', 'in_cart', 'paid', 'in_review', 'delivered', 'cancelled')) not null default 'received', "service" text check ("service" in ('cam_3', 'cam_4', 'cam_5', 'post')) not null, "tier" text null, "access_token" text not null, "customer_id" text null, "email" text null, "cart_id" text null, "order_id" text null, "model_name" text not null, "model_file_id" text null, "model_file_url" text null, "gcode_file_id" text null, "gcode_file_url" text null, "deliverables" jsonb null, "controller" text null, "kinematics" text null, "config" jsonb not null, "stats" jsonb null, "review_requested" boolean not null default false, "customer_notes" text null, "internal_notes" text null, "paid_at" timestamptz null, "delivered_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cam_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cam_job_deleted_at" ON "cam_job" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cam_job_order_id" ON "cam_job" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cam_job_customer_id" ON "cam_job" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cam_job_status" ON "cam_job" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cam_job" cascade;`);
  }

}
