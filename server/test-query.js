const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const rows = await prisma.$queryRawUnsafe(`SELECT path, originalName FROM "RepositorioArchivo"`);
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
