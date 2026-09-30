const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'registro_pedagogico_2026_seguro';

console.log('[INIT] Starting server...');

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'repositorio');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });
const uploadMemory = multer({ storage: multer.memoryStorage() });
const siePdfParser = require('./services/siePdfParser');
const syncService = require('./services/syncService');

console.log('[INIT] Setting up CORS and JSON middleware');
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

const authMiddleware = (req, res, next) => {
  const path = req.path;
  console.log('[authMiddleware] Path:', path);
  if (path === '/' || path === '/api/login' || path.startsWith('/api/grade-headers') || path.startsWith('/api/repositorio/download') || path.startsWith('/api/centralizador-general') || path.startsWith('/api/seguimiento') || path.startsWith('/api/asistencia-lunes') || path.startsWith('/api/fechas-asistencia-lunes') || path.startsWith('/api/avance-curricular') || path.startsWith('/api/agenda') || path.startsWith('/api/planes-programas') || path.startsWith('/api/sync')) {
    console.log('[authMiddleware] Allowing:', path);
    return next();
  }
  console.log('[authMiddleware] Requiring auth for:', path);
  authenticateToken(req, res, next);
};

console.log('[INIT] Registering middleware...');
app.use(authMiddleware);
console.log('[INIT] Middleware registered');

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const configSchema = z.object({
  curso: z.string().optional(),
  area: z.string().optional(),
  distrito: z.string().optional(),
  unidadEducativa: z.string().optional(),
  nivel: z.string().optional(),
  maestro: z.string().optional(),
  gestion: z.string().optional(),
  orientacion: z.string().optional()
});

const estudianteSchema = z.object({
  rude: z.string().optional(),
  ci: z.string().optional(),
  apellidos: z.string().optional(),
  nombres: z.string().optional(),
  padreMadre: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  edad: z.number().nullable().optional(),
  fechaNacimiento: z.date().nullable().optional()
});

const asistenciaSchema = z.object({
  estudianteId: z.string(),
  year: z.number().min(2020).max(2100),
  month: z.number().min(0).max(11),
  day: z.number().min(1).max(31),
  estado: z.string().optional(),
  trimestre: z.number().min(1).max(3)
});

const notaSchema = z.object({
  estudianteId: z.string(),
  trimestre: z.number().min(1).max(3),
  ser_1: z.number().min(0).max(10).optional(),
  ser_2: z.number().min(0).max(10).optional(),
  ser_3: z.number().min(0).max(10).optional(),
  ser_4: z.number().min(0).max(10).optional(),
  ser_5: z.number().min(0).max(10).optional(),
  ser_6: z.number().min(0).max(10).optional(),
  saber_1: z.number().min(0).max(45).optional(),
  saber_2: z.number().min(0).max(45).optional(),
  saber_3: z.number().min(0).max(45).optional(),
  saber_4: z.number().min(0).max(45).optional(),
  saber_5: z.number().min(0).max(45).optional(),
  saber_6: z.number().min(0).max(45).optional(),
  saber_7: z.number().min(0).max(45).optional(),
  saber_8: z.number().min(0).max(45).optional(),
  hacer_1: z.number().min(0).max(40).optional(),
  hacer_2: z.number().min(0).max(40).optional(),
  hacer_3: z.number().min(0).max(40).optional(),
  hacer_4: z.number().min(0).max(40).optional(),
  hacer_5: z.number().min(0).max(40).optional(),
  hacer_6: z.number().min(0).max(40).optional(),
  hacer_7: z.number().min(0).max(40).optional(),
  auto_ser: z.number().min(0).max(5).optional(),
  auto_decidir: z.number().min(0).max(5).optional(),
  notas_extras: z.number().min(0).max(100).optional(),
  notaTrimestre: z.number().min(0).max(100).optional(),
  rezagados: z.string().optional()
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const validUsers = [
      { username: 'admin', password: 'admin123' },
      { username: 'alfredo', password: 'alfredo2026' },
      { username: 'maestro', password: 'maestro2026' }
    ];

    const user = validUsers.find(u => u.username === username && u.password === password);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/', (req, res) => {
  res.send('Pedagogical Registry API');
});

app.get('/api/configs', async (req, res) => {
  try {
    const configs = await prisma.config.findMany({
      orderBy: { curso: 'asc' }
    });
    res.json(configs);
  } catch (error) {
    console.error('Error fetching configs:', error.message);
    res.status(500).json({ error: 'Error al obtener configuraciones' });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const { id, curso, area } = req.query;
    let config;
    if (id) {
      config = await prisma.config.findUnique({
        where: { id: parseInt(id) }
      });
    } else if (curso && area) {
      config = await prisma.config.findFirst({
        where: { curso, area }
      });
    } else {
      config = await prisma.config.findFirst({
        orderBy: { id: 'desc' }
      });
    }
    res.json(config || {});
  } catch (error) {
    console.error('Error fetching config:', error.message);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const validation = configSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: validation.error.errors });
    }

    const { id, curso, area, ...rest } = req.body;

    if (!curso || !area) {
      return res.status(400).json({ error: 'Curso y Área son obligatorios' });
    }

    let cleanCurso = curso.trim();
    if (cleanCurso.includes('SEC')) {
      const match = cleanCurso.match(/([1-6](?:RO|DO|TO))/i);
      const grado = match ? match[1].toUpperCase() : cleanCurso.replace(/\s*SEC$/i, '').trim();
      cleanCurso = `${grado} "A"`;
    }

    const existingConfig = await prisma.config.findFirst({
      where: { curso: cleanCurso, area }
    });

    let config;
    if (existingConfig) {
      config = await prisma.config.update({
        where: { id: existingConfig.id },
        data: { ...rest },
      });
    } else {
      config = await prisma.config.create({
        data: { curso: cleanCurso, area, ...rest },
      });
    }
    res.json(config);
  } catch (error) {
    console.error('Error saving config:', error.message);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

app.put('/api/config/general', async (req, res) => {
  try {
    const validation = configSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const { distrito, unidadEducativa, nivel, maestro, gestion, orientacion } = req.body;
    
    const activeConfigId = req.body.activeConfigId;
    if (!activeConfigId) {
      return res.status(400).json({ error: 'ID de configuración requerido' });
    }

    await prisma.config.update({
      where: { id: parseInt(activeConfigId) },
      data: { distrito, unidadEducativa, nivel, maestro, gestion, orientacion }
    });
    res.json({ message: 'Datos generales actualizados exitosamente' });
  } catch (error) {
    console.error('Error updating general config:', error.message);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

app.delete('/api/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    await prisma.config.delete({
      where: { id: parsedId }
    });
    res.json({ message: 'Curso eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting config:', error.message);
    res.status(500).json({ error: 'Error al eliminar configuración' });
  }
});

app.get('/api/estudiantes', async (req, res) => {
  try {
    const { configId } = req.query;
    if (!configId) return res.json([]);

    const parsedConfigId = parseInt(configId);
    if (isNaN(parsedConfigId)) {
      return res.status(400).json({ error: 'ID de configuración inválido' });
    }

    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: parsedConfigId },
      orderBy: { apellidos: 'asc' },
    });
    res.json(estudiantes);
  } catch (error) {
    console.error('Error fetching students:', error.message);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// Analizar PDF del SIE y previsualizar estudiantes con coincidencia inteligente
app.post('/api/estudiantes/parse-sie-pdf', uploadMemory.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo PDF.' });
    }
    const cId = parseInt(req.body.configId);
    if (!cId || isNaN(cId)) {
      return res.status(400).json({ error: 'Falta el ID de curso válido (configId).' });
    }

    const { headerInfo, students } = await siePdfParser.parseSiePdfBuffer(req.file.buffer);

    const existingStudents = await prisma.estudiante.findMany({
      where: { configId: cId }
    });

    const mergeResult = siePdfParser.matchAndMergeStudents(students, existingStudents);

    res.json({
      success: true,
      headerInfo,
      students,
      actions: mergeResult.results,
      stats: mergeResult.stats
    });
  } catch (error) {
    console.error('Error al analizar PDF SIE:', error);
    res.status(500).json({ error: `Error al procesar el documento PDF del SIE: ${error.message}` });
  }
});

// Confirmar importación de estudiantes desde la previsualización del SIE
app.post('/api/estudiantes/confirmar-importacion-sie', async (req, res) => {
  try {
    const { configId, items } = req.body;
    const cId = parseInt(configId);
    if (!cId || isNaN(cId)) {
      return res.status(400).json({ error: 'Falta el ID de curso válido (configId).' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos de estudiantes para importar.' });
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const item of items) {
      if (item.action === 'UPDATE' && item.existingId) {
        // Preservar exactamente el ID existente para mantener notas y asistencias intactas
        await prisma.estudiante.update({
          where: { id: item.existingId },
          data: {
            apellidos: String(item.data.apellidos || '').trim().toUpperCase(),
            nombres: String(item.data.nombres || '').trim().toUpperCase(),
            rude: String(item.data.rude || '').trim(),
            ci: String(item.data.ci || '').trim(),
            genero: String(item.data.genero || '').trim().toUpperCase(),
            fechaNacimiento: item.data.fechaNacimiento ? new Date(item.data.fechaNacimiento) : null,
            edad: item.data.edad ? parseInt(item.data.edad) : null,
            direccion: String(item.data.direccion || '').trim()
          }
        });
        updatedCount++;
      } else {
        // Crear nuevo estudiante asociado al curso
        await prisma.estudiante.create({
          data: {
            configId: cId,
            apellidos: String(item.data.apellidos || '').trim().toUpperCase(),
            nombres: String(item.data.nombres || '').trim().toUpperCase(),
            rude: String(item.data.rude || '').trim(),
            ci: String(item.data.ci || '').trim(),
            genero: String(item.data.genero || '').trim().toUpperCase(),
            fechaNacimiento: item.data.fechaNacimiento ? new Date(item.data.fechaNacimiento) : null,
            edad: item.data.edad ? parseInt(item.data.edad) : null,
            direccion: String(item.data.direccion || '').trim(),
            padreMadre: '',
            telefono: ''
          }
        });
        createdCount++;
      }
    }

    res.json({
      success: true,
      message: `¡Importación completada con éxito! Se procesaron ${updatedCount + createdCount} estudiantes (${updatedCount} actualizados, ${createdCount} agregados).`,
      updatedCount,
      createdCount
    });
  } catch (error) {
    console.error('Error al confirmar importación SIE:', error);
    res.status(500).json({ error: `Error al guardar los estudiantes: ${error.message}` });
  }
});

app.post('/api/estudiantes', async (req, res) => {
  try {
    const { configId, students } = req.body;
    const cId = parseInt(configId || req.body.configId);

    if (!cId || isNaN(cId)) {
      return res.status(400).json({ error: 'Falta el ID de curso válido (configId).' });
    }

    const configExists = await prisma.config.findUnique({ where: { id: cId } });
    if (!configExists) {
      return res.status(400).json({ error: `El curso con ID ${cId} no existe en la base de datos.` });
    }

    const studentsToProcess = Array.isArray(students) ? students : [req.body];
    
    if (studentsToProcess.length === 0 || (studentsToProcess.length === 1 && !studentsToProcess[0].apellidos && !studentsToProcess[0].students)) {
        return res.status(400).json({ error: 'No se enviaron datos de estudiantes válidos.' });
    }

    console.log(`[POST /api/estudiantes] Procesando ${studentsToProcess.length} registros para ConfigID: ${cId}`);

    const parseFlexibleDate = (dateStr) => {
      if (!dateStr || String(dateStr).trim() === '') return null;
      
      const s = String(dateStr).trim();
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s);
      
      const cleanStr = s.replace(/[-.]/g, '/');
      const parts = cleanStr.split('/');
      
      if (parts.length === 3) {
        let day, month, year;
        
        if (parts[0].length === 4) {
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
        } else {
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          year = parseInt(parts[2]);
          if (year < 100) year += (year > 50 ? 1900 : 2000);
        }

        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }

      const fallback = new Date(s);
      return isNaN(fallback.getTime()) ? null : fallback;
    };

    const results = await Promise.all(studentsToProcess.map(async (s) => {
      const apellidos = String(s.apellidos || '').trim().toUpperCase();
      const nombres = String(s.nombres || '').trim().toUpperCase();

      if (!apellidos) return null; 

      const birthDate = parseFlexibleDate(s.fechaNacimiento);
      
      let age = null;
      if (s.edad !== undefined && s.edad !== null && String(s.edad).trim() !== '') {
        const parsedAge = parseInt(s.edad);
        if (!isNaN(parsedAge)) age = parsedAge;
      }

      const cleanData = {
        rude: String(s.rude || ''),
        ci: String(s.ci || ''),
        apellidos,
        nombres,
        padreMadre: String(s.padreMadre || ''),
        telefono: String(s.telefono || ''),
        direccion: String(s.direccion || ''),
        edad: age,
        fechaNacimiento: birthDate,
        genero: String(s.genero || ''),
        configId: cId
      };

      try {
        const isUUID = /^[0-9a-fA-F-]{36}$/.test(s.id);

        if (isUUID) {
          const existing = await prisma.estudiante.findUnique({ where: { id: s.id } });
          if (existing) {
            return await prisma.estudiante.update({
              where: { id: s.id },
              data: cleanData
            });
          }
        }
        
        return await prisma.estudiante.create({
          data: cleanData
        });
      } catch (err) {
        console.error(`Error Prisma [${apellidos}]:`, err.message);
        throw new Error(`${apellidos}: ${err.message}`);
      }
    }));

    const filteredResults = results.filter(r => r !== null);
    res.json(filteredResults);

  } catch (error) {
    console.error('CRITICAL ERROR in POST /api/estudiantes:', error.message);
    res.status(400).json({ 
      error: `Error de validación: ${error.message}`
    });
  }
});

app.delete('/api/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.estudiante.delete({
      where: { id }
    });
    res.json({ message: 'Estudiante eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting student:', error.message);
    res.status(500).json({ error: 'Error al eliminar estudiante' });
  }
});

