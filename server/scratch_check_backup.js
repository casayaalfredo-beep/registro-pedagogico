const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "file:./prisma/dev_backup.db"
        }
    }
});

async function checkBackup() {
    console.log("=== CHECKING SQLITE DEV_BACKUP.DB ===");
    try {
        const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table'`);
        console.log("Tables in dev_backup.db:", tables);
        for (const t of tables) {
            const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "${t.name}"`);
            console.log(`Table ${t.name}:`, count[0]?.cnt, 'rows');
        }
    } catch (e) {
        console.error("Error checking dev_backup.db:", e);
    }
}

checkBackup().finally(() => prisma.$disconnect());
