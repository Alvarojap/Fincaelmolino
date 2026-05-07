-- =============================================================================
-- Migración: tabla proveedor_servicios + limpieza de catalogo_servicios
-- Fecha: 2026-05-07
-- Commit D5.B.1 — primera fase del módulo Catálogo + Cotizaciones
-- =============================================================================
-- Cambios:
--  1. FK servicios_reserva.catalogo_servicio_id → catalogo_servicios.id
--     se redefine con ON DELETE SET NULL (descubrimiento dinámico del nombre
--     vía pg_constraint, no asumimos naming convention de Supabase).
--  2. Limpieza completa de catalogo_servicios (DELETE; las 25 plantillas
--     seed se borran, el usuario construirá su catálogo desde la app en D5.B.3).
--  3. DROP COLUMN proveedor_default_id de catalogo_servicios (la relación
--     proveedor↔servicio pasa a vivir en la nueva tabla N:N).
--  4. CREATE TABLE proveedor_servicios con índices, trigger updated_at y
--     RLS admin-only (mismo patrón que `proveedores`).
--  5. Constraint a nivel BD: sólo UN proveedor preferido por servicio
--     (UNIQUE INDEX parcial WHERE preferido=true).
--
-- TODO en transacción única: o se aplica todo o nada.
-- IDEMPOTENTE: re-ejecutable sin romper.
-- =============================================================================

BEGIN;

-- 1) Redefinir FK catalogo_servicio_id ----------------------------------------
-- Descubre el nombre real de la FK existente (sin asumir convención) y la
-- dropea. Después la recrea con ON DELETE SET NULL para que el TRUNCATE/DELETE
-- de catalogo_servicios deje los servicios de reserva existentes intactos
-- pero con catalogo_servicio_id = NULL (los datos están copiados, no enlazados).
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.servicios_reserva'::regclass
       AND contype  = 'f'
       AND EXISTS (
         SELECT 1 FROM pg_attribute
          WHERE attrelid = 'public.servicios_reserva'::regclass
            AND attname  = 'catalogo_servicio_id'
            AND attnum   = ANY(conkey)
       )
  LOOP
    EXECUTE format('ALTER TABLE servicios_reserva DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE servicios_reserva
  ADD CONSTRAINT servicios_reserva_catalogo_servicio_id_fkey
  FOREIGN KEY (catalogo_servicio_id)
  REFERENCES catalogo_servicios(id)
  ON DELETE SET NULL;

-- 2) Limpieza de catalogo_servicios -------------------------------------------
-- DELETE en lugar de TRUNCATE para respetar la FK ON DELETE SET NULL recién
-- creada (TRUNCATE bypasaría triggers y FKs y rompería). Las filas de
-- servicios_reserva quedarán con catalogo_servicio_id = NULL automáticamente.
DELETE FROM catalogo_servicios;

-- 3) DROP columna proveedor_default_id ----------------------------------------
-- Si tiene una FK asociada a proveedores(id), DROP COLUMN la borra en cascada.
-- IF EXISTS lo hace idempotente (re-ejecutar = no-op).
ALTER TABLE catalogo_servicios DROP COLUMN IF EXISTS proveedor_default_id;

-- 4) Tabla proveedor_servicios ------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedor_servicios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          UUID NOT NULL REFERENCES proveedores(id)         ON DELETE CASCADE,
  catalogo_servicio_id  UUID NOT NULL REFERENCES catalogo_servicios(id)  ON DELETE CASCADE,
  preferido             BOOLEAN NOT NULL DEFAULT false,
  precio_orientativo    NUMERIC(12,2),
  notas                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proveedor_servicios_uq UNIQUE (proveedor_id, catalogo_servicio_id)
);