// ─── FECHAS DE ASISTENCIA (headers de la tabla) ────────────────────────────

app.get('/api/fechas-asistencia', async (req, res) => {
  try {
    const { configId, trimestre, month, year } = req.query;
    if (!configId) return res.json([]);

    let sql = `SELECT * FROM "FechaAsistencia" WHERE configId = ${parseInt(configId)}`;
    if (trimestre) sql += ` AND trimestre = ${parseInt(trimestre)}`;
    if (month !== undefined) sql += ` AND month = ${parseInt(month)}`;
    if (year) sql += ` AND year = ${parseInt(year)}`;
    sql += ` ORDER BY dia ASC`;

    const rows = await prisma.$queryRawUnsafe(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching fechas asistencia:', error.message);
    res.status(500).json({ error: 'Error al obtener fechas' });
  }
});

app.post('/api/fechas-asistencia', async (req, res) => {
  try {
    const { configId, trimestre, dia, etiqueta } = req.body;
    if (!configId || trimestre === undefined || !dia) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);
    const d   = parseInt(dia);
    const lbl = String(etiqueta || '');

    // Eliminar TODOS los registros previos para este (configId, trimestre, dia)
    // sin importar el month/year (limpia datos del enfoque anterior)
    await prisma.$executeRawUnsafe(
      `DELETE FROM "FechaAsistencia" WHERE configId=? AND trimestre=? AND dia=?`,
      cId, tri, d
    );

    if (lbl !== '') {
      // Insertar con valores virtuales fijos (month=0, year=2000)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "FechaAsistencia" (configId, trimestre, month, year, dia, etiqueta) VALUES (?,?,?,?,?,?)`,
        cId, tri, 0, 2000, d, lbl
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving fecha asistencia:', error.message);
    res.status(500).json({ error: 'Error al guardar fecha' });
  }
});

// Endpoint de migración masiva desde localStorage (recuperación)
app.post('/api/fechas-asistencia/bulk', async (req, res) => {
  try {
    const { items } = req.body; // array de { configId, trimestre, month, year, dia, etiqueta }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay items para migrar' });
    }

    let saved = 0;
    for (const item of items) {
      const cId = parseInt(item.configId);
      const tri = parseInt(item.trimestre);
      const m   = parseInt(item.month);
      const y   = parseInt(item.year);
      const d   = parseInt(item.dia);
      const lbl = String(item.etiqueta || '');
      if (!cId || !lbl) continue;

      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "FechaAsistencia" WHERE configId=? AND trimestre=? AND month=? AND year=? AND dia=?`,
        cId, tri, m, y, d
      );
      if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "FechaAsistencia" SET etiqueta=? WHERE id=?`,
          lbl, existing[0].id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "FechaAsistencia" (configId, trimestre, month, year, dia, etiqueta) VALUES (?,?,?,?,?,?)`,
          cId, tri, m, y, d, lbl
        );
      }
      saved++;
    }

    res.json({ ok: true, saved });
  } catch (error) {
    console.error('Error bulk fechas:', error.message);
    res.status(500).json({ error: 'Error en migración masiva' });
  }
});

// ─── ENCABEZADOS DE VALORACIÓN (headers de la tabla de notas) ───────────────

app.get('/api/grade-headers', async (req, res) => {
  try {
    const { configId, trimestre } = req.query;
    if (!configId) return res.json([]);

    let sql = `SELECT * FROM "GradeHeader" WHERE configId = ${parseInt(configId)}`;
    if (trimestre) sql += ` AND trimestre = ${parseInt(trimestre)}`;
    sql += ` ORDER BY campo ASC`;

    const rows = await prisma.$queryRawUnsafe(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching grade headers:', error.message);
    res.status(500).json({ error: 'Error al obtener encabezados' });
  }
});

app.post('/api/grade-headers', async (req, res) => {
  try {
    const { configId, trimestre, campo, etiqueta, fecha, sellosMax, rawSellos } = req.body;
    console.log('[grade-headers] POST received:', { configId, trimestre, campo, etiqueta, fecha, sellosMax, rawSellos: rawSellos ? '(JSON)' : '(none)' });
    if (!configId || trimestre === undefined || !campo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);
    const lbl = String(etiqueta || '');
    const sm  = parseInt(sellosMax) || 0;
    const rs  = String(rawSellos || '{}');
    let fch = String(fecha || '');
    if (fch.includes('T')) fch = fch.split('T')[0];

    // Asegurar que las columnas sellosMax y rawSellos existen en SQLite de forma transparente
    await prisma.$executeRawUnsafe(`ALTER TABLE "GradeHeader" ADD COLUMN "sellosMax" INTEGER DEFAULT 0`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "GradeHeader" ADD COLUMN "rawSellos" TEXT DEFAULT '{}'`).catch(() => {});

    if (lbl === '' && fch === '' && sm === 0 && rs === '{}') {
      await prisma.$queryRawUnsafe(
        `DELETE FROM "GradeHeader" WHERE configId=${cId} AND trimestre=${tri} AND campo='${campo}'`
      );
      return res.json({ message: 'Deleted' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "GradeHeader" WHERE configId=${cId} AND trimestre=${tri} AND campo='${campo}'`
    );

    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "GradeHeader" SET etiqueta=?, fecha=?, sellosMax=?, rawSellos=? WHERE id=?`,
        lbl, fch, sm, rs, existing[0].id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GradeHeader" (configId, trimestre, campo, etiqueta, fecha, sellosMax, rawSellos) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cId, tri, campo, lbl, fch, sm, rs
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving grade header:', error.message);
    res.status(500).json({ error: 'Error al guardar encabezado' });
  }
});

// Sincronizar estudiantes inasistentes a una evaluación hacia la Ficha de Seguimiento
app.post('/api/grade-headers/sync-rezagados', async (req, res) => {
  try {
    const { configId, trimestre, campo, etiqueta, fecha } = req.body;
    if (!configId || !trimestre || !campo || !fecha) {
      return res.status(400).json({ error: 'configId, trimestre, campo y fecha son requeridos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);
    const refKey = `eval-${cId}-${tri}-${campo}`;
    const evalTitle = etiqueta || campo.toUpperCase();

    // Parsear fecha (formato YYYY-MM-DD)
    const [yStr, mStr, dStr] = fecha.split('-');
    const year = parseInt(yStr);
    const month = parseInt(mStr) - 1; // 0-indexed
    const day = parseInt(dStr);
    const targetUtcDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

    // Obtener todos los estudiantes del curso
    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: cId },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }]
    });

    const estIds = estudiantes.map(e => e.id);

    // Obtener asistencias registradas para esa fecha específica
    const asistencias = await prisma.asistencia.findMany({
      where: {
        estudianteId: { in: estIds },
        fecha: targetUtcDate
      }
    });

    // Mapa de asistencia por estudianteId
    const asistenciaMap = new Map();
    asistencias.forEach(a => asistenciaMap.set(a.estudianteId, a.estado));

    // Obtener las notas del trimestre
    const notas = await prisma.nota.findMany({
      where: {
        estudianteId: { in: estIds },
        trimestre: tri
      }
    });
    const notasMap = new Map();
    notas.forEach(n => notasMap.set(n.estudianteId, n[campo] || 0));

    const creados = [];
    const now = new Date();
    const horaStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    for (const est of estudiantes) {
      const estadoAsistencia = asistenciaMap.get(est.id); // 'F', 'L', 'A', 'R' o undefined
      const notaVal = notasMap.get(est.id) || 0;

      // Un estudiante califica como inasistente a la evaluación si tiene Falta (F) o Licencia (L) en la fecha,
      // o si la nota está en 0 y se marcó falta de asistencia.
      const esAusente = estadoAsistencia === 'F' || estadoAsistencia === 'L';

      const existingFicha = await prisma.fichaSeguimiento.findFirst({
        where: { estudianteId: est.id, origenLunesRef: `${refKey}-${est.id}` }
      });

      if (esAusente) {
        const anotacionesClave = `Evaluación Pendiente / Inasistencia: ${evalTitle} (${campo.toUpperCase()})`;
        const redaccionDetallada = `El/La estudiante ${est.apellidos} ${est.nombres} no rindió la evaluación '${evalTitle}' (${campo.toUpperCase()}) programada para la fecha ${dStr}/${mStr}/${yStr} debido a inasistencia a clase (${estadoAsistencia === 'L' ? 'Licencia Justificada' : 'Falta Injustificada'}). Registro pendiente de evaluación de recuperación.`;

        const data = {
          estudianteId: est.id,
          configId: cId,
          trimestre: tri,
          fecha: new Date(year, month, day),
          hora: horaStr,
          anotacionesClave,
          redaccionDetallada,
          categoria: 'Evaluación Pendiente / Inasistencia',
          origenLunesRef: `${refKey}-${est.id}`
        };

        if (existingFicha) {
          const updated = await prisma.fichaSeguimiento.update({
            where: { id: existingFicha.id },
            data
          });
          creados.push(updated);
        } else {
          const created = await prisma.fichaSeguimiento.create({ data });
          creados.push(created);
        }
      } else {
        // Si ya no está ausente (ej. rindió y se le asignó asistencia u otra condición), remover registro previo si existe
        if (existingFicha) {
          await prisma.fichaSeguimiento.delete({ where: { id: existingFicha.id } });
        }
      }
    }

    console.log(`[sync-rezagados] Sincronizados ${creados.length} registros para ${campo} (${fecha})`);
    res.json({ ok: true, count: creados.length, creados });
  } catch (error) {
    console.error('Error en sync-rezagados:', error.message);
    res.status(500).json({ error: 'Error al sincronizar rezagados: ' + error.message });
  }
});

// Migración masiva de encabezados (desde localStorage)
app.post('/api/grade-headers/bulk', async (req, res) => {
  try {
    const { items } = req.body; // [{ configId, trimestre, campo, etiqueta }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay items para migrar' });
    }

    let saved = 0;
    for (const item of items) {
      const cId = parseInt(item.configId);
      const tri = parseInt(item.trimestre);
      const campo = String(item.campo || '');
      const lbl = String(item.etiqueta || '');
      if (!cId || !campo || !lbl) continue;

      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "GradeHeader" WHERE configId=? AND trimestre=? AND campo=?`,
        cId, tri, campo
      );
      if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "GradeHeader" SET etiqueta=? WHERE id=?`,
          lbl, existing[0].id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "GradeHeader" (configId, trimestre, campo, etiqueta) VALUES (?,?,?,?)`,
          cId, tri, campo, lbl
        );
      }
      saved++;
    }

    res.json({ ok: true, saved });
  } catch (error) {
    console.error('Error bulk grade headers:', error.message);
    res.status(500).json({ error: 'Error en migración masiva de encabezados' });
  }
});

// ─── REPOSITORIO DE ARCHIVOS (CENTRALIZADOR CALIFICACIONES) ───────────────

app.get('/api/repositorio/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe(`SELECT path, originalName FROM "RepositorioArchivo" WHERE id = '${id}'`);
    if (rows.length > 0) {
      const file = rows[0];
      if (fs.existsSync(file.path)) {
        return res.download(file.path, file.originalName, (err) => {
          if (err) {
            console.error('Express download error:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Error interno al enviar el archivo', details: err.message });
            }
          }
        });
      }
    }
    if (!res.headersSent) {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('Error downloading file:', error.message, error.stack);
    res.status(500).json({ error: 'Error al descargar archivo', details: error.message, stack: error.stack });
  }
});

app.get('/api/repositorio/:configId/:trimestre', async (req, res) => {
  try {
    const { configId, trimestre } = req.params;
    if (!configId) return res.json([]);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM "RepositorioArchivo" 
      WHERE configId = ${parseInt(configId)} AND trimestre = ${parseInt(trimestre)}
      ORDER BY createdAt DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching repositorio:', error.message);
    res.status(500).json({ error: 'Error al obtener archivos' });
  }
});

app.post('/api/repositorio/upload', upload.single('file'), async (req, res) => {
  try {
    const { configId, trimestre } = req.body;
    if (!req.file || !configId || !trimestre) {
      return res.status(400).json({ error: 'Faltan campos requeridos o archivo' });
    }

    const { originalname, filename, mimetype, size, path: filePath } = req.file;

    const uuid = require('crypto').randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RepositorioArchivo" (id, configId, trimestre, originalName, fileName, mimeType, size, path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uuid, parseInt(configId), parseInt(trimestre), originalname, filename, mimetype, size, filePath
    );
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

app.delete('/api/repositorio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await prisma.$queryRawUnsafe(`SELECT path FROM "RepositorioArchivo" WHERE id = '${id}'`);
    if (rows.length > 0) {
      const filePath = rows[0].path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "RepositorioArchivo" WHERE id = '${id}'`);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting file:', error.message);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});


// ─── CENTRALIZADOR GENERAL (Importación HTML multi-área) ────────────────────

app.get('/api/centralizador-general', async (req, res) => {
  try {
    const { configId, trimestre } = req.query;
    if (!configId || !trimestre) return res.json([]);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "CentralizadorGeneral" WHERE configId = ? AND trimestre = ? ORDER BY estudiante ASC, materia ASC`,
      parseInt(configId), parseInt(trimestre)
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching centralizador general:', error.message);
    res.status(500).json({ error: 'Error al obtener datos del centralizador general' });
  }
});

app.post('/api/centralizador-general', async (req, res) => {
  try {
    const { configId, trimestre, data } = req.body;
    if (!configId || !trimestre || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Faltan campos requeridos o datos vacíos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);

    // Borrar datos previos de este configId + trimestre (sobreescritura limpia)
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CentralizadorGeneral" WHERE configId = ? AND trimestre = ?`,
      cId, tri
    );

    // Insertar todos los registros
    let inserted = 0;
    for (const student of data) {
      const nombre = String(student.estudiante || '').trim().toUpperCase();
      const promedio = parseFloat(student.promedio) || 0;
      if (!nombre) continue;

      for (const [materia, nota] of Object.entries(student.materias || {})) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "CentralizadorGeneral" (configId, trimestre, estudiante, materia, nota, promedio) VALUES (?, ?, ?, ?, ?, ?)`,
          cId, tri, nombre, materia, parseFloat(nota) || 0, promedio
        );
        inserted++;
      }
    }

    console.log(`[centralizador-general] Importados ${inserted} registros para configId=${cId}, trimestre=${tri}`);
    res.json({ ok: true, inserted, students: data.length });
  } catch (error) {
    console.error('Error saving centralizador general:', error.message);
    res.status(500).json({ error: 'Error al guardar datos del centralizador general' });
  }
});

app.delete('/api/centralizador-general', async (req, res) => {
  try {
    const { configId, trimestre } = req.query;
    if (!configId || !trimestre) {
      return res.status(400).json({ error: 'Faltan configId o trimestre' });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "CentralizadorGeneral" WHERE configId = ? AND trimestre = ?`,
      parseInt(configId), parseInt(trimestre)
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting centralizador general:', error.message);
    res.status(500).json({ error: 'Error al eliminar datos del centralizador general' });
  }
});

// ────────────────────────────────────────────────────────────────────────────

app.get('/api/asistencia', async (req, res) => {
  try {
    const { configId } = req.query;
    if (!configId) return res.json([]);

    const parsedConfigId = parseInt(configId);
    if (isNaN(parsedConfigId)) {
      return res.status(400).json({ error: 'ID de configuración inválido' });
    }

    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: parsedConfigId },
      select: { id: true }
    });
    const estIds = estudiantes.map(e => e.id);

    const asistencia = await prisma.asistencia.findMany({
      where: { estudianteId: { in: estIds } }
    });

    res.json(asistencia);
  } catch (error) {
    console.error('Error fetching attendance:', error.message);
    res.status(500).json({ error: 'Error al obtener asistencia' });
  }
});

