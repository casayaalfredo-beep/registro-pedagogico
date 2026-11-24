const fs = require('fs');
const zlib = require('zlib');
const syncService = require('./syncService');

const DEFAULT_SUPABASE_URL = 'https://nqzcgagybjnctfaeeiqd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_3b9uuluJAKe2wd3jQEDnlg_MhT81j__';
const DEFAULT_PIN = '2026';

const VAULT_RECORD_ID = '__RP_CLOUD_VAULT_V2__';
const SNAPSHOT_PREFIX = '__RP_CLOUD_SNAP_';
const MAX_PG_SNAPSHOTS = 5;
const STORAGE_BUCKET = 'registro-pedagogico-vault';

const cloudState = {
  autoSyncEnabled: true,
  isSyncing: false,
  pendingPush: false,
  pendingReason: null,
  lastPushAt: null,
  lastPullAt: null,
  lastCloudUpdatedAt: null,
  lastDeviceOrigin: null,
  lastError: null,
  online: null,
  latencyMs: null,
  cloudStats: null,
  cloudHistory: []
};

let autoPushTimer = null;
let lastSnapshotCreatedAtMs = 0;
let initialSyncPromise = null;
let lastCloudCheckAtMs = 0;

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const pin = (process.env.SUPABASE_PIN || DEFAULT_PIN).trim();
  const isRenderCloud = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);

  return {
    url,
    anonKey,
    secretKey,
    pin,
    isRenderCloud,
    deviceOrigin: isRenderCloud ? 'CELULAR / WEB NUBE' : 'LAPTOP PRINCIPAL',
    configured: Boolean(url && anonKey)
  };
}

function getAnonHeaders(cfg) {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    'Content-Type': 'application/json'
  };
}

