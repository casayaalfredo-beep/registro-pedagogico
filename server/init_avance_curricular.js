const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INITIAL_ROWS = [
    { id: 'row-apv-5', gestion: '2026', orden: 0, area: 'APV', curso: '5', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-ttg-1', gestion: '2026', orden: 1, area: 'TTG', curso: '1', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-mat-5', gestion: '2026', orden: 2, area: 'MAT', curso: '5', t1_tp: '4', t1_td: '4', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-mat-6', gestion: '2026', orden: 3, area: 'MAT', curso: '6', t1_tp: '4', t1_td: '4', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-mat-1', gestion: '2026', orden: 4, area: 'MAT', curso: '1', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-fis-3', gestion: '2026', orden: 5, area: 'FIS', curso: '3', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-fis-4', gestion: '2026', orden: 6, area: 'FIS', curso: '4', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-fis-5', gestion: '2026', orden: 7, area: 'FIS', curso: '5', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
    { id: 'row-fis-6', gestion: '2026', orden: 8, area: 'FIS', curso: '6', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' }
];

async function main() {
    try {
        console.log('Verificando / creando tabla AvanceCurricular en SQLite...');
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "AvanceCurricular" (
                "id" TEXT PRIMARY KEY,
                "gestion" TEXT DEFAULT '2026',
                "orden" INTEGER NOT NULL DEFAULT 0,
                "area" TEXT NOT NULL DEFAULT '',
                "curso" TEXT NOT NULL DEFAULT '',
                "t1_tp" TEXT NOT NULL DEFAULT '',
                "t1_td" TEXT NOT NULL DEFAULT '',
                "t2_tp" TEXT NOT NULL DEFAULT '',
                "t2_td" TEXT NOT NULL DEFAULT '',
                "t3_tp" TEXT NOT NULL DEFAULT '',
                "t3_td" TEXT NOT NULL DEFAULT '',
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabla AvanceCurricular lista.');

        // Limpiar e insertar datos reales para gestión 2026
        await prisma.$executeRawUnsafe(`DELETE FROM "AvanceCurricular" WHERE "gestion" = '2026'`);
        console.log('Insertando datos reales del 1er Trimestre...');
        for (const r of INITIAL_ROWS) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO "AvanceCurricular" (id, gestion, orden, area, curso, t1_tp, t1_td, t2_tp, t2_td, t3_tp, t3_td, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, r.id, r.gestion, r.orden, r.area, r.curso, r.t1_tp, r.t1_td, r.t2_tp, r.t2_td, r.t3_tp, r.t3_td);
        }
        console.log(`¡Insertados ${INITIAL_ROWS.length} registros reales en AvanceCurricular!`);
    } catch (e) {
        console.error('Error en init_avance_curricular:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
