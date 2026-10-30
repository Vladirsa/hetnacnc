import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261030120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" add column if not exists "medida_mm" real null, add column if not exists "escala_real" boolean null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "escaneo_3d" drop column if exists "medida_mm", drop column if exists "escala_real";`);
  }

}
