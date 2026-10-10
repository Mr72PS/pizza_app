# Pizza App

Teigrezepte, Schritt-für-Schritt-Anleitung und ein Planer, der vom Essenstermin rückwärts rechnet: Du sagst, wann die erste Pizza auf dem Teller sein soll, die App sagt dir, wann du mit dem Teig anfangen musst.

Die App läuft als einzelner Docker-Container im Heimnetz, zum Beispiel auf einer Synology. Sie bringt ihre eigene Datenbank (SQLite) und eine Benutzerverwaltung mit. Alle Benutzer sehen dieselben Rezepte und Events, die Anmeldung regelt nur den Zugang.

## Was die App kann

- **Events planen:** Termin, Rezept und Anzahl Pizzen eingeben, die App rechnet den Zeitplan zurück und schlägt Varianten vor, wenn ein Schritt in die Nacht fällt. «Nochmals so» plant ein Event mit den Angaben eines früheren.
- **Anleitung und Einkaufsliste:** Schritt für Schritt durch den Teig, mit Mengen für die gewählte Anzahl und einer Einkaufsliste samt Belägen.
- **Rezepte:** Vorlagen für verschiedene Teigführungen, dazu eigene Rezepte und solche aus dem Internet.
- **Backprotokoll:** Nach dem Backen Sterne, Ofenwerte, Notizen und bis zu 10 Fotos festhalten. Die Ofenwerte lassen sich ins Rezept übernehmen.
- **Galerie:** Alle Fotos aus den Backprotokollen auf einen Blick, das neueste Event zuerst, mit Datum und Bewertung. Ein Tipp öffnet die Grossansicht zum Durchblättern, von dort geht es zum Event.

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
| `PUID`, `PGID` | Benutzer und Gruppe, unter denen die App läuft und denen die Dateien im Datenordner gehören. Freiwillig, Vorgabe `1000`. Auf der Synology lohnt sich der eigene Benutzer (per SSH mit `id` nachsehen), damit du die Dateien in der File Station siehst. |

Die Werte stehen in der `.env` oder in den Stack-Variablen; du kannst sie in der Compose-Datei unter `environment:` auch direkt eintragen.

### Datenordner

Der Container richtet die Schreibrechte selbst: Er startet kurz als root, gibt den Datenordner dem Benutzer aus `PUID` und `PGID` und wechselt dann auf diesen Benutzer. Die App selbst läuft nie als root. Ein `chown` von Hand ist nicht nötig.

Achte auf die Volume-Zeile in der Compose-Datei: links der Ordner auf dem Server, rechts immer `/data`. In Dockhand und Portainer am besten mit vollem Pfad, zum Beispiel `/volume1/docker/pizza_app/data:/data`. Fehlt der Teil `:/data`, landen die Daten in einem anonymen Docker-Volume und nicht in deinem Ordner. Nach dem Start müssen im Ordner `pizza_app.sqlite` und `fotos` liegen.

## Reverse Proxy

Die App erwartet HTTPS vom Reverse Proxy: Das Sitzungs-Cookie ist als `Secure` markiert und wird über reines HTTP nicht zurückgeschickt. `BASE_URL` muss genau der Adresse entsprechen, die du im Browser eingibst (Protokoll, Hostname, Port), sonst lehnt die App das Anmelden ab. Besondere Header oder WebSockets braucht es nicht.

### Variante A: Reverse Proxy der Synology, nur im Heimnetz

Unter Systemsteuerung, Anmeldeportal, Erweitert, Reverse Proxy:

- Quelle: HTTPS, dein Hostname (derselbe wie in `BASE_URL`), Port 443
- Ziel: HTTP, `localhost`, Port 8093

### Variante B: Cloudflare Tunnel, auch von unterwegs

Voraussetzung ist ein laufender Tunnel (`cloudflared`) und eine Domain bei Cloudflare.

