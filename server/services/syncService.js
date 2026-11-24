const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db');
const SYNC_META_PATH = path.join(__dirname, '..', 'prisma', 'sync_meta.json');
const BACKUPS_DIR = path.join(__dirname, '..', 'prisma', 'backups_auto');
const MASTER_BACKUPS_DIR = path.join(__dirname, '..', '..', 'BACKUPS_SEGURIDAD');

// Asegurar que existan las carpetas de respaldos automáticos y maestros
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(MASTER_BACKUPS_DIR)) {
  fs.mkdirSync(MASTER_BACKUPS_DIR, { recursive: true });
}

const GRADE_FIELDS = [
  'ser_1', 'ser_2', 'ser_3', 'ser_4', 'ser_5', 'ser_6',
  'saber_1', 'saber_2', 'saber_3', 'saber_4', 'saber_5', 'saber_6', 'saber_7', 'saber_8',
  'hacer_1', 'hacer_2', 'hacer_3', 'hacer_4', 'hacer_5', 'hacer_6', 'hacer_7',
  'auto_ser', 'auto_decidir', 'notas_extras'
];

function computeFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Garantiza que exista al menos 1 Copia Maestra Diaria en BACKUPS_SEGURIDAD
 */
function ensureDailyMasterBackup(forceLabel = null) {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = forceLabel
      ? `RESPALDO_${forceLabel}_${today}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.db`
      : `RESPALDO_DIARIO_${today}.db`;
    const destPath = path.join(MASTER_BACKUPS_DIR, fileName);

    const srcHash = computeFileHash(DB_PATH);
    if (fs.existsSync(destPath)) {
      const destHash = computeFileHash(destPath);
      if (srcHash && srcHash === destHash) {
        return destPath;
      }
    }

    fs.copyFileSync(DB_PATH, destPath);
    console.log(`[SyncService] Copia maestra resguardada en BACKUPS_SEGURIDAD: ${fileName}`);
    return destPath;
  } catch (err) {
    console.warn('[SyncService] No se pudo crear copia maestra diaria:', err.message);
    return null;
  }
}

/**
 * Crea una copia de seguridad automática e inmutable del archivo dev.db
 * Evita duplicar archivos idénticos para no purgar historial valioso.
 * @param {string} prefix - Etiqueta descriptiva (ej: 'pre_sync', 'manual', 'startup')
 * @returns {string|null} Ruta del archivo de respaldo creado
 */
function createAutoBackup(prefix = 'auto') {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn('[SyncService] dev.db no existe aún para respaldar.');
      return null;
    }

    // Siempre asegurar la copia maestra diaria en BACKUPS_SEGURIDAD
    const isCritical = prefix.includes('restore') || prefix.includes('sync') || prefix.includes('manual');
    ensureDailyMasterBackup(isCritical ? prefix.toUpperCase() : null);

    // Verificar si el último respaldo en backups_auto es exactamente idéntico
    const currentHash = computeFileHash(DB_PATH);
    const existingFiles = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db') && !f.startsWith('temp_'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        return { name: f, path: fullPath, time: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (!isCritical && existingFiles.length > 0 && currentHash) {
      const latestHash = computeFileHash(existingFiles[0].path);
      if (latestHash === currentHash) {
        console.log(`[SyncService] Respaldo omitido (${prefix}): sin cambios respecto a ${existingFiles[0].name}`);
        return existingFiles[0].path;
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `dev_${prefix}_${timestamp}.db`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[SyncService] Respaldo automático creado: ${backupName}`);

    // Mantener un historial seguro de hasta 40 respaldos únicos
    pruneOldBackups(40);

    return backupPath;
  } catch (error) {
    console.error('[SyncService] Error al crear respaldo automático:', error);
    return null;
  }
}

/**
 * Limpia respaldos antiguos conservando los N más recientes
 */
function pruneOldBackups(keepCount = 40) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db') && !f.startsWith('temp_'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        return { name: f, path: fullPath, time: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[SyncService] Respaldo antiguo purgado: ${file.name}`);
      }
    }
  } catch (err) {
    console.warn('[SyncService] Error al purgar respaldos antiguos:', err.message);
  }
}

/**
 * Repara automáticamente cualquier índice B-Tree o fila huérfana corrupta en SQLite
 */
async function sanitizeAndRepairDb(prisma) {
  try {
    const ic = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
    const firstMsg = ic?.[0]?.integrity_check || 'ok';
    if (firstMsg === 'ok') {
      return { repaired: false, healthy: true };
    }

    console.warn('[SyncService] Detectada inconsistencia en índices SQLite, reparando automáticamente...', ic);
    const validFichas = await prisma.fichaSeguimiento.findMany({
      where: {
        NOT: [
          { id: { startsWith: 'eval_' } }
        ]
      }
    });

    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "FichaSeguimiento"');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "FichaSeguimiento" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "estudianteId" TEXT NOT NULL,
        "configId" INTEGER NOT NULL,
        "trimestre" INTEGER NOT NULL,
        "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "hora" TEXT NOT NULL DEFAULT '',
        "anotacionesClave" TEXT NOT NULL DEFAULT '',
        "redaccionDetallada" TEXT NOT NULL DEFAULT '',
        "categoria" TEXT NOT NULL DEFAULT 'Aprovechamiento/Conducta',
        "inasistenciasAcum" INTEGER NOT NULL DEFAULT 0,
        "atrasosAcum" INTEGER NOT NULL DEFAULT 0,
        "licenciasAcum" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "origenLunesRef" TEXT DEFAULT '',
        CONSTRAINT "FichaSeguimiento_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FichaSeguimiento_configId_fkey" FOREIGN KEY ("configId") REFERENCES "Config" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    for (const f of validFichas) {
      await prisma.fichaSeguimiento.create({ data: f });
    }

    await prisma.$executeRawUnsafe('REINDEX');
    await prisma.$executeRawUnsafe('VACUUM');
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');

    console.log(`[SyncService] Base de datos reparada con éxito (${validFichas.length} fichas preservadas).`);
    return { repaired: true, healthy: true };
  } catch (err) {
    console.warn('[SyncService] Advertencia en sanitizeAndRepairDb:', err.message);
    return { repaired: false, healthy: false, error: err.message };
  }
}

/**
 * Obtiene métricas y estadísticas detalladas del estado actual de los datos,
 * incluyendo suma real de puntos calificados para detectar modificaciones en notas existentes.
 */
