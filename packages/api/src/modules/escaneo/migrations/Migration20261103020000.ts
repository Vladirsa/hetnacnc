import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103020000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" add column if not exists "opciones" jsonb null, add column if not exists "imagen_storage_key" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" drop column if exists "opciones", drop column if exists "imagen_storage_key";`);
  }

}
