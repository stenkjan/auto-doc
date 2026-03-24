const fs = require('fs');
const HOUSE = fs.readFileSync('generated-docs/_logo_house.txt', 'utf8');
let html = fs.readFileSync('generated-docs/angebot-baukoordinationsarbeiten-anb-2026-012.html', 'utf8');

const OLD = '<div class="logo-area"><div><div class="logo-wordmark">Eco Chalets</div><div class="logo-sub">Baukoordination &amp; ÖBA</div></div></div>';
const NEW = '<div class="logo-area"><img src="' + HOUSE + '" alt="Eco Chalets" style="width:28px;height:28px;object-fit:contain;"><div><div class="logo-wordmark">Eco Chalets</div><div class="logo-sub">Baukoordination &amp; ÖBA</div></div></div>';

const count = (html.split(OLD).length - 1);
console.log('Occurrences found:', count);
html = html.split(OLD).join(NEW);
fs.writeFileSync('generated-docs/angebot-baukoordinationsarbeiten-anb-2026-012.html', html);
console.log('Done. File size:', Math.round(html.length/1024), 'KB');
