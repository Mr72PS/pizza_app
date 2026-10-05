#!/bin/sh
# Startet kurz als root, gibt den Datenordner dem Benutzer aus PUID/PGID und wechselt dann auf diesen Benutzer.
# Die App selbst läuft nie als root. Wer in der Compose-Datei «user:» setzt, überspringt diesen Teil.
set -e

if [ "$(id -u)" = "0" ]; then
  PUID="${PUID:-1000}"
  PGID="${PGID:-1000}"
  case "$PUID$PGID" in
    *[!0-9]*) echo "PUID und PGID müssen Zahlen sein (PUID=$PUID, PGID=$PGID)." >&2; exit 1 ;;
  esac
  if [ "$PUID" = "0" ]; then
    echo "PUID=0 ist nicht erlaubt: Die App soll nicht als root laufen." >&2; exit 1
  fi
  mkdir -p "$DATA_DIR/fotos"
  # Nur eingreifen, wenn etwas im Datenordner nicht dem gewünschten Benutzer gehört
  if [ -n "$(find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -print -quit)" ]; then
    echo "Pizza App: setze den Besitzer von $DATA_DIR auf $PUID:$PGID."
    chown -R "$PUID:$PGID" "$DATA_DIR"
  fi
  exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
fi

exec "$@"
