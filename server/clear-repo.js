const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`DELETE FROM "RepositorioArchivo"`);
        console.log("Cleared RepositorioArchivo table");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
