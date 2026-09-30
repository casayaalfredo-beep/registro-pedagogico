const fs = require('fs');
const path = require('path');

const filesToScan = [
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\file__0.indexeddb.leveldb\\000003.log',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\http_localhost_5173.indexeddb.leveldb\\000057.ldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\IndexedDB\\http_localhost_5173.indexeddb.leveldb\\000055.log',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\IndexedDB\\http_localhost_5173.indexeddb.leveldb\\000057.ldb'
];

const recoveredList = [];

for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const buf = fs.readFileSync(filePath);
    const content = buf.toString('latin1');

    // Split content by null bytes or non-printable blocks
    const chunks = content.split(/[\x00-\x08\x0B-\x1F\x7F-\x9F]+/);
    
    let lastKey = null;
    let lastSubject = null;
    let lastWeekStr = null;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;

        // Check if chunk contains a key: e.g. 1RO TTG_2026-07-27_3 or 5TO MAT_2026-03-09
        const keyMatch = chunk.match(/([1-6]TO\s+[A-Z]{3}_[0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9]+)?)/);
        if (keyMatch) {
            lastKey = keyMatch[1];
            const parts = lastKey.split('_');
            lastSubject = parts[0];
            lastWeekStr = parts[1];
        }

        // Check if chunk contains note text or text field
        const textMatch = chunk.match(/text"\s*[:"]?\s*([^"\x00]{2,150})/i) || 
                          (chunk.includes('text"') ? chunk.match(/text"\s*(.*)/i) : null);

        if (textMatch) {
            let val = textMatch[1].replace(/^[^\wáéíóúñÁÉÍÓÚÑ¿¡"'\s]+/, '').trim();
            if (val && val !== 'Cargando...' && val.length > 2 && !val.startsWith('updated')) {
                recoveredList.push({
                    key: lastKey || 'ASIGNAR_FECHA',
                    subject: lastSubject || 'GENERAL',
                    weekStr: lastWeekStr || '',
                    text: val,
                    file: path.basename(filePath)
                });
            }
        }
    }
}

// Deduplicate and clean
const map = new Map();
for (const item of recoveredList) {
    // Limpiar caracteres iniciales del log de LevelDB
    let cleanText = item.text.replace(/^[>\+&\\/\)\(0-9A-Za-z\s]{1,2}(?=[A-ZÁÉÍÓÚÑ])/, '').trim();
    cleanText = cleanText.replace(/^[\'\">\)]+/, '').trim();
    if (!cleanText || cleanText.length < 3) continue;

    const dedupeKey = `${cleanText}`;
    if (!map.has(dedupeKey)) {
        map.set(dedupeKey, {
            key: item.key,
            subject: item.subject,
            weekStr: item.weekStr,
            text: cleanText,
            file: item.file
        });
    }
}

const finalExtracted = Array.from(map.values());
console.log("=== EXRACTED RECOVERED NOTES WITH KEYS ===");
console.log(JSON.stringify(finalExtracted, null, 2));

fs.writeFileSync(path.join(__dirname, 'recovered_final_notes.json'), JSON.stringify(finalExtracted, null, 2));
