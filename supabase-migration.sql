-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Creates tables for tracking campus and academia online registrations

-- Campus de verano inscriptions
CREATE TABLE IF NOT EXISTS campus_inscripciones (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  para_quien   text,
  nombre       text NOT NULL,
  edad         text,
  posicion     text,
  nivel        text,
  club         text,
  tutor_nombre text,
  tutor_relacion text,
  email        text NOT NULL,
  telefono     text,
  anterior     text,
  meses        text,
  lesiones     text,
  objetivo     text,
  origen       text,
  comentarios  text,
  estado       text DEFAULT 'pendiente',
  notas_admin  text
);

ALTER TABLE campus_inscripciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON campus_inscripciones;
CREATE POLICY "service_role_all" ON campus_inscripciones
  TO service_role USING (true) WITH CHECK (true);

-- Academia online waitlist
CREATE TABLE IF NOT EXISTS academia_waitlist (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  nombre      text NOT NULL,
  email       text NOT NULL,
  interes     text,
  estado      text DEFAULT 'en_lista',
  notas_admin text
);

ALTER TABLE academia_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON academia_waitlist;
CREATE POLICY "service_role_all" ON academia_waitlist
  TO service_role USING (true) WITH CHECK (true);
