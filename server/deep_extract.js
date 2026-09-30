const fs = require('fs');
const path = require('path');

const targetFolders = [
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\file__0.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\http_localhost_5173.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\IndexedDB\\http_localhost_5173.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\IndexedDB',
];

const extracted = [];

function searchInLevelDBFolder(folder) {
    if (!fs.existsSync(folder)) return;
    const files = fs.readdirSync(folder);
    for (const f of files) {
        const fp = path.join(folder, f);
        if (fs.statSync(fp).isDirectory()) {
            searchInLevelDBFolder(fp);
            continue;
        }
        if (!f.endsWith('.ldb') && !f.endsWith('.log')) continue;

        try {
            const buf = fs.readFileSync(fp);
            // Reemplazar caracteres no imprimibles por espacios para poder leer texto binario de LevelDB
            const str = buf.toString('latin1');
            
            // Buscar fragmentos donde aparezcan materias como "5TO MAT", "1RO TTG", "3RO FIS", "4TO FIS", etc.
            // o donde aparezcan 'text' y 'subject'
            const regex = /(?:[1-6]TO\s+[A-Z]{3}_[0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9])?|subject|text|updated)[^\x00-\x1F\x7F-\x9F]{5,200}/gi;
            const matches = str.match(regex);
            
            if (matches) {
                for (const m of matches) {
                    if (m.length > 15 && (m.includes('text') || m.includes('subject') || m.includes('2026-'))) {
                        extracted.push({
                            file: fp,
                            snippet: m.trim()
                        });
                    }
                }
            }
        } catch (e) {}
    }
}

for (const tf of targetFolders) {
    searchInLevelDBFolder(tf);
}

console.log(`Found ${extracted.length} raw snippets.`);
fs.writeFileSync(path.join(__dirname, 'raw_agenda_snippets.json'), JSON.stringify(extracted, null, 2));

// Ahora extraer notas estructuradas buscando ocurrencias de text e id
const structuredNotes = new Map();

for (const item of extracted) {
    const s = item.snippet;
    // Buscar patrones de texto de notas
    // Ej: text" REVISAR TAREA"
    // Ej: text" ya se termino la ctividad"
    // Ej: text" SE APLICO LA PRACTICA, y ya se reviso..."
    // Ej: text" SE QUEDO EN : las rocas y los minerales"
    const textMatch = s.match(/text"\s*"?([^"\}]{2,150})/i);
    const subjMatch = s.match(/(?:subject"?\s*"?|\s+)([1-6]TO\s+[A-Z]{3})/i);
    const dateMatch = s.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9])?)/);
    const updatedMatch = s.match(/updated"?\s*"?([0-9T:\.\-Z]{10,30})/i);

    if (textMatch) {
        const textVal = textMatch[1].replace(/^[:"\s]+/, '').trim();
        const subjectVal = subjMatch ? subjMatch[1].trim() : 'DESCONOCIDO';
        const dateVal = dateMatch ? dateMatch[1] : '';
        const key = `${subjectVal}_${dateVal}_${textVal.substring(0, 20)}`;

        if (textVal && !textVal.startsWith('Cargando') && textVal.length > 2) {
            structuredNotes.set(key, {
                subject: subjectVal,
                date: dateVal,
                text: textVal,
                updated: updatedMatch ? updatedMatch[1] : null,
                rawFile: path.basename(item.file)
            });
        }
    }
}

const resultList = Array.from(structuredNotes.values());
console.log(`Structured Notes Recovered (${resultList.length}):`);
console.dir(resultList, { depth: null });

fs.writeFileSync(path.join(__dirname, 'recovered_notes_clean.json'), JSON.stringify(resultList, null, 2));
