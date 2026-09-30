const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "RepositorioArchivo"`);
        if (rows.length > 0) {
            const id = rows[0].id;
            console.log("Fetching download for id: " + id);
            try {
                const res = await fetch(`http://localhost:5000/api/repositorio/download/${id}`);
                const text = await res.text();
                console.log("HTTP STATUS: " + res.status);
                console.log("HTTP RESPONSE: " + text);
            } catch (e) {
                console.error("Fetch error:", e);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
