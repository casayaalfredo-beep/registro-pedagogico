-- ============================================================================
-- SISTEMA DE CALIFICACIÓN AUTOMÁTICA OMR — REGISTRO PEDAGÓGICO 2026
-- Proyecto Supabase compartido con app_asistencia (Tablas aisladas con prefijo omr_)
-- Pegar en: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Tabla de Cursos sincronizados desde el Registro Pedagógico (Config)
create table if not exists public.omr_cursos (
  config_id integer primary key,
  curso text not null,
  area text not null,
  maestro text not null default '',
  unidad_educativa text not null default '',
  gestion text not null default '2026',
  pin_acceso text not null default '2026',
  updated_at timestamptz not null default now()
);

-- 2. Tabla de Estudiantes sincronizados con su Número de Lista oficial (1..N por Apellidos ASC)
create table if not exists public.omr_estudiantes (
  id text primary key,
  config_id integer not null references public.omr_cursos(config_id) on delete cascade,
  numero_lista integer not null,
  apellidos text not null,
  nombres text not null,
  rude text not null default '',
  ci text not null default '',
  updated_at timestamptz not null default now(),
  unique (config_id, numero_lista)
);

-- 3. Tabla de Evaluaciones OMR y Claves de Respuestas (Columna 1 / Columna 2)
create table if not exists public.omr_evaluaciones (
  id text primary key,
  config_id integer not null references public.omr_cursos(config_id) on delete cascade,
  trimestre integer not null check (trimestre in (1, 2, 3)),
  campo_destino text not null default 'saber_1',
  titulo text not null,
  fecha text not null default '',
  puntaje_maximo numeric(5,2) not null default 45,
  total_preguntas integer not null default 15,
  claves_json jsonb not null default '{}'::jsonb,
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 4. Tabla de Calificaciones Escaneadas desde el Celular (Cola de Sincronización Automática -> PC)
create table if not exists public.omr_calificaciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id text not null references public.omr_evaluaciones(id) on delete cascade,
  config_id integer not null,
  trimestre integer not null check (trimestre in (1, 2, 3)),
  campo_destino text not null default 'saber_1',
  titulo_evaluacion text not null default '',
  estudiante_id text not null,
  numero_lista integer not null,
  variante text not null default 'COL1',
  aciertos integer not null default 0,
  total_preguntas integer not null default 15,
  puntaje numeric(5,2) not null default 0,
  respuestas_json jsonb not null default '[]'::jsonb,
  sincronizado_pc boolean not null default false,
  escaneado_at timestamptz not null default now(),
  unique (evaluacion_id, estudiante_id)
);

create index if not exists idx_omr_est_config_lista on public.omr_estudiantes(config_id, numero_lista);
create index if not exists idx_omr_eval_config_trim on public.omr_evaluaciones(config_id, trimestre);
create index if not exists idx_omr_calif_sync on public.omr_calificaciones(sincronizado_pc, escaneado_at);

-- ============================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- El cliente móvil (anon key) solo interactúa mediante funciones RPC seguras.
-- El servidor local PC usa SUPABASE_SECRET_KEY (service_role) con acceso total.
-- ============================================================================

alter table public.omr_cursos enable row level security;
alter table public.omr_estudiantes enable row level security;
alter table public.omr_evaluaciones enable row level security;
alter table public.omr_calificaciones enable row level security;

-- ============================================================================
-- FUNCIONES RPC (SECURITY DEFINER) PARA EL PORTAL MÓVIL OMR
-- ============================================================================

-- A) Obtener contexto completo para el Portal Móvil OMR (Cursos, Nómina, Evaluaciones, Historial)
create or replace function public.omr_portal_contexto(p_pin text default '2026')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin_ok boolean;
  v_cursos jsonb;
  v_estudiantes jsonb;
  v_evaluaciones jsonb;
  v_calificaciones jsonb;
