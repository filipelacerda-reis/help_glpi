# Guia de Deploy via GitLab - GLPI ETUS

Este guia descreve o processo completo de deploy da aplicação GLPI ETUS em produção usando GitLab e o script de deploy automatizado.

## 📋 Pré-requisitos

### Na VM de Produção

- **Ubuntu/Debian** (recomendado)
- **Docker** e **Docker Compose** instalados
- **Git** instalado
- **rsync** instalado (geralmente já vem instalado)
- Acesso SSH à VM
- Permissões para executar scripts

### No GitLab

- Repositório configurado: `https://gitlab.com/etus/devops/glpi-etus.git`
- Acesso ao repositório
- Chaves SSH configuradas (se usar SSH)

## 🚀 Processo de Deploy

### Opção 1: Deploy Manual via GitLab (Recomendado)

#### 1. Clonar/Atualizar o Repositório na VM

```bash
# Se ainda não clonou
cd /home/filipe_lacerda
git clone https://gitlab.com/etus/devops/glpi-etus.git glpi_atualizado

# Se já clonou, atualizar
cd /home/filipe_lacerda/glpi_atualizado
git pull origin master
```

#### 2. Executar o Script de Deploy

```bash
# Dar permissão de execução (se necessário)
chmod +x deploy-on-vm.sh

# Executar o script
./deploy-on-vm.sh
```

O script irá:
1. ✅ Criar backup automático do banco de dados e arquivos
2. ✅ Sincronizar código via rsync (preservando .env e Cloudflare Tunnel)
3. ✅ Reconstruir imagens Docker
4. ✅ Executar migrations do Prisma
5. ✅ Verificar serviços e diretórios

**Importante:** O script preserva automaticamente:
- Arquivos `.env` (variáveis de ambiente de produção)
- Configurações do Cloudflare Tunnel (`cloudflared-config/`, `cloudflared-credentials/`)

### Opção 2: Deploy Automatizado via GitLab CI/CD

#### 1. Configurar GitLab CI/CD

Crie um arquivo `.gitlab-ci.yml` na raiz do projeto:

```yaml
stages:
  - deploy

deploy_production:
  stage: deploy
  only:
    - master  # ou main, dependendo da branch principal
  script:
    - echo "Deploy para produção"
    - |
      ssh usuario@vm-producao << 'EOF'
        cd /home/filipe_lacerda/glpi_atualizado
        git pull origin master
        ./deploy-on-vm.sh
      EOF
  environment:
    name: production
    url: https://seu-dominio.com
```

#### 2. Configurar Variáveis no GitLab

1. Acesse **Settings** → **CI/CD** → **Variables**
2. Adicione variáveis sensíveis (se necessário):
   - `SSH_PRIVATE_KEY`: Chave SSH privada para acesso à VM
   - `VM_HOST`: IP ou hostname da VM
   - `VM_USER`: Usuário SSH

#### 3. Executar Pipeline

O deploy será executado automaticamente ao fazer push na branch `master`.

### Opção 3: Deploy via GitLab Runner na VM

#### 1. Instalar GitLab Runner na VM

```bash
# Adicionar repositório oficial do GitLab
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash

# Instalar GitLab Runner
sudo apt-get install gitlab-runner
```

#### 2. Registrar Runner

```bash
sudo gitlab-runner register
```

Siga as instruções e use:
- Executor: `shell` ou `docker`
- Tags: `production`, `deploy`

#### 3. Configurar .gitlab-ci.yml

```yaml
stages:
  - deploy

deploy_production:
  stage: deploy
  tags:
    - production
    - deploy
  only:
    - master
  script:
    - cd /home/filipe_lacerda/glpi_atualizado
    - git pull origin master
    - ./deploy-on-vm.sh
  environment:
    name: production
```

## 📝 Configuração Inicial (Primeira Vez)

### 1. Preparar Diretórios na VM

