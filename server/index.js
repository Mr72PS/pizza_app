import {buildApp, configFromEnv} from './app.js';

const dataDir = process.env.DATA_DIR || './data';
const port = Number(process.env.PORT) || 8093;

const app = await buildApp({dataDir, logger: true, config: configFromEnv()});
if (!process.env.SESSION_SECRET) app.log.warn('SESSION_SECRET fehlt: Sitzungen gelten nur bis zum nächsten Neustart.');
if (app.db.prepare('SELECT COUNT(*) n FROM users').get().n === 0) app.log.warn('Es gibt noch keinen Benutzer. ADMIN_USER und ADMIN_PASSWORD setzen und neu starten.');
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));

app.listen({port, host: '0.0.0.0'}).catch(err => { app.log.error(err); process.exit(1); });
