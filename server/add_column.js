const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Nota" ADD COLUMN "rezagados" TEXT DEFAULT '{}'`);
    console.log('Column added successfully');
  } catch (error) {
    console.error('Error adding column:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
