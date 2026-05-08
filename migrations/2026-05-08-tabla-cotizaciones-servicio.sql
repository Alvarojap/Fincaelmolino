-- =============================================================================
-- Migración: tabla cotizaciones_servicio + permitir NULL en precios de
--            servicios_reserva + guard en trigger recalcular_estado_servicio
-- Fecha: 2026-05-08
-- Commit D5.C.1 — primera fase del módulo Cotizaciones
-- =============================================================================
-- Cambios:
--   1. precio_cliente y coste_proveedor de servicios_reserva → nullable.
--      Permite que un servicio exista en estado "ofertado" pendiente de
--      cotización (sin precios fijados todavía).
--   2. Trigger recalcular_estado_servicio: añade guard que aborta si los
--      precios son NULL. Cambio aditivo, no destructivo. Los servicios con
--      precios definidos siguen comportándose exactamente igual que antes.
--   3. Tabla cotizaciones_servicio (estado: pendiente|recibida|descartada|
--      ganadora|cancelada). UNIQUE INDEX parcial: solo UNA ganadora por
--      servicio. RLS admin-only.
--
-- TODO en transacción única, idempotente.
-- =============================================================================

BEGIN;

-- 1) servicios_reserva: precios nullable -------------------------------------
-- Idempotente: ALTER ... DROP NOT NULL es no-op si ya es nullable.
ALTER TABLE servicios_reserva ALTER COLUMN precio_cliente   DROP NOT NULL;
ALTER TABLE servicios_reserva ALTER COLUMN coste_proveedor  DROP NOT NULL;

COMMENT ON COLUMN servicios_reserva.precio_cliente  IS 'Precio facturable al cliente. NULL si el servicio está en "ofertado" pendiente de cotización (D5.C.1+).';
COMMENT ON COLUMN servicios_reserva.coste_proveedor IS 'Coste pagado al proveedor. NULL si el servicio está en "ofertado" pendiente de cotización (D5.C.1+).';

