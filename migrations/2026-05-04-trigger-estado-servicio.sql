-- =============================================================================
-- Migración: trigger automático de recálculo de estado_servicio
-- Fecha: 2026-05-04
-- Commit D1 del módulo de Servicios adicionales
-- =============================================================================
-- Cuando se inserta/actualiza/borra un movimiento_servicio, recalcula el
-- estado del servicios_reserva asociado según las reglas de negocio.
--
-- REGLAS DE TRANSICIÓN (en este orden):
--   1. estado='cancelado'         → no-op (terminal, nunca tocar)
--   2. estado_manual=true         → no-op (admin tiene la última palabra)
--   3. cobrado_NET>=total_cliente Y pagado_NET>=total_proveedor (con al
--      menos un cobro positivo y total_cliente>0) → 'completado'
--   4. al menos un cobro_cliente con importe>0     → 'aceptado'
--   5. estado actual='completado' pero ya no cumple → 'aceptado'
--      (degradación para mantener consistencia tras borrar cobros)
--   6. ofertado/aceptado sin cobros → no-op (no degradar a 'ofertado')
--
-- Cuando pasa a 'aceptado', si fecha_contratacion está vacía la pone a hoy.
-- Las sumas son brutas (sin restar reembolsos), igual convención que la vista
-- v_servicios_resumen, así que cobrado_cliente y pagado_proveedor en la vista
-- y en el trigger son consistentes.
--
-- El trigger calcula totales directamente desde servicios_reserva
-- (precio × cantidad) y movimientos_servicio. NO depende de la vista, así que
-- es robusto frente a redefiniciones de v_servicios_resumen.
--
-- SECURITY DEFINER: las funciones se ejecutan con privilegios del owner para
-- que el trigger pueda actualizar servicios_reserva aunque quien inserte el
-- movimiento sea anon/operario sin permiso directo de UPDATE.
-- =============================================================================

-- 1) Nueva columna estado_manual
ALTER TABLE servicios_reserva
  ADD COLUMN IF NOT EXISTS estado_manual BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN servicios_reserva.estado_manual IS
  'Si true, el trigger de recálculo NO modifica el estado. Solo lo respeta el frontend cuando admin cambia estado a mano. La excepción es cancelado, que siempre se respeta independientemente de este flag.';

