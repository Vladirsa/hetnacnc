-- ============================================================
-- HETNA CNC · Módulo de banners y publicidad (Etapa 1)
-- Pégalo completo en Supabase > SQL Editor > Run. Se puede correr más de una vez sin problema.
-- ============================================================
create schema if not exists publicidad;

create table if not exists publicidad.piezas (
  id               uuid primary key default gen_random_uuid(),
  espacio          text        not null,                 -- dónde se muestra (carrusel_principal, banner_promo, ...)
  titulo           text        not null default '',
  subtitulo        text,
  boton            text,                                 -- texto del botón (opcional)
  enlace           text        not null default '/',     -- a dónde lleva al hacer clic
  imagen_url       text,                                 -- imagen de fondo / banner
  imagen_movil_url text,                                 -- versión para celular (opcional)
  video_url        text,                                 -- video MP4 corto (opcional)
  anunciante       text,                                 -- nombre del taller / empresa que paga
  es_publicidad    boolean     not null default false,   -- true = muestra la etiqueta "Publicidad"
  orden            int         not null default 0,       -- menor número = aparece primero
  desde            timestamptz not null default now(),   -- empieza a mostrarse
  hasta            timestamptz,                          -- deja de mostrarse (vacío = sin fecha de fin)
  activo           boolean     not null default true,
  vistas           int         not null default 0,
  clics            int         not null default 0,
  creado           timestamptz not null default now()
);

create index if not exists piezas_espacio_idx on publicidad.piezas (espacio, activo, orden);

-- Seguridad: nadie entra por la API pública de Supabase; solo el servidor del sitio.
alter table publicidad.piezas enable row level security;
