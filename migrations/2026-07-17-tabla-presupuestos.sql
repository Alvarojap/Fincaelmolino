-- =============================================================================
-- Migración: tablas presupuestos + presupuesto_lineas
-- Fecha: 2026-07-17
-- Módulo Presupuestos — generar presupuestos para clientes y exportar a PDF
-- =============================================================================
-- Cambios:
--  1. Secuencia presupuestos_numero_seq para numerar presupuestos de forma
--     legible y correlativa (PRE-000001, PRE-000002, …).
--  2. CREATE TABLE presupuestos (cabecera: cliente, estado, IVA, descuento,
--     validez, condiciones, total cacheado que la app mantiene al guardar).
--  3. CREATE TABLE presupuesto_lineas (líneas de detalle N:1 con presupuestos,
--     opcionalmente enlazadas a catalogo_servicios ON DELETE SET NULL).
--  4. Índices, trigger updated_at y RLS admin-only (mismo patrón que
--     proveedor_servicios).
--
-- TODO en transacción única: o se aplica todo o nada.
-- IDEMPOTENTE: re-ejecutable sin romper.
-- =============================================================================

BEGIN;

-- 0) Secuencia de numeración -------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS presupuestos_numero_seq START 1;

-- 1) Tabla presupuestos (cabecera) -------------------------------------------
CREATE TABLE IF NOT EXISTS presupuestos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                INTEGER NOT NULL DEFAULT nextval('presupuestos_numero_seq'),
  titulo                TEXT,
  cliente_nombre        TEXT NOT NULL DEFAULT '',
  cliente_email         TEXT,
  cliente_telefono      TEXT,
  evento_fecha          DATE,
  reserva_vinculada_id  UUID,
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  validez_dias          INTEGER NOT NULL DEFAULT 30,
  estado                TEXT NOT NULL DEFAULT 'borrador'
                          CHECK (estado IN ('borrador','enviado','aceptado','rechazado')),
  con_iva               BOOLEAN NOT NULL DEFAULT true,
  iva_pct               NUMERIC(5,2) NOT NULL DEFAULT 21,
  descuento_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas                 TEXT,
  condiciones           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  presupuestos                      IS 'Cabecera de presupuestos que se generan para clientes (servicios adicionales, finca, etc.) y se exportan a PDF.';
COMMENT ON COLUMN presupuestos.numero               IS 'Número correlativo legible (se muestra como PRE-000123). Default vía secuencia.';
COMMENT ON COLUMN presupuestos.titulo               IS 'Título opcional del presupuesto (ej: "Boda Ana & Luis - Iluminación y sonido").';
COMMENT ON COLUMN presupuestos.cliente_nombre       IS 'Nombre del cliente destinatario. NOT NULL (default vacío para evitar romper inserts parciales).';
COMMENT ON COLUMN presupuestos.evento_fecha         IS 'Fecha del evento al que se refiere el presupuesto (opcional).';
COMMENT ON COLUMN presupuestos.reserva_vinculada_id IS 'Reserva asociada (opcional). Sin FK dura para no acoplar módulos.';
COMMENT ON COLUMN presupuestos.validez_dias         IS 'Días de validez de la oferta desde la fecha del presupuesto.';
COMMENT ON COLUMN presupuestos.estado               IS 'borrador | enviado | aceptado | rechazado.';
COMMENT ON COLUMN presupuestos.con_iva              IS 'Si true, el total y el PDF desglosan IVA al iva_pct.';
COMMENT ON COLUMN presupuestos.iva_pct              IS 'Porcentaje de IVA aplicado cuando con_iva=true (21 por defecto).';
COMMENT ON COLUMN presupuestos.descuento_pct        IS 'Descuento global en % aplicado sobre el subtotal de líneas.';
COMMENT ON COLUMN presupuestos.total                IS 'Total final cacheado (lo mantiene la app al guardar) para pintar la lista sin recomputar líneas.';
COMMENT ON COLUMN presupuestos.condiciones          IS 'Condiciones/observaciones que se imprimen en el PDF para el cliente.';

