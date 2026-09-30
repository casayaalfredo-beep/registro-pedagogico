const fs = require('fs');
const path = require('path');

const profiles = [
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 2\\IndexedDB',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3\\IndexedDB',
    'C:\\Users\\alman\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\IndexedDB',
    'C:\\Users\\alman\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\IndexedDB',
    'C:\\Users\\alman\\AppData\\Local\\Microsoft\\Edge\\User Data\\Profile 1\\IndexedDB'
];

const recoveredNotes = new Map(); // id -> { id, subject, weekStr, text, updated, source }

function scanLevelDBFiles(dirPath, sourceName) {
    if (!fs.existsSync(dirPath)) return;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fp = path.join(dirPath, file);
            const stat = fs.statSync(fp);
            if (stat.isDirectory()) {
                scanLevelDBFiles(fp, sourceName);
            } else if (file.endsWith('.ldb') || file.endsWith('.log') || file.endsWith('.blob')) {
                try {
                    const content = fs.readFileSync(fp).toString('latin1');
                    
                    // Regex patterns to capture notes saved in IndexedDB
                    // Example ID key formats: "1RO TTG_2026-07-27_3", "5TO MAT_2026-03-09", etc.
                    // Also json patterns: {"id":"...", "subject":"...", "weekStr":"...", "text":"...", "updated":"..."}

                    // Pattern 1: JSON-like or key-value entries in LevelDB
                    const noteRegex = /(?:[A-Z0-9\s]{2,10}_[0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9])?)[^]{1,300}?updated"?\s*:\s*"([^"]+)"/gi;
                    
                    // Pattern 2: Searching for text strings around subjects
                    const lines = content.split(/[\x00-\x08\x0E-\x1F\x7F-\x9F]+/);
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.includes('subject') && line.includes('text')) {
                            // Clean up text line
                            const cleaned = line.replace(/[^\x20-\x7E\xA0-\xFF\r\n\t]/g, ' ').trim();
                            if (cleaned.length > 10) {
                                extractNotesFromText(cleaned, sourceName);
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}

function extractNotesFromText(text, sourceName) {
    // Try matching ID pattern: e.g. 1RO TTG_2026-07-27_3 or 5TO MAT_2026-03-09
    const idMatch = text.match(/([0-9][A-Z0-9\s]{1,8}_[0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[0-9])?)/);
    const textMatch = text.match(/text"\s*[:"]\s*([^"\}]+)/i) || text.match(/text"\s*([^\x00-\x1F"]{2,100})/i);
    const updatedMatch = text.match(/updated"\s*[:"]\s*([0-9T:\.\-Z]{10,30})/);

    if (idMatch && textMatch) {
        const id = idMatch[1].trim();
        const noteText = textMatch[1].trim();
        const updated = updatedMatch ? updatedMatch[1] : new Date().toISOString();

        const parts = id.split('_');
        const subject = parts[0] ? parts[0].trim() : '';
        const weekStr = parts[1] ? parts[1].trim() : '';

        if (noteText && noteText !== 'Cargando...' && !noteText.startsWith('undefined')) {
            const existing = recoveredNotes.get(id);
            if (!existing || (updated > existing.updated)) {
                recoveredNotes.set(id, {
                    id,
                    subject,
                    weekStr,
                    text: noteText,
                    updated,
                    source: sourceName
                });
            }
        }
    }
}

for (const p of profiles) {
    if (fs.existsSync(p)) {
        console.log("Scanning profile:", p);
        scanLevelDBFiles(p, path.basename(path.dirname(p)));
    }
}

console.log("\n=== RECOVERED NOTES TOTAL:", recoveredNotes.size, "===");
const sorted = Array.from(recoveredNotes.values()).sort((a, b) => a.id.localeCompare(b.id));
console.log(JSON.stringify(sorted, null, 2));

// Save recovered notes to a JSON dump file
fs.writeFileSync(path.join(__dirname, 'recovered_notes_backup.json'), JSON.stringify(sorted, null, 2));
console.log("\nSaved recovered notes to server/recovered_notes_backup.json!");