begin
  -- Verificar PIN si existen cursos (o permitir si la tabla aún está vacía)
  if exists (select 1 from public.omr_cursos) then
    select exists (
      select 1 from public.omr_cursos
      where trim(pin_acceso) = trim(coalesce(p_pin, '2026'))
         or trim(pin_acceso) = ''
    ) into v_pin_ok;

    if not v_pin_ok then
      return jsonb_build_object('ok', false, 'error', 'PIN de docente incorrecto.');
    end if;
  end if;

  select coalesce(jsonb_agg(row_to_json(c) order by c.config_id asc), '[]'::jsonb)
  into v_cursos
  from (
    select config_id, curso, area, maestro, unidad_educativa, gestion, updated_at
    from public.omr_cursos
  ) c;

  select coalesce(jsonb_agg(row_to_json(e) order by e.config_id asc, e.numero_lista asc), '[]'::jsonb)
  into v_estudiantes
  from (
    select id, config_id, numero_lista, apellidos, nombres, rude, ci
    from public.omr_estudiantes
  ) e;

  select coalesce(jsonb_agg(row_to_json(ev) order by ev.updated_at desc), '[]'::jsonb)
  into v_evaluaciones
  from (
    select id, config_id, trimestre, campo_destino, titulo, fecha, puntaje_maximo, total_preguntas, claves_json, activa, updated_at
    from public.omr_evaluaciones
    where activa = true
  ) ev;

  select coalesce(jsonb_agg(row_to_json(ca) order by ca.escaneado_at desc), '[]'::jsonb)
  into v_calificaciones
  from (
    select id, evaluacion_id, config_id, trimestre, campo_destino, titulo_evaluacion,
           estudiante_id, numero_lista, variante, aciertos, total_preguntas,
           puntaje, respuestas_json, sincronizado_pc, escaneado_at
    from public.omr_calificaciones
    order by escaneado_at desc
    limit 300
  ) ca;

  return jsonb_build_object(
    'ok', true,
    'cursos', v_cursos,
    'estudiantes', v_estudiantes,
    'evaluaciones', v_evaluaciones,
    'calificaciones', v_calificaciones
  );
end;
$$;

