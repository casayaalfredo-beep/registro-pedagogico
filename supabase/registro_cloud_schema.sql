-- ============================================================================
-- ESQUEMA DE NUBE PERMANENTE SUPABASE — REGISTRO PEDAGÓGICO 2026
-- Proyecto: https://nqzcgagybjnctfaeeiqd.supabase.co
-- Almacenamiento híbrido permanente:
--   1. PostgreSQL JSONB (omr_evaluaciones id = '__RP_CLOUD_VAULT_V2__' + Snapshots)
--      accesible vía RPC SECURITY DEFINER (omr_guardar_evaluacion / omr_portal_contexto)
--   2. Supabase Storage Bucket ('registro-pedagogico-vault') para copias .db y snapshots
-- ============================================================================

create extension if not exists pgcrypto;

-- Tabla opcional dedicada para snapshots adicionales si se ejecuta en SQL Editor
create table if not exists public.rp_cloud_store (
  id text primary key default 'master',
  version text not null default '2.0',
  device_origin text not null default 'LAPTOP',
  counts_json jsonb not null default '{}'::jsonb,
  payload_gzip_b64 text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.rp_cloud_history (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'auto',
  device_origin text not null default 'LAPTOP',
  counts_json jsonb not null default '{}'::jsonb,
  payload_gzip_b64 text not null,
  created_at timestamptz not null default now()
);
