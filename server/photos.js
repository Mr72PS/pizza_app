/* Fotos zum Backprotokoll: ein JPEG pro Event als Datei im Volume, ausgeliefert hinter der Anmeldung. */
import {writeFile, readFile, unlink} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_BYTES = 2 * 1024 * 1024;

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

  app.addContentTypeParser('image/jpeg', {parseAs: 'buffer', bodyLimit: MAX_BYTES}, (req, body, done) => done(null, body));

  app.put('/api/events/:id/photo', {schema: {params}}, async (req, reply) => {
    const b = req.body;
    // Nur echte JPEG-Dateien annehmen, der Browser verkleinert vorher auf höchstens 800 px
    if (!Buffer.isBuffer(b) || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF) return reply.code(400).send({error: 'jpeg'});
    if (!q.event.get(req.params.id)) return reply.code(404).send({error: 'notfound'});
    // Der Dateiname entsteht nur aus der geprüften Event-ID
    const filename = req.params.id + '.jpg';
    await writeFile(join(dir, filename), b);
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
