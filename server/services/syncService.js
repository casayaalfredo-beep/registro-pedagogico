const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db');
const BACKUPS_DIR = path.join(__dirname, '..', 'prisma', 'backups_auto');

// Asegurar que exista la carpeta de backups automáticos
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

/**
 * Crea una copia de seguridad automática e inmutable del archivo dev.db
 * @param {string} prefix - Etiqueta descriptiva (ej: 'pre_sync', 'manual', 'startup')
 * @returns {string|null} Ruta del archivo de respaldo creado
 */
function createAutoBackup(prefix = 'auto') {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn('[SyncService] dev.db no existe aún para respaldar.');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `dev_${prefix}_${timestamp}.db`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[SyncService] Respaldo automático creado: ${backupName}`);

    // Mantener un historial seguro de hasta 30 respaldos
    pruneOldBackups(30);

    return backupPath;
  } catch (error) {
    console.error('[SyncService] Error al crear respaldo automático:', error);
    return null;
  }
}

/**
 * Limpia respaldos antiguos conservando los N más recientes
 */
function pruneOldBackups(keepCount = 30) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
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
 * Obtiene métricas y estadísticas del estado actual de los datos
 */
async function getStats(prisma) {
  try {
    const [
      configs,
      estudiantes,
      notas,
      asistencias,
      fichasSeguimiento,
      repositorioArchivos,
      avanceCurricular,
      agendaNotas
    ] = await Promise.all([
      prisma.config.count(),
      prisma.estudiante.count(),
      prisma.nota.count(),
      prisma.asistencia.count(),
      prisma.fichaSeguimiento.count(),
      prisma.repositorioArchivo.count(),
      prisma.avanceCurricular.count(),
      prisma.agendaNota.count()
    ]);

    let dbSize = 0;
    let lastModified = null;
    if (fs.existsSync(DB_PATH)) {
      const stat = fs.statSync(DB_PATH);
      dbSize = stat.size;
      lastModified = stat.mtime;
    }

    const backupFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));

    return {
      success: true,
      counts: {
        configs,
        estudiantes,
        notas,
        asistencias,
        fichasSeguimiento,
        repositorioArchivos,
        avanceCurricular,
        agendaNotas
      },
      db: {
        sizeBytes: dbSize,
        sizeMB: (dbSize / (1024 * 1024)).toFixed(2),
        lastModified
      },
      backups: {
        totalBackups: backupFiles.length,
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
 * Valida y restaura la base de datos desde un archivo SQLite subido,
 * realizando SIEMPRE un respaldo preventivo antes de sobrescribir.
 */
function restoreFromUploadedDb(uploadedFilePath) {
  if (!fs.existsSync(uploadedFilePath)) {
    throw new Error('El archivo subido no existe.');
  }

  // Verificar firma de SQLite (los primeros 16 bytes deben ser "SQLite format 3\0")
  const buffer = Buffer.alloc(16);
  const fd = fs.openSync(uploadedFilePath, 'r');
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('El archivo proporcionado no es una base de datos SQLite válida.');
  }

  // 1. Crear respaldo preventivo del estado actual
  createAutoBackup('pre_restore');

  // 2. Sobrescribir con el archivo validado
  fs.copyFileSync(uploadedFilePath, DB_PATH);
  console.log('[SyncService] Base de datos restaurada con éxito.');

  return true;
}

/**
 * Exporta todos los datos en formato JSON estruturado
 */
async function exportFullJson(prisma) {
  const [
    configs,
    estudiantes,
    fechasAsistencia,
    asistencias,
    gradeHeaders,
    notas,
    fichasSeguimiento,
    repositorioArchivos,
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
    prisma.fichaSeguimiento.findMany(),
    prisma.repositorioArchivo.findMany(),
    prisma.avanceCurricular.findMany(),
    prisma.agendaNota.findMany(),
    prisma.planPrograma.findMany()
  ]);

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    system: 'Registro Pedagogico - Offline First',
    data: {
      configs,
      estudiantes,
      fechasAsistencia,
      asistencias,
      gradeHeaders,
      notas,
      fichasSeguimiento,
      repositorioArchivos,
      avanceCurricular,
      agendaNotas,
      planesProgramas
    }
  };
}

/**
 * Importa datos desde un payload JSON, creando siempre un respaldo preventivo
 */
async function importFullJson(prisma, payload) {
  if (!payload || !payload.data) {
    throw new Error('Formato de datos de sincronización inválido.');
  }

  // 1. Respaldo preventivo incondicional
  createAutoBackup('pre_remote_sync');

  const {
    configs = [],
    estudiantes = [],
    fechasAsistencia = [],
    asistencias = [],
    gradeHeaders = [],
    notas = [],
    fichasSeguimiento = [],
    repositorioArchivos = [],
    avanceCurricular = [],
    agendaNotas = [],
    planesProgramas = []
  } = payload.data;

  // Ejecutar dentro de transacción para consistencia atómica
  await prisma.$transaction(async (tx) => {
    // Configs
    for (const c of configs) {
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
          orientacion: c.orientacion
        },
        create: c
      });
    }

    // Estudiantes
    for (const e of estudiantes) {
      await tx.estudiante.upsert({
        where: { id: e.id },
        update: {
          configId: e.configId,
          rude: e.rude,
          ci: e.ci,
          apellidos: e.apellidos,
          nombres: e.nombres,
          fechaNacimiento: e.fechaNacimiento ? new Date(e.fechaNacimiento) : null,
          edad: e.edad,
          direccion: e.direccion,
          genero: e.genero,
          padreMadre: e.padreMadre,
          telefono: e.telefono
        },
        create: {
          ...e,
          fechaNacimiento: e.fechaNacimiento ? new Date(e.fechaNacimiento) : null
        }
      });
    }

    // Notas
    for (const n of notas) {
      await tx.nota.upsert({
        where: { id: n.id },
        update: { ...n },
        create: n
      });
    }

    // Asistencias
    for (const a of asistencias) {
      await tx.asistencia.upsert({
        where: { id: a.id },
        update: { ...a },
        create: a
      });
    }

    // FechasAsistencia
    for (const fa of fechasAsistencia) {
      await tx.fechaAsistencia.upsert({
        where: { id: fa.id },
        update: { ...fa },
        create: fa
      });
    }

    // GradeHeaders
    for (const gh of gradeHeaders) {
      await tx.gradeHeader.upsert({
        where: { id: gh.id },
        update: { ...gh },
        create: gh
      });
    }

    // FichasSeguimiento
    for (const fsItem of fichasSeguimiento) {
      await tx.fichaSeguimiento.upsert({
        where: { id: fsItem.id },
        update: {
          ...fsItem,
          fecha: fsItem.fecha ? new Date(fsItem.fecha) : new Date()
        },
        create: {
          ...fsItem,
          fecha: fsItem.fecha ? new Date(fsItem.fecha) : new Date()
        }
      });
    }

    // AvanceCurricular
    for (const ac of avanceCurricular) {
      await tx.avanceCurricular.upsert({
        where: { id: ac.id },
        update: { ...ac },
        create: ac
      });
    }

    // AgendaNota
    for (const an of agendaNotas) {
      await tx.agendaNota.upsert({
        where: { id: an.id },
        update: { ...an },
        create: an
      });
    }

    // PlanesProgramas
    for (const pp of planesProgramas) {
      await tx.planPrograma.upsert({
        where: { id: pp.id },
        update: { ...pp },
        create: pp
      });
    }
  });

  return true;
}

module.exports = {
  DB_PATH,
  BACKUPS_DIR,
  createAutoBackup,
  getStats,
  restoreFromUploadedDb,
  exportFullJson,
  importFullJson
};
