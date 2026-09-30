const fs = require('fs');
const path = require('path');

const baseDirs = [
    path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data'),
    path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data'),
    path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data'),
    path.join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles')
];

function findIndexedDBFolder(dir) {
    if (!fs.existsSync(dir)) return;
    try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const f of files) {
            const full = path.join(dir, f.name);
            if (f.name.toLowerCase().includes('indexeddb')) {
                console.log("=== FOUND INDEXEDDB DIR ===", full);
                inspectIndexedDBDir(full);
            } else if (f.isDirectory() && !f.name.startsWith('.')) {
                findIndexedDBFolder(full);
            }
        }
    } catch (e) {}
}

function inspectIndexedDBDir(indexedDbDir) {
    try {
        const items = fs.readdirSync(indexedDbDir);
        for (const item of items) {
            if (item.includes('localhost') || item.includes('127.0.0.1') || item.includes('file_') || item.includes('5173') || item.includes('3000')) {
                console.log("--> MATCHING ORIGIN FOLDER:", path.join(indexedDbDir, item));
                const itemPath = path.join(indexedDbDir, item);
                searchInFolderForKeywords(itemPath);
            }
        }
    } catch (e) {}
}

function searchInFolderForKeywords(folderPath) {
    try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const f of files) {
            const fp = path.join(folderPath, f.name);
            if (f.isDirectory()) {
                searchInFolderForKeywords(fp);
            } else {
                // Search file contents for AgendaScolarDB or text
                try {
                    const buf = fs.readFileSync(fp);
                    const content = buf.toString('latin1');
                    if (content.includes('AgendaScolarDB') || content.includes('notes') || content.includes('MAT') || content.includes('FIS')) {
                        console.log("   [!!! FOUND AGENDA TEXT IN FILE !!!]", fp, "Size:", buf.length);
                        // Extract text strings
                        const printable = content.replace(/[^\x20-\x7E\xA0-\xFF\r\n\t]/g, ' ');
                        const matches = printable.match(/(?:[A-Z0-9\s]{3,15}_[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]|AgendaScolarDB|5TO|6TO|1RO|4TO|3RO)[^]{0,100}/g);
                        if (matches) {
                            console.log("   Snippets found:", matches.slice(0, 5));
                        }
                    }
                } catch (err) {}
            }
        }
    } catch (e) {}
}

console.log("Searching Chrome/Edge/Brave/Firefox profiles for Agenda data...");
for (const bd of baseDirs) {
    findIndexedDBFolder(bd);
}
