-- ============================================================
-- HETNA CNC · Publicidad Etapa 2: pedidos de anunciantes (cobro con Mercado Pago)
-- Pégalo completo en Supabase > SQL Editor > Run. Se puede correr más de una vez.
-- ============================================================
create table if not exists publicidad.pedidos (
  id              uuid primary key default gen_random_uuid(),
  espacio         text          not null,
  dias            int           not null check (dias in (30, 90)),
  monto           numeric(10,2) not null,
  anunciante      text          not null,
  nombre          text,
  correo          text          not null,
  telefono        text,
  titulo          text          not null default '',
  subtitulo       text,
  boton           text,
  enlace          text          not null,
  imagen          bytea,
  imagen_tipo     text,
  estado          text          not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'rechazado', 'vencido')),
  mp_preferencia  text,
  mp_pago         text,
  pieza_id        uuid,
  pagado_en       timestamptz,
  vence           timestamptz,
  recordado       boolean       not null default false,
  creado          timestamptz   not null default now()
);

create index if not exists pedidos_estado_idx on publicidad.pedidos (estado, vence);
alter table publicidad.pedidos enable row level security;
