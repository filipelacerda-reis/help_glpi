#!/usr/bin/env sh
# Script para construir DATABASE_URL a partir de variáveis separadas
# Isso é necessário porque o Prisma CLI precisa da DATABASE_URL diretamente
# Pode ser usado como entrypoint (exec "$@") ou sourced (. script.sh)

if [ -z "$DATABASE_URL" ] && [ -n "$DB_PASSWORD" ]; then
  # Construir DATABASE_URL a partir de variáveis separadas
  DB_HOST=${DB_HOST:-postgres}
  DB_PORT=${DB_PORT:-5432}
  DB_USER=${DB_USER:-glpi_etus}
  DB_NAME=${DB_NAME:-glpi_etus}
  DB_SCHEMA=${DB_SCHEMA:-public}
  
  # Codificar a senha para URL (importante para caracteres especiais)
  # Usar node para codificar corretamente
  ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent('$DB_PASSWORD'))")
  
  export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}"
fi

# Se foi chamado com argumentos (entrypoint mode), executar o comando
if [ $# -gt 0 ]; then
  exec "$@"
fi

