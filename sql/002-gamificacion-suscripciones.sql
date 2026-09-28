-- ─────────────────────────────────────────────────────────────────────────────
-- Dragons Den · migración 002
-- Suscripciones recurrentes, consentimiento de tutores, Dragons Quests y IQ Clash.
--
-- Se ejecuta DESPUÉS de supabase-migration.sql (001).
--
-- Principio de reparto: el catálogo (retos, niveles, preguntas, planes) vive en
-- /data/*.json, versionado en git y desplegado con la web. Aquí solo vive lo que
-- cambia por usuario y no se puede perder. Ninguna tabla de aquí duplica un
-- enunciado de reto ni un precio: guardan el identificador y la versión del
-- catálogo con la que se resolvieron.
--
-- NOTA sobre user_profiles.tier: la columna existente admite solo
-- ('campus_verano','seguimiento_temporada','ambos'). Es del modelo antiguo de
-- pago único. NO se reutiliza para rookie/pro/elite: el plan vivo se lee de
-- `suscripciones`. Dejar `tier` como está hasta migrar a los usuarios actuales.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Suscripciones ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suscripciones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan               TEXT NOT NULL CHECK (plan IN ('rookie','pro','elite')),
  estado             TEXT NOT NULL DEFAULT 'activa'
                     CHECK (estado IN ('activa','impagada','pausada','cancelada')),
  -- Periodo de facturación en curso. Las cuotas de tickets y sesiones se cuentan
  -- contra este intervalo, no contra el mes natural: si alguien se da de alta el
  -- día 20, sus 2 tickets van del 20 al 20.
  periodo_inicio     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  periodo_fin        TIMESTAMPTZ NOT NULL,
  cancelar_al_final  BOOLEAN NOT NULL DEFAULT FALSE,
  proveedor_pago     TEXT CHECK (proveedor_pago IN ('stripe','gumroad','manual')),
  proveedor_ref      TEXT,
  precio_cents       INTEGER NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un usuario no puede tener dos suscripciones vivas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suscripcion_viva
  ON suscripciones(user_id) WHERE estado IN ('activa','impagada');

CREATE INDEX IF NOT EXISTS idx_suscripciones_user ON suscripciones(user_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_ref  ON suscripciones(proveedor_ref);

ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suscripciones_self_read" ON suscripciones
  FOR SELECT USING (auth.uid() = user_id);
-- Escritura solo por service_role (webhook de la pasarela). Sin política de
-- INSERT/UPDATE para el usuario: nadie se asciende a Élite desde el navegador.


-- ── 2. Consentimiento del tutor (menores de 14) ──────────────────────────────
-- LOPDGDD art. 7: por debajo de 14 años el consentimiento lo presta el titular
-- de la patria potestad. Subir un clip del jugador es tratar su imagen, así que
-- sin fila válida aquí la plataforma NO debe aceptar vídeo.
CREATE TABLE IF NOT EXISTS consentimientos_tutor (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha_nacimiento  DATE NOT NULL,
  tutor_nombre      TEXT NOT NULL,
  tutor_dni         TEXT NOT NULL,
  tutor_email       TEXT NOT NULL,
  tutor_relacion    TEXT NOT NULL CHECK (tutor_relacion IN ('madre','padre','tutor_legal')),
  -- Consentimientos separados y granulares: aceptar el tratamiento del vídeo
  -- para corrección técnica no autoriza a publicarlo en redes.
  acepta_tratamiento_video   BOOLEAN NOT NULL DEFAULT FALSE,
  acepta_uso_promocional     BOOLEAN NOT NULL DEFAULT FALSE,
  acepta_ranking_publico     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Prueba del consentimiento, que es lo que exige la AEPD si algún día pregunta.
  otorgado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_otorgamiento   INET,
  texto_version     TEXT NOT NULL,
  revocado_en       TIMESTAMPTZ,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consentimientos_tutor(user_id);

ALTER TABLE consentimientos_tutor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_self_read" ON consentimientos_tutor
  FOR SELECT USING (auth.uid() = user_id);

-- Devuelve TRUE si este usuario puede subir vídeo: o es mayor de 14, o tiene
-- consentimiento del tutor vigente para el tratamiento del vídeo.
CREATE OR REPLACE FUNCTION puede_subir_video(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT
       (AGE(NOW(), c.fecha_nacimiento) >= INTERVAL '14 years')
       OR (c.acepta_tratamiento_video AND c.revocado_en IS NULL)
     FROM consentimientos_tutor c WHERE c.user_id = p_user),
    FALSE);
$$;


-- ── 3. Dragons Quests: envíos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_envios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identificador del reto en /data/quests.json. Se guarda también la versión
  -- del catálogo: si mañana se reescriben los criterios, un envío ya corregido
  -- tiene que seguir explicándose con los criterios que se le aplicaron.
  quest_id         TEXT NOT NULL,
  catalogo_version INTEGER NOT NULL,
  semana           TEXT NOT NULL,
  url_clip         TEXT,
  comentario       TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aprobado','parcial','a_corregir','rechazado','caducado')),
  -- Evaluación criterio a criterio: [{"id":"c1","cumple":true},...]
  -- En jsonb porque el número y el peso de los criterios los manda el catálogo,
  -- no el esquema. Normalizarlo obligaría a migrar la base cada vez que se
  -- retoca un reto.
  evaluacion       JSONB NOT NULL DEFAULT '[]'::jsonb,
  xp_concedido     INTEGER NOT NULL DEFAULT 0,
  feedback_coach   TEXT,
  reenvios         SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  corregido_en     TIMESTAMPTZ,
  CONSTRAINT xp_no_negativo CHECK (xp_concedido >= 0)
);

-- Un envío vivo por reto y usuario. El reenvío actualiza la fila, no crea otra.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_envio_unico
  ON quest_envios(user_id, quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_envios_pendientes
  ON quest_envios(created_at) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_quest_envios_user ON quest_envios(user_id);

ALTER TABLE quest_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_envios_self_read" ON quest_envios
  FOR SELECT USING (auth.uid() = user_id);
-- El INSERT pasa por la API para poder comprobar plazo, plan y consentimiento.


-- ── 4. Libro mayor de XP ─────────────────────────────────────────────────────
-- El total de XP NO se guarda como número editable: se suma de aquí. Un saldo
-- mutable se corrompe en cuanto haya una corrección manual o un reintento de
-- webhook, y con él se corrompe el nivel y las recompensas ya entregadas.
CREATE TABLE IF NOT EXISTS xp_movimientos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cantidad    INTEGER NOT NULL,
  motivo      TEXT NOT NULL CHECK (motivo IN
              ('quest','quest_fuera_plazo','racha','iq_clash','ajuste_manual','penalizacion')),
  referencia  TEXT,
  nota        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_movimientos(user_id);
-- Evita conceder dos veces el XP del mismo reto por un doble clic o un reintento.
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_una_vez_por_referencia
  ON xp_movimientos(user_id, motivo, referencia)
  WHERE referencia IS NOT NULL AND motivo IN ('quest','quest_fuera_plazo','racha');

ALTER TABLE xp_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_self_read" ON xp_movimientos
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW xp_totales AS
  SELECT user_id, GREATEST(SUM(cantidad), 0)::INTEGER AS xp_total
  FROM xp_movimientos GROUP BY user_id;


-- ── 5. Recompensas entregadas ────────────────────────────────────────────────
-- Sin esta tabla, un recálculo de XP o un ajuste manual puede volver a disparar
-- una recompensa ya enviada. Aquí se anota lo que ya salió por la puerta.
CREATE TABLE IF NOT EXISTS recompensas_entregadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel         SMALLINT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','preparada','entregada','rechazada')),
  nota          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entregada_en  TIMESTAMPTZ,
  UNIQUE (user_id, nivel)
);

ALTER TABLE recompensas_entregadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recompensas_self_read" ON recompensas_entregadas
  FOR SELECT USING (auth.uid() = user_id);


-- ── 6. Dragons IQ Clash ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iq_duelos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retador_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rival_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- El duelo se comparte por WhatsApp con este código antes de que el rival
  -- exista como usuario: por eso rival_id es nullable.
  codigo         TEXT NOT NULL UNIQUE,
  preguntas      TEXT[] NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'esperando'
                 CHECK (estado IN ('esperando','en_juego','terminado','caducado')),
  ganador_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caduca_en      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_iq_duelos_retador ON iq_duelos(retador_id);
CREATE INDEX IF NOT EXISTS idx_iq_duelos_rival   ON iq_duelos(rival_id);

CREATE TABLE IF NOT EXISTS iq_respuestas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duelo_id     UUID NOT NULL REFERENCES iq_duelos(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pregunta_id  TEXT NOT NULL,
  opcion       TEXT,
  acierto      BOOLEAN NOT NULL,
  -- Milisegundos desde que se sirvió la pregunta. Se mide en el servidor: si lo
  -- manda el cliente, cualquiera responde siempre en 300 ms.
  ms           INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (duelo_id, user_id, pregunta_id)
);

ALTER TABLE iq_duelos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE iq_respuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iq_duelos_participante" ON iq_duelos
  FOR SELECT USING (auth.uid() = retador_id OR auth.uid() = rival_id);
-- iq_respuestas no se lee desde el cliente: revelaría los aciertos del rival
-- antes de terminar el duelo. Se sirve por API, ya terminado.


-- ── 7. Cuota de análisis de vídeo por periodo ────────────────────────────────
ALTER TABLE analisis_videos
  ADD COLUMN IF NOT EXISTS suscripcion_id UUID REFERENCES suscripciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cuenta_cuota   BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_analisis_suscripcion ON analisis_videos(suscripcion_id);

-- Tickets ya gastados en el periodo de facturación en curso.
CREATE OR REPLACE FUNCTION tickets_consumidos(p_user UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER
  FROM analisis_videos a
  JOIN suscripciones s ON s.user_id = a.user_id
  WHERE a.user_id = p_user
    AND a.cuenta_cuota
    AND s.estado = 'activa'
    AND a.created_at >= s.periodo_inicio
    AND a.created_at <  s.periodo_fin;
$$;
