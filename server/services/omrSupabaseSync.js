const os = require('os');
const crypto = require('crypto');

// Claves oficiales por defecto de la Evaluación: Operaciones con Números Decimales (1ro Sec. Matemática)
const DEFAULT_DECIMALES_KEYS = {
  COL1: ['B', 'D', 'A', 'C', 'A', 'D', 'B', 'C', 'A', 'D', 'B', 'C', 'A', 'B', 'D'],
  COL2: ['C', 'A', 'D', 'B', 'D', 'A', 'C', 'B', 'D', 'C', 'A', 'B', 'D', 'C', 'A']
};

// Estado en memoria del demonio OMR para monitoreo en tiempo real desde la interfaz React
const omrState = {
  enabled: false,
  schemaReady: false,
  schemaError: null,
  isSyncing: false,
  lastRosterPushAt: null,
  lastGradePullAt: null,
  totalAppliedSinceStart: 0,
  recentApplied: [], // Últimas 25 calificaciones aplicadas automáticamente
  lastError: null
};

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const pin = (process.env.OMR_PORTAL_PIN || '2026').trim();
  return {
    url,
    secretKey,
    anonKey,
    pin,
    configured: Boolean(url && secretKey)
  };
}

function getHeaders(secretKey, extra = {}) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

// Normaliza el nombre del campo para Nota (saber_1..8, hacer_1..7, ser_1..6) y GradeHeader (sab_1..8, hac_1..7, ser_1..6)
function normalizeFieldPair(rawField = 'saber_1') {
  const clean = String(rawField || 'saber_1').trim().toLowerCase();
  let notaField = 'saber_1';
  let headerField = 'sab_1';

  const mSab = clean.match(/^(?:saber|sab)_?([1-8])$/);
  const mHac = clean.match(/^(?:hacer|hac)_?([1-7])$/);
  const mSer = clean.match(/^ser_?([1-6])$/);

  if (mSab) {
    notaField = `saber_${mSab[1]}`;
    headerField = `sab_${mSab[1]}`;
  } else if (mHac) {
    notaField = `hacer_${mHac[1]}`;
    headerField = `hac_${mHac[1]}`;
  } else if (mSer) {
    notaField = `ser_${mSer[1]}`;
    headerField = `ser_${mSer[1]}`;
  }

  return { notaField, headerField };
}

