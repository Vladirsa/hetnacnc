import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028200000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "verificacion_taller" add column if not exists "consentimiento_en" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "verificacion_taller" drop column if exists "consentimiento_en";`);
  }

}
