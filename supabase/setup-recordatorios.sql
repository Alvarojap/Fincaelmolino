-- ============================================================================
-- SETUP: Recordatorios de visitas
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Tabla para guardar las suscripciones push de cada dispositivo
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Permitir a usuarios autenticados insertar/leer sus propias suscripciones
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role puede leer/borrar todas (para la Edge Function)
CREATE POLICY "Service role full access"
  ON push_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Habilitar extensiones necesarias para el cron
-- (pg_cron y pg_net ya suelen estar habilitadas en Supabase,
--  si no, activarlas desde Dashboard > Database > Extensions)

-- 3. Programar el cron para ejecutar la Edge Function cada día a las 20:00 (hora servidor UTC)
-- NOTA: Ajusta la hora según tu zona horaria.
-- Para España (UTC+2 en verano): 20:00 local = 18:00 UTC → usa '0 18 * * *'
-- Para España (UTC+1 en invierno): 20:00 local = 19:00 UTC → usa '0 19 * * *'

SELECT cron.schedule(
  'recordatorio-visitas-diario',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bqubxkuuyohuatdothwx.supabase.co/functions/v1/recordatorio-visitas',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
