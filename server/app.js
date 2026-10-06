import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openDb} from './db.js';
import {mergeSeed} from './seed.js';
import {ensureAdmin, registerAuth} from './auth.js';
import {registerPhotos} from './photos.js';
import {recipeSchema, eventSchema} from './schema.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/* Rezepte und Events haben dieselbe Form: id, data (JSON), updated_at als Versionsmarke. */
function store(db, table) {
  const all = db.prepare(`SELECT id, data, updated_at FROM ${table} ORDER BY rowid`);
  const one = db.prepare(`SELECT id, data, updated_at FROM ${table} WHERE id = ?`);
  const ins = db.prepare(`INSERT INTO ${table} (id, data, updated_at, updated_by) VALUES (?, ?, ?, ?)`);
  const upd = db.prepare(`UPDATE ${table} SET data = ?, updated_at = ?, updated_by = ? WHERE id = ?`);
  const del = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
  const out = row => ({id: row.id, data: JSON.parse(row.data), updatedAt: row.updated_at});
  return {
    list: () => all.all().map(out),
    get: id => { const row = one.get(id); return row ? out(row) : null; },
    // Liefert {ok, item}. ok = false heisst: Marke veraltet, item ist der aktuelle Stand (oder null, wenn gelöscht).
    put: db.transaction((id, data, updatedAt, userId) => {
      const row = one.get(id);
      if (row ? row.updated_at !== updatedAt : updatedAt != null) return {ok: false, item: row ? out(row) : null};
      const json = JSON.stringify({...data, id});
      // Die Marke muss bei jedem Schreiben wachsen, auch innerhalb derselben Millisekunde
      const ts = row ? Math.max(Date.now(), row.updated_at + 1) : Date.now();
      row ? upd.run(json, ts, userId, id) : ins.run(id, json, ts, userId);
      return {ok: true, created: !row, item: {id, data: JSON.parse(json), updatedAt: ts}};
    }),
    remove: id => del.run(id).changes > 0,
  };
}

/* Einstellungen aus der Umgebung, siehe .env.example */
export function configFromEnv(env = process.env) {
  const baseUrl = (env.BASE_URL || '').replace(/\/+$/, '');
  const tp = env.TRUST_PROXY;
  return {
    adminUser: env.ADMIN_USER, adminPassword: env.ADMIN_PASSWORD,
    sessionSecret: env.SESSION_SECRET,
    baseUrl,
    trustProxy: !tp || tp === 'false' ? false : tp === 'true' ? true : /^\d+$/.test(tp) ? Number(tp) : tp,
  };
}

export async function buildApp({dataDir, logger = false, config = {}} = {}) {
  const db = openDb(dataDir);
  mergeSeed(db);
  const recipes = store(db, 'recipes'), events = store(db, 'events');
  config = {
    loginPerIp: 30,
    ...config,
    // Ohne festes Geheimnis gelten Sitzungen nur bis zum nächsten Neustart
    sessionSecret: config.sessionSecret || randomBytes(32).toString('hex'),
    // Über http (nur lokale Entwicklung) würde der Browser ein Secure-Cookie nicht zurückschicken
    secureCookie: !(config.baseUrl || '').startsWith('http://'),
  };
  await ensureAdmin(db, config.adminUser, config.adminPassword);

  const app = Fastify({logger, trustProxy: config.trustProxy || false});
  app.decorate('db', db);
  app.addHook('onClose', () => db.close());

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {useDefaults: false, directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"],
      // Die Ansichten setzen style-Attribute, darum 'unsafe-inline' nur für Styles
      styleSrc: ["'self'", "'unsafe-inline'"], fontSrc: ["'self'"],
      // data: für die Vorschau eines frisch gewählten Fotos im Protokoll
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], workerSrc: ["'self'"], manifestSrc: ["'self'"],
    }},
    // HSTS setzt der Reverse Proxy, der auch das Zertifikat hält
    strictTransportSecurity: false,
    referrerPolicy: {policy: 'same-origin'},
  });
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {global: false});
  registerAuth(app, {db, config});

  const photos = registerPhotos(app, {db, dataDir, idPattern: ID.source});

  app.get('/healthz', () => ({ok: true}));

  app.get('/api/state', () => ({recipes: recipes.list(), events: events.list()}));

  const body = data => ({
    type: 'object', required: ['data'], additionalProperties: false,
    properties: {data, updatedAt: {type: ['integer', 'null']}},
  });
  const params = {type: 'object', properties: {id: {type: 'string', pattern: ID.source}}};

  for (const [name, s, schema] of [['recipes', recipes, recipeSchema], ['events', events, eventSchema]]) {
    app.put(`/api/${name}/:id`, {schema: {body: body(schema), params}}, (req, reply) => {
      const r = s.put(req.params.id, req.body.data, req.body.updatedAt ?? null, req.user.id);
      if (!r.ok) return reply.code(409).send({error: 'conflict', current: r.item});
      return reply.code(r.created ? 201 : 200).send(r.item);
    });
    app.delete(`/api/${name}/:id`, {schema: {params}}, async (req, reply) => {
      s.remove(req.params.id);
      if (name === 'events') await photos.remove(req.params.id);
      return reply.code(204).send();
    });
  }

  app.register(fastifyStatic, {root: PUBLIC});
  return app;
}
