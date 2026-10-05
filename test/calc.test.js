/* Abnahmetests für die Rechenlogik, Abschnitt 8 der Übergabe.
   Essen am Samstag, 10. Oktober 2026, 19:00 Uhr, Küche 21 °C, Zeitzone Europe/Zurich. */
process.env.TZ = 'Europe/Zurich';

import {test, before, after, mock} from 'node:test';
import assert from 'node:assert/strict';
import {SEED, TAGE, hm, g, eff, plan, vorschlaege} from '../public/calc.js';

const ESSEN = '2026-10-10T19:00';
const rezept = id => SEED.find(r => r.id === id);
const wann = t => TAGE[t.getDay()] + ' ' + hm(t);
const rechne = (id, anzahl, zusatz = {}) => plan(rezept(id), {essen: ESSEN, anzahl, raumtemp: 21, ...zusatz});
const ablauf = p => p.steps.map(s => `${wann(s.t)} ${s.k}`);

// «Jetzt» festhalten, damit `past` und die Vorschläge nicht vom Tag des Testlaufs abhängen
before(() => mock.timers.enable({apis: ['Date'], now: new Date('2026-10-05T12:00:00')}));
after(() => mock.timers.reset());

test('Zeitzone ist Europe/Zurich', () => {
  assert.equal(new Date(ESSEN).toISOString(), '2026-10-10T17:00:00.000Z');
});

const TABELLE = [
  // Rezept, Pizzen, Zusatz, Mehl, Wasser, Salz, Hefe, Start, Schlüssel und Titel des ersten Schritts
  ['biga100', 3, {park: 6}, '500', '325', '14.0', '4.00', 'Fr 18:52', 'vorteig', 'Biga ansetzen'],
  ['biga100', 6, {}, '1000', '650', '28.0', '8.00', 'Sa 00:52', 'vorteig', 'Biga ansetzen'],
  ['donkarl', 4, {}, '500', '340', '15.0', '7.00', 'Fr 14:49', 'aktiv', 'Hefe ansetzen'],
  ['svens48', 3, {}, '500', '320', '15.0', '1.50', 'Do 18:12', 'autolyse', 'Mehl und Wasser mischen (Autolyse)'],
  ['avpn', 3, {}, '529', '311', '15.6', '0.42', 'Fr 18:27', 'kneten', 'Teig kneten'],
  ['avpn', 3, {dauer: 12}, '529', '311', '15.6', '0.93', 'Sa 06:27', 'kneten', 'Teig kneten'],
  ['napo', 3, {}, '520', '322', '13.5', '1.56', 'Sa 08:39', 'kneten', 'Teig kneten'],
  ['napo-poolish', 3, {}, '520', '322', '13.5', '0.77', 'Fr 22:39', 'vorteig', 'Poolish ansetzen'],
  ['ny', 3, {}, '509', '315', '10.2', '2.04', 'Do 15:39', 'kneten', 'Teig kneten'],
];

for (const [id, n, zusatz, mehl, wasser, salz, hefe, start, k, ttl] of TABELLE) {
  const name = `${id}, ${n} Pizzen${Object.keys(zusatz).length ? ', ' + JSON.stringify(zusatz) : ''}`;
  test(name, () => {
    const p = rechne(id, n, zusatz);
    assert.equal(g(p.m.mehl), mehl, 'Mehl');
    assert.equal(g(p.m.wasser), wasser, 'Wasser');
    assert.equal(g(p.m.salz, 1), salz, 'Salz');
    assert.equal(g(p.m.hefe, 2), hefe, 'Hefe');
    assert.equal(wann(p.steps[0].t), start, 'Start');
    assert.equal(p.steps[0].k, k);
    assert.equal(p.steps[0].ttl, ttl);
  });
}

test('biga100, 6 Pizzen: nacht = true', () => {
  assert.equal(rechne('biga100', 6).nacht, true);
});

test('biga100, 3 Pizzen mit 6 h parken: nichts in der Nacht, nichts in der Vergangenheit', () => {
  const p = rechne('biga100', 3, {park: 6});
  assert.equal(p.nacht, false);
  assert.equal(p.past, false);
  assert.deepEqual(p.warn, []);
});

