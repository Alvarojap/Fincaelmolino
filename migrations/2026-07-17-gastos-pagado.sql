-- =============================================================================
-- Migración: control de pago en gastos (pagado / fecha_pago)
-- Fecha: 2026-07-17
-- Permite marcar gastos (p. ej. servicios de limpieza) como pagados en bloque
-- y calcular cuánto se debe / se ha pagado / queda pendiente.
-- =============================================================================
-- Cambios:
--  1. ADD COLUMN pagado BOOLEAN NOT NULL DEFAULT false  → estado de pago.
--  2. ADD COLUMN fecha_pago DATE                         → cuándo se pagó.
--  3. Índice sobre pagado para filtrar pendientes rápido.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS. Re-ejecutable sin romper.
-- Nota: las filas existentes quedan con pagado=false (pendiente). Puedes
-- marcarlas como pagadas en bloque desde la pantalla de Gastos.
-- =============================================================================

BEGIN;

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS pagado     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_pago DATE;

COMMENT ON COLUMN gastos.pagado     IS 'Si true, el gasto ya se ha abonado. Se marca en bloque desde Gastos.';
COMMENT ON COLUMN gastos.fecha_pago IS 'Fecha en que se marcó como pagado (opcional).';

CREATE INDEX IF NOT EXISTS gastos_pagado_idx ON gastos (pagado);

COMMIT;

-- =============================================================================
-- Queries de testing:
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name='gastos' AND column_name IN ('pagado','fecha_pago');
--   SELECT pagado, COUNT(*), SUM(importe) FROM gastos GROUP BY pagado;
-- =============================================================================
