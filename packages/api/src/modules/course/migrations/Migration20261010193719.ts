import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010193719 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course" add column if not exists "seller_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course" drop column if exists "seller_id";`);
  }

}
