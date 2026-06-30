const fs = require('fs');
const path = require('path');
const dirs = fs.readdirSync(__dirname).filter(f => fs.statSync(f).isDirectory() && f.startsWith('APP'));

dirs.forEach(d => {
    const jsFile = path.join(d, d + '.js');
    if (!fs.existsSync(jsFile)) return;
    const content = fs.readFileSync(jsFile, 'utf8');
    // Match anything that looks like const NAME = { ... };
    // This regex looks for const followed by uppercase letters (with underscores), then =, then an object.
    const regex = /const\s+([A-Z_]+)\s*=\s*(\{[\s\S]*?\})\s*;/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        let objStr = match[2];
        try {
            // Using a loose eval
            const obj = new Function('return ' + objStr)();
            if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                let csv = '"Variable","Celda"\n';
                for (let k in obj) {
                    csv += '"' + k + '","' + obj[k] + '"\n';
                }
                const outPath = path.join(d, name + '.csv');
                fs.writeFileSync(outPath, csv);
                console.log('Created ' + outPath);
            }
        } catch (e) {
            // Probably not a simple object or contains JS references
            // Let's do a fallback regex to extract string keys and string values
            let csvFallback = '"Variable","Celda"\n';
            const kvRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
            let kvMatch;
            let found = false;
            while ((kvMatch = kvRegex.exec(objStr)) !== null) {
                csvFallback += '"' + kvMatch[1] + '","' + kvMatch[2] + '"\n';
                found = true;
            }
            if (found) {
                const outPath = path.join(d, name + '.csv');
                fs.writeFileSync(outPath, csvFallback);
                console.log('Created (fallback) ' + outPath);
            }
        }
    }
});