COMMENT ON TABLE  proveedor_servicios                       IS 'Relación N:N entre proveedores y servicios del catálogo. Define qué proveedores cubren qué servicios, con precio orientativo y flag de preferido.';
COMMENT ON COLUMN proveedor_servicios.id                    IS 'PK UUID generada por defecto.';
COMMENT ON COLUMN proveedor_servicios.proveedor_id          IS 'FK a proveedores.id. ON DELETE CASCADE: si se borra un proveedor, sus vínculos se borran también.';
COMMENT ON COLUMN proveedor_servicios.catalogo_servicio_id  IS 'FK a catalogo_servicios.id. ON DELETE CASCADE: si se borra una plantilla del catálogo, sus vínculos a proveedores se borran también.';
COMMENT ON COLUMN proveedor_servicios.preferido             IS 'Si true, este es el proveedor preferido para este servicio del catálogo. Sólo uno puede estar marcado preferido por cada catalogo_servicio_id (garantizado por índice único parcial).';
COMMENT ON COLUMN proveedor_servicios.precio_orientativo    IS 'Precio que sueles pagarle a este proveedor por este servicio. Opcional. NUMERIC(12,2).';
COMMENT ON COLUMN proveedor_servicios.notas                 IS 'Notas internas sobre el vínculo (ej: condiciones específicas, descuentos por volumen, calidad observada).';
COMMENT ON COLUMN proveedor_servicios.created_at            IS 'Timestamp de alta del vínculo (auto).';
COMMENT ON COLUMN proveedor_servicios.updated_at            IS 'Timestamp de última edición del vínculo (auto vía trigger).';

-- 5) Índices ------------------------------------------------------------------
-- Para "qué servicios cubre este proveedor" (lookup desde la ficha de proveedor).
CREATE INDEX IF NOT EXISTS proveedor_servicios_proveedor_id_idx
  ON proveedor_servicios (proveedor_id);

-- Para "qué proveedores cubren este servicio" (lookup desde la ficha de servicio).
CREATE INDEX IF NOT EXISTS proveedor_servicios_catalogo_servicio_id_idx
  ON proveedor_servicios (catalogo_servicio_id);

-- Sólo un proveedor preferido por servicio. Garantía a nivel BD.
CREATE UNIQUE INDEX IF NOT EXISTS proveedor_servicios_un_preferido_por_servicio
  ON proveedor_servicios (catalogo_servicio_id)
  WHERE preferido = true;

-- 6) set_updated_at (reutilizada de la migración de proveedores) -------------
-- CREATE OR REPLACE asegura que existe; si la migración de proveedores no se
-- aplicó por algún motivo, esto la crea.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proveedor_servicios_updated_at ON proveedor_servicios;

CREATE TRIGGER trg_proveedor_servicios_updated_at
  BEFORE UPDATE ON proveedor_servicios
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 7) RLS — sólo rol admin -----------------------------------------------------
ALTER TABLE proveedor_servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedor_servicios_select_admin ON proveedor_servicios;
DROP POLICY IF EXISTS proveedor_servicios_insert_admin ON proveedor_servicios;
DROP POLICY IF EXISTS proveedor_servicios_update_admin ON proveedor_servicios;
DROP POLICY IF EXISTS proveedor_servicios_delete_admin ON proveedor_servicios;

CREATE POLICY proveedor_servicios_select_admin ON proveedor_servicios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY proveedor_servicios_insert_admin ON proveedor_servicios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY proveedor_servicios_update_admin ON proveedor_servicios
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

CREATE POLICY proveedor_servicios_delete_admin ON proveedor_servicios
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
-- a) Estructura de la tabla nueva (debe listar 9 columnas)
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'proveedor_servicios'
--    ORDER BY ordinal_position;
--
-- b) catalogo_servicios vacío (debe devolver 0)
--   SELECT COUNT(*) AS plantillas_restantes FROM catalogo_servicios;
--
-- c) servicios_reserva intacto (mismo nº que tenías antes)
--   SELECT COUNT(*) AS servicios_existentes FROM servicios_reserva;
--
-- d) Tras la limpieza, los catalogo_servicio_id quedan en NULL
--   SELECT id, nombre, catalogo_servicio_id FROM servicios_reserva ORDER BY created_at DESC;
--
-- e) FK quedó con ON DELETE SET NULL
--   SELECT tc.constraint_name, rc.delete_rule
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
--     JOIN information_schema.key_column_usage kcu       ON tc.constraint_name = kcu.constraint_name
--    WHERE tc.table_name = 'servicios_reserva' AND kcu.column_name = 'catalogo_servicio_id';
--
-- f) Índices de la tabla nueva (PK + 2 simples + UNIQUE parcial + UNIQUE compuesto)
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'proveedor_servicios' ORDER BY indexname;
--
-- g) RLS y políticas activadas (4 políticas sobre {authenticated})
--   SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'proveedor_servicios';
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'proveedor_servicios' ORDER BY policyname;
-- =============================================================================