test('biga100, 3 Pizzen, park 6: vollständige Schrittfolge und Mengen', () => {
  const p = rechne('biga100', 3, {park: 6});
  assert.deepEqual(ablauf(p), [
    'Fr 18:52 vorteig', 'Sa 08:52 kneten', 'Sa 09:12 stock', 'Sa 09:57 ballen',
    'Sa 12:57 park', 'Sa 18:12 ofen', 'Sa 18:57 backen',
  ]);
  assert.equal(g(p.pf.mehl), '500');
  assert.equal(g(p.pf.wasser), '225');
  assert.equal(g(p.pf.hefe), '4');
  assert.equal(g(p.pf.hWasser), '100');
  assert.equal(g(p.m.salz), '14');
  assert.equal(p.steps[0].d[0], '500 g Mehl (250 g Caputo Pizzeria «Tipo 00», 250 g Caputo Nuvola «Tipo 0»), 225 g kaltes Wasser, 4.0 g frische Hefe, oder 1.33 g Instanthefe.');
  assert.equal(p.steps[1].d[0], '100 g eiskaltes Wasser, 14.0 g Salz.');
});

test('donkarl, 4 Pizzen: vollständige Schrittfolge und Zusätze', () => {
  const p = rechne('donkarl', 4);
  assert.deepEqual(ablauf(p), [
    'Fr 14:49 aktiv', 'Fr 15:04 kneten', 'Fr 15:27 stock', 'Fr 16:57 kuehl',
    'Sa 16:57 ballen', 'Sa 18:12 ofen', 'Sa 18:57 backen',
  ]);
  assert.deepEqual(p.steps.map(s => s.ttl).slice(0, 5), [
    'Hefe ansetzen', 'Teig kneten', 'Teig gehen lassen', 'Teig in den Kühlschrank', 'Aus dem Kühlschrank, sofort portionieren',
  ]);
  assert.equal(p.m.zusatz[0][0], 'inaktive Lievito Madre');
  assert.equal(g(p.m.zusatz[0][1]), '20');
  assert.equal(g(p.m.oel / 0.92), '15', 'Öl in ml');
  assert.equal(g(p.m.zucker), '2');
  assert.match(p.steps[1].d[0], /20 g inaktive Lievito Madre, 15 ml Olivenöl/);
});

test('svens48, 3 Pizzen: vollständige Schrittfolge', () => {
  const p = rechne('svens48', 3);
  assert.deepEqual(ablauf(p), [
    'Do 18:12 autolyse', 'Do 18:42 kneten', 'Do 18:57 stock', 'Fr 18:57 ballen',
    'Sa 14:57 raus', 'Sa 18:12 ofen', 'Sa 18:57 backen',
  ]);
  assert.equal(p.steps[2].ttl, 'Teig im Ganzen in den Kühlschrank');
});

test('vorschlaege: biga100 mit 3 Pizzen ohne Parkzeit liefert drei Varianten', () => {
  const R = rezept('biga100'), e = {essen: ESSEN, anzahl: 3, raumtemp: 21};
  assert.equal(plan(R, e).nacht, true, 'ohne Parkzeit fällt der Start in die Nacht');
  const v = vorschlaege(R, e);
  assert.equal(v.length, 3);
  const c = v.find(x => x.D === 14 && x.P === 6);
  assert.ok(c, 'Variante «14 h, 6 h parken» fehlt');
  assert.equal(wann(c.t), 'Fr 18:52');
  assert.equal(c.txt, 'Reifezeit Biga 14 h wie im Rezept, fertige Teiglinge 6 h im Kühlschrank parken');
  for (const x of v) assert.ok(plan(R, {...e, dauer: x.D, park: x.P}).steps.every(s => s.t.getHours() >= 7 && s.t.getHours() < 22), 'alle Schritte zwischen 7 und 22 Uhr');
});

test('eff: ohne abweichende Teigführung bleibt das Rezept dasselbe Objekt', () => {
  const r = rezept('biga100');
  assert.equal(eff(r, {methode: ''}), r);
  assert.equal(eff(r, {methode: 'biga'}), r);
  assert.equal(eff(r, {methode: 'direkt'}).methode, 'direkt');
});

test('calc.js greift weder auf DOM noch auf Speicher zu', async () => {
  const {readFile} = await import('node:fs/promises');
  const src = await readFile(new URL('../public/calc.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(document|window|localStorage|fetch)\b/);
});
