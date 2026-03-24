const fs = require('fs');
const HOUSE = fs.readFileSync('generated-docs/_logo_house.txt', 'utf8');
let html = fs.readFileSync('generated-docs/angebot-baukoordinationsarbeiten-anb-2026-012.html', 'utf8');
html = html.split('PLACEHOLDER_HOUSE_COVER').join(HOUSE);
fs.writeFileSync('generated-docs/angebot-baukoordinationsarbeiten-anb-2026-012.html', html);
console.log('Done. Remaining placeholders:', (html.match(/PLACEHOLDER/g)||[]).length);
