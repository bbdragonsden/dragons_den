-- =====================================================================
-- PROPUESTA (NO EJECUTADA). Revisar y lanzar a mano en Supabase > SQL Editor.
-- Fecha: septiembre de 2026. Acompaña a los cambios de la web de esa fecha.
-- Todas las sentencias son idempotentes (IF NOT EXISTS / comprobaciones).
-- =====================================================================


-- ── 0. Diagnóstico previo (solo lectura) ─────────────────────────────
-- 0.a ¿Alguna política RLS confía en user_metadata? (lo puede escribir el
--     propio usuario con supabase.auth.updateUser / signUp options.data)
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE coalesce(qual,'') ILIKE '%user_metadata%'
   OR coalesce(with_check,'') ILIKE '%user_metadata%';

-- 0.b ¿Quién tiene is_admin y dónde?
SELECT id, email,
       raw_app_meta_data  ->> 'is_admin' AS admin_en_app_metadata,
       raw_user_meta_data ->> 'is_admin' AS admin_en_user_metadata
FROM auth.users
WHERE raw_app_meta_data ? 'is_admin' OR raw_user_meta_data ? 'is_admin';

-- 0.c Políticas actuales de user_packs (la plataforma la lee con la clave pública)
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'user_packs';


-- ── 1. Administrador: solo app_metadata ──────────────────────────────
-- La API (/api/admin-data, /api/admin-action, /api/assign-pack) ya exige
-- app_metadata.is_admin. Desde ahora plataforma.html también lo lee de ahí.
-- 1.a Asegurar que la cuenta del responsable tiene el permiso en app_metadata
--     (solo se puede escribir con service_role / SQL, no desde el navegador).
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
WHERE email = 'bbdragonsden@gmail.com';

-- 1.b Limpiar el indicador falso en user_metadata (no da permisos, pero confunde).
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_admin'
WHERE raw_user_meta_data ? 'is_admin';

-- 1.c user_packs: cada usuario solo lee sus filas y nadie escribe desde el
--     navegador (las altas las hace /api con service_role).
ALTER TABLE user_packs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_packs' AND policyname='user_packs_self_read') THEN
    CREATE POLICY "user_packs_self_read" ON user_packs FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
-- Si 0.c muestra alguna política INSERT/UPDATE/DELETE para "authenticated" o
-- "anon" en user_packs, borrarla:  DROP POLICY "<nombre>" ON user_packs;


-- ── 2. Solicitudes (formulario de index.html) ────────────────────────
-- La función /api/inscripcion ya envía estas columnas; si no existen,
-- guarda la solicitud sin ellas (y los consentimientos quedan solo en el email).
ALTER TABLE campus_inscripciones
  ADD COLUMN IF NOT EXISTS fecha_nacimiento       date,
  ADD COLUMN IF NOT EXISTS acepta_privacidad      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consiente_salud        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acepta_comunicaciones  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimiento_version text,
  ADD COLUMN IF NOT EXISTS consentimiento_at      timestamptz;

-- Datos de salud sin consentimiento explícito: fuera.
UPDATE campus_inscripciones SET lesiones = NULL
WHERE consiente_salud = false AND lesiones IS NOT NULL;


-- ── 3. Lista de espera de la Academia Online ─────────────────────────
ALTER TABLE academia_waitlist
  ADD COLUMN IF NOT EXISTS acepta_privacidad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimiento_at timestamptz;


-- ── 4. Vídeos para análisis ──────────────────────────────────────────
ALTER TABLE analisis_videos
  ADD COLUMN IF NOT EXISTS consentimiento_video   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimiento_por     text CHECK (consentimiento_por IN ('jugador','tutor')),
  ADD COLUMN IF NOT EXISTS consentimiento_version text,
  ADD COLUMN IF NOT EXISTS consentimiento_at      timestamptz;

-- Solo enlaces https (defensa en profundidad; la API ya lo comprueba).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analisis_videos_url_https') THEN
    ALTER TABLE analisis_videos
      ADD CONSTRAINT analisis_videos_url_https CHECK (url_video ~* '^https://') NOT VALID;
  END IF;
END $$;


-- ── 5. Plazos de conservación (lo que dice la política de privacidad) ─
-- Ejecutar a mano (o programar con pg_cron) una vez al año, el 1 de julio.
-- 5.a Vídeos y notas del entrenador sobre vídeos: se borran al acabar la temporada.
-- DELETE FROM analisis_videos WHERE created_at < date_trunc('year', now()) + interval '6 months';
-- 5.a2 Datos de salud: hasta el final de la temporada (30 de junio).
-- UPDATE campus_inscripciones SET lesiones = NULL WHERE lesiones IS NOT NULL AND created_at < date_trunc('year', now()) + interval '6 months';
-- 5.b Solicitudes que no llegaron a contratarse: 1 año.
-- DELETE FROM campus_inscripciones WHERE estado IN ('pendiente','cancelado') AND created_at < now() - interval '1 year';
-- 5.c Lista de espera: 2 años sin convertir.
-- DELETE FROM academia_waitlist WHERE estado <> 'convertido' AND created_at < now() - interval '2 years';
-- 5.d Mensajes: 2 años desde el último.
-- DELETE FROM mensajes WHERE created_at < now() - interval '2 years';
