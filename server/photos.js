/* Fotos zum Backprotokoll: ein JPEG pro Event als Datei im Volume, ausgeliefert hinter der Anmeldung.
   Der Server traut der hochgeladenen Datei nicht: Er dekodiert sie als Bild und speichert nur das, was er selbst neu kodiert hat. */
import sharp from 'sharp';
import {writeFile, readFile, unlink} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_BYTES = 2 * 1024 * 1024;
// Der Browser verkleinert auf 800 px. Das Limit greift vor dem Dekodieren und stoppt Dekompressionsbomben.
const MAX_PIXEL = 25_000_000;
const MAX_KANTE = 1600;
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
  const params = {type: 'object', properties: {id: {type: 'string', pattern: idPattern}}};
  const q = {
    event: db.prepare('SELECT 1 FROM events WHERE id = ?'),
    get: db.prepare('SELECT filename FROM photos WHERE event_id = ?'),
    put: db.prepare('INSERT INTO photos (event_id, filename, created_at) VALUES (?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET filename = excluded.filename, created_at = excluded.created_at'),
    del: db.prepare('DELETE FROM photos WHERE event_id = ?'),
  };

  async function remove(eventId) {
    const row = q.get.get(eventId);
    if (!row) return;
    q.del.run(eventId);
    await unlink(join(dir, row.filename)).catch(() => {});
  }

  // Nur image/jpeg wird überhaupt gelesen, und höchstens MAX_BYTES; alles andere beantwortet Fastify mit 415 oder 413
  app.addContentTypeParser('image/jpeg', {parseAs: 'buffer', bodyLimit: MAX_BYTES}, (req, body, done) => done(null, body));

  app.put('/api/events/:id/photo', {schema: {params}}, async (req, reply) => {
    if (!q.event.get(req.params.id)) return reply.code(404).send({error: 'notfound'});
    const jpeg = await neuKodieren(req.body);
    if (!jpeg) return reply.code(400).send({error: 'jpeg'});
    // Der Dateiname entsteht nur aus der geprüften Event-ID, die Endung setzt der Server
    const filename = req.params.id + '.jpg';
    await writeFile(join(dir, filename), jpeg);
    q.put.run(req.params.id, filename, Date.now());
    return reply.code(204).send();
  });

  app.get('/api/events/:id/photo', {schema: {params}}, async (req, reply) => {
    const row = q.get.get(req.params.id);
    const data = row && await readFile(join(dir, row.filename)).catch(() => null);
    if (!data) return reply.code(404).send({error: 'notfound'});
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'private, max-age=31536000, immutable').send(data);
  });

  app.delete('/api/events/:id/photo', {schema: {params}}, async (req, reply) => {
    await remove(req.params.id);
    return reply.code(204).send();
  });

  return {remove};
}
