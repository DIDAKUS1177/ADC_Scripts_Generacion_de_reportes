const fs = require('fs');
const path = require('path');
const dirs = fs.readdirSync(__dirname).filter(f => fs.statSync(f).isDirectory() && f.startsWith('APP'));

dirs.forEach(d => {
    let jsFiles = fs.readdirSync(d).filter(f => f.endsWith('.js'));
    if (jsFiles.length === 0) return;
    
    // Process all js files in the directory
    jsFiles.forEach(jsFileName => {
        const jsFile = path.join(d, jsFileName);
        const content = fs.readFileSync(jsFile, 'utf8');

        // 1. Try to find a global format name
        let formatNameMatch = content.match(/(?:const|let|var)\s+(?:NOMBRE_)?HOJA_FORMATO(?:_[A-Z0-9_]+)?\s*=\s*['"]([^'"]+)['"]/i);
        let defaultSheetName = formatNameMatch ? formatNameMatch[1] : null;

        // 2. Try to find SECTIONS_CONFIG
        let sectionsRegex = /(?:const|let|var)\s+SECTIONS_CONFIG\s*=\s*(\{[\s\S]*?\n\});/;
        let sectionsMatch = content.match(sectionsRegex);
        let handled = false;
        
        if (sectionsMatch) {
            try {
                let objStr = sectionsMatch[1];
                let getObj = new Function('return ' + objStr);
                let sections = getObj();
                for (let key in sections) {
                    let sec = sections[key];
                    let sheetName = sec.sheetName || sec.nombreHoja || key;
                    let mapping = sec.mapping || sec.mapeo;
                    if (mapping) {
                        let csv = '"Variable","Celda"\n';
                        for (let k in mapping) {
                            csv += '"' + k + '","' + mapping[k] + '"\n';
                        }
                        let outPath = path.join(d, sheetName + '.csv');
                        fs.writeFileSync(outPath, csv);
                        console.log('Created ' + outPath);
                        handled = true;
                    }
                }
            } catch(e) {
                console.log('Error parsing SECTIONS_CONFIG in ' + d, e.message);
            }
        }
        
        // 3. Try to find MAPEO_... objects
        const regex = /(?:const|let|var)\s+([A-Z0-9_]*MAPEO[A-Z0-9_]*)\s*=\s*(\{[\s\S]*?\})\s*;/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (handled && match[1].includes('MAPEO')) {
                // If we found SECTIONS_CONFIG and it has mapeo inside, we still want standalone MAPEOs
            }
            
            const name = match[1];
            let objStr = match[2];
            try {
                const obj = new Function('return ' + objStr)();
                if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                    let csv = '"Variable","Celda"\n';
                    for (let k in obj) {
                        csv += '"' + k + '","' + obj[k] + '"\n';
                    }
                    
                    let outName = name;
                    if (name.includes('GENERAL') || name === 'MAPEO_DE_CELDAS' || name === 'MAPEO_CELDAS_GENERAL_MT') {
                        if (defaultSheetName) {
                            outName = defaultSheetName;
                        }
                    }
                    
                    const outPath = path.join(d, outName + '.csv');
                    fs.writeFileSync(outPath, csv);
                    console.log('Created ' + outPath);
                }
            } catch (e) {
                let csvFallback = '"Variable","Celda"\n';
                const kvRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
                let kvMatch;
                let found = false;
                while ((kvMatch = kvRegex.exec(objStr)) !== null) {
                    csvFallback += '"' + kvMatch[1] + '","' + kvMatch[2] + '"\n';
                    found = true;
                }
                if (found) {
                    let outName = name;
                    if (name.includes('GENERAL') || name === 'MAPEO_DE_CELDAS' || name === 'MAPEO_CELDAS_GENERAL_MT') {
                        if (defaultSheetName) {
                            outName = defaultSheetName;
                        }
                    }
                    const outPath = path.join(d, outName + '.csv');
                    fs.writeFileSync(outPath, csvFallback);
                    console.log('Created (fallback) ' + outPath);
                }
            }
        }
    });
});