1. Im Cloudflare-Dashboard unter Zero Trust, Networks, Tunnels den Tunnel öffnen und einen öffentlichen Hostnamen hinzufügen.
2. Subdomain und Domain wählen, zum Beispiel `pizza.example.com`. Service Type `HTTP`, URL `<IP des Servers im Heimnetz>:8093`.
3. `BASE_URL=https://pizza.example.com` und `TRUST_PROXY=true` setzen, Stack neu starten.

Läuft `cloudflared` selbst als Container, darf als URL nicht `localhost` stehen: Das wäre der Tunnel-Container und nicht der Server. Nimm die feste IP im Heimnetz.

Über den Tunnel ist die Anmeldeseite aus dem ganzen Internet erreichbar. Schalte deshalb Cloudflare Access davor: Zero Trust, Access, Applications, eine Self-hosted-Anwendung für denselben Hostnamen mit einer Allow-Policy für die E-Mail-Adressen, die hineindürfen.

Damit das App-Icon auch mit Access auf dem Startbildschirm landet, lege eine zweite Self-hosted-Anwendung für die Pfade `manifest.webmanifest` und `img/*` desselben Hostnamens an, mit einer Policy `Bypass` für `Everyone`. Freigegeben sind damit nur das Manifest und die Icons.

### Ohne Reverse Proxy zum Ausprobieren

Mit `BASE_URL=http://<IP>:8093` lässt sich die App direkt über HTTP aufrufen. Für den Dauerbetrieb ist das nicht gedacht.

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
- `vorschau/`: verkleinerte Fassungen für die Galerie. Die App erzeugt sie bei Bedarf neu, sie müssen nicht gesichert werden.

Sichere den ganzen Ordner, zum Beispiel mit Hyper Backup. Für eine garantiert saubere Kopie den Container vorher stoppen.

## Passwort vergessen

Ein Admin setzt unter «Konto» ein neues Passwort. Hat der einzige Admin sein Passwort vergessen: Container stoppen, `data/pizza_app.sqlite` löschen oder umbenennen und neu starten. Dabei gehen Rezepte und Events verloren; die Sicherung hilft.

## Sicherheit

- Passwörter sind mit argon2id gehasht. Nach 5 Fehlversuchen ist ein Konto 15 Minuten gesperrt, zusätzlich gilt eine Begrenzung pro IP-Adresse.
- Kein offenes Registrieren: Benutzer legt nur ein Admin an.
- Fotos dekodiert der Server und speichert sie neu als JPEG, ohne Metadaten wie den Aufnahmeort. Angenommen wird nur JPEG bis 2 MB, höchstens 10 Fotos pro Event; ausgeliefert wird nur mit Anmeldung.
- Rezepte und Events prüft der Server auf die erwarteten Typen, und die Oberfläche maskiert alles, was sie anzeigt.
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
| `scripts/` | `npm run assets` erzeugt Bilder, Icons und Schriften neu, nur nötig nach einer Änderung an Logo oder Icon |

## Lizenz

Der Code steht unter der [MIT-Lizenz](LICENSE): Du darfst ihn nutzen, ändern und weitergeben, solange Urheberhinweis und Lizenztext erhalten bleiben. Es gibt keine Garantie.

Davon ausgenommen sind das Logo und das Siegel «Pizzeria Pizzaiolo Patricio» (`logo-pizzeria-patricio.png` und die daraus erzeugten Bilder `public/img/kopf.webp` und `public/img/siegel.webp`). Sie dürfen als Teil der unveränderten App mitlaufen, aber nicht für eigene Zwecke verwendet werden. Wer eine eigene Version veröffentlicht, ersetzt sie bitte durch ein eigenes Logo und erzeugt die Bilder mit `npm run assets` neu. Das App-Icon (`public/img/icon.svg`) fällt unter die MIT-Lizenz.

Die Schriften Bricolage Grotesque und Instrument Sans liegen lokal im Image und stehen unter der SIL Open Font License, siehe `public/fonts/`.
