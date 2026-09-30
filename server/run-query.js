const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE RepositorioArchivo (
                id TEXT PRIMARY KEY,
                configId INTEGER NOT NULL,
                trimestre INTEGER NOT NULL,
                originalName TEXT NOT NULL,
                fileName TEXT NOT NULL,
                mimeType TEXT NOT NULL,
                size INTEGER NOT NULL,
                path TEXT NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT RepositorioArchivo_configId_fkey FOREIGN KEY (configId) REFERENCES Config (id) ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);
        console.log("Table created successfully");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
