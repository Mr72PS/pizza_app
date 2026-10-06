/* Backend: Seeds, API für Rezepte und Events, Versionsmarke. */
import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {startApp, client, tempDir, removeDir, EVENT, REZEPT} from './helper.js';
import {mergeSeed} from '../server/seed.js';
import {getMeta} from '../server/db.js';
import {SEED} from '../public/calc.js';

let dir, app, c;
// Jeder Start meldet den Admin neu an, wie ein Browser nach einem Neustart des Servers mit gültigem Cookie
const start = async () => { app = await startApp(dir); c = client(app); await c.login(); };
const call = async (...a) => { const r = await c.call(...a); return {status: r.status, body: r.body}; };
const state = async () => (await call('GET', '/api/state')).body;

beforeEach(async () => { dir = tempDir(); await start(); });
afterEach(async () => { await app.close(); removeDir(dir); });

test('healthz antwortet ohne Anmeldung und ohne Daten', async () => {
  assert.deepEqual(await client(app).call('GET', '/healthz').then(r => ({status: r.status, body: r.body})), {status: 200, body: {ok: true}});
});

test('Datenbank und Fotoordner liegen im Datenverzeichnis, WAL ist an', () => {
  assert.ok(existsSync(join(dir, 'pizza_app.sqlite')));
  assert.ok(existsSync(join(dir, 'fotos')));
  assert.equal(app.db.pragma('journal_mode', {simple: true}), 'wal');
});

test('erster Start: alle Seeds unverändert und in der Reihenfolge des Prototyps', async () => {
  const s = await state();
  assert.deepEqual(s.recipes.map(r => r.data), SEED);
  assert.deepEqual(s.recipes.map(r => r.id), SEED.map(r => r.id));
  assert.deepEqual(s.events, []);
  assert.deepEqual(getMeta(app.db, 'seeded'), SEED.map(r => r.id));
});

test('gelöschte Vorlage taucht nach einem Neustart nicht wieder auf', async () => {
  assert.equal((await call('DELETE', '/api/recipes/pfanne')).status, 204);
  await app.close(); await start();
  const ids = (await state()).recipes.map(r => r.id);
  assert.equal(ids.includes('pfanne'), false);
  assert.equal(ids.length, SEED.length - 1);
});

test('geändertes Seed-Rezept wird beim Neustart nicht überschrieben', async () => {
  const r = (await state()).recipes.find(x => x.id === 'napo');
  await call('PUT', '/api/recipes/napo', {data: {...r.data, oben: '440'}, updatedAt: r.updatedAt});
  await app.close(); await start();
  assert.equal((await state()).recipes.find(x => x.id === 'napo').data.oben, '440');
});

test('neue Seeds werden nachgespielt, vorhandene IDs bleiben unangetastet', async () => {
  const neu = mergeSeed(app.db, [...SEED, {id: 'neu-1', name: 'Neu'}, {id: 'napo', name: 'anders'}]);
  assert.deepEqual(neu, ['neu-1']);
  const s = await state();
  assert.equal(s.recipes.at(-1).id, 'neu-1');
  assert.equal(s.recipes.find(r => r.id === 'napo').data.name, 'Napoletana');
  assert.deepEqual(mergeSeed(app.db, [...SEED, {id: 'neu-1', name: 'Neu'}]), []);
});

test('Rezept anlegen, ändern, löschen', async () => {
  const neu = await call('PUT', '/api/recipes/abc12345', {data: REZEPT});
  assert.equal(neu.status, 201);
  assert.deepEqual(neu.body.data, {...REZEPT, id: 'abc12345'});
  const upd = await call('PUT', '/api/recipes/abc12345', {data: {...neu.body.data, hyd: 62}, updatedAt: neu.body.updatedAt});
  assert.equal(upd.status, 200);
  assert.ok(upd.body.updatedAt > neu.body.updatedAt);
  assert.equal((await state()).recipes.at(-1).data.hyd, 62);
  assert.equal((await call('DELETE', '/api/recipes/abc12345')).status, 204);
  assert.equal((await state()).recipes.length, SEED.length);
});

