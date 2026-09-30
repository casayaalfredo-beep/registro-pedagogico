const fs = require('fs');
const path = require('path');

const appDataLocal = process.env.LOCALAPPDATA || 'C:\\Users\\alman\\AppData\\Local';
const appDataRoaming = process.env.APPDATA || 'C:\\Users\\alman\\AppData\\Roaming';

function searchDirectory(dirPath, maxDepth = 4, depth = 0) {
    if (depth > maxDepth || !fs.existsSync(dirPath)) return;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.toLowerCase().includes('indexeddb') || entry.name.toLowerCase().includes('agendascolardb')) {
                console.log("[FOUND MATCH]", fullPath);
            }
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                searchDirectory(fullPath, maxDepth, depth + 1);
            }
        }
    } catch (e) {
        // ignore permission errors
    }
}

console.log("Searching in Local AppData...");
searchDirectory(appDataLocal, 5);

console.log("Searching in Roaming AppData...");
searchDirectory(appDataRoaming, 5);