-- B) Crear o actualizar una Evaluación OMR (Título, Trimestre, Casilla SABER/HACER, Claves Col 1 y Col 2)
create or replace function public.omr_guardar_evaluacion(
  p_pin text,
  p_id text,
  p_config_id integer,
  p_trimestre integer,
  p_campo_destino text,
  p_titulo text,
  p_fecha text,
  p_puntaje_maximo numeric,
  p_total_preguntas integer,
  p_claves_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.omr_evaluaciones;
begin
  if not exists (
    select 1 from public.omr_cursos
    where config_id = p_config_id
      and (trim(pin_acceso) = trim(coalesce(p_pin, '2026')) or trim(pin_acceso) = '')
  ) then
    return jsonb_build_object('ok', false, 'error', 'Curso no encontrado o PIN inválido.');
  end if;

  insert into public.omr_evaluaciones (
    id, config_id, trimestre, campo_destino, titulo, fecha,
    puntaje_maximo, total_preguntas, claves_json, activa, updated_at
  )
  values (
    coalesce(nullif(trim(p_id), ''), 'eval_' || p_config_id || '_' || p_trimestre || '_' || trim(p_campo_destino)),
    p_config_id,
    p_trimestre,
    trim(p_campo_destino),
    trim(p_titulo),
    coalesce(nullif(trim(p_fecha), ''), to_char(now(), 'YYYY-MM-DD')),
    coalesce(p_puntaje_maximo, 45),
    coalesce(p_total_preguntas, 15),
    coalesce(p_claves_json, '{}'::jsonb),
    true,
    now()
  )
  on conflict (id) do update set
    config_id = excluded.config_id,
    trimestre = excluded.trimestre,
    campo_destino = excluded.campo_destino,
    titulo = excluded.titulo,
    fecha = excluded.fecha,
    puntaje_maximo = excluded.puntaje_maximo,
    total_preguntas = excluded.total_preguntas,
    claves_json = excluded.claves_json,
    activa = true,
    updated_at = now()
  returning * into v_eval;

  return jsonb_build_object(
    'ok', true,
    'evaluacion', row_to_json(v_eval)
  );
end;
$$;

-- C) Registrar calificación escaneada desde el Celular (Reconocimiento automático por N° de Lista)
create or replace function public.omr_registrar_calificacion(
  p_pin text,
  p_evaluacion_id text,
  p_config_id integer,
  p_trimestre integer,
  p_campo_destino text,
  p_titulo_evaluacion text,
  p_numero_lista integer,
  p_variante text,
  p_aciertos integer,
  p_total_preguntas integer,
  p_puntaje numeric,
  p_respuestas_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est public.omr_estudiantes;
  v_calif public.omr_calificaciones;
begin
  -- Validar PIN y curso
  if not exists (
    select 1 from public.omr_cursos
    where config_id = p_config_id
      and (trim(pin_acceso) = trim(coalesce(p_pin, '2026')) or trim(pin_acceso) = '')
  ) then
    return jsonb_build_object('ok', false, 'error', 'PIN inválido o curso no sincronizado.');
  end if;

  -- Buscar estudiante por (config_id, numero_lista)
  select * into v_est
  from public.omr_estudiantes
  where config_id = p_config_id
    and numero_lista = p_numero_lista
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'No existe estudiante con N° de Lista ' || p_numero_lista || ' en este curso.'
    );
  end if;

  -- Asegurar que exista la evaluación referenciada (auto-creación si el celular escanea directo)
  insert into public.omr_evaluaciones (
    id, config_id, trimestre, campo_destino, titulo, fecha, puntaje_maximo, total_preguntas, activa, updated_at
  )
  values (
    p_evaluacion_id, p_config_id, p_trimestre, p_campo_destino,
    coalesce(nullif(trim(p_titulo_evaluacion), ''), 'Evaluación OMR'),
    to_char(now(), 'YYYY-MM-DD'), 45, coalesce(p_total_preguntas, 15), true, now()
  )
  on conflict (id) do update set
    campo_destino = excluded.campo_destino,
    titulo = coalesce(nullif(trim(excluded.titulo), ''), public.omr_evaluaciones.titulo),
    updated_at = now();

  -- Insertar o actualizar la calificación y marcar sincronizado_pc = false para que la PC la descargue
  insert into public.omr_calificaciones (
    evaluacion_id, config_id, trimestre, campo_destino, titulo_evaluacion,
    estudiante_id, numero_lista, variante, aciertos, total_preguntas,
    puntaje, respuestas_json, sincronizado_pc, escaneado_at
  )
  values (
    p_evaluacion_id, p_config_id, p_trimestre, trim(p_campo_destino),
    coalesce(nullif(trim(p_titulo_evaluacion), ''), 'Evaluación OMR'),
    v_est.id, p_numero_lista, coalesce(nullif(trim(p_variante), ''), 'COL1'),
    coalesce(p_aciertos, 0), coalesce(p_total_preguntas, 15),
    coalesce(p_puntaje, 0), coalesce(p_respuestas_json, '[]'::jsonb),
    false, now()
  )
  on conflict (evaluacion_id, estudiante_id) do update set
    trimestre = excluded.trimestre,
    campo_destino = excluded.campo_destino,
    titulo_evaluacion = excluded.titulo_evaluacion,
    numero_lista = excluded.numero_lista,
    variante = excluded.variante,
    aciertos = excluded.aciertos,
    total_preguntas = excluded.total_preguntas,
    puntaje = excluded.puntaje,
    respuestas_json = excluded.respuestas_json,
    sincronizado_pc = false,
    escaneado_at = now()
  returning * into v_calif;

  return jsonb_build_object(
    'ok', true,
    'estudiante', jsonb_build_object(
      'id', v_est.id,
      'numero_lista', v_est.numero_lista,
      'apellidos', v_est.apellidos,
      'nombres', v_est.nombres,
      'nombre_completo', trim(v_est.apellidos || ' ' || v_est.nombres)
    ),
    'calificacion', row_to_json(v_calif)
  );
end;
$$;

grant execute on function public.omr_portal_contexto(text) to anon, authenticated, service_role;
grant execute on function public.omr_guardar_evaluacion(text, text, integer, integer, text, text, text, numeric, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.omr_registrar_calificacion(text, text, integer, integer, text, text, integer, text, integer, integer, numeric, jsonb) to anon, authenticated, service_role;