app.post('/api/asistencia', async (req, res) => {
  try {
    const validation = asistenciaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Datos de asistencia inválidos' });
    }

    const { estudianteId, year, month, day, estado, trimestre } = req.body;
    
    const fecha = new Date(Date.UTC(year, month, day, 12, 0, 0));

    const existing = await prisma.asistencia.findFirst({
      where: {
        estudianteId,
        fecha,
        trimestre
      }
    });

    if (estado === '' || estado === null) {
      if (existing) {
        await prisma.asistencia.delete({ where: { id: existing.id } });
      }
      return res.json({ message: 'Deleted' });
    }

    if (existing) {
      const updated = await prisma.asistencia.update({
        where: { id: existing.id },
        data: { estado, trimestre }
      });
      return res.json(updated);
    } else {
      const created = await prisma.asistencia.create({
        data: {
          estudianteId,
          fecha,
          estado,
          trimestre
        }
      });
      return res.json(created);
    }
  } catch (error) {
    console.error('Error saving attendance:', error.message);
    res.status(500).json({ error: 'Error al guardar asistencia' });
  }
});

// ─── ASISTENCIA LUNES (Formaciones de Inicio de Semana) ────────────────────

app.get('/api/fechas-asistencia-lunes', async (req, res) => {
  try {
    const { configId, trimestre } = req.query;
    if (!configId) return res.json([]);

    let sql = `SELECT * FROM "FechaAsistencia" WHERE configId = ${parseInt(configId)} AND tipo = 'LUNES'`;
    if (trimestre) sql += ` AND trimestre = ${parseInt(trimestre)}`;
    sql += ` ORDER BY dia ASC`;

    const rows = await prisma.$queryRawUnsafe(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching fechas asistencia lunes:', error.message);
    res.status(500).json({ error: 'Error al obtener fechas de lunes' });
  }
});

app.post('/api/fechas-asistencia-lunes', async (req, res) => {
  try {
    const { configId, trimestre, dia, etiqueta } = req.body;
    if (!configId || trimestre === undefined || !dia) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);
    const d   = parseInt(dia);
    const lbl = String(etiqueta || '');

    await prisma.$executeRawUnsafe(
      `DELETE FROM "FechaAsistencia" WHERE configId=? AND trimestre=? AND dia=? AND tipo='LUNES'`,
      cId, tri, d
    );

    if (lbl !== '') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "FechaAsistencia" (configId, trimestre, month, year, dia, etiqueta, tipo) VALUES (?,?,?,?,?,?,?)`,
        cId, tri, 0, 2000, d, lbl, 'LUNES'
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving fecha asistencia lunes:', error.message);
    res.status(500).json({ error: 'Error al guardar fecha de lunes' });
  }
});

app.get('/api/asistencia-lunes', async (req, res) => {
  try {
    const { configId } = req.query;
    if (!configId) return res.json([]);

    const parsedConfigId = parseInt(configId);
    if (isNaN(parsedConfigId)) {
      return res.status(400).json({ error: 'ID de configuración inválido' });
    }

    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: parsedConfigId },
      select: { id: true }
    });
    const estIds = estudiantes.map(e => e.id);

    // Asistencia de lunes
    const asistenciaLunes = await prisma.asistencia.findMany({
      where: { estudianteId: { in: estIds }, tipo: 'LUNES' }
    });

    // Asistencia normal para heredar licencias (L)
    const asistenciaNormal = await prisma.asistencia.findMany({
      where: { estudianteId: { in: estIds }, tipo: 'NORMAL', estado: 'L' }
    });

    // Mapear licencias normales por `${estudianteId}-${trimestre}-${dia}`
    const normalLicencias = new Set();
    asistenciaNormal.forEach(att => {
      const dia = new Date(att.fecha).getUTCDate();
      normalLicencias.add(`${att.estudianteId}-${att.trimestre}-${dia}`);
    });

    const dataMap = new Map();
    asistenciaLunes.forEach(att => {
      const dia = new Date(att.fecha).getUTCDate();
      const key = `${att.estudianteId}-${att.trimestre}-${dia}`;
      dataMap.set(key, att);
    });

    // Si hay una licencia normal pero no un registro de lunes explícito, reflejar Licencia (L)
    normalLicencias.forEach(key => {
      const [estId, tri, dia] = key.split('-');
      const existingLunes = dataMap.get(key);
      if (!existingLunes) {
        dataMap.set(key, {
          id: `inherited-license-${key}`,
          estudianteId: estId,
          trimestre: parseInt(tri),
          fecha: new Date(Date.UTC(2026, 0, parseInt(dia), 12, 0, 0)),
          estado: 'L',
          tipo: 'LUNES',
          heredado: true
        });
      } else if (existingLunes.estado !== 'L') {
        existingLunes.estado = 'L';
        existingLunes.heredado = true;
      }
    });

    res.json(Array.from(dataMap.values()));
  } catch (error) {
    console.error('Error fetching Monday attendance:', error.message);
    res.status(500).json({ error: 'Error al obtener asistencia de lunes' });
  }
});

app.post('/api/asistencia-lunes', async (req, res) => {
  try {
    const { estudianteId, year, month, day, estado, trimestre, etiquetaFecha } = req.body;
    if (!estudianteId || !year || month === undefined || !day || !trimestre) {
      return res.status(400).json({ error: 'Datos incompletos para asistencia de lunes' });
    }

    const fecha = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const refKey = `${estudianteId}-${trimestre}-${day}`;

    // Buscar si existe asistencia lunes previa
    const existing = await prisma.asistencia.findFirst({
      where: { estudianteId, fecha, trimestre, tipo: 'LUNES' }
    });

    let result;
    if (estado === '' || estado === null) {
      if (existing) {
        await prisma.asistencia.delete({ where: { id: existing.id } });
      }
      result = { message: 'Deleted' };
    } else if (existing) {
      result = await prisma.asistencia.update({
        where: { id: existing.id },
        data: { estado, trimestre, tipo: 'LUNES' }
      });
    } else {
      result = await prisma.asistencia.create({
        data: { estudianteId, fecha, estado, trimestre, tipo: 'LUNES' }
      });
    }

    // ── Sincronización automática con FichaSeguimiento (Historial Permanente) ──
    const estudiante = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      select: { id: true, configId: true, apellidos: true, nombres: true }
    });

    if (estudiante) {
      const existingFicha = await prisma.fichaSeguimiento.findFirst({
        where: { estudianteId, origenLunesRef: refKey }
      });

      if (estado === 'F') {
        const now = new Date();
        const fechaLabel = etiquetaFecha || `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
        const horaStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const anotacionData = {
          estudianteId,
          configId: estudiante.configId,
          trimestre: parseInt(trimestre),
          fecha: now,
          hora: horaStr,
          anotacionesClave: `Inasistencia a Formación de Inicio de Semana (Lunes) — Col. ${day} (${fechaLabel})`,
          redaccionDetallada: `El/la estudiante ${estudiante.apellidos} ${estudiante.nombres} registró inasistencia a la formación de inicio de semana correspondiente a la columna ${day} (${fechaLabel}) a horas ${horaStr}.`,
          categoria: 'Formación de Lunes',
          origenLunesRef: refKey
        };

        if (existingFicha) {
          await prisma.fichaSeguimiento.update({
            where: { id: existingFicha.id },
            data: anotacionData
          });
        } else {
          await prisma.fichaSeguimiento.create({
            data: anotacionData
          });
        }
      } else {
        if (existingFicha) {
          await prisma.fichaSeguimiento.delete({
            where: { id: existingFicha.id }
          });
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error saving Monday attendance:', error.message);
    res.status(500).json({ error: 'Error al guardar asistencia de lunes' });
  }
});

app.get('/api/notas', async (req, res) => {
  try {
    const { configId, trimestre } = req.query;
    console.log(`[GET /api/notas] configId=${configId}, trimestre=${trimestre}`);
    if (!configId) return res.json([]);

    const parsedConfigId = parseInt(configId);
    if (isNaN(parsedConfigId)) {
      return res.status(400).json({ error: 'ID de configuración inválido' });
    }

    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: parsedConfigId },
      select: { id: true }
    });
    const estIds = estudiantes.map(e => e.id);
    console.log(`[GET /api/notas] estudiantes encontrados: ${estIds.length}, IDs: ${estIds.map(id => id.substring(0,8)).join(', ')}`);

    const whereClause = { estudianteId: { in: estIds } };
    if (trimestre) {
      whereClause.trimestre = parseInt(trimestre);
    }

    const notas = await prisma.nota.findMany({
      where: whereClause
    });

    // Eliminar duplicados de la BD y quedarse con solo 1 nota por estudiante/trimestre
    const uniqueNotas = [];
    const seen = new Map(); // key -> { nota, id }
    for (const nota of notas) {
      const key = `${nota.estudianteId}-${nota.trimestre}`;
      if (!seen.has(key)) {
        seen.set(key, nota);
        uniqueNotas.push(nota);
      } else {
        // Eliminar el duplicado de la BD
        await prisma.nota.delete({ where: { id: nota.id } });
        console.log(`[GET /api/notas] Eliminado duplicado: id=${nota.id.substring(0,8)}, estudianteId=${nota.estudianteId.substring(0,8)}`);
      }
    }
    console.log(`[GET /api/notas] notas después de limpiar duplicados: ${uniqueNotas.length}`);

    res.json(uniqueNotas);
  } catch (error) {
    console.error('Error fetching grades:', error.message);
    res.status(500).json({ error: 'Error al obtener notas' });
  }
});

