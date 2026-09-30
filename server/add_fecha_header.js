const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "GradeHeader" ADD COLUMN "fecha" TEXT DEFAULT ''`);
    console.log('[SUCCESS] Columna "fecha" añadida a GradeHeader exitosamente.');
  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('[INFO] La columna "fecha" ya existe en GradeHeader.');
    } else {
      console.error('[ERROR] Al añadir columna fecha:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
