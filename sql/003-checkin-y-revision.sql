-- ─────────────────────────────────────────────────────────────────────────────
-- Dragons Den · migración 003
-- Check-in tras cada entreno o partido, equipos del jugador, consentimiento de
-- bienestar y cola de revisión (comentarios y pruebas en vídeo).
--
-- Se ejecuta DESPUÉS de 002. Catálogo de preguntas en /data/checkin.json.
-- Todo se escribe a través de /api/checkin (service_role); el navegador solo lee
-- lo suyo.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Equipos del jugador ───────────────────────────────────────────────────
-- Un jugador puede entrenar en Dragons Den y en uno o dos clubes a la vez.
CREATE TABLE IF NOT EXISTS equipos_jugador (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre                TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 60),
  tipo                  TEXT NOT NULL CHECK (tipo IN ('dragons_den','club','seleccion','otro')),
  duracion_habitual_min SMALLINT NOT NULL DEFAULT 90 CHECK (duracion_habitual_min BETWEEN 15 AND 240),
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipos_user ON equipos_jugador(user_id);
ALTER TABLE equipos_jugador ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipos_self_read" ON equipos_jugador FOR SELECT USING (auth.uid() = user_id);


-- ── 2. Consentimiento de bienestar ───────────────────────────────────────────
-- Energía, sueño, molestias y ánimo son datos de salud (RGPD art. 9). Se piden
-- aparte y con consentimiento explícito. Menores de 14: lo da el tutor (LOPDGDD
-- art. 7), y solo si ya hay un tutor identificado en consentimientos_tutor.
CREATE TABLE IF NOT EXISTS consentimiento_bienestar (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha_nacimiento DATE NOT NULL,
  otorgado_por     TEXT NOT NULL CHECK (otorgado_por IN ('jugador','tutor')),
  texto_version    TEXT NOT NULL,
  otorgado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_otorgamiento  INET,
  revocado_en      TIMESTAMPTZ,
  -- Dos autorizaciones independientes en la misma fila: datos de bienestar y
  -- vídeos de prueba. Se puede dar una sin la otra.
  acepta_bienestar BOOLEAN NOT NULL DEFAULT TRUE,
  acepta_video     BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE consentimiento_bienestar ADD COLUMN IF NOT EXISTS acepta_bienestar BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE consentimiento_bienestar ADD COLUMN IF NOT EXISTS acepta_video BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consentimiento_bienestar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bienestar_self_read" ON consentimiento_bienestar FOR SELECT USING (auth.uid() = user_id);


-- ── 3. Check-ins ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalogo_version SMALLINT NOT NULL,
  fecha            DATE NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('entreno','partido')),
  equipo_id        UUID REFERENCES equipos_jugador(id) ON DELETE SET NULL,
  equipo_tipo      TEXT CHECK (equipo_tipo IN ('dragons_den','club','seleccion','otro')),
  duracion_min     SMALLINT NOT NULL CHECK (duracion_min BETWEEN 10 AND 240),
  minutos_jugados  SMALLINT CHECK (minutos_jugados BETWEEN 0 AND 60),
  resultado        TEXT CHECK (resultado IN ('victoria','derrota')),
  rpe              SMALLINT NOT NULL CHECK (rpe BETWEEN 0 AND 10),
  carga            INTEGER GENERATED ALWAYS AS (rpe * duracion_min) STORED,
  calentamiento    SMALLINT CHECK (calentamiento BETWEEN 0 AND 2),
  -- Bloque de bienestar: NULL si no hay consentimiento.
  energia          SMALLINT CHECK (energia BETWEEN 1 AND 5),
  sueno            TEXT CHECK (sueno IN ('menos7','7a8','8a9','mas9')),
  dolor            SMALLINT CHECK (dolor BETWEEN 0 AND 2),
  dolor_zona       TEXT[],
  animo            SMALLINT CHECK (animo BETWEEN 1 AND 5),
  disfrute         SMALLINT CHECK (disfrute BETWEEN 1 AND 5),
  concentracion    SMALLINT CHECK (concentracion BETWEEN 1 AND 5),
  nervios          TEXT CHECK (nervios IN ('bloquearon','normales','activaron')),
  -- Reflexión
  foco             TEXT,
  foco_cumplido    SMALLINT CHECK (foco_cumplido BETWEEN 0 AND 2),
  mejor            TEXT,
  mejorar          TEXT,
  causa            TEXT CHECK (causa IN ('tecnica','decision','cansancio','concentracion','nervios','externo')),
  proximo          TEXT CHECK (char_length(proximo) <= 120),
  consejo          JSONB,
  -- Validación de la sesión: 'entrenador' (sesión de Dragons Den marcada por el
  -- coach), 'prueba' (vídeo aprobado) o 'sin_validar'.
  validado_por     TEXT NOT NULL DEFAULT 'sin_validar' CHECK (validado_por IN ('entrenador','prueba','sin_validar')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkins_user_fecha ON checkins(user_id, fecha DESC);
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins_self_read" ON checkins FOR SELECT USING (auth.uid() = user_id);


-- ── 3b. Mediciones de estatura (una al mes) ─────────────────────────────────
-- Para detectar el estirón: en el año de máximo crecimiento suben las lesiones.
-- Solo con consentimiento de bienestar.
CREATE TABLE IF NOT EXISTS mediciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha        DATE NOT NULL,
  estatura_cm  NUMERIC(5,1) NOT NULL CHECK (estatura_cm BETWEEN 90 AND 230),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fecha)
);
ALTER TABLE mediciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mediciones_self_read" ON mediciones FOR SELECT USING (auth.uid() = user_id);


