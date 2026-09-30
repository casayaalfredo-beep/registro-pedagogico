const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "RepositorioArchivo" WHERE id = '5cee2d75-d843-4da3-a3dd-4c9485c53df1'`);
        console.log(rows);
    } finally {
        await prisma.$disconnect();
    }
}
main();