app.post('/api/notas', async (req, res) => {
  try {
    console.log(`[POST /api/notas] Body recibido:`, { estudianteId: req.body.estudianteId?.substring(0,8), trimestre: req.body.trimestre, saber_1: req.body.saber_1 });
    const validation = notaSchema.safeParse(req.body);
    if (!validation.success) {
      console.log(`[POST /api/notas] Validation failed:`, validation.error.errors);
      return res.status(400).json({ error: 'Datos de notas inválidos', details: validation.error.errors });
    }

      const { 
        estudianteId, trimestre,
        ser_1, ser_2, ser_3, ser_4, ser_5, ser_6,
        saber_1, saber_2, saber_3, saber_4, saber_5, saber_6, saber_7, saber_8,
        hacer_1, hacer_2, hacer_3, hacer_4, hacer_5, hacer_6, hacer_7,
        auto_ser, auto_decidir, notas_extras, rezagados
      } = req.body;

      console.log(`[POST /api/notas] estudianteId=${estudianteId?.substring(0,8)}, trimestre=${trimestre}`);

      const existing = await prisma.nota.findFirst({
        where: { estudianteId, trimestre: parseInt(trimestre) }
      });
      console.log(`[POST /api/notas] existing:`, existing ? { id: existing.id.substring(0,8), saber_1: existing.saber_1 } : 'null');
      
      if (existing) {
        // Mezclar: usar valores existentes como fallback si el request envía 0
        const data = {
          trimestre: parseInt(trimestre),
          ser_1: ser_1 !== undefined ? parseFloat(ser_1) : (existing.ser_1 || 0),
          ser_2: ser_2 !== undefined ? parseFloat(ser_2) : (existing.ser_2 || 0),
          ser_3: ser_3 !== undefined ? parseFloat(ser_3) : (existing.ser_3 || 0),
          ser_4: ser_4 !== undefined ? parseFloat(ser_4) : (existing.ser_4 || 0),
          ser_5: ser_5 !== undefined ? parseFloat(ser_5) : (existing.ser_5 || 0),
          ser_6: ser_6 !== undefined ? parseFloat(ser_6) : (existing.ser_6 || 0),
          saber_1: saber_1 !== undefined ? parseFloat(saber_1) : (existing.saber_1 || 0),
          saber_2: saber_2 !== undefined ? parseFloat(saber_2) : (existing.saber_2 || 0),
          saber_3: saber_3 !== undefined ? parseFloat(saber_3) : (existing.saber_3 || 0),
          saber_4: saber_4 !== undefined ? parseFloat(saber_4) : (existing.saber_4 || 0),
          saber_5: saber_5 !== undefined ? parseFloat(saber_5) : (existing.saber_5 || 0),
          saber_6: saber_6 !== undefined ? parseFloat(saber_6) : (existing.saber_6 || 0),
          saber_7: saber_7 !== undefined ? parseFloat(saber_7) : (existing.saber_7 || 0),
          saber_8: saber_8 !== undefined ? parseFloat(saber_8) : (existing.saber_8 || 0),
          hacer_1: hacer_1 !== undefined ? parseFloat(hacer_1) : (existing.hacer_1 || 0),
          hacer_2: hacer_2 !== undefined ? parseFloat(hacer_2) : (existing.hacer_2 || 0),
          hacer_3: hacer_3 !== undefined ? parseFloat(hacer_3) : (existing.hacer_3 || 0),
          hacer_4: hacer_4 !== undefined ? parseFloat(hacer_4) : (existing.hacer_4 || 0),
          hacer_5: hacer_5 !== undefined ? parseFloat(hacer_5) : (existing.hacer_5 || 0),
          hacer_6: hacer_6 !== undefined ? parseFloat(hacer_6) : (existing.hacer_6 || 0),
          hacer_7: hacer_7 !== undefined ? parseFloat(hacer_7) : (existing.hacer_7 || 0),
          auto_ser: auto_ser !== undefined ? parseFloat(auto_ser) : (existing.auto_ser || 0),
          auto_decidir: auto_decidir !== undefined ? parseFloat(auto_decidir) : (existing.auto_decidir || 0),
          notas_extras: notas_extras !== undefined ? parseFloat(notas_extras) : (existing.notas_extras || 0),
          notaTrimestre: req.body.notaTrimestre !== undefined ? Math.round(parseFloat(req.body.notaTrimestre)) : (existing.notaTrimestre || 0),
          rezagados: rezagados !== undefined ? rezagados : (existing.rezagados || "{}")
        };
        const updated = await prisma.nota.update({
          where: { id: existing.id },
          data
        });
        console.log(`[POST /api/notas] FINAL - guardado:`, { id: updated.id.substring(0,8), estudianteId: updated.estudianteId.substring(0,8), saber_1: updated.saber_1, saber_2: updated.saber_2, saber_3: updated.saber_3, saber_4: updated.saber_4 });
        return res.json(updated);
      } else {
        const data = {
          trimestre: parseInt(trimestre),
          ser_1: parseFloat(ser_1) || 0,
          ser_2: parseFloat(ser_2) || 0,
          ser_3: parseFloat(ser_3) || 0,
          ser_4: parseFloat(ser_4) || 0,
          ser_5: parseFloat(ser_5) || 0,
          ser_6: parseFloat(ser_6) || 0,
          saber_1: parseFloat(saber_1) || 0,
          saber_2: parseFloat(saber_2) || 0,
          saber_3: parseFloat(saber_3) || 0,
          saber_4: parseFloat(saber_4) || 0,
          saber_5: parseFloat(saber_5) || 0,
          saber_6: parseFloat(saber_6) || 0,
          saber_7: parseFloat(saber_7) || 0,
          saber_8: parseFloat(saber_8) || 0,
          hacer_1: parseFloat(hacer_1) || 0,
          hacer_2: parseFloat(hacer_2) || 0,
          hacer_3: parseFloat(hacer_3) || 0,
          hacer_4: parseFloat(hacer_4) || 0,
          hacer_5: parseFloat(hacer_5) || 0,
          hacer_6: parseFloat(hacer_6) || 0,
          auto_ser: parseFloat(auto_ser) || 0,
          auto_decidir: parseFloat(auto_decidir) || 0,
          notas_extras: parseFloat(notas_extras) || 0,
          notaTrimestre: req.body.notaTrimestre !== undefined ? Math.round(parseFloat(req.body.notaTrimestre)) : 0,
          rezagados: rezagados || "{}"
        };
      const created = await prisma.nota.create({
        data: {
          estudianteId,
          ...data
        }
      });
      console.log(`[POST /api/notas] Guardado (create):`, { id: created.id.substring(0,8), estudianteId: created.estudianteId.substring(0,8), saber_1: created.saber_1, saber_2: created.saber_2 });
      return res.json(created);
    }
  } catch (error) {
    console.error('Error saving grade:', error.message);
    res.status(500).json({ error: 'Error al guardar nota' });
  }
});

