/* Prüfpunkt 6: Was Benutzer speichern, darf in der Oberfläche nie als HTML ankommen.
   Die API nimmt beliebiges JSON an; ein angemeldeter Benutzer kann also an der Oberfläche vorbei jedes Feld mit jedem Wert füllen.
   Der Test lädt public/app.js mit einem kleinen DOM-Ersatz, füttert es mit präparierten Datensätzen
   und sucht im erzeugten HTML nach der eingeschleusten Marke. */
import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {SEED} from '../public/calc.js';

const BOESE = '"><i pwn>';      // bricht aus Attributen aus und setzt ein Element
const LECK = '<i pwn>';

// Pro Feld ein eigener Datensatz, damit der Test das undichte Feld benennen kann
const basisEvent = {name: 'Pizza-Abend', essen: '2030-01-05T19:00', recipeId: 'napo', methode: '', anzahl: 3, raumtemp: 21, maschine: false, dauer: 10, park: 0, erw: '', kind: '', done: {},
  shop: {belag: {margherita: 3}, extra: [{id: 'x1', txt: 'Wein'}], ok: {}},
  log: {sterne: 4, raum: '21', oben: '450', unten: '430', backzeit: '2:30', gut: 'Rand', aendern: 'Salz', foto: true, ts: 1}};
const setze = (obj, pfad, wert) => { const o = structuredClone(obj); let z = o; const k = pfad.split('.'); while (k.length > 1) { const s = k.shift(); z = z[s]; } z[k[0]] = wert; return o; };
const EVENT_FELDER = ['name', 'anzahl', 'raumtemp', 'dauer', 'park', 'erw', 'kind', 'essen', 'methode', 'shop.extra.0.id', 'shop.extra.0.txt', 'log.sterne', 'log.raum', 'log.oben', 'log.unten', 'log.backzeit', 'log.gut', 'log.aendern', 'log.ts'];
const REZEPT_FELDER = ['name', 'notiz', 'formen', 'mehl', 'oben', 'unten', 'backMin', 'backMax', 'quelleUrl', 'wasserVT', 'wasserHT', 'hefeArt'];
const napo = SEED.find(r => r.id === 'napo'), biga = SEED.find(r => r.id === 'biga100');

const events = EVENT_FELDER.map((f, i) => ({id: 'e' + i, feld: f, data: {...setze(basisEvent, f, BOESE), id: 'e' + i}}));
const rezepte = REZEPT_FELDER.map((f, i) => ({id: 'r' + i, feld: f, data: {...structuredClone(f.startsWith('wasser') ? biga : napo), id: 'r' + i, quelle: 'mein', [f]: BOESE}}));
// Zu jedem präparierten Rezept ein Event, damit es auch in Zeitplan, Anleitung und Einkaufsliste auftaucht
// Ein Rezept und ein Event mit einer Teigführung, die es nicht gibt
const KAPUTT = [{id: 'rk', data: {...structuredClone(napo), id: 'rk', methode: 'gibtsnicht'}}, {id: 'ek', data: {...structuredClone(basisEvent), id: 'ek', methode: 'gibtsnicht'}}];
const OHNE_FOTO = {id: 'eo', data: {...structuredClone(basisEvent), id: 'eo'}};
const rezeptEvents = rezepte.map((r, i) => ({id: 'er' + i, feld: 'Rezept.' + r.feld, data: {...structuredClone(basisEvent), id: 'er' + i, recipeId: r.id}}));

