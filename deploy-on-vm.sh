#!/usr/bin/env bash

# Script de Deploy em Produção - Executar na VM
# Uso: ./deploy-on-vm.sh
# 
# Este script assume que:
# - O código atualizado está em /home/filipe_lacerda/glpi_atualizado
# - A aplicação em produção está em /opt/glpi-etus
# - Docker Compose está configurado em /opt/glpi-etus
# - Arquivos .env e Cloudflare Tunnel NÃO serão sobrescritos (já configurados em produção)

set -euo pipefail  # Parar em caso de erro, variável não definida e falha em pipes

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
SOURCE_DIR="${SOURCE_DIR:-/home/filipe_lacerda/glpi_atualizado}"
TARGET_DIR="${TARGET_DIR:-/opt/glpi-etus}"
BACKUP_BASE_DIR="$TARGET_DIR/backups"
PROD_COMPOSE_FILE="docker-compose.prod.yml"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║     GLPI-ETUS - Deploy na VM (RSYNC Local)           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se diretório fonte existe
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}❌ Erro: Diretório fonte não encontrado: $SOURCE_DIR${NC}"
    echo ""
    echo "Copie o código para: $SOURCE_DIR"
    exit 1
fi

# Validar pré-requisitos de runtime
for cmd in docker rsync grep awk curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}❌ Erro: comando obrigatório não encontrado: $cmd${NC}"
        exit 1
    fi
done

# Validar arquivo de ambiente de produção
if [ ! -f "$TARGET_DIR/.env" ]; then
    echo -e "${RED}❌ Erro: arquivo $TARGET_DIR/.env não encontrado.${NC}"
    echo "Crie o .env de produção antes de executar o deploy."
    exit 1
fi

REQUIRED_ENV_KEYS=("DB_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET" "CONFIG_ENCRYPTION_KEY")
for key in "${REQUIRED_ENV_KEYS[@]}"; do
    if ! grep -Eq "^${key}=.+" "$TARGET_DIR/.env"; then
        echo -e "${RED}❌ Erro: variável obrigatória ausente no .env: ${key}${NC}"
        exit 1
    fi
done

# Verificar se diretório destino existe
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}❌ Erro: Diretório destino não encontrado: $TARGET_DIR${NC}"
    echo ""
    echo "O diretório de produção deve existir em: $TARGET_DIR"
    exit 1
fi

echo -e "${GREEN}✅ Configuração:${NC}"
echo "   Origem:  $SOURCE_DIR"
echo "   Destino: $TARGET_DIR"
echo ""

# Confirmar antes de continuar
read -p "Deseja continuar com o deploy? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}Deploy cancelado.${NC}"
    exit 0
fi

# PASSO 1: Criar backup
echo -e "${YELLOW}📦 Passo 1: Criando backup...${NC}"
BACKUP_DIR="$BACKUP_BASE_DIR/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

cd "$TARGET_DIR"

echo "   Fazendo backup do banco de dados..."
docker compose -f "$PROD_COMPOSE_FILE" exec -T postgres pg_dump -U glpi_etus glpi_etus > "$BACKUP_DIR/database_backup.sql" || {
  echo -e "${RED}❌ Erro no backup do banco${NC}" >&2
  exit 1
}
chmod 600 "$BACKUP_DIR/database_backup.sql"

echo "   Fazendo backup dos uploads..."
cp -r backend/uploads "$BACKUP_DIR/uploads" 2>/dev/null || true

echo "   Fazendo backup do schema Prisma..."
cp backend/prisma/schema.prisma "$BACKUP_DIR/schema.prisma.backup" 2>/dev/null || true

# Nota: .env e Cloudflare Tunnel NÃO são feitos backup
#       Esses arquivos já estão configurados em produção e NÃO serão sobrescritos pelo deploy

echo -e "${GREEN}✅ Backup criado em: $BACKUP_DIR${NC}"
echo ""

# PASSO 2: Verificar e proteger arquivos de produção
echo -e "${YELLOW}🔒 Verificando proteção de arquivos de produção...${NC}"

# Verificar se .env existe em produção e avisar
if [ -f "$TARGET_DIR/backend/.env" ] || [ -f "$TARGET_DIR/.env" ]; then
    echo -e "   ${GREEN}✅ Arquivo .env encontrado em produção (será preservado)${NC}"
