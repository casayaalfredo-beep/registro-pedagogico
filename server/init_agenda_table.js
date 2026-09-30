const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RECOVERED_AGENDA_NOTES = [
    { id: "5TO MAT_2026-03-09_1", subject: "5TO MAT", weekStr: "2026-03-09_1", text: "REVISAR TAREA" },
    { id: "5TO MAT_2026-03-16_1", subject: "5TO MAT", weekStr: "2026-03-16_1", text: "NO TIENEN TAREA, DEBES DARLES PRACTICAS" },
    { id: "1RO TTG_2026-03-30_3", subject: "1RO TTG", weekStr: "2026-03-30_3", text: "SE QUEDO EN : las rocas y los minerales" },
    { id: "1RO TTG_2026-07-27_3", subject: "1RO TTG", weekStr: "2026-07-27_3", text: "ya se termino la actividad. Para la siguiente alistar material de un nuevo tema" },
    { id: "5TO APV_2026-07-27_5", subject: "5TO APV", weekStr: "2026-07-27_5", text: "REALIZARON LA FIGURA FEMENINA VISTO DE FRENTE. TAREA REALIZAR FIGURA FEMENINA VISTO DE PERFIL" },
    { id: "1RO MAT_2026-07-27_1", subject: "1RO MAT", weekStr: "2026-07-27_1", text: "TIENEN TAREA RESOLVER EL BANCO DE PREGUNTAS DE FRACCIONES" },
    { id: "5TO FIS_2026-07-28_3", subject: "5TO FIS", weekStr: "2026-07-28_3", text: "LA SIGUIENTE CLASE SE DARA EVALUACION DE TRABAJO ENERGIA. PREPARAR UNA EVALUACION" },
    { id: "6TO FIS_2026-07-28_3", subject: "6TO FIS", weekStr: "2026-07-28_3", text: "PARA LA SIGUIENTE DEBEN TERMINAR DE COPIAR LAS DOS HOJAS. PARA LA SIGUIENTE CLASE ALISTAR EL RESTO DE CONTENIDOS QUE FALTA" },
    { id: "3RO FIS_2026-06-09_3", subject: "3RO FIS", weekStr: "2026-06-09_3", text: "ALISTAR MATERIAL DE VECTORES" },
    { id: "6TO MAT_2026-07-01_1", subject: "6TO MAT", weekStr: "2026-07-01_1", text: "tienen tarea de problemas de conjuntos del 1 al 10. Ya tienen practica para una clase mas" },
    { id: "6TO MAT_2026-07-22_1", subject: "6TO MAT", weekStr: "2026-07-22_1", text: "se dio evaluacion de teoria de conjuntos" },
    { id: "1RO TTG_2026-07-20_3", subject: "1RO TTG", weekStr: "2026-07-20_3", text: "SE APLICO LA PRACTICA, y ya se reviso, para mañana debes preparar otro material del siguiente tema" }
];

async function main() {
    try {
        console.log("Creando tabla AgendaNota en la base de datos SQLite dev.db...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS AgendaNota (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                weekStr TEXT NOT NULL,
                text TEXT NOT NULL,
                updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla AgendaNota lista.");

        console.log("Insertando/Restaurando notas recuperadas en dev.db...");
        let inserted = 0;
        for (const n of RECOVERED_AGENDA_NOTES) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO AgendaNota (id, subject, weekStr, text, updated)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                text = excluded.text,
                updated = CURRENT_TIMESTAMP
            `, n.id, n.subject, n.weekStr, n.text);
            inserted++;
        }
        console.log(`¡Éxito! Se restauraron ${inserted} notas de la agenda en la base de datos dev.db.`);
    } catch (e) {
        console.error("Error en init_agenda_table:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
