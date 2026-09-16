const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const clientLogos = path.join(root, 'client/public/logos');
const publicLogos = path.join(root, 'public/logos');
const clientPublic = path.join(root, 'client/public');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Arquivo não encontrado: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`OK: ${path.relative(root, dest)}`);
  return true;
}

ensureDir(clientLogos);
ensureDir(publicLogos);

// Atlas: uma imagem serve como logo, marca e favicon
const atlasCandidates = [
  path.join(clientLogos, 'atlas-agency.png'),
  path.join(publicLogos, 'atlas-agency.png'),
  path.join(clientLogos, 'atlas-agency.jpg'),
  path.join(publicLogos, 'atlas-agency.jpg'),
  path.join(clientLogos, 'atlas-original.png'),
  path.join(publicLogos, 'atlas-original.png'),
];

const atlasSrc = atlasCandidates.find((p) => fs.existsSync(p));
if (atlasSrc) {
  const targets = [
    path.join(clientLogos, 'atlas-agency.png'),
    path.join(publicLogos, 'atlas-agency.png'),
    path.join(clientLogos, 'atlas-agency-mark.png'),
    path.join(publicLogos, 'atlas-agency-mark.png'),
    path.join(clientLogos, 'atlas-agency-horizontal.png'),
    path.join(publicLogos, 'atlas-agency-horizontal.png'),
    path.join(clientPublic, 'favicon.png'),
  ];
  for (const dest of targets) copyIfExists(atlasSrc, dest);
} else {
  console.warn('Coloque sua logo Atlas em client/public/logos/atlas-agency.png');
}

// Fábio Garcia
const fabioCandidates = [
  path.join(clientLogos, 'fabio-garcia.png'),
  path.join(publicLogos, 'fabio-garcia.png'),
  path.join(clientLogos, 'fabio-garcia.jpg'),
  path.join(publicLogos, 'fabio-garcia.jpg'),
  path.join(clientLogos, 'fabio-original.png'),
  path.join(publicLogos, 'fabio-original.png'),
];

const fabioSrc = fabioCandidates.find((p) => fs.existsSync(p));
if (fabioSrc) {
  copyIfExists(fabioSrc, path.join(clientLogos, 'fabio-garcia.png'));
  copyIfExists(fabioSrc, path.join(publicLogos, 'fabio-garcia.png'));
} else {
  console.warn('Coloque a logo Fábio Garcia em client/public/logos/fabio-garcia.png');
}

console.log('\nPronto. Rode `npm run build` (ou `npm run dev`) para ver no site.');