```bash
# Criar diretório de produção
sudo mkdir -p /opt/glpi-etus
sudo chown $USER:$USER /opt/glpi-etus

# Criar diretório de código fonte
mkdir -p /home/filipe_lacerda/glpi_atualizado
```

### 2. Clonar Repositório

```bash
cd /home/filipe_lacerda
git clone https://gitlab.com/etus/devops/glpi-etus.git glpi_atualizado
cd glpi_atualizado
```

### 3. Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env na raiz (se não existir)
cd /opt/glpi-etus
nano .env
```

**Variáveis obrigatórias:**
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=glpi_etus
DB_PASSWORD=sua_senha_forte_aqui
DB_NAME=glpi_etus
DB_SCHEMA=public

# JWT
JWT_SECRET=seu-secret-jwt-forte
JWT_REFRESH_SECRET=seu-refresh-secret-forte

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Frontend
FRONTEND_URL=https://seu-dominio.com

# Assistente Virtual (opcional)
OPENAI_API_KEY=<SUA_CHAVE_OPENAI>
GEMINI_API_KEY=<SUA_CHAVE_GEMINI>

# Outras
NODE_ENV=production
LOG_LEVEL=info
```

### 4. Configurar Cloudflare Tunnel (se necessário)

```bash
# Criar diretório de configuração
mkdir -p /opt/glpi-etus/cloudflared-config

# Configurar tunnel (seguir documentação do Cloudflare)
# Os arquivos serão preservados automaticamente pelo deploy-on-vm.sh
```

### 5. Primeiro Deploy

```bash
cd /home/filipe_lacerda/glpi_atualizado
chmod +x deploy-on-vm.sh
./deploy-on-vm.sh
```

## 🔄 Processo de Deploy Regular

### Fluxo Recomendado

1. **Desenvolvimento Local**
   ```bash
   # Fazer alterações no código
   # Testar localmente
   git add .
   git commit -m "Descrição das mudanças"
   git push origin master
   ```

2. **Na VM de Produção**
   ```bash
   cd /home/filipe_lacerda/glpi_atualizado
   git pull origin master
   ./deploy-on-vm.sh
   ```

### Verificação Pós-Deploy

Após o deploy, verifique:

```bash
# Status dos containers
docker compose -f /opt/glpi-etus/docker-compose.prod.yml ps

# Logs do backend
docker compose -f /opt/glpi-etus/docker-compose.prod.yml logs --tail=50 backend

# Logs do frontend
docker compose -f /opt/glpi-etus/docker-compose.prod.yml logs --tail=50 frontend

# Verificar se aplicação está respondendo
curl http://localhost:8080/health  # Backend
curl http://localhost:5173         # Frontend
```

## 🔧 Configuração do deploy-on-vm.sh

O script `deploy-on-vm.sh` está configurado com:

- **Diretório fonte**: `/home/filipe_lacerda/glpi_atualizado`
- **Diretório destino**: `/opt/glpi-etus`
- **Preservação automática**: `.env`, `cloudflared-config/`, `cloudflared-credentials/`

Para alterar esses caminhos, edite as variáveis no início do script:

```bash
SOURCE_DIR="/home/filipe_lacerda/glpi_atualizado"
TARGET_DIR="/opt/glpi-etus"
```

## 📦 O que é Sincronizado

O script `deploy-on-vm.sh` sincroniza:

✅ **Código fonte completo** (backend e frontend)
✅ **Arquivos de configuração** (docker-compose.prod.yml, Dockerfiles)
✅ **Schema do Prisma** (para migrations)
✅ **Scripts de deploy**
✅ **Documentação essencial** (README.md, CHANGELOG.md)

❌ **NÃO sincroniza** (preservados):
- Arquivos `.env`
- Configurações Cloudflare Tunnel
- `node_modules/`
- Arquivos de build (`dist/`)
- Uploads de produção
- Backups

## 🚨 Troubleshooting

### Erro: "Diretório fonte não encontrado"