// ─── SINCRONIZAR ASISTENCIA → NOTAS (ser_1 y ser_2) ─────────────────────────
// Calcula automáticamente las columnas Asistencia (ser_1) y Puntualidad (ser_2)
// de forma proporcional al total de sesiones registradas en el trimestre.
// Fórmula: nota = max(0, 10 - (faltas_o_retrasos × (10 / N)))
// donde N = total de fechas (etiquetas) registradas en FechaAsistencia para ese curso/trimestre.
app.post('/api/notas/sync-asistencia', async (req, res) => {
  try {
    const { configId, trimestre } = req.body;

    if (!configId || !trimestre) {
      return res.status(400).json({ error: 'configId y trimestre son requeridos' });
    }

    const cId = parseInt(configId);
    const tri = parseInt(trimestre);

    if (isNaN(cId) || isNaN(tri)) {
      return res.status(400).json({ error: 'configId y trimestre deben ser números válidos' });
    }

    // 1. Contar N = total de sesiones registradas para este curso/trimestre
    const fechas = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM "FechaAsistencia" WHERE configId = ? AND trimestre = ? AND etiqueta != ''`,
      cId, tri
    );
    const N = Number(fechas[0]?.total ?? 0);

    if (N === 0) {
      return res.status(400).json({
        error: 'No hay fechas de asistencia registradas para este trimestre. Registre al menos una fecha en la hoja de Control de Asistencia.'
      });
    }

    const valorPorEvento = 10 / N; // puntos que vale cada falta o retraso

    // 2. Obtener todos los estudiantes del curso
    const estudiantes = await prisma.estudiante.findMany({
      where: { configId: cId },
      select: { id: true }
    });

    if (estudiantes.length === 0) {
      return res.status(400).json({ error: 'No hay estudiantes registrados en este curso.' });
    }

    const estIds = estudiantes.map(e => e.id);
    const resultados = [];

    // 3. Para cada estudiante: contar F (faltas) y R (retrasos) en el trimestre
    for (const est of estudiantes) {
      const registros = await prisma.asistencia.findMany({
        where: {
          estudianteId: est.id,
          trimestre: tri
        },
        select: { estado: true }
      });

      const faltas    = registros.filter(r => r.estado === 'F').length;
      const retrasos  = registros.filter(r => r.estado === 'R').length;

      // Fórmula proporcional — mínimo 0, máximo 10, siempre número entero
      const ser1 = Math.max(0, Math.round(10 - faltas   * valorPorEvento));
      const ser2 = Math.max(0, Math.round(10 - retrasos * valorPorEvento));

      // 4. Upsert en Nota — solo modificar ser_1 y ser_2, respetar el resto de campos
      const existing = await prisma.nota.findFirst({
        where: { estudianteId: est.id, trimestre: tri }
      });

      if (existing) {
        // Recalcular notaTrimestre con los nuevos valores de SER
        const promSer = ser1; // ser_1 es la nota representativa de SER en este contexto
        // Mantenemos el promedio SER con todos sus subcampos actualizados proporcionalmente:
        // solo tocamos ser_1 y ser_2; el resto de subcampos SER no se alteran.
        const newSer1 = ser1;
        const newSer2 = ser2;

        // Recalcular notaTrimestre correctamente (promedio de los 6 subcampos SER que tengan valor > 0)
        const serFields = [newSer1, newSer2, existing.ser_3, existing.ser_4, existing.ser_5, existing.ser_6].filter(v => v > 0);
        const newPromSer = serFields.length > 0 ? Math.round(serFields.reduce((a, b) => a + b, 0) / serFields.length) : 0;

        const sabFields = [existing.saber_1, existing.saber_2, existing.saber_3, existing.saber_4,
                           existing.saber_5, existing.saber_6, existing.saber_7, existing.saber_8].filter(v => v > 0);
        const newPromSab = sabFields.length > 0 ? Math.round(sabFields.reduce((a, b) => a + b, 0) / sabFields.length) : 0;

        const hacFields = [existing.hacer_1, existing.hacer_2, existing.hacer_3, existing.hacer_4,
                           existing.hacer_5, existing.hacer_6, existing.hacer_7].filter(v => v > 0);
        const newPromHac = hacFields.length > 0 ? Math.round(hacFields.reduce((a, b) => a + b, 0) / hacFields.length) : 0;

        const newNotaTrimestre = Math.min(100, Math.round(newPromSer + newPromSab + newPromHac + (existing.auto_ser || 0) + (existing.notas_extras || 0)));

        const updated = await prisma.nota.update({
          where: { id: existing.id },
          data: {
            ser_1: newSer1,
            ser_2: newSer2,
            notaTrimestre: newNotaTrimestre
          }
        });
        resultados.push({ estudianteId: est.id, ser_1: updated.ser_1, ser_2: updated.ser_2, action: 'updated' });
      } else {
        // Crear nota nueva con solo ser_1 y ser_2 calculados; el resto en 0
        const created = await prisma.nota.create({
          data: {
            estudianteId: est.id,
            trimestre: tri,
            ser_1: ser1,
            ser_2: ser2,
            ser_3: 0, ser_4: 0, ser_5: 0, ser_6: 0,
            saber_1: 0, saber_2: 0, saber_3: 0, saber_4: 0,
            saber_5: 0, saber_6: 0, saber_7: 0, saber_8: 0,
            hacer_1: 0, hacer_2: 0, hacer_3: 0, hacer_4: 0,
            hacer_5: 0, hacer_6: 0, hacer_7: 0,
            auto_ser: 0, auto_decidir: 0, notas_extras: 0,
            notaTrimestre: 0
          }
        });
        resultados.push({ estudianteId: est.id, ser_1: created.ser_1, ser_2: created.ser_2, action: 'created' });
      }
    }

    console.log(`[sync-asistencia] N=${N}, valorPorEvento=${valorPorEvento.toFixed(4)}, procesados=${resultados.length}`);

    res.json({
      ok: true,
      sesiones: N,
      valorPorFalta: parseFloat(valorPorEvento.toFixed(4)),
      procesados: resultados.length,
      resultados
    });

  } catch (error) {
    console.error('[sync-asistencia] Error:', error.message);
    res.status(500).json({ error: 'Error al sincronizar asistencia: ' + error.message });
  }
});

app.put('/api/estudiantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rude, ci, apellidos, nombres, padreMadre, telefono, direccion, edad, fechaNacimiento, genero } = req.body;

    const estudiante = await prisma.estudiante.update({
      where: { id },
      data: {
        rude: rude || '',
        ci: ci || '',
        apellidos: apellidos || '',
        nombres: nombres || '',
        padreMadre: padreMadre || '',
        telefono: telefono || '',
        direccion: direccion || '',
        edad: edad ? parseInt(edad) : null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        genero: genero || '',
      },
    });
    res.json(estudiante);
  } catch (error) {
    console.error('Error updating student:', error.message);
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});


// ─── FICHA DE SEGUIMIENTO PEDAGÓGICO ──────────────────────────────────────────

app.get('/api/seguimiento', async (req, res) => {
  try {
    const { estudianteId, configId, trimestre } = req.query;
    const where = {};
    if (estudianteId) where.estudianteId = estudianteId;
    if (configId) where.configId = parseInt(configId);
    if (trimestre) where.trimestre = parseInt(trimestre);

    const fichas = await prisma.fichaSeguimiento.findMany({
      where,
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        estudiante: true,
        config: true,
      }
    });
    res.json(fichas);
  } catch (error) {
    console.error('Error fetching fichas seguimiento:', error.message);
    res.status(500).json({ error: 'Error al obtener fichas de seguimiento' });
  }
});

app.post('/api/seguimiento', async (req, res) => {
  try {
    const {
      id,
      estudianteId,
      configId,
      trimestre,
      fecha,
      hora,
      anotacionesClave,
      redaccionDetallada,
      categoria,
      inasistenciasAcum,
      atrasosAcum,
      licenciasAcum
    } = req.body;

    if (!estudianteId || !configId || !trimestre) {
      return res.status(400).json({ error: 'Campos estudianteId, configId y trimestre son requeridos' });
    }

    const now = new Date();
    const timeStr = hora || now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const data = {
      estudianteId,
      configId: parseInt(configId),
      trimestre: parseInt(trimestre),
      fecha: fecha ? new Date(fecha) : now,
      hora: timeStr,
      anotacionesClave: String(anotacionesClave || '').trim(),
      redaccionDetallada: String(redaccionDetallada || '').trim(),
      categoria: categoria || 'Aprovechamiento/Conducta',
      inasistenciasAcum: parseInt(inasistenciasAcum || 0),
      atrasosAcum: parseInt(atrasosAcum || 0),
      licenciasAcum: parseInt(licenciasAcum || 0)
    };

    let result;
    if (id) {
      result = await prisma.fichaSeguimiento.update({
        where: { id },
        data
      });
    } else {
      result = await prisma.fichaSeguimiento.create({
        data
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error saving ficha seguimiento:', error.message);
    res.status(500).json({ error: 'Error al guardar ficha de seguimiento' });
  }
});

app.post('/api/seguimiento/batch', async (req, res) => {
  try {
    const {
      estudianteIds,
      configId,
      trimestre,
      anotacionesClave,
      redaccionDetallada,
      categoria,
      statsMap // opcional: { [estudianteId]: { F, R, L } }
    } = req.body;

    if (!Array.isArray(estudianteIds) || estudianteIds.length === 0 || !configId || !trimestre) {
      return res.status(400).json({ error: 'Campos estudianteIds (array), configId y trimestre son requeridos' });
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cId = parseInt(configId);
    const tri = parseInt(trimestre);

    const createdRecords = [];

    for (const estId of estudianteIds) {
      const stats = (statsMap && statsMap[estId]) || { A: 0, F: 0, R: 0, L: 0 };
      const student = await prisma.estudiante.findUnique({ where: { id: estId }, select: { apellidos: true, nombres: true } });
      const studentName = student ? `${student.apellidos} ${student.nombres}`.trim() : 'Estudiante';

      let studentRedaccion = String(redaccionDetallada || '').trim();
      if (studentRedaccion) {
        studentRedaccion = studentRedaccion.replace(/Estudiante:\s*ESTUDIANTE/gi, `Estudiante: ${studentName}`);
        const fCount = parseInt(stats.F || 0);
        const rCount = parseInt(stats.R || 0);
        const lCount = parseInt(stats.L || 0);
        const aCount = parseInt(stats.A || 0);

        const secIII = `III. REGISTRO ACUMULADO DE ASISTENCIA (TRIMESTRE ACTIVO)\n- Asistencias (A): ${aCount} días\n- Faltas Injustificadas (F): ${fCount} días\n- Atrasos / Retrasos (R): ${rCount} incidencias\n- Licencias Justificadas (L): ${lCount} días`;
        const reg = /III\.\s*REGISTRO ACUMULADO DE ASISTENCIA[\s\S]*?(?=(?:IV\.|1\.|2\.|3\.|\n\n[IVX]+\.|$))/i;
        if (reg.test(studentRedaccion)) {
          studentRedaccion = studentRedaccion.replace(reg, `${secIII}\n\n`);
        }
      }

      const created = await prisma.fichaSeguimiento.create({
        data: {
          estudianteId: estId,
          configId: cId,
          trimestre: tri,
          fecha: now,
          hora: timeStr,
          anotacionesClave: String(anotacionesClave || '').trim(),
          redaccionDetallada: studentRedaccion,
          categoria: categoria || 'Aprovechamiento/Conducta',
          inasistenciasAcum: parseInt(stats.F || 0),
          atrasosAcum: parseInt(stats.R || 0),
          licenciasAcum: parseInt(stats.L || 0)
        }
      });
      createdRecords.push(created);
    }

    console.log(`[POST /api/seguimiento/batch] Creadas ${createdRecords.length} fichas de seguimiento masivas.`);
    res.json({ ok: true, count: createdRecords.length, records: createdRecords });
  } catch (error) {
    console.error('Error batch saving ficha seguimiento:', error.message);
    res.status(500).json({ error: 'Error al guardar fichas masivas de seguimiento: ' + error.message });
  }
});

app.delete('/api/seguimiento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.fichaSeguimiento.delete({
      where: { id }
    });
    res.json({ message: 'Ficha eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting ficha seguimiento:', error.message);
    res.status(500).json({ error: 'Error al eliminar ficha de seguimiento' });
  }
});

// ─── AGENDA / HORARIO RECURSOS Y NOTAS PERSISTENTES ──────────────────────────

const DEFAULT_SCHEDULE_DATA = {
  days: ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"],
  rows: [
    {
      id: "row_1",
      period: 1,
      time: "08:00-08:40",
      isBreak: false,
      subjects: ["5TO MAT", "1RO MAT", "6TO MAT", "", "4TO FIS", "6TO MAT"]
    },
    {
      id: "row_2",
      period: 2,
      time: "08:40-09:45",
      isBreak: false,
      subjects: ["1RO MAT", "1RO MAT", "6TO MAT", "", "4TO FIS", ""]
    },
    {
      id: "row_break_1",
      period: null,
      time: "",
      isBreak: true,
      breakLabel: "R E C R E O",
      subjects: []
    },
    {
      id: "row_3",
      period: 3,
      time: "09:45-10:05",
      isBreak: false,
      subjects: ["1RO TTG", "5TO FIS", "6TO FIS", "", "1RO MAT", "3RO FIS"]
    },
    {
      id: "row_4",
      period: 4,
      time: "10:05-11:10",
      isBreak: false,
      subjects: ["1RO TTG", "5TO FIS", "6TO FIS", "", "1RO MAT", "3RO FIS"]
    },
    {
      id: "row_break_2",
      period: null,
      time: "",
      isBreak: true,
      breakLabel: "R E C R E O",
      subjects: []
    },
    {
      id: "row_5",
      period: 5,
      time: "12:00-12:40",
      isBreak: false,
      subjects: ["5TO APV", "1RO TTG", "5TO MAT", "", "6TO MAT", "5TO MAT"]
    },
    {
      id: "row_6",
      period: 6,
      time: "12:10-13:00",
      isBreak: false,
      subjects: ["5TO APV", "1RO TTG", "5TO MAT", "", "6TO MAT", "5TO MAT"]
    },
    {
      id: "row_7",
      period: 7,
      time: "",
      isBreak: false,
      subjects: ["", "", "", "", "", ""]
    }
  ]
};

// Crear tabla AgendaHorarioConfig si no existe
(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS AgendaHorarioConfig (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Error inicializando tabla AgendaHorarioConfig:', err.message);
  }
})();

app.get('/api/agenda/horario', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM AgendaHorarioConfig WHERE id = 'default'`);
    if (rows && rows.length > 0) {
      try {
        const parsed = JSON.parse(rows[0].data);
        return res.json(parsed);
      } catch (parseErr) {
        console.error('Error parseando datos de horario:', parseErr);
        return res.json(DEFAULT_SCHEDULE_DATA);
      }
    }
    return res.json(DEFAULT_SCHEDULE_DATA);
  } catch (error) {
    console.error('Error fetching horario config:', error.message);
    res.status(500).json({ error: 'Error al obtener configuración de horario' });
  }
});

