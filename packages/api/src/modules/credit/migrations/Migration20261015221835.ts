import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015221835 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "credit_balance" drop constraint if exists "credit_balance_customer_id_unique";`);
    this.addSql(`create table if not exists "credit_balance" ("id" text not null, "customer_id" text not null, "balance" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "credit_balance_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_balance_deleted_at" ON "credit_balance" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_credit_balance_customer_id_unique" ON "credit_balance" ("customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "credit_ledger_entry" ("id" text not null, "customer_id" text not null, "amount" integer not null, "type" text check ("type" in ('compra', 'consumo', 'reembolso', 'ajuste')) not null, "reference_id" text null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "credit_ledger_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_ledger_entry_deleted_at" ON "credit_ledger_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_credit_ledger_entry_customer_id" ON "credit_ledger_entry" ("customer_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "credit_balance" cascade;`);

    this.addSql(`drop table if exists "credit_ledger_entry" cascade;`);
  }

}
