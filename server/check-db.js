const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const configs = await prisma.config.findMany();
    console.log('Configs:', configs);
    const students = await prisma.estudiante.findMany({ include: { config: true } });
    console.log('Students:', students);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