app.post('/api/agenda/horario', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.rows)) {
      return res.status(400).json({ error: 'Se esperaba un objeto de horario válido con propiedad rows' });
    }
    const jsonStr = JSON.stringify(data);
    await prisma.$executeRawUnsafe(`
      INSERT INTO AgendaHorarioConfig (id, data, updatedAt)
      VALUES ('default', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updatedAt = CURRENT_TIMESTAMP
    `, jsonStr);

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Error saving horario config:', error.message);
    res.status(500).json({ error: 'Error al guardar configuración de horario' });
  }
});

app.get('/api/agenda', async (req, res) => {
  try {
    const { subject, weekStr } = req.query;
    if (subject && weekStr) {
      const id = `${subject}_${weekStr}`;
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM AgendaNota WHERE id = ?`, id);
      return res.json(rows[0] || { text: '' });
    }
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM AgendaNota ORDER BY updated DESC`);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching agenda notes:', error.message);
    res.status(500).json({ error: 'Error al obtener notas de la agenda' });
  }
});

app.post('/api/agenda', async (req, res) => {
  try {
    const { id, subject, weekStr, text } = req.body;
    const noteId = id || `${subject}_${weekStr}`;
    const txt = String(text || '').trim();

    await prisma.$executeRawUnsafe(`
      INSERT INTO AgendaNota (id, subject, weekStr, text, updated)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      updated = CURRENT_TIMESTAMP
    `, noteId, subject || '', weekStr || '', txt);

    res.json({ ok: true, id: noteId, text: txt });
  } catch (error) {
    console.error('Error saving agenda note:', error.message);
    res.status(500).json({ error: 'Error al guardar nota de la agenda' });
  }
});

// ── AVANCE CURRICULAR / PORCENTAJE DE TEMAS PROGRAMADOS ──
app.get('/api/avance-curricular', async (req, res) => {
  try {
    const gestion = String(req.query.gestion || '2026');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AvanceCurricular" WHERE "gestion" = ? ORDER BY "orden" ASC`,
      gestion
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching avance curricular:', error.message);
    res.status(500).json({ error: 'Error al obtener datos de avance curricular' });
  }
});