let klick, html;
before(async () => {
  const el = {set innerHTML(v) { html = v; }, get innerHTML() { return html; }};
  const lauscher = {};
  globalThis.document = {
    hidden: false,
    getElementById: () => el,
    addEventListener: (typ, fn) => { lauscher[typ] = fn; },
    querySelector: () => ({hidden: false}),
    querySelectorAll: () => [],
  };
  globalThis.window = {scrollTo() {}};
  globalThis.alert = () => {}; globalThis.confirm = () => false;
  globalThis.setInterval = () => 0;
  const antwort = (status, data) => ({status, ok: status < 300, json: async () => data});
  globalThis.fetch = async url => {
    if (url === '/api/me') return antwort(200, {user: {id: 1, username: BOESE, role: 'admin'}});
    if (url === '/api/users') return antwort(200, {users: [{id: 1, username: BOESE, role: 'admin'}, {id: 2, username: BOESE + '2', role: 'user', disabled: true, locked: true}]});
    if (url === '/api/state') return antwort(200, {
      recipes: [{id: 'napo', data: napo, updatedAt: 1}, {...KAPUTT[0], updatedAt: 1}, ...rezepte.map(r => ({id: r.id, data: r.data, updatedAt: 1}))],
      events: [{...KAPUTT[1], updatedAt: 1}, {...OHNE_FOTO, updatedAt: 1}, ...[...events, ...rezeptEvents].map(e => ({id: e.id, data: e.data, updatedAt: 1}))],
      // Jedes Event ausser «eo» hat ein Foto, e0 zwei, e1 dazu eines mit präparierter Kennung
      photos: [...[KAPUTT[1], ...events, ...rezeptEvents].map(e => ({eventId: e.id, id: 'f1'})), {eventId: 'e0', id: 'f2'}, {eventId: 'e1', id: BOESE}],
    });
    return antwort(204, null);
  };
  await import('../public/app.js');
  await new Promise(r => setTimeout(r, 50));
  klick = dataset => lauscher.click({target: {closest: () => ({dataset})}});
});

// Ruft eine Ansicht auf und meldet, ob die Marke als HTML durchkommt. Ein Absturz der Ansicht zählt nicht als Leck.
function zeigt(dataset) {
  html = '';
  try { klick(dataset); } catch { return false; }
  return html.includes(LECK);
}
const EVENT_ANSICHTEN = id => [{openEvent: id}, {shop: id}, {log: id}, {guide: id}, {editEvent: id}, {again: id}, {lbE: id, lbP: 'f1'}, {lbE: id, lbP: 'f1', lbAlle: '1'}, {lbE: id, lbP: BOESE}];
const REZEPT_ANSICHTEN = id => [{openRecipe: id}, {editRecipe: id}, {newEvent: id}];

test('6a: Listen und Konto zeigen gespeicherte Texte nie als HTML', async () => {
  const lecks = [];
  if (zeigt({nav: 'events'})) lecks.push('Event-Liste');
  if (zeigt({nav: 'recipes'})) lecks.push('Rezept-Liste');
  klick({nav: 'konto'}); await new Promise(r => setTimeout(r, 20));
  if (html.includes(LECK)) lecks.push('Konto und Benutzerliste');
  assert.deepEqual(lecks, []);
});

test('6b: kein Feld eines Events kommt als HTML in die Oberfläche', () => {
  const lecks = events.filter(e => EVENT_ANSICHTEN(e.id).some(zeigt)).map(e => e.feld);
  assert.deepEqual(lecks, []);
});

test('6c: kein Feld eines Rezepts kommt als HTML in die Oberfläche', () => {
  const direkt = rezepte.filter(r => REZEPT_ANSICHTEN(r.id).some(zeigt)).map(r => r.feld);
  const ueberEvent = rezeptEvents.filter(e => EVENT_ANSICHTEN(e.id).some(zeigt)).map(e => e.feld);
  assert.deepEqual([...direkt, ...ueberEvent], []);
});

