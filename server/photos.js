/* Fotos zum Backprotokoll: JPEGs als Dateien im Volume, mehrere pro Event, ausgeliefert hinter der Anmeldung.
   Der Server traut der hochgeladenen Datei nicht: Er dekodiert sie als Bild und speichert nur das, was er selbst neu kodiert hat. */
import sharp from 'sharp';
import {writeFile, readFile, unlink} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_BYTES = 2 * 1024 * 1024;
// Der Browser verkleinert auf 800 px. Das Limit greift vor dem Dekodieren und stoppt Dekompressionsbomben.
const MAX_PIXEL = 25_000_000;
const MAX_KANTE = 1600;
const MAX_PRO_EVENT = 10;
sharp.cache(false);

/* Liefert ein frisch kodiertes JPEG ohne Metadaten und ohne angehängte Daten, oder null, wenn es kein gültiges JPEG ist. */
async function neuKodieren(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) return null;
  try {
    const bild = sharp(buf, {limitInputPixels: MAX_PIXEL, failOn: 'error', sequentialRead: true});
    if ((await bild.metadata()).format !== 'jpeg') return null;
    // rotate() übernimmt die Drehung aus den EXIF-Daten ins Bild; die Metadaten selbst schreibt sharp nicht mit
    return await bild.rotate().resize(MAX_KANTE, MAX_KANTE, {fit: 'inside', withoutEnlargement: true}).jpeg({quality: 82}).toBuffer();
  } catch {
    return null;
  }
}

export function registerPhotos(app, {db, dataDir, idPattern}) {
  const dir = join(dataDir, 'fotos');
  const id = {type: 'string', pattern: idPattern};
  const params = {type: 'object', properties: {id, pid: id}};
  const q = {
    event: db.prepare('SELECT 1 FROM events WHERE id = ?'),
    all: db.prepare('SELECT event_id AS eventId, photo_id AS id FROM event_photos ORDER BY created_at, rowid'),
    ofEvent: db.prepare('SELECT photo_id, filename FROM event_photos WHERE event_id = ?'),
    get: db.prepare('SELECT filename FROM event_photos WHERE event_id = ? AND photo_id = ?'),
    count: db.prepare('SELECT COUNT(*) n FROM event_photos WHERE event_id = ?'),
    put: db.prepare('INSERT INTO event_photos (event_id, photo_id, filename, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, photo_id) DO UPDATE SET filename = excluded.filename'),
    del: db.prepare('DELETE FROM event_photos WHERE event_id = ? AND photo_id = ?'),
  };

  async function removeOne(eventId, photoId) {
    const row = q.get.get(eventId, photoId);
    if (!row) return;
    q.del.run(eventId, photoId);
    await unlink(join(dir, row.filename)).catch(() => {});
  }

  // Alle Fotos eines Events, wenn das Event gelöscht wird
  async function remove(eventId) {
    for (const row of q.ofEvent.all(eventId)) await removeOne(eventId, row.photo_id);
  }

  // Nur image/jpeg wird überhaupt gelesen, und höchstens MAX_BYTES; alles andere beantwortet Fastify mit 415 oder 413
  app.addContentTypeParser('image/jpeg', {parseAs: 'buffer', bodyLimit: MAX_BYTES}, (req, body, done) => done(null, body));

  app.put('/api/events/:id/photos/:pid', {schema: {params}}, async (req, reply) => {
    const {id: eventId, pid} = req.params;
    if (!q.event.get(eventId)) return reply.code(404).send({error: 'notfound'});
    const jpeg = await neuKodieren(req.body);
    if (!jpeg) return reply.code(400).send({error: 'jpeg'});
    // Nach dem Dekodieren zählen: Ab hier läuft alles ohne Unterbruch, zwei gleichzeitige Uploads kommen nicht beide über die Grenze
    if (!q.get.get(eventId, pid) && q.count.get(eventId).n >= MAX_PRO_EVENT) return reply.code(409).send({error: 'limit'});
    // Der Dateiname entsteht nur aus den geprüften Kennungen, die Endung setzt der Server. Der Punkt kommt in Kennungen nicht vor.
    const filename = eventId + '.' + pid + '.jpg';
    q.put.run(eventId, pid, filename, Date.now());
    await writeFile(join(dir, filename), jpeg);
    return reply.code(204).send();
  });

  app.get('/api/events/:id/photos/:pid', {schema: {params}}, async (req, reply) => {
    const row = q.get.get(req.params.id, req.params.pid);
    const data = row && await readFile(join(dir, row.filename)).catch(() => null);
    if (!data) return reply.code(404).send({error: 'notfound'});
    // Kein immutable: Unter derselben Kennung kann ein Foto ersetzt werden
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'private, max-age=31536000').send(data);
  });

  app.delete('/api/events/:id/photos/:pid', {schema: {params}}, async (req, reply) => {
    await removeOne(req.params.id, req.params.pid);
    return reply.code(204).send();
  });

  return {remove, list: () => q.all.all()};
}