async function getStats(prisma) {
  try {
    const [
      configs,
      estudiantes,
      notasList,
      gradeHeaders,
      asistencias,
      fechasAsistencia,
      fichasSeguimiento,
      repositorioArchivos,
      centralizadorGeneral,
      avanceCurricular,
      agendaNotas,
      planesProgramas
    ] = await Promise.all([
      prisma.config.count(),
      prisma.estudiante.count(),
      prisma.nota.findMany({
        select: {
          notaTrimestre: true,
          ser_1: true, ser_2: true, ser_3: true, ser_4: true, ser_5: true, ser_6: true,
          saber_1: true, saber_2: true, saber_3: true, saber_4: true, saber_5: true, saber_6: true, saber_7: true, saber_8: true,
          hacer_1: true, hacer_2: true, hacer_3: true, hacer_4: true, hacer_5: true, hacer_6: true, hacer_7: true,
          auto_ser: true, auto_decidir: true, notas_extras: true
        }
      }),
      prisma.gradeHeader.count(),
      prisma.asistencia.count(),
      prisma.fechaAsistencia.count(),
      prisma.fichaSeguimiento.count({ where: { id: { not: 'eval_decimales_c1' } } }).catch(() => prisma.fichaSeguimiento.count()),
      prisma.repositorioArchivo.count(),
      prisma.centralizadorGeneral.count(),
      prisma.avanceCurricular.count(),
      prisma.agendaNota.count(),
      prisma.planPrograma.count()
    ]);

    let notasConPuntaje = 0;
    let casillasCalificadas = 0;
    let sumaPuntosNotas = 0;

    for (const n of notasList) {
      let rowHasGrade = (n.notaTrimestre || 0) > 0;
      for (const field of GRADE_FIELDS) {
        const val = Number(n[field] || 0);
        if (val > 0) {
          rowHasGrade = true;
          casillasCalificadas++;
          sumaPuntosNotas += val;
        }
      }
      if (rowHasGrade) notasConPuntaje++;
    }

    let dbSize = 0;
    let lastModified = null;
    if (fs.existsSync(DB_PATH)) {
      const stat = fs.statSync(DB_PATH);
      dbSize = stat.size;
      lastModified = stat.mtime;
    }

    const backupFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db') && !f.startsWith('temp_'));
    const masterFiles = fs.existsSync(MASTER_BACKUPS_DIR)
      ? fs.readdirSync(MASTER_BACKUPS_DIR).filter(f => f.endsWith('.db'))
      : [];

    return {
      success: true,
      counts: {
        configs,
        estudiantes,
        notas: notasList.length,
        notasConPuntaje,
        casillasCalificadas,
        sumaPuntosNotas: Math.round(sumaPuntosNotas * 100) / 100,
        gradeHeaders,
        asistencias,
        fechasAsistencia,
        fichasSeguimiento,
        repositorioArchivos,
        centralizadorGeneral,
        avanceCurricular,
        agendaNotas,
        planesProgramas
      },
      db: {
        sizeBytes: dbSize,
        sizeMB: (dbSize / (1024 * 1024)).toFixed(2),
        lastModified
      },
      backups: {
        totalBackups: backupFiles.length,
        totalMasterBackups: masterFiles.length,
        latestBackup: backupFiles.length > 0 ? backupFiles.sort().reverse()[0] : null
      }
    };
  } catch (error) {
    console.error('[SyncService] Error obteniendo estadísticas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Lista los respaldos locales disponibles en BACKUPS_SEGURIDAD y backups_auto
 */
function listLocalBackups() {
  const results = [];

  const readFolder = (dirPath, category) => {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.db') && !f.startsWith('temp_'));
    for (const f of files) {
      try {
        const fullPath = path.join(dirPath, f);
        const stat = fs.statSync(fullPath);
        results.push({
          id: `${category}:${f}`,
          fileName: f,
          category, // 'MASTER' | 'AUTO'
          sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          timestampMs: stat.mtimeMs
        });
      } catch (e) {
        // ignore unreadable file
      }
    }
  };

  readFolder(MASTER_BACKUPS_DIR, 'MASTER');
  readFolder(BACKUPS_DIR, 'AUTO');

  return results.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 35);
}

/**
 * Valida archivo SQLite (primeros 16 bytes "SQLite format 3\0")
 */
function validateSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('El archivo de respaldo especificado no existe.');
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 4096) {
    throw new Error('El archivo de respaldo está vacío o incompleto.');
  }
  const buffer = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('El archivo proporcionado no es una base de datos SQLite válida.');
  }
  return true;
}

/**
 * Valida y restaura la base de datos desde un archivo SQLite subido o local,
 * desconectando Prisma limpiamente para evitar bloqueos o corrupción en Windows.
 */
async function restoreFromUploadedDbAsync(uploadedFilePath, prisma = null) {
  validateSqliteFile(uploadedFilePath);

  // 1. Crear respaldo preventivo del estado actual en backups_auto y BACKUPS_SEGURIDAD
  createAutoBackup('pre_restore');

  // 2. Desconectar Prisma antes de reemplazar el archivo físico en Windows
  if (prisma && typeof prisma.$disconnect === 'function') {
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.warn('[SyncService] Advertencia al desconectar Prisma:', e.message);
    }
  }

  // 3. Limpiar archivos temporales WAL/SHM si existieran para evitar corrupción cruzada
  for (const ext of ['-wal', '-shm', '-journal']) {
    const walPath = `${DB_PATH}${ext}`;
    if (fs.existsSync(walPath)) {
      try { fs.unlinkSync(walPath); } catch (e) {}
    }
  }

  // 4. Sobrescribir con el archivo validado
  fs.copyFileSync(uploadedFilePath, DB_PATH);

  // 5. Reconectar Prisma y verificar integridad
  if (prisma && typeof prisma.$connect === 'function') {
    await prisma.$connect();
    await sanitizeAndRepairDb(prisma);
  }

  console.log('[SyncService] Base de datos restaurada con éxito y reconectada.');
  return true;
}

/**
 * Compatibilidad síncrona para llamadas heredadas
 */
function restoreFromUploadedDb(uploadedFilePath) {
  validateSqliteFile(uploadedFilePath);
  createAutoBackup('pre_restore');
  fs.copyFileSync(uploadedFilePath, DB_PATH);
  console.log('[SyncService] Base de datos restaurada con éxito.');
  return true;
}