test('optionale Rezeptfelder bleiben beim Speichern erhalten', async () => {
  const r = (await state()).recipes.find(x => x.id === 'donkarl');
  const res = await call('PUT', '/api/recipes/donkarl', {data: {...r.data, notiz: 'neu'}, updatedAt: r.updatedAt});
  assert.deepEqual(res.body.data, {...SEED.find(x => x.id === 'donkarl'), notiz: 'neu'});
});

test('veraltete Marke wird mit 409 abgelehnt und liefert den aktuellen Stand', async () => {
  const r = (await state()).recipes.find(x => x.id === 'ny');
  const a = await call('PUT', '/api/recipes/ny', {data: {...r.data, oben: '350'}, updatedAt: r.updatedAt});
  assert.equal(a.status, 200);
  const b = await call('PUT', '/api/recipes/ny', {data: {...r.data, oben: '300'}, updatedAt: r.updatedAt});
  assert.equal(b.status, 409);
  assert.equal(b.body.current.data.oben, '350');
  assert.equal(b.body.current.updatedAt, a.body.updatedAt);
});

test('409 auch ohne Marke bei vorhandenem Datensatz und mit Marke bei gelöschtem', async () => {
  assert.equal((await call('PUT', '/api/recipes/ny', {data: REZEPT})).status, 409);
  const weg = await call('PUT', '/api/events/gibtsnicht', {data: EVENT, updatedAt: 123});
  assert.equal(weg.status, 409);
  assert.equal(weg.body.current, null);
});

test('Event anlegen, ändern, löschen', async () => {
  const data = {name: 'Pizza-Abend', essen: '2026-10-10T19:00', recipeId: 'biga100', methode: '', anzahl: 3, raumtemp: 21, maschine: true, dauer: 14, park: 6, erw: '', kind: '', done: {}};
  const neu = await call('PUT', '/api/events/ev1', {data});
  assert.equal(neu.status, 201);
  const upd = await call('PUT', '/api/events/ev1', {data: {...data, done: {vorteig: true}, shop: {belag: {margherita: 3}, extra: [], ok: {}}}, updatedAt: neu.body.updatedAt});
  assert.equal(upd.status, 200);
  const s = await state();
  assert.equal(s.events.length, 1);
  assert.deepEqual(s.events[0].data.done, {vorteig: true});
  assert.equal(s.events[0].data.essen, '2026-10-10T19:00');
  assert.equal((await call('DELETE', '/api/events/ev1')).status, 204);
  assert.deepEqual((await state()).events, []);
});

test('ungültige Anfragen werden mit 400 abgelehnt', async () => {
  assert.equal((await call('PUT', '/api/recipes/a%20b', {data: {}})).status, 400);
  assert.equal((await call('PUT', '/api/recipes/ok', {})).status, 400);
  assert.equal((await call('PUT', '/api/recipes/ok', {data: 'text'})).status, 400);
  assert.equal((await call('PUT', '/api/recipes/ok', {data: {}, updatedAt: 'gestern'})).status, 400);
});

test('das Frontend wird ausgeliefert', async () => {
  const html = await app.inject({method: 'GET', url: '/'});
  assert.equal(html.statusCode, 200);
  assert.match(html.body, /<main id="app">/);
  assert.equal((await app.inject({method: 'GET', url: '/calc.js'})).statusCode, 200);
});

test('Schriften, Bilder, Manifest und Service Worker liegen lokal', async () => {
  const get = url => app.inject({method: 'GET', url});
  const manifest = await get('/manifest.webmanifest');
  assert.equal(manifest.statusCode, 200);
  for (const icon of manifest.json().icons) assert.equal((await get(icon.src)).statusCode, 200, icon.src);
  const sw = await get('/sw.js');
  assert.match(sw.headers['content-type'], /javascript/);
  const liste = JSON.parse(sw.body.match(/const STATISCH = (\[[\s\S]*?\]);/)[1].replaceAll("'", '"').replace(/,\s*\]/, ']'));
  for (const url of liste) assert.equal((await get(url)).statusCode, 200, url);
  // Nichts wird mehr von aussen geladen, nichts ist als Base64 eingebettet
  for (const url of ['/', '/app.css', '/app.js']) assert.doesNotMatch((await get(url)).body, /googleapis|gstatic|data:image|window\.claude|localStorage/, url);
  assert.doesNotMatch((await get('/')).headers['content-security-policy'], /https?:/);
});

