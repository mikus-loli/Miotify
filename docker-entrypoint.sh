#!/bin/sh
set -e

DATA_DIR="/app/data"

if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
fi

if [ "$(id -u)" = "0" ]; then
    chown -R node:node "$DATA_DIR"
    exec su-exec node "$@"
fi

exec "$@"
