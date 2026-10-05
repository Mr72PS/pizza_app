/* Seeds in die Datenbank schreiben. Entspricht `mergeSeed` im Prototyp:
   Jede Seed-ID wird genau einmal eingespielt und in der Liste `seeded` vermerkt.
   Gelöschte Vorlagen tauchen deshalb nicht wieder auf, neue Seeds werden nachgespielt. */
import {SEED} from '../public/calc.js';
import {getMeta, setMeta} from './db.js';

export function mergeSeed(db, seed = SEED, now = Date.now()) {
  const insert = db.prepare('INSERT OR IGNORE INTO recipes (id, data, updated_at, updated_by) VALUES (?, ?, ?, NULL)');
  return db.transaction(() => {
    const seeded = getMeta(db, 'seeded', []);
    const neu = [];
    for (const r of seed) {
      if (seeded.includes(r.id)) continue;
      seeded.push(r.id);
      // Ein bereits vorhandenes Rezept mit dieser ID bleibt unangetastet
      if (insert.run(r.id, JSON.stringify(r), now).changes) neu.push(r.id);
    }
    setMeta(db, 'seeded', seeded);
    return neu;
  })();
}
