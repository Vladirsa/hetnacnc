-- Registro de avisos de vencimiento de talleres fundadores (para avisar solo una vez por taller).
-- Corre este archivo UNA vez en Supabase (SQL Editor), en el proyecto del foro.
create schema if not exists publicidad;

create table if not exists publicidad.fundadores_avisos (
  seller_id text primary key,
  avisado_en timestamptz not null default now()
);

alter table publicidad.fundadores_avisos enable row level security;
