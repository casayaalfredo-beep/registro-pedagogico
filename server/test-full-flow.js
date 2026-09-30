const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const fileContent = "dummy content for test " + Date.now();
        fs.writeFileSync('dummy.txt', fileContent);
        
        const form = new FormData();
        form.append('configId', '1');
        form.append('trimestre', '1');
        form.append('file', fs.createReadStream('dummy.txt'));

        const uploadRes = await axios.post('http://localhost:5000/api/repositorio/upload', form, {
            headers: form.getHeaders()
        });
        console.log("Upload Status:", uploadRes.status);

        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "RepositorioArchivo" ORDER BY createdAt DESC LIMIT 1`);
        if (rows.length > 0) {
            const id = rows[0].id;
            console.log("New ID:", id);
            
            const dlRes = await axios.get(`http://localhost:5000/api/repositorio/download/${id}`, { responseType: 'text' });
            console.log("Download Status:", dlRes.status);
            console.log("Download content matched:", dlRes.data === fileContent);
        }
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
