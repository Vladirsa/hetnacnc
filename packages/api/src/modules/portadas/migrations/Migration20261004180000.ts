import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "hetna_portada" ("id" text not null, "etiqueta" text not null default '', "titulo" text not null, "texto" text not null default '', "imagen_url" text null, "boton1_texto" text null, "boton1_url" text null, "boton2_texto" text null, "boton2_url" text null, "orden" integer not null default 0, "activa" boolean not null default true, "inicia_en" timestamptz null, "termina_en" timestamptz null, "origen" text check ("origen" in ('hetna', 'vendedor')) not null default 'hetna', "seller_id" text null, "estado" text check ("estado" in ('pendiente_pago', 'en_revision', 'aprobada', 'rechazada')) not null default 'aprobada', "nota_admin" text null, "impresiones" integer not null default 0, "clics" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hetna_portada_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hetna_portada_deleted_at" ON "hetna_portada" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "hetna_portada" cascade;`);
  }
}
