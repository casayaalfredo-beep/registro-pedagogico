const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "GradeHeader" (configId, trimestre, campo, etiqueta, fecha, sellosMax, rawSellos) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            6, 2, 'hac_1', '', '', 12, '{}'
        );
        console.log('Insert OK');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