-- ── 4. Cola de revisión ──────────────────────────────────────────────────────
-- Todo texto o vídeo que dé XP o se vea fuera de la cuenta del jugador entra
-- aquí como 'pendiente'. El XP se concede SOLO al aprobar.
CREATE TABLE IF NOT EXISTS revisiones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('comentario_checkin','prueba_video','comentario_reto','texto_publico')),
  checkin_id       UUID REFERENCES checkins(id) ON DELETE CASCADE,
  texto            TEXT CHECK (char_length(texto) <= 600),
  -- Prueba en vídeo. El archivo vive en el bucket privado 'pruebas'.
  video_path       TEXT,
  video_sha256     TEXT,
  video_firma      TEXT,
  video_duracion   NUMERIC(5,2),
  video_bytes      INTEGER,
  video_grabado_en TIMESTAMPTZ,
  codigo           TEXT,
  gesto            TEXT,
  codigo_creado_en TIMESTAMPTZ,
  video_borrado_en TIMESTAMPTZ,
  -- Propuesta automática: {"puntos":85,"sugerencia":"aprobar","motivos":[...]}
  prefiltro        JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('esperando_video','pendiente','aprobado','rechazado','repetido')),
  xp_si_aprueba    SMALLINT NOT NULL DEFAULT 0 CHECK (xp_si_aprueba >= 0),
  nota_revisor     TEXT,
  revisado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_en      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revisiones_pendientes ON revisiones(created_at) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_revisiones_user ON revisiones(user_id);
CREATE INDEX IF NOT EXISTS idx_revisiones_sha ON revisiones(video_sha256) WHERE video_sha256 IS NOT NULL;
-- Una prueba por check-in.
CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_prueba_unica
  ON revisiones(checkin_id) WHERE tipo = 'prueba_video';
ALTER TABLE revisiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revisiones_self_read" ON revisiones FOR SELECT USING (auth.uid() = user_id);


-- ── 5. Libro de XP: nuevos motivos ───────────────────────────────────────────
ALTER TABLE xp_movimientos DROP CONSTRAINT IF EXISTS xp_movimientos_motivo_check;
ALTER TABLE xp_movimientos ADD CONSTRAINT xp_movimientos_motivo_check CHECK (motivo IN
  ('quest','quest_fuera_plazo','racha','iq_clash','ajuste_manual','penalizacion',
   'checkin','checkin_comentario','prueba_video','sesion_pista','clip_partido',
   'hito_tecnico','metrica_sube','referido_activo'));

