# Pizza App

Teigrezepte, Schritt-für-Schritt-Anleitung und ein Planer, der vom Essenstermin rückwärts rechnet: Du sagst, wann die erste Pizza auf dem Teller sein soll, die App sagt dir, wann du mit dem Teig anfangen musst.

Die App läuft als einzelner Docker-Container im Heimnetz, zum Beispiel auf einer Synology. Sie bringt ihre eigene Datenbank (SQLite) und eine Benutzerverwaltung mit. Alle Benutzer sehen dieselben Rezepte und Events, die Anmeldung regelt nur den Zugang.

## Was du brauchst

- Docker mit Compose (auf der Synology: Container Manager, Dockhand oder Portainer)
- Einen Reverse Proxy mit HTTPS davor. Die App selbst spricht nur HTTP auf einem Port.

## Einrichtung

1. Lege einen Ordner für den Stack an, zum Beispiel `/volume1/docker/pizza_app`, und darin den Unterordner `data`.
2. Kopiere [docker-compose.yml](docker-compose.yml) in den Ordner. In Dockhand oder Portainer legst du stattdessen einen neuen Stack an und fügst den Inhalt ein.
3. Kopiere [.env.example](.env.example) als `.env` daneben und fülle sie aus (siehe Tabelle). In Dockhand oder Portainer trägst du die Werte als Stack-Variablen ein.
4. Starte den Stack:

   ```bash
   docker compose pull
   ```

   ```bash
   docker compose up -d
   ```

5. Richte den Reverse Proxy ein (siehe unten) und öffne die Adresse aus `BASE_URL`. Melde dich mit `ADMIN_USER` und `ADMIN_PASSWORD` an.
6. Ändere dein Passwort unter «Konto» und lege dort weitere Benutzer an.

Das Image ist öffentlich, zum Ziehen braucht es keine Anmeldung an ghcr.io.

## Variablen

| Variable | Bedeutung |
|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | Erster Admin. Wird nur angelegt, solange es noch keinen Benutzer gibt. Passwort mindestens 8 Zeichen. Danach kannst du beide Werte wieder entfernen. |
| `SESSION_SECRET` | Langer Zufallswert, zum Beispiel aus `openssl rand -hex 32`. Wenn er sich ändert, müssen sich alle neu anmelden. |
| `BASE_URL` | Adresse, unter der die App im Browser erreichbar ist, zum Beispiel `https://pizza.example.lan`. Schreibende Anfragen von anderen Adressen werden abgelehnt. |
| `TRUST_PROXY` | Hinter dem Reverse Proxy `true`, damit IP-Adresse und HTTPS korrekt erkannt werden. |
| `TZ` | Zeitzone, Standard `Europe/Zurich`. |
| `PORT` | Port auf dem Host, Standard `8093`. |
| `PUID`, `PGID` | Benutzer und Gruppe, unter denen der Container läuft. Müssen dem Besitzer des Ordners `data` entsprechen. Auf der Synology per SSH mit `id` nachsehen. |

## Reverse Proxy

Die App erwartet HTTPS vom Reverse Proxy: Das Sitzungs-Cookie ist als `Secure` markiert und wird über reines HTTP nicht zurückgeschickt.

Auf der Synology unter Systemsteuerung, Anmeldeportal, Erweitert, Reverse Proxy:

- Quelle: HTTPS, dein Hostname (derselbe wie in `BASE_URL`), Port 443
- Ziel: HTTP, `localhost`, Port 8093

Besondere Header oder WebSockets braucht es nicht. `BASE_URL` muss genau der Adresse entsprechen, die du im Browser eingibst, sonst schlägt das Anmelden mit «Das hat nicht geklappt» fehl.

## Update

Jeder Push auf `main` baut über GitHub Actions ein neues Image und legt es unter `ghcr.io/mr72ps/pizza_app:latest` ab. Auf dem Server:

```bash
docker compose pull
```

```bash
docker compose up -d
```

In Dockhand: Stack öffnen, Image neu ziehen und neu bereitstellen. Die Daten bleiben erhalten. Neue Vorlagen-Rezepte werden beim Start nachgespielt; Vorlagen, die du gelöscht hast, bleiben gelöscht.

## Sicherung

Alles liegt im Ordner `data`:

- `pizza_app.sqlite` (dazu im Betrieb `-wal` und `-shm`): Rezepte, Events, Benutzer
- `fotos/`: die Fotos aus den Backprotokollen

Sichere den ganzen Ordner, zum Beispiel mit Hyper Backup. Für eine garantiert saubere Kopie den Container vorher stoppen.

## Passwort vergessen

Ein Admin setzt unter «Konto» ein neues Passwort. Hat der einzige Admin sein Passwort vergessen: Container stoppen, `data/pizza_app.sqlite` löschen oder umbenennen und neu starten. Dabei gehen Rezepte und Events verloren; die Sicherung hilft.

## Sicherheit

- Passwörter sind mit argon2id gehasht. Nach 5 Fehlversuchen ist ein Konto 15 Minuten gesperrt, zusätzlich gilt eine Begrenzung pro IP-Adresse.
- Kein offenes Registrieren: Benutzer legt nur ein Admin an.
- Die App ist für das Heimnetz gedacht. Stelle sie nicht ohne weiteren Schutz ins Internet.

## Entwicklung

Voraussetzung ist Node.js 24.

```bash
npm ci
```

```bash
npm test
```

```bash
node --env-file=.env server/index.js
```

Für die lokale `.env` genügt `BASE_URL=http://localhost:8093` zusammen mit `ADMIN_USER`, `ADMIN_PASSWORD` und `SESSION_SECRET`.

| Ordner | Inhalt |
|---|---|
| `public/` | Frontend ohne Framework und ohne Build. `calc.js` enthält die Rechenlogik ohne Zugriff auf DOM oder Speicher. |
| `server/` | Fastify, SQLite (`better-sqlite3`), Anmeldung, Fotos |
| `test/` | Unit-Tests für die Rechenlogik und Tests für die API |
| `scripts/` | `npm run assets` erzeugt Icons und Schriften neu, nur nötig nach einer Änderung am Logo |

## Lizenz

Der Code steht unter der [MIT-Lizenz](LICENSE): Du darfst ihn nutzen, ändern und weitergeben, solange Urheberhinweis und Lizenztext erhalten bleiben. Es gibt keine Garantie.

Davon ausgenommen sind das Logo und das Siegel «Pizzeria Pizzaiolo Patricio» (`logo-pizzeria-patricio.png` und die daraus erzeugten Bilder in `public/img/`). Sie dürfen als Teil der unveränderten App mitlaufen, aber nicht für eigene Zwecke verwendet werden. Wer eine eigene Version veröffentlicht, ersetzt sie bitte durch ein eigenes Logo und erzeugt die Icons mit `npm run assets` neu.

Die Schriften Bricolage Grotesque und Instrument Sans liegen lokal im Image und stehen unter der SIL Open Font License, siehe `public/fonts/`.