-- 2) Trigger recalcular_estado_servicio: guard NULL prices -------------------
-- CREATE OR REPLACE: actualiza la función in-place. Misma firma, misma
-- lógica de transición, sólo añade el guard al principio del bloque
-- protegido. Resto idéntico a 2026-05-04-trigger-estado-servicio.sql.
CREATE OR REPLACE FUNCTION recalcular_estado_servicio(p_servicio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servicio        RECORD;
  v_cobrado         NUMERIC;
  v_pagado          NUMERIC;
  v_total_cliente   NUMERIC;
  v_total_prov      NUMERIC;
  v_tiene_cobro     BOOLEAN;
  v_nuevo_estado    TEXT;
BEGIN
  BEGIN
    SELECT id, precio_cliente, coste_proveedor, cantidad,
           estado, COALESCE(estado_manual, false) AS estado_manual,
           fecha_contratacion
      INTO v_servicio
      FROM servicios_reserva
     WHERE id = p_servicio_id;

    IF NOT FOUND THEN RETURN; END IF;
    IF v_servicio.estado = 'cancelado' THEN RETURN; END IF;
    IF v_servicio.estado_manual = true THEN RETURN; END IF;

    -- D5.C.1: si los precios no están definidos (servicio en "ofertado"
    -- pendiente de cotización), NO recalcular estado. Cualquier transición
    -- debe esperar a que el admin fije precio_cliente y coste_proveedor.
    IF v_servicio.precio_cliente IS NULL OR v_servicio.coste_proveedor IS NULL THEN
      RETURN;
    END IF;

    -- Sumas NET: cobros menos reembolsos del mismo lado
    SELECT COALESCE(SUM(
             CASE
               WHEN tipo = 'cobro_cliente'     THEN importe
               WHEN tipo = 'reembolso_cliente' THEN -importe
               ELSE 0
             END
           ), 0) INTO v_cobrado
      FROM movimientos_servicio
     WHERE servicio_reserva_id = p_servicio_id
       AND tipo IN ('cobro_cliente', 'reembolso_cliente');

    SELECT COALESCE(SUM(
             CASE
               WHEN tipo = 'pago_proveedor'      THEN importe
               WHEN tipo = 'reembolso_proveedor' THEN -importe
               ELSE 0
             END
           ), 0) INTO v_pagado
      FROM movimientos_servicio
     WHERE servicio_reserva_id = p_servicio_id
       AND tipo IN ('pago_proveedor', 'reembolso_proveedor');

    v_total_cliente := COALESCE(v_servicio.precio_cliente, 0) * COALESCE(v_servicio.cantidad, 1);
    v_total_prov    := COALESCE(v_servicio.coste_proveedor, 0) * COALESCE(v_servicio.cantidad, 1);

    SELECT EXISTS(
      SELECT 1 FROM movimientos_servicio
       WHERE servicio_reserva_id = p_servicio_id
         AND tipo = 'cobro_cliente'
         AND importe > 0
    ) INTO v_tiene_cobro;

    IF v_tiene_cobro
       AND v_total_cliente > 0
       AND v_cobrado >= v_total_cliente
       AND v_pagado  >= v_total_prov
    THEN
      v_nuevo_estado := 'completado';
    ELSIF v_tiene_cobro THEN
      v_nuevo_estado := 'aceptado';
    ELSIF v_servicio.estado = 'completado' THEN
      v_nuevo_estado := 'aceptado';
    ELSE
      RETURN;
    END IF;

    IF v_servicio.estado IS DISTINCT FROM v_nuevo_estado THEN
      UPDATE servicios_reserva
         SET estado = v_nuevo_estado,
             fecha_contratacion = CASE
               WHEN v_nuevo_estado = 'aceptado' AND fecha_contratacion IS NULL
                 THEN CURRENT_DATE
               ELSE fecha_contratacion
             END,
             updated_at = NOW()
       WHERE id = p_servicio_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'recalcular_estado_servicio falló para servicio_id=%: % %',
                  p_servicio_id, SQLSTATE, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION recalcular_estado_servicio(UUID) IS
  'Recalcula el estado de un servicios_reserva según los movimientos asociados. Idempotente, segura ante NULLs, no toca cancelado, respeta estado_manual. D5.C.1+: ABORTA si precio_cliente o coste_proveedor son NULL (servicio en ofertado pendiente de cotización).';

-- 3) Tabla cotizaciones_servicio ---------------------------------------------
CREATE TABLE IF NOT EXISTS cotizaciones_servicio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_reserva_id   UUID NOT NULL REFERENCES servicios_reserva(id) ON DELETE CASCADE,
  proveedor_id          UUID NOT NULL REFERENCES proveedores(id)       ON DELETE RESTRICT,
  importe               NUMERIC(12,2),
  fecha_cotizacion      DATE,
  condiciones           TEXT,
  estado                TEXT NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','recibida','descartada','ganadora','cancelada')),
  notas                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID
);

COMMENT ON TABLE  cotizaciones_servicio                       IS 'Cotizaciones que pide el admin a sus proveedores para un servicio de reserva. Una cotización por (servicio, proveedor, intento). Solo una puede estar en estado ganadora por servicio (UNIQUE INDEX parcial).';
COMMENT ON COLUMN cotizaciones_servicio.id                    IS 'PK UUID generada por defecto.';
COMMENT ON COLUMN cotizaciones_servicio.servicio_reserva_id   IS 'FK a servicios_reserva.id. ON DELETE CASCADE: si se borra el servicio, sus cotizaciones se borran.';
COMMENT ON COLUMN cotizaciones_servicio.proveedor_id          IS 'FK a proveedores.id. ON DELETE RESTRICT: no se puede borrar un proveedor que tenga cotizaciones (proteger histórico). TODO D5.A.5.X: actualizar el handler de borrado de proveedor para detectar este caso.';
COMMENT ON COLUMN cotizaciones_servicio.importe               IS 'Importe ofertado por el proveedor (€). NULL en estado pendiente (todavía no respondió).';
COMMENT ON COLUMN cotizaciones_servicio.fecha_cotizacion      IS 'Fecha en que el proveedor envió la cotización. NULL en estado pendiente.';
COMMENT ON COLUMN cotizaciones_servicio.condiciones           IS 'Notas del presupuesto del proveedor: plazos, exclusiones, etc. Texto libre.';
COMMENT ON COLUMN cotizaciones_servicio.estado                IS 'pendiente=enviada y esperando respuesta · recibida=el proveedor respondió · descartada=admin la descartó (no fue elegida) · ganadora=fue la elegida (define los precios del servicio) · cancelada=admin canceló el flujo.';
COMMENT ON COLUMN cotizaciones_servicio.notas                 IS 'Notas internas del admin sobre esta cotización (no compartidas con el proveedor).';
COMMENT ON COLUMN cotizaciones_servicio.created_at            IS 'Timestamp de alta.';
COMMENT ON COLUMN cotizaciones_servicio.updated_at            IS 'Timestamp de última edición (auto vía trigger).';
COMMENT ON COLUMN cotizaciones_servicio.created_by            IS 'UUID del admin que creó la cotización (auth.uid()). Nullable para inserts programáticos.';

