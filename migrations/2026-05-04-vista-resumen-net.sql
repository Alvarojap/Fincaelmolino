-- =============================================================================
-- Migración: v_servicios_resumen — multiplicador de cantidad + sumas NET
-- Fecha: 2026-05-04
-- =============================================================================
-- Dos cambios respecto a la versión anterior:
--   1. precio_cliente, coste_proveedor y margen_total ahora se devuelven
--      multiplicados por cantidad (totales reales). Antes eran unitarios.
--      Bug observado: una silla con cantidad=1000 y precio=1€ pintaba "1€"
--      en la card en vez de "1.000€".
--   2. cobrado_cliente y pagado_proveedor ahora son NET (suman cobros y
--      restan reembolsos del mismo lado). Antes eran gross. Esto requiere
--      alinear el trigger recalcular_estado_servicio para que use NET
--      también — ver 2026-05-04-trigger-estado-servicio.sql.
--
-- pendiente_cobro y pendiente_pago derivan de los nuevos NET, así que
-- pueden ser negativos si los reembolsos superan a los cobros (caso raro,
-- el frontend lo trata con `pendiente > 0` para no mostrar negativos).
-- =============================================================================

BEGIN;

DROP VIEW v_servicios_resumen;

CREATE VIEW v_servicios_resumen AS
SELECT
  s.id,
  s.reserva_id,
  s.nombre,
  s.categoria,
  s.estado,
  (s.precio_cliente * COALESCE(s.cantidad, 1))::numeric(12,2) AS precio_cliente,
  (s.coste_proveedor * COALESCE(s.cantidad, 1))::numeric(12,2) AS coste_proveedor,
  ((s.precio_cliente - s.coste_proveedor) * COALESCE(s.cantidad, 1))::numeric(12,2) AS margen_total,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN m.tipo = 'cobro_cliente' THEN m.importe
        WHEN m.tipo = 'reembolso_cliente' THEN -m.importe
        ELSE 0::numeric
      END
    )
    FROM movimientos_servicio m
    WHERE m.servicio_reserva_id = s.id
  ), 0::numeric)::numeric(12,2) AS cobrado_cliente,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN m.tipo = 'pago_proveedor' THEN m.importe
        WHEN m.tipo = 'reembolso_proveedor' THEN -m.importe
        ELSE 0::numeric
      END
    )
    FROM movimientos_servicio m
    WHERE m.servicio_reserva_id = s.id
  ), 0::numeric)::numeric(12,2) AS pagado_proveedor,
  ((s.precio_cliente * COALESCE(s.cantidad, 1)) - COALESCE((
    SELECT SUM(
      CASE
        WHEN m.tipo = 'cobro_cliente' THEN m.importe
        WHEN m.tipo = 'reembolso_cliente' THEN -m.importe
        ELSE 0::numeric
      END
    )
    FROM movimientos_servicio m
    WHERE m.servicio_reserva_id = s.id
  ), 0::numeric))::numeric(12,2) AS pendiente_cobro,
  ((s.coste_proveedor * COALESCE(s.cantidad, 1)) - COALESCE((
    SELECT SUM(
      CASE
        WHEN m.tipo = 'pago_proveedor' THEN m.importe
        WHEN m.tipo = 'reembolso_proveedor' THEN -m.importe
        ELSE 0::numeric
      END
    )
    FROM movimientos_servicio m
    WHERE m.servicio_reserva_id = s.id
  ), 0::numeric))::numeric(12,2) AS pendiente_pago
FROM servicios_reserva s;

COMMIT;