fi

# Verificar se arquivos do Cloudflare Tunnel existem
if [ -d "$TARGET_DIR/cloudflared-config" ] || [ -f "$TARGET_DIR/cloudflared-config.yml" ]; then
    echo -e "   ${GREEN}✅ Configuração Cloudflare Tunnel encontrada (será preservada)${NC}"
fi

# Verificar se .rsync-exclude existe no diretório fonte
if [ ! -f "$SOURCE_DIR/.rsync-exclude" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .rsync-exclude não encontrado em $SOURCE_DIR${NC}"
    echo "   Criando arquivo de exclusões padrão..."
    cat > "$SOURCE_DIR/.rsync-exclude" << 'EOF'
# Node modules
**/node_modules/
node_modules/

# Build artifacts
**/dist/
dist/
**/.next/
.next/

# Environment files - CRÍTICO: NÃO sobrescrever arquivos .env de produção
.env
.env.local
.env.production
.env.development
.env.*
**/.env
**/.env.*
backend/.env
frontend/.env
**/backend/.env
**/frontend/.env

# Logs
**/*.log
logs/
*.log

# Cache
**/.cache/
.cache/
**/.vscode/
.vscode/
**/.idea/
.idea/

# OS files
.DS_Store
Thumbs.db
**/.DS_Store

# Git
.git/
.gitignore

# Docker volumes
**/uploads/tickets/**
backend/uploads/tickets/**

# Backups
backups/

# Temporary files
*.tmp
*.temp
**/*.tmp
**/*.temp

# Documentation (manter apenas essenciais)
*.md
!README.md
!CHANGELOG.md
!DEPLOY_INSTRUCTIONS.md
!DEPLOY_GITLAB.md
!DOCKER-SETUP.md
!N8N_INTEGRATION.md
!KB_SEED_INSTRUCTIONS.md
!PRE_DEPLOY_CHECKLIST.md
!AUTOMATION.md
!docs/admin-console.md
!docs/auth0.md
!docs/sso-google-workspace.md
!PRE_DEPLOY_CHECKLIST.md
!N8N_INTEGRATION.md
!docs/admin-console.md
!docs/sso-google-workspace.md

# Cloudflare Tunnel - CRÍTICO: NÃO sobrescrever configuração de produção
cloudflared-config/
cloudflared-credentials/
cloudflared-config.yml
**/cloudflared-config/
**/cloudflared-credentials/
**/*cloudflared*
*.cfargotunnel.com
**/cloudflared*
EOF
    echo -e "${GREEN}✅ Arquivo .rsync-exclude criado${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Arquivo .rsync-exclude encontrado${NC}"
    echo ""
fi

# PASSO 3: Sincronizar arquivos
echo -e "${YELLOW}📤 Passo 2: Sincronizando arquivos...${NC}"
echo "   (Isso pode levar alguns minutos...)"
echo -e "   ${BLUE}⚠️  Arquivos .env e Cloudflare Tunnel serão preservados${NC}"

# Usar --exclude adicional para garantir proteção mesmo se .rsync-exclude falhar
rsync -av \
  --exclude-from="$SOURCE_DIR/.rsync-exclude" \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='**/.env' \
  --exclude='**/.env.*' \
  --exclude='cloudflared-config/' \
  --exclude='cloudflared-credentials/' \
  --exclude='cloudflared-config.yml' \
  --exclude='**/cloudflared*' \
  --exclude='*.cfargotunnel.com' \
  --delete \
  --info=stats2,progress2 \
  "$SOURCE_DIR/" \
  "$TARGET_DIR/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao sincronizar arquivos${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Arquivos sincronizados${NC}"

# Verificar se arquivos críticos foram preservados
echo ""
echo "   Verificando preservação de arquivos críticos..."
if [ -f "$TARGET_DIR/backend/.env" ] || [ -f "$TARGET_DIR/.env" ]; then
    echo -e "   ${GREEN}✅ Arquivo .env preservado${NC}"
else
    echo -e "   ${YELLOW}⚠️  Arquivo .env não encontrado (pode ser normal se não existir)${NC}"
fi

if [ -d "$TARGET_DIR/cloudflared-config" ] || [ -f "$TARGET_DIR/cloudflared-config.yml" ]; then
    echo -e "   ${GREEN}✅ Configuração Cloudflare Tunnel preservada${NC}"
else
    echo -e "   ${YELLOW}⚠️  Configuração Cloudflare Tunnel não encontrada (pode ser normal se não existir)${NC}"
fi

echo ""

# PASSO 4: Reconstruir e reiniciar containers (o build é feito pelo Docker)
echo -e "${YELLOW}🐳 Passo 3: Reconstruindo imagens Docker (build automático)...${NC}"
cd "$TARGET_DIR"

echo "   Nota: O build do backend e frontend será feito automaticamente pelo Docker"
echo "   durante a reconstrução das imagens (multi-stage build)."
echo ""

echo "   Reconstruindo imagens (isso pode levar alguns minutos)..."
docker compose -f "$PROD_COMPOSE_FILE" build --no-cache || {
    echo -e "${RED}⚠️ Erro ao reconstruir imagens${NC}"
    exit 1
}

echo "   Parando containers..."
docker compose -f "$PROD_COMPOSE_FILE" down

echo "   Iniciando containers..."
docker compose -f "$PROD_COMPOSE_FILE" up -d || {
    echo -e "${RED}⚠️ Erro ao iniciar containers${NC}"
    exit 1
}

echo -e "${GREEN}✅ Containers reiniciados!${NC}"
echo ""

# PASSO 5: Executar migrations (após containers estarem rodando)
echo -e "${YELLOW}🔄 Passo 4: Executando migrations...${NC}"

# Aguardar containers iniciarem antes de executar migrations
echo -e "${YELLOW}⏳ Aguardando containers iniciarem...${NC}"
sleep 15

cd "$TARGET_DIR"

# Verificar se o container está rodando antes de executar migrations
echo "   Verificando status dos containers..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker compose -f "$PROD_COMPOSE_FILE" ps backend | grep -q "Up"; then
    echo -e "   ${GREEN}✅ Container backend está rodando${NC}"
    break
  fi
  if docker compose -f "$PROD_COMPOSE_FILE" ps backend | grep -q "Restarting"; then
    echo -e "   ${YELLOW}⚠️  Container backend está reiniciando... Verificando logs...${NC}"
    docker compose -f "$PROD_COMPOSE_FILE" logs --tail=20 backend
    echo ""
    echo -e "   ${RED}❌ Container não conseguiu iniciar. Verifique os logs acima.${NC}"
    exit 1
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Aguardando container iniciar... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo -e "${RED}❌ Timeout aguardando container iniciar${NC}"
  echo "   Logs do backend:"
  docker compose -f "$PROD_COMPOSE_FILE" logs --tail=50 backend
  exit 1
fi

# Construir DATABASE_URL a partir das variáveis de ambiente do container
echo "   Construindo DATABASE_URL a partir das variáveis de ambiente..."
# Executar o comando dentro do container para construir a DATABASE_URL e executar migrations
# O Prisma CLI precisa da variável DATABASE_URL diretamente, não apenas as variáveis separadas
docker compose -f "$PROD_COMPOSE_FILE" exec -T backend sh -c '
  # Ler variáveis de ambiente do container
  DB_HOST=${DB_HOST:-postgres}
  DB_PORT=${DB_PORT:-5432}
  DB_USER=${DB_USER:-glpi_etus}
  DB_PASSWORD=${DB_PASSWORD}
  DB_NAME=${DB_NAME:-glpi_etus}
  DB_SCHEMA=${DB_SCHEMA:-public}
  
  # Verificar se DB_PASSWORD está definido
  if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Erro: DB_PASSWORD não está definido no .env"
    exit 1
  fi
  
  # Codificar a senha para URL (importante para caracteres especiais)
  ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$DB_PASSWORD")
  
  # Construir DATABASE_URL
  export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}"
  
  # Executar migrations
  npx prisma migrate deploy
