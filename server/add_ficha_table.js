const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating FichaSeguimiento table in SQLite...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FichaSeguimiento" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "estudianteId" TEXT NOT NULL,
      "configId" INTEGER NOT NULL,
      "trimestre" INTEGER NOT NULL,
      "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "hora" TEXT NOT NULL DEFAULT '',
      "anotacionesClave" TEXT NOT NULL DEFAULT '',
      "redaccionDetallada" TEXT NOT NULL DEFAULT '',
      "categoria" TEXT NOT NULL DEFAULT 'Aprovechamiento/Conducta',
      "inasistenciasAcum" INTEGER NOT NULL DEFAULT 0,
      "atrasosAcum" INTEGER NOT NULL DEFAULT 0,
      "licenciasAcum" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FichaSeguimiento_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FichaSeguimiento_configId_fkey" FOREIGN KEY ("configId") REFERENCES "Config" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  console.log('Table FichaSeguimiento created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
