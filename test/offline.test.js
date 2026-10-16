/* Offline: Ohne Server zeigt die Oberfläche den zuletzt gemerkten Stand, lässt aber nichts ändern.
   Die Oberfläche läuft hier wie in render-security.test.js ohne Browser, mit nachgebauten Globalen. */
process.env.TZ = 'Europe/Zurich';

import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {SEED} from '../public/calc.js';

const LAGER = 'pizza_app.stand';
const napo = SEED.find(r => r.id === 'napo');
const EVENT = {id: 'ev1', name: 'Abend ohne Netz', essen: '2030-01-05T19:00', recipeId: 'napo', methode: '', anzahl: 3, raumtemp: 21, maschine: false, dauer: 10, park: 0, erw: '', kind: '', done: {}};
const ICH = {id: 1, username: 'patric', role: 'admin'};

let html = '', netz = false, meldungen = [], anfragen = [];
const lager = new Map(), lauscher = {};
const klick = dataset => lauscher.click({target: {closest: () => ({dataset})}});
const warte = () => new Promise(r => setTimeout(r, 30));

before(async () => {
  const el = {set innerHTML(v) { html = v; }, get innerHTML() { return html; }};
  globalThis.document = {hidden: false, getElementById: () => el, addEventListener: (typ, fn) => { lauscher[typ] = fn; }, querySelector: () => ({hidden: false}), querySelectorAll: () => []};
  globalThis.window = {scrollTo() {}};
  globalThis.location = {reload() {}};
  globalThis.alert = m => meldungen.push(m); globalThis.confirm = () => true;
  globalThis.setInterval = () => 0;
  globalThis.localStorage = {getItem: k => lager.get(k) ?? null, setItem: (k, v) => lager.set(k, v), removeItem: k => lager.delete(k)};
  const antwort = (status, data) => ({status, ok: status < 300, headers: {get: () => '"t-1"'}, json: async () => data});
  globalThis.fetch = async (url, opt = {}) => {
    anfragen.push((opt.method || 'GET') + ' ' + url);
    if (!netz) throw new TypeError('fetch failed');
    if (url === '/api/me') return antwort(200, {user: ICH});
    if (url === '/api/state') return antwort(200, {recipes: [{id: 'napo', data: napo, updatedAt: 1}], events: [{id: 'ev1', data: {...EVENT, name: 'Abend mit Netz'}, updatedAt: 2}], photos: []});
    if (opt.method === 'PUT') return antwort(200, {updatedAt: 3});
    return antwort(204, null);
  };
  // Der Stand vom Samstag, 5. Januar 2030, 15:40 Uhr
  lager.set(LAGER, JSON.stringify({ts: new Date('2030-01-05T15:40:00').getTime(), me: ICH, recipes: [napo], events: [EVENT], fotos: {}}));
  await import('../public/app.js');
  await warte();
});

test('Start ohne Server: der gemerkte Stand erscheint mit Hinweis und Zeitpunkt', () => {
  assert.match(html, /Offline: Du siehst den Stand von Samstag, 05\.01\. um 15:40 Uhr\./);
  assert.match(html, /Abend ohne Netz/);
});

test('offline lassen sich Fahrplan, Küchenmodus, Einkaufsliste und Rezept öffnen', () => {
  for (const [dataset, text] of [[{openEvent: 'ev1'}, 'Fahrplan'], [{guide: 'ev1'}, 'Schritt'], [{shop: 'ev1'}, 'Einkaufsliste'], [{openRecipe: 'napo'}, 'Napoletana']]) {
    html = ''; klick(dataset);
    assert.ok(html.includes(text), JSON.stringify(dataset));
    assert.match(html, /^<p class="note"[^>]*>Offline:/);
  }
});

test('offline ändert kein Knopf etwas, und nichts geht an den Server', () => {
  klick({openEvent: 'ev1'});
  const vorher = lager.get(LAGER);
  anfragen = [];
  for (const dataset of [{toggle: 'kneten'}, {delEvent: 'ev1'}, {editEvent: 'ev1'}, {newEvent: ''}, {again: 'ev1'}, {log: 'ev1'}, {belag: 'margherita|1'}, {delRecipe: 'napo'}, {editRecipe: 'napo'}, {newRecipe: ''}]) {
    meldungen = []; klick(dataset);
    assert.deepEqual(meldungen, ['Ohne Verbindung zum Server lässt sich nichts ändern.'], JSON.stringify(dataset));
  }
  html = ''; klick({openEvent: 'ev1'});
  assert.match(html, /Abend ohne Netz/);
  assert.doesNotMatch(html, /class="st done/);
  assert.equal(lager.get(LAGER), vorher);
  assert.deepEqual(anfragen, []);
});

test('offline führt «Erledigt, weiter» zum nächsten Schritt, ohne abzuhaken', () => {
  klick({guide: 'ev1'});
  meldungen = []; html = ''; klick({done: 'kneten', step: '1'});
  assert.deepEqual(meldungen, []);
  assert.match(html, /Schritt 2 von/);
  html = ''; klick({openEvent: 'ev1'});
  assert.doesNotMatch(html, /class="st done/);
});

test('der Server ist wieder da: aktueller Stand, Hinweis weg, Ändern geht wieder', async () => {
  netz = true;
  lauscher.visibilitychange(); await warte();
  assert.doesNotMatch(html, /Offline:/);
  html = ''; klick({openEvent: 'ev1'});
  assert.match(html, /Abend mit Netz/);
  meldungen = []; anfragen = []; klick({toggle: 'kneten'}); await warte();
  assert.deepEqual(meldungen, []);
  assert.ok(anfragen.includes('PUT /api/events/ev1'));
  assert.equal(JSON.parse(lager.get(LAGER)).events[0].done.kneten, true, 'der gemerkte Stand folgt den eigenen Änderungen');
});

test('Abmelden löscht den gemerkten Stand', () => {
  klick({logout: ''});
  assert.equal(lager.has(LAGER), false);
});
