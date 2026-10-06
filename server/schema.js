/* Typen der bekannten Felder von Rezepten und Events (Abschnitt 7 der Übergabe).
   Die Oberfläche maskiert alles, was sie anzeigt; diese Prüfung ist die zweite Verteidigungslinie:
   Was kein Text sein darf, kommt gar nicht erst als Text in die Datenbank.
   Unbekannte Felder bleiben erlaubt, die Oberfläche zeigt sie nicht an. */

const text = max => ({type: 'string', maxLength: max});
const zahl = (min, max) => ({type: 'number', minimum: min, maximum: max});
const ja = {type: 'boolean'};
const ID = '^[A-Za-z0-9_-]{1,64}$';
const METHODEN = ['direkt', 'kuehl', 'poolish', 'biga'];
const spanne = {type: 'array', minItems: 2, maxItems: 2, items: zahl(0, 1000)};
const zeilen = {type: 'array', maxItems: 20, items: text(1000)};

export const recipeSchema = {
  type: 'object',
  required: ['name', 'methode', 'dauer', 'ballen', 'hyd', 'salz', 'oel', 'zucker', 'oben', 'unten', 'backMin', 'backMax'],
  properties: {
    id: {type: 'string', pattern: ID},
    name: text(200),
    methode: {enum: METHODEN},
    dauer: zahl(0, 1000), ballen: zahl(1, 5000),
    hyd: zahl(0, 200), salz: zahl(0, 100), oel: zahl(0, 100), zucker: zahl(0, 100), anteil: zahl(0, 100),
    oben: text(40), unten: text(40), backMin: zahl(0, 600), backMax: zahl(0, 600),
    formen: text(5000), notiz: text(5000), mehl: text(2000),
    quelle: {enum: ['mein', 'web', 'vorlage']}, quelleUrl: text(500),
    reserve: zahl(-50, 100), stdAnzahl: zahl(1, 200),
    maschine: ja, knetMin: zahl(0, 600),
    bigaKalt: ja, bigaHyd: zahl(0, 200), vtHefe: zahl(0, 100), htHefe: zahl(0, 100),
    stockMin: zahl(0, 10000), stueckMin: zahl(0, 10000), parkStd: zahl(0, 1000),
    hefeFix: zahl(0, 100), hefeArt: text(20),
    hefeProLiter: spanne, dauerRange: spanne, dauerMin: zahl(0, 1000),
    autolyseMin: zahl(0, 10000), stockKuehlH: zahl(0, 1000), akklMin: zahl(0, 10000),
    ballNachKuehl: ja, aktivMin: zahl(0, 10000), stockRtMin: zahl(0, 10000),
    zusatz: {type: 'array', maxItems: 20, items: {type: 'array', minItems: 2, maxItems: 2, items: [text(100), zahl(0, 100)]}},
    oelMl: ja, zuckerTL: ja,
    wasserVT: text(100), wasserHT: text(100),
    txt: {type: 'object', additionalProperties: false, properties: Object.fromEntries(['vorteig', 'autolyse', 'aktiv', 'kneten', 'stock', 'kuehl', 'ballen', 'raus'].map(k => [k, zeilen]))},
  },
};

const haken = {type: 'object', maxProperties: 500, additionalProperties: ja};
// Gästezahl: eine Zahl oder leer
const gaeste = {type: ['number', 'string'], minimum: 0, maximum: 1000, pattern: '^[0-9]{0,4}$'};

export const eventSchema = {
  type: 'object',
  required: ['essen', 'recipeId', 'anzahl'],
  properties: {
    id: {type: 'string', pattern: ID},
    name: text(200),
    // Lokale Zeit ohne Zone, wie sie das Formular liefert
    essen: {type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'},
    recipeId: {type: 'string', pattern: ID},
    methode: {enum: ['', ...METHODEN]},
    anzahl: zahl(1, 200), raumtemp: zahl(-20, 60),
    maschine: ja, dauer: zahl(0, 1000), park: zahl(0, 1000),
    erw: gaeste, kind: gaeste,
    done: haken,
    shop: {type: 'object', properties: {
      belag: {type: 'object', maxProperties: 100, additionalProperties: zahl(0, 1000)},
      extra: {type: 'array', maxItems: 200, items: {type: 'object', required: ['id', 'txt'], additionalProperties: false, properties: {id: {type: 'string', pattern: ID}, txt: text(200)}}},
      ok: haken,
    }},
    log: {type: 'object', properties: {
      sterne: {type: 'integer', minimum: 0, maximum: 5},
      raum: text(40), oben: text(40), unten: text(40), backzeit: text(40),
      gut: text(5000), aendern: text(5000),
      foto: ja, ts: zahl(0, 1e14),
    }},
  },
};