app.post('/api/avance-curricular', async (req, res) => {
  try {
    const { gestion = '2026', rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Se esperaba un arreglo de filas (rows)' });
    }

    const g = String(gestion || '2026');

    // Reemplazo atómico de las filas para esta gestión
    await prisma.$executeRawUnsafe(
      `DELETE FROM "AvanceCurricular" WHERE "gestion" = ?`,
      g
    );

    let inserted = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowId = r.id ? String(r.id) : `row-${Date.now()}-${i}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "AvanceCurricular" (id, gestion, orden, area, curso, t1_tp, t1_td, t2_tp, t2_td, t3_tp, t3_td, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        rowId,
        g,
        i,
        String(r.area || '').trim().toUpperCase(),
        String(r.curso || '').trim().toUpperCase(),
        String(r.t1_tp !== undefined && r.t1_tp !== null ? r.t1_tp : ''),
        String(r.t1_td !== undefined && r.t1_td !== null ? r.t1_td : ''),
        String(r.t2_tp !== undefined && r.t2_tp !== null ? r.t2_tp : ''),
        String(r.t2_td !== undefined && r.t2_td !== null ? r.t2_td : ''),
        String(r.t3_tp !== undefined && r.t3_tp !== null ? r.t3_tp : ''),
        String(r.t3_td !== undefined && r.t3_td !== null ? r.t3_td : '')
      );
      inserted++;
    }

    console.log(`[avance-curricular] Guardados permanentemente ${inserted} registros para gestion=${g}`);
    res.json({ ok: true, count: inserted });
  } catch (error) {
    console.error('Error saving avance curricular:', error.message);
    res.status(500).json({ error: 'Error al guardar avance curricular' });
  }
});

// ─── PLANES Y PROGRAMAS ─────────────────────────────────────────────────────

const planesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'planes-programas');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadPlanes = multer({ storage: planesStorage });

// Mapeo de áreas del PDF del Ministerio → áreas del sistema
const AREA_MAP = {
  'CIENCIAS NATURALES: BIOLOGÍA': 'BIOLOGÍA',
  'CIENCIAS NATURALES: FÍSICA': 'FÍSICA',
  'CIENCIAS NATURALES: QUÍMICA': 'QUÍMICA',
  'MATEMÁTICA': 'MATEMÁTICAS',
  'TÉCNICA TECNOLÓGICA GENERAL': 'TÉCNICA TECNOLOGÍA GENERAL',
  'COMUNICACIÓN Y LENGUAJES: LENGUA CASTELLANA': 'LENGUA CASTELLANA ORIGINARIA',
  'COMUNICACIÓN Y LENGUAJES: LENGUA ORIGINARIA': 'LENGUA CASTELLANA ORIGINARIA',
  'LENGUA EXTRANJERA': 'LENGUA EXTRANJERA',
  'CIENCIAS SOCIALES': 'CIENCIAS SOCIALES',
  'ARTES PLÁSTICAS Y VISUALES': 'ARTES PLÁSTICAS Y VISUALES',
  'EDUCACIÓN MUSICAL': 'MÚSICA',
  'EDUCACIÓN FÍSICA Y DEPORTES': 'EDUCACIÓN FÍSICA Y DEPORTES',
  'COSMOVISIONES FILOSOFÍA Y SICOLOGÍA': 'COSMOVISIONES FILOSOFÍA SICOLOGÍA',
  'VALORES ESPIRITUALIDAD Y RELIGIONES': 'VALORES ESPIRITUALIDAD Y RELIGIONES'
};

// Marcadores de sección en el PDF (orden de aparición)
const PDF_SECTION_MARKERS = [
  'CIENCIAS NATURALES: BIOLOGÍA',
  'CIENCIAS NATURALES: FÍSICA',
  'CIENCIAS NATURALES: QUÍMICA',
  'MATEMÁTICA',
  'TÉCNICA TECNOLÓGICA GENERAL',
  'COMUNICACIÓN Y LENGUAJES: LENGUA CASTELLANA',
  'COMUNICACIÓN Y LENGUAJES: LENGUA ORIGINARIA',
  'LENGUA EXTRANJERA',
  'CIENCIAS SOCIALES',
  'ARTES PLÁSTICAS Y VISUALES',
  'EDUCACIÓN MUSICAL',
  'EDUCACIÓN FÍSICA Y DEPORTES',
  'COSMOVISIONES FILOSOFÍA Y SICOLOGÍA',
  'VALORES ESPIRITUALIDAD Y RELIGIONES'
];

// Mapeo de grados
const GRADO_MAP = {
  'PRIMER AÑO': '1RO SEC',
  'SEGUNDO AÑO': '2DO SEC',
  'TERCER AÑO': '3RO SEC',
  'CUARTO AÑO': '4TO SEC',
  'QUINTO AÑO': '5TO SEC',
  'SEXTO AÑO': '6TO SEC'
};

const GRADO_MARKERS = ['PRIMER AÑO', 'SEGUNDO AÑO', 'TERCER AÑO', 'CUARTO AÑO', 'QUINTO AÑO', 'SEXTO AÑO'];

function findSectionStart(textUpper, marker, fromIndex) {
  // Buscar el marcador precedido por "2." o "2·" (formato del índice)
  let pos = fromIndex;
  while (pos < textUpper.length) {
    const idx = textUpper.indexOf(marker.toUpperCase(), pos);
    if (idx === -1) return -1;
    // Verificar que es un encabezado de sección (buscar "2." o "2·" antes, o "ENFOQUE" después)
    const before = textUpper.substring(Math.max(0, idx - 30), idx);
    if (before.includes('2.') || before.includes('2·') || before.includes('2\u00B7')) {
      return idx;
    }
    // También aceptar si aparece como encabezado suelto con "ENFOQUE" después
    const after = textUpper.substring(idx, Math.min(textUpper.length, idx + 200));
    if (after.includes('ENFOQUE DEL ÁREA') || after.includes('ENFOQUE')) {
      return idx;
    }
    pos = idx + 1;
  }
  return -1;
}

function parsePDFText(fullText) {
  const textUpper = fullText.toUpperCase();
  const result = {}; // { "BIOLOGÍA": { "1RO SEC": "texto...", ... }, ... }

  // 1) Encontrar posiciones de cada sección de área
  const sectionPositions = [];
  for (const marker of PDF_SECTION_MARKERS) {
    const pos = findSectionStart(textUpper, marker, 0);
    if (pos !== -1) {
      sectionPositions.push({ marker, pos, systemArea: AREA_MAP[marker] });
    }
  }

  // Ordenar por posición
  sectionPositions.sort((a, b) => a.pos - b.pos);

  // 2) Extraer texto de cada sección
  for (let i = 0; i < sectionPositions.length; i++) {
    const sec = sectionPositions[i];
    const nextPos = (i + 1 < sectionPositions.length) ? sectionPositions[i + 1].pos : fullText.length;
    const sectionText = fullText.substring(sec.pos, nextPos);
    const sectionTextUpper = sectionText.toUpperCase();

    // 3) Dentro de cada sección, buscar los grados
    const gradoPositions = [];
    for (const gradoMarker of GRADO_MARKERS) {
      // Buscar "PERFIL DE SALIDA DEL <GRADO>" o simplemente el marcador del grado
      const searchPatterns = [
        `PERFIL DE SALIDA DEL ${gradoMarker}`,
        `${gradoMarker} DE ESCOLARIDAD`,
        gradoMarker
      ];

      let gradoPos = -1;
      for (const pattern of searchPatterns) {
        const idx = sectionTextUpper.indexOf(pattern.toUpperCase());
        if (idx !== -1) {
          gradoPos = idx;
          break;
        }
      }

      if (gradoPos !== -1) {
        gradoPositions.push({
          marker: gradoMarker,
          pos: gradoPos,
          systemGrado: GRADO_MAP[gradoMarker]
        });
      }
    }

    // Ordenar por posición
    gradoPositions.sort((a, b) => a.pos - b.pos);

    if (!result[sec.systemArea]) {
      result[sec.systemArea] = {};
    }

    if (gradoPositions.length === 0) {
      // Si no se encontraron grados, asignar todo el texto de la sección a todos los grados
      for (const grado of Object.values(GRADO_MAP)) {
        result[sec.systemArea][grado] = sectionText.trim();
      }
    } else {
      // Extraer texto por grado
      for (let j = 0; j < gradoPositions.length; j++) {
        const grado = gradoPositions[j];
        const nextGradoPos = (j + 1 < gradoPositions.length) ? gradoPositions[j + 1].pos : sectionText.length;
        const gradoText = sectionText.substring(grado.pos, nextGradoPos);
        result[sec.systemArea][grado.systemGrado] = gradoText.trim();
      }

      // Incluir el encabezado/enfoque de la sección (antes del primer grado) como prefijo para todos
      const headerText = sectionText.substring(0, gradoPositions[0].pos).trim();
      if (headerText.length > 50) {
        for (const grado of gradoPositions) {
          if (result[sec.systemArea][grado.systemGrado]) {
            result[sec.systemArea][grado.systemGrado] = headerText + '\n\n' + result[sec.systemArea][grado.systemGrado];
          }
        }
      }
    }
  }

  return result;
}

const { PDFDocument } = require('pdf-lib');

const CURSO_AREA_PAGES = {
  'MATEMATICAS': {
    '1RO SEC': { start: 39, end: 40 },
    '2DO SEC': { start: 40, end: 41 },
    '3RO SEC': { start: 41, end: 42 },
    '4TO SEC': { start: 42, end: 43 },
    '5TO SEC': { start: 44, end: 45 },
    '6TO SEC': { start: 45, end: 46 },
    '_area': { start: 39, end: 46 }
  },
  'FISICA': {
    '3RO SEC': { start: 30, end: 31 },
    '4TO SEC': { start: 31, end: 32 },
    '5TO SEC': { start: 32, end: 33 },
    '6TO SEC': { start: 34, end: 34 },
    '_area': { start: 30, end: 34 }
  },
  'QUIMICA': {
    '3RO SEC': { start: 35, end: 35 },
    '4TO SEC': { start: 36, end: 36 },
    '5TO SEC': { start: 37, end: 37 },
    '6TO SEC': { start: 38, end: 38 },
    '_area': { start: 35, end: 38 }
  },
  'BIOLOGIA': {
    '1RO SEC': { start: 21, end: 22 },
    '2DO SEC': { start: 23, end: 23 },
    '3RO SEC': { start: 24, end: 24 },
    '4TO SEC': { start: 25, end: 26 },
    '5TO SEC': { start: 27, end: 27 },
    '6TO SEC': { start: 28, end: 29 },
    '_area': { start: 21, end: 29 }
  },
  'TECNICA TECNOLOGIA GENERAL': {
    '1RO SEC': { start: 47, end: 48 },
    '2DO SEC': { start: 49, end: 49 },
    '3RO SEC': { start: 50, end: 51 },
    '_area': { start: 47, end: 51 }
  },
  'LENGUA CASTELLANA ORIGINARIA': {
    '1RO SEC': { start: 52, end: 53 },
    '2DO SEC': { start: 54, end: 54 },
    '3RO SEC': { start: 55, end: 55 },
    '4TO SEC': { start: 56, end: 56 },
    '5TO SEC': { start: 57, end: 57 },
    '6TO SEC': { start: 58, end: 61 },
    '_area': { start: 52, end: 62 }
  },
  'LENGUA EXTRANJERA': {
    '1RO SEC': { start: 63, end: 64 },
    '2DO SEC': { start: 64, end: 65 },
    '3RO SEC': { start: 65, end: 65 },
    '4TO SEC': { start: 66, end: 66 },
    '5TO SEC': { start: 67, end: 67 },
    '6TO SEC': { start: 67, end: 67 },
    '_area': { start: 63, end: 67 }
  },
  'CIENCIAS SOCIALES': {
    '1RO SEC': { start: 68, end: 70 },
    '2DO SEC': { start: 71, end: 72 },
    '3RO SEC': { start: 73, end: 74 },
    '4TO SEC': { start: 75, end: 76 },
    '5TO SEC': { start: 77, end: 78 },
    '6TO SEC': { start: 79, end: 81 },
    '_area': { start: 68, end: 81 }
  },
  'ARTES PLASTICAS Y VISUALES': {
    '1RO SEC': { start: 82, end: 83 },
    '2DO SEC': { start: 83, end: 84 },
    '3RO SEC': { start: 84, end: 85 },
    '4TO SEC': { start: 85, end: 86 },
    '5TO SEC': { start: 86, end: 87 },
    '6TO SEC': { start: 87, end: 87 },
    '_area': { start: 82, end: 87 }
  },
  'MUSICA': {
    '1RO SEC': { start: 88, end: 89 },
    '2DO SEC': { start: 89, end: 89 },
    '3RO SEC': { start: 90, end: 90 },
    '4TO SEC': { start: 90, end: 90 },
    '5TO SEC': { start: 91, end: 91 },
    '6TO SEC': { start: 91, end: 91 },
    '_area': { start: 88, end: 91 }
  },
  'EDUCACION FISICA Y DEPORTES': {
    '1RO SEC': { start: 92, end: 93 },
    '2DO SEC': { start: 94, end: 94 },
    '3RO SEC': { start: 94, end: 95 },
    '4TO SEC': { start: 95, end: 96 },
    '5TO SEC': { start: 96, end: 97 },
    '6TO SEC': { start: 97, end: 97 },
    '_area': { start: 92, end: 97 }
  },
  'COSMOVISIONES FILOSOFIA SICOLOGIA': {
    '1RO SEC': { start: 98, end: 99 },
    '2DO SEC': { start: 99, end: 100 },
    '3RO SEC': { start: 100, end: 101 },
    '4TO SEC': { start: 101, end: 102 },
    '5TO SEC': { start: 102, end: 102 },
    '6TO SEC': { start: 103, end: 103 },
    '_area': { start: 98, end: 103 }
  },
  'VALORES ESPIRITUALIDAD Y RELIGIONES': {
    '1RO SEC': { start: 104, end: 104 },
    '2DO SEC': { start: 105, end: 105 },
    '3RO SEC': { start: 106, end: 106 },
    '4TO SEC': { start: 107, end: 107 },
    '5TO SEC': { start: 108, end: 108 },
    '6TO SEC': { start: 108, end: 109 },
    '_area': { start: 104, end: 109 }
  }
};

const normalizeStr = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

function findSourcePdfPath() {
  const uploadDir = path.join(__dirname, 'uploads', 'planes-programas');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length > 0) {
      files.sort((a, b) => fs.statSync(path.join(uploadDir, b)).mtimeMs - fs.statSync(path.join(uploadDir, a)).mtimeMs);
      return path.join(uploadDir, files[0]);
    }
  }
  const desktopPath = 'C:\\Users\\alman\\OneDrive\\Escritorio\\Planes y programas - Nivel Secundaria [2023].pdf';
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }
  return null;
}

function getAreaPageRange(areaConfig, normCurso) {
  if (!areaConfig) return null;
  if (areaConfig[normCurso]) return areaConfig[normCurso];
  const match = normCurso.match(/([1-6])(?:RO|DO|TO)?/);
  if (match) {
    const num = match[1];
    const suf = num === '1' || num === '3' ? 'RO' : num === '2' ? 'DO' : 'TO';
    const secKey = `${num}${suf} SEC`;
    if (areaConfig[secKey]) return areaConfig[secKey];
  }
  return areaConfig['_area'] || null;
}

async function getOrGenerateCoursePdf(configId, curso, area) {
  const normArea = normalizeStr(area);
  const normCurso = normalizeStr(curso);
  const outDir = path.join(__dirname, 'uploads', 'planes_pdf_cursos');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Strip quotes and special chars from filename to avoid filesystem issues
  const safeCurso = normCurso.replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const safeArea = normArea.replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const safeFileName = `plan_${configId}_${safeCurso}_${safeArea}.pdf`;
  const targetPath = path.join(outDir, safeFileName);

  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  // Fallback: check for old naming convention (e.g. plan_1_1RO_SEC_MATEMATICAS.pdf)
  if (fs.existsSync(outDir)) {
    const prefix = `plan_${configId}_`;
    const existing = fs.readdirSync(outDir).find(f => f.startsWith(prefix) && f.endsWith('.pdf'));
    if (existing) {
      // Rename old file to new standard name
      const oldPath = path.join(outDir, existing);
      fs.renameSync(oldPath, targetPath);
      console.log(`[planes-programas] Renamed old PDF: ${existing} -> ${safeFileName}`);
      return targetPath;
    }
  }

  // Generar extrayendo páginas específicas de ese año de escolaridad
  const srcPath = findSourcePdfPath();
  if (!srcPath) {
    return null;
  }

  let areaConfig = CURSO_AREA_PAGES[normArea];
  if (!areaConfig) {
    for (const [k, v] of Object.entries(CURSO_AREA_PAGES)) {
      if (normArea.includes(k) || k.includes(normArea)) {
        areaConfig = v;
        break;
      }
    }
  }

  if (!areaConfig) return null;

  const range = getAreaPageRange(areaConfig, normCurso);
  if (!range) return null;

  const srcDoc = await PDFDocument.load(fs.readFileSync(srcPath));
  const subDoc = await PDFDocument.create();
  const pageIndices = [];
  for (let p = range.start; p <= Math.min(range.end, srcDoc.getPageCount()); p++) {
    pageIndices.push(p - 1);
  }
  if (pageIndices.length === 0) return null;

  const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach(p => subDoc.addPage(p));
  const subBytes = await subDoc.save();
  fs.writeFileSync(targetPath, subBytes);
  console.log(`[planes-programas] PDF específico generado para Config ${configId} (${curso} - ${area}): ${copiedPages.length} páginas`);
  return targetPath;
}

// GET /api/planes-programas — obtener todos los cursos con estado de su plan y PDF específico
app.get('/api/planes-programas', async (req, res) => {
  try {
    const configs = await prisma.$queryRawUnsafe(`SELECT id, curso, area FROM "Config" ORDER BY curso, area`);
    const plans = await prisma.$queryRawUnsafe(`SELECT configId, fuente, LENGTH(contenido) as contenidoLength FROM "PlanPrograma"`);
    const planMap = {};
    for (const p of plans) {
      planMap[Number(p.configId)] = p;
    }

    const result = configs.map(c => {
      const p = planMap[c.id];
      const normArea = normalizeStr(c.area);
      const normCurso = normalizeStr(c.curso);
      const areaConfig = CURSO_AREA_PAGES[normArea];
      const hasSpecificRange = !!getAreaPageRange(areaConfig, normCurso);

      return {
        configId: Number(c.id),
        curso: c.curso,
        area: c.area,
        hasPdf: hasSpecificRange,
        pdfUrl: `/api/planes-programas/pdf/${c.id}`,
        fuente: p ? p.fuente : 'Planes y programas - Nivel Secundaria [2023].pdf',
        hasPlan: true,
        contenidoLength: p ? Number(p.contenidoLength) : 0
      };
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching planes-programas:', error.message);
    res.status(500).json({ error: 'Error al obtener planes y programas' });
  }
});

// GET /api/planes-programas/pdf/:configId — servir el PDF ESPECÍFICO del curso (año de escolaridad)
app.get('/api/planes-programas/pdf/:configId', async (req, res) => {
  try {
    const configId = parseInt(req.params.configId);
    const rows = await prisma.$queryRawUnsafe('SELECT id, curso, area FROM "Config" WHERE id = ?', configId);
    if (rows.length === 0) {
      return res.status(404).send('Curso no encontrado');
    }
    const config = rows[0];
    const pdfPath = await getOrGenerateCoursePdf(config.id, config.curso, config.area);
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return res.status(404).send(`No se encontró el PDF específico para el curso: ${config.curso} - ${config.area}`);
    }

    const safeDownloadName = `Plan_${config.curso.replace(/[^a-zA-Z0-9]/g, '_')}_${config.area.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeDownloadName}"`);
    res.sendFile(pdfPath);
  } catch (error) {
    console.error('Error serving course PDF:', error.message);
    res.status(500).send('Error al servir el PDF del curso');
  }
});