function getSecretHeaders(cfg, extra = {}) {
  const key = cfg.secretKey || cfg.anonKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

/**
 * Calcula un puntaje ponderado de riqueza de datos para comparar dos estados
 */
function computeDataRichnessScore(counts) {
  if (!counts) return 0;
  return (
    (Number(counts.estudiantes || 0) * 100) +
    (Number(counts.casillasCalificadas || 0) * 50) +
    (Number(counts.sumaPuntosNotas || 0)) +
    (Number(counts.asistencias || 0) * 2) +
    (Number(counts.fichasSeguimiento || 0) * 20) +
    (Number(counts.agendaNotas || 0) * 15) +
    (Number(counts.centralizadorGeneral || 0) * 5)
  );
}

/**
 * Consulta el contexto de Supabase PostgreSQL y extrae la bóveda maestra y snapshots
 */
async function fetchVaultRecordsFromPostgres(timeoutMs = 20000) {
  const cfg = getSupabaseConfig();
  const startTime = Date.now();

  const res = await fetch(`${cfg.url}/rest/v1/rpc/omr_portal_contexto`, {
    method: 'POST',
    headers: getAnonHeaders(cfg),
    body: JSON.stringify({ p_pin: cfg.pin }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const latencyMs = Date.now() - startTime;
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase respondió con HTTP ${res.status}: ${txt}`);
  }

  const data = await res.json();
  if (!data || !data.ok) {
    throw new Error(data?.error || 'Respuesta inválida de Supabase Cloud');
  }

  const evals = Array.isArray(data.evaluaciones) ? data.evaluaciones : [];
  const masterRecord = evals.find(e => e.id === VAULT_RECORD_ID) || null;
  const snapshotRecords = evals
    .filter(e => String(e.id || '').startsWith(SNAPSHOT_PREFIX))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  cloudState.online = true;
  cloudState.latencyMs = latencyMs;
  cloudState.lastError = null;

  return {
    latencyMs,
    masterRecord,
    snapshotRecords,
    cursosCount: (data.cursos || []).length
  };
}

/**
 * Obtiene el estado rápido de Supabase Cloud sin descomprimir todo el payload
 */
async function getCloudStatus() {
  const cfg = getSupabaseConfig();
  try {
    const { latencyMs, masterRecord, snapshotRecords } = await fetchVaultRecordsFromPostgres(15000);

    if (!masterRecord || !masterRecord.claves_json) {
      return {
        success: true,
        online: true,
        hasData: false,
        latencyMs,
        supabaseUrl: cfg.url,
        autoSyncEnabled: cloudState.autoSyncEnabled,
        lastPushAt: cloudState.lastPushAt,
        lastPullAt: cloudState.lastPullAt
      };
    }

    const meta = masterRecord.claves_json;
    const counts = meta.counts || meta.stats?.counts || {};
    const updatedAt = meta.updatedAt || masterRecord.updated_at;
    const deviceOrigin = meta.deviceOrigin || 'NUBE SUPABASE';

    const history = snapshotRecords.map(s => ({
      id: s.id,
      label: s.titulo || s.id,
      updatedAt: s.claves_json?.updatedAt || s.updated_at,
      deviceOrigin: s.claves_json?.deviceOrigin || 'SUPABASE',
      counts: s.claves_json?.counts || {}
    }));

    cloudState.cloudStats = counts;
    cloudState.lastCloudUpdatedAt = updatedAt;
    cloudState.lastDeviceOrigin = deviceOrigin;
    cloudState.cloudHistory = history;

    return {
      success: true,
      online: true,
      hasData: true,
      latencyMs,
      supabaseUrl: cfg.url,
      updatedAt,
      deviceOrigin,
      counts,
      history,
      autoSyncEnabled: cloudState.autoSyncEnabled,
      isSyncing: cloudState.isSyncing,
      lastPushAt: cloudState.lastPushAt,
      lastPullAt: cloudState.lastPullAt,
      lastError: cloudState.lastError
    };
  } catch (err) {
    cloudState.online = false;
    cloudState.lastError = err.message;
    return {
      success: false,
      online: false,
      error: err.message,
      supabaseUrl: cfg.url,
      autoSyncEnabled: cloudState.autoSyncEnabled,
      lastPushAt: cloudState.lastPushAt,
      lastPullAt: cloudState.lastPullAt
    };
  }
}

/**
 * Asegura que exista al menos el curso base (config_id = 1) en omr_cursos para la FK de omr_evaluaciones
 */
async function ensureBaseCourseInSupabase(prisma, cfg) {
  if (!cfg.secretKey) return;
  try {
    const configs = await prisma.config.findMany({ orderBy: { id: 'asc' } });
    if (configs.length === 0) return;

    const rows = configs.map(c => ({
      config_id: c.id,
      curso: c.curso || '1RO "A"',
      area: c.area || 'GENERAL',
      maestro: c.maestro || '',
      unidad_educativa: c.unidadEducativa || '',
      gestion: c.gestion || '2026',
      pin_acceso: cfg.pin,
      updated_at: new Date().toISOString()
    }));

    await fetch(`${cfg.url}/rest/v1/omr_cursos?on_conflict=config_id`, {
      method: 'POST',
      headers: {
        ...getSecretHeaders(cfg),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(15000)
    });
  } catch (e) {
    // Si no tiene secretKey o ya existe, continúa normalmente
  }
}

/**
 * Respalda adicionalmente el archivo binario .db y el JSON comprimido en Supabase Storage Bucket
 */
async function uploadToSupabaseStorage(cfg, gzBuffer, metaObj) {
  if (!cfg.secretKey) return;
  try {
    // 1. Subir JSON comprimido maestro
    await fetch(`${cfg.url}/storage/v1/object/${STORAGE_BUCKET}/master/latest_state.json.gz`, {
      method: 'POST',
      headers: getSecretHeaders(cfg, {
        'Content-Type': 'application/gzip',
        'x-upsert': 'true'
      }),
      body: gzBuffer,
      signal: AbortSignal.timeout(25000)
    });

    // 2. Subir archivo SQLite .db físico si existe
    if (fs.existsSync(syncService.DB_PATH)) {
      const dbBuffer = fs.readFileSync(syncService.DB_PATH);
      await fetch(`${cfg.url}/storage/v1/object/${STORAGE_BUCKET}/master/latest_dev.db`, {
        method: 'POST',
        headers: getSecretHeaders(cfg, {
          'Content-Type': 'application/x-sqlite3',
          'x-upsert': 'true'
        }),
        body: dbBuffer,
        signal: AbortSignal.timeout(30000)
      });
    }
  } catch (e) {
    console.warn('[SupabaseCloud] Advertencia subiendo copia extra a Storage:', e.message);
  }
}

/**
 * Descomprime un objeto bóveda de Supabase a JSON
 */
function decodeVaultPayload(vaultObj) {
  if (!vaultObj || !vaultObj.payload) return null;
  const rawBuffer = Buffer.from(vaultObj.payload, 'base64');
  const jsonStr = vaultObj.compressed
    ? zlib.gunzipSync(rawBuffer).toString('utf8')
    : rawBuffer.toString('utf8');
  return JSON.parse(jsonStr);
}

/**
 * Sube el estado completo del Registro Pedagógico a Supabase de manera permanente,
 * fusionando antes cualquier cambio remoto más reciente para que SIEMPRE gane la última modificación.
 */
async function pushToSupabase(prisma, options = {}) {
  const { reason = 'manual', force = false, createSnapshot = false } = options;
  const cfg = getSupabaseConfig();

  if (cloudState.isSyncing) {
    cloudState.pendingPush = true;
    cloudState.pendingReason = reason;
    return { success: true, queued: true, message: 'Sincronización en curso, cambio encolado.' };
  }

  cloudState.isSyncing = true;
  try {
    // 1. Verificar estado actual en Supabase antes de subir para no pisar cambios recientes del otro dispositivo
    let existingMaster = null;
    try {
      const remoteCheck = await fetchVaultRecordsFromPostgres(15000);
      existingMaster = remoteCheck.masterRecord;
      lastCloudCheckAtMs = Date.now();
    } catch (e) {
      // Si falla la lectura previa, intentaremos subir de todos modos
    }

    if (existingMaster && existingMaster.claves_json?.payload) {
      const remoteVault = existingMaster.claves_json;
      const remoteUpdatedAt = remoteVault.updatedAt || existingMaster.updated_at;
      const remoteUpdatedMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
      const lastKnownCloudMs = cloudState.lastCloudUpdatedAt ? new Date(cloudState.lastCloudUpdatedAt).getTime() : 0;

      // Si Supabase tiene cambios de otro dispositivo que aún no hemos integrado en este dispositivo,
      // fusionar primero por timestamps (Última Modificación Gana) antes de exportar y subir
      if (remoteUpdatedMs > lastKnownCloudMs + 500) {
        try {
          const remotePayload = decodeVaultPayload(remoteVault);
          if (remotePayload && remotePayload.data) {
            console.log(`[SupabaseCloud] 🔄 Integrando cambios previos de Supabase (${remoteVault.deviceOrigin}) antes de guardar...`);
            await syncService.importFullJson(prisma, remotePayload, {
              mode: 'merge',
              preferRemote: true,
              skipBackup: true
            });
          }
        } catch (mergeErr) {
          console.warn('[SupabaseCloud] Advertencia al pre-fusionar antes de push:', mergeErr.message);
        }
      }
    }

    // 2. Exportar el estado unificado con marcas de tiempo por celda/registro
    const [localStatsRes, fullExport] = await Promise.all([
      syncService.getStats(prisma),
      syncService.exportFullJson(prisma)
    ]);

    const localCounts = localStatsRes.counts || {};

    await ensureBaseCourseInSupabase(prisma, cfg);

    const nowIso = new Date().toISOString();
    const jsonString = JSON.stringify(fullExport);
    const gzBuffer = zlib.gzipSync(jsonString);
    const gzBase64 = gzBuffer.toString('base64');

    const baseConfigId = fullExport.data.configs?.[0]?.id || 1;
    const vaultObject = {
      compressed: true,
      encoding: 'gzip+base64',
      version: '3.0',
      updatedAt: nowIso,
      deviceOrigin: cfg.deviceOrigin,
      reason,
      counts: localCounts,
      payload: gzBase64
    };

    // 3. Guardar estado maestro permanente en PostgreSQL vía RPC SECURITY DEFINER
    const rpcRes = await fetch(`${cfg.url}/rest/v1/rpc/omr_guardar_evaluacion`, {
      method: 'POST',
      headers: getAnonHeaders(cfg),
      body: JSON.stringify({
        p_pin: cfg.pin,
        p_id: VAULT_RECORD_ID,
        p_config_id: baseConfigId,
        p_trimestre: 1,
        p_campo_destino: 'vault_master',
        p_titulo: `Bóveda Maestra (${cfg.deviceOrigin})`,
        p_fecha: nowIso,
        p_puntaje_maximo: 100,
        p_total_preguntas: localCounts.estudiantes || 0,
        p_claves_json: vaultObject
      }),
      signal: AbortSignal.timeout(35000)
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text().catch(() => '');
      throw new Error(`Error al guardar en Supabase (HTTP ${rpcRes.status}): ${errText}`);
    }

    const rpcData = await rpcRes.json();
    if (!rpcData || !rpcData.ok) {
      throw new Error(rpcData?.error || 'Supabase rechazó el guardado de la bóveda.');
    }

    // Actualizar metadato local de última sincronización con la nube
    const meta = syncService.loadSyncMeta();
    meta.lastSyncedCloudUpdatedAt = nowIso;
    syncService.saveSyncMeta(meta);

    // 4. Crear punto de restauración rotativo en Supabase (máx 5 snapshots en PostgreSQL)
    const shouldCreateSnapshot =
      createSnapshot ||
      reason === 'manual' ||
      reason === 'manual_user' ||
      (Date.now() - lastSnapshotCreatedAtMs > 15 * 60 * 1000);

    if (shouldCreateSnapshot) {
      lastSnapshotCreatedAtMs = Date.now();
      const slotIndex = (Math.floor(Date.now() / 1000) % MAX_PG_SNAPSHOTS) + 1;
      const snapId = `${SNAPSHOT_PREFIX}${slotIndex}__`;
      const snapLabel = `Respaldo Nube #${slotIndex} (${new Date().toLocaleString('es-BO')})`;

      await fetch(`${cfg.url}/rest/v1/rpc/omr_guardar_evaluacion`, {
        method: 'POST',
        headers: getAnonHeaders(cfg),
        body: JSON.stringify({
          p_pin: cfg.pin,
          p_id: snapId,
          p_config_id: baseConfigId,
          p_trimestre: 1,
          p_campo_destino: 'vault_snapshot',
          p_titulo: snapLabel,
          p_fecha: nowIso,
          p_puntaje_maximo: 100,
          p_total_preguntas: localCounts.estudiantes || 0,
          p_claves_json: vaultObject
        }),
        signal: AbortSignal.timeout(30000)
      }).catch(() => {});
    }

    // 5. Subir copia extra al bucket de Supabase Storage en segundo plano
    uploadToSupabaseStorage(cfg, gzBuffer, vaultObject).catch(() => {});

    cloudState.online = true;
    cloudState.lastPushAt = nowIso;
    cloudState.lastCloudUpdatedAt = nowIso;
    cloudState.lastDeviceOrigin = cfg.deviceOrigin;
    cloudState.cloudStats = localCounts;
    cloudState.lastError = null;
    lastCloudCheckAtMs = Date.now();

    console.log(`[SupabaseCloud] ✅ Datos guardados permanentemente en Supabase (${reason}) desde ${cfg.deviceOrigin} - ${localCounts.estudiantes} est, ${localCounts.casillasCalificadas} notas.`);

    return {
      success: true,
      updatedAt: nowIso,
      deviceOrigin: cfg.deviceOrigin,
      counts: localCounts,
      message: '¡Datos sincronizados y guardados de forma permanente en Supabase Cloud!'
    };
  } catch (err) {
    cloudState.lastError = err.message;
    console.error('[SupabaseCloud] ❌ Error al subir a Supabase:', err.message);
    throw err;
  } finally {
    cloudState.isSyncing = false;
    if (cloudState.pendingPush) {
      const nextReason = cloudState.pendingReason || 'queued';
      cloudState.pendingPush = false;
      cloudState.pendingReason = null;
      scheduleAutoPush(prisma, nextReason, 1000);
    }
  }
}

/**
 * Descarga y fusiona (o restaura) los datos permanentes desde Supabase hacia este dispositivo
 * respetando siempre la última modificación por casilla/registro.
 */
async function pullFromSupabase(prisma, options = {}) {
  const { mode = 'merge', snapshotId = null, preferRemote = true, skipBackup = false } = options;

  if (cloudState.isSyncing) {
    throw new Error('Ya hay una sincronización en curso. Espera unos segundos.');
  }

  cloudState.isSyncing = true;
  try {
    const { masterRecord, snapshotRecords } = await fetchVaultRecordsFromPostgres(30000);
    lastCloudCheckAtMs = Date.now();

    let targetRecord = masterRecord;
    if (snapshotId) {
      targetRecord = snapshotRecords.find(s => s.id === snapshotId) || (masterRecord?.id === snapshotId ? masterRecord : null);
      if (!targetRecord) {
        throw new Error(`No se encontró el punto de restauración "${snapshotId}" en Supabase.`);
      }
    }

    if (!targetRecord || !targetRecord.claves_json || !targetRecord.claves_json.payload) {
      throw new Error('Aún no hay datos guardados en la bóveda de Supabase.');
    }

    const vaultObj = targetRecord.claves_json;
    const payload = decodeVaultPayload(vaultObj);

    // Aplicar fusión inteligente por timestamp (Última Modificación Gana)
    await syncService.importFullJson(prisma, payload, {
      mode,
      preferRemote,
      skipBackup
    });

    const newStats = await syncService.getStats(prisma);
    const nowIso = new Date().toISOString();

    cloudState.online = true;
    cloudState.lastPullAt = nowIso;
    cloudState.lastCloudUpdatedAt = vaultObj.updatedAt || targetRecord.updated_at;
    cloudState.lastDeviceOrigin = vaultObj.deviceOrigin || 'SUPABASE';
    cloudState.cloudStats = newStats.counts;
    cloudState.lastError = null;

    const meta = syncService.loadSyncMeta();
    meta.lastSyncedCloudUpdatedAt = cloudState.lastCloudUpdatedAt;
    syncService.saveSyncMeta(meta);

    console.log(`[SupabaseCloud] ⬇️ Datos descargados y fusionados desde Supabase (${snapshotId || 'master'}) - origen: ${cloudState.lastDeviceOrigin}.`);

    return {
      success: true,
      mode,
      updatedAt: cloudState.lastCloudUpdatedAt,
      deviceOrigin: cloudState.lastDeviceOrigin,
      stats: newStats,
      message: '¡Datos sincronizados con éxito desde Supabase Cloud!'
    };
  } catch (err) {
    cloudState.lastError = err.message;
    console.error('[SupabaseCloud] ❌ Error al descargar de Supabase:', err.message);
    throw err;
  } finally {
    cloudState.isSyncing = false;
  }
}

/**
 * Sincronización bidireccional en 1 clic ("Sincronizar con Supabase Ahora"):
 * 1. Trae y fusiona cualquier cambio de Supabase respetando la última modificación (Celular o PC)
 * 2. Guarda el estado unificado permanentemente en Supabase
 */
async function syncBidirectionalWithSupabase(prisma) {
  await pullFromSupabase(prisma, { mode: 'merge', preferRemote: true }).catch((e) => {
    console.warn('[SupabaseCloud] Aviso en pull previo de syncBidirectional:', e.message);
  });
  return await pushToSupabase(prisma, {
    reason: 'bidirectional_sync',
    force: true,
    createSnapshot: true
  });
}

/**
 * Programa un auto-guardado inmediato en segundo plano hacia Supabase tras cualquier cambio en el registro
 */
function scheduleAutoPush(prisma, reason = 'auto_change', delayMs = 1200) {
  // Registrar inmediatamente el timestamp exacto de la modificación local
  syncService.markLocalMutation(reason);

  if (!cloudState.autoSyncEnabled) return;

  if (autoPushTimer) {
    clearTimeout(autoPushTimer);
  }

  autoPushTimer = setTimeout(() => {
    autoPushTimer = null;
    pushToSupabase(prisma, { reason, force: false, createSnapshot: false }).catch(err => {
      console.warn(`[SupabaseCloud] Auto-push diferido (${reason}):`, err.message);
    });
  }, delayMs);
}

/**
 * Activa o desactiva la sincronización automática
 */
function setAutoSyncEnabled(enabled) {
  cloudState.autoSyncEnabled = Boolean(enabled);
  return cloudState.autoSyncEnabled;
}

/**
 * Verifica si Supabase tiene una modificación más reciente hecha desde otro dispositivo (Celular o PC)
 * y la descarga/fusiona automáticamente.
 */
async function checkAndPullIfRemoteNewer(prisma) {
  if (!cloudState.autoSyncEnabled || cloudState.isSyncing || autoPushTimer) return false;
  try {
    lastCloudCheckAtMs = Date.now();
    const { masterRecord } = await fetchVaultRecordsFromPostgres(12000);
    if (!masterRecord || !masterRecord.claves_json) return false;

    const remoteUpdatedAt = masterRecord.claves_json.updatedAt || masterRecord.updated_at;
    const remoteMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
    const localKnownMs = cloudState.lastCloudUpdatedAt ? new Date(cloudState.lastCloudUpdatedAt).getTime() : 0;

    if (remoteMs > 0 && (localKnownMs === 0 || remoteMs > localKnownMs + 500)) {
      console.log(`[SupabaseCloud] 🔄 Nuevos cambios detectados en Supabase desde ${masterRecord.claves_json.deviceOrigin}. Sincronizando...`);
      await pullFromSupabase(prisma, { mode: 'merge', preferRemote: true, skipBackup: true });
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Middleware helper: Asegura que la hidratación inicial desde Supabase haya terminado antes de responder
 * (crucial cuando el servidor del Celular despierta con la PC apagada) y verifica cambios recientes.
 */
async function ensureReady(prisma, isReadRequest = false) {
  if (initialSyncPromise) {
    try {
      await Promise.race([
        initialSyncPromise,
        new Promise(resolve => setTimeout(resolve, 15000))
      ]);
    } catch (e) {}
  }

  if (
    isReadRequest &&
    cloudState.autoSyncEnabled &&
    !cloudState.isSyncing &&
    !autoPushTimer &&
    Date.now() - lastCloudCheckAtMs > 10000
  ) {
    await checkAndPullIfRemoteNewer(prisma);
  }
}

/**
 * Al iniciar el servidor (Laptop o Render/Celular):
 * 1. Repara integridad de SQLite local si fuera necesario
 * 2. Fusiona con Supabase respetando siempre la última modificación por timestamp (Celular o PC)
 * 3. Si hubo cambios locales hechos sin internet, los sube a Supabase
 */
function initSupabaseAutoSync(prisma) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) return Promise.resolve();

  initialSyncPromise = (async () => {
    try {
      await syncService.sanitizeAndRepairDb(prisma);
      const localExportBefore = await syncService.exportFullJson(prisma);
      const localMetaBefore = syncService.loadSyncMeta();
      const localLastMutMs = Number(localMetaBefore.lastMutationAtMs || 0);

      const { masterRecord } = await fetchVaultRecordsFromPostgres(20000);
      lastCloudCheckAtMs = Date.now();

      if (!masterRecord || !masterRecord.claves_json?.payload) {
        console.log('[SupabaseCloud] Inicializando bóveda permanente en Supabase con datos locales...');
        await pushToSupabase(prisma, { reason: 'initial_seed', force: true, createSnapshot: true });
      } else {
        const remoteVault = masterRecord.claves_json;
        const remoteUpdatedAt = remoteVault.updatedAt || masterRecord.updated_at;
        const remoteUpdatedMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;

        console.log(`[SupabaseCloud] Sincronizando al iniciar con Supabase Cloud (último guardado: ${remoteVault.deviceOrigin || 'SUPABASE'})...`);
        await pullFromSupabase(prisma, { mode: 'merge', preferRemote: true });

        // Si este dispositivo tenía modificaciones locales más recientes que la nube (ej. calificó offline en la PC),
        // o si es el arranque de la PC y hay diferencias locales más nuevas, subir el estado fusionado a Supabase
        const localStatsAfter = await syncService.getStats(prisma);
        const remoteCounts = remoteVault.counts || {};
        if (
          (localLastMutMs > remoteUpdatedMs + 1000) ||
          ((localStatsAfter.counts?.casillasCalificadas || 0) > (remoteCounts.casillasCalificadas || 0)) ||
          ((localStatsAfter.counts?.asistencias || 0) > (remoteCounts.asistencias || 0))
        ) {
          console.log('[SupabaseCloud] Subiendo cambios locales combinados hacia Supabase Cloud...');
          await pushToSupabase(prisma, { reason: 'startup_merge_sync', force: true });
        } else {
          console.log('[SupabaseCloud] 🟢 Dispositivo y Supabase Cloud 100% sincronizados.');
        }
      }
    } catch (err) {
      console.warn('[SupabaseCloud] Modo Offline al iniciar (sin conexión a Supabase):', err.message);
    } finally {
      initialSyncPromise = null;
    }
  })();

  // Verificación periódica cada 15 segundos para traer cambios hechos en el Celular o PC automáticamente
  setInterval(() => {
    checkAndPullIfRemoteNewer(prisma).catch(() => {});
  }, 15000);

  return initialSyncPromise;
}

module.exports = {
  cloudState,
  getSupabaseConfig,
  getCloudStatus,
  pushToSupabase,
  pullFromSupabase,
  syncBidirectionalWithSupabase,
  scheduleAutoPush,
  setAutoSyncEnabled,
  checkAndPullIfRemoteNewer,
  ensureReady,
  initSupabaseAutoSync
};
