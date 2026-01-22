#!/usr/bin/env sh
# Wrapper para comandos Prisma que constrói DATABASE_URL antes de executar

# Carregar script de setup
. /app/scripts/setup-db-url.sh

# Executar comando Prisma passado como argumento
exec npx prisma "$@"

