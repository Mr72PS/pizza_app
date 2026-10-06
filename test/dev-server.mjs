/* Wegwerf-Instanz zum Durchklicken im Browser: leerer Datenordner im Temp-Verzeichnis, Testkonto aus helper.js.
   Aufruf: npm run dev:test, dann http://localhost:8094 öffnen. Beim Beenden wird der Datenordner gelöscht. */
import {buildApp} from '../server/app.js';
import {ADMIN, tempDir, removeDir} from './helper.js';

const port = 8094, dataDir = tempDir();
const app = await buildApp({dataDir, logger: true, config: {adminUser: ADMIN.username, adminPassword: ADMIN.password, sessionSecret: 'nur-zum-testen', baseUrl: `http://localhost:${port}`}});
const ende = () => app.close().then(() => { removeDir(dataDir); process.exit(0); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, ende);
await app.listen({port, host: '127.0.0.1'});
console.log(`Testinstanz: http://localhost:${port}, Daten in ${dataDir}, Testkonto siehe test/helper.js`);
