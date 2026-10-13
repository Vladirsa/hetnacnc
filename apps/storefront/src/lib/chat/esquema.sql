-- =====================================================================
-- CHAT CLIENTE <-> TALLER (HETNA CNC)
-- Se ejecuta UNA vez en la misma base del foro (HETNA_FORO_DB / HETNA_TALLER_DB).
-- Es seguro correrlo varias veces: no borra nada.
-- =====================================================================
create schema if not exists chat;

-- Una conversación = un cliente + un taller (+ opcionalmente un producto)
create table if not exists chat.conversaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null,
  cliente_nombre text not null,
  cliente_correo text,
  taller_id text not null,
  taller_handle text not null,
  taller_nombre text not null,
  producto_handle text,
  producto_titulo text,
  producto_clave text generated always as (coalesce(producto_handle, '')) stored,
  -- Llave privada del taller: con este enlace responde sin necesitar cuenta
  token_taller text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  marcada boolean not null default false, -- true = intentó saltarse el filtro 3 veces o más
  sin_leer_cliente int not null default 0,
  sin_leer_taller int not null default 0,
  creado timestamptz not null default now(),
  ultimo_mensaje timestamptz not null default now(),
  unique (cliente_id, taller_id, producto_clave)
);
create index if not exists conv_cliente_idx on chat.conversaciones (cliente_id, ultimo_mensaje desc);
create index if not exists conv_taller_idx on chat.conversaciones (taller_id, ultimo_mensaje desc);

create table if not exists chat.mensajes (
  id bigserial primary key,
  conversacion_id uuid not null references chat.conversaciones (id) on delete cascade,
  de text not null check (de in ('cliente', 'taller')),
  cuerpo text not null check (char_length(cuerpo) between 1 and 2000),
  creado timestamptz not null default now()
);
create index if not exists msg_conv_idx on chat.mensajes (conversacion_id, id);

-- Intentos bloqueados por el filtro (para moderar). Guarda el texto original.
create table if not exists chat.bloqueos (
  id bigserial primary key,
  conversacion_id uuid references chat.conversaciones (id) on delete set null,
  autor_clave text not null, -- 'c:<id del cliente>' o 't:<id del taller>'
  motivos text[] not null,
  texto_original text not null,
  revisado boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists bloq_autor_idx on chat.bloqueos (autor_clave, creado desc);

-- Vista para que Vlado revise a quién vigilar (se consulta desde psql o desde Supabase)
create or replace view chat.v_moderacion as
  select b.autor_clave, count(*) as intentos, max(b.creado) as ultimo_intento,
         array_agg(distinct m) as motivos
  from chat.bloqueos b, unnest(b.motivos) m
  where b.creado > now() - interval '30 days'
  group by b.autor_clave
  having count(*) >= 3
  order by count(*) desc;

-- Seguridad: la tienda entra con el usuario dueño de las tablas; nadie más puede leerlas
alter table chat.conversaciones enable row level security;
alter table chat.mensajes enable row level security;
alter table chat.bloqueos enable row level security;
