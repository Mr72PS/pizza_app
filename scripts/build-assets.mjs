/* Erzeugt die statischen Bilder aus dem Logo und kopiert die Schriften nach public/.
   Die Ergebnisse liegen im Repo. Dieses Skript braucht es nur, wenn sich das Logo oder die Schriften ändern:
   npm run assets */
import sharp from 'sharp';
import {copyFileSync, mkdirSync} from 'node:fs';

const LOGO = 'logo-pizzeria-patricio.png';
const CREME = '#FBF6EA'; // Hintergrund des Logos
mkdirSync('public/img', {recursive: true});
mkdirSync('public/fonts', {recursive: true});

// Kopf-Icon: Bereich 375,155 bis 645,425 des Originals
await sharp(LOGO).extract({left: 375, top: 155, width: 270, height: 270}).resize(112, 112).webp({quality: 82}).toFile('public/img/kopf.webp');
// Siegel für «Meine Rezepte»
await sharp(LOGO).resize(320, 320).webp({quality: 82}).toFile('public/img/siegel.webp');
// App-Icons
for (const n of [32, 180, 192, 512]) await sharp(LOGO).resize(n, n).png().toFile(`public/img/icon-${n}.png`);
// Maskierbares Icon: Logo mit Rand, damit runde Masken nichts abschneiden
await sharp(LOGO).resize(410, 410).extend({top: 51, bottom: 51, left: 51, right: 51, background: CREME}).png().toFile('public/img/icon-maskable-512.png');

const FS = 'node_modules/@fontsource-variable';
for (const [von, nach] of [
  [`${FS}/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2`, 'bricolage-grotesque.woff2'],
  [`${FS}/bricolage-grotesque/LICENSE`, 'bricolage-grotesque-OFL.txt'],
  [`${FS}/instrument-sans/files/instrument-sans-latin-wght-normal.woff2`, 'instrument-sans.woff2'],
  [`${FS}/instrument-sans/LICENSE`, 'instrument-sans-OFL.txt'],
]) copyFileSync(von, `public/fonts/${nach}`);
console.log('Bilder und Schriften erzeugt.');