/**
 * Restaura un respaldo local existente por su identificador ('MASTER:nombre.db' o 'AUTO:nombre.db')
 */
async function restoreLocalBackupById(backupId, prisma) {
  if (!backupId || !backupId.includes(':')) {
    throw new Error('Identificador de respaldo inválido.');
  }
  const [category, rawName] = backupId.split(':');
  const safeName = path.basename(rawName);
  const baseDir = category === 'MASTER' ? MASTER_BACKUPS_DIR : BACKUPS_DIR;
  const targetPath = path.join(baseDir, safeName);

  await restoreFromUploadedDbAsync(targetPath, prisma);
  return targetPath;
}

/**
 * Carga y guarda metadatos de marcas de tiempo por celda/registro para garantizar
 * la regla "Última Modificación Gana" entre Celular y PC.
 */
function loadSyncMeta() {
  try {
    if (fs.existsSync(SYNC_META_PATH)) {
      const raw = fs.readFileSync(SYNC_META_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        version: '3.0',
        initialized: Boolean(parsed.initialized),
        lastMutationAtMs: Number(parsed.lastMutationAtMs || 0),
        lastSyncedCloudUpdatedAt: parsed.lastSyncedCloudUpdatedAt || null,
        fieldTimestamps: parsed.fieldTimestamps || {},
        lastKnownValues: parsed.lastKnownValues || {},
        recordTimestamps: parsed.recordTimestamps || {},
        lastKnownRecordHashes: parsed.lastKnownRecordHashes || {},
        deletedRecords: parsed.deletedRecords || {}
      };
    }
  } catch (e) {
    console.warn('[SyncService] Reiniciando sync_meta.json:', e.message);
  }
  return {
    version: '3.0',
    initialized: false,
    lastMutationAtMs: 0,
    lastSyncedCloudUpdatedAt: null,
    fieldTimestamps: {},
    lastKnownValues: {},
    recordTimestamps: {},
    lastKnownRecordHashes: {},
    deletedRecords: {}
  };
}

function saveSyncMeta(meta) {
  try {
    fs.writeFileSync(SYNC_META_PATH, JSON.stringify(meta), 'utf8');
  } catch (e) {
    console.warn('[SyncService] No se pudo guardar sync_meta.json:', e.message);
  }
}

function markLocalMutation(reason = 'api_mutation') {
  const meta = loadSyncMeta();
  meta.lastMutationAtMs = Date.now();
  meta.lastMutationReason = reason;
  saveSyncMeta(meta);
  return meta.lastMutationAtMs;
}

function getAsistenciaCanonicalKey(a) {
  const d = a.fecha ? new Date(a.fecha) : new Date(0);
  const datePart = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(a.id || '');
  return `Asistencia:${a.estudianteId}_${a.trimestre}_${datePart}_${a.tipo || 'NORMAL'}`;
}

function buildRecordMapFromData(data) {
  const map = new Map();
  for (const c of (data.configs || [])) {
    map.set(`Config:${c.id}`, JSON.stringify([c.distrito, c.unidadEducativa, c.nivel, c.maestro, c.area, c.gestion, c.curso, c.orientacion]));
  }
  for (const e of (data.estudiantes || [])) {
    map.set(`Estudiante:${e.id}`, JSON.stringify([e.configId, e.rude, e.ci, e.apellidos, e.nombres, e.fechaNacimiento, e.edad, e.direccion, e.genero, e.padreMadre, e.telefono]));
  }
  for (const gh of (data.gradeHeaders || [])) {
    map.set(`GradeHeader:${gh.configId}_${gh.trimestre}_${gh.campo}`, JSON.stringify([gh.etiqueta || '', gh.fecha || '', Number(gh.sellosMax || 0), gh.rawSellos || '{}']));
  }
  for (const fa of (data.fechasAsistencia || [])) {
    map.set(`FechaAsistencia:${fa.configId}_${fa.trimestre}_${fa.month}_${fa.year}_${fa.dia}_${fa.tipo || 'NORMAL'}`, String(fa.etiqueta || ''));
  }
  for (const a of (data.asistencias || [])) {
    map.set(getAsistenciaCanonicalKey(a), String(a.estado || ''));
  }
  for (const fsItem of (data.fichasSeguimiento || [])) {
    map.set(`Ficha:${fsItem.id}`, JSON.stringify([fsItem.anotacionesClave, fsItem.redaccionDetallada, fsItem.categoria, fsItem.hora, fsItem.inasistenciasAcum, fsItem.atrasosAcum, fsItem.licenciasAcum]));
  }
  for (const cg of (data.centralizadorGeneral || [])) {
    map.set(`Centralizador:${cg.configId}_${cg.trimestre}_${cg.estudiante}_${cg.materia}`, JSON.stringify([Number(cg.nota || 0), Number(cg.promedio || 0)]));
  }
  for (const ac of (data.avanceCurricular || [])) {
    map.set(`Avance:${ac.id}`, JSON.stringify([ac.area, ac.curso, ac.t1_tp, ac.t1_td, ac.t2_tp, ac.t2_td, ac.t3_tp, ac.t3_td]));
  }
  for (const an of (data.agendaNotas || [])) {
    map.set(`Agenda:${an.id}`, JSON.stringify([an.subject, an.weekStr, an.text]));
  }
  for (const pp of (data.planesProgramas || [])) {
    map.set(`Plan:${pp.configId}`, JSON.stringify([pp.contenido, pp.fuente]));
  }
  return map;
}

/**
 * Detecta cualquier cambio realizado en SQLite local (incluso si una nota bajó o se puso en 0,
 * o si se eliminó una asistencia/encabezado/ficha) y registra su timestamp exacto.
 */