-- 2) Tabla presupuesto_lineas (detalle) --------------------------------------
CREATE TABLE IF NOT EXISTS presupuesto_lineas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id        UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  catalogo_servicio_id  UUID REFERENCES catalogo_servicios(id) ON DELETE SET NULL,
  nombre                TEXT NOT NULL DEFAULT '',
  descripcion           TEXT,
  unidad                TEXT,
  cantidad              NUMERIC(12,2) NOT NULL DEFAULT 1,
  precio_unitario       NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden                 INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  presupuesto_lineas                      IS 'Líneas de detalle de un presupuesto. Pueden nacer del catálogo o ser libres.';
COMMENT ON COLUMN presupuesto_lineas.presupuesto_id       IS 'FK a presupuestos.id. ON DELETE CASCADE.';
COMMENT ON COLUMN presupuesto_lineas.catalogo_servicio_id IS 'FK opcional a catalogo_servicios.id. ON DELETE SET NULL (borrar la plantilla no borra la línea).';
COMMENT ON COLUMN presupuesto_lineas.cantidad             IS 'Cantidad de la línea.';
COMMENT ON COLUMN presupuesto_lineas.precio_unitario      IS 'Precio unitario (cliente) de la línea. El importe de línea = cantidad * precio_unitario.';
COMMENT ON COLUMN presupuesto_lineas.orden                IS 'Orden de aparición en el presupuesto/PDF.';

-- 3) Índices ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS presupuesto_lineas_presupuesto_id_idx
  ON presupuesto_lineas (presupuesto_id);
CREATE INDEX IF NOT EXISTS presupuestos_estado_idx
  ON presupuestos (estado);
CREATE INDEX IF NOT EXISTS presupuestos_fecha_idx
  ON presupuestos (fecha DESC);

-- 4) set_updated_at (reutilizada) --------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presupuestos_updated_at ON presupuestos;
CREATE TRIGGER trg_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 5) RLS — sólo rol admin -----------------------------------------------------
ALTER TABLE presupuestos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_lineas ENABLE ROW LEVEL SECURITY;

-- presupuestos
DROP POLICY IF EXISTS presupuestos_select_admin ON presupuestos;
DROP POLICY IF EXISTS presupuestos_insert_admin ON presupuestos;
DROP POLICY IF EXISTS presupuestos_update_admin ON presupuestos;
DROP POLICY IF EXISTS presupuestos_delete_admin ON presupuestos;

CREATE POLICY presupuestos_select_admin ON presupuestos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuestos_insert_admin ON presupuestos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuestos_update_admin ON presupuestos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuestos_delete_admin ON presupuestos
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));

-- presupuesto_lineas
DROP POLICY IF EXISTS presupuesto_lineas_select_admin ON presupuesto_lineas;
DROP POLICY IF EXISTS presupuesto_lineas_insert_admin ON presupuesto_lineas;
DROP POLICY IF EXISTS presupuesto_lineas_update_admin ON presupuesto_lineas;
DROP POLICY IF EXISTS presupuesto_lineas_delete_admin ON presupuesto_lineas;

CREATE POLICY presupuesto_lineas_select_admin ON presupuesto_lineas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuesto_lineas_insert_admin ON presupuesto_lineas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuesto_lineas_update_admin ON presupuesto_lineas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));
CREATE POLICY presupuesto_lineas_delete_admin ON presupuesto_lineas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'admin'));

COMMIT;

-- =============================================================================
-- FIN MIGRACIÓN
-- =============================================================================
-- Queries de testing (ejecutar tras el COMMIT):
--
-- a) Estructura de presupuestos
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'presupuestos' ORDER BY ordinal_position;
--
-- b) Estructura de presupuesto_lineas
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'presupuesto_lineas' ORDER BY ordinal_position;
--
-- c) RLS activado y 4 políticas por tabla
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename IN ('presupuestos','presupuesto_lineas');
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('presupuestos','presupuesto_lineas') ORDER BY tablename, policyname;
--
-- d) Secuencia creada
--   SELECT last_value FROM presupuestos_numero_seq;
-- =============================================================================
