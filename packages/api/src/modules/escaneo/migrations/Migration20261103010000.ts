import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103010000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" add column if not exists "glb_storage_key" text null, add column if not exists "proveedor" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" drop column if exists "glb_storage_key", drop column if exists "proveedor";`);
  }

}