-- 2) Función principal: recalcular estado de un servicio
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
  -- Envolvemos todo en un bloque protegido para que cualquier error
  -- (datos inconsistentes, etc.) NO rompa la transacción del INSERT/UPDATE
  -- del movimiento que disparó el trigger. Solo se loguea.
  BEGIN
    -- 1) Leer el servicio
    SELECT id, precio_cliente, coste_proveedor, cantidad,
           estado, COALESCE(estado_manual, false) AS estado_manual,
           fecha_contratacion
      INTO v_servicio
      FROM servicios_reserva
     WHERE id = p_servicio_id;

    -- Si no existe (raro: borrado a la vez), salir limpio
    IF NOT FOUND THEN RETURN; END IF;

    -- 2) Estado terminal: cancelado nunca se toca
    IF v_servicio.estado = 'cancelado' THEN RETURN; END IF;

    -- 3) Bloqueo manual: si admin ha forzado el estado, respetarlo
    IF v_servicio.estado_manual = true THEN RETURN; END IF;

    -- 4) Sumas NET: cobros menos reembolsos del mismo lado.
    --    Coincide exactamente con v_servicios_resumen, que también suma
    --    cobros y resta reembolsos. Con esto trigger y vista van alineados.
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

    -- 5) Totales aplicando cantidad (defensivo contra NULLs y ceros)
    v_total_cliente := COALESCE(v_servicio.precio_cliente, 0)
                     * COALESCE(v_servicio.cantidad, 1);
    v_total_prov    := COALESCE(v_servicio.coste_proveedor, 0)
                     * COALESCE(v_servicio.cantidad, 1);

    -- 6) ¿Hay al menos un cobro positivo?
    SELECT EXISTS(
      SELECT 1 FROM movimientos_servicio
       WHERE servicio_reserva_id = p_servicio_id
         AND tipo = 'cobro_cliente'
         AND importe > 0
    ) INTO v_tiene_cobro;

    -- 7) Determinar nuevo estado según reglas
    --    a) Cumple criterios de completado → 'completado'
    --    b) Hay cobro positivo (gross) pero no cumple → 'aceptado'
    --    c) NO cumple y NO hay cobro pero estado actual es 'completado'
    --       → degradar a 'aceptado' para evitar inconsistencia (un
    --       servicio sin cobros no puede seguir marcado completado)
    --    d) Resto: ofertado/aceptado sin cobros → mantener (no degradar
    --       a ofertado automáticamente)
    --    Nota: completado requiere también total_cliente > 0 para evitar
    --    que un servicio "gratis" (precio=0) se marque completado.
    IF v_tiene_cobro
       AND v_total_cliente > 0
       AND v_cobrado >= v_total_cliente
       AND v_pagado  >= v_total_prov
    THEN
      v_nuevo_estado := 'completado';
    ELSIF v_tiene_cobro THEN
      v_nuevo_estado := 'aceptado';
    ELSIF v_servicio.estado = 'completado' THEN
      -- Caso c: era completado pero se han borrado los cobros. Bajar a
      -- aceptado para no quedarse en estado falso.
      v_nuevo_estado := 'aceptado';
    ELSE
      -- ofertado/aceptado sin cobros → no tocar
      RETURN;
    END IF;

    -- 8) Idempotencia: solo UPDATE si cambia
    IF v_servicio.estado IS DISTINCT FROM v_nuevo_estado THEN
      UPDATE servicios_reserva
         SET estado = v_nuevo_estado,
             -- Solo setea fecha_contratacion al pasar a aceptado y si está vacía
             fecha_contratacion = CASE
               WHEN v_nuevo_estado = 'aceptado' AND fecha_contratacion IS NULL
                 THEN CURRENT_DATE
               ELSE fecha_contratacion
             END,
             updated_at = NOW()
       WHERE id = p_servicio_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Degradar con elegancia: log y seguir. La transacción del movimiento
    -- NO se rompe. Si esto pasa, revisar logs de Supabase.
    RAISE WARNING 'recalcular_estado_servicio falló para servicio_id=%: % %',
                  p_servicio_id, SQLSTATE, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION recalcular_estado_servicio(UUID) IS
  'Recalcula el estado de un servicios_reserva según los movimientos asociados. Idempotente, segura ante NULLs, no toca cancelado, respeta estado_manual.';

-- 3) Función handler del trigger
CREATE OR REPLACE FUNCTION trg_movimientos_recalcula_estado_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_estado_servicio(OLD.servicio_reserva_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM recalcular_estado_servicio(NEW.servicio_reserva_id);
    -- Si el FK cambió (poco probable pero posible), recalcular ambos
    IF OLD.servicio_reserva_id IS DISTINCT FROM NEW.servicio_reserva_id THEN
      PERFORM recalcular_estado_servicio(OLD.servicio_reserva_id);
    END IF;
    RETURN NEW;
  ELSE  -- INSERT
    PERFORM recalcular_estado_servicio(NEW.servicio_reserva_id);
    RETURN NEW;
  END IF;
END;
$$;

-- 4) Crear el trigger (drop primero por idempotencia)
DROP TRIGGER IF EXISTS trg_movimientos_recalcula_estado ON movimientos_servicio;

CREATE TRIGGER trg_movimientos_recalcula_estado
  AFTER INSERT OR UPDATE OR DELETE ON movimientos_servicio
  FOR EACH ROW
  EXECUTE FUNCTION trg_movimientos_recalcula_estado_fn();

COMMENT ON TRIGGER trg_movimientos_recalcula_estado ON movimientos_servicio IS
  'Recalcula automáticamente el estado de servicios_reserva tras cualquier cambio en sus movimientos.';

-- =============================================================================
-- FIN MIGRACIÓN
-- =============================================================================

-- Para testear, ejecuta el bloque DO incluido en el commit message del PR
-- o en el archivo migrations/2026-05-04-test-trigger.sql si se separó.