test('jedes Seed-Rezept besteht die Typprüfung und bleibt beim Speichern unverändert', async () => {
  for (const r of (await state()).recipes) {
    const res = await call('PUT', '/api/recipes/' + r.id, {data: r.data, updatedAt: r.updatedAt});
    assert.equal(res.status, 200, r.id);
    assert.deepEqual(res.body.data, SEED.find(x => x.id === r.id), r.id);
  }
});

test('ein Event, wie es die Oberfläche speichert, besteht die Typprüfung', async () => {
  const data = {id: 'ev1', done: {vorteig: true, kneten: false}, name: '', essen: '2026-10-10T19:00', recipeId: 'biga100', methode: '', anzahl: 3, raumtemp: 21, maschine: true, dauer: 14, park: 0.5, erw: 4, kind: '',
    shop: {belag: {margherita: 2, diavola: 1}, extra: [{id: 'k3j2h1g0', txt: 'Wein'}], ok: {'teig:Salz': true, 'x:k3j2h1g0': false}},
    log: {sterne: 5, raum: '21', oben: '450 (max.)', unten: '430–450', backzeit: '2:30', gut: 'Rand', aendern: '', foto: true, ts: 1791223572094}};
  const res = await call('PUT', '/api/events/ev1', {data});
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.data, data);
});

test('Werte vom falschen Typ werden abgelehnt und nicht gespeichert', async () => {
  const boese = '"><img src=x onerror=alert(1)>';
  const rezept = (await state()).recipes.find(r => r.id === 'napo');
  for (const [feld, wert] of [['backMin', boese], ['backMax', boese], ['dauer', boese], ['ballen', boese], ['hyd', {}], ['methode', boese], ['methode', 'x'], ['quelle', boese],
    ['zusatz', [[boese, boese]]], ['zusatz', boese], ['txt', {kneten: [{}]}], ['txt', boese], ['hefeProLiter', [boese, 1]], ['name', 'x'.repeat(201)], ['maschine', boese]]) {
    assert.equal((await call('PUT', '/api/recipes/napo', {data: {...rezept.data, [feld]: wert}, updatedAt: rezept.updatedAt})).status, 400, 'Rezept.' + feld);
  }
  for (const [feld, wert] of [['anzahl', boese], ['anzahl', 0], ['raumtemp', boese], ['dauer', boese], ['park', boese], ['erw', boese], ['kind', '-1'], ['essen', boese], ['essen', '2026-10-10'], ['recipeId', '../x'], ['methode', boese],
    ['done', {vorteig: boese}], ['shop', {extra: [{id: boese, txt: 'x'}]}], ['shop', {extra: [{id: 'a'}]}], ['shop', {extra: boese}], ['shop', {belag: {margherita: boese}}], ['shop', {ok: {a: boese}}],
    ['log', {sterne: boese}], ['log', {sterne: 6}], ['log', {ts: boese}], ['log', {foto: boese}], ['log', {raum: 'x'.repeat(41)}]]) {
    assert.equal((await call('PUT', '/api/events/neu', {data: {...EVENT, [feld]: wert}})).status, 400, 'Event.' + feld + ' = ' + JSON.stringify(wert));
  }
  for (const feld of ['essen', 'recipeId', 'anzahl']) { const d = {...EVENT}; delete d[feld]; assert.equal((await call('PUT', '/api/events/neu', {data: d})).status, 400, 'ohne ' + feld); }
  const s = await state();
  assert.deepEqual(s.events, []);
  assert.deepEqual(s.recipes.find(r => r.id === 'napo').data, rezept.data);
});
