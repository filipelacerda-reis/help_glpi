# Configuração Docker Completa

Este projeto está 100% dockerizado. Todos os serviços rodam em containers Docker.

## 🐳 Serviços Dockerizados

### ✅ Serviços Incluídos

1. **PostgreSQL** (`glpi_etus_db`)
   - Imagem: `postgres:15-alpine`
   - Porta: `5432`
   - Volume: `postgres_data`
   - Healthcheck configurado

2. **Redis** (`glpi_etus_redis`)
   - Imagem: `redis:7-alpine`
   - Porta: `6379`
   - Volume: `redis_data`
   - Persistência habilitada (AOF)
   - Healthcheck configurado

3. **Backend** (`glpi_etus_backend`)
   - Build: Multi-stage Dockerfile
   - Porta: `8080` (configurável via PORT)
   - Volumes: Código fonte + uploads
   - Dependências: PostgreSQL e Redis

4. **Frontend** (`glpi_etus_frontend`)
   - Build: Multi-stage Dockerfile
   - Porta: `5173`
   - Volumes: Código fonte
   - Dependência: Backend

## 📋 Requisitos

- Docker Desktop instalado e rodando
- Arquivo `.env` configurado na raiz do projeto

## 🚀 Como Iniciar

### Desenvolvimento

```bash
# Iniciar todos os serviços
docker compose up -d

# Ver logs
docker compose logs -f

# Parar todos os serviços
docker compose down

# Parar e remover volumes (CUIDADO: apaga dados)
docker compose down -v
```

### Executar Migrations e Seed

```bash
# Executar migrations
docker exec glpi_etus_backend npx prisma migrate deploy

# Executar seed (criar usuário admin)
docker exec glpi_etus_backend npx prisma db seed
```

## 🔧 Configuração

### Variáveis de Ambiente

O arquivo `.env` na raiz do projeto deve conter:

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=glpi_etus
DB_PASSWORD=sua_senha_aqui
DB_NAME=glpi_etus
DB_SCHEMA=public

# JWT
JWT_SECRET=seu_jwt_secret_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_aqui

# Server
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://frontend:5173

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

### URLs Internas (Docker Network)

Dentro da rede Docker, os serviços se comunicam usando os nomes dos containers:

- **Backend → PostgreSQL**: `postgres:5432`
- **Backend → Redis**: `redis:6379`
- **Frontend → Backend**: `backend:8080`

### URLs Externas (Host)

Do seu navegador/máquina host:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🔍 Verificar Status

```bash
# Ver containers rodando
docker compose ps

# Ver logs de um serviço específico
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
docker compose logs redis

# Ver logs em tempo real
docker compose logs -f backend

# Verificar saúde dos serviços
docker inspect glpi_etus_db --format='{{.State.Health.Status}}'
docker inspect glpi_etus_redis --format='{{.State.Health.Status}}'
```

## 🛠️ Comandos Úteis

### Entrar no container

```bash
# Backend
docker exec -it glpi_etus_backend sh

# Frontend
docker exec -it glpi_etus_frontend sh

# PostgreSQL
docker exec -it glpi_etus_db psql -U glpi_etus -d glpi_etus

# Redis
docker exec -it glpi_etus_redis redis-cli
```

### Rebuild

```bash
# Rebuild de um serviço específico
docker compose build backend
docker compose build frontend

# Rebuild e reiniciar
docker compose up -d --build backend
```

### Limpar

```bash
# Parar e remover containers
docker compose down

# Remover volumes (CUIDADO: apaga dados)
docker compose down -v

# Limpar imagens não utilizadas
docker image prune

# Limpar tudo (CUIDADO)
docker system prune -a
```

## 📊 Volumes

- `postgres_data`: Dados do PostgreSQL (persistente)
- `redis_data`: Dados do Redis (persistente)
- `./backend/uploads`: Uploads do backend (bind mount)
- `./backend:/app`: Código do backend (bind mount - desenvolvimento)
- `./frontend:/app`: Código do frontend (bind mount - desenvolvimento)

## 🌐 Rede Docker

Todos os serviços estão na rede `glpi_etus_network` (bridge), permitindo comunicação interna entre containers.

## ✅ Checklist de Dockerização

- [x] PostgreSQL dockerizado
- [x] Redis dockerizado
- [x] Backend dockerizado com Dockerfile multi-stage
- [x] Frontend dockerizado com Dockerfile multi-stage
- [x] Healthchecks configurados
- [x] Volumes persistentes para dados
- [x] Rede Docker isolada
- [x] Variáveis de ambiente configuráveis
- [x] Dependências entre serviços (depends_on)
- [x] Restart policies configuradas
- [x] URLs internas usando nomes de serviços
- [x] .dockerignore configurado

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs
docker compose logs nome_do_servico

# Verificar se há conflito de porta
netstat -ano | findstr :8080
netstat -ano | findstr :5173
```

### Backend não conecta ao banco

```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Verificar logs do PostgreSQL
docker compose logs postgres

# Testar conexão manualmente
docker exec glpi_etus_backend npx prisma db pull
```

### Frontend não conecta ao backend

Verifique se `VITE_API_URL` está configurado corretamente. No Docker, deve usar `http://backend:8080` para comunicação interna, mas para o navegador deve ser `http://localhost:8080`.

## 📝 Notas

- Em desenvolvimento, os volumes são bind mounts para hot-reload
- Em produção, use `docker-compose.prod.yml` que não usa bind mounts
- O Redis é obrigatório - o backend não inicia sem ele
- Todas as migrations devem ser executadas manualmente após iniciar os containers