```bash
# Verificar se o diretório existe
ls -la /home/filipe_lacerda/glpi_atualizado

# Se não existir, clonar o repositório
cd /home/filipe_lacerda
git clone https://gitlab.com/etus/devops/glpi-etus.git glpi_atualizado
```

### Erro: "Diretório destino não encontrado"

```bash
# Criar diretório de produção
sudo mkdir -p /opt/glpi-etus
sudo chown $USER:$USER /opt/glpi-etus
```

### Erro: "Permission denied" no rsync

```bash
# Verificar permissões
ls -la /home/filipe_lacerda/glpi_atualizado
ls -la /opt/glpi-etus

# Ajustar permissões se necessário
chmod -R 755 /home/filipe_lacerda/glpi_atualizado
```

### Erro: "Cannot connect to Docker daemon"

```bash
# Verificar se Docker está rodando
sudo systemctl status docker

# Adicionar usuário ao grupo docker (se necessário)
sudo usermod -aG docker $USER
# Fazer logout e login novamente
```

### Erro nas Migrations

```bash
# Verificar logs do backend
docker compose -f /opt/glpi-etus/docker-compose.prod.yml logs backend

# Executar migrations manualmente
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml exec backend sh -c '
  DB_HOST=${DB_HOST:-postgres}
  DB_PORT=${DB_PORT:-5432}
  DB_USER=${DB_USER:-glpi_etus}
  DB_PASSWORD=${DB_PASSWORD}
  DB_NAME=${DB_NAME:-glpi_etus}
  DB_SCHEMA=${DB_SCHEMA:-public}
  
  ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$DB_PASSWORD")
  export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}"
  
  npx prisma migrate deploy
'
```

### Rollback (Reverter Deploy)

```bash
# Listar backups disponíveis
ls -la /opt/glpi-etus/backups/

# Restaurar banco de dados
cd /opt/glpi-etus
docker compose -f docker-compose.prod.yml exec -T db psql -U glpi_etus glpi_etus < backups/YYYYMMDD_HHMMSS/database_backup.sql

# Restaurar uploads (se necessário)
cp -r backups/YYYYMMDD_HHMMSS/uploads/* backend/uploads/

# Reconstruir containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## 📋 Checklist de Deploy

Antes de fazer deploy:

- [ ] Código testado localmente
- [ ] Commits feitos e push para GitLab
- [ ] Backup automático será criado pelo script
- [ ] Variáveis de ambiente de produção configuradas
- [ ] Cloudflare Tunnel configurado (se aplicável)

Após o deploy:

- [ ] Containers estão rodando (`docker compose ps`)
- [ ] Backend está respondendo (`curl http://localhost:8080/health`)
- [ ] Frontend está acessível
- [ ] Migrations aplicadas com sucesso
- [ ] Logs sem erros críticos
- [ ] Funcionalidades principais testadas

## 🔐 Segurança

### Boas Práticas

1. **Nunca commitar arquivos `.env`** no GitLab
2. **Usar variáveis de ambiente** do GitLab para dados sensíveis
3. **Manter backups regulares** (o script cria automaticamente)
4. **Revisar logs** após cada deploy
5. **Testar em ambiente de staging** antes de produção (se disponível)

### Variáveis Sensíveis

Nunca inclua no repositório:
- Senhas de banco de dados
- Chaves JWT
- Chaves de API (OpenAI, Gemini)
- Credenciais do Cloudflare Tunnel
- Tokens de acesso

## 📞 Suporte

Para problemas durante o deploy:

1. Verifique os logs: `docker compose -f /opt/glpi-etus/docker-compose.prod.yml logs -f`
2. Consulte a seção [Troubleshooting](#-troubleshooting)
3. Entre em contato com a equipe de desenvolvimento

## 📚 Documentação Relacionada

- [README.md](./README.md) - Documentação completa do projeto
- [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md) - Checklist de validação pré-produção
- [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md) - Guia rápido de deploy operacional
