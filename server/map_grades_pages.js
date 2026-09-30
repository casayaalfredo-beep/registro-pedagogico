const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'C:\\Users\\alman\\OneDrive\\Escritorio\\Planes y programas - Nivel Secundaria [2023].pdf';

async function mapEveryGradeAndArea() {
    const dataBuffer = fs.readFileSync(pdfPath);
    let currentPage = 0;
    const pages = [];

    await pdf(dataBuffer, {
        pagerender: function(pageData) {
            currentPage++;
            const pNum = currentPage;
            return pageData.getTextContent().then(textContent => {
                const text = textContent.items.map(s => s.str).join(' ');
                pages.push({ page: pNum, text: text });
                return text;
            });
        }
    });

    const areas = [
        { name: 'MATEMÁTICAS', startPage: 39, endPage: 46 },
        { name: 'FÍSICA', startPage: 30, endPage: 34 },
        { name: 'QUÍMICA', startPage: 35, endPage: 38 },
        { name: 'BIOLOGÍA', startPage: 21, endPage: 29 },
        { name: 'TÉCNICA TECNOLOGÍA GENERAL', startPage: 47, endPage: 51 },
        { name: 'LENGUA CASTELLANA ORIGINARIA', startPage: 52, endPage: 62 },
        { name: 'LENGUA EXTRANJERA', startPage: 63, endPage: 67 },
        { name: 'CIENCIAS SOCIALES', startPage: 68, endPage: 81 },
        { name: 'ARTES PLÁSTICAS Y VISUALES', startPage: 82, endPage: 87 },
        { name: 'MÚSICA', startPage: 88, endPage: 91 },
        { name: 'EDUCACIÓN FÍSICA Y DEPORTES', startPage: 92, endPage: 97 },
        { name: 'COSMOVISIONES FILOSOFÍA SICOLOGÍA', startPage: 98, endPage: 103 },
        { name: 'VALORES ESPIRITUALIDAD Y RELIGIONES', startPage: 104, endPage: 109 }
    ];

    const grades = [
        { grade: '1RO SEC', keywords: ['PRIMER AÑO', '1º'] },
        { grade: '2DO SEC', keywords: ['SEGUNDO AÑO', '2º'] },
        { grade: '3RO SEC', keywords: ['TERCER AÑO', '3º'] },
        { grade: '4TO SEC', keywords: ['CUARTO AÑO', '4º'] },
        { grade: '5TO SEC', keywords: ['QUINTO AÑO', '5º'] },
        { grade: '6TO SEC', keywords: ['SEXTO AÑO', '6º'] }
    ];

    for (const area of areas) {
        console.log(`\n========================================`);
        console.log(`AREA: ${area.name} (Pages ${area.startPage} - ${area.endPage})`);
        console.log(`========================================`);

        for (let p = area.startPage; p <= area.endPage; p++) {
            const pageObj = pages.find(x => x.page === p);
            if (!pageObj) continue;
            const upper = pageObj.text.toUpperCase();
            const foundGrades = [];
            for (const g of grades) {
                // Check for "CONTENIDOS DEL <GRADO>", "PERFIL DE SALIDA DEL <GRADO>", or "<GRADO> DE ESCOLARIDAD"
                if (upper.includes(`CONTENIDOS DEL ${g.keywords[0]}`) || 
                    upper.includes(`PERFIL DE SALIDA DEL ${g.keywords[0]}`) ||
                    upper.includes(`${g.keywords[0]} DE ESCOLARIDAD`)) {
                    foundGrades.push(g.grade);
                }
            }
            console.log(`Page ${p}: ${foundGrades.length > 0 ? foundGrades.join(', ') : '(enfoque/continuación)'} | Snippet: ${pageObj.text.substring(0, 70).replace(/\n/g, ' ')}...`);
        }
    }
}

mapEveryGradeAndArea().catch(console.error);
