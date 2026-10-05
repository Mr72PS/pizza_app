import {buildApp, configFromEnv} from './app.js';

const dataDir = process.env.DATA_DIR || './data';
const port = Number(process.env.PORT) || 8093;

const app = await buildApp({dataDir, logger: true, config: configFromEnv()}).catch(err => {
  if (!['EACCES', 'EPERM', 'EROFS', 'SQLITE_CANTOPEN', 'SQLITE_READONLY'].includes(err.code)) throw err;
  const ich = process.getuid ? `${process.getuid()}:${process.getgid()}` : 'dieser Benutzer';
  console.error(`Pizza App kann nicht in ${dataDir} schreiben (${err.code}). Der Container läuft als ${ich}.\n`
    + 'Normalerweise richtet der Container die Rechte beim Start selbst. Das entfällt, wenn in der Compose-Datei «user:» gesetzt ist:\n'
    + 'Entferne die Zeile und setze stattdessen PUID und PGID, oder gib den Ordner auf dem Host mit chown diesem Benutzer.');
  process.exit(1);
});
if (!process.env.SESSION_SECRET) app.log.warn('SESSION_SECRET fehlt: Sitzungen gelten nur bis zum nächsten Neustart.');
if (app.db.prepare('SELECT COUNT(*) n FROM users').get().n === 0) app.log.warn('Es gibt noch keinen Benutzer. ADMIN_USER und ADMIN_PASSWORD setzen und neu starten.');
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));

app.listen({port, host: '0.0.0.0'}).catch(err => { app.log.error(err); process.exit(1); });