function captureLocalDiffsIntoMeta(data, nowMs = Date.now(), isPostMergeBaseline = false) {
  const meta = loadSyncMeta();
  const isFirstInit = !meta.initialized;
  let detectedChanges = 0;

  // 1. Verificar celdas de Notas
  const currentCellKeys = new Set();
  for (const n of (data.notas || [])) {
    const baseKey = `${n.estudianteId}_${n.trimestre}`;
    for (const field of [...GRADE_FIELDS, 'notaTrimestre', 'rezagados']) {
      const cellKey = `${baseKey}_${field}`;
      currentCellKeys.add(cellKey);
      const val = field === 'rezagados' ? String(n.rezagados || '{}') : Number(n[field] || 0);
      const prevVal = meta.lastKnownValues[cellKey];

      if (isPostMergeBaseline || isFirstInit) {
        meta.lastKnownValues[cellKey] = val;
      } else if (prevVal === undefined) {
        meta.lastKnownValues[cellKey] = val;
        if (val !== 0 && val !== '{}') {
          meta.fieldTimestamps[cellKey] = nowMs;
          detectedChanges++;
        }
      } else if (prevVal !== val) {
        meta.lastKnownValues[cellKey] = val;
        meta.fieldTimestamps[cellKey] = nowMs;
        detectedChanges++;
      }
    }
  }

  // 2. Verificar registros de las demás tablas (creación, edición y eliminación)
  const currentRecordMap = buildRecordMapFromData(data);
  for (const [recKey, sig] of currentRecordMap.entries()) {
    const prevSig = meta.lastKnownRecordHashes[recKey];
    if (isPostMergeBaseline || isFirstInit) {
      meta.lastKnownRecordHashes[recKey] = sig;
    } else if (prevSig === undefined) {
      meta.lastKnownRecordHashes[recKey] = sig;
      meta.recordTimestamps[recKey] = nowMs;
      delete meta.deletedRecords[recKey];
      detectedChanges++;
    } else if (prevSig !== sig) {
      meta.lastKnownRecordHashes[recKey] = sig;
      meta.recordTimestamps[recKey] = nowMs;
      delete meta.deletedRecords[recKey];
      detectedChanges++;
    }
  }

  // Detectar registros eliminados localmente
  if (!isFirstInit && !isPostMergeBaseline) {
    for (const oldKey of Object.keys(meta.lastKnownRecordHashes)) {
      if (!currentRecordMap.has(oldKey)) {
        delete meta.lastKnownRecordHashes[oldKey];
        meta.deletedRecords[oldKey] = nowMs;
        meta.recordTimestamps[oldKey] = nowMs;
        detectedChanges++;
      }
    }
  } else if (isPostMergeBaseline) {
    for (const oldKey of Object.keys(meta.lastKnownRecordHashes)) {
      if (!currentRecordMap.has(oldKey)) {
        delete meta.lastKnownRecordHashes[oldKey];
      }
    }
  }

  if (detectedChanges > 0) {
    meta.lastMutationAtMs = Math.max(meta.lastMutationAtMs || 0, nowMs);
  }
  meta.initialized = true;
  saveSyncMeta(meta);
  return meta;
}

/**
 * Recalcula exactamente la nota trimestral (SER 10 + SABER 45 + HACER 40 + AUTO 5 + EXTRAS)
 */
