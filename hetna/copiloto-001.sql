-- Copiloto IA CNC: uso por mes, maquinas del usuario y registro de preguntas.
-- Vive en el esquema "taller" junto con HetNa Taller. Se puede correr varias veces.

CREATE SCHEMA IF NOT EXISTS taller;

CREATE TABLE IF NOT EXISTS taller.copiloto (
  customer_id  text PRIMARY KEY REFERENCES taller.cuentas(customer_id) ON DELETE CASCADE,
  uso_mes      text,
  uso_n        integer NOT NULL DEFAULT 0,
  maquinas     jsonb NOT NULL DEFAULT '[]'::jsonb,   -- perfiles "Mi maquina"
  creado       timestamptz NOT NULL DEFAULT now()
);

-- Visitantes sin cuenta: preguntas por dia (la IP se guarda cifrada, no se puede leer)
CREATE TABLE IF NOT EXISTS taller.copiloto_anon (
  clave  text NOT NULL,
  dia    text NOT NULL,
  n      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clave, dia)
);

-- Registro de preguntas: para medir el gasto de IA y mejorar las respuestas
CREATE TABLE IF NOT EXISTS taller.copiloto_log (
  id            bigserial PRIMARY KEY,
  customer_id   text,
  anon          text,
  plan          text,
  modelo        text,
  pregunta      text,
  herramientas  text[],
  adjunto       text,
  tokens_in     integer,
  tokens_out    integer,
  ms            integer,
  creado        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copiloto_log_fecha ON taller.copiloto_log (creado DESC);

-- Resumen diario para HETNA: preguntas, usuarios y tokens por modelo
CREATE OR REPLACE VIEW taller.copiloto_resumen AS
SELECT (creado AT TIME ZONE 'America/Mexico_City')::date AS dia, modelo,
       count(*) AS preguntas,
       count(DISTINCT coalesce(customer_id, anon)) AS usuarios,
       sum(tokens_in) AS tokens_entrada, sum(tokens_out) AS tokens_salida
FROM taller.copiloto_log GROUP BY 1, 2 ORDER BY 1 DESC, 2;
