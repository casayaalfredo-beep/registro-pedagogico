const fs = require('fs');
const path = require('path');

const targetFolders = [
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\file__0.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\http_localhost_5173.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\IndexedDB\\http_localhost_5173.indexeddb.leveldb',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\file__0.indexeddb.blob',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB\\http_localhost_5173.indexeddb.blob',
];

const recoveredFullNotes = [];

function searchExact(folder) {
    if (!fs.existsSync(folder)) return;
    const files = fs.readdirSync(folder);
    for (const f of files) {
        const fp = path.join(folder, f);
        if (fs.statSync(fp).isDirectory()) {
            searchExact(fp);
            continue;
        }
        if (!f.endsWith('.ldb') && !f.endsWith('.log')) continue;

        try {
            const buf = fs.readFileSync(fp);
            const content = buf.toString('latin1');
            
            // Extract chunks that contain notes
            // Format of key: {id: "5TO MAT_2026-03-09", subject: "5TO MAT", weekStr: "2026-03-09", text: "...", updated: "..."}
            const jsonMatches = content.match(/\{[^{}]*?"text"[^{}]*?\}/g);
            if (jsonMatches) {
                for (const j of jsonMatches) {
                    try {
                        const parsed = JSON.parse(j);
                        if (parsed.text) {
                            recoveredFullNotes.push(parsed);
                        }
                    } catch (e) {
                        // Regex clean try
                        const idM = j.match(/"id"\s*:\s*"([^"]+)"/);
                        const subjM = j.match(/"subject"\s*:\s*"([^"]+)"/);
                        const weekM = j.match(/"weekStr"\s*:\s*"([^"]+)"/);
                        const textM = j.match(/"text"\s*:\s*"([^"]+)"/);
                        const updatedM = j.match(/"updated"\s*:\s*"([^"]+)"/);

                        if (textM) {
                            recoveredFullNotes.push({
                                id: idM ? idM[1] : (subjM && weekM ? `${subjM[1]}_${weekM[1]}` : 'UNKNOWN'),
                                subject: subjM ? subjM[1] : '',
                                weekStr: weekM ? weekM[1] : '',
                                text: textM[1],
                                updated: updatedM ? updatedM[1] : ''
                            });
                        }
                    }
                }
            }

            // Also search for raw key value pairs without JSON braces
            // e.g. "5TO MAT_2026-03-09...subject...text..."
            const rawBlocks = content.split(/AgendaScolarDB|notes/);
            for (const b of rawBlocks) {
                const cleanB = b.replace(/[^\x20-\x7E\xA0-\xFF\r\n\t]/g, ' ');
                const idMatch = cleanB.match(/([1-6]TO\s+[A-Z]{3}_[0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9])?)/);
                const textMatch = cleanB.match(/text"\s*[:"]\s*([^"\}]{2,150})/i);
                if (idMatch && textMatch) {
                    const textVal = textMatch[1].trim();
                    if (textVal && !textVal.startsWith('Cargando')) {
                        const parts = idMatch[1].split('_');
                        recoveredFullNotes.push({
                            id: idMatch[1],
                            subject: parts[0],
                            weekStr: parts[1],
                            text: textVal,
                            updated: new Date().toISOString()
                        });
                    }
                }
            }

        } catch (e) {}
    }
}

for (const tf of targetFolders) {
    searchExact(tf);
}

// Deduplicate
const noteMap = new Map();
for (const n of recoveredFullNotes) {
    // Clean text leading chars
    let cleanText = n.text.replace(/^[^\wáéíóúñÁÉÍÓÚÑ¿¡"'\s]+/, '').trim();
    if (!cleanText || cleanText === 'Cargando...') continue;

    const existing = noteMap.get(n.id);
    if (!existing || (n.updated > existing.updated)) {
        noteMap.set(n.id, {
            id: n.id,
            subject: n.subject || n.id.split('_')[0],
            weekStr: n.weekStr || n.id.split('_')[1],
            text: cleanText,
            updated: n.updated || new Date().toISOString()
        });
    }
}

const finalNotes = Array.from(noteMap.values());
console.log(`\n=== TOTAL DEDUPLICATED EXACT RECOVERED NOTES (${finalNotes.length}) ===`);
console.log(JSON.stringify(finalNotes, null, 2));

fs.writeFileSync(path.join(__dirname, 'recovered_exact_notes.json'), JSON.stringify(finalNotes, null, 2));
