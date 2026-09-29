-- HetNa Taller: cuentas de taller y cotizaciones
-- Esquema propio "taller": no toca ninguna tabla de Medusa/Mercur.
-- Se puede correr varias veces sin duplicar nada.

CREATE SCHEMA IF NOT EXISTS taller;

CREATE TABLE IF NOT EXISTS taller.cuentas (
  customer_id     text PRIMARY KEY,           -- id del cliente de la tienda (Medusa)
  correo          text,
  nombre_contacto text,
  nombre_taller   text,
  whatsapp        text,
  plan            text NOT NULL DEFAULT 'gratis',   -- gratis | taller | pro | industrial
  plan_hasta      timestamptz,                      -- fin del periodo pagado
  prueba_hasta    timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  folio           integer NOT NULL DEFAULT 1,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tarifas, costos, materiales, logo, condiciones
  creado          timestamptz NOT NULL DEFAULT now(),
  actualizado     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_valido CHECK (plan IN ('gratis', 'taller', 'pro', 'industrial'))
);

CREATE TABLE IF NOT EXISTS taller.cotizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     text NOT NULL REFERENCES taller.cuentas(customer_id) ON DELETE CASCADE,
  folio           text NOT NULL,
  cliente_nombre  text,
  cliente_tel     text,
  servicio        text NOT NULL,
  tipo            text,
  archivo         text,
  cantidad        integer NOT NULL DEFAULT 1,
  elegida         text NOT NULL DEFAULT 'estandar',
  opciones        jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_estandar  numeric NOT NULL DEFAULT 0,
  mensaje         text,
  datos           jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado          text NOT NULL DEFAULT 'Enviada',   -- Enviada | Aceptada | Perdida
  creado          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estado_valido CHECK (estado IN ('Enviada', 'Aceptada', 'Perdida'))
);
-- Contador de uso del mes (no baja aunque se borren cotizaciones)
ALTER TABLE taller.cuentas ADD COLUMN IF NOT EXISTS uso_mes text;
ALTER TABLE taller.cuentas ADD COLUMN IF NOT EXISTS uso_n integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_taller_cot_cliente_fecha ON taller.cotizaciones (customer_id, creado DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taller_cot_folio ON taller.cotizaciones (customer_id, folio);

-- Resumen para HETNA: talleres por plan y uso del mes
CREATE OR REPLACE VIEW taller.resumen AS
SELECT c.customer_id, c.correo, c.nombre_taller, c.whatsapp, c.plan, c.plan_hasta, c.prueba_hasta, c.creado,
       c.uso_mes, c.uso_n AS cotizaciones_mes,
       (SELECT count(*) FROM taller.cotizaciones q WHERE q.customer_id = c.customer_id) AS cotizaciones_total
FROM taller.cuentas c;