' || {
    echo -e "${RED}⚠️ Erro ao executar migrations${NC}"
    echo -e "${YELLOW}💡 Para reverter, restaure o backup: $BACKUP_DIR${NC}"
    exit 1
}

echo -e "${GREEN}✅ Migrations executadas!${NC}"
echo ""

# Garantir usuário admin padrão (sem reset de senha, a menos que FORCE_RESET_ADMIN_PASSWORD=true no .env)
echo -e "${YELLOW}👤 Passo 4.1: Garantindo usuário administrador padrão...${NC}"
docker compose -f "$PROD_COMPOSE_FILE" exec -T backend npm run db:ensure-admin || {
    echo -e "${RED}⚠️ Erro ao garantir usuário admin padrão${NC}"
    exit 1
}
echo -e "${GREEN}✅ Usuário admin validado/criado${NC}"
echo ""

# PASSO 6: Verificações
echo -e "${YELLOW}🔍 Passo 5: Verificando serviços...${NC}"
cd "$TARGET_DIR"

echo "   Status dos containers:"
docker compose -f "$PROD_COMPOSE_FILE" ps

echo ""
echo "   Verificando logs recentes do backend:"
docker compose -f "$PROD_COMPOSE_FILE" logs --tail=20 backend | tail -10

echo ""
echo "   Verificando logs recentes do frontend:"
docker compose -f "$PROD_COMPOSE_FILE" logs --tail=20 frontend | tail -10