-- 4) Índices ------------------------------------------------------------------
-- Lookup principal: cotizaciones de un servicio concreto
CREATE INDEX IF NOT EXISTS cotizaciones_servicio_servicio_idx
  ON cotizaciones_servicio (servicio_reserva_id);

-- Lookup secundario: cotizaciones de un proveedor concreto
CREATE INDEX IF NOT EXISTS cotizaciones_servicio_proveedor_idx
  ON cotizaciones_servicio (proveedor_id);

-- Sólo UNA ganadora por servicio. Garantía a nivel BD.
CREATE UNIQUE INDEX IF NOT EXISTS cotizaciones_un_ganadora_por_servicio
  ON cotizaciones_servicio (servicio_reserva_id)
  WHERE estado = 'ganadora';

-- 5) Trigger updated_at (reutiliza set_updated_at) ---------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizaciones_servicio_updated_at ON cotizaciones_servicio;

CREATE TRIGGER trg_cotizaciones_servicio_updated_at
  BEFORE UPDATE ON cotizaciones_servicio
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 6) RLS — sólo rol admin -----------------------------------------------------
ALTER TABLE cotizaciones_servicio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotizaciones_servicio_select_admin ON cotizaciones_servicio;
DROP POLICY IF EXISTS cotizaciones_servicio_insert_admin ON cotizaciones_servicio;
DROP POLICY IF EXISTS cotizaciones_servicio_update_admin ON cotizaciones_servicio;
DROP POLICY IF EXISTS cotizaciones_servicio_delete_admin ON cotizaciones_servicio;

CREATE POLICY cotizaciones_servicio_select_admin ON cotizaciones_servicio
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY cotizaciones_servicio_insert_admin ON cotizaciones_servicio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY cotizaciones_servicio_update_admin ON cotizaciones_servicio
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY cotizaciones_servicio_delete_admin ON cotizaciones_servicio
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

COMMIT;

-- =============================================================================
-- FIN MIGRACIÓN
-- =============================================================================
-- Queries de testing (ejecutar tras el COMMIT):
--
-- a) Estructura de cotizaciones_servicio (debe listar 11 columnas)
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'cotizaciones_servicio'
--    ORDER BY ordinal_position;
--
-- b) Precios de servicios_reserva nullable
--   SELECT column_name, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'servicios_reserva'
--      AND column_name IN ('precio_cliente','coste_proveedor');
--   Esperado: 2 filas con is_nullable = 'YES'
--
-- c) Constraint CHECK del estado
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'cotizaciones_servicio'::regclass
--      AND contype = 'c';
--
-- d) Índices (PK + servicio_idx + proveedor_idx + UNIQUE parcial ganadora)
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'cotizaciones_servicio' ORDER BY indexname;
--
-- e) RLS y políticas (4 políticas sobre {authenticated})
--   SELECT rowsecurity FROM pg_tables WHERE tablename = 'cotizaciones_servicio';
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'cotizaciones_servicio' ORDER BY policyname;
--
-- f) Trigger updated_at activo
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'cotizaciones_servicio'::regclass
--     AND tgname LIKE '%updated_at%';
--
-- g) Datos existentes intactos (los servicios de Boda Juan)
--   SELECT COUNT(*) FROM servicios_reserva;
-- =============================================================================