DROP INDEX IF EXISTS idx_xp_una_vez_por_referencia;
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_una_vez_por_referencia
  ON xp_movimientos(user_id, motivo, referencia)
  WHERE referencia IS NOT NULL AND motivo IN
  ('quest','quest_fuera_plazo','racha','checkin','checkin_comentario','prueba_video','sesion_pista','clip_partido','hito_tecnico','metrica_sube','referido_activo');


-- ── 6. Bucket privado para las pruebas ───────────────────────────────────────
-- Sin políticas para anon/authenticated: se sube con una URL firmada que crea
-- la API y se ve con otra URL firmada de 10 minutos desde el panel.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pruebas', 'pruebas', FALSE, 15728640, ARRAY['video/mp4','video/quicktime','video/webm','video/3gpp'])
ON CONFLICT (id) DO NOTHING;


-- ── 7. Puede registrar bienestar ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION puede_registrar_bienestar(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT b.revocado_en IS NULL AND b.acepta_bienestar
            AND (b.otorgado_por = 'tutor'
                 OR AGE(NOW(), b.fecha_nacimiento) >= INTERVAL '14 years')
     FROM consentimiento_bienestar b WHERE b.user_id = p_user),
    FALSE);
$;

-- Puede subir vídeo de prueba: con 14 años o más y su propia autorización, o
-- con la autorización de la familia registrada por el entrenador (formulario
-- /autorizacion.html). Sustituye a la versión de la 002, que solo miraba la
-- tabla del tutor y dejaba fuera a todos los demás.
CREATE OR REPLACE FUNCTION puede_subir_video(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $
  SELECT
    COALESCE((SELECT c.acepta_tratamiento_video AND c.revocado_en IS NULL
              FROM consentimientos_tutor c WHERE c.user_id = p_user), FALSE)
    OR COALESCE((SELECT b.acepta_video AND b.revocado_en IS NULL
                        AND (b.otorgado_por = 'tutor' OR AGE(NOW(), b.fecha_nacimiento) >= INTERVAL '14 years')
                 FROM consentimiento_bienestar b WHERE b.user_id = p_user), FALSE);
$;


-- Las autorizaciones se aceptan online al crear la cuenta; el DNI del tutor
-- deja de ser obligatorio (solo se pide si la familia trae el papel).
ALTER TABLE consentimientos_tutor ALTER COLUMN tutor_dni DROP NOT NULL;


-- ── 8. Temporadas: recompensas de nivel por temporada ────────────────────────
-- Cada temporada empieza en Novato, así que la misma recompensa de nivel puede
-- volver a ganarse la temporada siguiente.
ALTER TABLE recompensas_entregadas ADD COLUMN IF NOT EXISTS temporada TEXT NOT NULL DEFAULT '2026-27';
ALTER TABLE recompensas_entregadas DROP CONSTRAINT IF EXISTS recompensas_entregadas_user_id_nivel_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recompensas_temporada_nivel
  ON recompensas_entregadas(user_id, temporada, nivel);


-- ── 9. Tienda de Escamas ─────────────────────────────────────────────────────
-- Las Escamas ganadas se calculan desde el libro de XP (Semanas Dragón, bloques
-- y niveles); aquí solo se guardan los canjes. Saldo = ganadas − canjes no rechazados.
CREATE TABLE IF NOT EXISTS canjes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temporada     TEXT NOT NULL,
  item          TEXT NOT NULL,
  escamas       SMALLINT NOT NULL CHECK (escamas > 0),
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregado','rechazado')),
  nota          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entregado_en  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_canjes_user ON canjes(user_id, temporada);
ALTER TABLE canjes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "canjes_self_read" ON canjes;
CREATE POLICY "canjes_self_read" ON canjes FOR SELECT USING (auth.uid() = user_id);


-- ── 10. Mantenimiento de cada 30 de junio (ejecutar a mano) ─────────────────
-- Borra los datos de bienestar y las estaturas de la temporada que acaba, como
-- promete la política de privacidad. El resto del check-in se conserva.
-- UPDATE checkins SET energia = NULL, sueno = NULL, dolor = NULL, dolor_zona = NULL,
--        animo = NULL, nervios = NULL, disfrute = NULL, concentracion = NULL
--  WHERE fecha <= '2027-06-30';
-- DELETE FROM mediciones WHERE fecha <= '2027-06-30';