# Verificar se diretórios de uploads foram criados
echo ""
echo "   Verificando diretórios de uploads..."
if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend test -d /app/uploads/journal 2>/dev/null; then
    echo -e "   ${GREEN}✅ Diretório uploads/journal existe${NC}"
else
    echo -e "   ${YELLOW}⚠️  Criando diretório uploads/journal...${NC}"
    docker compose -f "$PROD_COMPOSE_FILE" exec -T backend mkdir -p /app/uploads/journal || true
    docker compose -f "$PROD_COMPOSE_FILE" exec -T backend chmod 755 /app/uploads/journal || true
fi

if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend test -d /app/uploads/tickets 2>/dev/null; then
    echo -e "   ${GREEN}✅ Diretório uploads/tickets existe${NC}"
else
    echo -e "   ${YELLOW}⚠️  Criando diretório uploads/tickets...${NC}"
    docker compose -f "$PROD_COMPOSE_FILE" exec -T backend mkdir -p /app/uploads/tickets || true
    docker compose -f "$PROD_COMPOSE_FILE" exec -T backend chmod 755 /app/uploads/tickets || true
fi

echo ""
echo "   Verificando healthchecks da API..."
if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend sh -lc "curl -fsS http://127.0.0.1:8080/health" >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ /health respondeu com sucesso${NC}"
else
    echo -e "   ${YELLOW}⚠️  /health falhou dentro do container backend.${NC}"
fi

if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend sh -lc "curl -fsS http://127.0.0.1:8080/healthz" >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ /healthz respondeu com sucesso${NC}"
else
    echo -e "   ${YELLOW}⚠️  /healthz falhou dentro do container backend.${NC}"
fi

if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend sh -lc "curl -fsS http://127.0.0.1:8080/readyz" >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ /readyz respondeu com sucesso (DB + Redis prontos)${NC}"
else
    echo -e "   ${YELLOW}⚠️  /readyz falhou. Verifique DB/Redis e logs do backend.${NC}"
fi

if docker compose -f "$PROD_COMPOSE_FILE" exec -T backend sh -lc "curl -fsS http://127.0.0.1:8080/metrics" >/dev/null 2>&1; then
    echo -e "   ${GREEN}✅ /metrics respondeu com sucesso${NC}"
else
    echo -e "   ${YELLOW}⚠️  /metrics falhou (não bloqueante).${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Deploy concluído com sucesso!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "   1. Verifique se a aplicação está funcionando"
echo "   2. Teste as novas funcionalidades (tags, diário do técnico)"
echo "   3. Monitore os logs: docker compose -f $PROD_COMPOSE_FILE logs -f"
echo "   4. Verifique se o diretório de uploads do journal foi criado:"
echo "      docker compose -f $PROD_COMPOSE_FILE exec backend ls -la uploads/journal"
echo ""
echo -e "${YELLOW}💾 Backup salvo em: $BACKUP_DIR${NC}"
echo ""
