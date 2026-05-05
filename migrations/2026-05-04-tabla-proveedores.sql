-- =============================================================================
-- Migración: tabla proveedores
-- Fecha: 2026-05-04
-- Commit D5.A.1 — primera tabla del módulo Proveedores + Catálogo + Cotizaciones
-- =============================================================================
-- Crea la tabla `proveedores` con todos sus campos, índices, trigger de
-- updated_at, RLS activada con política permisiva (alineada con el resto de
-- tablas del proyecto, que se autorizan vía la lógica de la app y la sesión
-- del usuario admin) y datos de ejemplo realistas para una finca de eventos
-- en Murcia.
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin romper nada.
-- =============================================================================

BEGIN;

-- 1) Tabla principal -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  contacto_nombre TEXT,
  telefono        TEXT,
  email           TEXT,
  cif             TEXT,
  direccion       TEXT,
  condiciones     TEXT,
  notas           TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  orden           INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);

COMMENT ON TABLE  proveedores                  IS 'Catálogo de proveedores externos (catering, sonido, decoración, etc.) que se asocian a servicios adicionales y cotizaciones.';
COMMENT ON COLUMN proveedores.id               IS 'PK UUID generada por defecto.';
COMMENT ON COLUMN proveedores.nombre           IS 'Nombre comercial del proveedor. Obligatorio.';
COMMENT ON COLUMN proveedores.contacto_nombre  IS 'Persona de contacto principal.';
COMMENT ON COLUMN proveedores.telefono         IS 'Teléfono de contacto (texto libre, sin formato forzado).';
COMMENT ON COLUMN proveedores.email            IS 'Email de contacto.';
COMMENT ON COLUMN proveedores.cif              IS 'CIF/NIF para facturación.';
COMMENT ON COLUMN proveedores.direccion        IS 'Dirección física u oficina del proveedor.';
COMMENT ON COLUMN proveedores.condiciones      IS 'Condiciones comerciales (descuentos, plazos de pago, mínimos, etc.).';
COMMENT ON COLUMN proveedores.notas            IS 'Notas internas libres (calidad, anécdotas, advertencias).';
COMMENT ON COLUMN proveedores.activo           IS 'Si false, el proveedor queda archivado y no aparece en listas activas (sin borrarlo, para preservar histórico).';
COMMENT ON COLUMN proveedores.orden            IS 'Orden manual opcional para ordenar listados (NULL → al final, ordena por nombre).';
COMMENT ON COLUMN proveedores.created_at       IS 'Timestamp de alta (auto).';
COMMENT ON COLUMN proveedores.updated_at       IS 'Timestamp de última edición (auto vía trigger).';
COMMENT ON COLUMN proveedores.created_by       IS 'UUID del usuario admin que creó el registro (nullable, opcional).';

-- 2) Índices -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS proveedores_nombre_idx
  ON proveedores (nombre);

CREATE INDEX IF NOT EXISTS proveedores_activo_idx
  ON proveedores (activo)
  WHERE activo = true;

-- 3) Trigger genérico de updated_at -------------------------------------------
-- Función reutilizable: si ya existe (de otra migración futura), CREATE OR
-- REPLACE no rompe nada y nos quedamos con la última versión.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS
  'Trigger genérico que actualiza updated_at = NOW() en cada UPDATE.';

DROP TRIGGER IF EXISTS trg_proveedores_updated_at ON proveedores;

CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4) RLS — sólo rol admin -----------------------------------------------------
-- Tabla admin-only. Operarios (entran con anon SB_KEY → auth.uid()=NULL)
-- quedan bloqueados por `TO authenticated`. Usuarios autenticados que NO
-- sean admin quedan bloqueados por la subquery EXISTS.
--
-- Verificado en src/App.jsx (líneas 748, 766): usuarios.id == auth.uid()
-- (mismo UUID, sin tabla intermedia). Por eso la subquery filtra directo
-- por id = auth.uid().
--
-- Si en algún momento el listado aparece vacío en runtime pese a haber filas,
-- la causa más probable es que RLS sobre `usuarios` bloquee la subquery: en
-- ese caso, plan B = envolver la check en una función SECURITY DEFINER.
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedores_select_admin ON proveedores;
DROP POLICY IF EXISTS proveedores_insert_admin ON proveedores;
DROP POLICY IF EXISTS proveedores_update_admin ON proveedores;
DROP POLICY IF EXISTS proveedores_delete_admin ON proveedores;

CREATE POLICY proveedores_select_admin ON proveedores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY proveedores_insert_admin ON proveedores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY proveedores_update_admin ON proveedores
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

CREATE POLICY proveedores_delete_admin ON proveedores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
       WHERE usuarios.id = auth.uid()
         AND usuarios.rol = 'admin'
    )
  );

-- 5) Datos de ejemplo (sólo si la tabla está vacía) ---------------------------
INSERT INTO proveedores (nombre, contacto_nombre, telefono, email, cif, direccion, condiciones, notas, activo, orden)
SELECT * FROM (VALUES
  (
    'Catering Sabor del Sur',
    'María Hernández',
    '+34 968 12 34 56',
    'reservas@sabordelsur.es',
    'B73456789',
    'C/ Mayor 12, 30001 Murcia',
    '15% descuento en menús +50 personas. Pago 50% al confirmar, 50% el día del evento.',
    'Calidad muy alta. Pedir menú degustación con 2 semanas de antelación.',
    true,
    1
  ),
  (
    'DJ Carlos Sonido & Luz',
    'Carlos Pérez',
    '+34 600 11 22 33',
    'carlos@djcarlos.es',
    'X1234567Y',
    'Avda. de la Libertad 45, 30009 Murcia',
    'Tarifa plana 6h. Hora extra 80€. Incluye técnico.',
    'Trae equipo propio. Avisarle del aforo con 1 semana.',
    true,
    2
  ),
  (
    'Iluminación Mediterránea',
    'Lucía Romero',
    '+34 968 98 76 54',
    'info@iluminacionmed.com',
    'B87654321',
    'Polígono Oeste, Nave 12, 30169 San Ginés',
    'Alquiler 24h. Recogida al día siguiente sin recargo.',
    'Catálogo amplio: guirnaldas, focos arquitectónicos, candelabros LED.',
    true,
    3
  ),
  (
    'Decoración Floral Olivar',
    'Ana Martínez',
    '+34 615 44 55 66',
    'ana@floralolivar.es',
    'B11223344',
    'C/ del Olivar 8, 30100 Espinardo',
    'Devolución de jarrones obligatoria. Fianza 100€.',
    'Especialistas en arreglos rústicos y centros de mesa con olivo.',
    true,
    4
  )
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM proveedores);

COMMIT;

-- =============================================================================
-- FIN MIGRACIÓN
-- =============================================================================
-- Query de testing (ejecuta tras aplicar la migración):
--
--   SELECT id, nombre, contacto_nombre, telefono, email, activo, orden, created_at
--     FROM proveedores
--    ORDER BY COALESCE(orden, 999), nombre;
--
-- Esperado: 4 filas con los proveedores de ejemplo, todos activos.
-- =============================================================================