function recomputeNotaTrimestre(nota) {
  const avg = (fields) => {
    const vals = fields.map(f => Number(nota[f] || 0)).filter(v => v > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  const promSer = avg(['ser_1', 'ser_2', 'ser_3', 'ser_4', 'ser_5', 'ser_6']);
  const promSab = avg(['saber_1', 'saber_2', 'saber_3', 'saber_4', 'saber_5', 'saber_6', 'saber_7', 'saber_8']);
  const promHac = avg(['hacer_1', 'hacer_2', 'hacer_3', 'hacer_4', 'hacer_5', 'hacer_6', 'hacer_7']);
  const autoSer = Number(nota.auto_ser || 0);
  const autoDec = Number(nota.auto_decidir || 0);
  const notasExtras = Number(nota.notas_extras || 0);
  const hasAnyCell = (promSer + promSab + promHac + autoSer + autoDec + notasExtras) > 0;
  if (!hasAnyCell) return 0;
  return Math.min(100, Math.round(promSer + promSab + promHac + autoSer + autoDec + notasExtras));
}

/**
 * Exporta las 12 tablas completas del Registro Pedagógico en formato JSON estructurado
 * junto con las marcas de tiempo de última modificación (syncMeta).
 */
async function exportFullJson(prisma) {
  await sanitizeAndRepairDb(prisma);

  const [
    configs,
    estudiantes,
    fechasAsistencia,
    asistencias,
    gradeHeaders,
    notas,
    fichasSeguimiento,
    repositorioArchivos,
    centralizadorGeneral,
    avanceCurricular,
    agendaNotas,
    planesProgramas
  ] = await Promise.all([
    prisma.config.findMany(),
    prisma.estudiante.findMany(),
    prisma.fechaAsistencia.findMany(),
    prisma.asistencia.findMany(),
    prisma.gradeHeader.findMany(),
    prisma.nota.findMany(),
    prisma.fichaSeguimiento.findMany({
      where: { id: { not: 'eval_decimales_c1' } }
    }).catch(() => []),
    prisma.repositorioArchivo.findMany(),
    prisma.centralizadorGeneral.findMany(),
    prisma.avanceCurricular.findMany(),
    prisma.agendaNota.findMany(),
    prisma.planPrograma.findMany()
  ]);

  let agendaHorarioConfig = [];
  try {
    agendaHorarioConfig = await prisma.$queryRawUnsafe('SELECT * FROM "AgendaHorarioConfig"');
  } catch (e) {
    // tabla opcional
  }

  const dataObj = {
    configs,
    estudiantes,
    fechasAsistencia,
    asistencias,
    gradeHeaders,
    notas,
    fichasSeguimiento,
    repositorioArchivos,
    centralizadorGeneral,
    avanceCurricular,
    agendaNotas,
    planesProgramas,
    agendaHorarioConfig
  };

  const nowMs = Date.now();
  const meta = captureLocalDiffsIntoMeta(dataObj, nowMs, false);

  return {
    version: '3.0',
    exportedAt: new Date(nowMs).toISOString(),
    system: 'Registro Pedagogico - Permanente en Supabase (Ultima Modificacion Gana)',
    syncMeta: {
      updatedAtMs: meta.lastMutationAtMs || nowMs,
      fieldTimestamps: meta.fieldTimestamps || {},
      recordTimestamps: meta.recordTimestamps || {},
      deletedRecords: meta.deletedRecords || {}
    },
    data: dataObj
  };
}

/**
 * Fusiona las calificaciones de un estudiante respetando SIEMPRE la última modificación
 * (ya sea que venga del Celular o de la PC, incluso si la nota se redujo o se borró a 0).
 */
function mergeStudentGradeRecord(localNota, remoteNota, preferRemote = true, localMeta = null, remoteMeta = null, remoteGlobalTs = 0, localGlobalTs = 0) {
  if (!localNota) return { ...remoteNota };

  const merged = { ...localNota };
  const baseKey = `${localNota.estudianteId || remoteNota.estudianteId}_${localNota.trimestre || remoteNota.trimestre}`;
  const localFT = localMeta?.fieldTimestamps || {};
  const remoteFT = remoteMeta?.fieldTimestamps || {};

  let anyCellChanged = false;
  let usedRemoteCount = 0;
  let usedLocalCount = 0;

  for (const field of GRADE_FIELDS) {
    const cellKey = `${baseKey}_${field}`;
    const localVal = Number(localNota[field] || 0);
    const remoteVal = Number(remoteNota[field] || 0);
    const localTs = Number(localFT[cellKey] || 0);
    const remoteTs = Number(remoteFT[cellKey] || 0);

    if (localVal === remoteVal) {
      merged[field] = localVal;
      if (remoteTs > localTs && localMeta) {
        localFT[cellKey] = remoteTs;
      }
      continue;
    }

    // Regla 1: Si existen timestamps explícitos de modificación de esta casilla, GANA LA ÚLTIMA MODIFICACIÓN
    if (remoteTs > 0 || localTs > 0) {
      if (remoteTs > localTs) {
        merged[field] = remoteVal;
        localFT[cellKey] = remoteTs;
        anyCellChanged = true;
        usedRemoteCount++;
      } else if (localTs > remoteTs) {
        merged[field] = localVal;
        usedLocalCount++;
      } else {
        merged[field] = preferRemote ? remoteVal : localVal;
        anyCellChanged = true;
      }
      continue;
    }

    // Regla 2: Sin timestamp individual previo (datos heredados)
    if (preferRemote) {
      if (remoteVal > 0 && localVal === 0) {
        merged[field] = remoteVal;
        anyCellChanged = true;
        usedRemoteCount++;
      } else if (localVal > 0 && remoteVal === 0) {
        // Si el paquete remoto es más reciente que nuestra última mutación local y ya estábamos sincronizados,
        // significa que se borró en el otro dispositivo; si es hidratación inicial de contenedor viejo, conservar el valor > 0
        if (remoteGlobalTs > localGlobalTs && localMeta?.lastSyncedCloudUpdatedAt) {
          merged[field] = 0;
          anyCellChanged = true;
          usedRemoteCount++;
        } else {
          merged[field] = localVal;
          usedLocalCount++;
        }
      } else {
        merged[field] = remoteVal;
        anyCellChanged = true;
        usedRemoteCount++;
      }
    } else {
      merged[field] = localVal > 0 ? localVal : remoteVal;
      if (merged[field] !== localVal) anyCellChanged = true;
    }
  }

  // Rezagados: gana el timestamp más reciente o fusión
  const rezKey = `${baseKey}_rezagados`;
  const localRezTs = Number(localFT[rezKey] || 0);
  const remoteRezTs = Number(remoteFT[rezKey] || 0);
  if (remoteRezTs > localRezTs) {
    merged.rezagados = remoteNota.rezagados || '{}';
    localFT[rezKey] = remoteRezTs;
  } else if (localRezTs > remoteRezTs) {
    merged.rezagados = localNota.rezagados || '{}';
  } else {
    try {
      const localRez = JSON.parse(localNota.rezagados || '{}');
      const remoteRez = JSON.parse(remoteNota.rezagados || '{}');
      merged.rezagados = JSON.stringify(preferRemote ? { ...localRez, ...remoteRez } : { ...remoteRez, ...localRez });
    } catch (e) {
      merged.rezagados = (preferRemote ? remoteNota.rezagados : localNota.rezagados) || '{}';
    }
  }

  // Recalcular notaTrimestre fielmente a las casillas vigentes
  const trimKey = `${baseKey}_notaTrimestre`;
  const localTrimTs = Number(localFT[trimKey] || 0);
  const remoteTrimTs = Number(remoteFT[trimKey] || 0);
  const recomputed = recomputeNotaTrimestre(merged);

  if (recomputed > 0 || anyCellChanged) {
    if (usedRemoteCount > 0 && usedLocalCount === 0 && Number(remoteNota.notaTrimestre || 0) > 0) {
      merged.notaTrimestre = Number(remoteNota.notaTrimestre);
    } else if (usedLocalCount > 0 && usedRemoteCount === 0 && Number(localNota.notaTrimestre || 0) > 0) {
      merged.notaTrimestre = Number(localNota.notaTrimestre);
    } else {
      merged.notaTrimestre = recomputed;
    }
  } else if (remoteTrimTs > localTrimTs) {
    merged.notaTrimestre = Number(remoteNota.notaTrimestre || 0);
    localFT[trimKey] = remoteTrimTs;
  } else if (localTrimTs > remoteTrimTs) {
    merged.notaTrimestre = Number(localNota.notaTrimestre || 0);
  } else {
    merged.notaTrimestre = preferRemote
      ? Number(remoteNota.notaTrimestre ?? localNota.notaTrimestre ?? 0)
      : Number(localNota.notaTrimestre ?? remoteNota.notaTrimestre ?? 0);
  }

  return merged;
}

/**
 * Importa y fusiona (Smart Merge con regla Última Modificación Gana) los datos de las 12 tablas
 * desde un payload JSON, creando respaldo preventivo y respetando ediciones y eliminaciones.
 */
async function importFullJson(prisma, payload, options = {}) {
  if (!payload || !payload.data) {
    throw new Error('Formato de datos de sincronización inválido.');
  }

  const { mode = 'merge', preferRemote = true, skipBackup = false } = options;

  // 1. Respaldo preventivo incondicional antes de tocar datos locales
  if (!skipBackup) {
    createAutoBackup('pre_remote_sync');
  }

  await sanitizeAndRepairDb(prisma);

  // 2. Capturar primero cualquier cambio local pendiente en sync_meta.json antes de fusionar
  const currentLocalExport = await exportFullJson(prisma);
  const localMeta = loadSyncMeta();
  const remoteMeta = payload.syncMeta || {};
  const remoteGlobalTs = Number(remoteMeta.updatedAtMs || (payload.exportedAt ? new Date(payload.exportedAt).getTime() : Date.now()));
  const localGlobalTs = Number(localMeta.lastMutationAtMs || 0);

  const remoteRecTsMap = remoteMeta.recordTimestamps || {};
  const localRecTsMap = localMeta.recordTimestamps || {};
  const remoteDeletedMap = remoteMeta.deletedRecords || {};
  const localDeletedMap = localMeta.deletedRecords || {};

  const shouldApplyRemoteRecord = (recKey, existsLocally) => {
    if (mode !== 'merge') return true;
    const remTs = Number(remoteRecTsMap[recKey] || remoteGlobalTs || 0);
    const locTs = Number(localRecTsMap[recKey] || 0);
    const locDelTs = Number(localDeletedMap[recKey] || 0);

    // Si fue eliminado localmente MÁS RECIENTEMENTE que la versión remota, respetar la eliminación local
    if (locDelTs > 0 && locDelTs > remTs) {
      return false;
    }
    if (!existsLocally) {
      return true;
    }
    if (remTs > 0 && locTs > 0) {
      return remTs >= locTs;
    }
    return preferRemote || remTs >= localGlobalTs;
  };

  const {
    configs = [],
    estudiantes = [],
    fechasAsistencia = [],
    asistencias = [],
    gradeHeaders = [],
    notas = [],
    fichasSeguimiento = [],
    repositorioArchivos = [],
    centralizadorGeneral = [],
    avanceCurricular = [],
    agendaNotas = [],
    planesProgramas = []
  } = payload.data;

  // Pre-cargar datos locales para fusión inteligente por timestamp
  const existingNotasList = mode === 'merge' ? (currentLocalExport.data.notas || []) : [];
  const existingNotasById = new Map(existingNotasList.map(n => [n.id, n]));
  const existingNotasByEstTrim = new Map(existingNotasList.map(n => [`${n.estudianteId}_${n.trimestre}`, n]));

  const existingHeadersList = mode === 'merge' ? (currentLocalExport.data.gradeHeaders || []) : [];
  const existingHeadersByKey = new Map(
    existingHeadersList.map(gh => [`${gh.configId}_${gh.trimestre}_${gh.campo}`, gh])
  );

  const existingAsistenciasList = mode === 'merge' ? (currentLocalExport.data.asistencias || []) : [];
  const existingAsistenciaByCanonical = new Map(
    existingAsistenciasList.map(a => [getAsistenciaCanonicalKey(a), a])
  );

  const existingEstudiantesMap = new Map((currentLocalExport.data.estudiantes || []).map(e => [e.id, e]));
  const existingFichasMap = new Map((currentLocalExport.data.fichasSeguimiento || []).map(f => [f.id, f]));
  const existingAgendaMap = new Map((currentLocalExport.data.agendaNotas || []).map(a => [a.id, a]));
  const existingAvanceMap = new Map((currentLocalExport.data.avanceCurricular || []).map(a => [a.id, a]));

  // Ejecutar dentro de transacción con timeout extendido para 12,000+ registros
  await prisma.$transaction(async (tx) => {
    // 1. Configs
    for (const c of configs) {
      const recKey = `Config:${c.id}`;
      const existsLocally = (currentLocalExport.data.configs || []).some(lc => lc.id === c.id);
      if (!shouldApplyRemoteRecord(recKey, existsLocally)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      await tx.config.upsert({
        where: { id: c.id },
        update: {
          distrito: c.distrito,
          unidadEducativa: c.unidadEducativa,
          nivel: c.nivel,
          maestro: c.maestro,
          area: c.area,
          gestion: c.gestion,
          curso: c.curso,
          orientacion: c.orientacion || 'Horizontal'
        },
        create: {
          id: c.id,
          distrito: c.distrito,
          unidadEducativa: c.unidadEducativa,
          nivel: c.nivel,
          maestro: c.maestro,
          area: c.area,
          gestion: c.gestion,
          curso: c.curso,
          orientacion: c.orientacion || 'Horizontal'
        }
      });
    }

    // 2. Estudiantes
    for (const e of estudiantes) {
      const recKey = `Estudiante:${e.id}`;
      const existsLocally = existingEstudiantesMap.has(e.id);
      if (!shouldApplyRemoteRecord(recKey, existsLocally)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const fn = e.fechaNacimiento ? new Date(e.fechaNacimiento) : null;
      const validFn = fn && !isNaN(fn.getTime()) ? fn : null;
      await tx.estudiante.upsert({
        where: { id: e.id },
        update: {
          configId: e.configId,
          rude: e.rude || '',
          ci: e.ci || '',
          apellidos: e.apellidos || '',
          nombres: e.nombres || '',
          fechaNacimiento: validFn,
          edad: e.edad ?? null,
          direccion: e.direccion || '',
          genero: e.genero || '',
          padreMadre: e.padreMadre || '',
          telefono: e.telefono || ''
        },
        create: {
          id: e.id,
          configId: e.configId,
          rude: e.rude || '',
          ci: e.ci || '',
          apellidos: e.apellidos || '',
          nombres: e.nombres || '',
          fechaNacimiento: validFn,
          edad: e.edad ?? null,
          direccion: e.direccion || '',
          genero: e.genero || '',
          padreMadre: e.padreMadre || '',
          telefono: e.telefono || ''
        }
      });
    }

    // 3. Notas (con Fusión Inteligente por casilla donde SIEMPRE gana la última modificación de Celular o PC)
    for (const n of notas) {
      const localMatch = existingNotasById.get(n.id) || existingNotasByEstTrim.get(`${n.estudianteId}_${n.trimestre}`);
      const targetId = localMatch ? localMatch.id : n.id;
      const finalNota = mode === 'merge' && localMatch
        ? mergeStudentGradeRecord(localMatch, n, preferRemote, localMeta, remoteMeta, remoteGlobalTs, localGlobalTs)
        : { ...n, id: targetId };

      if (!localMatch && remoteMeta.fieldTimestamps) {
        const baseKey = `${n.estudianteId}_${n.trimestre}`;
        for (const field of [...GRADE_FIELDS, 'notaTrimestre', 'rezagados']) {
          const ck = `${baseKey}_${field}`;
          if (remoteMeta.fieldTimestamps[ck]) {
            localMeta.fieldTimestamps[ck] = remoteMeta.fieldTimestamps[ck];
          }
        }
      }

      const { id, ...updateData } = finalNota;
      await tx.nota.upsert({
        where: { id: targetId },
        update: updateData,
        create: { id: targetId, ...updateData }
      });
    }

    // 4. GradeHeaders (usando clave única compuesta [configId, trimestre, campo])
    for (const gh of gradeHeaders) {
      const key = `${gh.configId}_${gh.trimestre}_${gh.campo}`;
      const recKey = `GradeHeader:${key}`;
      const localGh = existingHeadersByKey.get(key);
      const remoteWinsHeader = shouldApplyRemoteRecord(recKey, Boolean(localGh));
      if (remoteRecTsMap[recKey] && remoteWinsHeader) {
        localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];
      }

      let mergedRawSellos = gh.rawSellos || '{}';
      if (mode === 'merge' && localGh) {
        try {
          const lMap = JSON.parse(localGh.rawSellos || '{}');
          const rMap = JSON.parse(gh.rawSellos || '{}');
          mergedRawSellos = JSON.stringify(remoteWinsHeader ? { ...lMap, ...rMap } : { ...rMap, ...lMap });
        } catch (e) {}
      }

      const etiqueta = remoteWinsHeader
        ? ((gh.etiqueta !== undefined && gh.etiqueta !== null) ? gh.etiqueta : (localGh?.etiqueta || ''))
        : (localGh?.etiqueta ?? gh.etiqueta ?? '');
      const fecha = remoteWinsHeader
        ? ((gh.fecha !== undefined && gh.fecha !== null) ? gh.fecha : (localGh?.fecha || ''))
        : (localGh?.fecha ?? gh.fecha ?? '');
      const sellosMax = remoteWinsHeader
        ? Number(gh.sellosMax ?? localGh?.sellosMax ?? 0)
        : Number(localGh?.sellosMax ?? gh.sellosMax ?? 0);

      await tx.gradeHeader.upsert({
        where: {
          configId_trimestre_campo: {
            configId: gh.configId,
            trimestre: gh.trimestre,
            campo: gh.campo
          }
        },
        update: {
          etiqueta,
          fecha,
          sellosMax,
          rawSellos: mergedRawSellos
        },
        create: {
          configId: gh.configId,
          trimestre: gh.trimestre,
          campo: gh.campo,
          etiqueta,
          fecha,
          sellosMax,
          rawSellos: mergedRawSellos
        }
      });
    }

    // 5. FechasAsistencia (usando clave única compuesta [configId, trimestre, month, year, dia, tipo])
    for (const fa of fechasAsistencia) {
      const tipo = fa.tipo || 'NORMAL';
      const recKey = `FechaAsistencia:${fa.configId}_${fa.trimestre}_${fa.month}_${fa.year}_${fa.dia}_${tipo}`;
      if (!shouldApplyRemoteRecord(recKey, true)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      await tx.fechaAsistencia.upsert({
        where: {
          configId_trimestre_month_year_dia_tipo: {
            configId: fa.configId,
            trimestre: fa.trimestre,
            month: fa.month,
            year: fa.year,
            dia: fa.dia,
            tipo
          }
        },
        update: {
          etiqueta: fa.etiqueta
        },
        create: {
          configId: fa.configId,
          trimestre: fa.trimestre,
          month: fa.month,
          year: fa.year,
          dia: fa.dia,
          etiqueta: fa.etiqueta,
          tipo
        }
      });
    }

    // 6. Asistencias (respetando última modificación de estado A/F/R/L o eliminación)
    for (const a of asistencias) {
      const recKey = getAsistenciaCanonicalKey(a);
      const localA = existingAsistenciaByCanonical.get(recKey);
      if (!shouldApplyRemoteRecord(recKey, Boolean(localA))) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const fDate = a.fecha ? new Date(a.fecha) : new Date();
      const validDate = !isNaN(fDate.getTime()) ? fDate : new Date();
      const targetId = localA ? localA.id : a.id;

      await tx.asistencia.upsert({
        where: { id: targetId },
        update: {
          estudianteId: a.estudianteId,
          fecha: validDate,
          estado: a.estado,
          trimestre: a.trimestre,
          tipo: a.tipo || 'NORMAL'
        },
        create: {
          id: targetId,
          estudianteId: a.estudianteId,
          fecha: validDate,
          estado: a.estado,
          trimestre: a.trimestre,
          tipo: a.tipo || 'NORMAL'
        }
      });
    }

    // Aplicar eliminaciones remotas de Asistencias (cuando se borra una casilla de asistencia en Celular o PC)
    if (mode === 'merge') {
      for (const [canonKey, localA] of existingAsistenciaByCanonical.entries()) {
        const remDelTs = Number(remoteDeletedMap[canonKey] || 0);
        const locRecTs = Number(localRecTsMap[canonKey] || 0);
        if (remDelTs > 0 && remDelTs > locRecTs) {
          await tx.asistencia.delete({ where: { id: localA.id } }).catch(() => {});
          localMeta.deletedRecords[canonKey] = remDelTs;
        }
      }
    }

    // 7. FichasSeguimiento (ignorando cualquier fila no válida y respetando última edición/eliminación)
    for (const fsItem of fichasSeguimiento) {
      if (!fsItem.id || String(fsItem.id).startsWith('eval_') || typeof fsItem.trimestre !== 'number') {
        continue;
      }
      const recKey = `Ficha:${fsItem.id}`;
      const existsLocally = existingFichasMap.has(fsItem.id);
      if (!shouldApplyRemoteRecord(recKey, existsLocally)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const fDate = fsItem.fecha ? new Date(fsItem.fecha) : new Date();
      const cDate = fsItem.createdAt ? new Date(fsItem.createdAt) : new Date();
      const uDate = fsItem.updatedAt ? new Date(fsItem.updatedAt) : new Date();
      const dataObj = {
        estudianteId: fsItem.estudianteId,
        configId: fsItem.configId,
        trimestre: fsItem.trimestre,
        fecha: !isNaN(fDate.getTime()) ? fDate : new Date(),
        hora: fsItem.hora || '',
        anotacionesClave: fsItem.anotacionesClave || '',
        redaccionDetallada: fsItem.redaccionDetallada || '',
        categoria: fsItem.categoria || 'Aprovechamiento/Conducta',
        inasistenciasAcum: Number(fsItem.inasistenciasAcum || 0),
        atrasosAcum: Number(fsItem.atrasosAcum || 0),
        licenciasAcum: Number(fsItem.licenciasAcum || 0),
        origenLunesRef: fsItem.origenLunesRef || '',
        createdAt: !isNaN(cDate.getTime()) ? cDate : new Date(),
        updatedAt: !isNaN(uDate.getTime()) ? uDate : new Date()
      };
      await tx.fichaSeguimiento.upsert({
        where: { id: fsItem.id },
        update: dataObj,
        create: { id: fsItem.id, ...dataObj }
      });
    }

    if (mode === 'merge') {
      for (const [fId] of existingFichasMap.entries()) {
        const recKey = `Ficha:${fId}`;
        const remDelTs = Number(remoteDeletedMap[recKey] || 0);
        const locRecTs = Number(localRecTsMap[recKey] || 0);
        if (remDelTs > 0 && remDelTs > locRecTs) {
          await tx.fichaSeguimiento.delete({ where: { id: fId } }).catch(() => {});
          localMeta.deletedRecords[recKey] = remDelTs;
        }
      }
    }

    // 8. CentralizadorGeneral (usando clave única compuesta [configId, trimestre, estudiante, materia])
    for (const cg of centralizadorGeneral) {
      const recKey = `Centralizador:${cg.configId}_${cg.trimestre}_${cg.estudiante}_${cg.materia}`;
      if (!shouldApplyRemoteRecord(recKey, true)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      await tx.centralizadorGeneral.upsert({
        where: {
          configId_trimestre_estudiante_materia: {
            configId: cg.configId,
            trimestre: cg.trimestre,
            estudiante: cg.estudiante,
            materia: cg.materia
          }
        },
        update: {
          nota: Number(cg.nota || 0),
          promedio: Number(cg.promedio || 0)
        },
        create: {
          configId: cg.configId,
          trimestre: cg.trimestre,
          estudiante: cg.estudiante,
          materia: cg.materia,
          nota: Number(cg.nota || 0),
          promedio: Number(cg.promedio || 0)
        }
      });
    }

    // 9. AvanceCurricular
    for (const ac of avanceCurricular) {
      const recKey = `Avance:${ac.id}`;
      const existsLocally = existingAvanceMap.has(ac.id);
      if (!shouldApplyRemoteRecord(recKey, existsLocally)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const cDate = ac.createdAt ? new Date(ac.createdAt) : new Date();
      const uDate = ac.updatedAt ? new Date(ac.updatedAt) : new Date();
      const dataObj = {
        gestion: ac.gestion || '2026',
        orden: Number(ac.orden || 0),
        area: ac.area || '',
        curso: ac.curso || '',
        t1_tp: ac.t1_tp || '',
        t1_td: ac.t1_td || '',
        t2_tp: ac.t2_tp || '',
        t2_td: ac.t2_td || '',
        t3_tp: ac.t3_tp || '',
        t3_td: ac.t3_td || '',
        createdAt: !isNaN(cDate.getTime()) ? cDate : new Date(),
        updatedAt: !isNaN(uDate.getTime()) ? uDate : new Date()
      };
      await tx.avanceCurricular.upsert({
        where: { id: ac.id },
        update: dataObj,
        create: { id: ac.id, ...dataObj }
      });
    }

    // 10. AgendaNota
    for (const an of agendaNotas) {
      const recKey = `Agenda:${an.id}`;
      const existsLocally = existingAgendaMap.has(an.id);
      if (!shouldApplyRemoteRecord(recKey, existsLocally)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const uDate = an.updated ? new Date(an.updated) : new Date();
      await tx.agendaNota.upsert({
        where: { id: an.id },
        update: {
          subject: an.subject || '',
          weekStr: an.weekStr || '',
          text: an.text || '',
          updated: !isNaN(uDate.getTime()) ? uDate : new Date()
        },
        create: {
          id: an.id,
          subject: an.subject || '',
          weekStr: an.weekStr || '',
          text: an.text || '',
          updated: !isNaN(uDate.getTime()) ? uDate : new Date()
        }
      });
    }

    // 11. PlanesProgramas (clave única [configId])
    for (const pp of planesProgramas) {
      const recKey = `Plan:${pp.configId}`;
      if (!shouldApplyRemoteRecord(recKey, true)) continue;
      if (remoteRecTsMap[recKey]) localMeta.recordTimestamps[recKey] = remoteRecTsMap[recKey];

      const cDate = pp.createdAt ? new Date(pp.createdAt) : new Date();
      const uDate = pp.updatedAt ? new Date(pp.updatedAt) : new Date();
      await tx.planPrograma.upsert({
        where: { configId: pp.configId },
        update: {
          contenido: pp.contenido || '',
          fuente: pp.fuente || '',
          updatedAt: !isNaN(uDate.getTime()) ? uDate : new Date()
        },
        create: {
          id: pp.id,
          configId: pp.configId,
          contenido: pp.contenido || '',
          fuente: pp.fuente || '',
          createdAt: !isNaN(cDate.getTime()) ? cDate : new Date(),
          updatedAt: !isNaN(uDate.getTime()) ? uDate : new Date()
        }
      });
    }

    // 12. RepositorioArchivo
    for (const ra of repositorioArchivos) {
      const cDate = ra.createdAt ? new Date(ra.createdAt) : new Date();
      await tx.repositorioArchivo.upsert({
        where: { id: ra.id },
        update: {
          configId: ra.configId,
          trimestre: ra.trimestre,
          originalName: ra.originalName,
          fileName: ra.fileName,
          mimeType: ra.mimeType,
          size: ra.size,
          path: ra.path,
          createdAt: !isNaN(cDate.getTime()) ? cDate : new Date()
        },
        create: {
          id: ra.id,
          configId: ra.configId,
          trimestre: ra.trimestre,
          originalName: ra.originalName,
          fileName: ra.fileName,
          mimeType: ra.mimeType,
          size: ra.size,
          path: ra.path,
          createdAt: !isNaN(cDate.getTime()) ? cDate : new Date()
        }
      });
    }
  }, {
    maxWait: 15000,
    timeout: 60000
  });

  // 3. Persistir metadatos fusionados y actualizar línea base post-merge
  if (payload.exportedAt) {
    localMeta.lastSyncedCloudUpdatedAt = payload.exportedAt;
  }
  saveSyncMeta(localMeta);

  const postMergeExport = await exportFullJson(prisma);
  captureLocalDiffsIntoMeta(postMergeExport.data, Date.now(), true);

  return true;
}

module.exports = {
  DB_PATH,
  SYNC_META_PATH,
  BACKUPS_DIR,
  MASTER_BACKUPS_DIR,
  loadSyncMeta,
  saveSyncMeta,
  markLocalMutation,
  createAutoBackup,
  ensureDailyMasterBackup,
  sanitizeAndRepairDb,
  getStats,
  listLocalBackups,
  restoreFromUploadedDb,
  restoreFromUploadedDbAsync,
  restoreLocalBackupById,
  exportFullJson,
  importFullJson
};
