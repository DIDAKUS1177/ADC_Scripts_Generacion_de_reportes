const fs = require('fs');
const path = require('path');
const dirs = ['APP001_Espesores_UT', 'APP019_Riesgo_Duct_RBI'];

dirs.forEach(d => {
    const jsFile = path.join(d, d + '.js');
    if (!fs.existsSync(jsFile)) return;
    const content = fs.readFileSync(jsFile, 'utf8');
    const regex = /const\s+(MAPEO\w*)\s*=\s*(\{[\s\S]*?\});/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        let objStr = match[2];
        try {
            // loose eval
            const obj = new Function('return ' + objStr)();
            let csv = "Variable","Celda"\n;
            for (let k in obj) {
                csv += "",""\n;
            }
            fs.writeFileSync(path.join(d, name + '.csv'), csv);
            console.log(Created );
        } catch (e) {
            console.log(Error parsing  in : );
        }
    }
});