// GET /api/planes-programas/:configId — obtener el contenido de un plan
app.get('/api/planes-programas/:configId', async (req, res) => {
  try {
    const configId = parseInt(req.params.configId);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT pp.*, c.curso, c.area FROM "PlanPrograma" pp JOIN "Config" c ON c.id = pp.configId WHERE pp.configId = ?`,
      configId
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Plan no encontrado para este curso' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching plan:', error.message);
    res.status(500).json({ error: 'Error al obtener plan' });
  }
});

// POST /api/planes-programas/importar — importar PDF, fraccionar en PDFs por área y distribuir
app.post('/api/planes-programas/importar', uploadPlanes.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // 1. Fraccionar el PDF original en archivos PDF intactos por cada área
    await splitPdfIntoAreaFiles(filePath);

    // 2. Leer y parsear el texto para soporte de texto si es necesario
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    console.log(`[planes-programas] PDF parsed: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);

    // Fragmentar por área y grado
    const fragments = parsePDFText(pdfData.text);

    // Obtener todos los configs existentes
    const configs = await prisma.$queryRawUnsafe(`SELECT id, curso, area FROM "Config"`);

    let assigned = 0;
    let skipped = 0;
    const assignments = [];

    for (const config of configs) {
      const area = config.area ? config.area.trim().toUpperCase() : '';
      const curso = config.curso ? config.curso.trim().toUpperCase() : '';

      // Normalizar: eliminar acentos para comparación
      const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      const areaNorm = normalize(area);

      // Buscar el fragmento que corresponde a este config
      let contenido = null;

      // Buscar primero por coincidencia exacta de área
      if (fragments[area] && fragments[area][curso]) {
        contenido = fragments[area][curso];
      } else {
        // Buscar por coincidencia normalizada (sin acentos)
        for (const [fragArea, grados] of Object.entries(fragments)) {
          const fragAreaNorm = normalize(fragArea);
          if (areaNorm === fragAreaNorm ||
              areaNorm.includes(fragAreaNorm) || fragAreaNorm.includes(areaNorm) ||
              areaNorm.replace(/\s+/g, '').includes(fragAreaNorm.replace(/\s+/g, '')) ||
              fragAreaNorm.replace(/\s+/g, '').includes(areaNorm.replace(/\s+/g, ''))) {
            if (grados[curso]) {
              contenido = grados[curso];
              break;
            }
          }
        }
      }

      if (contenido && contenido.length > 10) {
        const uuid = require('crypto').randomUUID();
        // Upsert: delete existing then insert
        await prisma.$executeRawUnsafe(`DELETE FROM "PlanPrograma" WHERE configId = ?`, config.id);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "PlanPrograma" (id, configId, contenido, fuente, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          uuid, config.id, contenido, originalName
        );
        assigned++;
        assignments.push({ configId: config.id, curso: config.curso, area: config.area, chars: contenido.length });
      } else {
        skipped++;
      }
    }

    console.log(`[planes-programas] Assigned: ${assigned}, Skipped: ${skipped}`);

    res.json({
      ok: true,
      totalPages: pdfData.numpages,
      totalChars: pdfData.text.length,
      areasFound: Object.keys(fragments).length,
      assigned,
      skipped,
      assignments
    });
  } catch (error) {
    console.error('Error importing planes-programas:', error.message);
    res.status(500).json({ error: 'Error al importar planes y programas: ' + error.message });
  }
});

// DELETE /api/planes-programas/:configId — eliminar plan de un curso
app.delete('/api/planes-programas/:configId', async (req, res) => {
  try {
    const configId = parseInt(req.params.configId);
    await prisma.$executeRawUnsafe(`DELETE FROM "PlanPrograma" WHERE configId = ?`, configId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting plan:', error.message);
    res.status(500).json({ error: 'Error al eliminar plan' });
  }
});

// Auto-migración al arrancar para asegurar que todos los cursos existentes tengan formato Grado "A" (omitiendo SEC)
(async function autoMigrateCursos() {
  try {
    const configs = await prisma.config.findMany();
    for (const c of configs) {
      if (c.curso && (c.curso.includes('SEC') || !c.curso.includes('"'))) {
        const match = c.curso.match(/([1-6](?:RO|DO|TO))/i);
        const grado = match ? match[1].toUpperCase() : c.curso.replace(/\s*SEC$/i, '').trim();
        const nuevoCurso = `${grado} "A"`;
        await prisma.config.update({
          where: { id: c.id },
          data: { curso: nuevoCurso }
        });
        console.log(`[AutoMigrate] Config ${c.id}: '${c.curso}' -> '${nuevoCurso}'`);
      }
    }
  } catch (err) {
    console.error('[AutoMigrate] Error migrando cursos:', err.message);
  }
})();

// ============================================================
// RUTAS DE SINCRONIZACIÓN Y RESPALDO (OFFLINE-FIRST)
// ============================================================

// 1. Obtener estado de la base de datos y estadísticas
app.get('/api/sync/status', async (req, res) => {
  try {
    const stats = await syncService.getStats(prisma);
    res.json(stats);
  } catch (error) {
    console.error('[Sync Route] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Descargar copia de seguridad SQLite (.db) directa para Google Drive / PC / USB
app.get('/api/sync/download-db', (req, res) => {
  try {
    if (!fs.existsSync(syncService.DB_PATH)) {
      return res.status(404).json({ error: 'Base de datos no encontrada' });
    }
    // Crear respaldo automático preventivo
    syncService.createAutoBackup('descarga_manual');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `registro_pedagogico_${dateStr}.db`;

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(syncService.DB_PATH);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[Sync Route] Error descargando db:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Restaurar base de datos desde un archivo .db subido
const syncTempDir = path.join(__dirname, 'prisma', 'backups_auto', 'temp');
if (!fs.existsSync(syncTempDir)) {
  fs.mkdirSync(syncTempDir, { recursive: true });
}
const syncUpload = multer({ dest: syncTempDir });

app.post('/api/sync/restore-db', syncUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de base de datos' });
    }
    const tempPath = req.file.path;
    try {
      syncService.restoreFromUploadedDb(tempPath);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      const stats = await syncService.getStats(prisma);
      res.json({
        success: true,
        message: 'Base de datos restaurada correctamente. Tus datos están intactos y actualizados.',
        stats
      });
    } catch (restoreErr) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(400).json({ error: restoreErr.message });
    }
  } catch (error) {
    console.error('[Sync Route] Error restaurando db:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Exportar todos los datos estructurados en formato JSON
app.get('/api/sync/export-json', async (req, res) => {
  try {
    const data = await syncService.exportFullJson(prisma);
    res.json(data);
  } catch (error) {
    console.error('[Sync Route] Error exportando json:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Recibir datos remotos para sincronización
app.post('/api/sync/remote-receive', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Verificación de token de sincronización o JWT
    if (!token || (token !== JWT_SECRET && token !== 'registro_pedagogico_2026_seguro')) {
      try {
        jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(403).json({ error: 'Token de sincronización inválido o no autorizado' });
      }
    }

    const payload = req.body;
    await syncService.importFullJson(prisma, payload);
    const stats = await syncService.getStats(prisma);
    res.json({
      success: true,
      message: 'Sincronización remota aplicada con éxito. Datos actualizados.',
      stats
    });
  } catch (error) {
    console.error('[Sync Route] Error en remote-receive:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  // Respaldo preventivo al iniciar el servidor
  syncService.createAutoBackup('startup');
  console.log(`Server running on port ${PORT}`);
});



// Servir Frontend compilado en Producción (Render / Cloud)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  console.log('[Static] Sirviendo interfaz web desde:', clientDistPath);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  console.log('[404] Route not found:', req.method, req.path);
  res.status(404).json({ error: 'Ruta no encontrada' });
});