// Obtiene las direcciones IP locales Wi-Fi/LAN para acceso directo sin internet
function getLocalLanUrls(port = 5000) {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${port}/omr`);
      }
    }
  }
  return urls;
}

// 1. Inicializa tablas locales SQLite (OmrEvaluacion y OmrCalificacion) y pre-carga la evaluación de Decimales
async function initLocalOmrTables(prisma) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OmrEvaluacion" (
        "id" TEXT PRIMARY KEY,
        "configId" INTEGER NOT NULL,
        "trimestre" INTEGER NOT NULL DEFAULT 1,
        "campoDestino" TEXT NOT NULL DEFAULT 'saber_1',
        "titulo" TEXT NOT NULL,
        "fecha" TEXT NOT NULL DEFAULT '',
        "puntajeMaximo" REAL NOT NULL DEFAULT 45,
        "totalPreguntas" INTEGER NOT NULL DEFAULT 15,
        "clavesJson" TEXT NOT NULL DEFAULT '{}',
        "activa" INTEGER NOT NULL DEFAULT 1,
        "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OmrCalificacion" (
        "id" TEXT PRIMARY KEY,
        "evaluacionId" TEXT NOT NULL,
        "configId" INTEGER NOT NULL,
        "trimestre" INTEGER NOT NULL DEFAULT 1,
        "campoDestino" TEXT NOT NULL DEFAULT 'saber_1',
        "tituloEvaluacion" TEXT NOT NULL DEFAULT '',
        "estudianteId" TEXT NOT NULL,
        "nombreEstudiante" TEXT NOT NULL DEFAULT '',
        "numeroLista" INTEGER NOT NULL,
        "variante" TEXT NOT NULL DEFAULT 'COL1',
        "aciertos" INTEGER NOT NULL DEFAULT 0,
        "totalPreguntas" INTEGER NOT NULL DEFAULT 15,
        "puntaje" REAL NOT NULL DEFAULT 0,
        "respuestasJson" TEXT NOT NULL DEFAULT '[]',
        "origen" TEXT NOT NULL DEFAULT 'CLOUD',
        "escaneadoAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pre-sembrar la Evaluación "Operaciones con Números Decimales" en el curso 1RO Matemática (o primer curso disponible)
    const configs = await prisma.config.findMany({ orderBy: { id: 'asc' } });
    if (configs.length > 0) {
      const targetConfig = configs.find(c =>
        String(c.curso || '').toUpperCase().includes('1RO') &&
        String(c.area || '').toUpperCase().includes('MAT')
      ) || configs[0];

      const defaultEvalId = `eval_decimales_c${targetConfig.id}`;
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "OmrEvaluacion" WHERE id = ?`,
        defaultEvalId
      );

      if (!existing || existing.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        await prisma.$executeRawUnsafe(
          `INSERT INTO "OmrEvaluacion" ("id", "configId", "trimestre", "campoDestino", "titulo", "fecha", "puntajeMaximo", "totalPreguntas", "clavesJson", "activa", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
          defaultEvalId,
          targetConfig.id,
          1,
          'saber_1',
          'Operaciones con Números Decimales',
          today,
          45,
          15,
          JSON.stringify(DEFAULT_DECIMALES_KEYS)
        );
        console.log(`[OMR] Evaluación por defecto sembrada para ${targetConfig.curso} (${targetConfig.area})`);
      }
    }
  } catch (err) {
    console.error('[OMR] Error inicializando tablas locales OMR:', err.message);
  }
}

// 2. Obtiene los cursos con sus estudiantes numerados del 1..N (ordenados por apellidos ASC)
async function getLocalCoursesAndRosters(prisma) {
  const configs = await prisma.config.findMany({ orderBy: { id: 'asc' } });
  const allStudents = [];

  for (const cfg of configs) {
    const ests = await prisma.estudiante.findMany({
      where: { configId: cfg.id },
      orderBy: { apellidos: 'asc' }
    });
    ests.forEach((e, idx) => {
      allStudents.push({
        id: e.id,
        config_id: cfg.id,
        numero_lista: idx + 1,
        apellidos: e.apellidos || '',
        nombres: e.nombres || '',
        rude: e.rude || '',
        ci: e.ci || ''
      });
    });
  }

  return { configs, allStudents };
}

// 3. Aplica una calificación OMR directamente en SQLite (Nota + GradeHeader + OmrCalificacion)
async function applyScannedGradeToRegistro(prisma, syncService, record, options = { createBackup: false, origen: 'CLOUD' }) {
  const configId = parseInt(record.config_id || record.configId);
  const trimestre = parseInt(record.trimestre) || 1;
  const numeroLista = parseInt(record.numero_lista || record.numeroLista);
  const puntajeRaw = parseFloat(record.puntaje);
  const puntaje = isNaN(puntajeRaw) ? 0 : Math.max(0, Math.min(45, Math.round(puntajeRaw)));
  const aciertos = parseInt(record.aciertos) || 0;
  const totalPreguntas = parseInt(record.total_preguntas || record.totalPreguntas) || 15;
  const variante = String(record.variante || 'COL1').toUpperCase();
  const evaluacionId = String(record.evaluacion_id || record.evaluacionId || `eval_${configId}_${trimestre}`);
  const tituloEvaluacion = String(record.titulo_evaluacion || record.tituloEvaluacion || 'Evaluación OMR').trim();
  const { notaField, headerField } = normalizeFieldPair(record.campo_destino || record.campoDestino || 'saber_1');

  // Buscar la lista oficial de estudiantes del curso ordenada por apellidos ASC
  const roster = await prisma.estudiante.findMany({
    where: { configId },
    orderBy: { apellidos: 'asc' }
  });

  if (roster.length === 0) {
    throw new Error(`El curso (ID ${configId}) no tiene estudiantes registrados.`);
  }

  // Resolver estudiante por ID exacto o por N° de Lista (1..N)
  let student = null;
  let resolvedListNumber = numeroLista;

  if (record.estudiante_id || record.estudianteId) {
    const targetId = record.estudiante_id || record.estudianteId;
    const foundIdx = roster.findIndex(s => s.id === targetId);
    if (foundIdx !== -1) {
      student = roster[foundIdx];
      resolvedListNumber = foundIdx + 1;
    }
  }

  if (!student && numeroLista >= 1 && numeroLista <= roster.length) {
    student = roster[numeroLista - 1];
    resolvedListNumber = numeroLista;
  }

  if (!student) {
    throw new Error(`No existe el N° de Lista #${numeroLista} en este curso (Total inscritos: ${roster.length}).`);
  }

  if (options.createBackup && syncService && typeof syncService.createAutoBackup === 'function') {
    syncService.createAutoBackup('pre_omr_auto');
  }

  // A) Actualizar o insertar el encabezado de columna en GradeHeader (ej: sab_1 -> "Operaciones con Números Decimales")
  const todayStr = new Date().toISOString().split('T')[0];
  if (tituloEvaluacion) {
    const existingHeader = await prisma.$queryRawUnsafe(
      `SELECT id, etiqueta, fecha FROM "GradeHeader" WHERE configId = ? AND trimestre = ? AND campo = ?`,
      configId, trimestre, headerField
    );
    if (existingHeader && existingHeader.length > 0) {
      const currentEtiqueta = existingHeader[0].etiqueta || '';
      const currentFecha = existingHeader[0].fecha || todayStr;
      if (!currentEtiqueta) {
        await prisma.$executeRawUnsafe(
          `UPDATE "GradeHeader" SET etiqueta = ?, fecha = ? WHERE id = ?`,
          tituloEvaluacion, currentFecha, existingHeader[0].id
        );
      }
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GradeHeader" (configId, trimestre, campo, etiqueta, fecha) VALUES (?, ?, ?, ?, ?)`,
        configId, trimestre, headerField, tituloEvaluacion, todayStr
      );
    }
  }

  // B) En Grades.jsx / StudentRow.jsx: el puntaje 0 explícito se guarda como 0.001 para diferenciarlo de casilla vacía (0)
  const dbScoreValue = puntaje === 0 ? 0.001 : puntaje;

  const existingNota = await prisma.nota.findFirst({
    where: { estudianteId: student.id, trimestre }
  });

  // Función idéntica a Grades.jsx para recalcular promedios y notaTrimestre
  const computeNotaTrimestre = (notaObj) => {
    const getAvg = (prefix, count) => {
      let sum = 0;
      let filled = 0;
      for (let i = 1; i <= count; i++) {
        const val = parseFloat(notaObj[`${prefix}_${i}`]);
        if (!isNaN(val) && val > 0) {
          sum += val === 0.001 ? 0 : val;
          filled++;
        }
      }
      return filled === 0 ? 0 : Math.round(sum / filled);
    };

    const promSer = getAvg('ser', 6);
    const promSab = getAvg('saber', 8);
    const promHac = getAvg('hacer', 7);
    const autoSer = parseFloat(notaObj.auto_ser) || 0;
    const notasExtras = parseFloat(notaObj.notas_extras) || 0;
    return Math.min(100, Math.round(promSer + promSab + promHac + autoSer + notasExtras));
  };

  let savedNota;
  if (existingNota) {
    const merged = {
      ...existingNota,
      [notaField]: dbScoreValue
    };
    const newNotaTrimestre = computeNotaTrimestre(merged);

    savedNota = await prisma.nota.update({
      where: { id: existingNota.id },
      data: {
        [notaField]: dbScoreValue,
        notaTrimestre: newNotaTrimestre
      }
    });
  } else {
    const baseData = {
      estudianteId: student.id,
      trimestre,
      ser_1: 0, ser_2: 0, ser_3: 0, ser_4: 0, ser_5: 0, ser_6: 0,
      saber_1: 0, saber_2: 0, saber_3: 0, saber_4: 0,
      saber_5: 0, saber_6: 0, saber_7: 0, saber_8: 0,
      hacer_1: 0, hacer_2: 0, hacer_3: 0, hacer_4: 0,
      hacer_5: 0, hacer_6: 0, hacer_7: 0,
      auto_ser: 0, auto_decidir: 0, notas_extras: 0,
      rezagados: '{}'
    };
    baseData[notaField] = dbScoreValue;
    baseData.notaTrimestre = computeNotaTrimestre(baseData);

    savedNota = await prisma.nota.create({ data: baseData });
  }

  // C) Guardar en el historial local OmrCalificacion
  const califId = String(record.id || `${evaluacionId}_${student.id}`);
  const nombreCompleto = `${student.apellidos} ${student.nombres}`.trim();
  const respuestasStr = typeof record.respuestas_json === 'string'
    ? record.respuestas_json
    : JSON.stringify(record.respuestas_json || record.respuestasJson || []);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "OmrCalificacion" WHERE "evaluacionId" = ? AND "estudianteId" = ?`,
    evaluacionId, student.id
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "OmrCalificacion" (
      "id", "evaluacionId", "configId", "trimestre", "campoDestino", "tituloEvaluacion",
      "estudianteId", "nombreEstudiante", "numeroLista", "variante", "aciertos",
      "totalPreguntas", "puntaje", "respuestasJson", "origen", "escaneadoAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    califId, evaluacionId, configId, trimestre, notaField, tituloEvaluacion,
    student.id, nombreCompleto, resolvedListNumber, variante, aciertos,
    totalPreguntas, puntaje, respuestasStr, options.origen || 'CLOUD'
  );

  const summaryItem = {
    id: califId,
    configId,
    trimestre,
    campoDestino: notaField,
    headerField,
    tituloEvaluacion,
    estudianteId: student.id,
    numeroLista: resolvedListNumber,
    apellidos: student.apellidos,
    nombres: student.nombres,
    nombreCompleto,
    variante,
    aciertos,
    totalPreguntas,
    puntaje,
    notaTrimestre: savedNota.notaTrimestre,
    origen: options.origen || 'CLOUD',
    appliedAt: new Date().toISOString()
  };

  omrState.totalAppliedSinceStart += 1;
  omrState.recentApplied.unshift(summaryItem);
  if (omrState.recentApplied.length > 25) {
    omrState.recentApplied = omrState.recentApplied.slice(0, 25);
  }

  return summaryItem;
}

// 4. Sube Cursos, Nóminas (N° de Lista 1..N) y Evaluaciones Locales hacia Supabase Cloud
async function pushRosterAndEvaluationsToSupabase(prisma) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return { ok: false, reason: 'Supabase no configurado' };

  try {
    const { configs, allStudents } = await getLocalCoursesAndRosters(prisma);
    if (configs.length === 0) return { ok: true, courses: 0, students: 0 };

    // A) Upsert omr_cursos
    const cursosPayload = configs.map(c => ({
      config_id: c.id,
      curso: c.curso || '',
      area: c.area || '',
      maestro: c.maestro || '',
      unidad_educativa: c.unidadEducativa || '',
      gestion: String(c.gestion || '2026'),
      pin_acceso: cfg.pin,
      updated_at: new Date().toISOString()
    }));

    const resCursos = await fetch(`${cfg.url}/rest/v1/omr_cursos?on_conflict=config_id`, {
      method: 'POST',
      headers: getHeaders(cfg.secretKey, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(cursosPayload),
      signal: AbortSignal.timeout(15000)
    });

    if (!resCursos.ok) {
      const errTxt = await resCursos.text();
      if (errTxt.includes('omr_cursos') || resCursos.status === 404) {
        omrState.schemaReady = false;
        omrState.schemaError = 'Las tablas OMR aún no existen en Supabase. Ejecuta el script supabase/omr_schema.sql en el SQL Editor de Supabase.';
      }
      throw new Error(`HTTP ${resCursos.status}: ${errTxt}`);
    }

    omrState.schemaReady = true;
    omrState.schemaError = null;

    // B) Upsert omr_estudiantes
    if (allStudents.length > 0) {
      const estPayload = allStudents.map(s => ({
        ...s,
        updated_at: new Date().toISOString()
      }));
      const resEst = await fetch(`${cfg.url}/rest/v1/omr_estudiantes?on_conflict=id`, {
        method: 'POST',
        headers: getHeaders(cfg.secretKey, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(estPayload),
        signal: AbortSignal.timeout(20000)
      });
      if (!resEst.ok) {
        const errTxt = await resEst.text();
        console.warn('[OMR Sync] Advertencia subiendo estudiantes:', errTxt);
      }
    }

    // C) Upsert omr_evaluaciones desde la tabla local OmrEvaluacion
    const localEvals = await prisma.$queryRawUnsafe(`SELECT * FROM "OmrEvaluacion" WHERE "activa" = 1`);
    if (Array.isArray(localEvals) && localEvals.length > 0) {
      const evalsPayload = localEvals.map(ev => {
        let parsedClaves = {};
        try {
          parsedClaves = JSON.parse(ev.clavesJson || '{}');
        } catch {
          parsedClaves = DEFAULT_DECIMALES_KEYS;
        }
        return {
          id: ev.id,
          config_id: Number(ev.configId),
          trimestre: Number(ev.trimestre) || 1,
          campo_destino: ev.campoDestino || 'saber_1',
          titulo: ev.titulo || 'Evaluación OMR',
          fecha: ev.fecha || new Date().toISOString().split('T')[0],
          puntaje_maximo: Number(ev.puntajeMaximo) || 45,
          total_preguntas: Number(ev.totalPreguntas) || 15,
          claves_json: parsedClaves,
          activa: true,
          updated_at: new Date().toISOString()
        };
      });

      await fetch(`${cfg.url}/rest/v1/omr_evaluaciones?on_conflict=id`, {
        method: 'POST',
        headers: getHeaders(cfg.secretKey, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(evalsPayload),
        signal: AbortSignal.timeout(15000)
      });
    }

    // D) Descargar evaluaciones creadas desde el celular en Supabase hacia SQLite local
    const resRemoteEvals = await fetch(`${cfg.url}/rest/v1/omr_evaluaciones?activa=eq.true&select=*`, {
      headers: getHeaders(cfg.secretKey),
      signal: AbortSignal.timeout(12000)
    });
    if (resRemoteEvals.ok) {
      const remoteEvals = await resRemoteEvals.json();
      for (const rev of remoteEvals) {
        const clavesStr = typeof rev.claves_json === 'string' ? rev.claves_json : JSON.stringify(rev.claves_json || {});
        await prisma.$executeRawUnsafe(
          `INSERT INTO "OmrEvaluacion" ("id", "configId", "trimestre", "campoDestino", "titulo", "fecha", "puntajeMaximo", "totalPreguntas", "clavesJson", "activa", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
           ON CONFLICT("id") DO UPDATE SET
             "configId" = excluded."configId",
             "trimestre" = excluded."trimestre",
             "campoDestino" = excluded."campoDestino",
             "titulo" = excluded."titulo",
             "fecha" = excluded."fecha",
             "puntajeMaximo" = excluded."puntajeMaximo",
             "totalPreguntas" = excluded."totalPreguntas",
             "clavesJson" = excluded."clavesJson",
             "updatedAt" = CURRENT_TIMESTAMP`,
          rev.id,
          Number(rev.config_id),
          Number(rev.trimestre) || 1,
          rev.campo_destino || 'saber_1',
          rev.titulo || 'Evaluación OMR',
          rev.fecha || '',
          Number(rev.puntaje_maximo) || 45,
          Number(rev.total_preguntas) || 15,
          clavesStr
        );
      }
    }

    omrState.lastRosterPushAt = new Date().toISOString();
    omrState.lastError = null;
    return {
      ok: true,
      courses: configs.length,
      students: allStudents.length
    };
  } catch (err) {
    omrState.lastError = err.message;
    return { ok: false, error: err.message };
  }
}

// 5. Descarga calificaciones pendientes (sincronizado_pc = false) desde Supabase y las escribe automáticamente en el Registro
async function pullPendingGradesFromSupabase(prisma, syncService) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return { ok: false, applied: 0, reason: 'Supabase no configurado' };
  if (omrState.isSyncing) return { ok: true, applied: 0, skipped: true };

  omrState.isSyncing = true;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/omr_calificaciones?sincronizado_pc=eq.false&order=escaneado_at.asc&limit=100`,
      {
        headers: getHeaders(cfg.secretKey),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!res.ok) {
      const errTxt = await res.text();
      if (errTxt.includes('omr_calificaciones') || res.status === 404) {
        omrState.schemaReady = false;
        omrState.schemaError = 'Las tablas OMR aún no existen en Supabase. Ejecuta el script supabase/omr_schema.sql en el SQL Editor de Supabase.';
      }
      throw new Error(`HTTP ${res.status}: ${errTxt}`);
    }

    omrState.schemaReady = true;
    omrState.schemaError = null;
    omrState.lastGradePullAt = new Date().toISOString();

    const pendingRows = await res.json();
    if (!Array.isArray(pendingRows) || pendingRows.length === 0) {
      return { ok: true, applied: 0, items: [] };
    }

    // Crear un único respaldo preventivo de dev.db antes de aplicar el lote de calificaciones
    if (syncService && typeof syncService.createAutoBackup === 'function') {
      syncService.createAutoBackup('pre_omr_auto');
    }

    const appliedItems = [];
    const syncedIds = [];

    for (const row of pendingRows) {
      try {
        const applied = await applyScannedGradeToRegistro(prisma, null, row, {
          createBackup: false,
          origen: 'SUPABASE_CLOUD'
        });
        appliedItems.push(applied);
        syncedIds.push(row.id);
      } catch (applyErr) {
        console.error(`[OMR Pull] Error aplicando nota ID ${row.id}:`, applyErr.message);
      }
    }

    // Marcar como sincronizado_pc = true en Supabase
    if (syncedIds.length > 0) {
      const idList = syncedIds.map(id => `"${id}"`).join(',');
      await fetch(`${cfg.url}/rest/v1/omr_calificaciones?id=in.(${idList})`, {
        method: 'PATCH',
        headers: getHeaders(cfg.secretKey, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ sincronizado_pc: true }),
        signal: AbortSignal.timeout(15000)
      });
      console.log(`[OMR AutoSync] ✅ ${syncedIds.length} calificaciones aplicadas automáticamente al Registro Pedagógico.`);
    }

    omrState.lastError = null;
    return {
      ok: true,
      applied: appliedItems.length,
      items: appliedItems
    };
  } catch (err) {
    omrState.lastError = err.message;
    return { ok: false, applied: 0, error: err.message };
  } finally {
    omrState.isSyncing = false;
  }
}