test('6d: Links zur Quelle sind nur http oder https', () => {
  html = ''; klick({nav: 'recipes'});
  assert.doesNotMatch(html, /href="(?!https?:\/\/)/i);
  for (const r of rezepte) { html = ''; try { klick({openRecipe: r.id}); } catch {} assert.doesNotMatch(html, /href="(?!https?:\/\/)/i, r.feld); }
});

test('6e: ein Datensatz mit unbekannter Teigführung legt weder die Event-Liste noch die Rezept-Liste lahm', () => {
  for (const [nav, id] of [['events', 'ek'], ['recipes', 'rk']]) {
    html = '';
    assert.doesNotThrow(() => klick({nav}), nav);
    assert.ok(html.includes('data-open-' + (nav === 'events' ? 'event' : 'recipe') + '="' + id + '"'), nav + ' zeigt den Eintrag');
  }
});

test('6f: die Galerie zeigt jedes Foto als Kachel, mit Datum und Bewertung darunter und ohne gespeicherte Texte als HTML', () => {
  html = '';
  assert.doesNotThrow(() => klick({nav: 'galerie'}));
  assert.ok(!html.includes(LECK), 'kein Feld kommt als HTML an');
  for (const pid of ['f1', 'f2']) assert.match(html, new RegExp(`<button[^>]*data-lb-e="e0"[^>]*data-lb-p="${pid}"[^>]*><img[^>]*src="/api/events/e0/photos/${pid}[?]klein=1"[^>]*><span[^>]*><span>Sa, 5\\.1\\.2030</span><span[^>]*>★ 4</span></span></button>`));
  assert.ok(!html.includes('data-lb-e="eo"'), 'Event ohne Foto fehlt');
});

test('6h: Grossansicht blättert durch die Galerie oder durch die Fotos eines Events', () => {
  html = ''; klick({nav: 'galerie'}); klick({lbE: 'e0', lbP: 'f1', lbAlle: '1'});
  assert.match(html, /<img[^>]*src="\/api\/events\/e0\/photos\/f1"/);
  assert.match(html, /data-lb-e="e0"[^>]*data-lb-p="f2"[^>]*data-lb-alle/, 'weiter zum nächsten Foto der Galerie');
  assert.ok(html.includes('data-zum-event="e0"'), 'aus der Galerie führt ein Knopf zum Event');

  klick({zumEvent: 'e0'});
  assert.ok(html.includes('data-nav="galerie">‹ Galerie'), 'vom Event zurück in die Galerie');
  klick({nav: 'events'}); klick({openEvent: 'e0'});
  assert.ok(html.includes('data-nav="events">‹ Events'), 'sonst zurück zu den Events');

  klick({lbE: 'e0', lbP: 'f2'});
  assert.ok(html.includes('2 / 2'), 'aus dem Event nur dessen Fotos');
  assert.ok(!html.includes('data-zum-event'));
  klick({lbZu: ''});
  assert.ok(html.includes('Backprotokoll'), 'Schliessen führt zurück ins Event');
});

test('6i: das Event zeigt alle seine Fotos, das Protokollformular jedes mit eigenem Entfernen-Knopf', () => {
  html = ''; klick({openEvent: 'e0'});
  for (const pid of ['f1', 'f2']) assert.ok(html.includes(`src="/api/events/e0/photos/${pid}?klein=1"`), pid);
  klick({openEvent: 'e2'});
  assert.ok(html.includes('src="/api/events/e2/photos/f1"'), 'ein einzelnes Foto in voller Grösse');
  klick({log: 'e0'});
  for (const pid of ['f1', 'f2']) assert.ok(html.includes(`data-foto-del="${pid}"`), pid);
  assert.match(html, /<input type="file" id="fotoIn"[^>]*multiple/);
});

test('6j: «Nochmals so» öffnet ein neues Event mit den Angaben des alten und einem neuen Termin', () => {
  html = ''; klick({openEvent: 'eo'});
  assert.ok(html.includes('data-again="eo"'));
  klick({again: 'eo'});
  assert.ok(html.includes('>Event planen</h1>'), 'ein neues Event, nicht das alte zum Ändern');
  assert.ok(html.includes('name="name" value="Pizza-Abend"'));
  assert.ok(html.includes('name="anzahl" min="1" max="40" value="3"'));
  const termin = /name="essen" value="([^"]*)"/.exec(html)[1];
  assert.ok(new Date(termin) > new Date() && new Date(termin).getDay() === 6, 'nächster Samstag statt des alten Termins: ' + termin);
});

test('6g: die Event-Liste zeigt das Jahr über dem Datum', () => {
  html = ''; klick({nav: 'events'});
  assert.match(html, /<span class="when"><span>2030<\/span>Sa 05\.01\.<span>19:00 Uhr<\/span><\/span>/);
});

test('6k: ein Event mit unbekannter Teigführung lässt sich öffnen, es gilt die Teigführung des Rezepts', () => {
  for (const ansicht of EVENT_ANSICHTEN('ek').slice(0, 6)) {
    html = '';
    assert.doesNotThrow(() => klick(ansicht), JSON.stringify(ansicht));
    assert.ok(html.length > 200, JSON.stringify(ansicht) + ' zeigt etwas an');
  }
  klick({openEvent: 'ek'});
  assert.ok(html.includes('Zeitplan') && html.includes('data-toggle='), 'mit Zeitplan');
});
