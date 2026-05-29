# SPEC: Dragons Den Basketball Academy — Sistema de Gestión Completo
**Versión**: 1.0
**Fecha**: 2026-05-30
**Autor**: Workflow Architect
**Estado**: Draft

---

## Contexto y estado actual del sistema

Antes de diseñar, se auditaron los archivos existentes. Hallazgos críticos:

**Lo que ya existe y funciona:**
- `api/inscripcion.js` — POST que inserta en `campus_inscripciones`, envía emails al owner y al usuario via Resend. No requiere autenticación. El formulario es independiente del registro de cuenta.
- `api/admin-data.js` — GET que devuelve users, campus_inscripciones, academia_waitlist, seguimiento_temporada, analisis_videos, mensajes. Verifica `user_metadata.is_admin = true`.
- `api/admin-action.js` — POST con acciones: `assign`/`revoke` (packs), `update_campus`, `update_waitlist`, `create_seguimiento`, `update_seguimiento`, `update_video`, `send_message`, `mark_read`.
- `plataforma.html` — Dashboard de clientes con diseño oscuro (Satoshi + Bebas Neue, paleta negra + dorado #c8a96e). Sidebar + contenido principal.

**Tablas que ya existen en Supabase (inferidas del código):**
- `campus_inscripciones` — inscripciones del formulario público
- `academia_waitlist` — lista de espera academia
- `seguimiento_temporada` — seguimiento personalizado por temporada
- `analisis_videos` — videos enviados para análisis
- `mensajes` — mensajería admin → usuario (y usuario → admin)
- `user_packs` — packs asignados a usuarios (pack_id: tiro, footwork, defensa, fisico, mental, completo, all)
- `user_profiles` — perfil extendido del usuario (nombre, etc.)

**GAP CRITICO descubierto:** No existe un mecanismo de control de acceso granular por usuario. La asignación de packs actúa como proxy de "acceso dado", pero no hay un campo `acceso_activo: boolean` ni un `tier` explícito en `user_profiles`. El admin-action.js puede asignar/revocar packs pero no hay un toggle simple de "activar/desactivar acceso a la plataforma". Esto hay que diseñarlo.

**GAP CRITICO descubierto 2:** La tabla `campus_inscripciones` no tiene `user_id` — las inscripciones del formulario no se vinculan al usuario registrado. Hay que decidir si vincular por email o añadir FK.

**GAP CRITICO descubierto 3:** `plataforma.html` carga sin condiciones visibles de tier — no muestra "Pendiente de activación" ni diferencia entre Campus Verano y Seguimiento Temporada. Necesita lógica de estado.

---

## 1. SCHEMA SQL

### 1.1 Modificar tabla existente: `user_profiles`

```sql
-- La tabla ya existe. Añadir columnas faltantes:
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS acceso_activo   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tier            TEXT      CHECK (tier IN ('campus_verano', 'seguimiento_temporada', 'ambos')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acceso_desde    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas_admin     TEXT      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inscripcion_id  UUID      REFERENCES campus_inscripciones(id) ON DELETE SET NULL;

-- Índice para búsquedas por acceso activo
CREATE INDEX IF NOT EXISTS idx_user_profiles_acceso ON user_profiles(acceso_activo);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier   ON user_profiles(tier);
```

### 1.2 Modificar tabla existente: `campus_inscripciones`

```sql
-- Añadir vinculación con usuario registrado y campos de gestión
ALTER TABLE campus_inscripciones
  ADD COLUMN IF NOT EXISTS id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- si no existe ya
  ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado      TEXT NOT NULL DEFAULT 'pendiente'
                           CHECK (estado IN ('pendiente', 'contactado', 'inscrito', 'no_interesado')),
  ADD COLUMN IF NOT EXISTS notas_admin TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- NOTA: admin-action.js ya usa estados 'pendiente','confirmado','cancelado' para update_campus.
-- Decisión de diseño: unificar estados. Ver sección 7 sobre edge cases.

CREATE INDEX IF NOT EXISTS idx_campus_user_id    ON campus_inscripciones(user_id);
CREATE INDEX IF NOT EXISTS idx_campus_estado     ON campus_inscripciones(estado);
CREATE INDEX IF NOT EXISTS idx_campus_email      ON campus_inscripciones(email);
CREATE INDEX IF NOT EXISTS idx_campus_created_at ON campus_inscripciones(created_at DESC);
```

### 1.3 Schema completo inferido y consolidado

```sql
-- ─────────────────────────────────────────────────────────────────
-- TABLA: user_profiles (estado final después de ALTER)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT,
  acceso_activo   BOOLEAN   NOT NULL DEFAULT FALSE,
  tier            TEXT      CHECK (tier IN ('campus_verano', 'seguimiento_temporada', 'ambos')),
  acceso_desde    TIMESTAMPTZ,
  notas_admin     TEXT,
  inscripcion_id  UUID,  -- FK a campus_inscripciones (añadir después de crear esa tabla)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- TABLA: campus_inscripciones (estado final después de ALTER)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campus_inscripciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  para_quien      TEXT,
  nombre          TEXT NOT NULL,
  edad            TEXT,
  posicion        TEXT,
  nivel           TEXT,
  club            TEXT,
  tutor_nombre    TEXT,
  tutor_relacion  TEXT,
  email           TEXT NOT NULL,
  telefono        TEXT,
  anterior        TEXT,
  meses           TEXT,
  lesiones        TEXT,
  objetivo        TEXT,
  origen          TEXT,
  comentarios     TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'contactado', 'inscrito', 'no_interesado')),
  notas_admin     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- TABLA: user_packs (ya existe — documenta su estructura esperada)
-- ─────────────────────────────────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS user_packs (
--   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   pack_id    TEXT NOT NULL CHECK (pack_id IN ('tiro','footwork','defensa','fisico','mental','completo','all')),
--   expires_at TIMESTAMPTZ NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   UNIQUE(user_id, pack_id)
-- );

-- ─────────────────────────────────────────────────────────────────
-- TABLA: mensajes (ya existe — documenta su estructura esperada)
-- ─────────────────────────────────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS mensajes (
--   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   email      TEXT NOT NULL,
--   de_admin   BOOLEAN NOT NULL DEFAULT FALSE,
--   contenido  TEXT NOT NULL,
--   leido      BOOLEAN NOT NULL DEFAULT FALSE,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
```

### 1.4 Row Level Security (RLS)

```sql
-- ─── user_profiles ───────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- El usuario solo puede leer y actualizar su propio perfil
CREATE POLICY "user_profiles_self_read" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_self_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    -- El usuario NO puede modificar estos campos desde el cliente
    acceso_activo = (SELECT acceso_activo FROM user_profiles WHERE user_id = auth.uid()),
    tier          = (SELECT tier          FROM user_profiles WHERE user_id = auth.uid()),
    acceso_desde  = (SELECT acceso_desde  FROM user_profiles WHERE user_id = auth.uid()),
    notas_admin   = (SELECT notas_admin   FROM user_profiles WHERE user_id = auth.uid())
  );

-- El service_key (usado por las APIs) bypasea RLS automáticamente

-- ─── campus_inscripciones ─────────────────────────────────────────
ALTER TABLE campus_inscripciones ENABLE ROW LEVEL SECURITY;

-- El usuario puede leer su propia inscripción (vinculada por user_id o email)
CREATE POLICY "campus_self_read" ON campus_inscripciones
  FOR SELECT USING (
    auth.uid() = user_id
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Inserción pública (el formulario no requiere auth) — gestionado via service_key en la API
-- No se añade política de INSERT para anon; la API usa service_key que bypasea RLS.

-- ─── mensajes ────────────────────────────────────────────────────
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajes_self_read" ON mensajes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "mensajes_self_insert" ON mensajes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND de_admin = FALSE);
```

### 1.5 Índices adicionales

```sql
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id    ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packs_user_id       ON user_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_user_id         ON mensajes(user_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_leido           ON mensajes(leido) WHERE leido = FALSE;
```

---

## 2. API ENDPOINTS

### Convenciones generales

- **Auth admin**: header `Authorization: Bearer <supabase_jwt>` donde el JWT pertenece a un usuario con `user_metadata.is_admin = true`. Verificado via `GET /auth/v1/user` con ANON_KEY.
- **Auth usuario**: mismo header pero sin requisito de `is_admin`.
- **Sin auth**: endpoints públicos (inscripcion.js).
- **Error format**: `{ "error": "Descripción legible", "code": "ERROR_CODE" }`
- **Success format**: `{ "success": true, "data": {...} }` o `{ "success": true }`
- **CORS**: Orígenes permitidos `https://dragonsden.es`, `https://www.dragonsden.es`.

---

### ENDPOINT 1: `POST /api/inscripcion` (ya existe)

**Auth requerida**: Ninguna (pública)
**Descripción**: Recibe el formulario multi-step. Inserta en `campus_inscripciones`, envía emails.

**Request body**:
```json
{
  "para_quien":    "Para mí mismo / Para su hijo/a",
  "nombre":        "string (required)",
  "edad":          "string",
  "posicion":      "string",
  "nivel":         "string",
  "club":          "string",
  "tutor_nombre":  "string",
  "tutor_relacion":"string",
  "email":         "string (required, formato válido)",
  "telefono":      "string",
  "anterior":      "string",
  "meses":         "string",
  "lesiones":      "string",
  "objetivo":      "string",
  "origen":        "string",
  "comentarios":   "string"
}
```

**Response 200**: `{ "success": true }`
**Response 400**: `{ "success": false, "error": "Faltan campos obligatorios" }`
**Response 500**: `{ "success": false, "error": "Error al enviar" }`

**Modificación necesaria**: Tras insertar en campus_inscripciones, intentar vincular con `auth.users` por email. Si existe usuario con ese email, actualizar `campus_inscripciones.user_id` y `user_profiles.inscripcion_id`. Este paso es best-effort (no fallar si el usuario no existe aún).

---

### ENDPOINT 2: `GET /api/admin-data` (ya existe — ampliar)

**Auth requerida**: Admin (`is_admin = true` en user_metadata)
**Descripción**: Devuelve todos los datos necesarios para el panel de admin.

**Response 200** (estructura actual + nuevos campos):
```json
{
  "users": [
    {
      "id":            "uuid",
      "email":         "string",
      "name":          "string",
      "confirmed":     "boolean",
      "is_admin":      "boolean",
      "created_at":    "ISO8601",
      "profile": {
        "acceso_activo":  "boolean",
        "tier":           "campus_verano | seguimiento_temporada | ambos | null",
        "acceso_desde":   "ISO8601 | null",
        "notas_admin":    "string | null",
        "inscripcion_id": "uuid | null"
      },
      "packs": [
        { "id": "uuid", "pack": "string", "expires_at": "ISO8601" }
      ]
    }
  ],
  "campus":      [ /* campus_inscripciones rows */ ],
  "waitlist":    [ /* academia_waitlist rows */ ],
  "seguimiento": [ /* seguimiento_temporada rows */ ],
  "videos":      [ /* analisis_videos rows */ ],
  "mensajes":    [ /* mensajes rows */ ],
  "stats": {
    "total_inscripciones":   "number",
    "usuarios_activos":      "number",
    "nuevos_esta_semana":    "number",
    "tasa_conversion":       "number (0-100, porcentaje inscripciones con user_id)"
  }
}
```

**Modificación necesaria**: Añadir cálculo de `stats` en el handler. Calcular:
- `total_inscripciones`: campus.length
- `usuarios_activos`: users con profile.acceso_activo = true
- `nuevos_esta_semana`: users creados en los últimos 7 días
- `tasa_conversion`: (campus con user_id != null / total campus) * 100

---

### ENDPOINT 3: `POST /api/admin-action` (ya existe — ampliar)

**Auth requerida**: Admin
**Descripción**: Ejecuta acciones de gestión. Ampliar con nuevas acciones.

**Nuevas acciones a añadir:**

#### Acción: `toggle_access`
Activa o desactiva el acceso de un usuario a la plataforma.

**Request body**:
```json
{
  "action":   "toggle_access",
  "userId":   "uuid (required)",
  "activo":   "boolean (required)",
  "tier":     "campus_verano | seguimiento_temporada | ambos | null"
}
```
**Lógica**:
1. PATCH en `user_profiles` donde `user_id = userId`: `{ acceso_activo: activo, tier: tier, acceso_desde: activo ? NOW() : null }`
2. Si no existe fila en `user_profiles` para ese userId: INSERT con esos valores.
3. Si `activo = false`: no revocar packs (packs son independientes del acceso a la plataforma).

**Response 200**: `{ "success": true, "message": "Acceso activado/desactivado para <userId>" }`
**Response 400**: `{ "error": "Falta userId o activo" }`
**Response 500**: `{ "error": "Error al actualizar acceso", "details": {...} }`

---

#### Acción: `update_inscripcion_estado`
Actualiza el estado de una inscripción de campus (reemplaza `update_campus` que tenía estados diferentes).

**Request body**:
```json
{
  "action":       "update_inscripcion_estado",
  "id":           "uuid (required)",
  "estado":       "pendiente | contactado | inscrito | no_interesado",
  "notas_admin":  "string (optional)"
}
```

**Response 200**: `{ "success": true }`
**Response 400**: `{ "error": "Falta id" }` o `{ "error": "Estado inválido" }`
**Response 500**: `{ "error": "Error al actualizar" }`

---

#### Acción: `link_inscripcion_to_user`
Vincula manualmente una inscripción existente a un usuario registrado.

**Request body**:
```json
{
  "action":        "link_inscripcion_to_user",
  "inscripcionId": "uuid (required)",
  "userId":        "uuid (required)"
}
```
**Lógica**:
1. PATCH `campus_inscripciones` donde `id = inscripcionId`: `{ user_id: userId }`
2. PATCH `user_profiles` donde `user_id = userId`: `{ inscripcion_id: inscripcionId }`

**Response 200**: `{ "success": true }`

---

### ENDPOINT 4: `GET /api/my-profile` (nuevo)

**Auth requerida**: Usuario autenticado (cualquier usuario con sesión activa)
**Descripción**: El cliente ve su propio perfil, estado de acceso e inscripción vinculada.

**Request**: GET con header `Authorization: Bearer <user_jwt>`

**Lógica del handler**:
1. Verificar JWT via `GET /auth/v1/user` con ANON_KEY. Obtener `userId` y `email`.
2. Query `user_profiles` donde `user_id = userId`.
3. Si existe `inscripcion_id` en el perfil, query `campus_inscripciones` donde `id = inscripcion_id`.
4. Si no hay `inscripcion_id` en el perfil, intentar buscar inscripción por email: query `campus_inscripciones` donde `email = email` ORDER BY created_at DESC LIMIT 1.
5. Query `mensajes` donde `user_id = userId` ORDER BY created_at DESC LIMIT 20.
6. Query `user_packs` donde `user_id = userId`.

**Response 200**:
```json
{
  "profile": {
    "nombre":        "string | null",
    "acceso_activo": "boolean",
    "tier":          "campus_verano | seguimiento_temporada | ambos | null",
    "acceso_desde":  "ISO8601 | null"
  },
  "inscripcion": {
    "nombre":   "string",
    "nivel":    "string",
    "meses":    "string",
    "objetivo": "string",
    "estado":   "pendiente | contactado | inscrito | no_interesado",
    "created_at":"ISO8601"
  },
  "packs":    [ { "pack": "string", "expires_at": "ISO8601" } ],
  "mensajes": [
    {
      "id":        "uuid",
      "de_admin":  "boolean",
      "contenido": "string",
      "leido":     "boolean",
      "created_at":"ISO8601"
    }
  ]
}
```
**Response 401**: `{ "error": "No autenticado" }`
**Response 500**: `{ "error": "Error al obtener perfil" }`

**Timeout**: 8s (4 queries en paralelo)
**On timeout**: return 503 `{ "error": "Servicio temporalmente no disponible" }`

---

### ENDPOINT 5: `POST /api/send-message` (nuevo — usuario → admin)

**Auth requerida**: Usuario autenticado
**Descripción**: El cliente envía un mensaje al admin desde la plataforma.

**Request body**:
```json
{
  "contenido": "string (required, max 2000 chars)"
}
```
**Lógica**:
1. Verificar JWT. Obtener userId y email.
2. Rate limit: no más de 5 mensajes en 24h por userId (verificar count en mensajes donde user_id = userId AND de_admin = false AND created_at > NOW() - INTERVAL '24h').
3. INSERT en `mensajes`: `{ user_id, email, de_admin: false, contenido, leido: false }`

**Response 200**: `{ "success": true }`
**Response 400**: `{ "error": "Mensaje vacío o demasiado largo" }`
**Response 429**: `{ "error": "Límite de mensajes alcanzado. Intenta mañana." }`
**Response 401**: `{ "error": "No autenticado" }`

---

## 3. WIREFRAME: Panel de Admin (admin.html)

### Layout general
Misma estructura visual que plataforma.html: fondo oscuro (#080808), sidebar izquierdo fijo de 240px, contenido principal scrollable. Tipografía: Satoshi + Bebas Neue. Acento: dorado #c8a96e.

### Sidebar
```
[Logo DRAGONS DEN]
[ADMIN PANEL — texto dorado pequeño, letter-spacing]

Navegación:
  [icono cuadrícula]  Resumen
  [icono usuarios]    Usuarios
  [icono formulario]  Inscripciones
  [icono mensajes]    Mensajes  [badge rojo con count no leídos]

Pie del sidebar:
  [foto/inicial del admin]  Yefangyi
  [botón cerrar sesión]
```

### Sección: Resumen (vista por defecto)

**Fila de 4 stat cards** (borde fino dorado, fondo #0f0f0f):
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ INSCRIPCIONES   │  │ USUARIOS        │  │ NUEVOS          │  │ CONVERSIÓN      │
│ TOTALES         │  │ ACTIVOS         │  │ ESTA SEMANA     │  │ FORM→REGISTRO   │
│                 │  │                 │  │                 │  │                 │
│   [número]      │  │   [número]      │  │   [número]      │  │   [%]           │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Lista de inscripciones recientes** (últimas 5, con botón "Ver todas"):
- Cada fila: nombre, email, nivel, meses solicitados, estado con badge de color, fecha, botón "Abrir"
- Badges: `pendiente` (gris), `contactado` (amarillo/dorado), `inscrito` (verde), `no_interesado` (rojo tenue)

**Lista de usuarios sin acceso activado** (pendientes de revisión):
- Cada fila: email, fecha de registro, badge "Sin acceso", botón "Activar"
- Si hay 0: texto "Todos los usuarios tienen acceso configurado"

---

### Sección: Usuarios

**Header**: "Usuarios registrados" + contador total + buscador (filtrar por nombre/email en cliente)

**Tabla de usuarios** (cada fila expandible):
```
Columnas:
  [avatar inicial] NOMBRE / EMAIL  |  REGISTRO  |  EMAIL CONFIRMADO  |  ACCESO  |  TIER  |  ACCIONES
```

**Fila expandida** muestra:
- Toggle "Acceso a la plataforma" — al activar, aparece selector de tier:
  - "Campus Verano" / "Seguimiento Temporada" / "Ambos"
- Sección "Packs asignados" — lista de packs con botón revocar por cada uno + selector para asignar nuevo pack
- Sección "Inscripción vinculada" — si existe, muestra resumen con botón "Desvincular" y otro "Ver completo"
- Campo de texto "Notas internas" con botón guardar
- Botón "Contactar por WhatsApp" — abre `https://wa.me/34{telefono}` si hay teléfono en inscripción vinculada, sino abre mailto

**Comportamiento del toggle de acceso:**
- ON → muestra selector de tier → guardar activa el usuario
- OFF → desactiva acceso inmediatamente (sin confirmación extra)
- Estado visual: toggle verde cuando activo, gris cuando no

---

### Sección: Inscripciones

**Tabs**: "Campus Verano" | "Lista de Espera" | "Seguimiento Temporada"

**Tab Campus Verano**:
- Filtros rápidos: Todos | Pendiente | Contactado | Inscrito | No interesado
- Buscador por nombre/email
- Tabla con columnas: NOMBRE, EMAIL, NIVEL, MESES, FECHA, ESTADO, ACCIONES
- Al hacer click en una fila, panel lateral deslizante (drawer) con:
  - Todos los datos del formulario (nombre, edad, posición, nivel, club, tutor si aplica, teléfono, disponibilidad, lesiones, objetivo, origen, comentarios)
  - Selector de estado (dropdown)
  - Campo de notas del admin (textarea)
  - Botón guardar cambios
  - Botón "Contactar WhatsApp" (abre wa.me si hay teléfono)
  - Botón "Vincular a usuario" — busca usuarios registrados por email y permite seleccionar
  - Si ya está vinculado: "Usuario: [email] — [Ver perfil]"

**Tab Lista de Espera** (academia_waitlist):
- Mismo patrón con estados: en_lista, convertido, descartado

**Tab Seguimiento Temporada**:
- Lista con nombre, temporada, sesiones/mes, próxima revisión, estado
- Formulario inline para crear nuevo seguimiento
- Panel lateral para editar cada registro

---

### Sección: Mensajes

**Columna izquierda**: Lista de conversaciones (agrupadas por usuario)
- Cada item: [avatar inicial] NOMBRE / EMAIL | preview último mensaje | fecha | badge no leídos

**Columna derecha**: Conversación seleccionada
- Mensajes del usuario (alineados izquierda, burbuja oscura)
- Mensajes del admin (alineados derecha, burbuja dorada tenue)
- Input area + botón Enviar en la parte inferior

**Comportamiento**: Al abrir una conversación, llama a `mark_read` para marcar mensajes del usuario como leídos.

---

### Flujo de autenticación del admin panel
```
Carga admin.html
  → supabase.auth.getSession()
  → Sin sesión: redirigir a login.html?redirect=/admin.html
  → Con sesión: llamar GET /api/admin-data
    → 403: mostrar "Acceso denegado — no eres administrador"
    → 200: mostrar el panel
```

---

## 4. WIREFRAME: Dashboard de Clientes (plataforma.html — mejoras)

### Estado 1: PENDIENTE DE ACTIVACIÓN

Condición: `profile.acceso_activo === false`

**Pantalla completa de estado** (reemplaza el contenido normal del dashboard):
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   [icono reloj / guardia dorado]                │
│                                                 │
│   ACCESO PENDIENTE                              │
│   (Bebas Neue, dorado, letra-spacing amplio)    │
│                                                 │
│   Tu plaza está en proceso de verificación.     │
│   Yefangyi revisará tu inscripción y te         │
│   activará el acceso en las próximas 24-48h.    │
│                                                 │
│   ─────────────────────────────────────────     │
│   RESUMEN DE TU INSCRIPCIÓN                     │
│   Nivel: [nivel]                                │
│   Modalidad: [meses]                            │
│   Estado: [badge estado]                        │
│   ─────────────────────────────────────────     │
│                                                 │
│   ¿Tienes alguna pregunta?                      │
│   [Botón "Contactar por WhatsApp"]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

Sidebar sigue visible pero todos los links de contenido aparecen deshabilitados (opacidad 0.3, cursor not-allowed). Solo "Mi Inscripción" y "Mensajes" permanecen activos.

---

### Estado 2: ACCESO ACTIVO — CAMPUS VERANO

Condición: `profile.acceso_activo === true` Y `profile.tier` contiene `campus_verano`

**Badge en sidebar**: pequeño tag verde "Campus Verano" junto al nombre de usuario.

**Sección de contenido**:
- Sección "Programa" — descripción del curriculum del campus (de CONTENIDO/curriculo-academia-online.md)
- Sección "Videos" — contenido específico Campus Verano
- Sección "Mi Análisis" — si tiene `user_packs` con packs activos, mostrar contenido del pack
- Sección "Mi Inscripción" — datos que envió en el formulario (solo lectura)
- Sección "Mensajes" — conversación con el admin

**Banner informativo** en la parte superior del contenido:
```
[icono campus] CAMPUS VERANO 2026 — Bienvenido/a a la guarida, [nombre].
```

---

### Estado 3: ACCESO ACTIVO — SEGUIMIENTO TEMPORADA

Condición: `profile.acceso_activo === true` Y `profile.tier` contiene `seguimiento_temporada`

**Badge en sidebar**: tag azul/dorado "Seguimiento Temporada".

**Sección de contenido**:
- Sección "Mi Plan" — datos de seguimiento_temporada vinculados al usuario (nivel actual, objetivos, sesiones/mes, próxima revisión)
- Sección "Videos de Análisis" — muestra sus analisis_videos con estado de revisión
- Sección "Packs" — contenido según packs asignados
- Sección "Mensajes" — conversación con el admin
- Sección "Mi Inscripción" — datos del formulario

**Panel "Próxima Revisión"** (si proxima_revision existe):
```
[icono calendario]  Próxima sesión de seguimiento: [fecha]
                    [descripción de objetivos si existe]
```

---

### Estado 4: ACCESO ACTIVO — AMBOS TIERS

Condición: `profile.tier === 'ambos'`

Muestra contenido de ambos estados con navegación por tabs en la parte superior del contenido principal:
```
[ Campus Verano ]  [ Seguimiento Temporada ]
```

---

### Carga inicial de plataforma.html (nuevo flujo)

```
Carga plataforma.html
  → supabase.auth.getSession()
  → Sin sesión → redirigir a login.html
  → Con sesión → GET /api/my-profile
    → Error 401 → redirigir a login.html
    → Error 503 → mostrar "Error de conexión — intentar de nuevo"
    → 200 → evaluar profile.acceso_activo:
        FALSE → mostrar Estado 1 (Pendiente)
        TRUE  → evaluar profile.tier:
          'campus_verano'         → mostrar Estado 2
          'seguimiento_temporada' → mostrar Estado 3
          'ambos'                 → mostrar Estado 4
          null                    → mostrar Estado 1 (tratarlo como pendiente aunque acceso_activo=true es un estado inconsistente — ver edge cases)
```

---

## 5. FLUJO COMPLETO: Desde formulario hasta contenido activo

### PASO 1: Usuario rellena el formulario de inscripción

**Actor**: Visitante en index.html
**Trigger**: Click "Enviar" en el formulario multi-step

```
Usuario rellena formulario (nombre, email, teléfono, nivel, meses, etc.)
  → POST /api/inscripcion
    → Validación: nombre y email obligatorios, email formato válido
    → FALLO validación → 400 devuelto → formulario muestra error inline
    → ÉXITO:
      → INSERT campus_inscripciones (estado: 'pendiente', sin user_id)
      → Envío email al owner (bbdragonsden@gmail.com) con todos los datos
      → Envío email al usuario con confirmación de recepción
      → Intent de vinculación: buscar auth.users por email — si existe, actualizar user_id en la inscripción
      → 200 devuelto → formulario muestra pantalla de confirmación
```

**Observable**:
- Usuario: pantalla de confirmación "Tu plaza está reservada" con resumen
- Owner: email con todos los datos del formulario
- Base de datos: fila en campus_inscripciones con estado='pendiente'
- Logs: inscripcion: OK, campus insert: OK, emails: OK

---

### PASO 2: Usuario se registra en la plataforma (register.html)

**Actor**: El mismo visitante, o uno diferente con el mismo email

**Trigger**: Formulario de registro con email + contraseña

```
Usuario rellena register.html (email, contraseña)
  → supabase.auth.signUp({ email, password })
  → Supabase envía email de confirmación
  → Usuario confirma email
  → Supabase crea auth.users row
  → Supabase trigger (o la API) debería crear user_profiles row con acceso_activo: false
  → Si existe campus_inscripcion con ese email: vincular user_id y inscripcion_id automáticamente
```

**GAP IDENTIFICADO**: No hay ningún trigger de Supabase definido para crear `user_profiles` al registrarse. Hay que crear este trigger en Supabase:

```sql
-- Trigger para crear user_profiles automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  insc_id UUID;
BEGIN
  -- Buscar inscripción con el mismo email
  SELECT id INTO insc_id
  FROM public.campus_inscripciones
  WHERE email = NEW.email
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.user_profiles (user_id, nombre, acceso_activo, inscripcion_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    FALSE,
    insc_id
  );

  -- Si encontramos inscripción, vincularla al usuario también
  IF insc_id IS NOT NULL THEN
    UPDATE public.campus_inscripciones
    SET user_id = NEW.id
    WHERE id = insc_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### PASO 3: Admin revisa el panel

**Actor**: Yefangyi en admin.html

```
Admin carga admin.html
  → Autenticado con is_admin = true → panel carga
  → Ve sección Resumen: nueva inscripción en "Inscripciones recientes"
  → Ve usuario nuevo en "Usuarios sin acceso"
  → Abre sección Inscripciones → encuentra la inscripción nueva
  → Abre drawer de la inscripción → revisa todos los datos
  → Cambia estado de 'pendiente' a 'contactado' → POST /api/admin-action { action: 'update_inscripcion_estado', id, estado: 'contactado' }
  → Botón "Contactar WhatsApp" → abre wa.me en nueva pestaña
```

---

### PASO 4: Admin activa el acceso

**Actor**: Yefangyi en admin.html

```
Admin abre sección Usuarios → encuentra al nuevo usuario
  → Expande la fila del usuario
  → Toggle "Acceso a la plataforma" → OFF → ON
  → Selector de tier aparece → selecciona "Campus Verano"
  → Click "Guardar" → POST /api/admin-action { action: 'toggle_access', userId, activo: true, tier: 'campus_verano' }
    → PATCH user_profiles: { acceso_activo: true, tier: 'campus_verano', acceso_desde: NOW() }
    → 200 devuelto → toggle muestra verde, badge "Campus Verano" aparece en la fila
  → Admin opcionalmente asigna pack de contenido: POST /api/admin-action { action: 'assign', userId, pack: 'tiro' }
  → Admin cambia estado de inscripción a 'inscrito': POST /api/admin-action { action: 'update_inscripcion_estado', id, estado: 'inscrito' }
```

---

### PASO 5: Cliente vuelve a la plataforma

**Actor**: Usuario registrado en plataforma.html

```
Cliente carga plataforma.html
  → getSession() → sesión activa
  → GET /api/my-profile
    → profile.acceso_activo = TRUE, tier = 'campus_verano'
    → Inscripción vinculada: nivel, meses, objetivo
    → Packs: [{ pack: 'tiro', expires_at: '...' }]
  → Renderizar Estado 2: banner "Campus Verano", contenido desbloqueado
  → Cliente ve su programa, videos, y mensajes del admin
```

---

## 6. ORDEN DE IMPLEMENTACIÓN

### Fase 1 — Base de datos y endpoints (Día 1-2)
Entregar algo funcional lo antes posible.

1. **Ejecutar migraciones SQL** en Supabase Dashboard:
   - ALTER TABLE `user_profiles` (añadir acceso_activo, tier, acceso_desde, notas_admin, inscripcion_id)
   - ALTER TABLE `campus_inscripciones` (asegurar id, añadir estado, notas_admin)
   - Crear índices
   - Configurar RLS policies
   - Crear trigger `on_auth_user_created`

2. **Modificar `api/admin-action.js`**: añadir acción `toggle_access` y `update_inscripcion_estado`

3. **Crear `api/my-profile.js`**: nuevo endpoint GET para el dashboard de clientes

4. **Crear `api/send-message.js`**: nuevo endpoint POST para mensajes usuario → admin

5. **Modificar `api/admin-data.js`**: añadir cálculo de stats y asegurar que `profile.acceso_activo` se incluye en cada user

6. **Modificar `api/inscripcion.js`**: añadir paso de vinculación por email después del INSERT

### Fase 2 — Panel de Admin (Día 3-5)
7. Crear `admin.html` con las 4 secciones (Resumen, Usuarios, Inscripciones, Mensajes)
8. Implementar autenticación y redirect si no es admin
9. Implementar toggle de acceso y selector de tier
10. Implementar drawer de inscripciones con cambio de estado
11. Implementar sección de mensajes

### Fase 3 — Dashboard de Clientes (Día 5-6)
12. Modificar `plataforma.html`: añadir llamada a `/api/my-profile` en la carga inicial
13. Implementar renderizado condicional por estado (Estado 1, 2, 3, 4)
14. Implementar formulario de mensaje al admin
15. Mostrar datos de inscripción del usuario

### Fase 4 — Pulido y testing (Día 7)
16. Verificar todos los edge cases (ver sección 7)
17. Testing manual del flujo completo
18. Verificar CORS en producción (dragonsden.es)

---

## 7. EDGE CASES Y CÓMO MANEJARLOS

### EC-01: Usuario se registra ANTES de enviar el formulario

**Situación**: El usuario crea una cuenta en register.html, luego rellena el formulario en index.html.

**Sin el fix**: El trigger `on_auth_user_created` crea user_profiles sin inscripcion_id. La inscripción que viene después no se vincula automáticamente.

**Solución**: En `api/inscripcion.js`, después del INSERT en campus_inscripciones, hacer lookup en auth.users por email. Si existe usuario, actualizar:
- `campus_inscripciones.user_id = userId`
- `user_profiles.inscripcion_id = inscripcion.id`

Esto cubre ambos órdenes (registro antes o después del formulario).

---

### EC-02: Mismo email con múltiples inscripciones

**Situación**: El mismo email envía el formulario dos veces (campamentos diferentes, o un error).

**Comportamiento actual**: Se crean dos filas en campus_inscripciones. No hay restricción UNIQUE en email.

**Decisión de diseño**: Permitir múltiples inscripciones por email (el mismo jugador puede querer campus de verano Y academia). El trigger y el endpoint de my-profile usan `ORDER BY created_at DESC LIMIT 1` para la vinculación automática, tomando la más reciente.

**Para el admin**: En el drawer de un usuario, mostrar todas las inscripciones vinculadas, no solo una.

**Acción**: En `api/my-profile.js`, si hay múltiples inscripciones, devolver array. En plataforma.html, mostrar la más reciente como la principal.

---

### EC-03: Admin activa acceso sin tier seleccionado

**Situación**: Toggle activado pero tier = null.

**Comportamiento en la plataforma**: `profile.acceso_activo = true` pero `tier = null` → el código de plataforma.html caería en el caso `null` y mostraría Estado 1 (Pendiente) de nuevo, creando confusión.

**Solución**: En admin.html, el botón "Guardar" del toggle de acceso debe estar deshabilitado hasta que se seleccione un tier. Validación en el frontend del admin antes de llamar al API. El API también debe validar: si `activo = true` y `tier = null`, devolver 400.

**En `api/admin-action.js`** para la acción `toggle_access`:
```
if (activo === true && !tier) {
  return res.status(400).json({ error: 'Debes seleccionar un tier al activar el acceso' });
}
```

---

### EC-04: Concurrencia — Admin activa acceso mientras el usuario está en la plataforma

**Situación**: El usuario ya tiene plataforma.html abierta en Estado 1 (Pendiente) y el admin activa el acceso. El usuario no verá el cambio hasta que recargue.

**Solución aceptable para MVP**: No implementar polling ni websockets. Añadir en plataforma.html un botón "Actualizar estado" visible en el Estado 1 que llame de nuevo a `/api/my-profile`. Texto sugerido: "¿Ya tienes acceso? Pulsa aquí para comprobar".

---

### EC-05: El email de confirmación de Supabase no llega

**Situación**: El usuario se registra pero no confirma el email. `user.email_confirmed_at = null`.

**Comportamiento actual**: admin-data.js incluye un campo `confirmed: !!u.email_confirmed_at`. El admin puede ver quién no ha confirmado.

**Decisión de diseño**: En el admin panel, mostrar badge "Email no confirmado" en la fila del usuario. No bloquear al admin de activar el acceso (puede ser legítimo activar antes de que confirmen para un usuario que el admin conoce personalmente).

**En plataforma.html**: Si el usuario no ha confirmado el email, Supabase no permitirá la sesión activa de todas formas — este caso no llega al dashboard.

---

### EC-06: Conflicto de estados entre `update_campus` (acción existente) y `update_inscripcion_estado` (nueva)

**Situación**: La acción existente `update_campus` usa estados `pendiente`, `confirmado`, `cancelado`. La nueva acción usa `pendiente`, `contactado`, `inscrito`, `no_interesado`.

**Decisión**: Deprecar `update_campus` y reemplazarla con `update_inscripcion_estado`. Los estados antiguos (`confirmado`, `cancelado`) en la base de datos quedan como datos históricos — si hay filas existentes con esos estados, el admin panel las mostrará correctamente (badge genérico "otro" para estados no conocidos).

**Migración de datos** (si hay datos en producción):
```sql
UPDATE campus_inscripciones SET estado = 'inscrito'     WHERE estado = 'confirmado';
UPDATE campus_inscripciones SET estado = 'no_interesado' WHERE estado = 'cancelado';
```

---

### EC-07: Revocación de pack no revoca acceso a la plataforma

**Situación**: Admin revoca todos los packs de un usuario. El usuario sigue teniendo `acceso_activo = true`.

**Comportamiento esperado**: Los packs son contenido adicional (tiro, footwork, etc.), no el acceso básico a la plataforma. El acceso se gestiona con el toggle, no con los packs.

**Sin embargo**: Si el admin quiere "desactivar" a un usuario, debe hacer DOS acciones: revocar packs Y desactivar el toggle. Esto es confuso.

**Solución**: En admin.html, cuando el admin revoca el último pack, mostrar un prompt: "¿Quieres también desactivar el acceso a la plataforma?". No es automático, pero guía la acción.

---

### EC-08: Usuario no tiene user_profiles row (registro anterior al trigger)

**Situación**: Usuarios que se registraron antes de que se cree el trigger `on_auth_user_created` no tienen fila en user_profiles.

**En `api/my-profile.js`**: Si no hay fila en user_profiles, crear una con acceso_activo = false (upsert). El usuario verá Estado 1 (Pendiente).

**En `api/admin-action.js` para `toggle_access`**: El PATCH ya maneja el caso con upsert (INSERT si no existe, UPDATE si existe). Documentado en la sección de acciones.

**Migración manual**: Ejecutar en Supabase para usuarios existentes sin perfil:
```sql
INSERT INTO user_profiles (user_id, acceso_activo)
SELECT id, FALSE FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT DO NOTHING;
```

---

### EC-09: Timeout del panel de admin

**Situación**: `GET /api/admin-data` hace 8 queries en paralelo y puede exceder el límite de tiempo de Vercel Serverless (por defecto 10s, 30s en plan Pro).

**Riesgo actual**: Si hay muchos usuarios/registros, la función puede timeout. La promesa de 8 queries en paralelo puede saturar la conexión a Supabase.

**Solución de corto plazo para MVP**: No hay problema con pocos usuarios (< 500). A medio plazo, paginar la query de usuarios y cargar inscripciones/mensajes bajo demanda (lazy load por sección del admin panel).

---

### EC-10: Seguridad — el campo `is_admin` está en `user_metadata`

**Situación actual**: La verificación de admin en `admin-data.js` y `admin-action.js` usa `res.body.user_metadata?.is_admin`. `user_metadata` puede ser modificado por el propio usuario via `supabase.auth.updateUser()` en el cliente.

**VULNERABILIDAD CRITICA**: Un usuario malicioso podría hacer:
```js
supabase.auth.updateUser({ data: { is_admin: true } })
```
y obtener acceso de admin completo.

**Solución correcta**: Mover `is_admin` a `app_metadata`, que solo puede ser modificado con el service_key (no desde el cliente). Para hacerlo:
1. En Supabase Dashboard → Authentication → Users → seleccionar el admin → editar `app_metadata` directamente: `{ "is_admin": true }`
2. Modificar la verificación en los APIs:
```js
// Cambiar:
if (!res.body.user_metadata?.is_admin) return null;
// Por:
if (!res.body.app_metadata?.is_admin) return null;
```

**Este fix debe hacerse antes de ir a producción.** Es el edge case con mayor impacto de seguridad del sistema actual.

---

## 8. REGISTRO DE WORKFLOWS

### Workflows identificados

| Workflow | Estado del spec | Trigger | Actor principal |
|---|---|---|---|
| Inscripción pública | Existente (inscripcion.js) | POST /api/inscripcion | Visitante |
| Registro de cuenta | No specced (Supabase Auth) | register.html | Visitante |
| Activación de acceso por admin | Este spec (Fase 1) | Toggle en admin.html | Yefangyi |
| Visualización de plataforma | Este spec (Fase 3) | Carga plataforma.html | Cliente registrado |
| Gestión de inscripciones | Este spec (Fase 2) | Admin panel Sección Inscripciones | Yefangyi |
| Mensajería admin ↔ usuario | Existente (parcial) | send_message action | Yefangyi / Cliente |
| Asignación de packs | Existente (assign/revoke) | Admin action | Yefangyi |
| Reset de contraseña | No specced (reset-password.html) | reset-password.html | Cliente |

### Workflows con spec MISSING (red flags)

| Workflow | Por qué importa | Acción |
|---|---|---|
| Reset de contraseña | reset-password.html existe pero no se ha specced el flujo de token de Supabase | Speccar antes de Fase 4 |
| Expiración de packs | user_packs.expires_at existe pero no hay job que desactive acceso al expirar | Definir: ¿el cliente ve su acceso expirado? ¿Se notifica al admin? |
| Vinculación automática inscripción → usuario | Solo parcialmente cubierta — depende de orden registro/formulario | Este spec cubre los dos órdenes |

---

## 9. ASSUMPTIONS

| # | Assumption | Dónde verificar | Riesgo si es incorrecto |
|---|---|---|---|
| A1 | `user_profiles` ya existe como tabla en Supabase | Verificar en Supabase Dashboard | Los ALTER fallarán — cambiar a CREATE TABLE IF NOT EXISTS |
| A2 | `campus_inscripciones` ya tiene columna `id` como UUID PK | Inferido de `update_campus` que usa `id=eq.${id}` | El ALTER ID fallaría |
| A3 | `campus_inscripciones` NO tiene columna `estado` aún | El código de admin-action.js ya hace PATCH de estado, pero inscripcion.js no lo inserta | Si ya existe, solo verificar el CHECK constraint |
| A4 | La tabla `mensajes` tiene columna `de_admin` de tipo BOOLEAN | Inferido de admin-action.js línea 197 | Los queries de mensajes fallarían si el tipo es distinto |
| A5 | Vercel funciones en plan Hobby tienen timeout de 10s | No verificado | El admin-data.js puede timeout con muchos datos |
| A6 | `is_admin` está en `user_metadata` (modificable por cliente) | Confirmado leyendo el código | VULNERABILIDAD — mover a app_metadata urgente |
| A7 | No existe tabla `user_profiles` para usuarios registrados antes de crear el trigger | No verificable sin acceso a Supabase | Requiere migración manual (SQL en EC-08) |

---

## 10. OPEN QUESTIONS

1. **¿Los packs (tiro, footwork, etc.) son el contenido del Campus Verano, o son un sistema separado de academia online?** El curriculo en CONTENIDO/curriculo-academia-online.md sugiere que es la academia online. ¿Campus Verano es presencial y la plataforma es el contenido digital? Esto afecta qué contenido se muestra en Estado 2 vs Estado 3.

2. **¿Hay más tiers previstos más allá de `campus_verano` y `seguimiento_temporada`?** El schema usa TEXT con CHECK constraint — fácil de ampliar. Confirmar si hay otros productos/servicios en el horizonte.

3. **¿El admin panel necesita ser multi-admin?** El sistema actual usa `is_admin` binario. Si Yefangyi quiere dar acceso de admin a un colaborador, ya funciona. Pero ¿hay roles intermedios (asistente que puede ver datos pero no activar acceso)?

4. **¿Cuándo expira el acceso a la plataforma?** La columna `acceso_desde` guarda cuándo se activó, pero no hay `acceso_hasta`. ¿El acceso es indefinido hasta que el admin lo desactiva manualmente, o hay una fecha límite vinculada al campus?

5. **¿El botón "Contactar por WhatsApp" en el admin panel debe incluir un mensaje prefabricado?** Ejemplo: `https://wa.me/34612345678?text=Hola%20[nombre]%2C%20te%20contacto%20desde%20Dragons%20Den%20Basketball%20Academy...`

---

## 11. AUDIT LOG

| Fecha | Hallazgo | Acción tomada |
|---|---|---|
| 2026-05-30 | Spec inicial creado tras auditoría de admin-data.js, admin-action.js, inscripcion.js, plataforma.html | — |
| 2026-05-30 | VULNERABILIDAD: is_admin en user_metadata modificable por cliente | Documentado en EC-10, requiere fix urgente en app_metadata |
| 2026-05-30 | GAP: No existe trigger on_auth_user_created para user_profiles | Documentado SQL del trigger en Paso 2 del flujo completo |
| 2026-05-30 | GAP: campus_inscripciones no vincula con auth.users | Solución: vinculación bidireccional por email en inscripcion.js y en el trigger |
| 2026-05-30 | CONFLICTO: update_campus usa estados diferentes a los del nuevo diseño | Decisión de deprecar update_campus y añadir update_inscripcion_estado con migración SQL |