// 6. Inicia el demonio automático en segundo plano al arrancar el servidor del Registro Pedagógico
function startOmrSyncDaemon(prisma, syncService) {
  const cfg = getSupabaseConfig();
  omrState.enabled = cfg.configured;

  initLocalOmrTables(prisma).then(async () => {
    if (!cfg.configured) {
      console.log('[OMR Daemon] Modo Local Activo (sin variables SUPABASE en .env).');
      return;
    }

    console.log('[OMR Daemon] Iniciando sincronización automática con Supabase Cloud...');
    await pushRosterAndEvaluationsToSupabase(prisma);
    await pullPendingGradesFromSupabase(prisma, syncService);

    // Polling automático cada 12 segundos para descargar calificaciones escaneadas desde el celular
    setInterval(() => {
      pullPendingGradesFromSupabase(prisma, syncService).catch(() => {});
    }, 12000);

    // Refresco periódico de nómina cada 3 minutos
    setInterval(() => {
      pushRosterAndEvaluationsToSupabase(prisma).catch(() => {});
    }, 180000);
  });
}

module.exports = {
  DEFAULT_DECIMALES_KEYS,
  omrState,
  getSupabaseConfig,
  normalizeFieldPair,
  getLocalLanUrls,
  initLocalOmrTables,
  getLocalCoursesAndRosters,
  applyScannedGradeToRegistro,
  pushRosterAndEvaluationsToSupabase,
  pullPendingGradesFromSupabase,
  startOmrSyncDaemon
};
